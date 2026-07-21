const fs = require('fs');
const content = fs.readFileSync('server/routes/products.js', 'utf8');

const replacement = `router.post('/api/products', requireStaff, async (req, res) => {
    try {
        const p = req.body;
        
        // Resolve stream URLs back to original base64/file path if they were duplicated
        const resolveImages = async (urls, isThumb) => {
            if (!urls) return [];
            const resolved = [];
            for (const img of urls) {
                const match = typeof img === 'string' && img.match(/\\/api\\/media\\/stream\\/([^\\/]+)\\/(image|thumb)\\/(\\d+)\\.webp/);
                if (match) {
                    const [_, oldId, type, indexStr] = match;
                    const index = parseInt(indexStr);
                    const [oldDb] = await pool.query('SELECT images, thumbnails FROM products WHERE id = ?', [oldId]);
                    if (oldDb.length > 0) {
                        const colStr = type === 'thumb' ? oldDb[0].thumbnails : oldDb[0].images;
                        const col = typeof colStr === 'string' ? JSON.parse(colStr || '[]') : colStr;
                        resolved.push(col[index] || img);
                        continue;
                    }
                }
                resolved.push(img);
            }
            return resolved;
        };

        p.images = await resolveImages(p.images, false);
        p.thumbnails = await resolveImages(p.thumbnails, true);

        const productData = {
            id: p.id,
            title: p.title,
            category: p.category,
            subCategory: p.subCategory,
            weight: p.weight,
            description: p.description,
            tags: JSON.stringify(p.tags || []),
            images: JSON.stringify(p.images || []),
            thumbnails: JSON.stringify(p.thumbnails || []),
            supplier: p.supplier,
            uploadedBy: p.uploadedBy,
            isHidden: p.isHidden,
            createdAt: p.createdAt,
            dateTaken: p.dateTaken,
            meta: JSON.stringify(p.meta || {})
        };
        await pool.query('INSERT INTO products SET ?', productData);
        CACHE.curated.data = null; // Invalidate cache
        res.status(201).json({ success: true });
    } catch (e) { 
        console.error('Product save error:', e);
        res.status(500).json({ error: 'Internal server error' }); 
    }
});`;

const newContent = content.replace(/router\.post\('\/api\/products', requireStaff, async \(req, res\) => \{[\s\S]*?\} catch \(e\) \{ \s*console\.error\('Product save error:', e\);\s*res\.status\(500\)\.json\(\{ error: 'Internal server error' \}\); \s*\}\s*\}\);/, replacement);
fs.writeFileSync('server/routes/products.js', newContent);
console.log('Patched router.post');
