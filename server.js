
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load env from the specific path provided: /public_html/.builds/config/.env
// We use process.cwd() to ensure it resolves correctly from the project root.
dotenv.config({ path: path.resolve(process.cwd(), '.builds/config/.env') });

import express from 'express';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import cors from 'cors';
import crypto from 'crypto';
import mysql from 'mysql2/promise';

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Middlewares
app.use(cors());
app.use(express.json({ limit: '100mb' }));

/** 
 * 1. PHYSICAL PERSISTENCE SETUP
 */
const DATA_ROOT = path.resolve(process.cwd(), 'sanghavi_persistence');
const UPLOADS_ROOT = path.resolve(DATA_ROOT, 'uploads');
const THUMBS_ROOT = path.resolve(UPLOADS_ROOT, 'thumbnails');

const ensureFolders = async () => {
    try {
        if (!existsSync(DATA_ROOT)) mkdirSync(DATA_ROOT, { recursive: true, mode: 0o777 });
        if (!existsSync(UPLOADS_ROOT)) mkdirSync(UPLOADS_ROOT, { recursive: true, mode: 0o777 });
        if (!existsSync(THUMBS_ROOT)) mkdirSync(THUMBS_ROOT, { recursive: true, mode: 0o777 });
    } catch (err) {
        console.error(`[Vault] Initialization failed:`, err.message);
    }
};
ensureFolders();

app.use('/uploads', express.static(UPLOADS_ROOT, {
    maxAge: '1d',
    etag: true,
    setHeaders: (res) => {
        res.set('Access-Control-Allow-Origin', '*');
    }
}));

/**
 * 2. MYSQL CONNECTION CONFIG
 */
const getSafeDbHost = () => {
    const host = process.env.DB_HOST || 'localhost';
    if (host.toLowerCase() === 'localhost') return '127.0.0.1';
    return host;
};

const dbConfig = {
    host: getSafeDbHost(),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    connectTimeout: 20000
};

let pool;
let dbStatus = { healthy: false, error: 'Database initializing...' };

const initializeDatabase = async () => {
    try {
        console.log(`[MySQL] Attempting connection to ${dbConfig.host} as ${dbConfig.user}...`);
        pool = mysql.createPool(dbConfig);
        
        // Immediate test query
        await pool.query('SELECT 1');
        
        console.log(`[MySQL] Connection Established.`);
        dbStatus = { healthy: true, error: null };

        const tables = [
            `CREATE TABLE IF NOT EXISTS products (
                id VARCHAR(255) PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                category VARCHAR(100),
                subCategory VARCHAR(100),
                weight DECIMAL(10,3),
                description TEXT,
                tags JSON,
                images JSON,
                thumbnails JSON,
                supplier VARCHAR(255),
                uploadedBy VARCHAR(255),
                isHidden BOOLEAN DEFAULT FALSE,
                createdAt DATETIME,
                dateTaken DATE,
                meta JSON
            )`,
            `CREATE TABLE IF NOT EXISTS staff (
                id VARCHAR(255) PRIMARY KEY, username VARCHAR(100) UNIQUE, password VARCHAR(255), role VARCHAR(50), isActive BOOLEAN DEFAULT TRUE, name VARCHAR(255), createdAt DATETIME
            )`,
            `CREATE TABLE IF NOT EXISTS customers (
                id VARCHAR(255) PRIMARY KEY, phone VARCHAR(50) UNIQUE, name VARCHAR(255), role VARCHAR(50), createdAt DATETIME
            )`,
            `CREATE TABLE IF NOT EXISTS app_config (
                id INT PRIMARY KEY DEFAULT 1, data JSON, CHECK (id = 1)
            )`
        ];

        for (const query of tables) { await pool.query(query); }

        const [rows] = await pool.query('SELECT count(*) as count FROM staff');
        if (rows[0].count === 0) {
            await pool.query(
                'INSERT INTO staff (id, username, password, role, isActive, name, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
                ['root', 'admin', 'admin', 'admin', true, 'Sanghavi Admin', new Date()]
            );
        }
    } catch (err) {
        let errorMsg = err.message;
        if (err.code === 'ER_ACCESS_DENIED_ERROR') {
            errorMsg = `DB Access Denied: Check credentials in .builds/config/.env. Current User: ${dbConfig.user}. Host: ${dbConfig.host}`;
        } else if (err.code === 'ECONNREFUSED') {
            errorMsg = `DB Connection Refused: Check if DB_HOST (${dbConfig.host}) is correct and MySQL is reachable.`;
        }
        
        console.error('[MySQL] Init Error:', errorMsg);
        dbStatus = { healthy: false, error: errorMsg };
    }
};

initializeDatabase();

/**
 * Helper to ensure JSON fields are parsed correctly
 */
const parseJsonFields = (row, fields) => {
    if (!row) return row;
    const clean = { ...row };
    fields.forEach(field => {
        let val = clean[field];
        if (val && typeof val === 'string') {
            try {
                if (val.startsWith('"') && val.endsWith('"')) {
                    val = JSON.parse(val);
                }
                clean[field] = JSON.parse(val);
            } catch (e) {
                clean[field] = field === 'meta' ? {} : [];
            }
        }
        if (['images', 'thumbnails', 'tags'].includes(field) && !Array.isArray(clean[field])) {
            clean[field] = [];
        }
    });
    return clean;
};

/**
 * 3. ASSET UTILITY
 */
const saveToVault = async (base64, isThumb = false) => {
    if (!base64 || typeof base64 !== 'string' || !base64.startsWith('data:image')) return base64;
    
    try {
        const match = base64.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
        if (!match) return base64;
        
        const type = match[1];
        const data = match[2];
        const extension = type === 'jpeg' ? 'jpg' : type;
        const fileName = `${crypto.randomUUID()}.${extension}`;
        const relativePath = isThumb ? `thumbnails/${fileName}` : fileName;
        const absolutePath = path.resolve(UPLOADS_ROOT, relativePath);

        const buffer = Buffer.from(data, 'base64');
        await fs.writeFile(absolutePath, buffer);
        return `/uploads/${relativePath}`;
    } catch (err) {
        console.error(`[Vault] Save Error:`, err.message);
        return null;
    }
};

const processMedia = async (data) => {
    if (Array.isArray(data)) return await Promise.all(data.map(item => processMedia(item)));
    if (data && typeof data === 'object') {
        const clean = { ...data };
        for (const key of Object.keys(clean)) {
            const val = clean[key];
            if (typeof val === 'string' && val.startsWith('data:image')) {
                clean[key] = await saveToVault(val, key.toLowerCase().includes('thumb'));
            } else if (Array.isArray(val)) {
                clean[key] = await Promise.all(val.map(v => 
                    (typeof v === 'string' && v.startsWith('data:image')) 
                    ? saveToVault(v, key.toLowerCase().includes('thumb')) 
                    : (typeof v === 'object' && v !== null ? processMedia(v) : v)
                ));
            } else if (val && typeof val === 'object') {
                clean[key] = await processMedia(val);
            }
        }
        return clean;
    }
    return data;
};

/**
 * 4. API ENGINE
 */
app.get('/api/health', (req, res) => {
    res.json({ 
        status: dbStatus.healthy ? 'online' : 'offline', 
        database: dbStatus.healthy ? 'connected' : 'error',
        error: dbStatus.error
    });
});

app.get('/api/products', async (req, res) => {
    if (!dbStatus.healthy) return res.status(503).json({ error: dbStatus.error });
    try {
        const [rows] = await pool.query('SELECT * FROM products ORDER BY createdAt DESC');
        const parsed = rows.map(r => parseJsonFields(r, ['tags', 'images', 'thumbnails', 'meta']));
        res.json(parsed);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/products', async (req, res) => {
    if (!dbStatus.healthy) return res.status(503).json({ error: dbStatus.error });
    try {
        const p = await processMedia(req.body);
        const query = `INSERT INTO products (id, title, category, subCategory, weight, description, tags, images, thumbnails, supplier, uploadedBy, isHidden, createdAt, dateTaken, meta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        await pool.query(query, [p.id, p.title, p.category, p.subCategory, p.weight, p.description, JSON.stringify(p.tags), JSON.stringify(p.images), JSON.stringify(p.thumbnails), p.supplier, p.uploadedBy, p.isHidden, new Date(p.createdAt), p.dateTaken, JSON.stringify(p.meta)]);
        res.json(p);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/staff', async (req, res) => {
    if (!dbStatus.healthy) {
        return res.status(503).json({ error: `Database Connection Failure: ${dbStatus.error}` });
    }
    try {
        const { username, password } = req.body;
        const [rows] = await pool.query('SELECT * FROM staff WHERE username = ? AND password = ? AND isActive = 1', [username, password]);
        if (rows.length > 0) res.json(rows[0]);
        else res.status(401).json({ error: 'Invalid Staff Credentials' });
    } catch (err) { 
        console.error('[Auth Error]', err.message);
        res.status(500).json({ error: `System Error: ${err.message}` }); 
    }
});

app.get('/api/staff', async (req, res) => {
    if (!dbStatus.healthy) return res.status(503).json({ error: dbStatus.error });
    try {
        const [rows] = await pool.query('SELECT id, username, role, isActive, name, createdAt FROM staff');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/config', async (req, res) => {
    if (!dbStatus.healthy) return res.status(503).json({ error: dbStatus.error });
    try {
        const [rows] = await pool.query('SELECT data FROM app_config WHERE id = 1');
        res.json(parseJsonFields(rows[0], ['data'])?.data || {});
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/config', async (req, res) => {
    if (!dbStatus.healthy) return res.status(503).json({ error: dbStatus.error });
    try {
        await pool.query('INSERT INTO app_config (id, data) VALUES (1, ?) ON DUPLICATE KEY UPDATE data = ?', [JSON.stringify(req.body), JSON.stringify(req.body)]);
        res.json(req.body);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/whatsapp', async (req, res) => {
    if (!dbStatus.healthy) return res.status(503).json({ error: dbStatus.error });
    try {
        const { phone } = req.body;
        const [rows] = await pool.query('SELECT * FROM customers WHERE phone = ?', [phone]);
        if (rows.length > 0) return res.json(rows[0]);
        const user = { id: crypto.randomUUID(), phone, name: 'Client ' + phone.slice(-4), role: 'customer', createdAt: new Date() };
        await pool.query('INSERT INTO customers (id, phone, name, role, createdAt) VALUES (?, ?, ?, ?, ?)', [user.id, user.phone, user.name, user.role, user.createdAt]);
        res.json(user);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

/**
 * 5. STATIC FILES & SPA ROUTING
 */
const distPath = path.resolve(process.cwd(), 'dist');
if (existsSync(distPath)) {
    app.use(express.static(distPath, { index: false }));
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
            return res.status(404).json({ error: 'Not found' });
        }
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

app.listen(PORT, HOST, () => console.log(`[Production Studio] Running on port ${PORT}`));
