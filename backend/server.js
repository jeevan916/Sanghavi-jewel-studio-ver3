import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Hostinger Node.js apps often use a custom port provided by the environment
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// --- PERSISTENT STORAGE ---
// Hostinger specific: Ensure data is stored in the application root
const appRoot = process.cwd();
const dataDir = path.resolve(appRoot, 'data');
const uploadsDir = path.resolve(dataDir, 'uploads');
const dbFile = path.resolve(dataDir, 'db.json');

const initStorage = () => {
    try {
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
        if (!fs.existsSync(dbFile)) {
            fs.writeFileSync(dbFile, JSON.stringify({ products: [], analytics: [], config: null, links: [] }, null, 2));
        }
        console.log(`[Storage] Active at: ${dataDir}`);
    } catch (err) {
        console.error(`[Storage] Init Error:`, err);
    }
};

initStorage();

// Serve the 'uploads' folder statically
// This will be accessible via your-domain.com/api/uploads/ filename
app.use('/api/uploads', express.static(uploadsDir));

const getDB = () => {
    try {
        const data = fs.readFileSync(dbFile, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return { products: [], analytics: [], config: null, links: [] };
    }
};

const saveDB = (data) => {
    fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
};

const extractAndSaveImage = (imgData, productId, index) => {
    if (!imgData || !imgData.startsWith('data:image')) return imgData;
    try {
        const mimeType = imgData.match(/data:([^;]+);/)[1];
        const extension = mimeType.split('/')[1] || 'jpg';
        const base64Content = imgData.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Content, 'base64');
        const filename = `img_${productId}_${index}_${Date.now()}.${extension}`;
        const filePath = path.join(uploadsDir, filename);
        fs.writeFileSync(filePath, buffer);
        return `/api/uploads/${filename}`;
    } catch (err) {
        return imgData;
    }
};

// --- API ROUTES ---

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'online', 
        writable: fs.existsSync(uploadsDir),
        dbSize: getDB().products.length 
    });
});

app.get('/api/products', (req, res) => {
    res.json(getDB().products);
});

app.post('/api/products', (req, res) => {
    try {
        const product = req.body;
        const productId = product.id || Date.now().toString();
        const processedImages = (product.images || []).map((img, idx) => extractAndSaveImage(img, productId, idx));
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
        const processedImages = (updatedData.images || []).map((img, idx) => extractAndSaveImage(img, id, idx));
        db.products[index] = { ...updatedData, images: processedImages };
        saveDB(db);
        res.json(db.products[index]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/products/:id', (req, res) => {
    try {
        const db = getDB();
        db.products = db.products.filter(p => p.id !== req.params.id);
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

app.post('/api/links', (req, res) => {
    const db = getDB();
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

// Start the server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Sanghavi API Engine running on port ${PORT}`);
});