import express from 'express';
import { requireStaff } from '../auth.js';

export default function wishlistRoutes(pool, sanitizeProduct) {
    const router = express.Router();

    router.post('/wishlist', async (req, res) => {
        try {
            const { customerId, productId, priceWhenWishlisted, preferences } = req.body;
            if (!customerId || !productId) return res.status(400).json({ error: 'Missing customerId or productId' });
            
            await pool.query(
                'INSERT INTO wishlist (customerId, productId, priceWhenWishlisted, preferences, createdAt) VALUES (?, ?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE priceWhenWishlisted = ?, preferences = ?', 
                [customerId, productId, priceWhenWishlisted || 0, JSON.stringify(preferences || {}), priceWhenWishlisted || 0, JSON.stringify(preferences || {})]
            );
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
    });

    router.delete('/wishlist', async (req, res) => {
        try {
            const { customerId, productId } = req.body;
            await pool.query('DELETE FROM wishlist WHERE customerId = ? AND productId = ?', [customerId, productId]);
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
    });

    router.get('/wishlist/:customerId', async (req, res) => {
        try {
            const [rows] = await pool.query(`
                SELECT p.*, w.priceWhenWishlisted, w.preferences, w.createdAt as wishlistedAt 
                FROM wishlist w 
                JOIN products p ON w.productId = p.id 
                WHERE w.customerId = ? 
                ORDER BY w.createdAt DESC
            `, [req.params.customerId]);
            res.json(rows.map(sanitizeProduct).map((p, i) => ({ ...p, priceWhenWishlisted: rows[i].priceWhenWishlisted, preferences: rows[i].preferences, wishlistedAt: rows[i].wishlistedAt })));
        } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
    });

    router.get('/admin/wishlists/all', requireStaff, async (req, res) => {
        try {
            const [rows] = await pool.query(`
                SELECT w.id as wishlistId, w.customerId, w.productId, w.priceWhenWishlisted, w.createdAt, w.lastNotifiedAt,
                       p.title, p.category, p.meta, p.weight, p.images, p.thumbnails, p.isHidden,
                       c.phone, c.name as customerName
                FROM wishlist w
                JOIN products p ON w.productId = p.id
                JOIN customers c ON w.customerId = c.id
            `);
            res.json(rows);
        } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
    });

    router.post('/admin/wishlists/notify', requireStaff, async (req, res) => {
        try {
            const { notifications } = req.body; // Array of { wishlistId, customerId, phone, productTitle, currentPrice }
            
            const [configRows] = await pool.query('SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ("whatsappNumber", "whatsappToken", "whatsappPhoneId", "whatsappWishlistTemplateName")');
            const config = {};
            configRows.forEach(r => config[r.setting_key] = r.setting_value);
            
            let sentCount = 0;
            
            if (!config.whatsappToken || !config.whatsappPhoneId) {
                return res.status(400).json({ error: 'WhatsApp API is not configured in Settings' });
            }
            
            const templateName = config.whatsappWishlistTemplateName || 'wishlist_price_drop';
            const isStandardPriceDrop = (templateName === 'wishlist_price_drop');

            for (const notif of notifications) {
                // Check 3 day anti spam logic again
                const [w] = await pool.query('SELECT lastNotifiedAt FROM wishlist WHERE id = ?', [notif.wishlistId]);
                if (w[0] && w[0].lastNotifiedAt) {
                    const diffDays = (new Date() - new Date(w[0].lastNotifiedAt)) / (1000 * 60 * 60 * 24);
                    if (diffDays < 3) continue; // Skip if notified within last 3 days
                }

                try {
                    // Rate Limiting (Optimization) avoiding hitting API too fast
                    await new Promise(r => setTimeout(r, 200));

                    // Call Meta WhatsApp API
                    const response = await fetch(`https://graph.facebook.com/v17.0/${config.whatsappPhoneId}/messages`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${config.whatsappToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            messaging_product: "whatsapp",
                            to: notif.phone,
                            type: "template",
                            template: {
                                name: templateName,
                                language: { code: "en_US" },
                                components: [
                                    {
                                        type: "body",
                                        parameters: isStandardPriceDrop ? [
                                            { type: "text", text: String(notif.customerName || "Customer").substring(0, 30) },
                                            { type: "text", text: String(notif.productTitle).substring(0, 30) },
                                            { type: "text", text: String(notif.previousPrice || notif.priceWhenWishlisted || Math.round(notif.currentPrice * 1.05)) },
                                            { type: "text", text: String(notif.currentPrice) }
                                        ] : [
                                            { type: "text", text: String(notif.customerName || "Customer").substring(0, 30) },
                                            { type: "text", text: String(notif.productTitle).substring(0, 30) }, // Limit length for safety
                                            { type: "text", text: "₹" + String(notif.currentPrice) }
                                        ]
                                    },
                                    {
                                        type: "button",
                                        sub_type: "url",
                                        index: "0",
                                        parameters: [
                                            {
                                                type: "text",
                                                text: String(notif.productId)
                                            }
                                        ]
                                    }
                                ]
                            }
                        })
                    });

                    if (response.ok) {
                        await pool.query('UPDATE wishlist SET lastNotifiedAt = NOW() WHERE id = ?', [notif.wishlistId]);
                        sentCount++;
                    } else {
                        const err = await response.text();
                        console.error('WhatsApp API Error:', err);
                    }
                } catch (apiErr) {
                    console.error("WhatsApp API Call failed:", apiErr);
                }
            }
            
            res.json({ success: true, sentCount });
        } catch (e) {
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    return router;
}
