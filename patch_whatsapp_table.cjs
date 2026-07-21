const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sanghavi_studio'
  });
  
  try {
      await pool.query('ALTER TABLE whatsapp_templates ADD COLUMN sample_variables JSON');
      console.log('Added sample_variables column');
  } catch(e) {
      console.log('Column might already exist:', e.message);
  }
  process.exit(0);
}
run();
