const fs = require('fs');
let content = fs.readFileSync('server/routes/analytics.js', 'utf-8');
content = content.replace(
    /router\.post\('\/api\/backups', requireAdmin, async \(req, res\) => {[\s\S]*?res\.json\({ success: true, filename: name, size: JSON\.stringify\(products\)\.length }\);\n}\);/,
    `router.post('/api/backups', requireAdmin, async (req, res) => {
    try {
        const name = \`snapshot_\${Date.now()}.json\`;
        const [tables] = await pool.query('SHOW TABLES');
        const dbData = {};
        for (const row of tables) {
            const tableName = Object.values(row)[0];
            const [data] = await pool.query(\`SELECT * FROM \\\`\${tableName}\\\`\`);
            dbData[tableName] = data;
        }
        
        if (!existsSync(BACKUPS_ROOT)) {
            fs.mkdirSync(BACKUPS_ROOT, { recursive: true });
        }
        
        const dumpString = JSON.stringify(dbData);
        writeFileSync(path.join(BACKUPS_ROOT, name), dumpString);
        res.json({ success: true, filename: name, size: dumpString.length });
    } catch (e) {
        console.error("Backup creation failed:", e);
        res.status(500).json({ error: 'Internal server error', message: e.message });
    }
});`
);
fs.writeFileSync('server/routes/analytics.js', content);
