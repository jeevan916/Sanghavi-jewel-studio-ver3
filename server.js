
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

// Root persistent storage path
const DATA_ROOT = path.resolve(__dirname, 'data');
const UPLOADS_ROOT = path.resolve(DATA_ROOT, 'uploads');
const THUMBS_ROOT = path.resolve(UPLOADS_ROOT, 'thumbnails');

// Guaranteed folder protection logic
[DATA_ROOT, UPLOADS_ROOT, THUMBS_ROOT].forEach(dir => {
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        console.log(`[Storage] Initialized secure directory: ${dir}`);
    }
});

// Serve physical uploads folder statically
app.use('/uploads', express.static(UPLOADS_ROOT));

// Database Files configuration - Split for maximum reliability
const DB_FILES = {
    products: path.resolve(DATA_ROOT, 'products.db.json'),
    analytics: path.resolve(DATA_ROOT, 'analytics.db.json'),
    config: path.resolve(DATA_ROOT, 'config.db.json'),
    staff: path.resolve(DATA_ROOT, 'staff.db.json'),
    customers: path.resolve(DATA_ROOT, 'customers.db.json'),
    designs: path.resolve(DATA_ROOT, 'designs.db.json')
};

const DEFAULT_ADMIN = { 
    id: 'staff-root', 
    username: 'admin', 
    password: 'admin', 
    role: 'admin', 
    isActive: true, 
    name: 'Sanghavi Admin', 
    createdAt: new Date().toISOString() 
};

// Internal Cache
let cache = {
    products: [],
    analytics: [],
    config: { suppliers: [], categories: [], linkExpiryHours: 24, whatsappNumber: '' },
    staff: [DEFAULT_ADMIN],
    customers: [],
    designs: []
};

// Load persistent tables from disk
const syncDatabase = async () => {
    for (const [key, filePath] of Object.entries(DB_FILES)) {
        try {
            if (existsSync(filePath)) {
                const content = await fs.readFile(filePath, 'utf8');
                cache[key] = JSON.parse(content);
            } else {
                await fs.writeFile(filePath, JSON.stringify(cache[key], null, 2), 'utf8');
            }
        } catch (err) {
            console.error(`[Database] Load error for ${key}:`, err);
        }
    }
    console.log('[Database] Securely loaded all persistent tables.');
};

const saveTable = async (key) => {
    try {
        await fs.writeFile(DB_FILES[key], JSON.stringify(cache[key], null, 2), 'utf8');
    } catch (err) {
        console.error(`[Database] Save error for ${key}:`, err);
    }
};

syncDatabase();

// File Save Helper (Saves Base64 to physical file)
const savePhysicalImage = async (base64, isThumbnail = false) => {
    if (!base64 || !base64.startsWith('data:')) return base64;
    
    try {
        const [meta, data] = base64.split('base64,');
        const extension = meta.split('/')[1].split(';')[0] || 'jpg';
        const buffer = Buffer.from(data, 'base64');
        const fileName = `${crypto.randomUUID()}.${extension}`;
        const relativePath = isThumbnail ? `thumbnails/${fileName}` : fileName;
        const fullPath = path.resolve(UPLOADS_ROOT, relativePath);
        
        await fs.writeFile(fullPath, buffer);
        return `/uploads/${relativePath}`;
    } catch (err) {
        console.error('[Storage] Image write failure:', err);
        return null;
    }
};

// --- API ENDPOINTS ---

app.get('/api/health', (req, res) => res.json({ status: 'online', storage: 'filesystem-protected' }));

// Products Management
app.get('/api/products', (req, res) => res.json(cache.products));

app.post('/api/products', async (req, res) => {
    const product = req.body;
    
    // Convert base64 to physical paths before database entry
    if (product.images) {
        const paths = [];
        for (const img of product.images) {
            const p = await savePhysicalImage(img, false);
            if (p) paths.push(p);
        }
        product.images = paths;
    }
    
    if (product.thumbnails) {
        const paths = [];
        for (const t of product.thumbnails) {
            const p = await savePhysicalImage(t, true);
            if (p) paths.push(p);
        }
        product.thumbnails = paths;
    }

    cache.products.push(product);
    await saveTable('products');
    res.json(product);
});

app.put('/api/products/:id', async (req, res) => {
    const index = cache.products.findIndex(p => p.id === req.params.id);
    if (index !== -1) {
        cache.products[index] = { ...cache.products[index], ...req.body };
        await saveTable('products');
        res.json(cache.products[index]);
    } else {
        res.status(404).json({ error: 'Product not found' });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    cache.products = cache.products.filter(p => p.id !== req.params.id);
    await saveTable('products');
    res.status(204).send();
});

// Customer Leads API
app.get('/api/customers', (req, res) => res.json(cache.customers));

app.post('/api/auth/whatsapp', async (req, res) => {
    const { phone } = req.body;
    let user = cache.customers.find(c => c.phone === phone);
    if (!user) {
        user = { 
            id: Date.now().toString(), 
            phone, 
            name: 'Guest ' + phone.slice(-4), 
            role: 'customer', 
            createdAt: new Date().toISOString() 
        };
        cache.customers.push(user);
        await saveTable('customers');
    }
    res.json(user);
});

// Auth & Admin API
app.post('/api/auth/staff', (req, res) => {
    const { username, password } = req.body;
    const staff = cache.staff.find(s => s.username === username && s.password === password);
    if (staff && staff.isActive) res.json(staff);
    else res.status(401).json({ error: 'Invalid credentials' });
});

app.get('/api/config', (req, res) => res.json(cache.config));
app.post('/api/config', async (req, res) => {
    cache.config = req.body;
    await saveTable('config');
    res.json(cache.config);
});

app.get('/api/analytics', (req, res) => res.json(cache.analytics));
app.post('/api/analytics', async (req, res) => {
    cache.analytics.push(req.body);
    await saveTable('analytics');
    res.status(204).send();
});

// App Delivery
const distPath = path.resolve(__dirname, 'dist');
if (existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
            res.sendFile(path.join(distPath, 'index.html'));
        }
    });
}

app.listen(PORT, () => console.log(`[Server] Sanghavi Studio active on port ${PORT}`));
