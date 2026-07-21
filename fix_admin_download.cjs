const fs = require('fs');
let content = fs.readFileSync('server/routes/admin.js', 'utf8');

// Replace the download route
const oldDownload = `    router.get('/api/admin/backups/download/:filename', requireAdmin, (req, res) => {
        const backupsDir = path.join(import.meta.dirname, '..', '..', 'backups');
        const filepath = path.join(backupsDir, req.params.filename);
        if (filepath.startsWith(backupsDir)) {
            res.download(filepath);
        } else {
            res.status(403).json({ error: 'Invalid path' });
        }
    });`;

const newDownload = `    router.get('/api/admin/backups/download/:filename', async (req, res) => {
        try {
            const token = req.query.token;
            if (!token) return res.status(401).send('Missing token');
            
            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
            
            const [rows] = await pool.query('SELECT role, isActive FROM staff WHERE id = ?', [decoded.id]);
            const dbUser = rows[0];
            if (!dbUser || !dbUser.isActive || dbUser.role !== 'admin') {
                return res.status(403).send('Forbidden: Admin access required');
            }

            const path = require('path');
            const backupsDir = path.join(import.meta.dirname, '..', '..', 'backups');
            const filepath = path.join(backupsDir, req.params.filename);
            
            const fs = require('fs');
            if (filepath.startsWith(backupsDir) && fs.existsSync(filepath)) {
                res.download(filepath);
            } else {
                res.status(404).send('File not found');
            }
        } catch(e) {
            res.status(401).send('Invalid token or error: ' + e.message);
        }
    });`;

// Wait, I shouldn't use require inside admin.js as it's ESM
const newDownloadESM = `    router.get('/api/admin/backups/download/:filename', async (req, res) => {
        try {
            const token = req.query.token;
            if (!token) return res.status(401).send('Missing token');
            
            const jwt = (await import('jsonwebtoken')).default;
            const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
            
            const [rows] = await pool.query('SELECT role, isActive FROM staff WHERE id = ?', [decoded.id]);
            const dbUser = rows[0];
            if (!dbUser || !dbUser.isActive || dbUser.role !== 'admin') {
                return res.status(403).send('Forbidden: Admin access required');
            }

            const backupsDir = path.join(import.meta.dirname, '..', '..', 'backups');
            const filepath = path.join(backupsDir, req.params.filename);
            
            if (filepath.startsWith(backupsDir) && existsSync(filepath)) {
                res.download(filepath);
            } else {
                res.status(404).send('File not found');
            }
        } catch(e) {
            res.status(401).send('Invalid token or error: ' + e.message);
        }
    });`;

content = content.replace(/router\.get\('\/api\/admin\/backups\/download\/:filename'[\s\S]*?\}\);/, newDownloadESM);
fs.writeFileSync('server/routes/admin.js', content);
console.log('Fixed download route');
