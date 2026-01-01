
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
        
        try {
            await fs.chmod(DATA_ROOT, 0o777);
            await fs.chmod(UPLOADS_ROOT, 0o777);
            await fs.chmod(THUMBS_ROOT, 0o777);
        } catch (e) {
            console.warn(`[Vault] Chmod limited by host environment.`);
        }
    } catch (err) {
        console.error(`[Vault] FATAL: Initialization failed:`, err.message);
    }
};
ensureFolders();

app.use('/uploads', express.static(UPLOADS_ROOT, {
    maxAge: '1d',
    etag: true,
    setHeaders: (res, path) => {
        res.set('Access-Control-Allow-Origin', '*');
    }
}));

/**
 * 2. MYSQL CONNECTION CONFIG
 */
const getDbHost = () => {
    const rawHost = process.env.DB_HOST || 'localhost';
    if (rawHost.toLowerCase() === 'localhost') return '127.0.0.1';
    return rawHost;
};

const dbConfig = {
    host: getDbHost(),
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
        console.log(`[MySQL] Connected.`);

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
                id VARCHAR(255) PRIMARY KEY,
                username VARCHAR(100) UNIQUE,
                password VARCHAR(255),
                role VARCHAR(50),
                isActive BOOLEAN DEFAULT TRUE,
                name VARCHAR(255),
                createdAt DATETIME
            )`,
            `CREATE TABLE IF NOT EXISTS customers (
                id VARCHAR(255) PRIMARY KEY,
                phone VARCHAR(50) UNIQUE,
                name VARCHAR(255),
                role VARCHAR(50),
                createdAt DATETIME
            )`,
            `CREATE TABLE IF NOT EXISTS designs (
                id VARCHAR(255) PRIMARY KEY,
                imageUrl TEXT,
                prompt TEXT,
                aspectRatio VARCHAR(20),
                createdAt DATETIME
            )`,
            `CREATE TABLE IF NOT EXISTS analytics (
                id VARCHAR(255) PRIMARY KEY,
                type VARCHAR(50),
                productId VARCHAR(255),
                productTitle VARCHAR(255),
                userId VARCHAR(255),
                userName VARCHAR(255),
                deviceName TEXT,
                timestamp DATETIME,
                imageIndex INT
            )`,
            `CREATE TABLE IF NOT EXISTS app_config (
                id INT PRIMARY KEY DEFAULT 1,
                data JSON,
                CHECK (id = 1)
            )`
        ];

        for (const query of tables) { await pool.query(query); }

        const [rows] = await pool.query('SELECT count(*) as count FROM staff');
        if (rows[0].count === 0) {
            await pool.query(
                'INSERT INTO staff (id, username, password, role, isActive, name, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
                ['staff-root', 'admin', 'admin', 'admin', true, 'Sanghavi Admin', new Date()]
            );
        }
    } catch (err) {
        console.error('[MySQL] Init Error:', err.message);
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
        if (clean[field] && typeof clean[field] === 'string') {
            try {
                // Remove potential extra quotes if the DB returned it double-stringified
                let rawValue = clean[field].trim();
                if (rawValue.startsWith('"') && rawValue.endsWith('"') && rawValue.length > 1) {
                    rawValue = JSON.parse(rawValue);
                }
                clean[field] = JSON.parse(rawValue);
            } catch (e) {
                console.error(`Failed to parse field ${field}:`, e);
                clean[field] = []; 
            }
        }
        // Ensure it's an array if it should be
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
        
        try {
            await fs.chmod(absolutePath, 0o644);
        } catch (e) {}

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
                const isThumb = key.toLowerCase().includes('thumb');
                clean[key] = await saveToVault(val, isThumb);
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
app.get('/api/health', async (req, res) => {
    try {
        if (!pool) throw new Error('DB not ready');
        await pool.query('SELECT 1');
        res.json({ 
            status: 'online', 
            database: 'connected', 
            uploads_dir: existsSync(UPLOADS_ROOT)
        });
    } catch (e) { res.status(503).json({ status: 'offline', error: e.message }); }
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
        if (Array.isArray(p.images)) p.images = p.images.filter(img => img !== null);
        if (Array.isArray(p.thumbnails)) p.thumbnails = p.thumbnails.filter(img => img !== null);

        const query = `INSERT INTO products (id, title, category, subCategory, weight, description, tags, images, thumbnails, supplier, uploadedBy, isHidden, createdAt, dateTaken, meta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        await pool.query(query, [p.id, p.title, p.category, p.subCategory, p.weight, p.description, JSON.stringify(p.tags), JSON.stringify(p.images), JSON.stringify(p.thumbnails), p.supplier, p.uploadedBy, p.isHidden, new Date(p.createdAt), p.dateTaken, JSON.stringify(p.meta)]);
        res.json(p);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/products/:id', async (req, res) => {
    try {
        const p = await processMedia(req.body);
        if (Array.isArray(p.images)) p.images = p.images.filter(img => img !== null);
        if (Array.isArray(p.thumbnails)) p.thumbnails = p.thumbnails.filter(img => img !== null);

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

app.get('/api/config', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT data FROM app_config WHERE id = 1');
        const config = rows[0]?.data;
        res.json(typeof config === 'string' ? JSON.parse(config) : (config || {}));
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
        const user = { id: Date.now().toString(), phone, name: 'Client ' + phone.slice(-4), role: 'customer', createdAt: new Date() };
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

app.get('/api/staff', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, username, role, isActive, name, createdAt FROM staff');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/designs', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM designs ORDER BY createdAt DESC');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/designs', async (req, res) => {
    try {
        const clean = await processMedia(req.body);
        await pool.query('INSERT INTO designs (id, imageUrl, prompt, aspectRatio, createdAt) VALUES (?, ?, ?, ?, ?)', [clean.id, clean.imageUrl, clean.prompt, clean.aspectRatio, new Date(clean.createdAt)]);
        res.json(clean);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/analytics', async (req, res) => {
    try {
        const e = req.body;
        await pool.query('INSERT INTO analytics (id, type, productId, productTitle, userId, userName, deviceName, timestamp, imageIndex) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [e.id, e.type, e.productId, e.productTitle, e.userId, e.userName, e.deviceName, new Date(e.timestamp), e.imageIndex]);
        res.status(204).send();
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/analytics', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM analytics ORDER BY timestamp DESC');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/customers', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM customers ORDER BY createdAt DESC');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const distPath = path.resolve(process.cwd(), 'dist');
if (existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
            res.sendFile(path.join(distPath, 'index.html'));
        }
    });
}

app.listen(PORT, HOST, () => console.log(`[Production Studio] Running on port ${PORT}`));
