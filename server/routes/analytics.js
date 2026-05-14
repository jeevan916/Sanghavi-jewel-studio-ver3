import express from 'express';
import crypto from 'crypto';

import fs from 'fs';
import path from 'path';

export default function analyticsRoutes(pool, BACKUPS_ROOT) {
    const router = express.Router();

router.post('/api/analytics', async (req, res) => {
    try {
        const body = { ...req.body };
        if (body.meta && typeof body.meta === 'object') {
            body.meta = JSON.stringify(body.meta);
        }
        const event = { id: crypto.randomUUID(), ...body, timestamp: new Date() };
        await pool.query('INSERT INTO analytics SET ?', event);
        res.status(201).json(event);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/api/analytics', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM analytics ORDER BY timestamp DESC LIMIT 500');
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/api/analytics/user/:userId', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM analytics WHERE userId = ? ORDER BY timestamp DESC LIMIT 1000', [req.params.userId]);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/api/intelligence', async (req, res) => {
    try {
        const [p] = await pool.query('SELECT COUNT(*) as c FROM products');
        const [cust] = await pool.query('SELECT COUNT(*) as c FROM customers');
        const [inq] = await pool.query('SELECT COUNT(*) as c FROM analytics WHERE type="inquiry"');
        res.json({ summary: { totalInventory: p[0].c, totalLeads: cust[0].c, activeInquiries: inq[0].c } });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

    const { writeFileSync, existsSync, readdirSync, statSync } = fs;

router.post('/api/backups', async (req, res) => {
    const name = `snapshot_${Date.now()}.json`;
    const [products] = await pool.query('SELECT * FROM products');
    writeFileSync(path.join(BACKUPS_ROOT, name), JSON.stringify(products));
    res.json({ success: true, filename: name, size: JSON.stringify(products).length });
});

router.get('/api/backups', (req, res) => {
    if (!existsSync(BACKUPS_ROOT)) return res.json([]);
    res.json(readdirSync(BACKUPS_ROOT).filter(f => f.endsWith('.json')).map(f => ({ name: f, date: statSync(path.join(BACKUPS_ROOT, f)).mtime, size: statSync(path.join(BACKUPS_ROOT, f)).size })));
});

router.get('/api/backups/download/:name', (req, res) => {
    // Note: The frontend appends ?key=..., we can validate if needed
    const filePath = path.join(BACKUPS_ROOT, req.params.name);
    if (existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).send('Backup not found');
    }
});

router.post('/api/instagram/sync', async (req, res) => {
    try {
        const [settingsRows] = await pool.query('SELECT setting_value FROM system_settings WHERE setting_key = "instagramToken"');
        const token = settingsRows[0]?.setting_value;
        if (!token) return res.status(400).json({ error: "No Instagram Token configured" });

        let igAccountId = null;
        let isBusinessGraph = false;

        // 1. Try Page Token
        const mePageRes = await fetch(`https://graph.facebook.com/v20.0/me?fields=instagram_business_account&access_token=${token}`);
        const mePageData = await mePageRes.json();
        if (mePageData.instagram_business_account?.id) {
            igAccountId = mePageData.instagram_business_account.id;
            isBusinessGraph = true;
        }

        // 2. Try User Token
        if (!igAccountId) {
            const pagesRes = await fetch(`https://graph.facebook.com/v20.0/me/accounts?fields=instagram_business_account&access_token=${token}`);
            const pagesData = await pagesRes.json();
            for (const page of (pagesData.data || [])) {
                if (page.instagram_business_account?.id) {
                    igAccountId = page.instagram_business_account.id;
                    isBusinessGraph = true;
                    break;
                }
            }
        }
        
        let mediaData = null;
        if (isBusinessGraph && igAccountId) {
            // Fetch recent media
            const mediaRes = await fetch(`https://graph.facebook.com/v20.0/${igAccountId}/media?fields=id&limit=10&access_token=${token}`);
            mediaData = await mediaRes.json();
        } else {
            // Fallback
            const mediaRes = await fetch(`https://graph.instagram.com/me/media?fields=id&limit=10&access_token=${token}`);
            mediaData = await mediaRes.json();
        }
        
        if (!mediaData || !mediaData.data) return res.status(400).json({ error: "Failed to fetch media", details: mediaData });

        let totalInserted = 0;
        for (const item of mediaData.data) {
            // Fetch comments for each media
            const commUrl = isBusinessGraph 
                 ? `https://graph.facebook.com/v20.0/${item.id}/comments?fields=id,text,timestamp,username&access_token=${token}`
                 : `https://graph.instagram.com/${item.id}/comments?fields=id,text,timestamp,username&access_token=${token}`;
            
            const commRes = await fetch(commUrl);
            const commData = await commRes.json();
            
            if (commData.data) {
                for (const comment of commData.data) {
                    await pool.query(
                        'INSERT INTO instagram_comments (id, media_id, username, text, timestamp) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE text = ?',
                        [comment.id, item.id, comment.username || 'unknown', comment.text, new Date(comment.timestamp), comment.text]
                    );
                    totalInserted++;
                }
            }
        }
        res.json({ success: true, count: totalInserted });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/api/instagram/comments', async (req, res) => {
    try {
        const [comments] = await pool.query('SELECT * FROM instagram_comments ORDER BY timestamp DESC LIMIT 100');
        res.json(comments);
    } catch (e) { res.status(500).json({ error: e.message }); }
});


    return router;
}
