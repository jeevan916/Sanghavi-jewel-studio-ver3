import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'srv1645.hstgr.io',
  user: process.env.DB_USER || 'u477692720_user',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'u477692720_jewelstudio4'
});

async function main() {
    const [rows] = await pool.query('SELECT * FROM system_settings WHERE setting_key IN ("whatsappToken", "whatsappWabaId")');
    const config = {};
    rows.forEach(r => config[r.setting_key] = r.setting_value);
    
    const wabaId = config.whatsappWabaId;
    const token = config.whatsappToken;
    
    console.log("WABA ID:", wabaId);
    
    // Test creating a mock template
    const payload = {
        name: "test_template_123",
        language: "en_US",
        category: "UTILITY",
        components: [
            {
                type: "BODY",
                text: "Hello this is a test template."
            }
        ]
    };
    
    const res = await fetch(`https://graph.facebook.com/v17.0/${wabaId}/message_templates`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    console.log(await res.json());
    process.exit(0);
}
main();
