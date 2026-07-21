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
    
    console.log("Phone ID:", config.whatsappPhoneId);
    
    // Check WABA ID for this Phone ID
    const wabaUrl = `https://graph.facebook.com/v17.0/${config.whatsappPhoneId}?fields=whatsapp_business_account&access_token=${config.whatsappToken}`;
    const wabaRes = await fetch(wabaUrl);
    const wabaData = await wabaRes.json();
    console.log("Phone WABA Info:", wabaData);
    process.exit(0);
}
main();
