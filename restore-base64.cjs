require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const cleanEnv = (val) => val ? val.toString().replace(/^['"]|['"]$/g, '').trim() : '';
const DATA_ROOT = path.resolve(__dirname, 'data');

async function run() {
  const pool = mysql.createPool({
    host: cleanEnv(process.env.DB_HOST) || 'localhost',
    user: cleanEnv(process.env.DB_USER) || 'root',
    password: cleanEnv(process.env.DB_PASSWORD) || '',
    database: cleanEnv(process.env.DB_NAME) || 'sanghavi_studio',
  });

  const [products] = await pool.query('SELECT id, images, thumbnails FROM products');
  
  for (const p of products) {
    let images = p.images ? (typeof p.images === 'string' ? JSON.parse(p.images) : p.images) : [];
    let thumbnails = p.thumbnails ? (typeof p.thumbnails === 'string' ? JSON.parse(p.thumbnails) : p.thumbnails) : [];
    let updated = false;

    for (let i = 0; i < images.length; i++) {
        if (typeof images[i] === 'string' && images[i].startsWith('/uploads/')) {
            const filepath = path.join(__dirname, 'data', images[i]);
            if (fs.existsSync(filepath)) {
                const buffer = fs.readFileSync(filepath);
                const base64 = buffer.toString('base64');
                const ext = filepath.endsWith('.png') ? 'png' : filepath.endsWith('.jpeg') || filepath.endsWith('.jpg') ? 'jpeg' : 'webp';
                images[i] = `data:image/${ext};base64,${base64}`;
                updated = true;
            } else {
                console.log('Missing file:', filepath);
            }
        }
    }

    for (let i = 0; i < thumbnails.length; i++) {
        if (typeof thumbnails[i] === 'string' && thumbnails[i].startsWith('/uploads/')) {
            const filepath = path.join(__dirname, 'data', thumbnails[i]);
            if (fs.existsSync(filepath)) {
                const buffer = fs.readFileSync(filepath);
                const base64 = buffer.toString('base64');
                const ext = filepath.endsWith('.png') ? 'png' : filepath.endsWith('.jpeg') || filepath.endsWith('.jpg') ? 'jpeg' : 'webp';
                thumbnails[i] = `data:image/${ext};base64,${base64}`;
                updated = true;
            } else {
                console.log('Missing file:', filepath);
            }
        }
    }

    if (updated) {
        console.log(`Restoring ${p.id}...`);
        await pool.query('UPDATE products SET images = ?, thumbnails = ? WHERE id = ?', [JSON.stringify(images), JSON.stringify(thumbnails), p.id]);
    }
  }
  
  console.log('Done restoring!');
  process.exit(0);
}

run();
