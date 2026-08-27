import express from 'express';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireStaff } from '../auth.js';
import { getCuratedOverview, calculateCuratedOverview } from '../curatedService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_ROOT = path.resolve(__dirname, '..', '..', 'data');
const DEMO_MODE = false;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export default function productsRoutes(pool, CACHE, sanitizeProduct) {
    const router = express.Router();

router.get('/api/products', async (req, res) => {
  try {
    if (DEMO_MODE) {
        const demoPath = path.join(DATA_ROOT, 'demo_products.json');
        if (existsSync(demoPath)) {
            let data = JSON.parse(readFileSync(demoPath, 'utf8'));
            
            // Apply basic filters for demo mode
            if (req.query.category && req.query.category !== 'All') {
                data = data.filter(item => item.category === req.query.category);
            }
            if (req.query.subCategory && req.query.subCategory !== 'All') {
                data = data.filter(item => item.subCategory === req.query.subCategory);
            }
            if (req.query.search) {
                const term = req.query.search.toLowerCase();
                data = data.filter(item => item.title?.toLowerCase().includes(term) || JSON.stringify(item.tags || []).toLowerCase().includes(term));
            }

            return res.json({ 
                items: data, 
                meta: { page: 1, limit: 100, totalPages: 1, totalItems: data.length, demo: true } 
            });
        }
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 1000;
    const offset = (page - 1) * limit;
    const isPublic = req.query.public === 'true';
    const category = req.query.category;
    const subCategory = req.query.subCategory;
    const search = req.query.search;
    const summary = req.query.summary === 'true';

    let query = summary 
        ? 'SELECT id, title, category, subCategory, weight, thumbnails, isHidden, createdAt, meta FROM products WHERE 1=1'
        : 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (isPublic) {
        query += ' AND isHidden = 0';
    }
    
    if (category && category !== 'All') {
        query += ' AND category = ?';
        params.push(category);
    }

    if (subCategory) {
        query += ' AND subCategory = ?';
        params.push(subCategory);
    }

    if (search) {
        query += ' AND (title LIKE ? OR tags LIKE ?)';
        const likeSearch = `%${search}%`;
        params.push(likeSearch, likeSearch);
    }

    // Clone query for count BEFORE adding limit/offset
    const countQuery = query.replace(/^SELECT .* FROM products/, 'SELECT COUNT(*) as total FROM products');
    
    query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const [rows] = await pool.query(query, params);
    
    // Count parameter handling: params for count query don't include limit/offset
    const countParams = params.slice(0, params.length - 2); 
    const [count] = await pool.query(countQuery, countParams);
    
    res.json({ 
        items: rows.map(sanitizeProduct), 
        meta: { page, limit, totalPages: Math.ceil(count[0].total / limit), totalItems: count[0].total } 
    });
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/api/products/curated', async (req, res) => {
    try {
        // Fast-path: Return pre-calculated 03:00 AM server overview snapshot immediately
        let data = getCuratedOverview(CACHE);
        if (data) {
            res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400');
            return res.json(data);
        }

        // If not ready yet, calculate once and cache
        data = await calculateCuratedOverview(pool, sanitizeProduct, CACHE);
        if (data) {
            res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400');
            return res.json(data);
        }

        return res.json({ latest: [], loved: [], trending: [], ideal: [] });
    } catch (e) {
        console.error('[Products Route] Error serving curated products:', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/api/products/curated/recalculate', requireStaff, async (req, res) => {
    try {
        const data = await calculateCuratedOverview(pool, sanitizeProduct, CACHE);
        res.json({ success: true, message: 'Curated overview recalculated and cached successfully', meta: data?.meta });
    } catch (e) {
        console.error('[Products Route] Error recalculating curated overview:', e);
        res.status(500).json({ error: 'Recalculation failed' });
    }
});

router.get('/api/products/:id', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
        rows[0] ? res.json(sanitizeProduct(rows[0])) : res.status(404).json({ error: 'Not found' });
    } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/api/products/:id/stats', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT type, COUNT(*) as c FROM analytics WHERE productId = ? GROUP BY type', [req.params.id]);
        const stats = { like: 0, dislike: 0, inquiry: 0, sold: 0, view: 0 };
        rows.forEach(r => { if(stats.hasOwnProperty(r.type)) stats[r.type] = r.c; });
        res.json(stats);
    } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/api/products/:id/related', async (req, res) => {
    try {
        const [productRows] = await pool.query('SELECT category, tags FROM products WHERE id = ?', [req.params.id]);
        if (productRows.length === 0) return res.json([]);
        
        const { category, tags: tagsJson } = productRows[0];
        const tags = safeParse(tagsJson, []);
        
        // Find products in same category, excluding current one
        let query = 'SELECT * FROM products WHERE id != ? AND isHidden = 0';
        const params = [req.params.id];
        
        if (category) {
            query += ' AND category = ?';
            params.push(category);
        }
        
        // Fetch latest 20 in same category to filter/sort by tags
        query += ' ORDER BY createdAt DESC LIMIT 20';
        
        const [rows] = await pool.query(query, params);
        let related = rows.map(sanitizeProduct);
        
        // Simple tag matching boost if tags exist
        if (tags && tags.length > 0) {
            related = related.sort((a, b) => {
                const aMatches = (a.tags || []).filter(t => tags.includes(t)).length;
                const bMatches = (b.tags || []).filter(t => tags.includes(t)).length;
                return bMatches - aMatches;
            });
        }
        
        res.json(related.slice(0, 8));
    } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/api/products', requireStaff, async (req, res) => {
    try {
        const p = req.body;
        
        // Resolve stream URLs back to original base64/file path if they were duplicated
        const resolveImages = async (urls, isThumb) => {
            if (!urls) return [];
            const resolved = [];
            for (const img of urls) {
                const match = typeof img === 'string' && img.match(/\/api\/media\/stream\/([^\/]+)\/(image|thumb)\/(\d+)\.webp/);
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
});

router.put('/api/products/:id', requireStaff, async (req, res) => {
    try {
        const p = req.body;
        
        // Fetch existing to restore stream URLs to data URLs
        const [existing] = await pool.query('SELECT images, thumbnails FROM products WHERE id = ?', [req.params.id]);
        if (existing.length > 0) {
            const exImages = typeof existing[0].images === 'string' ? JSON.parse(existing[0].images || '[]') : existing[0].images;
            const exThumbnails = typeof existing[0].thumbnails === 'string' ? JSON.parse(existing[0].thumbnails || '[]') : existing[0].thumbnails;
            
            if (p.images) {
                p.images = p.images.map((img) => {
                    const match = typeof img === 'string' && img.match(/\/api\/media\/stream\/[^\/]+\/image\/(\d+)\.webp/);
                    if (match) return exImages[parseInt(match[1])];
                    return img;
                });
            }
            if (p.thumbnails) {
                p.thumbnails = p.thumbnails.map((img) => {
                    const match = typeof img === 'string' && img.match(/\/api\/media\/stream\/[^\/]+\/thumb\/(\d+)\.webp/);
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
    } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/api/products/:id', requireStaff, async (req, res) => {
    try {
        await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
        CACHE.curated.data = null; // Invalidate cache
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

// Other Entities

    return router;
}
