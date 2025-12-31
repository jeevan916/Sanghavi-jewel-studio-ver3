
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
 * Renamed to match your existing server folder: sanghavi_persistence
 * All paths are absolute to ensure stability across different execution contexts.
 */
const DATA_ROOT = path.resolve(__dirname, 'sanghavi_persistence');
const UPLOADS_ROOT = path.resolve(DATA_ROOT, 'uploads');
const THUMBS_ROOT = path.resolve(UPLOADS_ROOT, 'thumbnails');
const BACKUPS_ROOT = path.resolve(DATA_ROOT, 'backups');

const initializeDirectories = () => {
    [DATA_ROOT, UPLOADS_ROOT, THUMBS_ROOT, BACKUPS_ROOT].forEach(dir => {
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
            console.log(`[Persistence] Initialized secure directory: ${dir}`);
        }
    });
};
initializeDirectories();

app.use('/uploads', express.static(UPLOADS_ROOT));

/**
 * 2. SEGMENTED DATABASE ARCHITECTURE
 * These files represent the primary state of the studio.
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
 * ATOMIC WRITE PROTOCOL
 * Prevents data loss during server crashes or concurrent writes.
 * 1. Write to temporary file.
 * 2. Create timestamped backup.
 * 3. Verify integrity.
 * 4. Rename temp to final.
 */
const atomicWrite = async (filePath, data) => {
    const tempPath = `${filePath}.tmp`;
    const fileName = path.basename(filePath);
    const backupPath = path.resolve(BACKUPS_ROOT, `${fileName}.${new Date().toISOString().replace(/[:.]/g, '-')}.bak`);
    
    try {
        const json = JSON.stringify(data, null, 2);
        // Step 1: Write temporary file
        await fs.writeFile(tempPath, json, 'utf8');
        
        // Step 2: Verification (Check if file actually exists and has size)
        const stats = await fs.stat(tempPath);
        if (stats.size === 0 && data.length > 0) {
            throw new Error(`[Persistence] Guard blocked zero-byte write for ${fileName}`);
        }

        // Step 3: Create backup of current file
        if (existsSync(filePath)) {
            await fs.copyFile(filePath, backupPath);
            // Limit backups: Keep only last 10 versions
            const allFiles = await fs.readdir(BACKUPS_ROOT);
            const tableBackups = allFiles.filter(f => f.startsWith(fileName)).sort();
            if (tableBackups.length > 10) {
                await fs.unlink(path.resolve(BACKUPS_ROOT, tableBackups[0]));
            }
        }
        
        // Step 4: Finalize
        await fs.rename(tempPath, filePath);
    } catch (err) {
        console.error(`[Persistence] CRITICAL ERROR WRITING ${fileName}:`, err);
        throw err;
    }
};

const loadAllTables = async () => {
    for (const [key, filePath] of Object.entries(DB_FILES)) {
        try {
            if (existsSync(filePath)) {
                const content = await fs.readFile(filePath, 'utf8');
                if (content.trim()) {
                    cache[key] = JSON.parse(content);
                }
            } else {
                await atomicWrite(filePath, cache[key]);
            }
        } catch (err) {
            console.error(`[Persistence] Error loading ${key}:`, err);
        }
    }
    console.log(`[Persistence] Vault synchronization complete at: ${DATA_ROOT}`);
};

const saveTable = async (key) => {
    try {
        await atomicWrite(DB_FILES[key], cache[key]);
    } catch (err) {
        console.error(`[Persistence] Failed to persist ${key} table!`, err);
    }
};

loadAllTables();

/**
 * 3. INTELLIGENT IMAGE PROCESSOR
 * Converts Base64 from the client into physical files on the server disk.
 * Skips processing if the image is already a physical path to prevent redundancy.
 */
const processIncomingImages = async (product) => {
    const updatedProduct = { ...product };
    
    const writeBase64ToFile = async (base64, isThumbnail = false) => {
        // If it's already a relative path (/uploads/...), do not touch it.
        if (!base64 || !base64.startsWith('data:')) return base64; 
        
        try {
            const [meta, data] = base64.split('base64,');
            const extensionMatch = meta.match(/\/(.*?);/);
            const extension = extensionMatch ? extensionMatch[1] : 'jpg';
            const buffer = Buffer.from(data, 'base64');
            
            // Use unique filenames to prevent collisions
            const fileName = `${crypto.randomUUID()}.${extension}`;
            const relativePath = isThumbnail ? `thumbnails/${fileName}` : fileName;
            const fullPath = path.resolve(UPLOADS_ROOT, relativePath);
            
            await fs.writeFile(fullPath, buffer);
            return `/uploads/${relativePath}`;
        } catch (err) {
            console.error('[Persistence] Image Write Failure:', err);
            return null; // Keep original if write fails to prevent data loss
        }
    };

    // Protect main assets
    if (updatedProduct.images && Array.isArray(updatedProduct.images)) {
        const physicalPaths = [];
        for (const img of updatedProduct.images) {
            const saved = await writeBase64ToFile(img, false);
            if (saved) physicalPaths.push(saved);
            else physicalPaths.push(img); // Fallback to original if save failed
        }
        updatedProduct.images = physicalPaths;
    }
    
    // Protect thumbnails
    if (updatedProduct.thumbnails && Array.isArray(updatedProduct.thumbnails)) {
        const physicalThumbPaths = [];
        for (const thumb of updatedProduct.thumbnails) {
            const saved = await writeBase64ToFile(thumb, true);
            if (saved) physicalThumbPaths.push(saved);
            else physicalThumbPaths.push(thumb); // Fallback
        }
        updatedProduct.thumbnails = physicalThumbPaths;
    }
    
    return updatedProduct;
};

// 4. API ENDPOINTS
app.get('/api/health', (req, res) => res.json({ 
    status: 'online', 
    mode: 'sanghavi-biometric-secure',
    storagePath: DATA_ROOT 
}));

app.get('/api/products', (req, res) => res.json(cache.products));

app.post('/api/products', async (req, res) => {
    try {
        const processedProduct = await processIncomingImages(req.body);
        cache.products.push(processedProduct);
        await saveTable('products');
        res.json(processedProduct);
    } catch (err) {
        res.status(500).json({ error: 'Asset processing failed.' });
    }
});

app.put('/api/products/:id', async (req, res) => {
    try {
        const index = cache.products.findIndex(p => p.id === req.params.id);
        if (index !== -1) {
            const processedUpdate = await processIncomingImages(req.body);
            cache.products[index] = { ...cache.products[index], ...processedUpdate };
            await saveTable('products');
            res.json(cache.products[index]);
        } else {
            res.status(404).json({ error: 'Item not found in vault.' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Update protocol failure.' });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    // Note: This only removes the record from the database. 
    // It does not delete physical files to ensure absolute auditability and recovery.
    cache.products = cache.products.filter(p => p.id !== req.params.id);
    await saveTable('products');
    res.status(204).send();
});

// REMAINING ENDPOINTS
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
        user = { id: Date.now().toString(), phone, name: 'Guest ' + phone.slice(-4), role: 'customer', createdAt: new Date().toISOString() };
        cache.customers.push(user);
        await saveTable('customers');
    }
    res.json(user);
});

app.get('/api/designs', (req, res) => res.json(cache.designs));
app.post('/api/designs', async (req, res) => {
    cache.designs.push(req.body);
    await saveTable('designs');
    res.json(req.body);
});

app.post('/api/auth/staff', (req, res) => {
    const { username, password } = req.body;
    const staff = cache.staff.find(s => s.username === username && s.password === password);
    if (staff && staff.isActive) res.json(staff);
    else res.status(401).json({ error: 'Auth failed' });
});

app.get('/api/staff', (req, res) => res.json(cache.staff));
app.post('/api/staff', async (req, res) => {
    const staff = { ...req.body, id: Date.now().toString() };
    cache.staff.push(staff);
    await saveTable('staff');
    res.json(staff);
});

app.put('/api/staff/:id', async (req, res) => {
    const index = cache.staff.findIndex(s => s.id === req.params.id);
    if (index !== -1) {
        cache.staff[index] = { ...cache.staff[index], ...req.body };
        await saveTable('staff');
        res.json(cache.staff[index]);
    } else res.status(404).json({ error: 'Staff not found' });
});

app.get('/api/analytics', (req, res) => res.json(cache.analytics));
app.post('/api/analytics', async (req, res) => {
    cache.analytics.push(req.body);
    await saveTable('analytics');
    res.status(204).send();
});

// Production Bundle Delivery
const distPath = path.resolve(__dirname, 'dist');
if (existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
            res.sendFile(path.join(distPath, 'index.html'));
        }
    });
}

app.listen(PORT, () => console.log(`[Persistence Server] Sanghavi Studio active on http://localhost:${PORT}`));
