
import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import cors from 'cors';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '100mb' }));

/** 
 * 1. PERSISTENCE VAULT SETUP
 * Root folder: sanghavi_persistence (protected directory)
 */
const DATA_ROOT = path.resolve(__dirname, 'sanghavi_persistence');
const UPLOADS_ROOT = path.resolve(DATA_ROOT, 'uploads');
const THUMBS_ROOT = path.resolve(UPLOADS_ROOT, 'thumbnails');
const BACKUPS_ROOT = path.resolve(DATA_ROOT, 'backups');

const initializeDirectories = () => {
    [DATA_ROOT, UPLOADS_ROOT, THUMBS_ROOT, BACKUPS_ROOT].forEach(dir => {
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
            console.log(`[Vault] Initializing secure directory: ${dir}`);
        }
    });
};
initializeDirectories();

// Serve physical assets
app.use('/uploads', express.static(UPLOADS_ROOT));

/**
 * 2. DATABASE ARCHITECTURE
 */
const DB_FILES = {
    products: path.resolve(DATA_ROOT, 'products.db.json'),
    analytics: path.resolve(DATA_ROOT, 'analytics.db.json'),
    config: path.resolve(DATA_ROOT, 'config.db.json'),
    staff: path.resolve(DATA_ROOT, 'staff.db.json'),
    customers: path.resolve(DATA_ROOT, 'customers.db.json'),
    designs: path.resolve(DATA_ROOT, 'designs.db.json')
};

let cache = {
    products: [],
    analytics: [],
    config: { suppliers: [], categories: [], linkExpiryHours: 24, whatsappNumber: '' },
    staff: [{ 
        id: 'staff-root', 
        username: 'admin', 
        password: 'admin', 
        role: 'admin', 
        isActive: true, 
        name: 'Sanghavi Admin', 
        createdAt: new Date().toISOString() 
    }],
    customers: [],
    designs: []
};

/**
 * STRICT IMAGE CARVER (Discards Base64, Writes Physical File)
 */
const extractAndSavePhysicalImage = async (base64, isThumbnail = false) => {
    if (!base64 || typeof base64 !== 'string' || !base64.startsWith('data:image')) {
        return base64; // Already a path or not an image
    }

    try {
        const match = base64.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
        if (!match) return base64;

        const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
        const data = match[2];
        const buffer = Buffer.from(data, 'base64');
        
        const fileName = `${crypto.randomUUID()}.${ext}`;
        const relativePath = isThumbnail ? `thumbnails/${fileName}` : fileName;
        const fullPath = path.resolve(UPLOADS_ROOT, relativePath);

        await fs.writeFile(fullPath, buffer);
        console.log(`[Vault] Asset Carved: /uploads/${relativePath}`);
        return `/uploads/${relativePath}`;
    } catch (err) {
        console.error('[Vault] Image Carving Failure:', err);
        return base64; // Fallback to prevent data loss
    }
};

/**
 * RECURSIVE VAULT CLEANER
 * Scans objects/arrays for Base64 and migrates them to disk.
 */
const migrateToPhysical = async (data) => {
    if (Array.isArray(data)) {
        for (let i = 0; i < data.length; i++) {
            data[i] = await migrateToPhysical(data[i]);
        }
    } else if (data && typeof data === 'object') {
        for (const key of Object.keys(data)) {
            if (typeof data[key] === 'string' && data[key].startsWith('data:image')) {
                const isThumb = key.toLowerCase().includes('thumb');
                data[key] = await extractAndSavePhysicalImage(data[key], isThumb);
            } else {
                data[key] = await migrateToPhysical(data[key]);
            }
        }
    }
    return data;
};

/**
 * ATOMIC WRITE PROTOCOL (PROTECTION AGAINST DATA LOSS)
 */
const atomicWrite = async (filePath, data) => {
    const tempPath = `${filePath}.tmp`;
    const fileName = path.basename(filePath);
    const backupPath = path.resolve(BACKUPS_ROOT, `${fileName}.${Date.now()}.bak`);
    
    try {
        const json = JSON.stringify(data, null, 2);
        
        // 1. Write Temp
        await fs.writeFile(tempPath, json, 'utf8');
        
        // 2. Verify integrity of temp file
        const checkContent = await fs.readFile(tempPath, 'utf8');
        JSON.parse(checkContent); // Will throw if corrupted
        
        // 3. Backup existing before commit
        if (existsSync(filePath)) {
            await fs.copyFile(filePath, backupPath);
        }
        
        // 4. Atomic Rename (Commit)
        await fs.rename(tempPath, filePath);
        
        // Cleanup old backups (keep last 5)
        const allBackups = (await fs.readdir(BACKUPS_ROOT))
            .filter(f => f.startsWith(fileName))
            .sort();
        if (allBackups.length > 5) {
            await fs.unlink(path.resolve(BACKUPS_ROOT, allBackups[0]));
        }
    } catch (err) {
        console.error(`[Vault] CRITICAL: Write failed for ${fileName}. Data preserved in cache.`, err);
        throw err;
    }
};

const loadAllTables = async () => {
    for (const [key, filePath] of Object.entries(DB_FILES)) {
        try {
            if (existsSync(filePath)) {
                const content = await fs.readFile(filePath, 'utf8');
                if (content.trim()) {
                    const data = JSON.parse(content);
                    // AUTO-MIGRATION: Clean up any base64 that slipped into JSON
                    cache[key] = await migrateToPhysical(data);
                    console.log(`[Vault] Synced & Cleaned Table: ${key} (${cache[key].length} records)`);
                    // If we found and cleaned images, persist the clean JSON immediately
                    if (content.includes('data:image')) {
                        console.log(`[Vault] Persisting cleaned JSON for ${key}`);
                        await saveTable(key);
                    }
                }
            } else {
                await atomicWrite(filePath, cache[key]);
                console.log(`[Vault] Initialized Table: ${key}`);
            }
        } catch (err) {
            console.error(`[Vault] Table Initialization Error (${key}):`, err);
        }
    }
};

const saveTable = async (key) => {
    await atomicWrite(DB_FILES[key], cache[key]);
};

loadAllTables();

/**
 * 4. API ENDPOINTS
 */
app.get('/api/health', (req, res) => res.json({ 
    status: 'online', 
    vault: 'sanghavi_persistence',
    integrity: 'atomic-protected',
    root: DATA_ROOT
}));

app.get('/api/products', (req, res) => res.json(cache.products));

app.post('/api/products', async (req, res) => {
    try {
        const cleanProduct = await migrateToPhysical(req.body);
        cache.products.push(cleanProduct);
        await saveTable('products');
        res.json(cleanProduct);
    } catch (err) {
        res.status(500).json({ error: 'Vault entry failed' });
    }
});

app.put('/api/products/:id', async (req, res) => {
    try {
        const idx = cache.products.findIndex(p => p.id === req.params.id);
        if (idx !== -1) {
            const cleanUpdate = await migrateToPhysical(req.body);
            cache.products[idx] = cleanUpdate;
            await saveTable('products');
            res.json(cleanUpdate);
        } else {
            res.status(404).json({ error: 'Not found' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Vault update failed' });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    // Physical files are NOT deleted to ensure no accidental asset loss.
    cache.products = cache.products.filter(p => p.id !== req.params.id);
    await saveTable('products');
    res.status(204).send();
});

// Config & Auth
app.get('/api/config', (req, res) => res.json(cache.config));
app.post('/api/config', async (req, res) => {
    cache.config = req.body;
    await saveTable('config');
    res.json(cache.config);
});

app.get('/api/customers', (req, res) => res.json(cache.customers));
app.post('/api/auth/whatsapp', async (req, res) => {
    const { phone } = req.body;
    let user = cache.customers.find(c => c.phone === phone);
    if (!user) {
        user = { 
            id: Date.now().toString(), 
            phone, 
            name: 'Client ' + phone.slice(-4), 
            role: 'customer', 
            createdAt: new Date().toISOString() 
        };
        cache.customers.push(user);
        await saveTable('customers');
    }
    res.json(user);
});

app.post('/api/auth/staff', (req, res) => {
    const { username, password } = req.body;
    const staff = cache.staff.find(s => s.username === username && s.password === password);
    if (staff && staff.isActive) res.json(staff);
    else res.status(401).json({ error: 'Authentication denied' });
});

app.get('/api/staff', (req, res) => res.json(cache.staff));
app.post('/api/staff', async (req, res) => {
    const staff = { ...req.body, id: Date.now().toString(), createdAt: new Date().toISOString() };
    cache.staff.push(staff);
    await saveTable('staff');
    res.json(staff);
});

app.get('/api/designs', (req, res) => res.json(cache.designs));
app.post('/api/designs', async (req, res) => {
    const cleanDesign = await migrateToPhysical(req.body);
    cache.designs.push(cleanDesign);
    await saveTable('designs');
    res.json(cleanDesign);
});

app.get('/api/analytics', (req, res) => res.json(cache.analytics));
app.post('/api/analytics', async (req, res) => {
    cache.analytics.push(req.body);
    await saveTable('analytics');
    res.status(204).send();
});

// Production Bundle
const distPath = path.resolve(__dirname, 'dist');
if (existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
            res.sendFile(path.join(distPath, 'index.html'));
        }
    });
}

app.listen(PORT, () => console.log(`[Vault Server] Active on port ${PORT}. Root: ${DATA_ROOT}`));
