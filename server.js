
import 'dotenv/config'; 
import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import cors from 'cors';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Serve Uploads - Explicitly set headers for speed and CORS
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
const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
};

let pool;

const initializeDatabase = async () => {
    try {
        pool = mysql.createPool(dbConfig);
        await pool.query('SELECT 1');
        console.log(`[MySQL] Connection Established.`);

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
        console.error('[MySQL] Init Error:', err.message);
    }
};

initializeDatabase();

/**
 * Helper to ensure JSON fields are parsed correctly
 * Crucial for MariaDB/MySQL drivers that might return JSON as strings
 */
const parseJsonFields = (row, fields) => {
    if (!row) return row;
    const clean = { ...row };
    fields.forEach(field => {
        let val = clean[field];
        if (val && typeof val === 'string') {
            try {
                // Handle double stringification
                if (val.startsWith('"') && val.endsWith('"')) {
                    val = JSON.parse(val);
                }
                clean[field] = JSON.parse(val);
            } catch (e) {
                console.error(`Failed to parse field ${field}:`, e);
                clean[field] = field === 'meta' ? {} : [];
            }
        }
        // Fallback for arrays
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
    res.json({ status: 'online', database: pool ? 'connected' : 'connecting' });
});

app.get('/api/products', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM products ORDER BY createdAt DESC');
        const parsed = rows.map(r => parseJsonFields(r, ['tags', 'images', 'thumbnails', 'meta']));
        res.json(parsed);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/products', async (req, res) => {
    try {
        const p = await processMedia(req.body);
        const query = `INSERT INTO products (id, title, category, subCategory, weight, description, tags, images, thumbnails, supplier, uploadedBy, isHidden, createdAt, dateTaken, meta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        await pool.query(query, [p.id, p.title, p.category, p.subCategory, p.weight, p.description, JSON.stringify(p.tags), JSON.stringify(p.images), JSON.stringify(p.thumbnails), p.supplier, p.uploadedBy, p.isHidden, new Date(p.createdAt), p.dateTaken, JSON.stringify(p.meta)]);
        res.json(p);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/products/:id', async (req, res) => {
    try {
        const p = await processMedia(req.body);
        const query = `UPDATE products SET title=?, category=?, subCategory=?, weight=?, description=?, tags=?, images=?, thumbnails=?, supplier=?, uploadedBy=?, isHidden=?, dateTaken=?, meta=? WHERE id=?`;
        await pool.query(query, [p.title, p.category, p.subCategory, p.weight, p.description, JSON.stringify(p.tags), JSON.stringify(p.images), JSON.stringify(p.thumbnails), p.supplier, p.uploadedBy, p.isHidden, p.dateTaken, JSON.stringify(p.meta), req.params.id]);
        res.json(p);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
        res.status(204).send();
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Auth & Config Endpoints...
app.get('/api/config', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT data FROM app_config WHERE id = 1');
        res.json(parseJsonFields(rows[0], ['data'])?.data || {});
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/config', async (req, res) => {
    try {
        await pool.query('INSERT INTO app_config (id, data) VALUES (1, ?) ON DUPLICATE KEY UPDATE data = ?', [JSON.stringify(req.body), JSON.stringify(req.body)]);
        res.json(req.body);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/whatsapp', async (req, res) => {
    try {
        const { phone } = req.body;
        const [rows] = await pool.query('SELECT * FROM customers WHERE phone = ?', [phone]);
        if (rows.length > 0) return res.json(rows[0]);
        const user = { id: crypto.randomUUID(), phone, name: 'Client ' + phone.slice(-4), role: 'customer', createdAt: new Date() };
        await pool.query('INSERT INTO customers (id, phone, name, role, createdAt) VALUES (?, ?, ?, ?, ?)', [user.id, user.phone, user.name, user.role, user.createdAt]);
        res.json(user);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/staff', async (req, res) => {
    try {
        const { username, password } = req.body;
        const [rows] = await pool.query('SELECT * FROM staff WHERE username = ? AND password = ? AND isActive = 1', [username, password]);
        if (rows.length > 0) res.json(rows[0]);
        else res.status(401).json({ error: 'Invalid Credentials' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

/**
 * 5. STATIC FILES & SPA ROUTING
 * Critical: Static files (dist) must be served BEFORE the catch-all
 */
const distPath = path.resolve(process.cwd(), 'dist');
if (existsSync(distPath)) {
    // Serve static files (manifest.json, images, js, css)
    app.use(express.static(distPath, {
        index: false // Prevent serving index.html automatically for /
    }));

    // Handle SPA routing: Everything else serves index.html
    app.get('*', (req, res) => {
        // Skip API and uploads
        if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
            return res.status(404).json({ error: 'Not found' });
        }
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

app.listen(PORT, HOST, () => console.log(`[Production Studio] Running on port ${PORT}`));
