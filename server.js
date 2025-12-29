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
            // Real-world write check
            const testFile = path.join(p, `.write-check-${Date.now()}`);
            fs.writeFileSync(testFile, 'test');
            fs.unlinkSync(testFile);
            console.log(`[Server] STORAGE ACTIVE: ${p}`);
            return p;
        } catch (err) {
            console.warn(`[Server] Skip restricted path: ${p} (${err.code})`);
        }
    }
    return null;
};

const activeDataDir = findWritableDir();
const dbFile = activeDataDir ? path.join(activeDataDir, 'db.json') : null;
const distPath = path.join(process.cwd(), 'dist');

const getDB = () => {
    if (!dbFile) return { products: [], analytics: [], config: null };
    try {
        if (!fs.existsSync(dbFile)) {
            const initial = { products: [], analytics: [], config: null };
            fs.writeFileSync(dbFile, JSON.stringify(initial, null, 2));
            return initial;
        }
        const data = fs.readFileSync(dbFile, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error("[Server] DB Load Error:", e);
        return { products: [], analytics: [], config: null };
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

// --- API ROUTES ---

app.get('/api/health', (req, res) => {
    let writeable = false;
    let writeError = null;
    
    if (activeDataDir) {
        try {
            const testFile = path.join(activeDataDir, `.health-check-${Date.now()}`);
            fs.writeFileSync(testFile, 'ok');
            fs.unlinkSync(testFile);
            writeable = true;
        } catch (e) {
            writeError = e.message;
        }
    } else {
        writeError = "No writable folders discovered.";
    }

    res.json({ 
        status: 'online', 
        writeAccess: writeable,
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
    console.log(`[Server] POST /api/products - Size: ${Math.round(JSON.stringify(req.body).length / 1024)}KB`);
    try {
        const product = req.body;
        if (!product.title || !product.images?.length) {
            return res.status(400).json({ error: 'Required fields missing' });
        }

        const db = getDB();
        const newProduct = { ...product, id: product.id || Date.now().toString() };
        db.products = db.products || [];
        db.products.push(newProduct);
        saveDB(db);
        
        res.status(201).json(newProduct);
    } catch (err) {
        res.status(500).json({ error: err.message });
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
    console.log(`[Server] Active Path: ${activeDataDir}`);
});