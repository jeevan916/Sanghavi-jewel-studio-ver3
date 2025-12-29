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

// Increase limits for high-res jewelry photos
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// --- PERMANENT STORAGE SETUP ---
// Use __dirname to ensure paths are always relative to the script location
const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(dataDir, 'uploads');
const dbFile = path.join(dataDir, 'db.json');

const initStorage = () => {
    try {
        if (!fs.existsSync(dataDir)) {
            console.log(`[Storage] Creating data directory: ${dataDir}`);
            fs.mkdirSync(dataDir, { recursive: true });
        }
        if (!fs.existsSync(uploadsDir)) {
            console.log(`[Storage] Creating uploads directory: ${uploadsDir}`);
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        if (!fs.existsSync(dbFile)) {
            console.log(`[Storage] Creating initial database file: ${dbFile}`);
            fs.writeFileSync(dbFile, JSON.stringify({ products: [], analytics: [], config: null, links: [] }, null, 2));
        }
        console.log(`[Storage] System Verified at: ${dataDir}`);
    } catch (err) {
        console.error(`[Storage] Initialization Failed:`, err);
    }
};

initStorage();

// Serve the 'uploads' folder as a static CDN-like endpoint
app.use('/api/uploads', express.static(uploadsDir));

// --- DATABASE UTILS ---
const getDB = () => {
    try {
        if (!fs.existsSync(dbFile)) {
            initStorage();
        }
        const data = fs.readFileSync(dbFile, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error("[Server] DB Read Error, returning default state:", e);
        return { products: [], analytics: [], config: null, links: [] };
    }
};

const saveDB = (data) => {
    try {
        // Double check directory exists before writing
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
        return true;
    } catch (e) {
        console.error("[Server] DB Save Error:", e);
        throw e;
    }
};

// --- IMAGE ENGINE: Base64 -> Physical File ---
const extractAndSaveImage = (imgData, productId, index) => {
    if (!imgData || !imgData.startsWith('data:image')) return imgData;

    try {
        const mimeType = imgData.match(/data:([^;]+);/)[1];
        const extension = mimeType.split('/')[1] || 'jpg';
        const base64Content = imgData.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Content, 'base64');
        
        const filename = `prod_${productId}_${index}_${Date.now()}.${extension}`;
        const filePath = path.join(uploadsDir, filename);
        
        fs.writeFileSync(filePath, buffer);
        return `/api/uploads/${filename}`;
    } catch (err) {
        console.error(`[ImageEngine] Failed to save image ${index} for ${productId}:`, err);
        return imgData;
    }
};

// --- API ROUTES ---

app.get('/api/health', (req, res) => {
    try {
        const db = getDB();
        res.json({ 
            status: 'online', 
            storage: {
                root: dataDir,
                uploads: uploadsDir,
                db: dbFile,
                writable: fs.existsSync(uploadsDir)
            },
            productCount: db.products ? db.products.length : 0
        });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

app.get('/api/products', (req, res) => {
    res.json(getDB().products);
});

app.post('/api/products', (req, res) => {
    try {
        const product = req.body;
        const productId = product.id || Date.now().toString();
        
        const processedImages = (product.images || []).map((img, idx) => 
            extractAndSaveImage(img, productId, idx)
        );

        const db = getDB();
        const finalProduct = { ...product, id: productId, images: processedImages };
        db.products.push(finalProduct);
        saveDB(db);
        
        res.status(201).json(finalProduct);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/products/:id', (req, res) => {
    try {
        const { id } = req.params;
        const updatedData = req.body;
        const db = getDB();
        
        const index = db.products.findIndex(p => p.id === id);
        if (index === -1) return res.status(404).json({ error: 'Not found' });

        const processedImages = (updatedData.images || []).map((img, idx) => 
            extractAndSaveImage(img, id, idx)
        );

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

const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API route not found' });
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Sanghavi Jewel Studio active on port ${PORT}`);
    console.log(`[Server] Image CDN Path: /api/uploads/`);
});