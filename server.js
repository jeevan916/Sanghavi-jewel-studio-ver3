
import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
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
 * Root folder: sanghavi_persistence
 */
const DATA_ROOT = path.resolve(__dirname, 'sanghavi_persistence');
const UPLOADS_ROOT = path.resolve(DATA_ROOT, 'uploads');
const THUMBS_ROOT = path.resolve(UPLOADS_ROOT, 'thumbnails');
const BACKUPS_ROOT = path.resolve(DATA_ROOT, 'backups');

const initializeDirectories = () => {
    [DATA_ROOT, UPLOADS_ROOT, THUMBS_ROOT, BACKUPS_ROOT].forEach(dir => {
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
            console.log(`[Vault] Created Secure Directory: ${dir}`);
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
        
        // 2. Verify Temp is valid JSON
        const check = JSON.parse(await fs.readFile(tempPath, 'utf8'));
        
        // 3. Backup existing
        if (existsSync(filePath)) {
            await fs.copyFile(filePath, backupPath);
        }
        
        // 4. Commit
        await fs.rename(tempPath, filePath);
        
        // Cleanup old backups (keep last 5)
        const allBackups = (await fs.readdir(BACKUPS_ROOT))
            .filter(f => f.startsWith(fileName))
            .sort();
        if (allBackups.length > 5) {
            await fs.unlink(path.resolve(BACKUPS_ROOT, allBackups[0]));
        }
    } catch (err) {
        console.error(`[Vault] CRITICAL: Write failed for ${fileName}. Data preserved in memory.`, err);
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
                    console.log(`[Vault] Synchronized Table: ${key} (${cache[key].length} records)`);
                }
            } else {
                await atomicWrite(filePath, cache[key]);
            }
        } catch (err) {
            console.error(`[Vault] Table Load Error (${key}):`, err);
        }
    }
};

const saveTable = async (key) => {
    await atomicWrite(DB_FILES[key], cache[key]);
};

loadAllTables();

/**
 * 3. STRICT IMAGE CARVER
 * This function is the primary protector. It strips base64 and writes to disk.
 */
const extractAndSavePhysicalImage = async (base64, isThumbnail = false) => {
    if (!base64 || !base64.startsWith('data:image')) {
        return base64; // Already a path or invalid
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
        console.log(`[Vault] Asset Carved to Disk: /uploads/${relativePath}`);
        return `/uploads/${relativePath}`;
    } catch (err) {
        console.error('[Vault] Image Carving Failed:', err);
        return base64; // Fallback to base64 to prevent loss, though not ideal
    }
};

const processProductAssets = async (product) => {
    const updated = { ...product };
    
    if (updated.images) {
        const paths = [];
        for (const img of updated.images) {
            paths.push(await extractAndSavePhysicalImage(img, false));
        }
        updated.images = paths;
    }

    if (updated.thumbnails) {
        const tPaths = [];
        for (const thumb of updated.thumbnails) {
            tPaths.push(await extractAndSavePhysicalImage(thumb, true));
        }
        updated.thumbnails = tPaths;
    }
    
    return updated;
};

/**
 * 4. API ENDPOINTS
 */
app.get('/api/health', (req, res) => res.json({ 
    status: 'online', 
    vault: 'sanghavi_persistence',
    integrity: 'atomic-protected'
}));

app.get('/api/products', (req, res) => res.json(cache.products));

app.post('/api/products', async (req, res) => {
    try {
        const productWithPaths = await processProductAssets(req.body);
        cache.products.push(productWithPaths);
        await saveTable('products');
        res.json(productWithPaths);
    } catch (err) {
        res.status(500).json({ error: 'Vault entry failed' });
    }
});

app.put('/api/products/:id', async (req, res) => {
    try {
        const idx = cache.products.findIndex(p => p.id === req.params.id);
        if (idx !== -1) {
            const updatedWithPaths = await processProductAssets(req.body);
            cache.products[idx] = updatedWithPaths;
            await saveTable('products');
            res.json(updatedWithPaths);
        } else {
            res.status(404).json({ error: 'Not found' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Vault update failed' });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    cache.products = cache.products.filter(p => p.id !== req.params.id);
    await saveTable('products');
    res.status(204).send();
});

// Auth & Config Endpoints
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
    const design = await processProductAssets({ images: [req.body.imageUrl], thumbnails: [req.body.imageUrl] });
    const finalDesign = { ...req.body, imageUrl: design.images[0] };
    cache.designs.push(finalDesign);
    await saveTable('designs');
    res.json(finalDesign);
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

app.listen(PORT, () => console.log(`[Vault Server] Active on port ${PORT}. Persistence Root: ${DATA_ROOT}`));
