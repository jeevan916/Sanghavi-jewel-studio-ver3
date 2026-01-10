
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { existsSync, mkdirSync } from 'fs';
import cors from 'cors';
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(process.cwd(), '.builds/config/.env') });

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.use(cors());
app.use(express.json({ limit: '100mb' }));

const DATA_ROOT = path.resolve(process.cwd(), '.builds', 'sanghavi_persistence');
const UPLOADS_ROOT = path.resolve(DATA_ROOT, 'uploads');
const UPLOADS_720 = path.resolve(UPLOADS_ROOT, '720');
const UPLOADS_1080 = path.resolve(UPLOADS_ROOT, '1080');

const ensureFolders = () => {
  [DATA_ROOT, UPLOADS_ROOT, UPLOADS_720, UPLOADS_1080].forEach(dir => {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o777 });
  });
};
ensureFolders();

// Static Assets
app.use('/uploads', express.static(UPLOADS_ROOT, { maxAge: '31d', immutable: true }));

// Sanitization Utility
const sanitizeProduct = (p) => {
  if (!p) return null;
  const safeParse = (str, fallback = []) => {
    if (Array.isArray(str)) return str;
    try {
      if (!str) return fallback;
      const parsed = JSON.parse(str);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch (e) { return fallback; }
  };

  return {
    ...p,
    tags: safeParse(p.tags, []),
    images: safeParse(p.images, []),
    thumbnails: safeParse(p.thumbnails, []),
    meta: typeof p.meta === 'string' ? safeParse(p.meta, {}) : (p.meta || {})
  };
};

// Database Initialization
const dbConfig = {
  host: (process.env.DB_HOST || 'localhost').toLowerCase() === 'localhost' ? '127.0.0.1' : process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
};

let pool;
const initDB = async () => {
  try {
    pool = mysql.createPool(dbConfig);
    await pool.query('SELECT 1');
    console.log('[Database] Connected');
  } catch (err) {
    console.error('[Database] Connection failed:', err.message);
    setTimeout(initDB, 5000);
  }
};
initDB();

// API Endpoints
app.get('/api/products', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products ORDER BY createdAt DESC');
    res.json({ items: (rows || []).map(sanitizeProduct), meta: { totalPages: 1 } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/health', (req, res) => res.json({ status: 'online' }));

// SPA Catch-all: Must be AFTER all API routes
const distPath = path.resolve(process.cwd(), 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, HOST, () => console.log(`[Sanghavi Studio] Server Active on port ${PORT}`));
