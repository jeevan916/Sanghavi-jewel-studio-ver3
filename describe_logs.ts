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
  
  try {
    const [columns] = await pool.query('DESCRIBE whatsapp_logs');
    console.log('--- Columns ---', columns);
    const [rows] = await pool.query('SELECT * FROM whatsapp_logs WHERE message_type = "template_sync" OR message_type = "template_check"');
    console.log('--- Sync/Check Logs ---', rows);
  } catch (error) {
    console.error('Error:', error);
  }
  process.exit(0);
}
run();
