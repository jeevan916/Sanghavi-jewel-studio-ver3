
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from build config
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

app.use(cors());
app.use(express.json({ limit: '100mb' }));

/** 
 * CRITICAL DATA PRESERVATION:
 * Relocated to '..' to stay in the domain root and avoid deletion during builds/deployments.
 * This folder is PERMANENT and will never be touched by the build process.
 */
const DATA_ROOT = path.resolve(process.cwd(), '..', 'sanghavi_persistence');
const UPLOADS_ROOT = path.resolve(DATA_ROOT, 'uploads');
const THUMBS_ROOT = path.resolve(UPLOADS_ROOT, 'thumbnails');

const ensureFolders = async () => {
    try {
        if (!existsSync(DATA_ROOT)) {
            console.log(`[Vault] Creating persistent vault at: ${DATA_ROOT}`);
            mkdirSync(DATA_ROOT, { recursive: true, mode: 0o777 });
        }
        if (!existsSync(UPLOADS_ROOT)) mkdirSync(UPLOADS_ROOT, { recursive: true, mode: 0o777 });
        if (!existsSync(THUMBS_ROOT)) mkdirSync(THUMBS_ROOT, { recursive: true, mode: 0o777 });
        console.log(`[Vault] Persistence verified at domain root.`);
    } catch (err) {
        console.error(`[Vault] Init failed. Falling back to local...`, err.message);
        const fallback = path.resolve(process.cwd(), 'sanghavi_persistence');
        if (!existsSync(fallback)) mkdirSync(fallback, { recursive: true });
    }
};
ensureFolders();

app.use('/uploads', express.static(UPLOADS_ROOT, {
    maxAge: '30d', // High cache for 3G performance
    etag: true,
    setHeaders: (res) => {
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Cache-Control', 'public, max-age=2592000');
    }
}));

/**
 * MYSQL CONFIG
 */
const dbConfig = {
    host: (process.env.DB_HOST || 'localhost').toLowerCase() === 'localhost' ? '127.0.0.1' : process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    enableKeepAlive: true,
    connectTimeout: 30000
};

let pool;
let dbStatus = { healthy: false, error: 'Initializing...' };

const initDB = async () => {
    try {
        pool = mysql.createPool(dbConfig);
        await pool.query('SELECT 1');
        dbStatus = { healthy: true, error: null };
        console.log(`[Database] Secured connection to ${dbConfig.database}`);

        const tables = [
            `CREATE TABLE IF NOT EXISTS products (
                id VARCHAR(255) PRIMARY KEY, title VARCHAR(255) NOT NULL, category VARCHAR(100),
                subCategory VARCHAR(100), weight DECIMAL(10,3), description TEXT, tags JSON,
                images JSON, thumbnails JSON, supplier VARCHAR(255), uploadedBy VARCHAR(255),
                isHidden BOOLEAN DEFAULT FALSE, createdAt DATETIME, dateTaken DATE, meta JSON
            )`,
            `CREATE TABLE IF NOT EXISTS staff (
                id VARCHAR(255) PRIMARY KEY, username VARCHAR(100) UNIQUE, password VARCHAR(255),
                role VARCHAR(50), isActive BOOLEAN DEFAULT TRUE, name VARCHAR(255), createdAt DATETIME
            )`,
            `CREATE TABLE IF NOT EXISTS customers (
                id VARCHAR(255) PRIMARY KEY, phone VARCHAR(50) UNIQUE, name VARCHAR(255),
                role VARCHAR(50), createdAt DATETIME
            )`,
            `CREATE TABLE IF NOT EXISTS app_config (id INT PRIMARY KEY DEFAULT 1, data JSON, CHECK (id = 1))`
        ];
        for (const query of tables) { await pool.query(query); }
    } catch (err) {
        console.error('[Database] Init Error:', err.message);
        dbStatus = { healthy: false, error: err.message };
    }
};
initDB();

const saveFile = async (base64, isThumb = false) => {
    if (!base64 || !base64.startsWith('data:image')) return base64;
    try {
        const match = base64.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
        const data = match[2];
        const fileName = `${crypto.randomUUID()}.jpg`;
        const relPath = isThumb ? `thumbnails/${fileName}` : fileName;
        const absPath = path.resolve(UPLOADS_ROOT, relPath);
        await fs.writeFile(absPath, Buffer.from(data, 'base64'));
        return `/uploads/${relPath}`;
    } catch (err) { return null; }
};

const parseJson = (row, fields) => {
    if (!row) return row;
    fields.forEach(f => {
        try { row[f] = typeof row[f] === 'string' ? JSON.parse(row[f]) : row[f]; }
        catch(e) { row[f] = f === 'meta' ? {} : []; }
    });
    return row;
};

app.get('/api/health', (req, res) => res.json(dbStatus));

app.get('/api/products', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM products ORDER BY createdAt DESC');
        res.json(rows.map(r => parseJson(r, ['tags', 'images', 'thumbnails', 'meta'])));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/products', async (req, res) => {
    try {
        const p = req.body;
        const savedImgs = await Promise.all((p.images || []).map(img => saveFile(img, false)));
        const savedThumbs = await Promise.all((p.thumbnails || []).map(img => saveFile(img, true)));
        
        const q = `INSERT INTO products (id, title, category, subCategory, weight, description, tags, images, thumbnails, supplier, uploadedBy, isHidden, createdAt, dateTaken, meta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        await pool.query(q, [p.id, p.title, p.category, p.subCategory, p.weight, p.description, JSON.stringify(p.tags), JSON.stringify(savedImgs), JSON.stringify(savedThumbs), p.supplier, p.uploadedBy, p.isHidden, new Date(), p.dateTaken, JSON.stringify(p.meta)]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/products/:id', async (req, res) => {
    try {
        const p = req.body;
        const imgs = await Promise.all((p.images || []).map(img => img.startsWith('data:') ? saveFile(img, false) : img));
        const thumbs = await Promise.all((p.thumbnails || []).map(img => img.startsWith('data:') ? saveFile(img, true) : img));
        const q = `UPDATE products SET title=?, category=?, subCategory=?, weight=?, description=?, tags=?, images=?, thumbnails=?, isHidden=?, dateTaken=?, meta=? WHERE id=?`;
        await pool.query(q, [p.title, p.category, p.subCategory, p.weight, p.description, JSON.stringify(p.tags), JSON.stringify(imgs), JSON.stringify(thumbs), p.isHidden, p.dateTaken, JSON.stringify(p.meta), req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        // ADMIN ONLY: Delete record. Files persist in vault for audit/safety.
        await pool.query('DELETE FROM products WHERE id=?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/staff', async (req, res) => {
    try {
        const { username, password } = req.body;
        const [rows] = await pool.query('SELECT * FROM staff WHERE username=? AND password=? AND isActive=1', [username, password]);
        if (rows[0]) res.json(rows[0]);
        else res.status(401).json({ error: 'Unauthorized' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/staff', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, username, role, isActive, name, createdAt FROM staff');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/config', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT data FROM app_config WHERE id=1');
        res.json(parseJson(rows[0], ['data'])?.data || {});
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/config', async (req, res) => {
    try {
        await pool.query('INSERT INTO app_config (id, data) VALUES (1, ?) ON DUPLICATE KEY UPDATE data=?', [JSON.stringify(req.body), JSON.stringify(req.body)]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/whatsapp', async (req, res) => {
    try {
        const { phone } = req.body;
        const [rows] = await pool.query('SELECT * FROM customers WHERE phone=?', [phone]);
        if (rows[0]) return res.json(rows[0]);
        const user = { id: crypto.randomUUID(), phone, name: `Client ${phone.slice(-4)}`, role: 'customer', createdAt: new Date() };
        await pool.query('INSERT INTO customers (id, phone, name, role, createdAt) VALUES (?,?,?,?,?)', [user.id, user.phone, user.name, user.role, user.createdAt]);
        res.json(user);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const dist = path.resolve(process.cwd(), 'dist');
if (existsSync(dist)) {
    app.use(express.static(dist, { index: false }));
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return res.status(404).json({error: 'Not found'});
        res.sendFile(path.join(dist, 'index.html'));
    });
}

app.listen(PORT, HOST, () => console.log(`[Sanghavi Studio] Permanent Storage Active on ${PORT}`));
