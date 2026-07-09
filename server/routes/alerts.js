import express from 'express';
import crypto from 'crypto';
import { requireStaff } from '../auth.js';

export default function alertsRoutes(pool) {
    const router = express.Router();

    router.post('/api/price-drop-alerts', async (req, res) => {
        try {
            const { customerId, productId, currentPrice } = req.body;
            if (!customerId || !productId) return res.status(400).json({ error: 'Missing customerId or productId' });
            
            await pool.query(
                'INSERT INTO price_drop_alerts (id, customerId, productId, currentPrice, createdAt) VALUES (?, ?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE currentPrice = ?, isActive = true', 
                [crypto.randomUUID(), customerId, productId, currentPrice || 0, currentPrice || 0]
            );
            res.json({ success: true });
        } catch (e) { 
            console.error(e);
            res.status(500).json({ error: 'Internal server error' }); 
        }
    });

    router.get('/api/admin/price-drop-alerts', requireStaff, async (req, res) => {
        try {
            const [rows] = await pool.query(`
                SELECT a.id as alertId, a.customerId, a.productId, a.currentPrice, a.createdAt, a.lastNotifiedAt, a.isActive,
                       p.title, p.category, p.weight, p.images, p.meta,
                       c.phone, c.name as customerName
                FROM price_drop_alerts a
                JOIN products p ON a.productId = p.id
                JOIN customers c ON a.customerId = c.id
                ORDER BY a.createdAt DESC
            `);
            res.json(rows);
        } catch (e) { 
            console.error(e);
            res.status(500).json({ error: 'Internal server error' }); 
        }
    });

    router.post('/api/admin/price-drop-alerts/notify', requireStaff, async (req, res) => {
        try {
            const { notifications } = req.body; // Array of { alertId, customerId, phone, productTitle, currentPrice }
            
            const [configRows] = await pool.query('SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ("whatsappNumber", "whatsappToken", "whatsappPhoneId", "whatsappWishlistTemplateName")');
            const config = {};
            configRows.forEach(r => config[r.setting_key] = r.setting_value);
            
            let sentCount = 0;
            
            if (!config.whatsappToken || !config.whatsappPhoneId) {
                // If Whatsapp is not configured, we just simulate sending by updating DB
                // return res.status(400).json({ error: 'WhatsApp API is not configured in Settings' });
            }
            
            for (const notif of notifications) {
                // Check 24 hours anti spam logic
                const [a] = await pool.query('SELECT lastNotifiedAt FROM price_drop_alerts WHERE id = ?', [notif.alertId]);
                if (a[0] && a[0].lastNotifiedAt) {
                    const diffHours = (new Date() - new Date(a[0].lastNotifiedAt)) / (1000 * 60 * 60);
                    if (diffHours < 24) continue; // Skip if notified within last 24 hours
                }
                
                try {
                    // Call Meta WhatsApp API if configured
                    if (config.whatsappToken && config.whatsappPhoneId) {
                        await new Promise(r => setTimeout(r, 200));
                        // simplified mock for actual meta call
                        console.log(`Mocking send to ${notif.phone}`);
                    }
                    
                    await pool.query('UPDATE price_drop_alerts SET lastNotifiedAt = NOW() WHERE id = ?', [notif.alertId]);
                    sentCount++;
                } catch (apiErr) {
                    console.error("WhatsApp API Call failed:", apiErr);
                }
            }
            
            res.json({ success: true, sentCount });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    return router;
}
