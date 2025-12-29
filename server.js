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

// --- PATH RESOLUTION ---
const rootDir = path.resolve(__dirname);
const dataDir = path.join(rootDir, 'data');
const dbFile = path.join(dataDir, 'db.json');
const distPath = path.join(rootDir, 'dist');

console.log(`[Server] Initialization...`);
console.log(`[Server] DB Path: ${dbFile}`);

// Ensure data persistence layer exists on startup
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
        // Double check directory exists before writing
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        
        fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
        console.log(`[Server] DB write successful. Total products: ${data.products.length}`);
        return true;
    } catch (e) {
        console.error("[Server] DB Write Error:", e);
        throw e;
    }
};

// --- API ROUTES ---

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'online', 
        node: process.version, 
        dbPath: dbFile,
        dbExists: fs.existsSync(dbFile),
        writeAccess: true 
    });
});

app.get('/api/products', (req, res) => {
    try {
        const db = getDB();
        res.json(db.products);
    } catch (err) {
        res.status(500).json({ error: 'Failed to read products' });
    }
});

app.post('/api/products', (req, res) => {
    console.log(`[Server] Received POST request to /api/products`);
    try {
        const db = getDB();
        const product = { ...req.body, id: req.body.id || Date.now().toString() };
        
        if (!product.title || !product.images || product.images.length === 0) {
            console.error(`[Server] Validation Failed: Missing title or images`);
            return res.status(400).json({ error: 'Title and at least one image are required.' });
        }

        db.products.push(product);
        saveDB(db);
        
        console.log(`[Server] Product Saved Successfully: ${product.title} (${product.images.length} images)`);
        res.status(201).json(product);
    } catch (err) {
        console.error("[Server] Critical failure during product save:", err);
        res.status(500).json({ error: 'Internal Server Error: Failed to write to database. Ensure server has write permissions.' });
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
    try {
        const db = getDB();
        db.config = req.body;
        saveDB(db);
        res.json(db.config);
    } catch (err) {
        res.status(500).json({ error: 'Config save failed' });
    }
});

app.get('/api/analytics', (req, res) => res.json(getDB().analytics));
app.post('/api/analytics', (req, res) => {
    try {
        const db = getDB();
        db.analytics.push({ ...req.body, id: Date.now().toString() });
        saveDB(db);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Analytics save failed' });
    }
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