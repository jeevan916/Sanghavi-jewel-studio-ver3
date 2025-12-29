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
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// --- PRODUCTION-READY PATH RESOLUTION ---
// Use process.cwd() as it is more reliable in hosted environments like Hostinger
const rootDir = process.cwd();
const dataDir = path.join(rootDir, 'data');
const dbFile = path.join(dataDir, 'db.json');
const distPath = path.join(rootDir, 'dist');

console.log(`[Server] Initialization started...`);
console.log(`[Server] Working Directory: ${rootDir}`);
console.log(`[Server] Database Path: ${dbFile}`);

const ensureDataDir = () => {
    if (!fs.existsSync(dataDir)) {
        try {
            fs.mkdirSync(dataDir, { recursive: true });
            console.log(`[Server] Created data directory: ${dataDir}`);
        } catch (err) {
            console.error(`[Server] CRITICAL: Failed to create data directory at ${dataDir}`, err);
            return err.message;
        }
    }
    return null;
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
        console.error("[Server] DB Read Error:", e);
        return { products: [], analytics: [], config: null };
    }
};

const saveDB = (data) => {
    const err = ensureDataDir();
    if (err) throw new Error(`FileSystem Error: ${err}`);
    try {
        fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
        console.log(`[Server] DB saved. Total Products: ${data.products.length}`);
        return true;
    } catch (e) {
        console.error("[Server] DB Write Error:", e);
        throw e;
    }
};

// --- API ROUTES ---

app.get('/api/health', (req, res) => {
    let writeable = false;
    let writeError = null;
    try {
        ensureDataDir();
        const testFile = path.join(dataDir, `.write-test-${Date.now()}`);
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        writeable = true;
    } catch (e) {
        writeError = e.message;
        console.error(`[Health Check] Write test failed: ${writeError}`);
    }

    res.json({ 
        status: 'online', 
        writeAccess: writeable,
        writeError: writeError,
        dbExists: fs.existsSync(dbFile),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'production'
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
    console.log(`[Server] POST /api/products - Payload Size: ${Math.round(JSON.stringify(req.body).length / 1024 / 1024)}MB`);
    try {
        const product = req.body;
        
        if (!product.title || !product.images || !product.images.length) {
            return res.status(400).json({ error: 'Title and images are required.' });
        }

        const db = getDB();
        const newProduct = { ...product, id: product.id || Date.now().toString() };
        db.products.push(newProduct);
        saveDB(db);
        
        res.status(201).json(newProduct);
    } catch (err) {
        console.error("[Server] Save Error:", err);
        res.status(500).json({ error: `Server Save Failed: ${err.message}` });
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
    app.get('*', (req, res) => res.status(200).send('Sanghavi Server is online. UI (dist folder) is missing - ensure npm build ran successfully.'));
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Studio active at http://localhost:${PORT}`);
});