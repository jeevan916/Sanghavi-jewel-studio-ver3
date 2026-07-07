const fs = require('fs');
let content = fs.readFileSync('server/routes/admin.js', 'utf8');

const apiToInject = `    router.post('/api/admin/migrate-blobs', requireAdmin, async (req, res) => {
        try {
            const [products] = await pool.query('SELECT id, images, thumbnails FROM products');
            let updatedCount = 0;
            let totalProcessed = 0;
            const { mkdirSync } = require('fs');

            for (const p of products) {
                let changed = false;
                let images = safeParse(p.images);
                let thumbnails = safeParse(p.thumbnails);

                const processArray = (arr, sizeFolder) => {
                    return arr.map(imgStr => {
                        if (typeof imgStr === 'string' && imgStr.startsWith('data:')) {
                            const matches = imgStr.match(/^data:([a-zA-Z0-9+\\/\\-]+);base64,(.+)$/);
                            if (matches && matches.length === 3) {
                                const mime = matches[1];
                                const b64 = matches[2];
                                const buffer = Buffer.from(b64, 'base64');
                                const hash = getHash(buffer);
                                let ext = 'webp';
                                if (mime.includes('png')) ext = 'png';
                                else if (mime.includes('jpeg')) ext = 'jpg';
                                else if (mime.includes('avif')) ext = 'avif';

                                const filename = \`\${p.id}-\${hash}-\${sizeFolder}w.\${ext}\`;
                                const dir = path.join(UPLOADS_ROOT, sizeFolder);
                                if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
                                const filepath = path.join(dir, filename);

                                if (!existsSync(filepath)) {
                                    writeFileSync(filepath, buffer);
                                }
                                changed = true;
                                totalProcessed++;
                                return \`/uploads/\${sizeFolder}/\${filename}\`;
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
                }
            }

            res.json({ message: \`Successfully migrated \${totalProcessed} blobs across \${updatedCount} products to physical storage.\` });
        } catch(e) {
            console.error('Migration error:', e);
            res.status(500).json({ error: e.message });
        }
    });

`;

content = content.replace("router.post('/api/admin/optimize-storage'", apiToInject + "    router.post('/api/admin/optimize-storage'");

fs.writeFileSync('server/routes/admin.js', content);
console.log('Added migrate-blobs endpoint');
