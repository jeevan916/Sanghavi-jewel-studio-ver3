const fs = require('fs');
let content = fs.readFileSync('server/routes/analytics.js', 'utf-8');

const restoreRoute = `
router.post('/api/backups/restore/:name', requireAdmin, async (req, res) => {
    try {
        const filePath = path.join(BACKUPS_ROOT, req.params.name);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Backup not found' });
        }
        
        const backupData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            
            // For each table in the backup, clear and insert
            for (const [tableName, rows] of Object.entries(backupData)) {
                // Ignore analytics and logs if they are huge, but for now we restore everything
                await conn.query(\`DELETE FROM \\\`\${tableName}\\\`\`);
                if (rows.length > 0) {
                    // Extract columns
                    const columns = Object.keys(rows[0]);
                    const values = rows.map(row => columns.map(col => row[col]));
                    
                    // We insert in chunks to avoid max_allowed_packet issues
                    const chunkSize = 500;
                    for (let i = 0; i < values.length; i += chunkSize) {
                        const chunk = values.slice(i, i + chunkSize);
                        const placeholders = chunk.map(() => '(' + columns.map(() => '?').join(',') + ')').join(',');
                        const flatValues = chunk.flat();
                        
                        await conn.query(
                            \`INSERT INTO \\\`\${tableName}\\\` (\${columns.map(c => '\`' + c + '\`').join(',')}) VALUES \${placeholders}\`,
                            flatValues
                        );
                    }
                }
            }
            
            await conn.commit();
            res.json({ success: true });
        } catch (dbError) {
            await conn.rollback();
            throw dbError;
        } finally {
            conn.release();
        }
    } catch (e) {
        console.error("Backup restore failed:", e);
        res.status(500).json({ error: 'Internal server error', message: e.message });
    }
});
`;

// Insert the route after the download route
content = content.replace(
    /router\.get\('\/api\/backups\/download\/:name', requireAdmin, \(req, res\) => \{[\s\S]*?res\.status\(404\)\.send\('Backup not found'\);\n    \}\n\}\);/,
    match => match + '\n' + restoreRoute
);

fs.writeFileSync('server/routes/analytics.js', content);
