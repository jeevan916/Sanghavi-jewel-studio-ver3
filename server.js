
import 'dotenv/config'; // Must be first line to load .env variables
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

app.use(cors());
app.use(express.json({ limit: '100mb' }));

/** 
 * 1. PHYSICAL PERSISTENCE SETUP
 * Images are carved into these folders to keep DB lightweight.
 */
const DATA_ROOT = path.resolve(__dirname, 'sanghavi_persistence');
const UPLOADS_ROOT = path.resolve(DATA_ROOT, 'uploads');
const THUMBS_ROOT = path.resolve(UPLOADS_ROOT, 'thumbnails');

if (!existsSync(UPLOADS_ROOT)) mkdirSync(UPLOADS_ROOT, { recursive: true });
if (!existsSync(THUMBS_ROOT)) mkdirSync(THUMBS_ROOT, { recursive: true });

app.use('/uploads', express.static(UPLOADS_ROOT));

/**
 * 2. MYSQL CONNECTION CONFIG
 */
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sanghavi_studio',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
};

let pool;

const initializeDatabase = async () => {
    try {
        console.log('----------------------------------------------------');
        console.log(`[MySQL] Initializing connection to: ${dbConfig.host}`);
        console.log(`[MySQL] Target Database: ${dbConfig.database}`);
        console.log(`[MySQL] Database User: ${dbConfig.user}`);

        // Phase 1: Try direct connection (Best for Hostinger/Pre-created DBs)
        try {
            pool = mysql.createPool(dbConfig);
            await pool.query('SELECT 1');
            console.log(`[MySQL] Direct connection successful.`);
        } catch (initialError) {
            // Phase 2: If DB missing and on Localhost, try creating it
            if (initialError.code === 'ER_BAD_DB_ERROR' && (dbConfig.host === 'localhost' || dbConfig.host === '127.0.0.1')) {
                console.warn(`[MySQL] Database "${dbConfig.database}" not found. Attempting to create...`);
                const setupConn = await mysql.createConnection({
                    host: dbConfig.host,
                    user: dbConfig.user,
                    password: dbConfig.password,
                });
                await setupConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
                await setupConn.end();
                console.log(`[MySQL] Database created successfully.`);
                pool = mysql.createPool(dbConfig);
            } else {
                throw initialError; // Rethrow if it's a permission or network error
            }
        }

        // Phase 3: Synchronize Tables
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

        for (const query of tables) {
            await pool.query(query);
        }

        // Seed Default Admin if missing
        const [rows] = await pool.query('SELECT count(*) as count FROM staff');
        if (rows[0].count === 0) {
            await pool.query(
                'INSERT INTO staff (id, username, password, role, isActive, name, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
                ['staff-root', 'admin', 'admin', 'admin', true, 'Sanghavi Admin', new Date()]
            );
            console.log('[MySQL] Default admin account seeded (admin/admin).');
        }

        console.log('[MySQL] Persistence Engine Fully Synchronized.');
        console.log(`[Vault] Assets Storage: ${UPLOADS_ROOT}`);
        console.log('----------------------------------------------------');
    } catch (err) {
        console.error('----------------------------------------------------');
        console.error('[MySQL] FATAL INITIALIZATION ERROR');
        console.error(`Error Code: ${err.code}`);
        console.error(`Message: ${err.message}`);
        console.error('----------------------------------------------------');
        console.error('CHECKLIST:');
        console.error('1. Is your MySQL server running (XAMPP)?');
        console.error('2. Are the credentials in your .env file correct?');
        console.error('3. If on Hostinger, have you created the database and user in the control panel?');
        console.log('----------------------------------------------------');
    }
};

initializeDatabase();

/**
 * 3. IMAGE CARVING UTILITY
 */
const extractAndSavePhysicalImage = async (base64, isThumbnail = false) => {
    if (!base64 || typeof base64 !== 'string' || !base64.startsWith('data:image')) return base64;
    try {
        const match = base64.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
        if (!match) return base64;
        const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
        const fileName = `${crypto.randomUUID()}.${ext}`;
        const relativePath = isThumbnail ? `thumbnails/${fileName}` : fileName;
        const fullPath = path.resolve(UPLOADS_ROOT, relativePath);
        await fs.writeFile(fullPath, Buffer.from(match[2], 'base64'));
        return `/uploads/${relativePath}`;
    } catch (err) {
        console.error('[Vault] Image Carving Failure:', err);
        return base64;
    }
};

const migrateToPhysical = async (data) => {
    if (Array.isArray(data)) {
        return await Promise.all(data.map(item => migrateToPhysical(item)));
    } else if (data && typeof data === 'object') {
        const clean = { ...data };
        for (const key of Object.keys(clean)) {
            if (typeof clean[key] === 'string' && clean[key].startsWith('data:image')) {
                clean[key] = await extractAndSavePhysicalImage(clean[key], key.toLowerCase().includes('thumb'));
            } else if (typeof clean[key] === 'object') {
                clean[key] = await migrateToPhysical(clean[key]);
            }
        }
        return clean;
    }
    return data;
};

/**
 * 4. API ENDPOINTS
 */
app.get('/api/health', async (req, res) => {
    try {
        if (!pool) throw new Error('Database connection not established.');
        await pool.query('SELECT 1');
        res.json({ status: 'online', database: 'MySQL-Active', vault: 'sanghavi_persistence' });
    } catch (e) {
        res.status(503).json({ status: 'offline', error: e.message, code: e.code });
    }
});

app.get('/api/products', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM products ORDER BY createdAt DESC');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/products', async (req, res) => {
    try {
        const p = await migrateToPhysical(req.body);
        const query = `INSERT INTO products (id, title, category, subCategory, weight, description, tags, images, thumbnails, supplier, uploadedBy, isHidden, createdAt, dateTaken, meta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        await pool.query(query, [p.id, p.title, p.category, p.subCategory, p.weight, p.description, JSON.stringify(p.tags), JSON.stringify(p.images), JSON.stringify(p.thumbnails), p.supplier, p.uploadedBy, p.isHidden, new Date(p.createdAt), p.dateTaken, JSON.stringify(p.meta)]);
        res.json(p);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/products/:id', async (req, res) => {
    try {
        const p = await migrateToPhysical(req.body);
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
        res.json(rows[0]?.data || {});
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
        else res.status(401).json({ error: 'Access Denied' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/staff', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, username, role, isActive, name, createdAt FROM staff');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/staff', async (req, res) => {
    try {
        const s = { ...req.body, id: Date.now().toString(), createdAt: new Date() };
        await pool.query('INSERT INTO staff (id, username, password, role, isActive, name, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)', [s.id, s.username, s.password, s.role, s.isActive, s.name, s.createdAt]);
        res.json(s);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/staff/:id', async (req, res) => {
    try {
        const { isActive, name, role } = req.body;
        await pool.query('UPDATE staff SET isActive=?, name=?, role=? WHERE id=?', [isActive, name, role, req.params.id]);
        res.json(req.body);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/staff/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM staff WHERE id = ?', [req.params.id]);
        res.status(204).send();
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
        const clean = await migrateToPhysical(req.body);
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

// Production Static Handler
const distPath = path.resolve(__dirname, 'dist');
if (existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) res.sendFile(path.join(distPath, 'index.html'));
    });
}

app.listen(PORT, () => console.log(`[Vault Server] SQL Engine active on port ${PORT}.`));
