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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- PATH RESOLUTION (Absolute for Stability) ---
const rootDir = path.resolve(__dirname);
const dataDir = path.join(rootDir, 'data');
const dbFile = path.join(dataDir, 'db.json');
const distPath = path.join(rootDir, 'dist');

console.log(`[Server] Initialization...`);
console.log(`[Server] DB Path: ${dbFile}`);

// Ensure data persistence layer exists
if (!fs.existsSync(dataDir)) {
    try {
        fs.mkdirSync(dataDir, { recursive: true });
        console.log(`[Server] Data directory created at ${dataDir}`);
    } catch (err) {
        console.error(`[Server] Critical Error: Could not create data directory`, err);
    }
}

const getDB = () => {
    try {
        if (!fs.existsSync(dbFile)) {
            const initial = { products: [], analytics: [], config: null };
            fs.writeFileSync(dbFile, JSON.stringify(initial, null, 2));
            return initial;
        }
        const data = fs.readFileSync(dbFile, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error("[Server] DB Read Error:", e);
        return { products: [], analytics: [], config: null };
    }
};

const saveDB = (data) => {
    try {
        fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
        console.log(`[Server] DB saved. Total products: ${data.products.length}`);
    } catch (e) {
        console.error("[Server] DB Write Error:", e);
    }
};

// --- API ROUTES ---

app.get('/api/health', (req, res) => {
    res.json({ status: 'online', node: process.version, dbPath: dbFile });
});

app.get('/api/products', (req, res) => {
    const db = getDB();
    res.json(db.products);
});

app.post('/api/products', (req, res) => {
    try {
        const db = getDB();
        const product = { ...req.body, id: req.body.id || Date.now().toString() };
        db.products.push(product);
        saveDB(db);
        console.log(`[Server] Product Added: ${product.title}`);
        res.status(201).json(product);
    } catch (err) {
        console.error("[Server] POST /api/products failed:", err);
        res.status(500).json({ error: 'Failed to save product' });
    }
});

app.put('/api/products/:id', (req, res) => {
    try {
        const db = getDB();
        const index = db.products.findIndex(p => p.id === req.params.id);
        if (index !== -1) {
            db.products[index] = { ...db.products[index], ...req.body };
            saveDB(db);
            res.json(db.products[index]);
        } else {
            res.status(404).json({ error: 'Product not found' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Update failed' });
    }
});

app.delete('/api/products/:id', (req, res) => {
    try {
        const db = getDB();
        db.products = db.products.filter(p => p.id !== req.params.id);
        saveDB(db);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Delete failed' });
    }
});

app.get('/api/config', (req, res) => res.json(getDB().config));
app.post('/api/config', (req, res) => {
    const db = getDB();
    db.config = req.body;
    saveDB(db);
    res.json(db.config);
});

app.get('/api/analytics', (req, res) => res.json(getDB().analytics));
app.post('/api/analytics', (req, res) => {
    const db = getDB();
    db.analytics.push({ ...req.body, id: Date.now().toString() });
    saveDB(db);
    res.json({ success: true });
});

// --- FRONTEND SERVING ---
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API not found' });
        res.sendFile(path.join(distPath, 'index.html'));
    });
} else {
    app.get('*', (req, res) => res.send('Server online. "dist" folder not found. Please run "npm run build" to enable the UI.'));
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
});