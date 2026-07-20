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
    const [logs] = await pool.query('SELECT * FROM whatsapp_logs WHERE message_type LIKE "%template%" OR status = "failed" ORDER BY id DESC LIMIT 20');
    console.log('--- Template Sync/Check Logs & Failed Logs ---');
    console.log(JSON.stringify(logs, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
  process.exit(0);
}
run();
