
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'fs';
import cors from 'cors';
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import multer from 'multer';
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
const BACKUPS_ROOT = path.resolve(DATA_ROOT, 'backups');

const ensureFolders = () => {
  [DATA_ROOT, UPLOADS_ROOT, BACKUPS_ROOT].forEach(dir => {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o777 });
  });
  // Engine Folders
  ['720', '1080'].forEach(size => {
    const dir = path.join(UPLOADS_ROOT, size);
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
      return (typeof parsed === 'object') ? parsed : fallback;
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
    
    // Initialize Core Tables
    await pool.query(`CREATE TABLE IF NOT EXISTS products (id VARCHAR(255) PRIMARY KEY, title VARCHAR(255), category VARCHAR(255), subCategory VARCHAR(255), weight FLOAT, description TEXT, tags JSON, images JSON, thumbnails JSON, supplier VARCHAR(255), uploadedBy VARCHAR(255), isHidden BOOLEAN, createdAt DATETIME, meta JSON)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS staff (id VARCHAR(255) PRIMARY KEY, username VARCHAR(255) UNIQUE, password VARCHAR(255), role VARCHAR(50), name VARCHAR(255), isActive BOOLEAN, createdAt DATETIME)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS analytics (id VARCHAR(255) PRIMARY KEY, type VARCHAR(50), productId VARCHAR(255), productTitle VARCHAR(255), userId VARCHAR(255), userName VARCHAR(255), timestamp DATETIME)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS customers (id VARCHAR(255) PRIMARY KEY, phone VARCHAR(50) UNIQUE, name VARCHAR(255), pincode VARCHAR(20), role VARCHAR(50), createdAt DATETIME)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS config (id INT PRIMARY KEY, data JSON)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS designs (id VARCHAR(255) PRIMARY KEY, imageUrl LONGTEXT, prompt TEXT, aspectRatio VARCHAR(20), createdAt DATETIME)`);

    const [configRows] = await pool.query('SELECT * FROM config WHERE id = 1');
    if (configRows.length === 0) {
        const defaultConfig = { suppliers: [], categories: [], linkExpiryHours: 24 };
        await pool.query('INSERT INTO config (id, data) VALUES (1, ?)', [JSON.stringify(defaultConfig)]);
    }

    console.log('[Database] Schema Verified and Ready');
  } catch (err) {
    console.error('[Database] Critical Init Error:', err.message);
    setTimeout(initDB, 5000);
  }
};
initDB();

// --- PHOTO UPLOADING ENGINE ---
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB Limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.match(/^image\/(jpeg|png|webp|heic|avif)$/)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file format'), false);
    }
  }
});

app.post('/api/media/upload', upload.array('files', 10), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const results = [];

  try {
    for (const file of req.files) {
      const hash = crypto.randomBytes(8).toString('hex');
      const slug = `img_${Date.now()}`;
      
      const processVariant = async (width, format, quality) => {
        const filename = `${slug}_${width}_${hash}.${format}`;
        const filepath = path.join(UPLOADS_ROOT, width.toString(), filename);
        
        await sharp(file.buffer)
          .rotate() // Auto-orient based on EXIF
          .resize(width, null, { withoutEnlargement: true }) // Preserve Aspect Ratio
          .sharpen({ sigma: 0.8, m1: 0.5, m2: 0.5 }) // Edge-aware sharpening for jewelry facets
          .toFormat(format, { quality, effort: 4 }) // Tune compression
          .withMetadata(false) // Strip EXIF/Metadata
          .toFile(filepath);
          
        return `/uploads/${width}/${filename}`;
      };

      // Concurrent processing for speed
      const [mobileWebP, desktopWebP, mobileAvif, desktopAvif] = await Promise.all([
        processVariant(720, 'webp', 80),
        processVariant(1080, 'webp', 85),
        processVariant(720, 'avif', 65),
        processVariant(1080, 'avif', 75)
      ]);

      results.push({
        originalName: file.originalname,
        primary: desktopWebP, // Default for UI
        variants: {
          mobile: mobileWebP,
          desktop: desktopWebP,
          mobile_avif: mobileAvif,
          desktop_avif: desktopAvif
        }
      });
    }

    res.json({ success: true, files: results });
  } catch (error) {
    console.error('[Upload Engine] Processing Failed:', error);
    res.status(500).json({ error: 'Image processing failed', details: error.message });
  }
});

// --- API ROUTES ---

app.get('/api/health', (req, res) => res.json({ status: 'online' }));

// Config
app.get('/api/config', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT data FROM config WHERE id = 1');
        res.json(rows[0]?.data || { suppliers: [], categories: [], linkExpiryHours: 24 });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/config', async (req, res) => {
    try {
        await pool.query('UPDATE config SET data = ? WHERE id = 1', [JSON.stringify(req.body)]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Auth
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await pool.query('SELECT id, username, role, name, isActive FROM staff WHERE username = ? AND password = ?', [username, password]);
        if (rows[0]) {
            if (!rows[0].isActive) return res.status(403).json({ error: 'Account disabled' });
            res.json({ user: rows[0] });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Products
app.get('/api/products', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products ORDER BY createdAt DESC');
    res.json({ items: (rows || []).map(sanitizeProduct), meta: { totalPages: 1 } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/products/curated', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM products WHERE isHidden = 0 ORDER BY createdAt DESC LIMIT 20');
        const items = (rows || []).map(sanitizeProduct);
        res.json({
            latest: items.slice(0, 8),
            loved: items.filter((_, i) => i % 3 === 0),
            trending: items.filter((_, i) => i % 2 === 0),
            ideal: items.slice(0, 4)
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/products/:id', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
        if (!rows[0]) return res.status(404).json({ error: 'Product not found' });
        res.json(sanitizeProduct(rows[0]));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/products/:id/stats', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT type, COUNT(*) as count FROM analytics WHERE productId = ? GROUP BY type', [req.params.id]);
        const stats = { like: 0, dislike: 0, inquiry: 0, purchase: 0 };
        rows.forEach(r => {
            if (stats.hasOwnProperty(r.type)) stats[r.type] = r.count;
        });
        res.json(stats);
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

app.put('/api/products/:id', async (req, res) => {
    try {
        const p = req.body;
        await pool.query('UPDATE products SET ? WHERE id = ?', [{
            title: p.title,
            category: p.category,
            subCategory: p.subCategory,
            weight: p.weight,
            description: p.description,
            tags: JSON.stringify(p.tags || []),
            images: JSON.stringify(p.images || []),
            thumbnails: JSON.stringify(p.thumbnails || []),
            isHidden: p.isHidden
        }, req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Designs
app.get('/api/designs', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM designs ORDER BY createdAt DESC');
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/designs', async (req, res) => {
    try {
        const design = { ...req.body, createdAt: new Date() };
        await pool.query('INSERT INTO designs SET ?', design);
        res.status(201).json(design);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Analytics
app.get('/api/analytics', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM analytics ORDER BY timestamp DESC LIMIT 500');
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

// Staff
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

app.put('/api/staff/:id', async (req, res) => {
    try {
        await pool.query('UPDATE staff SET ? WHERE id = ?', [req.body, req.params.id]);
        const [rows] = await pool.query('SELECT id, username, role, name, isActive, createdAt FROM staff WHERE id = ?', [req.params.id]);
        res.json(rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Backups
app.get('/api/backups', async (req, res) => {
    try {
        if (!existsSync(BACKUPS_ROOT)) return res.json([]);
        const files = readdirSync(BACKUPS_ROOT)
            .filter(f => f.endsWith('.zip') || f.endsWith('.json'))
            .map(f => {
                const s = statSync(path.join(BACKUPS_ROOT, f));
                return { name: f, date: s.mtime, size: s.size };
            });
        res.json(files);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/backups', async (req, res) => {
    try {
        const name = `snapshot_${Date.now()}.json`;
        const [products] = await pool.query('SELECT * FROM products');
        writeFileSync(path.join(BACKUPS_ROOT, name), JSON.stringify(products));
        res.json({ success: true, filename: name, size: JSON.stringify(products).length });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Intelligence
app.get('/api/intelligence', async (req, res) => {
    try {
        const [p] = await pool.query('SELECT COUNT(*) as count FROM products');
        const [c] = await pool.query('SELECT COUNT(*) as count FROM customers');
        const [a] = await pool.query('SELECT COUNT(*) as count FROM analytics WHERE type="inquiry"');
        res.json({ 
            summary: { 
                totalInventory: p[0].count, 
                totalLeads: c[0].count,
                activeInquiries: a[0].count
            } 
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 404 & Global Handler
app.use('/api/*', (req, res) => res.status(404).json({ error: `Endpoint ${req.originalUrl} Not Found` }));
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
});

// SPA
const distPath = path.resolve(process.cwd(), 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

app.listen(PORT, HOST, () => console.log(`[Sanghavi Studio] Port ${PORT}`));
