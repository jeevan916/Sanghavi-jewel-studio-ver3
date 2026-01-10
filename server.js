
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const DATA_ROOT = path.resolve(process.cwd(), '.builds', 'sanghavi_persistence');
const UPLOADS_ROOT = path.resolve(DATA_ROOT, 'uploads');
const BACKUP_ROOT = path.resolve(process.cwd(), '.builds', 'backup');

const ensureFolders = async () => {
    try {
        if (!existsSync(DATA_ROOT)) mkdirSync(DATA_ROOT, { recursive: true, mode: 0o777 });
        if (!existsSync(UPLOADS_ROOT)) mkdirSync(UPLOADS_ROOT, { recursive: true, mode: 0o777 });
        if (!existsSync(BACKUP_ROOT)) mkdirSync(BACKUP_ROOT, { recursive: true, mode: 0o777 });
    } catch (err) { console.error(`[Vault] Init failed:`, err.message); }
};
ensureFolders();

app.use('/uploads', express.static(UPLOADS_ROOT));

const dbConfig = {
    host: (process.env.DB_HOST || 'localhost').toLowerCase() === 'localhost' ? '127.0.0.1' : process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
};

let pool;
let dbStatus = { healthy: false, error: 'Initializing...' };

const initDB = async () => {
    try {
        pool = mysql.createPool(dbConfig);
        await pool.query('SELECT 1');
        dbStatus = { healthy: true, error: null };
        await createTables();
        await seedDefaultAdmin();
    } catch (err) {
        dbStatus = { healthy: false, error: err.message };
        setTimeout(initDB, 10000); 
    }
};

const createTables = async () => {
    if (!pool) return;
    const queries = [
        `CREATE TABLE IF NOT EXISTS products (id VARCHAR(255) PRIMARY KEY, title VARCHAR(255) NOT NULL, category VARCHAR(100), subCategory VARCHAR(100), weight DECIMAL(10,3), description TEXT, tags JSON, images JSON, thumbnails JSON, supplier VARCHAR(255), uploadedBy VARCHAR(255), isHidden BOOLEAN DEFAULT FALSE, createdAt DATETIME, dateTaken DATE, meta JSON)`,
        `CREATE TABLE IF NOT EXISTS staff (id VARCHAR(255) PRIMARY KEY, username VARCHAR(100) UNIQUE, password VARCHAR(255), role VARCHAR(50), isActive BOOLEAN DEFAULT TRUE, name VARCHAR(255), createdAt DATETIME)`,
        `CREATE TABLE IF NOT EXISTS customers (id VARCHAR(255) PRIMARY KEY, phone VARCHAR(50) UNIQUE, name VARCHAR(255), pincode VARCHAR(20), lastLocation JSON, role VARCHAR(50), createdAt DATETIME)`,
        `CREATE TABLE IF NOT EXISTS app_config (id INT PRIMARY KEY DEFAULT 1, data JSON)`,
        `CREATE TABLE IF NOT EXISTS analytics (id VARCHAR(255) PRIMARY KEY, type VARCHAR(50), productId VARCHAR(255), productTitle VARCHAR(255), category VARCHAR(100), weight DECIMAL(10,3), userId VARCHAR(255), userName VARCHAR(255), timestamp DATETIME, duration INT DEFAULT 0, meta JSON)`,
        `CREATE TABLE IF NOT EXISTS designs (id VARCHAR(255) PRIMARY KEY, imageUrl LONGTEXT, prompt TEXT, aspectRatio VARCHAR(20), createdAt DATETIME)`,
        `CREATE TABLE IF NOT EXISTS shared_links (id VARCHAR(255) PRIMARY KEY, targetId VARCHAR(255), type VARCHAR(50), token VARCHAR(255) UNIQUE, expiresAt DATETIME)`
    ];
    for (const q of queries) await pool.query(q);
};

const seedDefaultAdmin = async () => {
    try {
        const [rows] = await pool.query('SELECT * FROM staff WHERE username = "admin"');
        if (rows.length === 0) {
            await pool.query('INSERT INTO staff (id, username, password, role, isActive, name, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)', 
            [crypto.randomUUID(), 'admin', 'admin123', 'admin', true, 'Sanghavi Admin', new Date()]);
        }
    } catch (e) {}
};

initDB();

// Global Data Sanitizer - Crucial for "p.filter is not a function" fix
const sanitizeProduct = (p) => {
    if (!p) return null;
    const safeParse = (str, fallback = []) => {
        try {
            if (typeof str === 'object' && str !== null) return str;
            return JSON.parse(str || (Array.isArray(fallback) ? '[]' : '{}'));
        } catch (e) { return fallback; }
    };

    return {
        ...p,
        tags: safeParse(p.tags, []),
        images: safeParse(p.images, []),
        thumbnails: safeParse(p.thumbnails, []),
        meta: safeParse(p.meta, {})
    };
};

// --- AUTH ENDPOINTS ---
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await pool.query('SELECT id, username, role, name, isActive FROM staff WHERE username = ? AND password = ?', [username, password]);
        if (rows[0]) {
            if (!rows[0].isActive) return res.status(403).json({ error: 'Account disabled' });
            res.json({ user: rows[0] });
        } else res.status(401).json({ error: 'Invalid credentials' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/customers/login', async (req, res) => {
    const { phone, name, pincode, location } = req.body;
    try {
        const [existing] = await pool.query('SELECT * FROM customers WHERE phone = ?', [phone]);
        if (existing.length > 0) {
            await pool.query('UPDATE customers SET lastLocation = ? WHERE phone = ?', [JSON.stringify(location || {}), phone]);
            res.json({ user: existing[0] });
        } else {
            const id = crypto.randomUUID();
            await pool.query('INSERT INTO customers (id, phone, name, pincode, lastLocation, role, createdAt) VALUES (?,?,?,?,?,?,?)',
            [id, phone, name || `Client ${phone.slice(-4)}`, pincode || '', JSON.stringify(location || {}), 'customer', new Date()]);
            const [created] = await pool.query('SELECT * FROM customers WHERE id = ?');
            res.json({ user: created[0] });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/customers/check/:phone', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM customers WHERE phone = ?', [req.params.phone]);
        res.json({ exists: rows.length > 0, user: rows[0] || null });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- PRODUCT ENDPOINTS ---
app.get('/api/products', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM products ORDER BY createdAt DESC');
        res.json({ items: rows.map(sanitizeProduct), meta: { totalPages: 1 } });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/products/curated', async (req, res) => {
    try {
        const [latest] = await pool.query('SELECT * FROM products WHERE isHidden = FALSE ORDER BY createdAt DESC LIMIT 10');
        const [trending] = await pool.query('SELECT * FROM products WHERE isHidden = FALSE LIMIT 10'); 
        res.json({
            latest: latest.map(sanitizeProduct),
            trending: trending.map(sanitizeProduct),
            loved: [],
            ideal: []
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/products/:id', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
        if (rows[0]) res.json(sanitizeProduct(rows[0]));
        else res.status(404).json({ error: 'Not found' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/products/:id/stats', async (req, res) => {
    try {
        const [likes] = await pool.query('SELECT COUNT(*) as count FROM analytics WHERE productId = ? AND type = "like"', [req.params.id]);
        const [inqs] = await pool.query('SELECT COUNT(*) as count FROM analytics WHERE productId = ? AND type = "inquiry"', [req.params.id]);
        res.json({ like: likes[0].count, inquiry: inqs[0].count, dislike: 0, purchase: 0 });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/products', async (req, res) => {
    const p = req.body;
    try {
        await pool.query('INSERT INTO products (id, title, category, subCategory, weight, description, tags, images, thumbnails, supplier, uploadedBy, isHidden, createdAt, dateTaken, meta) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', 
        [p.id, p.title, p.category, p.subCategory, p.weight, p.description, JSON.stringify(p.tags || []), JSON.stringify(p.images || []), JSON.stringify(p.thumbnails || []), p.supplier, p.uploadedBy, p.isHidden, new Date(), new Date(), JSON.stringify(p.meta || {})]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- ANALYTICS & INTELLIGENCE ---
app.post('/api/analytics', async (req, res) => {
    const e = req.body;
    try {
        await pool.query('INSERT INTO analytics (id, type, productId, productTitle, category, weight, userId, userName, timestamp, duration, meta) VALUES (?,?,?,?,?,?,?,?,?,?,?)', 
        [crypto.randomUUID(), e.type, e.productId, e.productTitle, e.category, e.weight, e.userId, e.userName, new Date(), e.duration || 0, JSON.stringify(e.meta || {})]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/intelligence', async (req, res) => {
    try {
        res.json({
            spendingPower: [],
            devices: [{ os: 'iOS', user_count: 5 }, { os: 'Android', user_count: 3 }],
            regionalDemand: [],
            engagement: []
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/config', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT data FROM app_config WHERE id=1');
        res.json(rows[0] ? JSON.parse(rows[0].data) : { suppliers: [], categories: [], linkExpiryHours: 24 });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/config', async (req, res) => {
    try {
        await pool.query('INSERT INTO app_config (id, data) VALUES (1, ?) ON DUPLICATE KEY UPDATE data=?', [JSON.stringify(req.body), JSON.stringify(req.body)]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/health', (req, res) => res.json({ status: 'online', healthy: dbStatus.healthy }));

const dist = path.resolve(process.cwd(), 'dist');
if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.listen(PORT, HOST, () => console.log(`[Sanghavi Studio] Running on port ${PORT}`));
