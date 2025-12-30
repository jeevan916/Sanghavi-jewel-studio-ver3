
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

/**
 * PERSISTENT STORAGE STRATEGY (HOSTINGER)
 * Storing data in a folder in the USER'S HOME DIRECTORY to survive app updates.
 */
const persistenceDir = path.join(os.homedir(), 'sanghavi_persistence');
const uploadsDir = path.join(persistenceDir, 'uploads');
const dbFile = path.join(persistenceDir, 'db.json');

const initStorage = () => {
    try {
        if (!fs.existsSync(persistenceDir)) {
            console.log(`[Storage] Creating persistent root: ${persistenceDir}`);
            fs.mkdirSync(persistenceDir, { recursive: true });
        }
        if (!fs.existsSync(uploadsDir)) {
            console.log(`[Storage] Creating uploads folder`);
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        if (!fs.existsSync(dbFile)) {
            console.log(`[Storage] Creating fresh database file`);
            fs.writeFileSync(dbFile, JSON.stringify({ products: [], analytics: [], config: null, links: [] }, null, 2));
        }
        console.log(`[Storage] Persistence verified at: ${persistenceDir}`);
    } catch (err) {
        console.error(`[Storage] Initialization Critical Failure:`, err);
    }
};

initStorage();

// Serve the 'uploads' folder as a static endpoint with 1 week caching
app.use('/api/uploads', express.static(uploadsDir, {
    maxAge: '7d',
    immutable: true
}));

const getDB = () => {
    try {
        if (!fs.existsSync(dbFile)) initStorage();
        const data = fs.readFileSync(dbFile, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error("[Server] DB Read Error:", e);
        return { products: [], analytics: [], config: null, links: [] };
    }
};

const saveDB = (data) => {
    try {
        if (!fs.existsSync(persistenceDir)) fs.mkdirSync(persistenceDir, { recursive: true });
        fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
        return true;
    } catch (e) {
        console.error("[Server] DB Save Error:", e);
        throw e;
    }
};

/**
 * PHYSICALLY REMOVE FILE FROM DISK
 */
const deletePhysicalFile = (imageUrl) => {
    if (!imageUrl || typeof imageUrl !== 'string') return;
    
    // Ensure we are only dealing with our own upload API paths
    if (!imageUrl.includes('/api/uploads/')) return;

    try {
        const parts = imageUrl.split('/api/uploads/');
        const filenameWithParams = parts[parts.length - 1];
        const filename = filenameWithParams.split('?')[0].split('#')[0];
        const filePath = path.resolve(uploadsDir, filename);
        
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`[Cleanup] PHYSICALLY DELETED: ${filename}`);
        }
    } catch (err) {
        console.error(`[Cleanup] ERROR deleting file ${imageUrl}:`, err);
    }
};

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
        console.log(`[Upload] Saved image: ${filename}`);
        return `/api/uploads/${filename}`;
    } catch (err) {
        console.error(`[ImageEngine] Save failed:`, err);
        return imgData;
    }
};

// --- API ROUTES ---

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'online', 
        storagePath: persistenceDir,
        dbExists: fs.existsSync(dbFile),
        writable: fs.existsSync(uploadsDir)
    });
});

app.get('/api/products', (req, res) => {
    const db = getDB();
    res.json(db.products || []);
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
        const index = db.products.findIndex(p => String(p.id) === String(id));
        if (index === -1) return res.status(404).json({ error: 'Not found' });
        const oldImages = db.products[index].images || [];
        const processedImages = (updatedData.images || []).map((img, idx) => 
            extractAndSaveImage(img, id, idx)
        );
        oldImages.forEach(oldImg => {
            if (!processedImages.includes(oldImg)) {
                deletePhysicalFile(oldImg);
            }
        });
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
        const prodIndex = db.products.findIndex(p => String(p.id) === String(id));
        if (prodIndex !== -1) {
            const productToDelete = db.products[prodIndex];
            if (Array.isArray(productToDelete.images)) {
                productToDelete.images.forEach(imgUrl => {
                    deletePhysicalFile(imgUrl);
                });
            }
            db.products.splice(prodIndex, 1);
            saveDB(db);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Product not found' });
        }
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

// Serve frontend dist if it exists with caching
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath, {
        maxAge: '1d',
        etag: true
    }));
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) {
            res.sendFile(path.join(distPath, 'index.html'));
        }
    });
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Optimized Persistent API Engine running on port ${PORT}`);
});
