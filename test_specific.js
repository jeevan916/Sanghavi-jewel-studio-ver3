import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'srv1645.hstgr.io',
  user: process.env.DB_USER || 'u477692720_user',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'u477692720_jewelstudio4'
});

async function main() {
    const [rows] = await pool.query('SELECT setting_value FROM system_settings WHERE setting_key = "whatsappToken"');
    const token = rows[0].setting_value;
    const [wabaRows] = await pool.query('SELECT setting_value FROM system_settings WHERE setting_key = "whatsappWabaId"');
    const wabaId = wabaRows[0].setting_value;
    
    const url = `https://graph.facebook.com/v17.0/${wabaId}/message_templates?name=gold_rate_alert_daily&access_token=${token}`;
    const res = await fetch(url);
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
    process.exit(0);
}
main();
