import express from 'express';
import crypto from 'crypto';

export default function linksRoutes(pool) {
    const router = express.Router();

    router.post('/api/links', async (req, res) => {
        try {
            const { targetId, type } = req.body;
            const token = crypto.randomBytes(16).toString('hex');
            const [settings] = await pool.query('SELECT setting_value FROM system_settings WHERE setting_key = "linkExpiryHours"');
            const hours = parseInt(settings[0]?.setting_value || '24');
            const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
            
            await pool.query('INSERT INTO links (id, token, targetId, type, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?, ?)', 
                [crypto.randomUUID(), token, targetId, type, expiresAt, new Date()]);
                
            res.json({ token, expiresAt });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.get('/api/links/:token', async (req, res) => {
        try {
            const [rows] = await pool.query('SELECT * FROM links WHERE token = ?', [req.params.token]);
            if (!rows.length) return res.status(404).json({ error: 'Link not found' });
            
            const link = rows[0];
            if (new Date() > new Date(link.expiresAt)) {
                return res.status(410).json({ error: 'Link expired' });
            }
            
            res.json(link);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    return router;
}
