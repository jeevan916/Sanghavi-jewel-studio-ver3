import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Hostinger's Passenger environment usually handles the port
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- PATH RESOLUTION ---
const rootDir = path.resolve(__dirname);
const dataDir = path.join(rootDir, 'data');
const dbFile = path.join(dataDir, 'db.json');
const distPath = path.join(rootDir, 'dist');

// Ensure data persistence layer exists
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const getDB = () => {
    try {
        if (!fs.existsSync(dbFile)) {
            const initial = { products: [], analytics: [], config: null };
            fs.writeFileSync(dbFile, JSON.stringify(initial, null, 2));
            return initial;
        }
        return JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    } catch (e) {
        console.error("DB Read Error:", e);
        return { products: [], analytics: [], config: null };
    }
};

const saveDB = (data) => {
    try {
        fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("DB Write Error:", e);
    }
};

// --- API ROUTES ---

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'online', 
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV || 'production'
    });
});

app.get('/api/products', (req, res) => res.json(getDB().products));

app.post('/api/products', (req, res) => {
    const db = getDB();
    const product = { ...req.body, id: req.body.id || Date.now().toString() };
    db.products.push(product);
    saveDB(db);
    res.status(201).json(product);
});

app.put('/api/products/:id', (req, res) => {
    const db = getDB();
    const index = db.products.findIndex(p => p.id === req.params.id);
    if (index !== -1) {
        db.products[index] = { ...db.products[index], ...req.body };
        saveDB(db);
        res.json(db.products[index]);
    } else {
        res.status(404).json({ error: 'Product not found' });
    }
});

app.delete('/api/products/:id', (req, res) => {
    const db = getDB();
    db.products = db.products.filter(p => p.id !== req.params.id);
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

app.get('/api/analytics', (req, res) => res.json(getDB().analytics));

app.post('/api/analytics', (req, res) => {
    const db = getDB();
    db.analytics.push({ ...req.body, id: Date.now().toString() });
    saveDB(db);
    res.json({ success: true });
});

// --- FRONTEND SERVING ---

// Serve static files from 'dist'
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) {
            return res.status(404).json({ error: 'API route not found' });
        }
        res.sendFile(path.join(distPath, 'index.html'));
    });
} else {
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) {
             return res.status(404).json({ error: 'API route not found' });
        }
        res.status(200).send('Sanghavi Backend Online. Waiting for frontend build/deployment.');
    });
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
});