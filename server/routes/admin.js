import * as fs from 'fs';
import express from 'express';
import { existsSync, mkdirSync, readdirSync, statSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { requireAdmin } from '../auth.js';

export default function adminRoutes(pool, UPLOADS_ROOT, DATA_ROOT) {
    const router = express.Router();

    router.get('/api/admin/storage-config', requireAdmin, (req, res) => {
        try {
            res.json({
                uploadsRoot: UPLOADS_ROOT,
                dataRoot: DATA_ROOT,
                engineFolders: ['1080', '300'],
                imageFormats: ['webp', 'mp4 (for videos)']
            });
        } catch(e) {
            res.status(500).json({ error: e.message });
        }
    });
    
    function safeParse(str, fallback = []) {
        try { return JSON.parse(str); } catch { return fallback; }
    }
    
    const getHash = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex').substring(0, 16);

    const logFile = path.join(DATA_ROOT, 'migration.log');
    const logMigration = (msg) => {
        const line = `[${new Date().toISOString()}] ${msg}\n`;
        try { fs.appendFileSync(logFile, line); } catch(e) { console.error('Failed to write log', e); }
    };

    
    router.get('/api/admin/migration-status', requireAdmin, async (req, res) => {
        try {
            const [products] = await pool.query('SELECT id, images FROM products');
            let pendingCount = 0;
            let pendingProducts = [];
            
            for (const p of products) {
                let images = safeParse(p.images);
                let hasBase64 = images.some(img => typeof img === 'string' && img.startsWith('data:'));
                if (hasBase64) {
                    pendingCount++;
                    pendingProducts.push(p.id);
                }
            }
            
            res.json({ pendingCount, pendingProducts: pendingProducts.slice(0, 50) }); // Send top 50
        } catch(e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.get('/api/admin/migration-log', requireAdmin, (req, res) => {
        try {
            if (!existsSync(logFile)) return res.json({ logs: [] });
            const data = fs.readFileSync(logFile, 'utf8');
            const lines = data.split('\n').filter(Boolean);
            res.json({ logs: lines.slice(-20) });
        } catch(e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Make migration asynchronous so it doesn't block
    router.post('/api/admin/migrate-blobs', requireAdmin, async (req, res) => {
        const { productId } = req.body || {};
        
        // Return immediately
        res.json({ message: productId ? `Migration started for product ${productId}` : 'Migration started in background' });
        
        try {
            logMigration(productId ? `Starting blob migration for product ${productId}...` : 'Starting blob migration for all products...');
            
            let query = 'SELECT id, images, thumbnails FROM products';
            let params = [];
            if (productId) {
                query += ' WHERE id = ?';
                params.push(productId);
            }
            
            const [products] = await pool.query(query, params);
            let updatedCount = 0;
            let totalProcessed = 0;
            
            for (const p of products) {
                let changed = false;
                let images = safeParse(p.images);
                let thumbnails = safeParse(p.thumbnails);

                const processArray = (arr, sizeFolder) => {
                    return arr.map(imgStr => {
                        if (typeof imgStr === 'string' && imgStr.startsWith('data:')) {
                            const matches = imgStr.match(/^data:([a-zA-Z0-9+\/\-]+);base64,(.+)$/);
                            if (matches && matches.length === 3) {
                                const mime = matches[1];
                                const b64 = matches[2];
                                const buffer = Buffer.from(b64, 'base64');
                                const hash = getHash(buffer);
                                let ext = 'webp';
                                if (mime.includes('png')) ext = 'png';
                                else if (mime.includes('jpeg')) ext = 'jpg';
                                else if (mime.includes('avif')) ext = 'avif';

                                const filename = `${p.id}-${hash}-${sizeFolder}w.${ext}`;
                                const dir = path.join(UPLOADS_ROOT, sizeFolder);
                                if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
                                const filepath = path.join(dir, filename);

                                if (!existsSync(filepath)) {
                                    writeFileSync(filepath, buffer);
                                }
                                changed = true;
                                totalProcessed++;
                                logMigration(`Extracted blob to ${filename}`);
                                return `/uploads/${sizeFolder}/${filename}`;
                            }
                        }
                        return imgStr;
                    });
                };

                images = processArray(images, '1080');
                thumbnails = processArray(thumbnails, '300');

                if (changed) {
                    await pool.query('UPDATE products SET images = ?, thumbnails = ? WHERE id = ?', [JSON.stringify(images), JSON.stringify(thumbnails), p.id]);
                    updatedCount++;
                    logMigration(`Updated DB references for product ${p.id}`);
                }
            }

            logMigration(`Migration completed. Migrated ${totalProcessed} blobs across ${updatedCount} products.`);
        } catch(e) {
            logMigration(`Migration failed: ${e.message}`);
            console.error('Migration error:', e);
        }
    });

    router.post('/api/admin/optimize-storage', requireAdmin, async (req, res) => {
        try {
            const [products] = await pool.query('SELECT id, images, thumbnails FROM products');
            const usedFiles = new Set();
            
            for (const p of products) {
                const images = safeParse(p.images);
                const thumb = safeParse(p.thumbnails);
                images.forEach(i => usedFiles.add(path.basename(i)));
                thumb.forEach(t => usedFiles.add(path.basename(t)));
            }

            let deletedCount = 0;
            let bytesFreed = 0;
            const sizes = ['300', '1080', 'original'];
            
            for (const size of sizes) {
                const dir = path.join(UPLOADS_ROOT, size);
                if (existsSync(dir)) {
                    const files = readdirSync(dir);
                    for (const file of files) {
                        if (!usedFiles.has(file)) {
                            const filepath = path.join(dir, file);
                            const stats = statSync(filepath);
                            if (!stats.isDirectory()) {
                                bytesFreed += stats.size;
                                unlinkSync(filepath);
                                deletedCount++;
                            }
                        }
                    }
                }
            }

            res.json({ success: true, deletedCount, bytesFreed });
        } catch (e) {
            res.status(500).json({ error: 'Internal server error' });
        }
    });

router.post('/api/admin/deduplicate-storage', requireAdmin, async (req, res) => {
        try {
            const [products] = await pool.query('SELECT id, images, thumbnails FROM products');
            const oldToNewMap = new Map();
            const sizes = ['300', '1080', 'original'];
            let spaceSaved = 0;
            let dbUpdates = 0;

            for (const size of sizes) {
                const dir = path.join(UPLOADS_ROOT, size);
                if (!existsSync(dir)) continue;
                
                const files = readdirSync(dir);
                for (const filename of files) {
                    const filepath = path.join(dir, filename);
                    if (statSync(filepath).isDirectory()) continue;

                    const buffer = readFileSync(filepath);
                    const stats = statSync(filepath);
                    const hash = getHash(buffer);
                    const ext = path.extname(filename);
                    const slug = filename.split('-')[0] || 'asset';
                    const newFilename = `${hash}-${slug}-${size}w${ext}`;
                    
                    oldToNewMap.set(`${size}/${filename}`, newFilename);

                    const newFilepath = path.join(dir, newFilename);
                    if (filename !== newFilename) {
                        if (existsSync(newFilepath)) {
                            spaceSaved += stats.size;
                            unlinkSync(filepath);
                        } else {
                            writeFileSync(newFilepath, buffer);
                            unlinkSync(filepath);
                        }
                    }
                }
            }

            for (const product of products) {
                const images = safeParse(product.images);
                const thumbnails = safeParse(product.thumbnails);
                let changed = false;

                const updateList = (list, size) => {
                    return list.map(url => {
                        if (!url || typeof url !== 'string' || !url.startsWith('/uploads/')) return url;
                        const oldName = path.basename(url);
                        const newName = oldToNewMap.get(`${size}/${oldName}`);
                        if (newName && oldName !== newName) {
                            changed = true;
                            return `/uploads/${size}/${newName}`;
                        }
                        return url;
                    });
                };

                const newImages = updateList(images, '1080');
                const newThumbnails = updateList(thumbnails, '300');

                if (changed) {
                    await pool.query('UPDATE products SET images = ?, thumbnails = ? WHERE id = ?', 
                        [JSON.stringify(newImages), JSON.stringify(newThumbnails), product.id]);
                    dbUpdates++;
                }
            }

            res.json({ success: true, message: "Deduplication complete", dbUpdates, spaceSaved });
        } catch (e) {
            res.status(500).json({ error: 'Internal server error' });
        }
    });


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
            res.json({ success: true, message: 'Backup started in background. Please refresh the page in a few minutes to see it.' });
            
            // Run in background
            import('../backupService.js').then(({ triggerBackup }) => {
                triggerBackup('manual').catch(e => {
                    console.error('Failed to run background backup:', e);
                });
            }).catch(e => {
                console.error('Failed to load backupService:', e);
            });
        } catch (e) {
            console.error('Failed to trigger backup:', e);
            if (!res.headersSent) {
                res.status(500).json({ error: e.message || 'Backup failed' });
            }
        }
    });

    router.delete('/api/admin/backups/:filename', requireAdmin, (req, res) => {
        try {
            
            
            const backupsDir = path.join(import.meta.dirname, '..', '..', 'backups');
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

        router.get('/api/admin/backups/download/:filename', async (req, res) => {
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
    });

    return router;
}

