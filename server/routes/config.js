import express from 'express';
import { requireAdmin } from '../auth.js';

export default function configRoutes(pool, CACHE) {
    const router = express.Router();
    const CACHE_TTL = 5 * 60 * 1000;

    router.get('/api/config', async (req, res) => {
        try {
            const now = Date.now();
            if (CACHE.config.data && (now - CACHE.config.lastFetch < CACHE_TTL)) {
                return res.json(CACHE.config.data);
            }

            // If you use DEMO_MODE, you'll need to pass it or check pool existence.
            if (!pool) return res.status(503).json({ error: 'Database connection not initialized.' });

            const [suppliers] = await pool.query('SELECT * FROM suppliers');
            const [categories] = await pool.query('SELECT * FROM categories');
            const [subCats] = await pool.query('SELECT * FROM sub_categories');
            const [settingsRows] = await pool.query('SELECT * FROM system_settings');

            const catMap = categories.map(c => ({
                id: c.id,
                name: c.name,
                isPrivate: !!c.isPrivate,
                subCategories: subCats.filter(s => s.categoryId === c.id).map(s => s.name)
            }));

            const config = {
                suppliers: suppliers.map(s => ({ ...s, isPrivate: !!s.isPrivate })),
                categories: catMap,
                linkExpiryHours: 24,
                goldRate22k: 6500,
                goldRate24k: 7200,
                gstPercent: 3,
                makingChargeSegments: [
                    { id: 'classic', name: 'Classic', percent: 10 },
                    { id: 'premium', name: 'Premium', percent: 12 },
                    { id: 'antique', name: 'Antique', percent: 13 }
                ],
                defaultMakingChargeSegmentId: 'premium',
                whatsappNumber: '',
                whatsappPhoneId: '',
                whatsappToken: '',
                whatsappTemplateName: 'sanghavi_jewel_studio',
                whatsappWishlistTemplateName: 'wishlist_price_drop',
            };

            settingsRows.forEach(row => {
                if (row.setting_key === 'linkExpiryHours') config.linkExpiryHours = Number(row.setting_value);
                else if (row.setting_key === 'goldRate22k') config.goldRate22k = Number(row.setting_value);
                else if (row.setting_key === 'goldRate24k') config.goldRate24k = Number(row.setting_value);
                else if (row.setting_key === 'gstPercent') config.gstPercent = Number(row.setting_value);
                else if (row.setting_key === 'paymentPlans') {
                    try { config.paymentPlans = JSON.parse(row.setting_value); } catch { config.paymentPlans = [{months: 1, advancePercent: 20}, {months: 3, advancePercent: 50}]; }
                }
                else if (row.setting_key === 'makingChargeSegments') {
                    try { config.makingChargeSegments = JSON.parse(row.setting_value); } catch { config.makingChargeSegments = []; }
                }
                else if (row.setting_key === 'defaultMakingChargeSegmentId') config.defaultMakingChargeSegmentId = row.setting_value;
                else config[row.setting_key] = row.setting_value;
            });
            
            if (!config.paymentPlans || !Array.isArray(config.paymentPlans) || config.paymentPlans.length === 0) {
                config.paymentPlans = [
                    { months: 1, advancePercent: 20 },
                    { months: 2, advancePercent: 30 },
                    { months: 3, advancePercent: 50 },
                    { months: 6, advancePercent: 100 }
                ];
            }

            CACHE.config.data = config;
            CACHE.config.lastFetch = now;
            res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
            res.json(config);
        } catch (e) { 
            res.status(500).json({ error: 'Internal server error' }); 
        }
    });

    router.post('/api/config', requireAdmin, async (req, res) => {
        if (!pool) return res.status(503).json({ error: 'Database connection not initialized.' });
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            const { suppliers, categories, makingChargeSegments, defaultMakingChargeSegmentId, linkExpiryHours, goldRate22k, goldRate24k, gstPercent, whatsappNumber, whatsappPhoneId, whatsappToken, whatsappTemplateName, whatsappWishlistTemplateName, instagramHandle, instagramToken, aiConfig, paymentPlans } = req.body;

            const settings = { 
                linkExpiryHours, 
                gstPercent,
                goldRate22k,
                goldRate24k,
                paymentPlans: paymentPlans ? JSON.stringify(paymentPlans) : undefined,
                makingChargeSegments: JSON.stringify(makingChargeSegments || []),
                defaultMakingChargeSegmentId,
                whatsappNumber, 
                whatsappPhoneId, 
                whatsappToken,
                whatsappTemplateName,
                whatsappWishlistTemplateName,
                instagramHandle,
                instagramToken,
                ai_model_analysis: aiConfig?.models?.analysis,
                ai_model_enhancement: aiConfig?.models?.enhancement,
                ai_model_watermark: aiConfig?.models?.watermark,
                ai_model_design: aiConfig?.models?.design,
                ai_prompt_analysis: aiConfig?.prompts?.analysis,
                ai_prompt_enhancement: aiConfig?.prompts?.enhancement,
                ai_prompt_watermark: aiConfig?.prompts?.watermark,
                ai_prompt_design: aiConfig?.prompts?.design,
                ai_templates_analysis: JSON.stringify(aiConfig?.templates?.analysis || []),
                ai_templates_enhancement: JSON.stringify(aiConfig?.templates?.enhancement || []),
                ai_templates_watermark: JSON.stringify(aiConfig?.templates?.watermark || []),
                ai_templates_design: JSON.stringify(aiConfig?.templates?.design || [])
            };

            for (const [k, v] of Object.entries(settings)) {
                 if (v !== undefined) {
                     await conn.query('INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?', [k, String(v || ''), String(v || '')]);
                 }
            }

            await conn.query('DELETE FROM suppliers'); 
            if (suppliers?.length) {
                const supplierValues = suppliers.map(s => [s.id, s.name, !!s.isPrivate]);
                await conn.query('INSERT INTO suppliers (id, name, isPrivate) VALUES ?', [supplierValues]);
            }

            await conn.query('DELETE FROM sub_categories'); 
            await conn.query('DELETE FROM categories');
            
            if (categories?.length) {
                for (const c of categories) {
                    await conn.query('INSERT INTO categories (id, name, isPrivate) VALUES (?, ?, ?)', [c.id, c.name, !!c.isPrivate]);
                    if (c.subCategories?.length) {
                        const subValues = c.subCategories.map(name => [c.id, name]);
                        await conn.query('INSERT INTO sub_categories (categoryId, name) VALUES ?', [subValues]);
                    }
                }
            }

            await conn.commit();
            CACHE.config.data = null; // Invalidate cache
            res.json({ success: true });
        } catch (e) {
            await conn.rollback();
            res.status(500).json({ error: 'Internal server error' });
        } finally {
            conn.release();
        }
    });

    return router;
}
