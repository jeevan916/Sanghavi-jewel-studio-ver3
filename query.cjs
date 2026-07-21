const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sanghavi_studio'
  });
  const [rows] = await pool.query('SELECT images FROM products WHERE id = "17843693667368823"');
  console.log(rows[0]);
  process.exit(0);
}
run();
