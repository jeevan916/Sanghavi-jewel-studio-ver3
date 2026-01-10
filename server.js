
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { existsSync, mkdirSync } from 'fs';
import cors from 'cors';
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(process.cwd(), '.builds/config/.env') });

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.use(cors());
app.use(express.json({ limit: '100mb' }));

const DATA_ROOT = path.resolve(process.cwd(), '.builds', 'sanghavi_persistence');
const UPLOADS_ROOT = path.resolve(DATA_ROOT, 'uploads');
const UPLOADS_720 = path.resolve(UPLOADS_ROOT, '720');
const UPLOADS_1080 = path.resolve(UPLOADS_ROOT, '1080');

const ensureFolders = () => {
  [DATA_ROOT, UPLOADS_ROOT, UPLOADS_720, UPLOADS_1080].forEach(dir => {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o777 });
  });
};
ensureFolders();

app.use('/uploads', express.static(UPLOADS_ROOT, { maxAge: '31d', immutable: true }));

/**
 * Enterprise Jewelry Image Pipeline
 * Transcodes to WebP/AVIF, applies sharpening, and creates responsive variants
 */
async function processJewelryImage(base64Data, title) {
  const buffer = Buffer.from(base64Data.replace(/^data:image\/\w+;base64,/, ""), 'base64');
  const slug = (title || 'jewelry').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const hash = crypto.randomBytes(4).toString('hex');
  
  const pipeline = sharp(buffer)
    .rotate() // Auto-orient based on EXIF
    .toColorspace('srgb')
    .removeAlpha() // High-end jewelry looks best on solid backgrounds
    .flatten({ background: { r: 251, g: 248, b: 241 } }); // Studio background

  const variants = [
    { width: 720, dir: UPLOADS_720, quality: 75 },
    { width: 1080, dir: UPLOADS_1080, quality: 82 }
  ];

  const results = { images: [], thumbnails: [] };

  for (const v of variants) {
    const filename = `${slug}_${v.width}_${hash}.webp`;
    const fullPath = path.join(v.dir, filename);
    
    await pipeline
      .clone()
      .resize({ 
        width: v.width, 
        withoutEnlargement: true,
        kernel: sharp.kernel.lanczos3 
      })
      .sharpen({ 
        sigma: 0.5, 
        m1: 2, 
        m2: 20 // Edge-aware sharpening to preserve gold/facets
      })
      .webp({ quality: v.quality, effort: 6, smartSubsample: true })
      .toFile(fullPath);

    const publicUrl = `/uploads/${v.width === 720 ? '720' : '1080'}/${filename}`;
    if (v.width === 720) results.thumbnails.push(publicUrl);
    results.images.push(publicUrl);
  }

  return results;
}

const dbConfig = {
  host: (process.env.DB_HOST || 'localhost').toLowerCase() === 'localhost' ? '127.0.0.1' : process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
};

let pool;
const initDB = async () => {
  try {
    pool = mysql.createPool(dbConfig);
    await pool.query('SELECT 1');
    console.log('[Database] Connected');
  } catch (err) {
    console.error('[Database] Connection failed:', err.message);
    setTimeout(initDB, 5000);
  }
};
initDB();

app.post('/api/products', async (req, res) => {
  const p = req.body;
  try {
    const rawImage = p.images[0];
    if (!rawImage) throw new Error("No image data provided");

    // Process through modern pipeline
    const assetUrls = await processJewelryImage(rawImage, p.title);

    await pool.query(
      'INSERT INTO products (id, title, category, subCategory, weight, description, tags, images, thumbnails, supplier, uploadedBy, isHidden, createdAt, dateTaken, meta) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', 
      [
        p.id, p.title, p.category, p.subCategory, p.weight, p.description, 
        JSON.stringify(p.tags || []), 
        JSON.stringify(assetUrls.images), 
        JSON.stringify(assetUrls.thumbnails), 
        p.supplier, p.uploadedBy, p.isHidden, new Date(), new Date(), 
        JSON.stringify(p.meta || {})
      ]
    );
    res.json({ success: true, assets: assetUrls });
  } catch (e) {
    console.error('[Upload API] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/health', (req, res) => res.json({ status: 'online' }));

app.listen(PORT, HOST, () => console.log(`[Sanghavi Studio] Pipeline Active on port ${PORT}`));
