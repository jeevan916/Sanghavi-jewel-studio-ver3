
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

const persistenceDir = path.join(__dirname, 'data');
const dbFile = path.join(persistenceDir, 'db.json');

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

// State Cache to avoid excessive Disk I/O
let dbCache = null;

const initStorage = async () => {
    try {
        if (!existsSync(persistenceDir)) {
            await fs.mkdir(persistenceDir, { recursive: true });
        }
        
        if (!existsSync(dbFile)) {
            dbCache = { products: [], analytics: [], config: DEFAULT_CONFIG, links: [], staff: [DEFAULT_ADMIN] };
            await saveDB();
        } else {
            const fileContent = await fs.readFile(dbFile, 'utf8');
            dbCache = JSON.parse(fileContent);
            
            // Ensure schema integrity
            dbCache.products = dbCache.products || [];
            dbCache.analytics = dbCache.analytics || [];
            dbCache.config = dbCache.config || DEFAULT_CONFIG;
            dbCache.links = dbCache.links || [];
            dbCache.staff = dbCache.staff || [DEFAULT_ADMIN];
        }
    } catch (err) {
        console.error('CRITICAL: STORAGE INIT FAILED', err);
        process.exit(1);
    }
};

const saveDB = async () => {
    try {
        const tempPath = `${dbFile}.tmp`;
        await fs.writeFile(tempPath, JSON.stringify(dbCache, null, 2), 'utf8');
        await fs.rename(tempPath, dbFile); // Atomic rename
    } catch (err) {
        console.error('DB SAVE ERROR:', err);
    }
};

// Initialize before starting server
await initStorage();

// --- API ---
app.get('/api/health', (req, res) => res.json({ status: 'online', uptime: process.uptime() }));

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const staff = dbCache.staff.find(s => s.username === username && s.password === password);
    if (!staff) return res.status(401).json({ error: 'Invalid credentials' });
    if (!staff.isActive) return res.status(403).json({ error: 'Account disabled' });
    res.json({ id: staff.id, name: staff.name, role: staff.role });
});

app.get('/api/products', (req, res) => res.json(dbCache.products));
app.post('/api/products', async (req, res) => {
    dbCache.products.push(req.body);
    await saveDB();
    res.json(req.body);
});

app.put('/api/products/:id', async (req, res) => {
    const idx = dbCache.products.findIndex(p => p.id === req.params.id);
    if (idx !== -1) {
        dbCache.products[idx] = req.body;
        await saveDB();
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Not found' });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    dbCache.products = dbCache.products.filter(p => p.id !== req.params.id);
    await saveDB();
    res.json({ success: true });
});

app.get('/api/config', (req, res) => res.json(dbCache.config));
app.post('/api/config', async (req, res) => {
    dbCache.config = req.body;
    await saveDB();
    res.json(dbCache.config);
});

app.get('/api/staff', (req, res) => res.json(dbCache.staff.map(({password, ...s}) => s)));

app.post('/api/analytics', async (req, res) => {
    dbCache.analytics.push(req.body);
    // Keep analytics lean
    if (dbCache.analytics.length > 5000) dbCache.analytics.shift();
    await saveDB();
    res.json({ success: true });
});

// Serve Frontend
const distPath = path.join(__dirname, 'dist');
if (existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) {
            res.sendFile(path.join(distPath, 'index.html'));
        }
    });
}

app.listen(PORT, () => console.log(`[ Sanghavi ] Optimized Server on port ${PORT}`));
