const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf-8');

const backupLogic = `
async function runAutoBackup() {
    try {
        if (!pool) return;
        const name = \`autobackup_\${Date.now()}.json\`;
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
        
        // Clean up old auto-backups to save space (keep last 7)
        const files = fs.readdirSync(BACKUPS_ROOT).filter(f => f.startsWith('autobackup_'));
        if (files.length >= 7) {
            files.sort(); // older timestamps will sort first
            const toDelete = files.slice(0, files.length - 6);
            for (const f of toDelete) {
                fs.unlinkSync(path.join(BACKUPS_ROOT, f));
            }
        }

        const dumpString = JSON.stringify(dbData);
        fs.writeFileSync(path.join(BACKUPS_ROOT, name), dumpString);
        console.log('[AutoBackup] Database backup created:', name);
    } catch (e) {
        console.error("[AutoBackup] Failed:", e.message);
    }
}
`;

content = content.replace(
    /async function fetchGoldRates\(\) \{/,
    backupLogic + '\nasync function fetchGoldRates() {'
);

content = content.replace(
    /setInterval\(fetchGoldRates, 15 \* 60 \* 1000\); \/\/ Every 15 minutes/,
    'setInterval(fetchGoldRates, 15 * 60 * 1000); // Every 15 minutes\n    runAutoBackup();\n    setInterval(runAutoBackup, 24 * 60 * 60 * 1000); // Every 24 hours'
);

fs.writeFileSync('server.js', content);
