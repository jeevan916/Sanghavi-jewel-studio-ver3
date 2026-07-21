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
    
    // According to Meta Docs, you can get WABA by using ?fields=whatsapp_business_account on the phone ID, but it failed with code 100.
    // Let's try getting it via WhatsApp Business API info?
    const url = 'https://graph.facebook.com/v17.0/1107561095767994?fields=account_id&access_token=' + token;
    const res = await fetch(url);
    console.log(await res.json());
    
    // Let's try to query templates of the WABA provided in config, maybe gold_rate_alert_daily DOES exist there? Yes, it did exist in WABA 105647948987401.
    process.exit(0);
}
main();
