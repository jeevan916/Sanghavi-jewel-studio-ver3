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
  const [rows] = await pool.query('SELECT images FROM products WHERE id = ?', ['17702440682839559']);
  console.log('Images for product:', rows[0]);
  process.exit(0);
}
run();
