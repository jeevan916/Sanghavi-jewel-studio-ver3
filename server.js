require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const mysql = require('mysql2/promise');
const fs = require('fs');

const app = express();
// Hostinger often provides PORT via env, default to 3000
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
// Increase limit for initial Base64 payload before we save to disk
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 1. Serve Static Assets (React App)
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// 2. Serve Uploaded Images (from Disk)
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// --- DATABASE CONNECTION (Production) ---
const pool = mysql.createPool({
    host: process.env.DB_HOST,      // REQUIRED in .env
    user: process.env.DB_USER,      // REQUIRED in .env
    password: process.env.DB_PASSWORD, // REQUIRED in .env
    database: process.env.DB_NAME,  // REQUIRED in .env
    port: Number(process.env.DB_PORT || 3306),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    supportBigNumbers: true 
});

// --- HELPER: Save Base64 Image to Disk ---
async function processImages(imagesArray) {
    if (!Array.isArray(imagesArray)) return [];
    
    const processed = await Promise.all(imagesArray.map(async (imgStr) => {
        // If it's already a URL (previously saved), return it as is
        if (typeof imgStr === 'string' && imgStr.startsWith('/uploads/')) {
            return imgStr;
        }

        // If it's a Base64 data URI
        if (typeof imgStr === 'string' && imgStr.startsWith('data:image')) {
            try {
                // Extract extension and data
                const matches = imgStr.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
                if (!matches || matches.length !== 3) return imgStr; // Fallback

                let ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
                // Security: sanitize extension
                ext = ext.replace(/[^a-z0-9]/gi, '');
                
                const buffer = Buffer.from(matches[2], 'base64');
                const filename = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
                const filepath = path.join(uploadDir, filename);

                // Write to disk
                await fs.promises.writeFile(filepath, buffer);
                
                // Return public URL
                return `/uploads/${filename}`;
            } catch (err) {
                console.error("Error saving image to disk:", err);
                return null; // or keep original if critical
            }
        }
        return imgStr;
    }));

    return processed.filter(Boolean); // Remove nulls
}

// --- INITIALIZATION ---
async function initDB() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Connected to Hostinger MySQL Database.');

        // Note: images column is LONGTEXT to store JSON array of file paths
        await connection.query(`
            CREATE TABLE IF NOT EXISTS products (
                id VARCHAR(255) PRIMARY KEY,
                title VARCHAR(255),
                category VARCHAR(100),
                subCategory VARCHAR(100),
                weight DECIMAL(10, 2),
                description TEXT,
                tags JSON,
                images LONGTEXT, 
                supplier VARCHAR(255),
                uploadedBy VARCHAR(255),
                isHidden BOOLEAN DEFAULT FALSE,
                createdAt DATETIME,
                dateTaken DATE,
                meta JSON
            )
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS app_config (
                id INT PRIMARY KEY DEFAULT 1,
                config_json JSON
            )
        `);

        // Seed Default Config
        const [rows] = await connection.query('SELECT * FROM app_config WHERE id = 1');
        if (rows.length === 0) {
            const defaultConfig = {
                suppliers: [
                    { id: '1', name: 'Ratna Jewels', isPrivate: false },
                    { id: '2', name: 'Kanak Gold', isPrivate: false },
                    { id: '3', name: 'Sanghavi In-House', isPrivate: true }
                ],
                categories: [
                    { id: 'c1', name: 'Necklace', subCategories: ['Choker', 'Rani Haar', 'Pendant'], isPrivate: false },
                    { id: 'c2', name: 'Ring', subCategories: ['Solitaire', 'Band', 'Cocktail'], isPrivate: false },
                    { id: 'c3', name: 'Earrings', subCategories: ['Jhumka', 'Studs', 'Chandbali'], isPrivate: false },
                    { id: 'c4', name: 'High Value', subCategories: ['Bridal Set', 'Diamond Set'], isPrivate: true }
                ],
                linkExpiryHours: 24,
                whatsappNumber: ''
            };
            await connection.query('INSERT INTO app_config (id, config_json) VALUES (1, ?)', [JSON.stringify(defaultConfig)]);
        }

        await connection.query(`
            CREATE TABLE IF NOT EXISTS designs (
                id VARCHAR(255) PRIMARY KEY,
                imageUrl LONGTEXT,
                prompt TEXT,
                aspectRatio VARCHAR(50),
                createdAt DATETIME
            )
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS shared_links (
                id VARCHAR(255) PRIMARY KEY,
                targetId VARCHAR(255),
                type VARCHAR(50),
                token VARCHAR(255),
                expiresAt DATETIME
            )
        `);

        connection.release();
        console.log('✅ Database Schema Verified.');
    } catch (err) {
        console.error('❌ Database Connection Failed:', err.message);
        console.error('   Please check your .env file for Hostinger DB credentials.');
    }
}

// Start DB Init
initDB();

const parseJSON = (data) => {
    if (typeof data === 'string') {
        try { return JSON.parse(data); } catch(e) { return []; }
    }
    return data || [];
};

// --- API ROUTES ---

app.get('/api/products', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM products ORDER BY createdAt DESC');
        const products = rows.map(p => ({
            ...p,
            tags: parseJSON(p.tags),
            images: parseJSON(p.images),
            meta: parseJSON(p.meta),
            isHidden: Boolean(p.isHidden)
        }));
        res.json(products);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/products', async (req, res) => {
    try {
        const p = req.body;
        
        // Convert Base64 images to File Paths
        const savedImagePaths = await processImages(p.images);

        const query = `
            INSERT INTO products 
            (id, title, category, subCategory, weight, description, tags, images, supplier, uploadedBy, isHidden, createdAt, dateTaken, meta)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const values = [
            p.id, p.title, p.category, p.subCategory, p.weight, p.description, 
            JSON.stringify(p.tags), JSON.stringify(savedImagePaths), p.supplier, p.uploadedBy, 
            p.isHidden, new Date(p.createdAt), p.dateTaken, JSON.stringify(p.meta)
        ];
        await pool.query(query, values);
        
        // Return product with new paths
        res.json({ ...p, images: savedImagePaths });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const p = req.body;

        // Convert any new Base64 images to File Paths
        const savedImagePaths = await processImages(p.images);

        const query = `
            UPDATE products SET
            title=?, category=?, subCategory=?, weight=?, description=?, tags=?, images=?, 
            supplier=?, uploadedBy=?, isHidden=?, dateTaken=?, meta=?
            WHERE id=?
        `;
        const values = [
            p.title, p.category, p.subCategory, p.weight, p.description, 
            JSON.stringify(p.tags), JSON.stringify(savedImagePaths), 
            p.supplier, p.uploadedBy, p.isHidden, p.dateTaken, JSON.stringify(p.meta),
            id
        ];
        await pool.query(query, values);
        res.json({ ...p, images: savedImagePaths });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/config', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT config_json FROM app_config WHERE id = 1');
        res.json(rows.length > 0 ? parseJSON(rows[0].config_json) : {});
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/config', async (req, res) => {
    try {
        await pool.query('UPDATE app_config SET config_json = ? WHERE id = 1', [JSON.stringify(req.body)]);
        res.json(req.body);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/designs', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM designs ORDER BY createdAt DESC');
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/designs', async (req, res) => {
    try {
        const d = req.body;
        // Design images are often generated once; we can also save these to disk if needed
        // For now, keeping them as is (Base64 is often returned by AI), but you can use processImages here too.
        await pool.query(
            'INSERT INTO designs (id, imageUrl, prompt, aspectRatio, createdAt) VALUES (?, ?, ?, ?, ?)',
            [d.id, d.imageUrl, d.prompt, d.aspectRatio, new Date(d.createdAt)]
        );
        res.json(d);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/links', async (req, res) => {
    try {
        const l = req.body;
        await pool.query(
            'INSERT INTO shared_links (id, targetId, type, token, expiresAt) VALUES (?, ?, ?, ?, ?)',
            [l.id, l.targetId, l.type, l.token, new Date(l.expiresAt)]
        );
        res.json(l);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/links/:token', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM shared_links WHERE token = ?', [req.params.token]);
        if (rows.length > 0) {
            const link = rows[0];
            if (new Date(link.expiresAt) > new Date()) res.json(link);
            else res.status(410).json({ error: 'Expired' });
        } else {
            res.status(404).json({ error: 'Not found' });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body || {};
    const user = String(username || '').trim().toLowerCase();
    const pass = String(password || '').trim();

    if (user === 'admin' && pass === 'admin') {
        res.json({ id: 'admin1', name: 'Sanghavi Admin', role: 'admin' });
    } else if (user === 'staff' && pass === 'staff') {
        res.json({ id: 'staff1', name: 'Staff', role: 'contributor' });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(500).send('<h1>500 - Build Not Found</h1><p>The "dist" directory is missing. Please run "npm run build" to compile the frontend.</p>');
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});