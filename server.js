
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

// Permissive CORS for local network/XAMPP access
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
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
            console.log("DB: Fresh database created.");
        } else {
            const data = fs.readFileSync(dbFile, 'utf8');
            try {
                db = JSON.parse(data);
                if (!db.products) db.products = [];
                if (!db.staff) db.staff = [DEFAULT_ADMIN];
                
                // Always ensure 'admin' user is present and has role 'admin'
                const adminExists = db.staff.find(s => s.username.toLowerCase() === 'admin');
                if (!adminExists) {
                    db.staff.push(DEFAULT_ADMIN);
                }
            } catch (e) {
                console.error("DB: Corruption detected. Resetting.");
                db = { products: [], analytics: [], config: null, links: [], staff: [DEFAULT_ADMIN] };
            }
        }
        fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
    } catch (err) {
        console.error(`DB: Fatal Initialization Failure:`, err);
    }
};

initStorage();

app.use('/api/uploads', express.static(uploadsDir, { maxAge: '7d' }));

const getDB = () => {
    try {
        const data = fs.readFileSync(dbFile, 'utf8');
        return JSON.parse(data);
    } catch (e) { return { staff: [] }; }
};

const saveDB = (data) => {
    try { fs.writeFileSync(dbFile, JSON.stringify(data, null, 2)); return true; } catch (e) { throw e; }
};

// --- API ROUTES ---

app.get('/api/health', (req, res) => res.json({ 
    status: 'online', 
    serverTime: new Date().toISOString(),
    authSystem: 'ready'
}));

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    console.log(`[LOGIN ATTEMPT] User: "${username}" | IP: ${req.ip}`);

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    const db = getDB();
    
    // Case-insensitive lookup
    const staff = (db.staff || []).find(s => 
        s.username.trim().toLowerCase() === username.trim().toLowerCase() && 
        s.password === password
    );

    if (!staff) {
        console.warn(`[AUTH FAILED] Invalid credentials for "${username}"`);
        return res.status(401).json({ error: 'Invalid username or password. Note: Password is case-sensitive.' });
    }

    if (!staff.isActive) {
        console.warn(`[AUTH DENIED] Account disabled for "${username}"`);
        return res.status(403).json({ error: 'This account has been disabled. Please contact the system administrator.' });
    }

    console.log(`[AUTH SUCCESS] User: "${username}" | Role: ${staff.role}`);
    res.json({
        id: staff.id,
        name: staff.name,
        role: staff.role,
        lastLogin: new Date().toISOString()
    });
});

app.get('/api/products', (req, res) => res.json(getDB().products || []));
app.post('/api/products', (req, res) => {
    const db = getDB();
    db.products.push(req.body);
    saveDB(db);
    res.status(201).json(req.body);
});

app.put('/api/products/:id', (req, res) => {
    const db = getDB();
    const idx = db.products.findIndex(p => String(p.id) === String(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    db.products[idx] = req.body;
    saveDB(db);
    res.json(db.products[idx]);
});

app.delete('/api/products/:id', (req, res) => {
    const db = getDB();
    db.products = db.products.filter(p => String(p.id) !== String(req.params.id));
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
    const newStaff = { ...req.body, id: Date.now().toString() };
    db.staff.push(newStaff);
    saveDB(db);
    res.json(newStaff);
});

app.get('/api/analytics', (req, res) => res.json(getDB().analytics || []));
app.post('/api/analytics', (req, res) => {
    const db = getDB();
    if (!db.analytics) db.analytics = [];
    db.analytics.push({ ...req.body, ip: req.ip });
    saveDB(db);
    res.json({ success: true });
});

// Deployment serving
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) res.sendFile(path.join(distPath, 'index.html'));
    });
}

app.listen(PORT, '0.0.0.0', () => {
    console.log('\n=============================================');
    console.log(` SANGHAVI STUDIO BACKEND ACTIVE`);
    console.log(` LOCAL:   http://localhost:${PORT}`);
    console.log(` NETWORK: http://0.0.0.0:${PORT}`);
    console.log(`\n ADMIN CREDENTIALS:`);
    console.log(` Username: admin`);
    console.log(` Password: admin`);
    console.log('=============================================\n');
});
