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
    
    const response = await fetch(`https://graph.facebook.com/v17.0/${config.whatsappPhoneId}/messages`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${config.whatsappToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            messaging_product: "whatsapp",
            to: "919594899734",
            type: "template",
            template: {
                name: "gold_rate_alert_daily",
                language: { code: "en" },
                components: [
                    {
                        type: "body",
                        parameters: [
                            { type: "text", text: "Jeevan" },
                            { type: "text", text: "13000" },
                            { type: "text", text: "14200" }
                        ]
                    }
                ]
            }
        })
    });
    console.log(await response.json());
    process.exit(0);
}
main();
