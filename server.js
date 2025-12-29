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

// --- ROBUST PATH RESOLUTION ---
// Use process.cwd() as a fallback for some hosting environments
const rootDir = path.resolve(__dirname);
const dataDir = path.join(rootDir, 'data');
const dbFile = path.join(dataDir, 'db.json');
const distPath = path.join(rootDir, 'dist');

console.log(`[Server] Initializing Sanghavi Studio Backend...`);
console.log(`[Server] Database target: ${dbFile}`);

// Ensure data persistence layer exists
const ensureDataDir = () => {
    if (!fs.existsSync(dataDir)) {
        try {
            fs.mkdirSync(dataDir, { recursive: true });
            console.log(`[Server] Created data directory: ${dataDir}`);
        } catch (err) {
            console.error(`[Server] CRITICAL: Failed to create data directory!`, err);
        }
    }
};

const getDB = () => {
    ensureDataDir();
    try {
        if (!fs.existsSync(dbFile)) {
            const initial = { products: [], analytics: [], config: null };
            fs.writeFileSync(dbFile, JSON.stringify(initial, null, 2));
            return initial;
        }
        const data = fs.readFileSync(dbFile, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error("[Server] DB Read Error. Returning empty state.", e);
        return { products: [], analytics: [], config: null };
    }
};

const saveDB = (data) => {
    ensureDataDir();
    try {
        fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
        console.log(`[Server] DB Saved. Total Products: ${data.products.length}`);
        return true;
    } catch (e) {
        console.error("[Server] DB Write Error! Check filesystem permissions.", e);
        throw e;
    }
};

// --- API ROUTES ---

app.get('/api/health', (req, res) => {
    let writeable = false;
    try {
        ensureDataDir();
        const testFile = path.join(dataDir, '.write-test');
        fs.writeFileSync(testFile, Date.now().toString());
        fs.unlinkSync(testFile);
        writeable = true;
    } catch (e) {}

    res.json({ 
        status: 'online', 
        writeAccess: writeable,
        dbExists: fs.existsSync(dbFile),
        uptime: process.uptime()
    });
});

app.get('/api/products', (req, res) => {
    try {
        const db = getDB();
        res.json(db.products);
    } catch (err) {
        res.status(500).json({ error: 'Database read failed' });
    }
});

app.post('/api/products', (req, res) => {
    console.log(`[Server] POST /api/products - Incoming upload request`);
    try {
        const product = req.body;
        
        if (!product.title || !product.images || !product.images.length) {
            console.warn(`[Server] Rejected: Missing required fields`);
            return res.status(400).json({ error: 'Title and images are required.' });
        }

        const db = getDB();
        const newProduct = { ...product, id: product.id || Date.now().toString() };
        db.products.push(newProduct);
        saveDB(db);
        
        console.log(`[Server] Successfully saved: ${newProduct.title}`);
        res.status(201).json(newProduct);
    } catch (err) {
        console.error("[Server] Internal Error during save:", err);
        res.status(500).json({ error: 'Server failed to save the product. Check directory permissions.' });
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
        res.status(500).json({ error: 'Config update failed' });
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
    app.get('*', (req, res) => res.status(200).send('Sanghavi Server is online. UI (dist folder) is missing - run npm build.'));
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Studio active at http://localhost:${PORT}`);
});