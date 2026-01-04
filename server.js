
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from the designated config path
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
 * DATA_ROOT is moved to the parent directory (..) of the app root.
 */
const DATA_ROOT = path.resolve(process.cwd(), '..', 'sanghavi_persistence');
const UPLOADS_ROOT = path.resolve(DATA_ROOT, 'uploads');
const THUMBS_ROOT = path.resolve(UPLOADS_ROOT, 'thumbnails');

const ensureFolders = async () => {
    try {
        if (!existsSync(DATA_ROOT)) {
            mkdirSync(DATA_ROOT, { recursive: true, mode: 0o777 });
            console.log(`[Vault] Initialized secure vault at: ${DATA_ROOT}`);
        }
        if (!existsSync(UPLOADS_ROOT)) mkdirSync(UPLOADS_ROOT, { recursive: true, mode: 0o777 });
        if (!existsSync(THUMBS_ROOT)) mkdirSync(THUMBS_ROOT, { recursive: true, mode: 0o777 });
        console.log(`[Vault] Connection to permanent storage verified.`);
    } catch (err) {
        console.error(`[Vault] Initialization failed:`, err.message);
    }
};
ensureFolders();

app.use('/uploads', express.static(UPLOADS_ROOT, {
    maxAge: '30d',
    etag: true,
    setHeaders: (res) => {
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Cache-Control', 'public, max-age=2592000, immutable');
    }
}));

const dbConfig = {
    host: (process.env.DB_HOST || 'localhost').toLowerCase() === 'localhost' ? '127.0.0.1' : process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    enableKeepAlive: true,
    timezone: 'Z' // Force UTC to avoid timezone drift
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
                pincode VARCHAR(20), lastLocation JSON, role VARCHAR(50), createdAt DATETIME
            )`,
            `CREATE TABLE IF NOT EXISTS app_config (id INT PRIMARY KEY DEFAULT 1, data JSON, CHECK (id = 1))`,
            // Analytics table updated for deep tracking
            `CREATE TABLE IF NOT EXISTS analytics (
                id VARCHAR(255) PRIMARY KEY, type VARCHAR(50), productId VARCHAR(255), 
                productTitle VARCHAR(255), category VARCHAR(100), weight DECIMAL(10,3),
                userId VARCHAR(255), userName VARCHAR(255), timestamp DATETIME,
                duration INT DEFAULT 0, meta JSON
            )`,
            `CREATE TABLE IF NOT EXISTS designs (id VARCHAR(255) PRIMARY KEY, imageUrl LONGTEXT, prompt TEXT, aspectRatio VARCHAR(20), createdAt DATETIME)`,
            `CREATE TABLE IF NOT EXISTS shared_links (id VARCHAR(255) PRIMARY KEY, targetId VARCHAR(255), type VARCHAR(50), token VARCHAR(255) UNIQUE, expiresAt DATETIME)`,
            `CREATE TABLE IF NOT EXISTS suggestions (
                id VARCHAR(255) PRIMARY KEY, productId VARCHAR(255), userId VARCHAR(255), 
                userName VARCHAR(255), userPhone VARCHAR(50), suggestion TEXT, createdAt DATETIME
            )`
        ];
        for (const query of tables) await pool.query(query);

        // Migrations
        try { await pool.query(`ALTER TABLE analytics ADD COLUMN duration INT DEFAULT 0`); } catch (e) {}
        try { await pool.query(`ALTER TABLE analytics ADD COLUMN meta JSON`); } catch (e) {}
        try { await pool.query(`ALTER TABLE analytics ADD COLUMN category VARCHAR(100)`); } catch (e) {}
        try { await pool.query(`ALTER TABLE analytics ADD COLUMN weight DECIMAL(10,3)`); } catch (e) {}

    } catch (err) {
        console.error('[Database] Critical Failure:', err.message);
        dbStatus = { healthy: false, error: err.message };
    }
};
initDB();

const saveFile = async (base64, isThumb = false) => {
    if (!base64 || !base64.startsWith('data:image')) return base64;
    try {
        const data = base64.split(';base64,').pop();
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

// --- CORE API ENDPOINTS ---

app.get('/api/health', (req, res) => res.json({ status: dbStatus.healthy ? 'online' : 'error', ...dbStatus }));

// OPTIMIZED LIST ENDPOINT (Pagination & Lite Data)
app.get('/api/products', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        
        // Count total for pagination metadata
        const [countResult] = await pool.query('SELECT COUNT(*) as total FROM products');
        const totalItems = countResult[0].total;

        // Fetch Lite Data (Exclude heavy 'images' and 'description' to save bandwidth)
        // We select 'images' but will only return the first one if thumbnails are empty in application logic, 
        // OR better, we select substring if it was text, but here it's JSON. 
        // Ideally we select specific columns.
        const [rows] = await pool.query(
            `SELECT id, title, category, subCategory, weight, thumbnails, isHidden, createdAt, dateTaken 
             FROM products 
             ORDER BY createdAt DESC 
             LIMIT ? OFFSET ?`, 
            [limit, offset]
        );

        const products = rows.map(r => {
            const p = parseJson(r, ['thumbnails']);
            // Ensure thumbnails is array
            if (!Array.isArray(p.thumbnails)) p.thumbnails = [];
            return p;
        });

        res.json({
            items: products,
            meta: {
                page,
                limit,
                totalItems,
                totalPages: Math.ceil(totalItems / limit)
            }
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// SINGLE PRODUCT ENDPOINT (Full Data)
app.get('/api/products/:id', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
        if (!rows[0]) return res.status(404).json({ error: 'Product not found' });
        
        const product = parseJson(rows[0], ['tags', 'images', 'thumbnails', 'meta']);
        res.json(product);
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
        await pool.query('DELETE FROM products WHERE id=?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/customers', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM customers ORDER BY createdAt DESC');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/customers/check/:phone', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT name, pincode FROM customers WHERE phone=?', [req.params.phone]);
        res.json({ exists: !!rows[0], user: rows[0] || null });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/analytics', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM analytics ORDER BY timestamp DESC LIMIT 500');
        res.json(rows.map(r => parseJson(r, ['meta'])));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// INTELLIGENCE ENGINE: Predictive & Collaborative Data
app.get('/api/analytics/intelligence', async (req, res) => {
    try {
        // 1. Spending Power Prediction (Avg Weight Interacted With)
        const [spendingRows] = await pool.query(`
            SELECT 
                c.pincode, 
                AVG(a.weight) as avg_weight_interest,
                COUNT(*) as interaction_count
            FROM analytics a
            JOIN customers c ON a.userId = c.id
            WHERE a.type IN ('like', 'inquiry', 'screenshot') AND a.weight > 0
            GROUP BY c.pincode
            HAVING interaction_count > 2
            ORDER BY avg_weight_interest DESC
        `);

        // 2. Category Demand by Region
        const [categoryRows] = await pool.query(`
            SELECT 
                c.pincode,
                a.category,
                COUNT(*) as demand_score
            FROM analytics a
            JOIN customers c ON a.userId = c.id
            WHERE a.type IN ('view', 'like', 'inquiry')
            GROUP BY c.pincode, a.category
            ORDER BY c.pincode, demand_score DESC
        `);

        // 3. Time Spent / Engagement Quality
        const [engagementRows] = await pool.query(`
            SELECT 
                a.productTitle,
                AVG(a.duration) as avg_time_seconds,
                SUM(CASE WHEN a.type = 'screenshot' THEN 1 ELSE 0 END) as screenshot_count
            FROM analytics a
            WHERE a.duration > 0 OR a.type = 'screenshot'
            GROUP BY a.productTitle
            ORDER BY avg_time_seconds DESC
            LIMIT 20
        `);

        // 4. Device Demographics (Wealth Proxy)
        const [deviceRows] = await pool.query(`
            SELECT 
                JSON_UNQUOTE(JSON_EXTRACT(meta, '$.os')) as os,
                COUNT(DISTINCT userId) as user_count
            FROM analytics 
            WHERE meta IS NOT NULL
            GROUP BY os
        `);

        res.json({
            spendingPower: spendingRows,
            regionalDemand: categoryRows,
            engagement: engagementRows,
            devices: deviceRows
        });

    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: err.message }); 
    }
});

app.post('/api/analytics', async (req, res) => {
    try {
        const e = req.body;
        await pool.query(
            'INSERT INTO analytics (id, type, productId, productTitle, category, weight, userId, userName, timestamp, duration, meta) VALUES (?,?,?,?,?,?,?,?,?,?,?)', 
            [
                crypto.randomUUID(), e.type, e.productId, e.productTitle, e.category, e.weight, 
                e.userId, e.userName, new Date(), e.duration || 0, JSON.stringify(e.meta || {})
            ]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// New Endpoint: Aggregated Stats per Product
app.get('/api/stats/:productId', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT type, COUNT(*) as count FROM analytics WHERE productId = ? GROUP BY type', 
            [req.params.productId]
        );
        
        const stats = { like: 0, dislike: 0, inquiry: 0, purchase: 0, sold: 0 };
        // Map rows to object
        rows.forEach(r => {
            if (stats.hasOwnProperty(r.type)) {
                stats[r.type] = r.count;
            }
            // Map legacy or specific events if needed
            if (r.type === 'inquiry') stats.inquiry = r.count; // "Will Buy"
            if (r.type === 'sold') stats.purchase = r.count;   // "Purchased"
        });
        
        res.json(stats);
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
        const d = req.body;
        await pool.query('INSERT INTO designs (id, imageUrl, prompt, aspectRatio, createdAt) VALUES (?,?,?,?,?)', [d.id, d.imageUrl, d.prompt, d.aspectRatio, new Date()]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/suggestions/:productId', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM suggestions WHERE productId=? ORDER BY createdAt DESC', [req.params.productId]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/suggestions', async (req, res) => {
    try {
        const { productId, userId, userName, userPhone, suggestion } = req.body;
        await pool.query(
            'INSERT INTO suggestions (id, productId, userId, userName, userPhone, suggestion, createdAt) VALUES (?,?,?,?,?,?,?)', 
            [crypto.randomUUID(), productId, userId, userName, userPhone, suggestion, new Date()]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/shared-links', async (req, res) => {
    try {
        const { targetId, type } = req.body;
        
        // Fetch expiry configuration from app_config
        const [configRows] = await pool.query('SELECT data FROM app_config WHERE id=1');
        let expiryHours = 24; // Default to 24 hours
        
        if (configRows && configRows.length > 0) {
            const rawData = configRows[0].data;
            // Parse JSON if returned as string (mysql2 behavior depends on version/config)
            const configData = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
            
            if (configData && configData.linkExpiryHours) {
                const configuredHours = parseFloat(configData.linkExpiryHours);
                if (!isNaN(configuredHours) && configuredHours > 0) {
                    expiryHours = configuredHours;
                }
            }
        }

        const token = crypto.randomBytes(16).toString('hex');
        const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
        
        await pool.query('INSERT INTO shared_links (id, targetId, type, token, expiresAt) VALUES (?,?,?,?,?)', [crypto.randomUUID(), targetId, type, token, expiresAt]);
        res.json({ token, expiresAt });
    } catch (err) { 
        console.error("Link Generation Error:", err);
        res.status(500).json({ error: err.message }); 
    }
});

// VALIDATE SHARED LINK
app.get('/api/shared-links/:token', async (req, res) => {
    try {
        // Select without checking expiresAt in SQL to avoid timezone mismatch
        const [rows] = await pool.query('SELECT * FROM shared_links WHERE token=?', [req.params.token]);
        
        if (!rows || rows.length === 0) {
            return res.status(404).json({ error: 'Link invalid or not found' });
        }

        const link = rows[0];
        // Perform expiration check in application logic (Node.js) where Timezone is consistent
        if (new Date() > new Date(link.expiresAt)) {
            return res.status(410).json({ error: 'Link expired' });
        }

        res.json(link);
    } catch (err) { 
        console.error("Shared Link Error:", err);
        res.status(500).json({ error: err.message }); 
    }
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

app.post('/api/auth/staff', async (req, res) => {
    try {
        const { username, password } = req.body;
        const [rows] = await pool.query('SELECT * FROM staff WHERE username=? AND password=? AND isActive=1', [username, password]);
        if (rows[0]) res.json(rows[0]);
        else res.status(401).json({ error: 'Invalid credentials' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/staff', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, username, role, isActive, name, createdAt FROM staff');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/whatsapp', async (req, res) => {
    try {
        const { phone, name, pincode, location } = req.body;
        const [rows] = await pool.query('SELECT * FROM customers WHERE phone=?', [phone]);
        
        let user;
        if (rows[0]) {
            // Update existing user with new info if provided, AND update location
            user = rows[0];
            const updates = [];
            const values = [];

            if (name) { updates.push('name=?'); values.push(name); user.name = name; }
            if (pincode) { updates.push('pincode=?'); values.push(pincode); user.pincode = pincode; }
            if (location) { updates.push('lastLocation=?'); values.push(JSON.stringify(location)); }
            
            if (updates.length > 0) {
                values.push(user.id);
                await pool.query(`UPDATE customers SET ${updates.join(', ')} WHERE id=?`, values);
            }
        } else {
            // Create new user
            user = { id: crypto.randomUUID(), phone, name: name || `Client ${phone.slice(-4)}`, pincode: pincode || '', role: 'customer', createdAt: new Date() };
            await pool.query('INSERT INTO customers (id, phone, name, pincode, lastLocation, role, createdAt) VALUES (?,?,?,?,?,?,?)', 
                [user.id, user.phone, user.name, user.pincode, JSON.stringify(location || {}), user.role, user.createdAt]);
        }
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

app.listen(PORT, HOST, () => console.log(`[Sanghavi Studio] Live at port ${PORT}`));
