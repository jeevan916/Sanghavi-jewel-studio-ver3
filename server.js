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

// --- DYNAMIC WRITABLE PATH DETECTION ---
// This is critical for shared hosting where standard directories might be locked.
const findWritableDir = () => {
    const root = process.cwd();
    const potentialPaths = [
        path.join(root, 'data'),
        root,
        os.tmpdir(),
        path.join(__dirname, 'data'),
        __dirname
    ];

    for (const p of potentialPaths) {
        try {
            if (!fs.existsSync(p)) {
                fs.mkdirSync(p, { recursive: true });
            }
            // Test write permission
            const testFile = path.join(p, `.write-test-${Date.now()}`);
            fs.writeFileSync(testFile, 'test');
            fs.unlinkSync(testFile);
            console.log(`[Server] Writable directory verified: ${p}`);
            return p;
        } catch (err) {
            console.warn(`[Server] Directory not writable: ${p} - ${err.message}`);
        }
    }
    return null;
};

const activeDataDir = findWritableDir();
if (!activeDataDir) {
    console.error(`[Server] CRITICAL: No writable directory found. App will fail to save data.`);
}

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
        console.error("[Server] DB Read Error:", e);
        return { products: [], analytics: [], config: null };
    }
};

const saveDB = (data) => {
    if (!dbFile) throw new Error("No writable database file path detected.");
    try {
        fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
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
    
    if (activeDataDir) {
        try {
            const testFile = path.join(activeDataDir, `.health-test-${Date.now()}`);
            fs.writeFileSync(testFile, 'health-ok');
            fs.unlinkSync(testFile);
            writeable = true;
        } catch (e) {
            writeError = e.message;
        }
    } else {
        writeError = "No writable directory discovered at startup.";
    }

    res.json({ 
        status: 'online', 
        writeAccess: writeable,
        activePath: activeDataDir,
        writeError: writeError,
        dbExists: dbFile ? fs.existsSync(dbFile) : false,
        uptime: process.uptime()
    });
});

app.get('/api/products', (req, res) => {
    try {
        const db = getDB();
        res.json(db.products || []);
    } catch (err) {
        res.status(500).json({ error: 'Database read failed' });
    }
});

app.post('/api/products', (req, res) => {
    console.log(`[Server] POST /api/products - Saving item to: ${dbFile}`);
    try {
        const product = req.body;
        if (!product.title || !product.images || !product.images.length) {
            return res.status(400).json({ error: 'Title and images are required.' });
        }

        const db = getDB();
        const newProduct = { ...product, id: product.id || Date.now().toString() };
        db.products = db.products || [];
        db.products.push(newProduct);
        saveDB(db);
        
        res.status(201).json(newProduct);
    } catch (err) {
        console.error("[Server] Save Error:", err);
        res.status(500).json({ error: `Server Save Failed: ${err.message}` });
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

// Serve frontend
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API not found' });
        res.sendFile(path.join(distPath, 'index.html'));
    });
} else {
    app.get('*', (req, res) => res.status(200).send('Sanghavi Server is online. Please deploy the "dist" folder.'));
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Running at http://localhost:${PORT}`);
    console.log(`[Server] Database File: ${dbFile || 'NONE FOUND'}`);
});