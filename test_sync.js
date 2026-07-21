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
    const getWhatsAppConfig = async () => {
        const [rows] = await pool.query('SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ("whatsappNumber", "whatsappToken", "whatsappPhoneId", "whatsappTemplateName", "whatsappWishlistTemplateName", "whatsappWabaId", "whatsappGoldRateTemplateName", "whatsappWelcomeTemplateName")');
        const config = {};
        rows.forEach(r => config[r.setting_key] = r.setting_value);
        return config;
    };
    const config = await getWhatsAppConfig();
    const wabaId = config.whatsappWabaId;
    
    const checkUrl = `https://graph.facebook.com/v17.0/${wabaId}/message_templates?fields=name,status,components,category,language&access_token=${config.whatsappToken}`;
    const checkRes = await fetch(checkUrl);
    const data = await checkRes.json();
    console.log(JSON.stringify(data.data.filter(t => t.name === 'gold_rate_alert_daily'), null, 2));
    process.exit(0);
}
main();
