
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

// Base directory for persistent data
const DATA_ROOT = path.resolve(__dirname, 'data');
const UPLOADS_ROOT = path.resolve(DATA_ROOT, 'uploads');
const THUMBS_ROOT = path.resolve(UPLOADS_ROOT, 'thumbnails');

// Ensure folder structure exists
[DATA_ROOT, UPLOADS_ROOT, THUMBS_ROOT].forEach(dir => {
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        console.log(`[Server] Created directory: ${dir}`);
    }
});

// Serve the uploads folder statically
app.use('/uploads', express.static(UPLOADS_ROOT));

// Database Files configuration
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

const DEFAULT_CONFIG = {
    suppliers: [{ id: '1', name: 'Sanghavi In-House', isPrivate: false }],
    categories: [{ id: 'c1', name: 'Necklace', subCategories: ['Choker'], isPrivate: false }],
    linkExpiryHours: 24,
    whatsappNumber: ''
};

// Internal Cache
let cache = {
    products: [],
    analytics: [],
    config: DEFAULT_CONFIG,
    staff: [DEFAULT_ADMIN],
    customers: [],
    designs: []
};

// Persistent Storage Helpers
const loadTable = async (key) => {
    const filePath = DB_FILES[key];
    try {
        if (existsSync(filePath)) {
            const content = await fs.readFile(filePath, 'utf8');
            cache[key] = JSON.parse(content);
        } else {
            await fs.writeFile(filePath, JSON.stringify(cache[key], null, 2), 'utf8');
        }
    } catch (err) {
        console.error(`[Server] Error loading ${key}:`, err);
    }
};

const saveTable = async (key) => {
    try {
        await fs.writeFile(DB_FILES[key], JSON.stringify(cache[key], null, 2), 'utf8');
    } catch (err) {
        console.error(`[Server] Error saving ${key}:`, err);
    }
};

// Initialize all tables
const initDatabase = async () => {
    for (const key of Object.keys(DB_FILES)) {
        await loadTable(key);
    }
    console.log('[Server] All database files synchronized.');
};

initDatabase();

// Image Processing Helper
const saveBase64Image = async (base64String, isThumbnail = false) => {
    if (!base64String || !base64String.includes('base64,')) return base64String;
    
    try {
        const [meta, data] = base64String.split('base64,');
        const extension = meta.split('/')[1].split(';')[0] || 'jpg';
        const buffer = Buffer.from(data, 'base64');
        const fileName = `${crypto.randomUUID()}.${extension}`;
        const relativePath = isThumbnail ? `thumbnails/${fileName}` : fileName;
        const fullPath = path.resolve(UPLOADS_ROOT, relativePath);
        
        await fs.writeFile(fullPath, buffer);
        return `/uploads/${relativePath}`;
    } catch (err) {
        console.error('[Server] Image save failed:', err);
        return null;
    }
};

// --- API ENDPOINTS ---

app.get('/api/health', (req, res) => res.json({ 
    status: 'online', 
    storage: 'filesystem',
    timestamp: new Date().toISOString() 
}));

// Products API
app.get('/api/products', (req, res) => res.json(cache.products));

app.post('/api/products', async (req, res) => {
    const product = req.body;
    
    // Process main images
    if (product.images && Array.isArray(product.images)) {
        const savedImages = [];
        for (const img of product.images) {
            const path = await saveBase64Image(img, false);
            if (path) savedImages.push(path);
        }
        product.images = savedImages;
    }
    
    // Process thumbnails
    if (product.thumbnails && Array.isArray(product.thumbnails)) {
        const savedThumbs = [];
        for (const thumb of product.thumbnails) {
            const path = await saveBase64Image(thumb, true);
            if (path) savedThumbs.push(path);
        }
        product.thumbnails = savedThumbs;
    }

    cache.products.push(product);
    await saveTable('products');
    res.json(product);
});

app.put('/api/products/:id', async (req, res) => {
    const index = cache.products.findIndex(p => p.id === req.params.id);
    if (index !== -1) {
        // If updating images, we'd process them here too if they are base64
        const updated = { ...cache.products[index], ...req.body };
        cache.products[index] = updated;
        await saveTable('products');
        res.json(updated);
    } else {
        res.status(404).json({ error: 'Product not found' });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    const product = cache.products.find(p => p.id === req.params.id);
    if (product) {
        // Optional: Delete physical files here to save space
        cache.products = cache.products.filter(p => p.id !== req.params.id);
        await saveTable('products');
    }
    res.status(204).send();
});

// Config API
app.get('/api/config', (req, res) => res.json(cache.config));
app.post('/api/config', async (req, res) => {
    cache.config = req.body;
    await saveTable('config');
    res.json(cache.config);
});

// Analytics API
app.get('/api/analytics', (req, res) => res.json(cache.analytics));
app.post('/api/analytics', async (req, res) => {
    cache.analytics.push(req.body);
    if (cache.analytics.length > 5000) cache.analytics.shift();
    await saveTable('analytics');
    res.status(204).send();
});

// Staff API
app.get('/api/staff', (req, res) => res.json(cache.staff));
app.post('/api/staff', async (req, res) => {
    const newStaff = { id: Date.now().toString(), ...req.body };
    cache.staff.push(newStaff);
    await saveTable('staff');
    res.json(newStaff);
});
app.put('/api/staff/:id', async (req, res) => {
    const index = cache.staff.findIndex(s => s.id === req.params.id);
    if (index !== -1) {
        cache.staff[index] = { ...cache.staff[index], ...req.body };
        await saveTable('staff');
        res.json(cache.staff[index]);
    } else {
        res.status(404).json({ error: 'Staff not found' });
    }
});
app.delete('/api/staff/:id', async (req, res) => {
    cache.staff = cache.staff.filter(s => s.id !== req.params.id);
    await saveTable('staff');
    res.status(204).send();
});

// Customers API
app.get('/api/customers', (req, res) => res.json(cache.customers));
app.post('/api/auth/whatsapp', async (req, res) => {
    const { phone } = req.body;
    let user = cache.customers.find(c => c.phone === phone);
    if (!user) {
        user = { id: Date.now().toString(), phone, name: 'Customer ' + phone.slice(-4), role: 'customer', createdAt: new Date().toISOString() };
        cache.customers.push(user);
        await saveTable('customers');
    }
    res.json(user);
});

app.post('/api/auth/staff', async (req, res) => {
    const { username, password } = req.body;
    const staff = cache.staff.find(s => s.username === username && s.password === password);
    if (staff && staff.isActive) {
        res.json(staff);
    } else {
        res.status(401).json({ error: 'Invalid credentials or inactive account' });
    }
});

// Design Concepts API
app.get('/api/designs', (req, res) => res.json(cache.designs));
app.post('/api/designs', async (req, res) => {
    const design = req.body;
    const path = await saveBase64Image(design.imageUrl, false);
    if (path) design.imageUrl = path;
    cache.designs.push(design);
    await saveTable('designs');
    res.json(design);
});

// Static App Serving
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
