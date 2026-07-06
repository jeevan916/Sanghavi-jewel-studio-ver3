require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const cleanEnv = (val) => val ? val.toString().replace(/^['"]|['"]$/g, '').trim() : '';

const DATA_ROOT = path.resolve(__dirname, 'data');
const UPLOADS_ROOT = path.resolve(DATA_ROOT, 'uploads');
const getHash = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 12);

async function run() {
  const pool = mysql.createPool({
    host: cleanEnv(process.env.DB_HOST) || 'localhost',
    user: cleanEnv(process.env.DB_USER) || 'root',
    password: cleanEnv(process.env.DB_PASSWORD) || '',
    database: cleanEnv(process.env.DB_NAME) || 'sanghavi_studio',
  });

  const [products] = await pool.query('SELECT id, title, images, thumbnails FROM products');
  
  for (const p of products) {
    let images = p.images ? JSON.parse(p.images) : [];
    let thumbnails = p.thumbnails ? JSON.parse(p.thumbnails) : [];
    let updated = false;

    for (let i = 0; i < images.length; i++) {
        if (typeof images[i] === 'string' && images[i].startsWith('data:image')) {
            const base64 = images[i].split(',')[1];
            const buffer = Buffer.from(base64, 'base64');
            const safeName = p.id;
            const contentHash = getHash(buffer);
            const filename = `${contentHash}-${safeName}-1080w.webp`;
            const filepath = path.join(UPLOADS_ROOT, '1080', filename);
            if (!fs.existsSync(filepath)) {
                try {
                    await sharp(buffer).rotate().resize(1080, null, { withoutEnlargement: true }).toFormat('webp', { quality: 85 }).toFile(filepath);
                } catch(e) { console.log('error sharp', e); continue; }
            }
            images[i] = `/uploads/1080/${filename}`;
            updated = true;
        }
    }

    for (let i = 0; i < thumbnails.length; i++) {
        if (typeof thumbnails[i] === 'string' && thumbnails[i].startsWith('data:image')) {
            const base64 = thumbnails[i].split(',')[1];
            const buffer = Buffer.from(base64, 'base64');
            const safeName = p.id;
            const contentHash = getHash(buffer);
            const filename = `${contentHash}-${safeName}-300w.webp`;
            const filepath = path.join(UPLOADS_ROOT, '300', filename);
            if (!fs.existsSync(filepath)) {
                try {
                    await sharp(buffer).rotate().resize(300, null, { withoutEnlargement: true }).toFormat('webp', { quality: 80 }).toFile(filepath);
                } catch(e) { console.log('error sharp', e); continue; }
            }
            thumbnails[i] = `/uploads/300/${filename}`;
            updated = true;
        }
    }

    if (updated) {
        console.log(`Updating ${p.id}...`);
        await pool.query('UPDATE products SET images = ?, thumbnails = ? WHERE id = ?', [JSON.stringify(images), JSON.stringify(thumbnails), p.id]);
    }
  }
  
  console.log('Done!');
  process.exit(0);
}

run();
