const fs = require('fs');
const content = fs.readFileSync('server/routes/products.js', 'utf8');

const replacement = `router.put('/api/products/:id', requireStaff, async (req, res) => {
    try {
        const p = req.body;
        
        // Fetch existing to restore stream URLs to data URLs
        const [existing] = await pool.query('SELECT images, thumbnails FROM products WHERE id = ?', [req.params.id]);
        if (existing.length > 0) {
            const exImages = typeof existing[0].images === 'string' ? JSON.parse(existing[0].images || '[]') : existing[0].images;
            const exThumbnails = typeof existing[0].thumbnails === 'string' ? JSON.parse(existing[0].thumbnails || '[]') : existing[0].thumbnails;
            
            if (p.images) {
                p.images = p.images.map((img) => {
                    const match = typeof img === 'string' && img.match(/\\/api\\/media\\/stream\\/[^\\/]+\\/image\\/(\\d+)\\.webp/);
                    if (match) return exImages[parseInt(match[1])];
                    return img;
                });
            }
            if (p.thumbnails) {
                p.thumbnails = p.thumbnails.map((img) => {
                    const match = typeof img === 'string' && img.match(/\\/api\\/media\\/stream\\/[^\\/]+\\/thumb\\/(\\d+)\\.webp/);
                    if (match) return exThumbnails[parseInt(match[1])];
                    return img;
                });
            }
        }

        await pool.query('UPDATE products SET ? WHERE id = ?', [{
            title: p.title, category: p.category, subCategory: p.subCategory, weight: p.weight, description: p.description,
            tags: JSON.stringify(p.tags || []), images: JSON.stringify(p.images || []), thumbnails: JSON.stringify(p.thumbnails || []), 
            isHidden: p.isHidden, dateTaken: p.dateTaken, meta: JSON.stringify(p.meta || {})
        }, req.params.id]);
        CACHE.curated.data = null; // Invalidate cache
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Internal server error' }); }`;

const newContent = content.replace(/router\.put\('\/api\/products\/:id', requireStaff, async \(req, res\) => \{[\s\S]*?\} catch \(e\) \{ res\.status\(500\)\.json\(\{ error: 'Internal server error' \}\); \}/, replacement);
fs.writeFileSync('server/routes/products.js', newContent);
console.log('Patched router.put');
