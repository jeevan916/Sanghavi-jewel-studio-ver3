
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from the designated config path
dotenv.config({ path: path.resolve(process.cwd(), '.builds/config/.env') });

import express from 'express';
import fs from 'fs/promises';
import { existsSync, mkdirSync, createWriteStream } from 'fs';
import cors from 'cors';
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);
const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.use(cors());
app.use(express.json({ limit: '100mb' }));

/** 
 * CRITICAL DATA PRESERVATION:
 * DATA_ROOT is moved to .builds/sanghavi_persistence
 */
const DATA_ROOT = path.resolve(process.cwd(), '.builds', 'sanghavi_persistence');
const UPLOADS_ROOT = path.resolve(DATA_ROOT, 'uploads');
const BACKUP_ROOT = path.resolve(process.cwd(), '.builds', 'backup');

const ensureFolders = async () => {
    try {
        if (!existsSync(DATA_ROOT)) mkdirSync(DATA_ROOT, { recursive: true, mode: 0o777 });
        if (!existsSync(UPLOADS_ROOT)) mkdirSync(UPLOADS_ROOT, { recursive: true, mode: 0o777 });
        if (!existsSync(BACKUP_ROOT)) mkdirSync(BACKUP_ROOT, { recursive: true, mode: 0o777 });
        console.log(`[Vault] Persistence verified at .builds/sanghavi_persistence`);
    } catch (err) {
        console.error(`[Vault] Initialization failed:`, err.message);
    }
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
        setupAutoBackup();
    } catch (err) {
        dbStatus = { healthy: false, error: err.message };
        setTimeout(initDB, 10000); 
    }
};

const createTables = async () => {
    if (!pool) return;
    const tables = [
        `CREATE TABLE IF NOT EXISTS products (id VARCHAR(255) PRIMARY KEY, title VARCHAR(255) NOT NULL, category VARCHAR(100), subCategory VARCHAR(100), weight DECIMAL(10,3), description TEXT, tags JSON, images JSON, thumbnails JSON, supplier VARCHAR(255), uploadedBy VARCHAR(255), isHidden BOOLEAN DEFAULT FALSE, createdAt DATETIME, dateTaken DATE, meta JSON)`,
        `CREATE TABLE IF NOT EXISTS staff (id VARCHAR(255) PRIMARY KEY, username VARCHAR(100) UNIQUE, password VARCHAR(255), role VARCHAR(50), isActive BOOLEAN DEFAULT TRUE, name VARCHAR(255), createdAt DATETIME)`,
        `CREATE TABLE IF NOT EXISTS customers (id VARCHAR(255) PRIMARY KEY, phone VARCHAR(50) UNIQUE, name VARCHAR(255), pincode VARCHAR(20), lastLocation JSON, role VARCHAR(50), createdAt DATETIME)`,
        `CREATE TABLE IF NOT EXISTS app_config (id INT PRIMARY KEY DEFAULT 1, data JSON, CHECK (id = 1))`,
        `CREATE TABLE IF NOT EXISTS analytics (id VARCHAR(255) PRIMARY KEY, type VARCHAR(50), productId VARCHAR(255), productTitle VARCHAR(255), category VARCHAR(100), weight DECIMAL(10,3), userId VARCHAR(255), userName VARCHAR(255), timestamp DATETIME, duration INT DEFAULT 0, meta JSON)`,
        `CREATE TABLE IF NOT EXISTS designs (id VARCHAR(255) PRIMARY KEY, imageUrl LONGTEXT, prompt TEXT, aspectRatio VARCHAR(20), createdAt DATETIME)`,
        `CREATE TABLE IF NOT EXISTS shared_links (id VARCHAR(255) PRIMARY KEY, targetId VARCHAR(255), type VARCHAR(50), token VARCHAR(255) UNIQUE, expiresAt DATETIME)`,
        `CREATE TABLE IF NOT EXISTS suggestions (id VARCHAR(255) PRIMARY KEY, productId VARCHAR(255), userId VARCHAR(255), userName VARCHAR(255), userPhone VARCHAR(50), suggestion TEXT, createdAt DATETIME)`
    ];
    for (const query of tables) await pool.query(query);
};

const seedDefaultAdmin = async () => {
    try {
        const [rows] = await pool.query('SELECT * FROM staff WHERE username = "admin"');
        if (rows.length === 0) {
            await pool.query('INSERT INTO staff (id, username, password, role, isActive, name, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)', 
            [crypto.randomUUID(), 'admin', 'admin123', 'admin', true, 'Sanghavi Administrator', new Date()]);
            console.log("[Vault] Default admin account seeded.");
        }
    } catch (err) {
        console.error("[Vault] Seeding failed:", err.message);
    }
};

const setupAutoBackup = () => {
    // Auto backup every 24 hours
    setInterval(async () => {
        console.log("[Vault] Triggering automated backup...");
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupName = `auto_sanghavi_vault_${timestamp}.zip`;
            const backupPath = path.resolve(BACKUP_ROOT, backupName);
            await execPromise(`zip -r "${backupPath}" "${DATA_ROOT}"`);
            console.log(`[Vault] Automated backup successful: ${backupName}`);
        } catch (err) {
            console.error(`[Vault] Automated backup failed:`, err.message);
        }
    }, 1000 * 60 * 60 * 24);
};

initDB();

// --- AUTHENTICATION ENGINE ---

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await pool.query('SELECT id, username, role, name, isActive FROM staff WHERE username = ? AND password = ?', [username, password]);
        const user = rows[0];
        if (user) {
            if (!user.isActive) return res.status(403).json({ error: 'Account deactivated' });
            res.json({ user });
        } else {
            res.status(401).json({ error: 'Invalid username or password' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/customers/check/:phone', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM customers WHERE phone = ?', [req.params.phone]);
        if (rows.length > 0) {
            res.json({ exists: true, user: rows[0] });
        } else {
            res.json({ exists: false });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/customers/login', async (req, res) => {
    const { phone, name, pincode, location } = req.body;
    try {
        // Find existing or create new
        const [existing] = await pool.query('SELECT * FROM customers WHERE phone = ?', [phone]);
        let user;
        if (existing.length > 0) {
            user = existing[0];
            // Update optional details if provided
            if (name || pincode || location) {
                await pool.query('UPDATE customers SET name = IFNULL(?, name), pincode = IFNULL(?, pincode), lastLocation = IFNULL(?, lastLocation) WHERE phone = ?', 
                [name || null, pincode || null, JSON.stringify(location) || null, phone]);
                const [updated] = await pool.query('SELECT * FROM customers WHERE phone = ?', [phone]);
                user = updated[0];
            }
        } else {
            const id = crypto.randomUUID();
            const finalName = name || `Client ${phone.slice(-4)}`;
            await pool.query('INSERT INTO customers (id, phone, name, pincode, lastLocation, role, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)', 
            [id, phone, finalName, pincode || null, JSON.stringify(location) || null, 'customer', new Date()]);
            const [created] = await pool.query('SELECT * FROM customers WHERE id = ?', [id]);
            user = created[0];
        }
        res.json({ user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- BACKUP ENGINE ---
app.post('/api/maintenance/backup', async (req, res) => {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupName = `sanghavi_vault_backup_${timestamp}.zip`;
        const backupPath = path.resolve(BACKUP_ROOT, backupName);
        const cmd = `zip -r "${backupPath}" "${DATA_ROOT}"`;
        await execPromise(cmd);
        res.json({ 
            success: true, 
            filename: backupName, 
            size: (await fs.stat(backupPath)).size,
            path: backupPath 
        });
    } catch (err) {
        res.status(500).json({ error: 'Backup Engine Failure: ' + err.message });
    }
});

app.get('/api/maintenance/backups', async (req, res) => {
    try {
        const files = await fs.readdir(BACKUP_ROOT);
        const stats = await Promise.all(files.map(async f => {
            const s = await fs.stat(path.join(BACKUP_ROOT, f));
            return { name: f, size: s.size, date: s.mtime };
        }));
        res.json(stats.sort((a,b) => b.date.getTime() - a.date.getTime()));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/maintenance/backups/:name', async (req, res) => {
    try {
        const target = path.resolve(BACKUP_ROOT, req.params.name);
        if (!target.startsWith(BACKUP_ROOT)) throw new Error("Invalid path");
        await fs.unlink(target);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/maintenance/backups/download/:name', async (req, res) => {
    const target = path.resolve(BACKUP_ROOT, req.params.name);
    if (existsSync(target) && target.startsWith(BACKUP_ROOT)) {
        res.download(target);
    } else {
        res.status(404).send('Backup not found');
    }
});

// Existing API Handlers...
app.get('/api/health', (req, res) => res.json({ status: 'online', healthy: dbStatus.healthy }));

app.get('/api/products', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM products ORDER BY createdAt DESC');
        res.json({ items: rows.map(r => ({...r, images: JSON.parse(r.images || '[]'), thumbnails: JSON.parse(r.thumbnails || '[]')})), meta: { totalPages: 1 } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/products', async (req, res) => {
    const p = req.body;
    try {
        await pool.query('INSERT INTO products (id, title, category, subCategory, weight, description, tags, images, thumbnails, supplier, uploadedBy, isHidden, createdAt, dateTaken, meta) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', 
        [p.id, p.title, p.category, p.subCategory, p.weight, p.description, JSON.stringify(p.tags), JSON.stringify(p.images), JSON.stringify(p.thumbnails), p.supplier, p.uploadedBy, p.isHidden, new Date(p.createdAt), new Date(p.dateTaken), JSON.stringify(p.meta)]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/products/:id', async (req, res) => {
    const p = req.body;
    try {
        await pool.query('UPDATE products SET title=?, category=?, weight=?, images=?, thumbnails=? WHERE id=?', 
            [p.title, p.category, p.weight, JSON.stringify(p.images), JSON.stringify(p.thumbnails), req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/config', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT data FROM app_config WHERE id=1');
        res.json(rows[0]?.data ? JSON.parse(rows[0].data) : {});
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/config', async (req, res) => {
    try {
        await pool.query('INSERT INTO app_config (id, data) VALUES (1, ?) ON DUPLICATE KEY UPDATE data=?', [JSON.stringify(req.body), JSON.stringify(req.body)]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/staff', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, username, role, name, isActive, createdAt FROM staff');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/analytics', async (req, res) => {
    const e = req.body;
    try {
        await pool.query('INSERT INTO analytics (id, type, productId, productTitle, category, weight, userId, userName, timestamp, duration, meta) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [crypto.randomUUID(), e.type, e.productId, e.productTitle, e.category, e.weight, e.userId, e.userName, new Date(), e.duration || 0, JSON.stringify(e.meta || {})]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const dist = path.resolve(process.cwd(), 'dist');
if (existsSync(dist)) {
    app.use(express.static(dist, { index: false }));
    app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.listen(PORT, HOST, () => console.log(`[Sanghavi Studio] Live at port ${PORT}`));
