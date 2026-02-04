
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
  // Engine Folders - Added 300 for Thumbnails
  ['300', '720', '1080'].forEach(size => {
    const dir = path.join(UPLOADS_ROOT, size);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o777 });
  });
};
ensureFolders();

// Static Assets
app.use('/uploads', express.static(UPLOADS_ROOT, { 
  maxAge: '365d',
  immutable: true, 
  setHeaders: (res, path) => {
    if (path.endsWith('.webp')) res.setHeader('Content-Type', 'image/webp');
    if (path.endsWith('.avif')) res.setHeader('Content-Type', 'image/avif');
  }
}));

// Database Config
const dbConfig = {
  host: (process.env.DB_HOST || 'localhost').toLowerCase() === 'localhost' ? '127.0.0.1' : process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
};

let pool;

// --- DATABASE INITIALIZATION & MIGRATION ---
const initDB = async () => {
  try {
    pool = mysql.createPool(dbConfig);
    
    // 1. Core Data Tables
    await pool.query(`CREATE TABLE IF NOT EXISTS products (id VARCHAR(255) PRIMARY KEY, title VARCHAR(255), category VARCHAR(255), subCategory VARCHAR(255), weight FLOAT, description TEXT, tags JSON, images JSON, thumbnails JSON, supplier VARCHAR(255), uploadedBy VARCHAR(255), isHidden BOOLEAN, createdAt DATETIME, meta JSON)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS staff (id VARCHAR(255) PRIMARY KEY, username VARCHAR(255) UNIQUE, password VARCHAR(255), role VARCHAR(50), name VARCHAR(255), isActive BOOLEAN, createdAt DATETIME)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS analytics (id VARCHAR(255) PRIMARY KEY, type VARCHAR(50), productId VARCHAR(255), productTitle VARCHAR(255), userId VARCHAR(255), userName VARCHAR(255), timestamp DATETIME)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS customers (id VARCHAR(255) PRIMARY KEY, phone VARCHAR(50) UNIQUE, name VARCHAR(255), pincode VARCHAR(20), role VARCHAR(50), createdAt DATETIME)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS designs (id VARCHAR(255) PRIMARY KEY, imageUrl LONGTEXT, prompt TEXT, aspectRatio VARCHAR(20), createdAt DATETIME)`);
    
    // Links Table for Private Sharing
    await pool.query(`CREATE TABLE IF NOT EXISTS links (id VARCHAR(255) PRIMARY KEY, token VARCHAR(255) UNIQUE, targetId VARCHAR(255), type VARCHAR(50), expiresAt DATETIME, createdAt DATETIME)`);

    // 2. Normalized Configuration Tables (Professional Schema)
    await pool.query(`CREATE TABLE IF NOT EXISTS suppliers (id VARCHAR(50) PRIMARY KEY, name VARCHAR(255), isPrivate BOOLEAN)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS categories (id VARCHAR(50) PRIMARY KEY, name VARCHAR(255), isPrivate BOOLEAN)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS sub_categories (id INT AUTO_INCREMENT PRIMARY KEY, categoryId VARCHAR(50), name VARCHAR(255), FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE CASCADE)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS system_settings (setting_key VARCHAR(50) PRIMARY KEY, setting_value TEXT)`);

    // 3. ENTERPRISE SCALABILITY: High-Performance Indexes
    const indexQueries = [
      "CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)",
      "CREATE INDEX IF NOT EXISTS idx_products_isHidden ON products(isHidden)",
      "CREATE INDEX IF NOT EXISTS idx_products_createdAt ON products(createdAt)",
      "CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics(type)",
      "CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics(timestamp)"
    ];

    for (const query of indexQueries) {
      try { await pool.query(query); } catch (e) { /* Ignore if index exists */ }
    }

    // 4. Migration Logic
    const [legacyConfig] = await pool.query("SHOW TABLES LIKE 'config'");
    if (legacyConfig.length > 0) {
        const [rows] = await pool.query('SELECT data FROM config WHERE id = 1');
        if (rows.length > 0) {
             const [supCount] = await pool.query('SELECT COUNT(*) as c FROM suppliers');
             if (supCount[0].c === 0) {
                 console.log('[Database] ⚠️ Detected Legacy JSON Config. Migrating...');
             }
        }
    }

    // 5. Seed Defaults
    const defaults = {
        linkExpiryHours: '24',
        ai_model_analysis: 'gemini-3-flash-preview',
        ai_model_enhancement: 'gemini-2.5-flash-image',
        ai_model_watermark: 'gemini-2.5-flash-image',
        ai_model_design: 'gemini-2.5-flash-image',
        ai_prompt_analysis: 'Analyze this luxury jewelry piece...',
        ai_prompt_enhancement: "Jewelry Studio Retouching...",
        ai_prompt_watermark: "Seamlessly remove any watermarks...",
        ai_prompt_design: "Hyper-realistic macro studio photography...",
    };

    for (const [key, val] of Object.entries(defaults)) {
        await pool.query('INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES (?, ?)', [key, val]);
    }

    console.log('[Database] Schema Verified and Ready');
  } catch (err) {
    console.error('[Database] Critical Init Error:', err.message);
    setTimeout(initDB, 5000);
  }
};
initDB();

// --- IMAGE PROCESSING ---
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.match(/^image\/(jpeg|png|webp|heic|avif)$/)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file format'), false);
    }
  }
});

const slugify = (text) => text.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-').replace(/^-+/, '').replace(/-+$/, '');

app.post('/api/media/upload', upload.array('files', 10), async (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });
  const results = [];
  try {
    for (const file of req.files) {
      const originalName = file.originalname.split('.').slice(0, -1).join('.');
      const safeName = slugify(originalName) || 'asset';
      const hash = crypto.randomBytes(4).toString('hex');
      
      const processVariant = async (width, format, quality) => {
        const filename = `${safeName}-${width}w-${hash}.${format}`;
        const filepath = path.join(UPLOADS_ROOT, width.toString(), filename);
        await sharp(file.buffer).rotate().resize(width, null, { withoutEnlargement: true }).sharpen({ sigma: 0.8, m1: 0.5, m2: 0.5 }).toFormat(format, { quality }).toFile(filepath);
        return `/uploads/${width}/${filename}`;
      };

      // Generate High-Res (1080p) and Low-Res Thumbnail (300p) in parallel
      const [desktopWebP, mobileThumb] = await Promise.all([
          processVariant(1080, 'webp', 85),
          processVariant(300, 'webp', 80)
      ]);
      
      results.push({ 
          originalName: file.originalname, 
          primary: desktopWebP,
          thumbnail: mobileThumb 
      });
    }
    res.json({ success: true, files: results });
  } catch (error) {
    res.status(500).json({ error: 'Image processing failed', details: error.message });
  }
});

// --- API ROUTES ---

app.get('/api/health', (req, res) => res.json({ status: 'online' }));

app.get('/api/diagnostics', async (req, res) => {
    try {
        const [tables] = await pool.query('SHOW TABLES');
        const [p] = await pool.query('SELECT COUNT(*) as c FROM products');
        const [s] = await pool.query('SELECT COUNT(*) as c FROM suppliers');
        const [c] = await pool.query('SELECT COUNT(*) as c FROM categories');
        res.json({
            status: 'online',
            db_connected: true,
            counts: { products: p[0].c, suppliers: s[0].c, categories: c[0].c },
            tables: tables
        });
    } catch (e) {
        res.status(500).json({ status: 'error', db_connected: false, error: e.message });
    }
});

// --- LINKS API ---
app.post('/api/links', async (req, res) => {
    try {
        const { targetId, type } = req.body;
        const token = crypto.randomBytes(16).toString('hex');
        const [settings] = await pool.query('SELECT setting_value FROM system_settings WHERE setting_key = "linkExpiryHours"');
        const hours = parseInt(settings[0]?.setting_value || '24');
        const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
        
        await pool.query('INSERT INTO links (id, token, targetId, type, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?, ?)', 
            [crypto.randomUUID(), token, targetId, type, expiresAt, new Date()]);
            
        res.json({ token, expiresAt });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/links/:token', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM links WHERE token = ?', [req.params.token]);
        if (!rows.length) return res.status(404).json({ error: 'Link not found' });
        
        const link = rows[0];
        if (new Date() > new Date(link.expiresAt)) {
            return res.status(410).json({ error: 'Link expired' });
        }
        
        res.json(link);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- CONFIG API ---
app.get('/api/config', async (req, res) => {
    try {
        const [suppliers] = await pool.query('SELECT * FROM suppliers');
        const [categories] = await pool.query('SELECT * FROM categories');
        const [subCats] = await pool.query('SELECT * FROM sub_categories');
        const [settingsRows] = await pool.query('SELECT * FROM system_settings');

        const catMap = categories.map(c => ({
            id: c.id,
            name: c.name,
            isPrivate: !!c.isPrivate,
            subCategories: subCats.filter(s => s.categoryId === c.id).map(s => s.name)
        }));

        const config = {
            suppliers: suppliers.map(s => ({ ...s, isPrivate: !!s.isPrivate })),
            categories: catMap,
            linkExpiryHours: 24,
            whatsappNumber: '',
            whatsappPhoneId: '',
            whatsappToken: '',
        };

        settingsRows.forEach(row => {
            if (row.setting_key === 'linkExpiryHours') config.linkExpiryHours = Number(row.setting_value);
            else config[row.setting_key] = row.setting_value;
        });

        res.json(config);
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    }
});

app.post('/api/config', async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const { suppliers, categories, linkExpiryHours, whatsappNumber, whatsappPhoneId, whatsappToken, aiConfig } = req.body;

        const settings = { 
            linkExpiryHours, 
            whatsappNumber, 
            whatsappPhoneId, 
            whatsappToken,
            ai_model_analysis: aiConfig?.models?.analysis,
            ai_model_enhancement: aiConfig?.models?.enhancement,
            ai_model_watermark: aiConfig?.models?.watermark,
            ai_model_design: aiConfig?.models?.design,
            ai_prompt_analysis: aiConfig?.prompts?.analysis,
            ai_prompt_enhancement: aiConfig?.prompts?.enhancement,
            ai_prompt_watermark: aiConfig?.prompts?.watermark,
            ai_prompt_design: aiConfig?.prompts?.design,
            ai_templates_analysis: JSON.stringify(aiConfig?.templates?.analysis || []),
            ai_templates_enhancement: JSON.stringify(aiConfig?.templates?.enhancement || []),
            ai_templates_watermark: JSON.stringify(aiConfig?.templates?.watermark || []),
            ai_templates_design: JSON.stringify(aiConfig?.templates?.design || [])
        };

        for (const [k, v] of Object.entries(settings)) {
             if (v !== undefined) {
                 await conn.query('INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?', [k, String(v || ''), String(v || '')]);
             }
        }

        await conn.query('DELETE FROM suppliers'); 
        if (suppliers?.length) {
            const supplierValues = suppliers.map(s => [s.id, s.name, !!s.isPrivate]);
            await conn.query('INSERT INTO suppliers (id, name, isPrivate) VALUES ?', [supplierValues]);
        }

        await conn.query('DELETE FROM sub_categories'); 
        await conn.query('DELETE FROM categories');
        
        if (categories?.length) {
            for (const c of categories) {
                await conn.query('INSERT INTO categories (id, name, isPrivate) VALUES (?, ?, ?)', [c.id, c.name, !!c.isPrivate]);
                if (c.subCategories?.length) {
                    const subValues = c.subCategories.map(name => [c.id, name]);
                    await conn.query('INSERT INTO sub_categories (categoryId, name) VALUES ?', [subValues]);
                }
            }
        }

        await conn.commit();
        res.json({ success: true });
    } catch (e) { 
        await conn.rollback();
        res.status(500).json({ error: e.message }); 
    } finally {
        conn.release();
    }
});

// --- CORE PRODUCT APIs ---
const safeParse = (str, fallback = []) => {
  if (Array.isArray(str)) return str;
  try { return JSON.parse(str) || fallback; } catch (e) { return fallback; }
};
const sanitizeProduct = (p) => p ? ({ ...p, tags: safeParse(p.tags), images: safeParse(p.images), thumbnails: safeParse(p.thumbnails), meta: safeParse(p.meta, {}) }) : null;

app.get('/api/products', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 1000;
    const offset = (page - 1) * limit;
    const isPublic = req.query.public === 'true';
    const category = req.query.category;
    const subCategory = req.query.subCategory;
    const search = req.query.search;

    let query = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (isPublic) {
        query += ' AND isHidden = 0';
    }
    
    if (category && category !== 'All') {
        query += ' AND category = ?';
        params.push(category);
    }

    if (subCategory) {
        query += ' AND subCategory = ?';
        params.push(subCategory);
    }

    if (search) {
        query += ' AND (title LIKE ? OR tags LIKE ?)';
        const likeSearch = `%${search}%`;
        params.push(likeSearch, likeSearch);
    }

    // Clone query for count BEFORE adding limit/offset
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    
    query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const [rows] = await pool.query(query, params);
    
    // Count parameter handling: params for count query don't include limit/offset
    const countParams = params.slice(0, params.length - 2); 
    const [count] = await pool.query(countQuery, countParams);
    
    res.json({ 
        items: rows.map(sanitizeProduct), 
        meta: { page, limit, totalPages: Math.ceil(count[0].total / limit), totalItems: count[0].total } 
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/products/curated', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM products WHERE isHidden = 0 ORDER BY createdAt DESC LIMIT 60');
        const items = rows.map(sanitizeProduct);
        res.json({
            latest: items.slice(0, 8),
            loved: items.filter((_, i) => i % 3 === 0).slice(0, 8), 
            trending: items.filter((_, i) => i % 2 === 0).slice(0, 8),
            ideal: items.slice(0, 4)
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/products/:id', async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    rows[0] ? res.json(sanitizeProduct(rows[0])) : res.status(404).json({ error: 'Not found' });
});

app.get('/api/products/:id/stats', async (req, res) => {
    const [rows] = await pool.query('SELECT type, COUNT(*) as c FROM analytics WHERE productId = ? GROUP BY type', [req.params.id]);
    const stats = { like: 0, dislike: 0, inquiry: 0, purchase: 0 };
    rows.forEach(r => { if(stats.hasOwnProperty(r.type)) stats[r.type] = r.c; });
    res.json(stats);
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
            title: p.title, category: p.category, subCategory: p.subCategory, weight: p.weight, description: p.description,
            tags: JSON.stringify(p.tags || []), images: JSON.stringify(p.images || []), thumbnails: JSON.stringify(p.thumbnails || []), isHidden: p.isHidden
        }, req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Other Entities
app.get('/api/customers', async (req, res) => {
    const [rows] = await pool.query('SELECT id, name, phone, pincode, role, createdAt FROM customers ORDER BY createdAt DESC');
    res.json(rows);
});

app.get('/api/customers/check/:phone', async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM customers WHERE phone = ?', [req.params.phone]);
    res.json({ exists: rows.length > 0, user: rows[0] || null });
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
            user.name = name || user.name;
        }
        res.json({ user });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/login', async (req, res) => {
    const [rows] = await pool.query('SELECT id, username, role, name, isActive FROM staff WHERE username = ? AND password = ?', [req.body.username, req.body.password]);
    if (rows[0] && rows[0].isActive) res.json({ user: rows[0] });
    else res.status(401).json({ error: 'Invalid or Disabled' });
});

app.get('/api/staff', async (req, res) => {
    const [rows] = await pool.query('SELECT id, username, role, name, isActive, createdAt FROM staff');
    res.json(rows);
});

app.post('/api/staff', async (req, res) => {
    const s = { id: crypto.randomUUID(), ...req.body, createdAt: new Date() };
    await pool.query('INSERT INTO staff SET ?', s);
    res.status(201).json(s);
});

app.put('/api/staff/:id', async (req, res) => {
    await pool.query('UPDATE staff SET ? WHERE id = ?', [req.body, req.params.id]);
    res.json({ success: true });
});

app.post('/api/analytics', async (req, res) => {
    const event = { id: crypto.randomUUID(), ...req.body, timestamp: new Date() };
    await pool.query('INSERT INTO analytics SET ?', event);
    res.status(201).json(event);
});

app.get('/api/analytics', async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM analytics ORDER BY timestamp DESC LIMIT 500');
    res.json(rows);
});

app.get('/api/intelligence', async (req, res) => {
    const [p] = await pool.query('SELECT COUNT(*) as c FROM products');
    const [cust] = await pool.query('SELECT COUNT(*) as c FROM customers');
    const [inq] = await pool.query('SELECT COUNT(*) as c FROM analytics WHERE type="inquiry"');
    res.json({ summary: { totalInventory: p[0].c, totalLeads: cust[0].c, activeInquiries: inq[0].c } });
});

app.post('/api/backups', async (req, res) => {
    const name = `snapshot_${Date.now()}.json`;
    const [products] = await pool.query('SELECT * FROM products');
    writeFileSync(path.join(BACKUPS_ROOT, name), JSON.stringify(products));
    res.json({ success: true, filename: name, size: JSON.stringify(products).length });
});

app.get('/api/backups', (req, res) => {
    if (!existsSync(BACKUPS_ROOT)) return res.json([]);
    res.json(readdirSync(BACKUPS_ROOT).filter(f => f.endsWith('.json')).map(f => ({ name: f, date: statSync(path.join(BACKUPS_ROOT, f)).mtime, size: statSync(path.join(BACKUPS_ROOT, f)).size })));
});

app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Internal Server Error' }); });

const distPath = path.resolve(process.cwd(), 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

app.listen(PORT, HOST, () => console.log(`[Sanghavi Studio] Server Online on Port ${PORT}`));
