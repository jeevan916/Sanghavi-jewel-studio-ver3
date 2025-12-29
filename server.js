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

// --- ENHANCED WRITABLE PATH DETECTION ---
const findWritableDir = () => {
    const root = process.cwd();
    const potentialPaths = [
        path.join(root, 'data'),
        path.join(__dirname, 'data'),
        root,
        __dirname,
        path.join(os.homedir(), '.sanghavi_data'),
        os.tmpdir()
    ];

    for (const p of potentialPaths) {
        try {
            if (!fs.existsSync(p)) {
                fs.mkdirSync(p, { recursive: true });
            }
            // Test write permission
            const testFile = path.join(p, `.write-check-${Date.now()}`);
            fs.writeFileSync(testFile, 'test');
            fs.unlinkSync(testFile);
            
            // Ensure uploads folder exists in the writable dir
            const uploadsDir = path.join(p, 'uploads');
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
            }

            console.log(`[Server] STORAGE ACTIVE: ${p}`);
            return p;
        } catch (err) {
            console.warn(`[Server] Skip restricted path: ${p} (${err.code})`);
        }
    }
    return null;
};

const activeDataDir = findWritableDir();
const uploadsDir = activeDataDir ? path.join(activeDataDir, 'uploads') : null;
const dbFile = activeDataDir ? path.join(activeDataDir, 'db.json') : null;
const distPath = path.join(process.cwd(), 'dist');

// Serve uploaded images statically
if (uploadsDir) {
    console.log(`[Server] Serving static uploads from: ${uploadsDir}`);
    app.use('/api/uploads', express.static(uploadsDir));
}

const getDB = () => {
    if (!dbFile) return { products: [], analytics: [], config: null, links: [] };
    try {
        if (!fs.existsSync(dbFile)) {
            const initial = { products: [], analytics: [], config: null, links: [] };
            fs.writeFileSync(dbFile, JSON.stringify(initial, null, 2));
            return initial;
        }
        const data = fs.readFileSync(dbFile, 'utf8');
        const db = JSON.parse(data);
        if (!db.links) db.links = []; // Migration for older DB versions
        return db;
    } catch (e) {
        console.error("[Server] DB Load Error:", e);
        return { products: [], analytics: [], config: null, links: [] };
    }
};

const saveDB = (data) => {
    if (!dbFile) throw new Error("FileSystem locked. No writable directory found.");
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
    if (!uploadsDir) throw new Error("Upload directory not available.");
    
    // Remove header if present
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Generate unique filename
    const filename = `img_${productId}_${index}_${Date.now()}.jpg`;
    const filepath = path.join(uploadsDir, filename);
    
    fs.writeFileSync(filepath, buffer);
    
    // Return the URL that will be stored in the DB
    return `/api/uploads/${filename}`;
};

// --- API ROUTES ---

app.get('/api/health', (req, res) => {
    let writeable = false;
    let uploadsWriteable = false;
    let writeError = null;
    
    if (activeDataDir) {
        try {
            const testFile = path.join(activeDataDir, `.health-check-${Date.now()}`);
            fs.writeFileSync(testFile, 'ok');
            fs.unlinkSync(testFile);
            writeable = true;

            const uploadTest = path.join(uploadsDir, `.upload-test-${Date.now()}`);
            fs.writeFileSync(uploadTest, 'ok');
            fs.unlinkSync(uploadTest);
            uploadsWriteable = true;
        } catch (e) {
            writeError = e.message;
        }
    } else {
        writeError = "No writable folders discovered.";
    }

    res.json({ 
        status: 'online', 
        writeAccess: writeable,
        uploadsWriteAccess: uploadsWriteable,
        activePath: activeDataDir,
        writeError: writeError,
        dbExists: dbFile ? fs.existsSync(dbFile) : false,
        uptime: Math.round(process.uptime())
    });
});

app.get('/api/products', (req, res) => {
    try {
        const db = getDB();
        res.json(db.products || []);
    } catch (err) {
        res.status(500).json({ error: 'Read failed' });
    }
});

app.post('/api/products', (req, res) => {
    try {
        const product = req.body;
        if (!product.title || !product.images?.length) {
            return res.status(400).json({ error: 'Required fields missing' });
        }

        const productId = product.id || Date.now().toString();
        const imageUrls = [];

        product.images.forEach((imgBase64, index) => {
            if (imgBase64.startsWith('data:image')) {
                const url = saveImageToDisk(imgBase64, productId, index);
                imageUrls.push(url);
            } else {
                imageUrls.push(imgBase64);
            }
        });

        const db = getDB();
        const newProduct = { ...product, id: productId, images: imageUrls };
        db.products = db.products || [];
        db.products.push(newProduct);
        saveDB(db);
        res.status(201).json(newProduct);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- SHARING ROUTES ---
app.post('/api/links', (req, res) => {
    try {
        const link = req.body;
        if (!link.token || !link.targetId) return res.status(400).json({ error: 'Invalid link data' });
        const db = getDB();
        db.links = db.links || [];
        db.links.push(link);
        saveDB(db);
        res.status(201).json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save link' });
    }
});

app.get('/api/links/:token', (req, res) => {
    try {
        const { token } = req.params;
        const db = getDB();
        const link = (db.links || []).find(l => l.token === token);
        
        if (!link) return res.status(404).json({ error: 'Link not found' });
        
        // Expiration check
        if (new Date(link.expiresAt) < new Date()) {
            return res.status(410).json({ error: 'Link expired' });
        }

        res.json(link);
    } catch (err) {
        res.status(500).json({ error: 'Internal error' });
    }
});

app.get('/api/analytics', (req, res) => {
    try {
        const db = getDB();
        res.json(db.analytics || []);
    } catch (err) {
        res.status(500).json({ error: 'Analytics read failed' });
    }
});

app.post('/api/analytics', (req, res) => {
    try {
        const db = getDB();
        db.analytics = db.analytics || [];
        db.analytics.push(req.body);
        saveDB(db);
        res.status(201).json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Analytics save failed' });
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

// Front-end delivery
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API missing' });
        res.sendFile(path.join(distPath, 'index.html'));
    });
} else {
    app.get('*', (req, res) => res.status(200).send('Studio Server Live. Dist folder missing - run build.'));
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Ready on port ${PORT}`);
});