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

// --- DIRECTORY SETUP ---
// We prioritize a 'data' folder in the root directory
const rootDir = process.cwd();
const dataDir = path.join(rootDir, 'data');
const uploadsDir = path.join(dataDir, 'uploads');
const dbFile = path.join(dataDir, 'db.json');

// Ensure directories exist
const initStorage = () => {
    try {
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
            console.log(`[Storage] Created data directory: ${dataDir}`);
        }
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
            console.log(`[Storage] Created uploads directory: ${uploadsDir}`);
        }
        if (!fs.existsSync(dbFile)) {
            fs.writeFileSync(dbFile, JSON.stringify({ products: [], analytics: [], config: null, links: [] }, null, 2));
            console.log(`[Storage] Initialized empty db.json`);
        }
    } catch (err) {
        console.error(`[Storage] CRITICAL: Failed to initialize folders:`, err);
    }
};

initStorage();

// Serve uploaded images statically
app.use('/api/uploads', express.static(uploadsDir));

const getDB = () => {
    try {
        const data = fs.readFileSync(dbFile, 'utf8');
        const db = JSON.parse(data);
        if (!db.products) db.products = [];
        if (!db.links) db.links = [];
        return db;
    } catch (e) {
        return { products: [], analytics: [], config: null, links: [] };
    }
};

const saveDB = (data) => {
    try {
        fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
        return true;
    } catch (e) {
        console.error("[Server] Save Blocked:", e);
        throw e;
    }
};

// Helper to save base64 image to disk
const saveImageToDisk = (base64String, productId, index) => {
    // Check if it's actually base64
    if (!base64String.startsWith('data:image')) {
        return base64String; // Return as-is if it's already a URL
    }

    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    
    const extension = base64String.split(';')[0].split('/')[1] || 'jpg';
    const filename = `img_${productId}_${index}_${Date.now()}.${extension}`;
    const filepath = path.join(uploadsDir, filename);
    
    fs.writeFileSync(filepath, buffer);
    console.log(`[Storage] Saved file: ${filename}`);
    
    return `/api/uploads/${filename}`;
};

// --- API ROUTES ---

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'online', 
        dataDir: dataDir,
        uploadsDir: uploadsDir,
        writable: fs.existsSync(uploadsDir)
    });
});

app.get('/api/products', (req, res) => {
    res.json(getDB().products);
});

// Create Product
app.post('/api/products', (req, res) => {
    try {
        const product = req.body;
        const productId = product.id || Date.now().toString();
        const imageUrls = (product.images || []).map((img, idx) => saveImageToDisk(img, productId, idx));

        const db = getDB();
        const newProduct = { ...product, id: productId, images: imageUrls };
        db.products.push(newProduct);
        saveDB(db);
        
        res.status(201).json(newProduct);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Product
app.put('/api/products/:id', (req, res) => {
    try {
        const { id } = req.params;
        const updatedData = req.body;
        const db = getDB();
        
        const index = db.products.findIndex(p => p.id === id);
        if (index === -1) return res.status(404).json({ error: 'Not found' });

        // Process images (extract base64 if newly added/edited)
        const processedImages = (updatedData.images || []).map((img, idx) => saveImageToDisk(img, id, idx));

        db.products[index] = { ...updatedData, images: processedImages };
        saveDB(db);
        
        res.json(db.products[index]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/products/:id', (req, res) => {
    try {
        const { id } = req.params;
        const db = getDB();
        db.products = db.products.filter(p => p.id !== id);
        saveDB(db);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- SHARING ROUTES ---
app.post('/api/links', (req, res) => {
    const db = getDB();
    db.links.push(req.body);
    saveDB(db);
    res.status(201).json({ success: true });
});

app.get('/api/links/:token', (req, res) => {
    const { token } = req.params;
    const db = getDB();
    const link = db.links.find(l => l.token === token);
    if (!link) return res.status(404).json({ error: 'Not found' });
    if (new Date(link.expiresAt) < new Date()) return res.status(410).json({ error: 'Expired' });
    res.json(link);
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
    db.analytics.push(req.body);
    saveDB(db);
    res.json({ success: true });
});

// Static frontend
const distPath = path.join(rootDir, 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API not found' });
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Studio Engine Live on port ${PORT}`);
    console.log(`[Server] Database: ${dbFile}`);
    console.log(`[Server] Uploads: ${uploadsDir}`);
});