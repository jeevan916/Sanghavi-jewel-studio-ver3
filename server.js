
import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import os from 'os';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Permissive CORS for local network access
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

const persistenceDir = path.join(os.homedir(), 'sanghavi_persistence');
const uploadsDir = path.join(persistenceDir, 'uploads');
const dbFile = path.join(persistenceDir, 'db.json');

const DEFAULT_ADMIN = { 
    id: 'admin-default', 
    username: 'admin', 
    password: 'admin', 
    role: 'admin', 
    isActive: true, 
    name: 'System Admin', 
    createdAt: new Date().toISOString() 
};

const initStorage = () => {
    try {
        if (!fs.existsSync(persistenceDir)) fs.mkdirSync(persistenceDir, { recursive: true });
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
        
        let db;
        if (!fs.existsSync(dbFile)) {
            db = { products: [], analytics: [], config: null, links: [], staff: [DEFAULT_ADMIN] };
            console.log("DB: Initialized fresh database.");
        } else {
            const data = fs.readFileSync(dbFile, 'utf8');
            try {
                db = JSON.parse(data);
                if (!db.products) db.products = [];
                if (!db.staff) db.staff = [];
                
                // CRITICAL: Ensure at least one admin exists and is active
                const activeAdmin = db.staff.find(s => s.role === 'admin' && s.isActive);
                if (!activeAdmin) {
                    console.warn("DB WARNING: No active admin found! Forcing 'admin/admin' reset.");
                    const existingAdmin = db.staff.find(s => s.username === 'admin');
                    if (existingAdmin) {
                        existingAdmin.isActive = true;
                        existingAdmin.role = 'admin';
                        existingAdmin.password = 'admin'; 
                    } else {
                        db.staff.push(DEFAULT_ADMIN);
                    }
                }
            } catch (e) {
                console.error("DB ERROR: Corrupt JSON. Resetting to defaults.");
                db = { products: [], analytics: [], config: null, links: [], staff: [DEFAULT_ADMIN] };
            }
        }
        fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
    } catch (err) {
        console.error(`DB: Critical Storage Failure:`, err);
    }
};

initStorage();

// Static file serving
app.use('/api/uploads', express.static(uploadsDir, { maxAge: '7d', immutable: true }));

const getDB = () => {
    try {
        const data = fs.readFileSync(dbFile, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return { products: [], analytics: [], config: null, links: [], staff: [] };
    }
};

const saveDB = (data) => {
    try {
        fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
        return true;
    } catch (e) { throw e; }
};

// --- API ROUTES ---

app.get('/api/health', (req, res) => res.json({ 
    status: 'online', 
    dbConnected: fs.existsSync(dbFile),
    staffCount: getDB().staff.length 
}));

app.get('/api/products', (req, res) => res.json(getDB().products || []));

app.post('/api/products', (req, res) => {
    const product = req.body;
    const db = getDB();
    db.products.push(product);
    saveDB(db);
    res.status(201).json(product);
});

app.put('/api/products/:id', (req, res) => {
    const { id } = req.params;
    const db = getDB();
    const index = db.products.findIndex(p => String(p.id) === String(id));
    if (index === -1) return res.status(404).json({ error: 'Not found' });
    db.products[index] = req.body;
    saveDB(db);
    res.json(db.products[index]);
});

app.delete('/api/products/:id', (req, res) => {
    const { id } = req.params;
    const db = getDB();
    db.products = db.products.filter(p => String(p.id) !== String(id));
    saveDB(db);
    res.json({ success: true });
});

app.get('/api/config', (req, res) => res.json(getDB().config));
app.post('/api/config', (req, res) => {
    const db = getDB();
    db.config = req.body;
    saveDB(db);
    res.json(db.config);
});

app.get('/api/staff', (req, res) => res.json(getDB().staff || []));

app.post('/api/staff', (req, res) => {
    const db = getDB();
    const newStaff = { ...req.body, id: Date.now().toString(), createdAt: new Date().toISOString() };
    db.staff.push(newStaff);
    saveDB(db);
    res.status(201).json(newStaff);
});

app.put('/api/staff/:id', (req, res) => {
    const db = getDB();
    const index = db.staff.findIndex(s => String(s.id) === String(req.params.id));
    if (index === -1) return res.status(404).json({ error: 'Staff not found' });
    db.staff[index] = { ...db.staff[index], ...req.body };
    saveDB(db);
    res.json(db.staff[index]);
});

app.delete('/api/staff/:id', (req, res) => {
    const db = getDB();
    db.staff = (db.staff || []).filter(s => String(s.id) !== String(req.params.id));
    saveDB(db);
    res.json({ success: true });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const db = getDB();
    
    // Exact match check
    const staff = (db.staff || []).find(s => 
        s.username.trim() === username.trim() && 
        s.password === password
    );

    if (!staff) {
        console.warn(`AUTH FAILED: User "${username}" incorrect from ${req.ip}`);
        return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (!staff.isActive) {
        return res.status(403).json({ error: 'Account disabled. Contact admin.' });
    }

    console.log(`AUTH SUCCESS: "${username}" as ${staff.role}`);
    res.json({
        id: staff.id,
        name: staff.name,
        role: staff.role,
        lastLogin: new Date().toISOString()
    });
});

app.get('/api/analytics', (req, res) => res.json(getDB().analytics || []));
app.post('/api/analytics', (req, res) => {
    const db = getDB();
    if (!db.analytics) db.analytics = [];
    db.analytics.push({ ...req.body, ip: req.ip });
    saveDB(db);
    res.json({ success: true });
});

const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) res.sendFile(path.join(distPath, 'index.html'));
    });
}

app.listen(PORT, '0.0.0.0', () => {
    console.log('=============================================');
    console.log(` SERVER ACTIVE: http://localhost:${PORT}`);
    console.log(` NETWORK ACCESS: http://<Your-IP-Address>:${PORT}`);
    console.log(` DATABASE: ${dbFile}`);
    console.log(` ADMIN ACCESS: admin / admin`);
    console.log('=============================================');
});
