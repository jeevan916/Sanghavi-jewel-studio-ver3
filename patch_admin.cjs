const fs = require('fs');
let content = fs.readFileSync('server/routes/admin.js', 'utf8');

const replacement = `
    router.get('/api/admin/backups', requireAdmin, async (req, res) => {
        try {
            const { getBackupsList } = await import('../backupService.js');
            const backups = getBackupsList();
            res.json({ success: true, backups });
        } catch (e) {
            console.error('Failed to list backups:', e);
            res.status(500).json({ error: 'Failed to list backups' });
        }
    });

    router.post('/api/admin/backups/trigger', requireAdmin, async (req, res) => {
        try {
            const { triggerBackup } = await import('../backupService.js');
            const result = await triggerBackup('manual');
            res.json(result);
        } catch (e) {
            console.error('Failed to trigger backup:', e);
            res.status(500).json({ error: e.message || 'Backup failed' });
        }
    });

    router.delete('/api/admin/backups/:filename', requireAdmin, (req, res) => {
        try {
            const fs = require('fs');
            const path = require('path');
            const backupsDir = path.join(__dirname, '..', '..', 'backups');
            const filepath = path.join(backupsDir, req.params.filename);
            
            // basic security check
            if (filepath.startsWith(backupsDir) && fs.existsSync(filepath)) {
                fs.unlinkSync(filepath);
                res.json({ success: true });
            } else {
                res.status(404).json({ error: 'File not found' });
            }
        } catch (e) {
            res.status(500).json({ error: 'Failed to delete backup' });
        }
    });

    router.get('/api/admin/backups/download/:filename', requireAdmin, (req, res) => {
        const path = require('path');
        const backupsDir = path.join(__dirname, '..', '..', 'backups');
        const filepath = path.join(backupsDir, req.params.filename);
        if (filepath.startsWith(backupsDir)) {
            res.download(filepath);
        } else {
            res.status(403).json({ error: 'Invalid path' });
        }
    });

    return router;
}
`;

content = content.replace("    return router;\n}", replacement);
fs.writeFileSync('server/routes/admin.js', content);
console.log('Patched admin.js');
