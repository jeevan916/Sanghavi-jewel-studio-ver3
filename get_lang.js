import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'srv1645.hstgr.io',
  user: process.env.DB_USER || 'u477692720_user',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'u477692720_jewelstudio4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function main() {
  const [rows] = await pool.query('SELECT name, language, body_text FROM whatsapp_templates WHERE name = "gold_rate_alert_daily"');
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}
main();
