import express from 'express';
import crypto from 'crypto';
import cron from 'node-cron';
import { requireStaff } from '../auth.js';

let isBroadcastInProgress = false;
let lastBroadcastTime = 0;

export const initWhatsAppScheduler = (pool) => {
    // Schedule automated WhatsApp Gold Rate broadcast twice daily:
    // 1. Morning Broadcast: 10:00 AM IST (04:30 AM UTC)
    // 2. Evening Broadcast: 05:00 PM IST (11:30 AM UTC)
    cron.schedule('30 4,11 * * *', async () => {
        console.log('[WhatsApp Scheduler] Triggering automated Gold Rate broadcast...');
        try {
            const res = await executeGoldRateBroadcast(pool);
            console.log('[WhatsApp Scheduler] Automated broadcast completed:', res);
        } catch (e) {
            console.error('[WhatsApp Scheduler] Automated broadcast failed:', e);
        }
    });
    console.log('[WhatsApp Scheduler] Programmed automated Gold Rate alerts 2x daily: 10:00 AM & 05:00 PM IST (04:30 & 11:30 UTC)');
};

export async function executeGoldRateBroadcast(pool) {
    if (isBroadcastInProgress) {
        console.log('[WhatsApp] Broadcast skipped: A broadcast session is already in progress.');
        return { 
            success: false, 
            message: 'A broadcast session is currently in progress. Please wait for it to complete.',
            sentCount: 0, 
            subscriberCount: 0 
        };
    }

    const nowMs = Date.now();
    // Guard against duplicate triggers within 2 minutes (120,000 ms)
    if (nowMs - lastBroadcastTime < 120000) {
        console.log('[WhatsApp] Broadcast skipped: Cooldown active to prevent duplicate messages.');
        return { 
            success: true, 
            sentCount: 0, 
            subscriberCount: 0, 
            message: 'Broadcast skipped: Cooldown active (last broadcast ran less than 2 minutes ago)' 
        };
    }

    isBroadcastInProgress = true;
    lastBroadcastTime = nowMs;

    try {
        // Get subscribers
        const [subscribers] = await pool.query('SELECT name, phone FROM customers WHERE gold_rate_subscribed = 1');
        if (!subscribers || subscribers.length === 0) {
            return { success: true, sentCount: 0, subscriberCount: 0, message: 'No subscribers found' };
        }

        // Deduplicate subscribers by clean phone number to ensure each customer receives only one message
        const broadcastQueue = [];
        const seenPhones = new Set();

        for (const sub of subscribers) {
            if (!sub.phone) continue;
            const cleanPhone = String(sub.phone).trim().replace(/\D/g, '');
            if (!cleanPhone) continue;

            if (!seenPhones.has(cleanPhone)) {
                seenPhones.add(cleanPhone);
                broadcastQueue.push({
                    name: (sub.name || 'Valued Customer').trim(),
                    phone: sub.phone,
                    cleanPhone
                });
            }
        }

        if (broadcastQueue.length === 0) {
            return { success: true, sentCount: 0, subscriberCount: 0, message: 'No valid subscriber phone numbers found' };
        }

        // Get gold rates from settings
        const [rate22] = await pool.query('SELECT setting_value FROM system_settings WHERE setting_key = "goldRate22k"');
        const [rate24] = await pool.query('SELECT setting_value FROM system_settings WHERE setting_key = "goldRate24k"');
        const gold22 = rate22[0] ? rate22[0].setting_value : '6500';
        const gold24 = rate24[0] ? rate24[0].setting_value : '7200';

        const [rows] = await pool.query('SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ("whatsappNumber", "whatsappToken", "whatsappPhoneId", "whatsappTemplateName", "whatsappWishlistTemplateName", "whatsappWabaId", "whatsappGoldRateTemplateName", "whatsappWelcomeTemplateName")');
        const config = {};
        rows.forEach(r => config[r.setting_key] = r.setting_value);

        let sentCount = 0;
        
        // Get language of the gold rate template
        const tplName = config.whatsappGoldRateTemplateName || "gold_rate_alert_daily";
        let templateLang = 'en'; // default to en
        let templateBodyText = `Hello {{1}},\n\nToday's Gold Rates at Sanghavi Jewel Studio are:\n✨ 22K Gold: ₹{{2}}/g\n✨ 24K Gold: ₹{{3}}/g\n\nVisit our online catalog to explore our latest bespoke jewelry designs. Have a sparkling day!`;
        const [tplRows] = await pool.query('SELECT language, body_text FROM whatsapp_templates WHERE name = ?', [tplName]);
        if (tplRows.length > 0) {
            if (tplRows[0].language) templateLang = tplRows[0].language;
            if (tplRows[0].body_text) templateBodyText = tplRows[0].body_text;
        }

        let lastError = null;
        const BATCH_SIZE = 50;
        const BATCH_DELAY_MS = 300; // 300ms pause between batches of 50

        // Process recipient queue in parallel batches of 50
        for (let i = 0; i < broadcastQueue.length; i += BATCH_SIZE) {
            const batch = broadcastQueue.slice(i, i + BATCH_SIZE);

            const batchResults = await Promise.all(
                batch.map(async (recipient) => {
                    const recPhone = recipient.phone;
                    const recName = recipient.name;

                    // Format variables: {{1}} name, {{2}} rate22k, {{3}} rate24k
                    let textBody = templateBodyText;
                    const vars = [recName, String(gold22), String(gold24)];
                    vars.forEach((v, idx) => {
                        textBody = textBody.replace(new RegExp(`\\{\\{${idx + 1}\\}\\}`, 'g'), v);
                    });

                    let status = 'sent';
                    let errMsg = null;
                    let sentSuccess = false;

                    if (config.whatsappToken && config.whatsappPhoneId) {
                        try {
                            const response = await fetch(`https://graph.facebook.com/v17.0/${config.whatsappPhoneId}/messages`, {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${config.whatsappToken}`,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    messaging_product: "whatsapp",
                                    to: recPhone,
                                    type: "template",
                                    template: {
                                        name: config.whatsappGoldRateTemplateName || "gold_rate_alert_daily",
                                        language: { code: templateLang },
                                        components: [
                                            {
                                                type: "body",
                                                parameters: [
                                                    { type: "text", text: recName },
                                                    { type: "text", text: String(gold22) },
                                                    { type: "text", text: String(gold24) }
                                                ]
                                            }
                                        ]
                                    }
                                })
                            });

                            if (!response.ok) {
                                const txtErr = await response.text();
                                status = 'failed';
                                errMsg = txtErr;
                            } else {
                                sentSuccess = true;
                            }
                        } catch (apiErr) {
                            status = 'failed';
                            errMsg = apiErr.message;
                        }
                    } else {
                        sentSuccess = true;
                        textBody += " (SIMULATED - WhatsApp API credentials missing)";
                    }

                    // Log the send
                    try {
                        await pool.query(
                            'INSERT INTO whatsapp_logs (recipient_phone, recipient_name, message_type, template_name, message_body, status, errorMessage, sentAt) VALUES (?, ?, "gold_rate_alert", ?, ?, ?, ?, NOW())',
                            [recPhone, recName, config.whatsappGoldRateTemplateName || "gold_rate_alert_daily", textBody, status, errMsg]
                        );
                    } catch (dbErr) {
                        console.error('[WhatsApp Log Error]', dbErr);
                    }

                    return { sentSuccess, errMsg };
                })
            );

            // Accumulate metrics for batch
            for (const res of batchResults) {
                if (res.sentSuccess) {
                    sentCount++;
                } else if (res.errMsg) {
                    lastError = res.errMsg;
                }
            }

            // Throttle delay between batches of 50
            if (i + BATCH_SIZE < broadcastQueue.length) {
                await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
            }
        }

        return { success: true, sentCount, subscriberCount: broadcastQueue.length, lastError };
    } finally {
        isBroadcastInProgress = false;
    }
}

export default function whatsappRoutes(pool) {
    const router = express.Router();

    // Helper to seed default templates if empty
    const seedDefaultTemplates = async () => {
        try {
            const [rows] = await pool.query('SELECT COUNT(*) as c FROM whatsapp_templates');
            if (rows[0] && rows[0].c === 0) {
                console.log('[WhatsApp] Seeding default templates...');
                const defaults = [
                    {
                        id: 'gold_rate_alert_daily',
                        name: 'gold_rate_alert_daily',
                        category: 'UTILITY',
                        body_text: "Hello {{1}},\n\nToday's Gold Rates at Sanghavi Jewel Studio are:\n✨ 22K Gold: ₹{{2}}/g\n✨ 24K Gold: ₹{{3}}/g\n\nVisit our online catalog to explore our latest bespoke jewelry designs. Have a sparkling day!",
                        buttons: JSON.stringify([{ type: 'URL', text: 'Explore Vault', url: '/collection' }]),
                        status: 'Approved',
                        is_synced: 1
                    },
                    {
                        id: 'wishlist_price_drop',
                        name: 'wishlist_price_drop',
                        category: 'MARKETING',
                        body_text: "Hi {{1}},\n\nGood news! The price of '{{2}}' in your wishlist has dropped to ₹{{3}}. Explore details and custom options before it gets sold out!",
                        buttons: JSON.stringify([{ type: 'URL', text: 'View Design', url: '/product/{{1}}' }]),
                        status: 'Approved',
                        is_synced: 1
                    },
                    {
                        id: 'welcome_subscriber',
                        name: 'welcome_subscriber',
                        category: 'UTILITY',
                        body_text: "Hello {{1}},\n\nThank you for subscribing to daily Gold Rate updates from Sanghavi Jewel Studio! ✨\n\nYou will receive automated alerts twice daily keeping you updated on market prices.",
                        buttons: JSON.stringify([]),
                        status: 'Approved',
                        is_synced: 1
                    }
                ];

                for (const t of defaults) {
                    await pool.query(
                        'INSERT INTO whatsapp_templates (id, name, category, body_text, buttons, status, is_synced, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
                        [t.id, t.name, t.category, t.body_text, t.buttons, t.status, t.is_synced]
                    );
                }
            }
        } catch (e) {
            console.error('[WhatsApp] Seeding templates failed:', e);
        }
    };

    // Pre-seed default templates asynchronously
    setTimeout(seedDefaultTemplates, 10000);

    // 1. GET ALL SUB_SETTING OR API CREDENTIALS FOR WHATSAPP
    const getWhatsAppConfig = async () => {
        const [rows] = await pool.query('SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ("whatsappNumber", "whatsappToken", "whatsappPhoneId", "whatsappTemplateName", "whatsappWishlistTemplateName", "whatsappWabaId", "whatsappGoldRateTemplateName", "whatsappWelcomeTemplateName")');
        const config = {};
        rows.forEach(r => config[r.setting_key] = r.setting_value);
        return config;
    };

    // 2. PUBLIC: Subscribe to gold rate updates (takes name, phone, subscribed)
    router.post('/subscribe', async (req, res) => {
        try {
            const { name, phone, subscribed } = req.body;
            if (!phone) return res.status(400).json({ error: 'Phone number is required' });

            const cleanPhone = phone.trim().replace(/\s+/g, '');
            const isSubscribed = subscribed ? 1 : 0;
            const customerName = name ? name.trim() : 'Guest Customer';

            // Find existing customer by phone
            const [existing] = await pool.query('SELECT id, name FROM customers WHERE phone = ?', [cleanPhone]);

            let customerId;
            if (existing.length > 0) {
                customerId = existing[0].id;
                await pool.query(
                    'UPDATE customers SET name = ?, gold_rate_subscribed = ?, gold_rate_opt_in_at = IF(? = 1, COALESCE(gold_rate_opt_in_at, NOW()), NULL) WHERE id = ?',
                    [customerName, isSubscribed, isSubscribed, customerId]
                );
            } else {
                customerId = crypto.randomUUID();
                await pool.query(
                    'INSERT INTO customers (id, name, phone, role, gold_rate_subscribed, gold_rate_opt_in_at, createdAt) VALUES (?, ?, ?, "customer", ?, IF(? = 1, NOW(), NULL), NOW())',
                    [customerId, customerName, cleanPhone, isSubscribed, isSubscribed]
                );
            }

            // Log action if subscribed
            if (isSubscribed) {
                let status = 'sent';
                let errMsg = null;
                
                // Get language of the welcome template
                const welcomeTplName = config.whatsappWelcomeTemplateName || "welcome_subscriber";
                let templateLang = 'en';
                const [wRows] = await pool.query('SELECT language FROM whatsapp_templates WHERE name = ?', [welcomeTplName]);
                if (wRows.length > 0 && wRows[0].language) {
                    templateLang = wRows[0].language;
                }
                const config = await getWhatsAppConfig();

                if (config.whatsappToken && config.whatsappPhoneId) {
                    try {
                        const response = await fetch(`https://graph.facebook.com/v17.0/${config.whatsappPhoneId}/messages`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${config.whatsappToken}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                messaging_product: "whatsapp",
                                to: cleanPhone,
                                type: "template",
                                template: {
                                    name: config.whatsappWelcomeTemplateName || "welcome_subscriber",
                                    language: { code: templateLang },
                                    components: [
                                        {
                                            type: "body",
                                            parameters: [
                                                { type: "text", text: customerName }
                                            ]
                                        }
                                    ]
                                }
                            })
                        });

                        if (!response.ok) {
                            const textErr = await response.text();
                            status = 'failed';
                            errMsg = textErr;
                            console.error('[WhatsApp Subscription Send Error]', textErr);
                        }
                    } catch (e) {
                        status = 'failed';
                        errMsg = e.message;
                        console.error('[WhatsApp API] Welcome send failed:', e);
                    }
                } else {
                    status = 'sent'; // simulated
                }

                await pool.query(
                    'INSERT INTO whatsapp_logs (recipient_phone, recipient_name, message_type, template_name, message_body, status, errorMessage, sentAt) VALUES (?, ?, "subscription", ?, ?, ?, ?, NOW())',
                    [
                        cleanPhone,
                        customerName,
                        config.whatsappWelcomeTemplateName || "welcome_subscriber",
                        `Subscribed to daily gold rate updates on WhatsApp. Welcome message queued.`,
                        status,
                        errMsg
                    ]
                );
            } else {
                await pool.query(
                    'INSERT INTO whatsapp_logs (recipient_phone, recipient_name, message_type, message_body, status, sentAt) VALUES (?, ?, "unsubscription", ?, "sent", NOW())',
                    [cleanPhone, customerName, `Unsubscribed from daily gold rate updates.`]
                );
            }

            res.json({ success: true, customerId, gold_rate_subscribed: !!isSubscribed });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Internal server error', message: e.message });
        }
    });

    // 3. PUBLIC: Check subscription status by phone
    router.post('/check-status', async (req, res) => {
        try {
            const { phone } = req.body;
            if (!phone) return res.status(400).json({ error: 'Phone number is required' });
            
            const cleanPhone = phone.trim().replace(/\s+/g, '');
            const [rows] = await pool.query('SELECT gold_rate_subscribed, name FROM customers WHERE phone = ?', [cleanPhone]);
            
            if (rows.length > 0) {
                res.json({ subscribed: !!rows[0].gold_rate_subscribed, name: rows[0].name });
            } else {
                res.json({ subscribed: false, name: '' });
            }
        } catch (e) {
            res.status(500).json({ error: 'Internal server error', message: e.message });
        }
    });

    // --- STAFF-ONLY ENDPOINTS ---

    // 4. GET ALL TEMPLATES
    router.get('/templates', requireStaff, async (req, res) => {
        try {
            await seedDefaultTemplates(); // Ensure seeded
            const [rows] = await pool.query('SELECT * FROM whatsapp_templates ORDER BY updatedAt DESC');
            const parsed = rows.map(t => {
                let parsedButtons = [];
                let parsedSampleVars = [];
                try {
                    parsedButtons = typeof t.buttons === 'string' ? JSON.parse(t.buttons) : (t.buttons || []);
                } catch(e){}
                try {
                    parsedSampleVars = typeof t.sample_variables === 'string' ? JSON.parse(t.sample_variables) : (t.sample_variables || []);
                } catch(e){}
                
                return {
                    ...t,
                    buttons: Array.isArray(parsedButtons) ? parsedButtons : [],
                    sample_variables: Array.isArray(parsedSampleVars) ? parsedSampleVars : [],
                    is_synced: !!t.is_synced
                };
            });
            res.json(parsed);
        } catch (e) {
            res.status(500).json({ error: 'Internal server error', message: e.message });
        }
    });

    // 5. POST CREATE/UPDATE TEMPLATE
    router.post('/templates', requireStaff, async (req, res) => {
        try {
            const { id, name, category, body_text, buttons } = req.body;
            if (!name || !body_text) return res.status(400).json({ error: 'Name and Body Text are required' });

            const cleanName = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
            const buttonsJSON = JSON.stringify(buttons || []);
            const templateId = id || cleanName;

            const [exists] = await pool.query('SELECT id FROM whatsapp_templates WHERE id = ?', [templateId]);

            if (exists.length > 0) {
                await pool.query(
                    'UPDATE whatsapp_templates SET name = ?, category = ?, body_text = ?, buttons = ?, is_synced = 0, status = "draft", updatedAt = NOW() WHERE id = ?',
                    [cleanName, category || 'UTILITY', body_text, buttonsJSON, templateId]
                );
            } else {
                await pool.query(
                    'INSERT INTO whatsapp_templates (id, name, category, body_text, buttons, status, is_synced, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, "draft", 0, NOW(), NOW())',
                    [templateId, cleanName, category || 'UTILITY', body_text, buttonsJSON]
                );
            }

            res.json({ success: true, id: templateId, name: cleanName });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Internal server error', message: e.message });
        }
    });

    // 6. DELETE TEMPLATE
    router.delete('/templates/:id', requireStaff, async (req, res) => {
        try {
            await pool.query('DELETE FROM whatsapp_templates WHERE id = ?', [req.params.id]);
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: 'Internal server error', message: e.message });
        }
    });

    // 7. SYNC TEMPLATE TO META
            // 6. SYNC TEMPLATE (STRICT FETCH FROM META)
    // 6. SYNC TEMPLATE (STRICT FETCH FROM META)
    router.post('/templates/:id/sync', requireStaff, async (req, res) => {
        try {
            const [rows] = await pool.query('SELECT * FROM whatsapp_templates WHERE id = ?', [req.params.id]);
            if (rows.length === 0) return res.status(404).json({ error: 'Template not found' });

            const template = rows[0];
            const config = await getWhatsAppConfig();

            if (!config.whatsappToken || !config.whatsappPhoneId) {
                return res.status(400).json({ error: 'WhatsApp is not fully configured in settings.' });
            }

            let wabaId = config.whatsappWabaId ? config.whatsappWabaId.trim() : null;
            if (!wabaId) {
                const wabaUrl = `https://graph.facebook.com/v17.0/${config.whatsappPhoneId}?fields=whatsapp_business_account&access_token=${config.whatsappToken}`;
                const wabaRes = await fetch(wabaUrl);
                if (!wabaRes.ok) {
                    throw new Error('Failed to resolve WABA ID dynamically. Please configure it explicitly in settings.');
                }
                const wabaData = await wabaRes.json();
                wabaId = wabaData.whatsapp_business_account?.id;
                if (!wabaId) {
                    throw new Error('WABA ID could not be resolved from Phone ID. Please configure it explicitly in settings.');
                }
            }

            // Pull from Meta
            const checkUrl = `https://graph.facebook.com/v17.0/${wabaId}/message_templates?name=${encodeURIComponent(template.name)}&access_token=${config.whatsappToken}`;
            const checkRes = await fetch(checkUrl);
            
            if (!checkRes.ok) {
                const errData = await checkRes.json().catch(() => ({}));
                let errMsg = errData.error?.message || `Meta API returned HTTP ${checkRes.status}`;
                
                // Specific hint for #100
                if (errMsg.includes('(#100)') && errMsg.includes('message_templates')) {
                    errMsg = 'Your WABA ID is incorrect. It appears you provided a Phone ID in the WABA ID field in Settings. Please use the WhatsApp Business Account ID.';
                }
                throw new Error(errMsg);
            }
            
            const checkData = await checkRes.json();
            const metaTemplates = checkData.data || [];
            const matchedMeta = metaTemplates.find(t => t.name.toLowerCase() === template.name.toLowerCase());
            
            if (!matchedMeta) {
                // Not found on Meta? Let's push it to Meta!
                const payload = {
                    name: template.name,
                    language: template.language === 'en' ? 'en_US' : (template.language || 'en_US'),
                    category: template.category || 'UTILITY',
                    components: [
                        {
                            type: 'BODY',
                            text: template.body_text
                        }
                    ]
                };

                let parsedButtons = [];
                try {
                    parsedButtons = typeof template.buttons === 'string' ? JSON.parse(template.buttons) : (template.buttons || []);
                } catch(e) {}
                
                if (parsedButtons && parsedButtons.length > 0) {
                    payload.components.push({
                        type: 'BUTTONS',
                        buttons: parsedButtons
                    });
                }
                
                let parsedVars = [];
                try {
                    parsedVars = typeof template.sample_variables === 'string' ? JSON.parse(template.sample_variables) : (template.sample_variables || []);
                } catch(e) {}
                
                if (parsedVars && parsedVars.length > 0) {
                    payload.components[0].example = {
                        body_text: [parsedVars]
                    };
                } else if (template.body_text.includes('{{1}}')) {
                    const match = template.body_text.match(/\{\{(\d+)\}\}/g);
                    if (match) {
                        const uniqueVars = [...new Set(match)];
                        payload.components[0].example = {
                            body_text: [uniqueVars.map((v, i) => `Sample ${i+1}`)]
                        };
                    }
                }

                const createRes = await fetch(`https://graph.facebook.com/v17.0/${wabaId}/message_templates`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${config.whatsappToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });
                
                if (!createRes.ok) {
                    const errData = await createRes.json().catch(() => ({}));
                    throw new Error(`Failed to create template on Meta: ${errData.error?.message || createRes.status}`);
                }
                
                const createData = await createRes.json();
                const metaStatus = createData.status || 'PENDING';
                
                await pool.query(
                    'UPDATE whatsapp_templates SET status = ?, is_synced = 1, updatedAt = NOW() WHERE id = ?',
                    [metaStatus, template.id]
                );

                await pool.query(
                    'INSERT INTO whatsapp_logs (recipient_phone, recipient_name, message_type, template_name, message_body, status, sentAt) VALUES (?, ?, "template_sync", ?, ?, "sent", NOW())',
                    ['Meta API', 'System', 'Push Template', template.name, `Pushed new template '${template.name}' to Meta (Status: ${metaStatus})`]
                );

                return res.json({ success: true, message: `Template was missing on Meta and has been successfully created!`, status: metaStatus });
            }

            const bodyComponent = matchedMeta.components.find(c => c.type === 'BODY');
            const bodyText = bodyComponent ? bodyComponent.text : '';
            
            let sampleVariables = null;
            if (bodyComponent && bodyComponent.example && bodyComponent.example.body_text) {
                sampleVariables = bodyComponent.example.body_text[0];
            }
            
            let formattedButtons = [];
            const buttonsComponent = matchedMeta.components.find(c => c.type === 'BUTTONS');
            if (buttonsComponent && buttonsComponent.buttons) {
                formattedButtons = buttonsComponent.buttons;
            }

            const metaStatus = matchedMeta.status;
            const metaLanguage = matchedMeta.language || 'en';
            
            await pool.query(
                'UPDATE whatsapp_templates SET body_text = ?, buttons = ?, sample_variables = ?, category = ?, status = ?, language = ?, is_synced = 1, updatedAt = NOW() WHERE id = ?',
                [bodyText, JSON.stringify(formattedButtons), JSON.stringify(sampleVariables), matchedMeta.category, metaStatus, metaLanguage, template.id]
            );

            await pool.query(
                'INSERT INTO whatsapp_logs (recipient_phone, recipient_name, message_type, template_name, message_body, status, sentAt) VALUES (?, ?, "template_sync", ?, ?, "sent", NOW())',
                ['Meta API', 'System', 'Sync Template', template.name, `Synchronized template '${template.name}' from Meta (Status: ${metaStatus})`]
            );

            res.json({ success: true, message: `Template successfully synced from Meta!`, status: metaStatus });

        } catch (e) {
            console.error('[WhatsApp Sync Error]:', e.message);
            res.status(400).json({ error: e.message || 'Sync failed.' });
        }
    });

    // 7. CHECK STATUS
    router.post('/templates/:id/check-status', requireStaff, async (req, res) => {
        try {
            const [rows] = await pool.query('SELECT * FROM whatsapp_templates WHERE id = ?', [req.params.id]);
            if (rows.length === 0) return res.status(404).json({ error: 'Template not found' });
            
            const template = rows[0];
            const config = await getWhatsAppConfig();

            if (!config.whatsappToken || !config.whatsappPhoneId) {
                return res.status(400).json({ error: 'WhatsApp is not configured. Please configure credentials in Preferences.' });
            }

            let wabaId = config.whatsappWabaId ? config.whatsappWabaId.trim() : null;
            if (!wabaId) {
                const wabaUrl = `https://graph.facebook.com/v17.0/${config.whatsappPhoneId}?fields=whatsapp_business_account&access_token=${config.whatsappToken}`;
                const wabaRes = await fetch(wabaUrl);
                if (!wabaRes.ok) throw new Error('Failed to resolve WABA ID. Please configure it explicitly.');
                const wabaData = await wabaRes.json();
                wabaId = wabaData.whatsapp_business_account?.id;
                if (!wabaId) throw new Error('WABA ID could not be resolved from Phone ID.');
            }

            const checkUrl = `https://graph.facebook.com/v17.0/${wabaId}/message_templates?name=${encodeURIComponent(template.name)}&access_token=${config.whatsappToken}`;
            const checkRes = await fetch(checkUrl);
            
            if (!checkRes.ok) {
                const errData = await checkRes.json().catch(() => ({}));
                let errMsg = errData.error?.message || `Meta API returned HTTP ${checkRes.status}`;
                if (errMsg.includes('(#100)') && errMsg.includes('message_templates')) {
                    errMsg = 'Your WABA ID is incorrect. It appears you provided a Phone ID in the WABA ID field in Settings. Please use the WhatsApp Business Account ID.';
                }
                throw new Error(errMsg);
            }
            
            const checkData = await checkRes.json();
            const matchedMeta = (checkData.data || []).find(t => t.name.toLowerCase() === template.name.toLowerCase());
            
            if (!matchedMeta) {
                return res.status(404).json({ error: `Template '${template.name}' not found on Meta.` });
            }

            const metaStatus = matchedMeta.status;
            const metaLanguage = matchedMeta.language || 'en';
            let formattedStatus = 'Approved';
            if (metaStatus === 'APPROVED') formattedStatus = 'Approved';
            else if (metaStatus === 'PENDING') formattedStatus = 'Pending';
            else if (metaStatus === 'REJECTED' || metaStatus === 'REJECTED_LITE') formattedStatus = 'Rejected';
            else formattedStatus = metaStatus.charAt(0).toUpperCase() + metaStatus.slice(1).toLowerCase();

            await pool.query('UPDATE whatsapp_templates SET status = ?, is_synced = 1, updatedAt = NOW() WHERE id = ?', [formattedStatus, template.id]);

            res.json({
                success: true,
                message: `Meta status: ${metaStatus}`,
                status: formattedStatus
            });
        } catch (e) {
            console.error('[WhatsApp Check Status Error]:', e.message);
            res.status(400).json({ error: e.message || 'Check status failed.' });
        }
    });

    // 8. GET LOGS
    router.get('/logs', requireStaff, async (req, res) => {
        try {
            const [rows] = await pool.query('SELECT * FROM whatsapp_logs ORDER BY sentAt DESC LIMIT 200');
            res.json(rows);
        } catch (e) {
            res.status(500).json({ error: 'Internal server error', message: e.message });
        }
    });

    // 9. CLEAR LOGS
    router.post('/logs/clear', requireStaff, async (req, res) => {
        try {
            await pool.query('DELETE FROM whatsapp_logs');
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: 'Internal server error', message: e.message });
        }
    });

    // 10. GET SUBSCRIBERS
    router.get('/subscribers', requireStaff, async (req, res) => {
        try {
            const [rows] = await pool.query(`
                SELECT 
                    c.id, 
                    c.name, 
                    c.phone, 
                    c.pincode, 
                    c.gold_rate_subscribed,
                    c.gold_rate_opt_in_at,
                    c.createdAt,
                    COALESCE(
                        c.gold_rate_opt_in_at, 
                        (
                            SELECT MIN(l.sentAt) 
                            FROM whatsapp_logs l 
                            WHERE (l.recipient_phone = c.phone OR l.recipient_phone = REPLACE(c.phone, '+', '') OR c.phone LIKE CONCAT('%', l.recipient_phone)) 
                            AND l.message_type = 'subscription'
                        ),
                        c.createdAt
                    ) AS optInDate
                FROM customers c
                WHERE c.gold_rate_subscribed = 1 
                ORDER BY optInDate DESC
            `);
            res.json(rows);
        } catch (e) {
            res.status(500).json({ error: 'Internal server error', message: e.message });
        }
    });

    // 11. MANUAL SEND MESSAGE / TEMPLATE MESSAGE TO CUSTOMER
    router.post('/send-manual', requireStaff, async (req, res) => {
        try {
            const { phone, name, type, templateId, customText, variables } = req.body;
            if (!phone) return res.status(400).json({ error: 'Recipient phone is required' });

            const cleanPhone = phone.trim().replace(/\s+/g, '');
            const recName = name || 'Valued Customer';
            const config = await getWhatsAppConfig();

            let messageBody = customText || '';
            let templateName = '';
            let templateLang = 'en';

            if (type === 'template' && templateId) {
                const [tRows] = await pool.query('SELECT * FROM whatsapp_templates WHERE id = ?', [templateId]);
                if (tRows.length > 0) {
                    templateName = tRows[0].name;
                    templateLang = tRows[0].language || 'en';
                    let text = tRows[0].body_text;
                    const vars = variables || [recName];
                    vars.forEach((v, idx) => {
                        text = text.replace(new RegExp(`\\{\\{${idx + 1}\\}\\}`, 'g'), v);
                    });
                    messageBody = text;
                }
            }

            let status = 'sent';
            let errMsg = null;

            if (config.whatsappToken && config.whatsappPhoneId) {
                try {
                    let requestBody = {};
                    if (type === 'template') {
                        const payloadVars = (variables || []).map(v => ({ type: 'text', text: String(v) }));
                        requestBody = {
                            messaging_product: "whatsapp",
                            to: cleanPhone,
                            type: "template",
                            template: {
                                name: templateName,
                                language: { code: templateLang },
                                components: [
                                    {
                                        type: "body",
                                        parameters: payloadVars
                                    }
                                ]
                            }
                        };
                    } else {
                        requestBody = {
                            messaging_product: "whatsapp",
                            recipient_type: "individual",
                            to: cleanPhone,
                            type: "text",
                            text: { preview_url: false, body: messageBody }
                        };
                    }

                    const response = await fetch(`https://graph.facebook.com/v17.0/${config.whatsappPhoneId}/messages`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${config.whatsappToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(requestBody)
                    });

                    if (!response.ok) {
                        const textErr = await response.text();
                        status = 'failed';
                        errMsg = textErr;
                        console.error('[WhatsApp Manual Send Error]', textErr);
                    }
                } catch (metaErr) {
                    status = 'failed';
                    errMsg = metaErr.message;
                    console.error('[WhatsApp Manual Send API Crash]', metaErr);
                }
            } else {
                status = 'sent'; // Simulated
                messageBody += " (SIMULATED - WhatsApp API details not configured in settings)";
            }

            // Write to logs
            await pool.query(
                'INSERT INTO whatsapp_logs (recipient_phone, recipient_name, message_type, template_name, message_body, status, errorMessage, sentAt) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
                [cleanPhone, recName, type === 'template' ? 'template_message' : 'manual_message', templateName || null, messageBody, status, errMsg]
            );

            if (status === 'failed') {
                return res.status(400).json({ error: 'Meta API call failed', message: errMsg });
            }

            res.json({ success: true, status, messageBody });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Internal server error', message: e.message });
        }
    });

    // 12. TRIGGER DAILY/SCHEDULED GOLD RATE BROADCAST (MANUAL/AUTOMATED TRIGGER CONTROL)
    router.post('/trigger-gold-rate', requireStaff, async (req, res) => {
        try {
            const result = await executeGoldRateBroadcast(pool);
            res.json(result);
        } catch (e) {
            console.error('[WhatsApp Trigger Error]', e);
            res.status(500).json({ error: 'Internal server error', message: e.message });
        }
    });

    return router;
}
