import express from 'express';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
            const data = JSON.parse(readFileSync(demoPath, 'utf8'));
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
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    
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
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/api/products/curated', async (req, res) => {
    try {
        const now = Date.now();
        if (CACHE.curated.data && (now - CACHE.curated.lastFetch < CACHE_TTL)) {
            return res.json(CACHE.curated.data);
        }

        if (DEMO_MODE) {
            const demoPath = path.join(DATA_ROOT, 'demo_products.json');
            if (existsSync(demoPath)) {
                const data = JSON.parse(readFileSync(demoPath, 'utf8'));
                const demoCurated = {
                    latest: data,
                    loved: data,
                    trending: data,
                    ideal: data
                };
                CACHE.curated.data = demoCurated;
                CACHE.curated.lastFetch = now;
                return res.json(demoCurated);
            }
        }
        
        // 1. Latest Arrivals
        const [latestRows] = await pool.query('SELECT * FROM products WHERE isHidden = 0 ORDER BY createdAt DESC LIMIT 8');
        
        // 2. Loved (Most Liked)
        const [lovedRows] = await pool.query(`
            SELECT p.*, 
            (SELECT COUNT(*) FROM analytics a WHERE a.productId = p.id AND a.type = 'like') as likeCount 
            FROM products p 
            WHERE p.isHidden = 0 
            ORDER BY likeCount DESC, p.createdAt DESC 
            LIMIT 8
        `);

        // 3. Trending (Weighted score of activity in last 30 days)
        const [trendingRows] = await pool.query(`
            SELECT p.*, 
            (SELECT COALESCE(SUM(
                CASE 
                    WHEN a.type = 'inquiry' THEN 5 
                    WHEN a.type = 'screenshot' THEN 4
                    WHEN a.type = 'like' THEN 3
                    WHEN a.type = 'view' THEN 1
                    ELSE 0 
                END
            ), 0) FROM analytics a WHERE a.productId = p.id AND a.timestamp > DATE_SUB(NOW(), INTERVAL 30 DAY)) as activityScore 
            FROM products p 
            WHERE p.isHidden = 0 
            ORDER BY activityScore DESC, p.createdAt DESC 
            LIMIT 8
        `);

        // 4. Ideal (Random selection to keep it fresh for the user, or fallback to oldest/classic pieces)
        const [idealRows] = await pool.query(`
            SELECT * FROM products 
            WHERE isHidden = 0 
            ORDER BY RAND() 
            LIMIT 4
        `);

        const curated = {
            latest: latestRows.map(sanitizeProduct),
            loved: lovedRows.map(sanitizeProduct),
            trending: trendingRows.map(sanitizeProduct),
            ideal: idealRows.map(sanitizeProduct)
        };
        
        CACHE.curated.data = curated;
        CACHE.curated.lastFetch = now;
        res.json(curated);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/api/products/:id', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
        rows[0] ? res.json(sanitizeProduct(rows[0])) : res.status(404).json({ error: 'Not found' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/api/products/:id/stats', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT type, COUNT(*) as c FROM analytics WHERE productId = ? GROUP BY type', [req.params.id]);
        const stats = { like: 0, dislike: 0, inquiry: 0, sold: 0, view: 0 };
        rows.forEach(r => { if(stats.hasOwnProperty(r.type)) stats[r.type] = r.c; });
        res.json(stats);
    } catch (e) { res.status(500).json({ error: e.message }); }
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
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/api/products', async (req, res) => {
    try {
        const p = req.body;
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
        res.status(500).json({ error: e.message }); 
    }
});

router.put('/api/products/:id', async (req, res) => {
    try {
        const p = req.body;
        await pool.query('UPDATE products SET ? WHERE id = ?', [{
            title: p.title, category: p.category, subCategory: p.subCategory, weight: p.weight, description: p.description,
            tags: JSON.stringify(p.tags || []), images: JSON.stringify(p.images || []), thumbnails: JSON.stringify(p.thumbnails || []), 
            isHidden: p.isHidden, dateTaken: p.dateTaken, meta: JSON.stringify(p.meta || {})
        }, req.params.id]);
        CACHE.curated.data = null; // Invalidate cache
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/api/products/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
        CACHE.curated.data = null; // Invalidate cache
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Other Entities

    return router;
}
