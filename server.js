import analyticsRoutes from './server/routes/analytics.js';
import mediaRoutes from './server/routes/media.js';
import customersRoutes from './server/routes/customers.js';
import productsRoutes from './server/routes/products.js';
import wishlistRoutes from './server/routes/wishlist.js';
import aiRoutes from './server/routes/ai.js';

import dotenv from 'dotenv';
console.log('🚀 [Sanghavi Studio] Server process starting...');
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, appendFileSync, writeFileSync, readFileSync } from 'fs';
import cors from 'cors';
import compression from 'compression';
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import multer from 'multer';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Global Error Handlers to prevent silent crashes
process.on('uncaughtException', (err) => {
  console.error('🔥 [Sanghavi Studio] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 [Sanghavi Studio] Unhandled Rejection at:', promise, 'reason:', reason);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Robust Path Resolution for Config
// Always try to load .env, but do NOT override existing process.env variables (Hostinger injection takes precedence)
const envPath1 = path.resolve(__dirname, 'public_html', '.builds', 'config', '.env');
const envPath2 = path.resolve(__dirname, '.builds', 'config', '.env');
const envPath3 = path.resolve(__dirname, '..', '.builds', 'config', '.env');
const envPath4 = path.resolve(__dirname, '..', 'public_html', '.builds', 'config', '.env');
const rootPath = path.resolve(__dirname, '.env');

console.log('[Config] Checking for .env files...');

let loadedEnvPath = 'none';

if (existsSync(envPath4)) {
  console.log(`[Config] Loading .env from Hostinger Sibling: ${envPath4}`);
  dotenv.config({ path: envPath4, override: true });
  loadedEnvPath = envPath4;
} else if (existsSync(envPath1)) {
  console.log(`[Config] Loading .env from: ${envPath1}`);
  dotenv.config({ path: envPath1, override: true });
  loadedEnvPath = envPath1;
} else if (existsSync(envPath2)) {
  console.log(`[Config] Loading .env from: ${envPath2}`);
  dotenv.config({ path: envPath2, override: true });
  loadedEnvPath = envPath2;
} else if (existsSync(envPath3)) {
  console.log(`[Config] Loading .env from: ${envPath3}`);
  dotenv.config({ path: envPath3, override: true });
  loadedEnvPath = envPath3;
} else if (existsSync(rootPath)) {
  console.log(`[Config] Loading .env from root: ${rootPath}`);
  dotenv.config({ path: rootPath, override: true });
  loadedEnvPath = rootPath;
} else {
  console.log('[Config] No .env file found. Relying on system environment variables.');
}

// Debug DB Config (Masked)
console.log('[Debug] DB Config:', {
    host: process.env.DB_HOST || '(not set)',
    user: process.env.DB_USER || '(not set)',
    db: process.env.DB_NAME || '(not set)',
    hasPassword: !!process.env.DB_PASSWORD
});

const app = express();

// Hostinger Startup Verification
const startupLog = path.resolve(__dirname, 'public_html', 'server_status.txt');
try {
  const logMsg = `[${new Date().toISOString()}] Server attempting start on PORT: ${process.env.PORT || 3000}\n`;
  appendFileSync(startupLog, logMsg);
} catch (e) {
  console.error('Failed to write startup log', e);
}

app.use(cors());
app.use(compression());
app.use(express.json({ limit: '100mb' }));

// Simple In-Memory Cache
const CACHE = {
    config: { data: null, lastFetch: 0 },
    curated: { data: null, lastFetch: 0 }
};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Debug Middleware
app.use((req, res, next) => {
    console.log(`[Request] ${req.method} ${req.url}`);
    next();
});

async function fetchGoldRates() {
    try {
        const API_URL = 'https://order.auragoldelite.com/api/gold-rate';
        const response = await fetch(API_URL, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        if (response.ok) {
            const rateData = await response.json();
            if (rateData.success) {
                if (rateData.k22) await pool.query('UPDATE system_settings SET setting_value = ? WHERE setting_key = "goldRate22k"', [rateData.k22.toString()]);
                if (rateData.k24) await pool.query('UPDATE system_settings SET setting_value = ? WHERE setting_key = "goldRate24k"', [rateData.k24.toString()]);
                console.log(`[GoldRate] Updated: 22k=${rateData.k22}, 24k=${rateData.k24}`);
            }
        }
    } catch (error) {
        console.error("[GoldRate] Background fetch failed:", error.message);
    }
}

// --- MIDDLEWARE ---
app.use((req, res, next) => {
    if (req.path.startsWith('/api/') && (!pool || dbInitError) && req.path !== '/api/health' && req.path !== '/api/retry-db') {
        return res.status(503).json({ 
            error: 'Database not initialized', 
            details: dbInitError || 'Initializing...' 
        });
    }
    next();
});
// Robust Data Root Resolution for Hostinger
const localDataPath = path.resolve(__dirname, 'data');
const persistencePath = path.resolve(__dirname, '..', 'sanghavi_persistence');
const filesPersistencePath = path.resolve('/', 'files', 'sanghavi_persistence'); // Hardcoded attempt to hit Hostinger /files path

let DATA_ROOT = localDataPath;
if (existsSync(persistencePath)) {
    DATA_ROOT = persistencePath;
    console.log(`📂 [Sanghavi Studio] Using persistent data directory: ${DATA_ROOT}`);
} else if (existsSync(filesPersistencePath)) {
    DATA_ROOT = filesPersistencePath;
    console.log(`📂 [Sanghavi Studio] Using Hostinger files persistent directory: ${DATA_ROOT}`);
} else {
    console.log(`📂 [Sanghavi Studio] Using local data directory: ${DATA_ROOT}`);
}

let UPLOADS_ROOT = path.resolve(DATA_ROOT, 'uploads');
const publicHtmlUploads = path.resolve(__dirname, '..', 'public_html', 'uploads');
const rootUploads = path.resolve('/', 'uploads');

if (!existsSync(UPLOADS_ROOT) && existsSync(publicHtmlUploads)) {
    UPLOADS_ROOT = publicHtmlUploads;
    console.log(`📂 [Sanghavi Studio] Found existing uploads in public_html: ${UPLOADS_ROOT}`);
} else if (!existsSync(UPLOADS_ROOT) && existsSync(rootUploads)) {
    UPLOADS_ROOT = rootUploads;
    console.log(`📂 [Sanghavi Studio] Found existing uploads in root: ${UPLOADS_ROOT}`);
}

const BACKUPS_ROOT = path.resolve(DATA_ROOT, 'backups');

const ensureFolders = () => {
  try {
    [DATA_ROOT, UPLOADS_ROOT, BACKUPS_ROOT].forEach(dir => {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o777 });
    });
    // Engine Folders - Added 300 for Thumbnails
    ['300', '720', '1080'].forEach(size => {
      const dir = path.join(UPLOADS_ROOT, size);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o777 });
    });
  } catch (err) {
    console.error('❌ [Sanghavi Studio] Failed to create necessary directories. Check permissions:', err.message);
  }
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

// Helper to strip quotes if user accidentally added them in Hostinger UI or .env
const cleanEnv = (val) => val ? val.toString().replace(/^['"]|['"]$/g, '').trim() : '';

// Database Config
const dbConfig = {
  host: cleanEnv(process.env.DB_HOST) || 'localhost',
  user: cleanEnv(process.env.DB_USER) || 'root',
  password: cleanEnv(process.env.DB_PASSWORD) || '',
  database: cleanEnv(process.env.DB_NAME) || 'sanghavi_studio',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};

console.log('[Debug] Sanitized DB Config:', {
    host: dbConfig.host,
    user: dbConfig.user,
    db: dbConfig.database,
    hasPassword: !!dbConfig.password
});

let pool;
const poolProxy = {
    query: (...args) => {
        if (!pool) throw new Error("Database not initialized yet");
        return pool.query(...args);
    },
    getConnection: (...args) => {
        if (!pool) throw new Error("Database not initialized yet");
        return pool.getConnection(...args);
    }
};
let dbInitError = null;
let DEMO_MODE = false;

// --- DATABASE INITIALIZATION & MIGRATION ---
const initDB = async () => {
  try {
    console.log('[Database] Initializing connection pool...');
    dbInitError = null;
    
    // 1. Create Pool Directly (Assume DB exists on Hostinger)
    pool = mysql.createPool(dbConfig);
    
    // 2. Verify Connection
    const connection = await pool.getConnection();
    console.log('[Database] MySQL Connected Successfully');
    connection.release();
    dbInitError = null; 
    DEMO_MODE = false;
    
    // 3. Core Data Tables
    await pool.query(`CREATE TABLE IF NOT EXISTS products (id VARCHAR(255) PRIMARY KEY, title VARCHAR(255), category VARCHAR(255), subCategory VARCHAR(255), weight FLOAT, description TEXT, tags JSON, images JSON, thumbnails JSON, supplier VARCHAR(255), uploadedBy VARCHAR(255), isHidden BOOLEAN, createdAt DATETIME, dateTaken DATE, meta JSON)`);
    try { await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS dateTaken DATE AFTER createdAt`); } catch (e) { /* ignore if already exists */ }
    await pool.query(`CREATE TABLE IF NOT EXISTS staff (id VARCHAR(255) PRIMARY KEY, username VARCHAR(255) UNIQUE, password VARCHAR(255), role VARCHAR(50), name VARCHAR(255), isActive BOOLEAN, createdAt DATETIME)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS analytics (id VARCHAR(255) PRIMARY KEY, type VARCHAR(50), productId VARCHAR(255), productTitle VARCHAR(255), userId VARCHAR(255), userName VARCHAR(255), timestamp DATETIME)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS customers (id VARCHAR(255) PRIMARY KEY, phone VARCHAR(50) UNIQUE, name VARCHAR(255), pincode VARCHAR(20), role VARCHAR(50), createdAt DATETIME)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS designs (id VARCHAR(255) PRIMARY KEY, imageUrl LONGTEXT, prompt TEXT, aspectRatio VARCHAR(20), createdAt DATETIME)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS wishlist (id INT AUTO_INCREMENT PRIMARY KEY, customerId VARCHAR(255), productId VARCHAR(255), priceWhenWishlisted FLOAT, createdAt DATETIME, lastNotifiedAt DATETIME, FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE, FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE CASCADE, UNIQUE KEY unique_wish(customerId, productId))`);
    
    // Links Table for Private Sharing
    await pool.query(`CREATE TABLE IF NOT EXISTS links (id VARCHAR(255) PRIMARY KEY, token VARCHAR(255) UNIQUE, targetId VARCHAR(255), type VARCHAR(50), expiresAt DATETIME, createdAt DATETIME)`);

    // Schema Updates for Analytics (Dwell Time & Screenshots)
    const addColumnIfMissing = async (table, col, def) => {
        try {
            await pool.query(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
            console.log(`Added column ${col} to ${table}`);
        } catch(e) {
            // Ignore if column exists
        }
    };
    
    await addColumnIfMissing('wishlist', 'lastNotifiedAt', 'DATETIME');
    await addColumnIfMissing('analytics', 'userPhone', 'VARCHAR(50)');
    await addColumnIfMissing('analytics', 'duration', 'INT');
    await addColumnIfMissing('analytics', 'meta', 'JSON');

    // Future Optimizations: Indexes to speed up queries
    try { await pool.query('CREATE INDEX idx_wishlist_price ON wishlist(priceWhenWishlisted)'); } catch(e) {}
    try { await pool.query('CREATE INDEX idx_analytics_timestamp ON analytics(timestamp)'); } catch(e) {}
    try { await pool.query('CREATE INDEX idx_customers_createdAt ON customers(createdAt)'); } catch(e) {}

    // 2. Normalized Configuration Tables (Professional Schema)
    await pool.query(`CREATE TABLE IF NOT EXISTS suppliers (id VARCHAR(50) PRIMARY KEY, name VARCHAR(255), isPrivate BOOLEAN)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS categories (id VARCHAR(50) PRIMARY KEY, name VARCHAR(255), isPrivate BOOLEAN)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS sub_categories (id INT AUTO_INCREMENT PRIMARY KEY, categoryId VARCHAR(50), name VARCHAR(255), FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE CASCADE)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS system_settings (setting_key VARCHAR(50) PRIMARY KEY, setting_value TEXT)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS instagram_comments (id VARCHAR(255) PRIMARY KEY, media_id VARCHAR(255), username VARCHAR(255), text TEXT, timestamp DATETIME)`);

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

    // 4. Seed Defaults
    const defaults = {
        linkExpiryHours: '24',
        goldRate22k: '6500',
        goldRate24k: '7200',
        gstPercent: '3',
        makingChargeSegments: JSON.stringify([
            { id: 'classic', name: 'Classic', percent: 10 },
            { id: 'premium', name: 'Premium', percent: 12 },
            { id: 'antique', name: 'Antique', percent: 13 }
        ]),
        defaultMakingChargeSegmentId: 'premium',
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

    // 5. Seed Default Admin User
    const [adminCheck] = await pool.query('SELECT id FROM staff WHERE role = "admin" LIMIT 1');
    if (adminCheck.length === 0) {
        console.log('[Database] Seeding default admin user...');
        await pool.query('INSERT INTO staff (id, username, password, role, name, isActive, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)', [
            crypto.randomUUID(),
            'admin',
            'admin123', // Default password
            'admin',
            'System Admin',
            true,
            new Date()
        ]);
    }

    console.log('[Database] Schema Verified and Ready');
    
    // Start background gold rate fetcher
    fetchGoldRates();
    setInterval(fetchGoldRates, 15 * 60 * 1000); // Every 15 minutes
  } catch (err) {
    dbInitError = err.message;
    DEMO_MODE = true;
    console.error('❌ [Database] MySQL Connection Failed. Switching to DEMO_MODE:', err.message);
    // Do not re-throw, allow server to start in demo mode
  }
};

// --- DYNAMIC IMAGE RESIZING ---

    app.use(mediaRoutes(poolProxy, UPLOADS_ROOT));

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'online', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    db: pool ? (dbInitError ? (DEMO_MODE ? 'demo_mode' : 'error') : 'connected') : 'not initialized',
    dbError: dbInitError,
    demoMode: DEMO_MODE,
    loadedEnv: loadedEnvPath,
    dbConfig: {
        host: dbConfig.host,
        user: dbConfig.user,
        database: dbConfig.database,
        hasPassword: !!dbConfig.password
    },
    envDebug: {
        DB_HOST: process.env.DB_HOST ? 'SET' : 'NOT_SET',
        DB_USER: process.env.DB_USER ? 'SET' : 'NOT_SET',
        DB_NAME: process.env.DB_NAME ? 'SET' : 'NOT_SET',
        DB_PASSWORD: process.env.DB_PASSWORD ? 'SET' : 'NOT_SET'
    },
    distPath: distPath,
    distExists: existsSync(distPath)
  });
});

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

app.get('/api/debug-env', (req, res) => {
    res.json({
        DB_HOST: process.env.DB_HOST || 'Not Set',
        DB_USER: process.env.DB_USER || 'Not Set',
        DB_NAME: process.env.DB_NAME || 'Not Set',
        DB_PASSWORD_LENGTH: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.length : 0,
        NODE_ENV: process.env.NODE_ENV,
        dbInitError: dbInitError || null
    });
});

app.get('/api/retry-db', async (req, res) => {
    try {
        await initDB();
        res.json({ status: 'success', message: 'Database connected successfully' });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
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
        const now = Date.now();
        if (CACHE.config.data && (now - CACHE.config.lastFetch < CACHE_TTL)) {
            return res.json(CACHE.config.data);
        }

        if (DEMO_MODE) {
            const demoData = {
                suppliers: [{ id: 'demo', name: 'Sanghavi Heritage', isPrivate: false }],
                categories: [
                    { id: 'rings', name: 'Rings', isPrivate: false, subCategories: ['Solitaire', 'Band'] },
                    { id: 'necklaces', name: 'Necklaces', isPrivate: false, subCategories: ['Choker', 'Long'] }
                ],
                linkExpiryHours: 24,
                demo: true
            };
            CACHE.config.data = demoData;
            CACHE.config.lastFetch = now;
            return res.json(demoData);
        }
        if (!pool) throw new Error('Database connection not initialized. Check your .env configuration.');
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
            goldRate22k: 6500,
            goldRate24k: 7200,
            gstPercent: 3,
            makingChargeSegments: [
                { id: 'classic', name: 'Classic', percent: 10 },
                { id: 'premium', name: 'Premium', percent: 12 },
                { id: 'antique', name: 'Antique', percent: 13 }
            ],
            defaultMakingChargeSegmentId: 'premium',
            whatsappNumber: '',
            whatsappPhoneId: '',
            whatsappToken: '',
            whatsappTemplateName: 'sanghavi_jewel_studio',
            whatsappWishlistTemplateName: 'wishlist_price_drop',
        };

        settingsRows.forEach(row => {
            if (row.setting_key === 'linkExpiryHours') config.linkExpiryHours = Number(row.setting_value);
            else if (row.setting_key === 'goldRate22k') config.goldRate22k = Number(row.setting_value);
            else if (row.setting_key === 'goldRate24k') config.goldRate24k = Number(row.setting_value);
            else if (row.setting_key === 'gstPercent') config.gstPercent = Number(row.setting_value);
            else if (row.setting_key === 'makingChargeSegments') {
                try { config.makingChargeSegments = JSON.parse(row.setting_value); } catch { config.makingChargeSegments = []; }
            }
            else if (row.setting_key === 'defaultMakingChargeSegmentId') config.defaultMakingChargeSegmentId = row.setting_value;
            else config[row.setting_key] = row.setting_value;
        });

        CACHE.config.data = config;
        CACHE.config.lastFetch = now;
        res.json(config);
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    }
});

app.post('/api/config', async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const { suppliers, categories, makingChargeSegments, defaultMakingChargeSegmentId, linkExpiryHours, goldRate22k, goldRate24k, gstPercent, whatsappNumber, whatsappPhoneId, whatsappToken, whatsappTemplateName, whatsappWishlistTemplateName, instagramHandle, instagramToken, aiConfig } = req.body;

        const settings = { 
            linkExpiryHours, 
            gstPercent,
            makingChargeSegments: JSON.stringify(makingChargeSegments || []),
            defaultMakingChargeSegmentId,
            whatsappNumber, 
            whatsappPhoneId, 
            whatsappToken,
            whatsappTemplateName,
            whatsappWishlistTemplateName,
            instagramHandle,
            instagramToken,
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
        CACHE.config.data = null; // Invalidate cache
        res.json({ success: true });
    } catch (e) { 
        await conn.rollback();
        res.status(500).json({ error: e.message }); 
    } finally {
        conn.release();
    }
});

// 1. Overall Optimization (Compression & Path checking)
app.post('/api/admin/optimize-storage', async (req, res) => {
    console.log(`🖼️ [Compress] Attempting optimization. Base UPLOADS_ROOT: ${UPLOADS_ROOT}`);
    try {
        const { default: sharp } = await import('sharp');
        const sizes = ['300', '720', '1080'];
        let compressedCount = 0;
        let checkedPaths = [];

        // Try multiple possible roots since environments differ
        const possibleRoots = [
            UPLOADS_ROOT,
            path.resolve(__dirname, '..', 'sanghavi_persistence', 'uploads'),
            path.resolve(__dirname, '..', 'public_html', 'uploads'),
            '/files/sanghavi_persistence/uploads',
            '/home/u477692720/domains/studio.sanghavijewellers.com/sanghavi_persistence/uploads' // From screenshot path structure
        ];

        let activeRoot = null;
        for (const pr of possibleRoots) {
            checkedPaths.push(`[Check ${pr}]`);
            if (existsSync(pr)) {
                activeRoot = pr;
                console.log(`🖼️ [Compress] Found valid upload root at: ${pr}`);
                break;
            }
        }

        if (!activeRoot) {
             return res.json({ success: false, message: `Could not find any valid upload root. Checked: ${possibleRoots.join(', ')}` });
        }

        for (const size of sizes) {
            const dir = path.join(activeRoot, size);
            checkedPaths.push(dir);
            if (!existsSync(dir)) {
                console.log(`🖼️ [Compress] Directory not found: ${dir}`);
                continue;
            }
            
            const files = readdirSync(dir);
            console.log(`🖼️ [Compress] Checking ${dir}. Found ${files.length} files.`);
            for (const filename of files) {
                const filepath = path.join(dir, filename);
                if (statSync(filepath).isDirectory()) continue;
                const stats = statSync(filepath);

                // Check if file is a valid image and greater than 50KB (temporarily dropped to capture EVERYTHING for testing)
                const isImage = filename.match(/\.(jpg|jpeg|png|webp|avif)$/i);
                
                if (isImage && stats.size > 10 * 1024) { // Only skipping things smaller than 10KB
                    console.log(`🖼️ [Compress] Compressing: ${filename} (${(stats.size / 1024).toFixed(0)}KB)`);
                    try {
                        const buffer = await sharp(readFileSync(filepath))
                            .rotate()
                            .resize(parseInt(size), null, { withoutEnlargement: true })
                            .toFormat('webp', { quality: 80 })
                            .toBuffer();
                        writeFileSync(filepath, buffer);
                        compressedCount++;
                    } catch (err) {
                        console.error(`❌ [Compress] Failed to compress ${filename}: ${err.message}`);
                    }
                } else if (isImage) {
                    // Log files that are skipped because they are already very small
                    // console.log(`⏩ [Compress] Skipped: ${filename} (Already optimized: ${(stats.size / 1024).toFixed(0)}KB)`);
                }
            }
        }
        res.json({ success: true, message: `Used root ${activeRoot}. Compressed ${compressedCount} images.` });
    } catch (e) {
        console.error(`❌ [Compress] Route error: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

// 2. CDN/Deduplication Only
app.post('/api/admin/deduplicate-storage', async (req, res) => {
    try {
        const [products] = await pool.query('SELECT id, images, thumbnails FROM products');
        const oldToNewMap = new Map();
        const sizes = ['300', '1080'];
        let spaceSaved = 0;
        let dbUpdates = 0;

        for (const size of sizes) {
            const dir = path.join(UPLOADS_ROOT, size);
            if (!existsSync(dir)) continue;
            
            const files = readdirSync(dir);
            for (const filename of files) {
                const filepath = path.join(dir, filename);
                if (statSync(filepath).isDirectory()) continue;

                const buffer = readFileSync(filepath);
                const stats = statSync(filepath);
                const hash = getHash(buffer);
                const ext = path.extname(filename);
                const slug = filename.split('-')[0] || 'asset';
                const newFilename = `${hash}-${slug}-${size}w${ext}`;
                
                oldToNewMap.set(`${size}/${filename}`, newFilename);

                const newFilepath = path.join(dir, newFilename);
                if (filename !== newFilename) {
                    if (existsSync(newFilepath)) {
                        spaceSaved += stats.size;
                        unlinkSync(filepath);
                    } else {
                        writeFileSync(newFilepath, buffer);
                        unlinkSync(filepath);
                    }
                }
            }
        }

        for (const product of products) {
            const images = safeParse(product.images);
            const thumbnails = safeParse(product.thumbnails);
            let changed = false;

            const updateList = (list, size) => {
                return list.map(url => {
                    if (!url || typeof url !== 'string' || !url.startsWith('/uploads/')) return url;
                    const oldName = path.basename(url);
                    const newName = oldToNewMap.get(`${size}/${oldName}`);
                    if (newName && oldName !== newName) {
                        changed = true;
                        return `/uploads/${size}/${newName}`;
                    }
                    return url;
                });
            };

            const newImages = updateList(images, '1080');
            const newThumbnails = updateList(thumbnails, '300');

            if (changed) {
                await pool.query('UPDATE products SET images = ?, thumbnails = ? WHERE id = ?', 
                    [JSON.stringify(newImages), JSON.stringify(newThumbnails), product.id]);
                dbUpdates++;
            }
        }

        res.json({ success: true, message: "Deduplication complete", dbUpdates });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- CORE PRODUCT APIs ---
const safeParse = (str, fallback = []) => {
  if (Array.isArray(str)) return str;
  try { return JSON.parse(str) || fallback; } catch (e) { return fallback; }
};
const sanitizeProduct = (p) => p ? ({ ...p, tags: safeParse(p.tags), images: safeParse(p.images), thumbnails: safeParse(p.thumbnails), meta: safeParse(p.meta, {}) }) : null;


    app.use(productsRoutes(poolProxy, CACHE, sanitizeProduct));


    app.use(customersRoutes(poolProxy));

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
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/staff/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM staff WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.use('/api', wishlistRoutes(poolProxy, sanitizeProduct));

app.use(analyticsRoutes(poolProxy, BACKUPS_ROOT));
app.use('/api', aiRoutes(poolProxy));

app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Internal Server Error', message: err.message }); });

// --- API ROUTES ---
// (Moved to top)

// --- API ROUTES ---

// 2. CDN/Deduplication Only
app.post('/api/admin/deduplicate-storage', async (req, res) => {
    try {
        const [products] = await pool.query('SELECT id, images, thumbnails FROM products');
        const oldToNewMap = new Map();
        const sizes = ['300', '1080'];
        let spaceSaved = 0;
        let dbUpdates = 0;

        for (const size of sizes) {
            const dir = path.join(UPLOADS_ROOT, size);
            if (!existsSync(dir)) continue;
            
            const files = readdirSync(dir);
            for (const filename of files) {
                const filepath = path.join(dir, filename);
                if (statSync(filepath).isDirectory()) continue;

                const buffer = readFileSync(filepath);
                const stats = statSync(filepath);
                const hash = getHash(buffer);
                const ext = path.extname(filename);
                const slug = filename.split('-')[0] || 'asset';
                const newFilename = `${hash}-${slug}-${size}w${ext}`;
                
                oldToNewMap.set(`${size}/${filename}`, newFilename);

                const newFilepath = path.join(dir, newFilename);
                if (filename !== newFilename) {
                    if (existsSync(newFilepath)) {
                        spaceSaved += stats.size;
                        unlinkSync(filepath);
                    } else {
                        writeFileSync(newFilepath, buffer);
                        unlinkSync(filepath);
                    }
                }
            }
        }

        for (const product of products) {
            const images = safeParse(product.images);
            const thumbnails = safeParse(product.thumbnails);
            let changed = false;

            const updateList = (list, size) => {
                return list.map(url => {
                    if (!url || typeof url !== 'string' || !url.startsWith('/uploads/')) return url;
                    const oldName = path.basename(url);
                    const newName = oldToNewMap.get(`${size}/${oldName}`);
                    if (newName && oldName !== newName) {
                        changed = true;
                        return `/uploads/${size}/${newName}`;
                    }
                    return url;
                });
            };

            const newImages = updateList(images, '1080');
            const newThumbnails = updateList(thumbnails, '300');

            if (changed) {
                await pool.query('UPDATE products SET images = ?, thumbnails = ? WHERE id = ?', 
                    [JSON.stringify(newImages), JSON.stringify(newThumbnails), product.id]);
                dbUpdates++;
            }
        }

        res.json({ success: true, message: "Deduplication complete", dbUpdates });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// API 404 Handler - Ensures /api/* always returns JSON
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API Route Not Found', path: req.originalUrl });
});

// --- SERVE FRONTEND ---
const distPath = path.resolve(__dirname, 'dist');
const altDistPath = path.resolve(__dirname, 'public_html', 'dist');

console.log(`📂 [Sanghavi Studio] Primary distPath: ${distPath} (Exists: ${existsSync(distPath)})`);
console.log(`📂 [Sanghavi Studio] Secondary distPath: ${altDistPath} (Exists: ${existsSync(altDistPath)})`);

// Helper to get the current active dist path dynamically
const getActiveDistPath = () => {
  if (process.env.NODE_ENV === 'development') return null;
  if (existsSync(distPath) && existsSync(path.join(distPath, 'index.html'))) return distPath;
  if (existsSync(altDistPath) && existsSync(path.join(altDistPath, 'index.html'))) return altDistPath;
  return null;
};

// Use middleware to dynamically serve static files based on current dist path
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  
  const activeDistPath = getActiveDistPath();
  if (activeDistPath) {
    express.static(activeDistPath, { index: false })(req, res, next);
  } else {
    next();
  }
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  
  const activeDistPath = getActiveDistPath();
  if (activeDistPath) {
    res.sendFile(path.join(activeDistPath, 'index.html'));
  } else {
    next(); // Fall through to Vite dev server or error handler
  }
});

async function startServer() {
  try {
    const initialDistPath = getActiveDistPath();

    if (!initialDistPath) {
      console.log('[Sanghavi Studio] No production build found. Attempting to start Vite dev server...');
      try {
        const { createServer: createViteServer } = await import('vite');
        const vite = await createViteServer({
          server: { middlewareMode: true },
          appType: 'spa',
        });
        app.use(vite.middlewares);
      } catch (e) {
        console.error('❌ [Sanghavi Studio] Failed to start Vite dev server. Is Vite installed?', e);
        app.use((req, res) => res.status(500).send(`Frontend build not found and Vite dev server failed to start. Error: ${e.message}`));
      }
    }

    const PORT = process.env.PORT || 3000;
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log("Server running on port", PORT);
      
      // Initialize Database in background after server starts listening
      console.log('🚀 [Sanghavi Studio] Initializing Database in background...');
      initDB().catch(err => {
        console.error('❌ [Sanghavi Studio] Database Initialization Failed:', err);
      });
    });

    server.on('error', (err) => {
      console.error('❌ [Sanghavi Studio] Server failed to start:', err);
      process.exit(1);
    });

  } catch (err) {
    console.error('❌ [Sanghavi Studio] Critical Startup Failure:', err);
    process.exit(1);
  }
}

startServer();
