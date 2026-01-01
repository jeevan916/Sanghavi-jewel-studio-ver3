
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Synchronized with Vite's env loading path
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

// Persistence Root
const DATA_ROOT = path.resolve(process.cwd(), '..', 'sanghavi_persistence');
const UPLOADS_ROOT = path.resolve(DATA_ROOT, 'uploads');
const THUMBS_ROOT = path.resolve(UPLOADS_ROOT, 'thumbnails');

const ensureFolders = async () => {
    try {
        if (!existsSync(DATA_ROOT)) mkdirSync(DATA_ROOT, { recursive: true });
        if (!existsSync(UPLOADS_ROOT)) mkdirSync(UPLOADS_ROOT, { recursive: true });
        if (!existsSync(THUMBS_ROOT)) mkdirSync(THUMBS_ROOT, { recursive: true });
    } catch (err) {}
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
let dbStatus = { healthy: false };

const initDB = async () => {
    try {
        pool = mysql.createPool(dbConfig);
        await pool.query('SELECT 1');
        dbStatus = { healthy: true };
    } catch (err) {
        dbStatus = { healthy: false, error: err.message };
    }
};
initDB();

app.get('/api/health', (req, res) => res.json({ status: dbStatus.healthy ? 'online' : 'error', ...dbStatus }));

app.get('/api/products', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM products ORDER BY createdAt DESC');
        res.json(rows.map(r => {
            try { r.tags = JSON.parse(r.tags); } catch(e) { r.tags = []; }
            try { r.images = JSON.parse(r.images); } catch(e) { r.images = []; }
            try { r.thumbnails = JSON.parse(r.thumbnails); } catch(e) { r.thumbnails = []; }
            try { r.meta = JSON.parse(r.meta); } catch(e) { r.meta = {}; }
            return r;
        }));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// MPA Static Routing for Production
const dist = path.resolve(process.cwd(), 'dist');
if (existsSync(dist)) {
    app.use(express.static(dist, { index: false }));

    const serve = (file) => (req, res) => res.sendFile(path.join(dist, file));

    app.get('/', serve('index.html'));
    
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return res.status(404).end();
        res.sendFile(path.join(dist, 'index.html'));
    });
}

app.listen(PORT, HOST, () => console.log(`[Sanghavi Studio] Server ready at http://${HOST}:${PORT}`));
