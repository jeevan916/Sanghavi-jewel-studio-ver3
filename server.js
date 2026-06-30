import analyticsRoutes from './server/routes/analytics.js';
import mediaRoutes from './server/routes/media.js';
import customersRoutes from './server/routes/customers.js';
import productsRoutes from './server/routes/products.js';
import wishlistRoutes from './server/routes/wishlist.js';
import configRoutes from './server/routes/config.js';
import adminRoutes from './server/routes/admin.js';
import staffRoutes from './server/routes/staff.js';
import linksRoutes from './server/routes/links.js';
import aiRoutes from './server/routes/ai.js';

import fs, { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, appendFileSync, writeFileSync, readFileSync } from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

if (!process.env.JWT_SECRET) {
  const newSecret = crypto.randomBytes(32).toString('hex');
  process.env.JWT_SECRET = newSecret;
  try {
    appendFileSync('.env', `\nJWT_SECRET=${newSecret}\n`);
    console.log('✅ Generated a secure JWT_SECRET and saved it to .env');
  } catch (err) {
    console.warn('⚠️ Could not save JWT_SECRET to .env, using an ephemeral in-memory secret for this session.');
  }
}

const requiredEnv = ['GEMINI_API_KEY'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`⚠️ WARNING: ${key} environment variable is missing.`);
  }
}
if (!process.env.DB_PASSWORD) {
  console.error(`⚠️ WARNING: DB_PASSWORD environment variable is missing.`);
}

console.log('🚀 [Sanghavi Studio] Server process starting...');
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import mysql from 'mysql2/promise';
import multer from 'multer';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const app = express();

// Request path transformation mapping to foil simple automated scrapers
app.use((req, res, next) => {
    if (req.url.startsWith('/_proxy/')) {
        try {
            const encoded = req.url.slice(8).split('?')[0]; 
            const query = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
            // add padding if needed
            let b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
            while (b64.length % 4) b64 += '=';
            const decoded = decodeURIComponent(Buffer.from(b64, 'base64').toString('utf8'));
            req.url = '/api' + decoded + query;
            delete req._parsedUrl; // force express to re-parse the path
            
            // Fix req.query because express populated it before our rewrite
            const qsIndex = req.url.indexOf('?');
            if (qsIndex !== -1) {
                const qs = req.url.substring(qsIndex + 1);
                const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
                req.query = Object.fromEntries(parsedUrl.searchParams.entries());
            } else {
                req.query = {};
            }
        } catch (e) {
            return res.status(400).json({ error: 'Invalid Proxy Routing' });
        }
    } else if (req.originalUrl.startsWith('/api/') && process.env.NODE_ENV !== 'development') {
        // Obfuscate real endpoints, return 404 for direct bot attempts
        // We only enforce this out of dev for easier local testing, though it's optional.
        return res.status(404).json({ error: "Endpoint not found." });
    }
    next();
});

// Basic Middlewares
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

import rateLimit from 'express-rate-limit';

app.set('trust proxy', 1); // Trust first proxy for rate limiting (e.g. Hostinger / Cloud Run)

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, 
  message: { error: 'Too many requests, please try again later.' },
  keyGenerator: (req) => req.headers['x-forwarded-for'] || req.headers['forwarded'] || req.ip
});

// Hostinger Startup Verification
const startupLog = path.resolve(__dirname, 'public_html', 'server_status.txt');
try {
  const logMsg = `[${new Date().toISOString()}] Server attempting start on PORT: ${process.env.PORT || 3000}\n`;
  appendFileSync(startupLog, logMsg);
} catch (e) {
  console.error('Failed to write startup log', e);
}

const allowedOrigins = [
  'https://studio.sanghavijewellers.com',
  'https://app.sanghavijewellers.com',
  'https://ais-dev-afcm666ozoj7duxnxvpyyi-8038997919.asia-southeast1.run.app',
  'https://ais-pre-afcm666ozoj7duxnxvpyyi-8038997919.asia-southeast1.run.app'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://localhost:')) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true
}));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
app.use(compression());
app.use(express.json({ limit: '100mb' }));

app.use('/api/', apiLimiter);

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
    // Only block if we strictly require a database, but DEMO_MODE handles products
    // so we should let routes decide if they need the pool.
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

// Fallback for missing uploads
app.use('/uploads', (req, res) => {
  const redirectUrl = new URL(`/uploads${req.url}`, 'https://studio.sanghavijewellers.com');
  return res.redirect(redirectUrl.toString());
});

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
  keepAliveInitialDelay: 0,
  connectTimeout: 10000,
  acquireTimeout: 10000
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
    await pool.query(`CREATE TABLE IF NOT EXISTS wishlist (id INT AUTO_INCREMENT PRIMARY KEY, customerId VARCHAR(255), productId VARCHAR(255), priceWhenWishlisted FLOAT, preferences JSON, createdAt DATETIME, lastNotifiedAt DATETIME, FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE, FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE CASCADE, UNIQUE KEY unique_wish(customerId, productId))`);
    try { await pool.query(`ALTER TABLE wishlist ADD COLUMN IF NOT EXISTS preferences JSON AFTER priceWhenWishlisted`); } catch (e) { /* ignore if already exists */ }
    
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
      "CREATE INDEX IF NOT EXISTS idx_products_cover ON products(isHidden, createdAt)",
      "CREATE INDEX IF NOT EXISTS idx_products_cat_sort ON products(isHidden, category, createdAt)",
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

// --- ROUTES EXTRACTED ---

// --- CORE PRODUCT APIs ---
const safeParse = (str, fallback = []) => {
  if (Array.isArray(str)) return str;
  try { return JSON.parse(str) || fallback; } catch (e) { return fallback; }
};
const sanitizeProduct = (p) => p ? ({ ...p, tags: safeParse(p.tags), images: safeParse(p.images), thumbnails: safeParse(p.thumbnails), meta: safeParse(p.meta, {}) }) : null;


    app.use(productsRoutes(poolProxy, CACHE, sanitizeProduct));
    app.use(configRoutes(poolProxy, CACHE));
    app.use(adminRoutes(poolProxy, UPLOADS_ROOT));
    app.use(staffRoutes(poolProxy));
    app.use(linksRoutes(poolProxy));
    app.use(customersRoutes(poolProxy));
    app.use('/api', wishlistRoutes(poolProxy, sanitizeProduct));

    app.use(analyticsRoutes(poolProxy, BACKUPS_ROOT));
    app.use('/api', aiRoutes(poolProxy));

    app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Internal Server Error', message: err.message }); });

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
  if (process.env.VITE_DEV_SERVER === 'true') return null;
  if (existsSync(distPath) && existsSync(path.join(distPath, 'index.html'))) return distPath;
  if (existsSync(altDistPath) && existsSync(path.join(altDistPath, 'index.html'))) return altDistPath;
  return null;
};

// Use middleware to dynamically serve static files based on current dist path
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  
  const activeDistPath = getActiveDistPath();
  if (activeDistPath) {
    express.static(activeDistPath, { 
      index: false,
      setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        } else if (path.match(/\.(js|css|woff2?|png|svg|jpe?g|gif|webp|avif)$/i)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      }
    })(req, res, next);
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
      if (process.env.DISABLE_HMR === 'true' || process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER === 'true') {
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
      } else {
        console.error('❌ [Sanghavi Studio] Production build not found, and running Vite dev server is disabled in production to prevent timeouts.');
        app.use((req, res) => res.status(503).send('Frontend build (dist) not found. Please run "npm run build".'));
      }
    }

    const PORT = process.env.PORT || 3000;
    const server = app.listen(PORT, () => {
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
