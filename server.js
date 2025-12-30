
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

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

const persistenceDir = path.join(os.homedir(), 'sanghavi_persistence');
const uploadsDir = path.join(persistenceDir, 'uploads');
const dbFile = path.join(persistenceDir, 'db.json');

const initStorage = () => {
    try {
        if (!fs.existsSync(persistenceDir)) fs.mkdirSync(persistenceDir, { recursive: true });
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
        if (!fs.existsSync(dbFile)) {
            const initialDB = { 
                products: [], 
                analytics: [], 
                config: null, 
                links: [], 
                staff: [
                    { 
                        id: 'admin-default', 
                        username: 'admin', 
                        password: 'admin', 
                        role: 'admin', 
                        isActive: true, 
                        name: 'System Admin', 
                        createdAt: new Date().toISOString() 
                    }
                ] 
            };
            fs.writeFileSync(dbFile, JSON.stringify(initialDB, null, 2));
        }
    } catch (err) {
        console.error(`Storage Failure:`, err);
    }
};

initStorage();

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

const deletePhysicalFile = (imageUrl) => {
    if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.includes('/api/uploads/')) return;
    try {
        const parts = imageUrl.split('/api/uploads/');
        const filename = parts[parts.length - 1].split('?')[0].split('#')[0];
        const filePath = path.resolve(uploadsDir, filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (err) {}
};

// --- API ROUTES ---

app.get('/api/health', (req, res) => res.json({ status: 'online' }));

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
    const prod = db.products.find(p => String(p.id) === String(id));
    if (prod?.images) prod.images.forEach(img => deletePhysicalFile(img));
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

app.get('/api/analytics', (req, res) => res.json(getDB().analytics || []));
app.post('/api/analytics', (req, res) => {
    const db = getDB();
    if (!db.analytics) db.analytics = [];
    const event = { ...req.body, ip: req.ip };
    db.analytics.push(event);
    saveDB(db);
    res.json({ success: true });
});

// --- STAFF ENDPOINTS ---
app.get('/api/staff', (req, res) => res.json(getDB().staff || []));

app.post('/api/staff', (req, res) => {
    const db = getDB();
    if (!db.staff) db.staff = [];
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
    const staff = (db.staff || []).find(s => 
        s.username.toLowerCase() === username.toLowerCase() && 
        s.password === password
    );

    if (!staff) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!staff.isActive) {
        return res.status(403).json({ error: 'Account is disabled. Please contact admin.' });
    }

    res.json({
        id: staff.id,
        name: staff.name,
        role: staff.role,
        lastLogin: new Date().toISOString()
    });
});

app.post('/api/links', (req, res) => {
    const db = getDB();
    if (!db.links) db.links = [];
    db.links.push(req.body);
    saveDB(db);
    res.status(201).json({ success: true });
});

app.get('/api/links/:token', (req, res) => {
    const db = getDB();
    const link = db.links.find(l => l.token === req.params.token);
    if (!link) return res.status(404).json({ error: 'Not found' });
    res.json(link);
});

const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) res.sendFile(path.join(distPath, 'index.html'));
    });
}

app.listen(PORT, '0.0.0.0', () => console.log(`API running on ${PORT}`));
