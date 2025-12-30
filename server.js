
import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '100mb' }));

// Hostinger-compatible relative path for data persistence
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

const initStorage = () => {
    try {
        if (!fs.existsSync(persistenceDir)) {
            console.log('Creating persistence directory:', persistenceDir);
            fs.mkdirSync(persistenceDir, { recursive: true });
        }
        
        let db;
        if (!fs.existsSync(dbFile)) {
            console.log('Initializing new database file...');
            db = { 
                products: [], 
                analytics: [], 
                config: DEFAULT_CONFIG, 
                links: [], 
                staff: [DEFAULT_ADMIN] 
            };
            fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
        } else {
            console.log('Loading existing database...');
            const fileContent = fs.readFileSync(dbFile, 'utf8');
            db = JSON.parse(fileContent);
            
            let updated = false;

            // Migration: Ensure staff array exists
            if (!db.staff || !Array.isArray(db.staff) || db.staff.length === 0) {
                db.staff = [DEFAULT_ADMIN];
                updated = true;
            }

            // Migration: Ensure config exists
            if (!db.config) {
                db.config = DEFAULT_CONFIG;
                updated = true;
            }

            if (updated) {
                fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
            }
        }
    } catch (err) {
        console.error('FAILED TO INITIALIZE STORAGE:', err);
    }
};

initStorage();

const getDB = () => {
    try {
        const db = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
        // Fallback for missing fields in runtime
        return {
            products: db.products || [],
            analytics: db.analytics || [],
            config: db.config || DEFAULT_CONFIG,
            links: db.links || [],
            staff: db.staff || [DEFAULT_ADMIN]
        };
    } catch (e) {
        return { 
            products: [], 
            analytics: [], 
            config: DEFAULT_CONFIG, 
            links: [], 
            staff: [DEFAULT_ADMIN] 
        };
    }
};

const saveDB = (data) => fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));

// Logging Middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} | ${req.method} ${req.path}`);
    next();
});

// --- API ---
app.get('/api/health', (req, res) => res.json({ 
    status: 'online', 
    timestamp: new Date().toISOString(),
    persistence: fs.existsSync(dbFile) ? 'healthy' : 'missing'
}));

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const db = getDB();
    const staff = db.staff.find(s => s.username === username && s.password === password);

    if (!staff) return res.status(401).json({ error: 'Invalid credentials' });
    if (!staff.isActive) return res.status(403).json({ error: 'Account disabled' });

    res.json({ id: staff.id, name: staff.name, role: staff.role });
});

app.get('/api/products', (req, res) => res.json(getDB().products));
app.post('/api/products', (req, res) => {
    const db = getDB();
    db.products.push(req.body);
    saveDB(db);
    res.json(req.body);
});

app.put('/api/products/:id', (req, res) => {
    const db = getDB();
    const idx = db.products.findIndex(p => p.id === req.params.id);
    if (idx !== -1) {
        db.products[idx] = req.body;
        saveDB(db);
    }
    res.json({ success: true });
});

app.delete('/api/products/:id', (req, res) => {
    const db = getDB();
    db.products = db.products.filter(p => p.id !== req.params.id);
    saveDB(db);
    res.json({ success: true });
});

app.get('/api/config', (req, res) => {
    const db = getDB();
    res.json(db.config);
});

app.post('/api/config', (req, res) => {
    const db = getDB();
    db.config = req.body;
    saveDB(db);
    res.json(db.config);
});

app.get('/api/staff', (req, res) => res.json(getDB().staff.map(({password, ...s}) => s)));

// Serve Frontend
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) {
            res.sendFile(path.join(distPath, 'index.html'));
        }
    });
}

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
