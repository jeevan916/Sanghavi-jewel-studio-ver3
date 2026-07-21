import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();
async function run() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sanghavi_studio'
  });
  const [rows] = await pool.query('SELECT id, images, thumbnails FROM products WHERE images LIKE "%api/media/stream%" OR thumbnails LIKE "%api/media/stream%" LIMIT 5');
  console.log('Products with stream in db:', rows);
  process.exit(0);
}
run();
