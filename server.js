
import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import cors from 'cors';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '100mb' }));

// Use a predictable path for the database file
const persistenceDir = path.resolve(__dirname, 'data');
const dbFile = path.resolve(persistenceDir, 'db.json');

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

// Fix: Extended dbCache to include all necessary data collections
let dbCache = { products: [], analytics: [], config: DEFAULT_CONFIG, links: [], staff: [DEFAULT_ADMIN], designs: [], customers: [] };

const initStorage = async () => {
    try {
        if (!existsSync(persistenceDir)) {
            await fs.mkdir(persistenceDir, { recursive: true });
            console.log('[Server] Created data directory at:', persistenceDir);
        }
        
        if (!existsSync(dbFile)) {
            await fs.writeFile(dbFile, JSON.stringify(dbCache, null, 2), 'utf8');
            console.log('[Server] Initialized new db.json');
        } else {
            const fileContent = await fs.readFile(dbFile, 'utf8');
            const parsed = JSON.parse(fileContent);
            dbCache = { ...dbCache, ...parsed };
            console.log('[Server] Loaded existing database');
        }
    } catch (err) {
        console.error('[Server] Storage initialization failed:', err);
    }
};

const saveDB = async () => {
    try {
        await fs.writeFile(dbFile, JSON.stringify(dbCache, null, 2), 'utf8');
    } catch (err) {
        console.error('[Server] DB Save Error:', err);
    }
};

// Start initialization
initStorage();

// Endpoints
app.get('/api/health', (req, res) => res.json({ 
    status: 'online', 
    dbReady: existsSync(dbFile),
    timestamp: new Date().toISOString() 
}));

app.get('/api/products', (req, res) => res.json(dbCache.products || []));

app.post('/api/products', async (req, res) => {
    dbCache.products.push(req.body);
    await saveDB();
    res.json(req.body);
});

// Fix: Added products update and delete endpoints
app.put('/api/products/:id', async (req, res) => {
    const index = dbCache.products.findIndex(p => p.id === req.params.id);
    if (index !== -1) {
        dbCache.products[index] = { ...dbCache.products[index], ...req.body };
        await saveDB();
        res.json(dbCache.products[index]);
    } else {
        res.status(404).json({ error: 'Product not found' });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    dbCache.products = dbCache.products.filter(p => p.id !== req.params.id);
    await saveDB();
    res.status(204).send();
});

// Fix: Added designs endpoints
app.get('/api/designs', (req, res) => res.json(dbCache.designs || []));
app.post('/api/designs', async (req, res) => {
    dbCache.designs.push(req.body);
    await saveDB();
    res.json(req.body);
});

app.get('/api/config', (req, res) => res.json(dbCache.config));
app.post('/api/config', async (req, res) => {
    dbCache.config = req.body;
    await saveDB();
    res.json(dbCache.config);
});

// Fix: Added analytics retrieval
app.get('/api/analytics', (req, res) => res.json(dbCache.analytics || []));
app.post('/api/analytics', async (req, res) => {
    dbCache.analytics.push(req.body);
    if (dbCache.analytics.length > 5000) dbCache.analytics.shift();
    await saveDB();
    res.status(204).send();
});

// Fix: Added staff management endpoints
app.get('/api/staff', (req, res) => res.json(dbCache.staff || []));
app.post('/api/staff', async (req, res) => {
    const newStaff = { id: Date.now().toString(), ...req.body };
    dbCache.staff.push(newStaff);
    await saveDB();
    res.json(newStaff);
});
app.put('/api/staff/:id', async (req, res) => {
    const index = dbCache.staff.findIndex(s => s.id === req.params.id);
    if (index !== -1) {
        dbCache.staff[index] = { ...dbCache.staff[index], ...req.body };
        await saveDB();
        res.json(dbCache.staff[index]);
    } else {
        res.status(404).json({ error: 'Staff not found' });
    }
});
app.delete('/api/staff/:id', async (req, res) => {
    dbCache.staff = dbCache.staff.filter(s => s.id !== req.params.id);
    await saveDB();
    res.status(204).send();
});

// Fix: Added authentication endpoints
app.post('/api/auth/whatsapp', async (req, res) => {
    const { phone } = req.body;
    let user = dbCache.customers.find(c => c.phone === phone);
    if (!user) {
        user = { id: Date.now().toString(), phone, name: 'Customer ' + phone.slice(-4), role: 'customer' };
        dbCache.customers.push(user);
        await saveDB();
    }
    res.json(user);
});

app.post('/api/auth/google', async (req, res) => {
    const user = { id: 'google-' + Date.now(), name: 'Google User', role: 'customer' };
    res.json(user);
});

app.post('/api/auth/staff', async (req, res) => {
    const { username, password } = req.body;
    const staff = dbCache.staff.find(s => s.username === username && s.password === password);
    if (staff && staff.isActive) {
        res.json(staff);
    } else {
        res.status(401).json({ error: 'Invalid credentials or inactive account' });
    }
});

app.post('/api/auth/update', async (req, res) => {
    const index = dbCache.customers.findIndex(c => c.id === req.body.id);
    if (index !== -1) {
        dbCache.customers[index] = { ...dbCache.customers[index], ...req.body };
        await saveDB();
        res.json(dbCache.customers[index]);
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});

// Fix: Added links management
app.post('/api/links', async (req, res) => {
    const link = { id: Date.now().toString(), ...req.body, token: Math.random().toString(36).substring(7) };
    dbCache.links.push(link);
    await saveDB();
    res.json(link);
});

// Serve Frontend
const distPath = path.resolve(__dirname, 'dist');
if (existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) {
            res.sendFile(path.join(distPath, 'index.html'));
        }
    });
}

// Global error handler
process.on('uncaughtException', (err) => {
    console.error('[Server] Uncaught Exception:', err);
});

app.listen(PORT, () => console.log(`[Server] Sanghavi Studio active on port ${PORT}`));
