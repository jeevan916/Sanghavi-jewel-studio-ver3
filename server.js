
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
    // Initialize tables if they don't exist
    await pool.query(`CREATE TABLE IF NOT EXISTS products (id VARCHAR(255) PRIMARY KEY, title VARCHAR(255), category VARCHAR(255), subCategory VARCHAR(255), weight FLOAT, description TEXT, tags JSON, images JSON, thumbnails JSON, supplier VARCHAR(255), uploadedBy VARCHAR(255), isHidden BOOLEAN, createdAt DATETIME, meta JSON)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS staff (id VARCHAR(255) PRIMARY KEY, username VARCHAR(255) UNIQUE, password VARCHAR(255), role VARCHAR(50), name VARCHAR(255), isActive BOOLEAN, createdAt DATETIME)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS analytics (id VARCHAR(255) PRIMARY KEY, type VARCHAR(50), productId VARCHAR(255), productTitle VARCHAR(255), userId VARCHAR(255), userName VARCHAR(255), timestamp DATETIME)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS customers (id VARCHAR(255) PRIMARY KEY, phone VARCHAR(50) UNIQUE, name VARCHAR(255), pincode VARCHAR(20), role VARCHAR(50), createdAt DATETIME)`);
    
    console.log('[Database] Connected and Schema Verified');
  } catch (err) {
    console.error('[Database] Initialization failed:', err.message);
    setTimeout(initDB, 5000);
  }
};
initDB();

// --- API ROUTES ---

// Health Check
app.get('/api/health', (req, res) => res.json({ status: 'online' }));

// Auth: Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        if (!pool) return res.status(503).json({ error: "Database not initialized" });
        const [rows] = await pool.query('SELECT id, username, role, name, isActive FROM staff WHERE username = ? AND password = ?', [username, password]);
        if (rows[0]) {
            if (!rows[0].isActive) return res.status(403).json({ error: 'Account disabled' });
            res.json({ user: rows[0] });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Products: CRUD
app.get('/api/products', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products ORDER BY createdAt DESC');
    res.json({ items: (rows || []).map(sanitizeProduct), meta: { totalPages: 1 } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/products', async (req, res) => {
    try {
        const p = req.body;
        await pool.query('INSERT INTO products SET ?', {
            ...p,
            tags: JSON.stringify(p.tags || []),
            images: JSON.stringify(p.images || []),
            thumbnails: JSON.stringify(p.thumbnails || []),
            meta: JSON.stringify(p.meta || {})
        });
        res.status(201).json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Analytics
app.get('/api/analytics', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM analytics ORDER BY timestamp DESC LIMIT 1000');
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/analytics', async (req, res) => {
    try {
        const event = { id: crypto.randomUUID(), ...req.body, timestamp: new Date() };
        await pool.query('INSERT INTO analytics SET ?', event);
        res.status(201).json(event);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Customers
app.get('/api/customers', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, name, phone, pincode, role, createdAt FROM customers ORDER BY createdAt DESC');
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/customers/check/:phone', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM customers WHERE phone = ?', [req.params.phone]);
        res.json({ exists: rows.length > 0, user: rows[0] || null });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/customers/login', async (req, res) => {
    const { phone, name, pincode } = req.body;
    try {
        const [rows] = await pool.query('SELECT * FROM customers WHERE phone = ?', [phone]);
        let user = rows[0];
        if (!user) {
            user = { id: crypto.randomUUID(), phone, name: name || `Client ${phone.slice(-4)}`, pincode, role: 'customer', createdAt: new Date() };
            await pool.query('INSERT INTO customers SET ?', user);
        } else if (name || pincode) {
            await pool.query('UPDATE customers SET name = COALESCE(?, name), pincode = COALESCE(?, pincode) WHERE phone = ?', [name, pincode, phone]);
            user = { ...user, name: name || user.name, pincode: pincode || user.pincode };
        }
        res.json({ user });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Staff Management
app.get('/api/staff', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, username, role, name, isActive, createdAt FROM staff');
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/staff', async (req, res) => {
    try {
        const s = { id: crypto.randomUUID(), ...req.body, createdAt: new Date() };
        await pool.query('INSERT INTO staff SET ?', s);
        res.status(201).json(s);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Intelligence (Mock or Aggregated)
app.get('/api/intelligence', async (req, res) => {
    try {
        const [pCount] = await pool.query('SELECT COUNT(*) as count FROM products');
        const [cCount] = await pool.query('SELECT COUNT(*) as count FROM customers');
        const [aCount] = await pool.query('SELECT COUNT(*) as count FROM analytics WHERE type="inquiry"');
        res.json({
            summary: {
                totalInventory: pCount[0].count,
                totalLeads: cCount[0].count,
                activeInquiries: aCount[0].count
            }
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Error handling for missing API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `Endpoint ${req.originalUrl} not found` });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('[Server Error]:', err);
    res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

// SPA Catch-all
const distPath = path.resolve(process.cwd(), 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, HOST, () => console.log(`[Sanghavi Studio] Server Active on port ${PORT}`));
