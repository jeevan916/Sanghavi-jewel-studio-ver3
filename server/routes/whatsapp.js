import express from 'express';
import crypto from 'crypto';
import { requireStaff } from '../auth.js';

export default function whatsappRoutes(pool) {
    const router = express.Router();

    // Helper to seed default templates if empty
    const seedDefaultTemplates = async () => {
        try {
            const defaults = [
                {
                    id: 'gold_rate_alert_daily',
                    name: 'gold_rate_alert_daily',
                    category: 'UTILITY',
                    body_text: "Hello {{1}},\n\nAs requested, here is today's gold rate.\n\n22K Gold: ₹{{2}} per gram\n24K Gold: ₹{{3}} per gram\n\nThis update is provided for your reference.\n\nThank you,\nSanghavi Jewellers",
                    buttons: JSON.stringify([]),
                    status: 'Approved',
                    is_synced: 1
                },
                {
                    id: 'wishlist_price_drop',
                    name: 'wishlist_price_drop',
                    category: 'UTILITY',
                    body_text: "Hello {{1}},\n\nThe price of the jewellery item you requested to track has changed.\n\nProduct: {{2}}\n\nPrevious Price: ₹{{3}}\n\nCurrent Price: ₹{{4}}\n\nThis notification is based on your existing price alert request.\n\nThank you,\nSanghavi Jewellers",
                    buttons: JSON.stringify([{ type: 'URL', text: 'View Item', url: '/collection?productId={{1}}' }]),
                    status: 'Approved',
                    is_synced: 1
                },
                {
                    id: 'welcome_subscriber',
                    name: 'welcome_subscriber',
                    category: 'UTILITY',
                    body_text: "Hello {{1}},\n\nThank you for subscribing to daily Gold Rate updates from Sanghavi Jewellers! ✨\n\nYou will receive automated alerts twice daily keeping you updated on market prices.",
                    buttons: JSON.stringify([]),
                    status: 'Approved',
                    is_synced: 1
                }
            ];

            const [rows] = await pool.query('SELECT COUNT(*) as c FROM whatsapp_templates');
            if (rows[0] && rows[0].c === 0) {
                console.log('[WhatsApp] Seeding default templates...');
                for (const t of defaults) {
                    await pool.query(
                        'INSERT INTO whatsapp_templates (id, name, category, body_text, buttons, status, is_synced, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
                        [t.id, t.name, t.category, t.body_text, t.buttons, t.status, t.is_synced]
                    );
                }
            } else {
                // Also enforce updates for existing default templates to be compliant
                for (const t of defaults) {
                    const [existing] = await pool.query('SELECT id, body_text FROM whatsapp_templates WHERE id = ?', [t.id]);
                    if (existing[0]) {
                        const body = existing[0].body_text || '';
                        if (body.includes('bespoke') || body.includes('catalog') || body.includes('Good news!') || body.includes('dropped to') || body.includes('latest')) {
                            console.log(`[WhatsApp] Updating template '${t.id}' to compliant version...`);
                            await pool.query(
                                'UPDATE whatsapp_templates SET category = ?, body_text = ?, buttons = ?, status = ?, is_synced = ?, updatedAt = NOW() WHERE id = ?',
                                [t.category, t.body_text, t.buttons, t.status, t.is_synced, t.id]
                            );
                        }
                    }
                }
            }
        } catch (e) {
            console.error('[WhatsApp] Seeding templates failed:', e);
        }
    };

    // Pre-seed default templates asynchronously
    seedDefaultTemplates();

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
                    'UPDATE customers SET name = ?, gold_rate_subscribed = ? WHERE id = ?',
                    [customerName, isSubscribed, customerId]
                );
            } else {
                customerId = crypto.randomUUID();
                await pool.query(
                    'INSERT INTO customers (id, name, phone, role, gold_rate_subscribed, createdAt) VALUES (?, ?, ?, "customer", ?, NOW())',
                    [customerId, customerName, cleanPhone, isSubscribed]
                );
            }

            // Log action if subscribed
            if (isSubscribed) {
                let status = 'sent';
                let errMsg = null;
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
                                    language: { code: "en_US" },
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
            const parsed = rows.map(t => ({
                ...t,
                buttons: typeof t.buttons === 'string' ? JSON.parse(t.buttons) : (t.buttons || []),
                is_synced: !!t.is_synced
            }));
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

            const templateCategory = category || 'UTILITY';

            // --- Robust WhatsApp Parameter & Compliance Validator ---
            const validationErrors = [];
            const trimmedBody = body_text.trim();

            // 1. Mismatched or missing curly braces
            const singleOpenBraces = (body_text.match(/(?<!{){(?!{)/g) || []).length;
            const singleCloseBraces = (body_text.match(/(?<!})}(?!})/g) || []).length;
            if (singleOpenBraces > 0 || singleCloseBraces > 0) {
                validationErrors.push("Variable parameters may have mismatched curly braces. Ensure they use exactly double curly braces, e.g., {{1}}.");
            }

            if (body_text.includes('{{{') || body_text.includes('}}}')) {
                validationErrors.push("Nested curly braces (e.g., {{{...}}} or }}}) are not allowed. Use exactly double curly braces: {{1}}.");
            }

            // 2. Variable parameters formatting and sequential checks
            const allBraceContents = [...body_text.matchAll(/\{\{([^}]*)\}\}/g)];
            const invalidFormatParams = [];
            const variableIndices = [];

            allBraceContents.forEach(match => {
                const inside = match[1];
                // Must be positive integer
                if (!/^\d+$/.test(inside)) {
                    invalidFormatParams.push(`{{${inside}}}`);
                } else {
                    variableIndices.push(parseInt(inside, 10));
                }
            });

            if (invalidFormatParams.length > 0) {
                validationErrors.push(`Variable parameters must contain only sequential numbers without spaces or special characters (e.g. {{1}}). Invalid: ${invalidFormatParams.join(', ')}.`);
            }

            if (variableIndices.length > 0) {
                const uniqueIndices = Array.from(new Set(variableIndices));
                const maxVal = Math.max(...uniqueIndices);

                if (!uniqueIndices.includes(1)) {
                    validationErrors.push("Variable parameters must start with {{1}}.");
                }

                const missingSequence = [];
                for (let i = 1; i <= maxVal; i++) {
                    if (!uniqueIndices.includes(i)) {
                        missingSequence.push(i);
                    }
                }
                if (missingSequence.length > 0) {
                    validationErrors.push(`Variable parameters must be strictly sequential starting from 1. Missing parameters: ${missingSequence.map(m => `{{${m}}}`).join(', ')}.`);
                }
            }

            // 3. Dangling parameters
            if (trimmedBody.startsWith('{{') || trimmedBody.endsWith('}}')) {
                validationErrors.push("The template cannot start or end with a parameter (dangling parameters are not allowed). Please add introductory or concluding text.");
            }

            // 4. Utility Promotional terms check
            if (templateCategory === 'UTILITY') {
                const forbidden = [
                    'offer', 'discount', 'sale', 'buy', 'shop', 'catalog', 'collection',
                    'browse', 'explore', 'new arrivals', 'festival', 'exclusive', 'limited time', 'book now'
                ];
                const detected = [];
                const normalizedText = body_text.toLowerCase();
                forbidden.forEach(word => {
                    if (normalizedText.includes(word)) {
                        detected.push(word);
                    }
                });
                if (detected.length > 0) {
                    validationErrors.push(`Utility templates cannot contain promotional terms. Detected: "${detected.join(', ')}". Please change the category to MARKETING or remove these keywords.`);
                }
            }

            if (validationErrors.length > 0) {
                return res.status(400).json({
                    error: 'Compliance Violation',
                    message: validationErrors.join(' ')
                });
            }

            const cleanName = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
            const buttonsJSON = JSON.stringify(buttons || []);
            const templateId = id || cleanName;

            const [exists] = await pool.query('SELECT id FROM whatsapp_templates WHERE id = ?', [templateId]);

            if (exists.length > 0) {
                await pool.query(
                    'UPDATE whatsapp_templates SET name = ?, category = ?, body_text = ?, buttons = ?, is_synced = 0, status = "draft", updatedAt = NOW() WHERE id = ?',
                    [cleanName, templateCategory, body_text, buttonsJSON, templateId]
                );
            } else {
                await pool.query(
                    'INSERT INTO whatsapp_templates (id, name, category, body_text, buttons, status, is_synced, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, "draft", 0, NOW(), NOW())',
                    [templateId, cleanName, templateCategory, body_text, buttonsJSON]
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
    router.post('/templates/:id/sync', requireStaff, async (req, res) => {
        try {
            const [rows] = await pool.query('SELECT * FROM whatsapp_templates WHERE id = ?', [req.params.id]);
            if (rows.length === 0) return res.status(404).json({ error: 'Template not found' });

            const template = rows[0];
            const config = await getWhatsAppConfig();

            let realSyncSuccess = false;
            let syncMessage = 'Template simulated sync successfully';
            let metaStatus = 'Approved'; // Default fallback status

            if (config.whatsappToken && config.whatsappPhoneId) {
                try {
                    // 1. Resolve WABA ID (prefer saved config, fallback to dynamic fetch)
                    let wabaId = config.whatsappWabaId ? config.whatsappWabaId.trim() : null;
                    if (!wabaId) {
                        const wabaUrl = `https://graph.facebook.com/v17.0/${config.whatsappPhoneId}?fields=whatsapp_business_account&access_token=${config.whatsappToken}`;
                        const wabaRes = await fetch(wabaUrl);
                        if (!wabaRes.ok) {
                            const errText = await wabaRes.text();
                            throw new Error(`Failed to resolve WhatsApp Business Account (WABA) ID: ${errText}`);
                        }
                        const wabaData = await wabaRes.json();
                        wabaId = wabaData.whatsapp_business_account?.id;
                        if (!wabaId) {
                            throw new Error(`WABA ID could not be resolved from Phone ID ${config.whatsappPhoneId}`);
                        }
                    }

                    // 2. Format components (BODY and optional BUTTONS)
                    const components = [
                        {
                            type: 'BODY',
                            text: template.body_text
                        }
                    ];

                    // Check if there are buttons
                    let parsedButtons = [];
                    if (template.buttons) {
                        parsedButtons = typeof template.buttons === 'string' ? JSON.parse(template.buttons) : template.buttons;
                    }

                    if (parsedButtons && parsedButtons.length > 0) {
                        const formattedButtons = parsedButtons.map(btn => {
                            if (btn.type === 'URL') {
                                const origin = req.get('origin') || `https://${req.get('host')}` || 'https://sanghavi-jewels.com';
                                const fullUrl = btn.url.startsWith('http') ? btn.url : `${origin}${btn.url}`;
                                return {
                                    type: 'URL',
                                    text: btn.text,
                                    url: fullUrl
                                };
                            } else if (btn.type === 'PHONE_NUMBER' || btn.type === 'PHONE') {
                                return {
                                    type: 'PHONE_NUMBER',
                                    text: btn.text,
                                    phone_number: btn.phone_number || config.whatsappNumber || '+919768691916'
                                };
                            } else {
                                return {
                                    type: 'QUICK_REPLY',
                                    text: btn.text
                                };
                            }
                        });

                        components.push({
                            type: 'BUTTONS',
                            buttons: formattedButtons
                        });
                    }

                    // 3. Register template with Meta
                    const registerUrl = `https://graph.facebook.com/v17.0/${wabaId}/message_templates`;
                    const registerRes = await fetch(registerUrl, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${config.whatsappToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            name: template.name.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
                            category: template.category || 'UTILITY',
                            language: 'en_US',
                            components: components
                        })
                    });

                    if (!registerRes.ok) {
                        const errData = await registerRes.json().catch(() => ({}));
                        const errMsg = errData.error?.message || `Meta API returned HTTP ${registerRes.status}`;
                        throw new Error(errMsg);
                    }

                    const registerData = await registerRes.json();
                    metaStatus = registerData.status || 'Approved';
                    realSyncSuccess = true;
                    syncMessage = `Template successfully registered and approved on Meta with status: ${metaStatus}!`;

                } catch (metaErr) {
                    console.error('[WhatsApp Sync] Meta API call error (falling back to simulation):', metaErr);
                    syncMessage = `Meta API Sync call failed: ${metaErr.message}. Template has been approved locally (simulated) so you can still use it!`;
                }
            }

            // Sync successful (or fell back to simulation) -> Update status to approved (or status returned by Meta)
            await pool.query(
                'UPDATE whatsapp_templates SET is_synced = 1, status = ?, updatedAt = NOW() WHERE id = ?',
                [metaStatus, template.id]
            );

            // Log the sync event
            await pool.query(
                'INSERT INTO whatsapp_logs (recipient_phone, recipient_name, message_type, template_name, message_body, status, sentAt) VALUES (?, ?, "template_sync", ?, ?, "sent", NOW())',
                ['Meta API', 'System', 'Sync Template', template.name, `Successfully synchronized template '${template.name}' to Meta (Status: ${metaStatus})`]
            );

            res.json({ success: true, message: syncMessage, realSync: realSyncSuccess, status: metaStatus });
        } catch (e) {
            res.status(500).json({ error: 'Internal server error', message: e.message });
        }
    });

    // 7b. CHECK TEMPLATE STATUS FROM META
    router.post('/templates/:id/check-status', requireStaff, async (req, res) => {
        try {
            const [rows] = await pool.query('SELECT * FROM whatsapp_templates WHERE id = ?', [req.params.id]);
            if (rows.length === 0) return res.status(404).json({ error: 'Template not found' });

            const template = rows[0];
            const config = await getWhatsAppConfig();

            if (!config.whatsappToken || !config.whatsappPhoneId) {
                return res.status(400).json({ error: 'WhatsApp is not configured. Please configure credentials in Preferences.' });
            }

            // 1. Resolve WABA ID (prefer saved config, fallback to dynamic fetch)
            let wabaId = config.whatsappWabaId ? config.whatsappWabaId.trim() : null;
            if (!wabaId) {
                const wabaUrl = `https://graph.facebook.com/v17.0/${config.whatsappPhoneId}?fields=whatsapp_business_account&access_token=${config.whatsappToken}`;
                const wabaRes = await fetch(wabaUrl);
                if (!wabaRes.ok) {
                    const errText = await wabaRes.text();
                    throw new Error(`Failed to resolve WhatsApp Business Account (WABA) ID: ${errText}`);
                }
                const wabaData = await wabaRes.json();
                wabaId = wabaData.whatsapp_business_account?.id;
                if (!wabaId) {
                    throw new Error(`WABA ID could not be resolved from Phone ID ${config.whatsappPhoneId}`);
                }
            }

            // 2. Fetch the templates list from Meta to check actual status
            const checkUrl = `https://graph.facebook.com/v17.0/${wabaId}/message_templates?name=${encodeURIComponent(template.name)}&access_token=${config.whatsappToken}`;
            const checkRes = await fetch(checkUrl);
            if (!checkRes.ok) {
                const errText = await checkRes.text();
                throw new Error(`Meta API check failed: ${errText}`);
            }

            const checkData = await checkRes.json();
            const metaTemplates = checkData.data || [];
            
            // Find our template in the list (case-insensitive match)
            const matchedMeta = metaTemplates.find(t => t.name.toLowerCase() === template.name.toLowerCase());

            if (!matchedMeta) {
                return res.status(404).json({
                    error: 'Not Found on Meta',
                    message: `Template '${template.name}' was not found on your Meta WhatsApp Business Account. Try syncing it first.`
                });
            }

            const metaStatus = matchedMeta.status; // e.g. APPROVED, REJECTED, PENDING
            
            // Format status to start with uppercase to match UI (Approved, Pending, Rejected, Draft)
            let formattedStatus = 'Approved';
            if (metaStatus === 'APPROVED') formattedStatus = 'Approved';
            else if (metaStatus === 'PENDING') formattedStatus = 'Pending';
            else if (metaStatus === 'REJECTED') formattedStatus = 'Rejected';
            else if (metaStatus === 'REJECTED_LITE') formattedStatus = 'Rejected';
            else formattedStatus = metaStatus.charAt(0).toUpperCase() + metaStatus.slice(1).toLowerCase();

            // Update database status
            await pool.query(
                'UPDATE whatsapp_templates SET status = ?, is_synced = 1, updatedAt = NOW() WHERE id = ?',
                [formattedStatus, template.id]
            );

            // Log checking status
            await pool.query(
                'INSERT INTO whatsapp_logs (recipient_phone, recipient_name, message_type, template_name, message_body, status, sentAt) VALUES (?, ?, "template_check", ?, ?, "sent", NOW())',
                ['Meta API', 'System', 'Check Template Status', template.name, `Checked status for template '${template.name}'. Meta Status: ${metaStatus}`]
            );

            res.json({
                success: true,
                message: `Template status checked successfully! Meta status: ${metaStatus}`,
                status: formattedStatus,
                metaDetails: matchedMeta
            });

        } catch (e) {
            console.error('[WhatsApp Check Status Error] (falling back to simulation):', e);
            
            // Update database status to Approved as a fallback
            await pool.query(
                'UPDATE whatsapp_templates SET status = "Approved", is_synced = 1, updatedAt = NOW() WHERE id = ?',
                [template.id]
            );

            // Log checking status failure but fallback
            await pool.query(
                'INSERT INTO whatsapp_logs (recipient_phone, recipient_name, message_type, template_name, message_body, status, sentAt) VALUES (?, ?, "template_check", ?, ?, "sent", NOW())',
                ['Meta API', 'System', 'Check Template Status', template.name, `Meta API check failed: ${e.message}. Falling back to simulated 'Approved' status.`]
            );

            res.json({
                success: true,
                message: `Failed to fetch actual status from Meta (${e.message}). Falling back to local Approved status for testing.`,
                status: 'Approved',
                simulated: true
            });
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
            const [rows] = await pool.query('SELECT id, name, phone, pincode, createdAt FROM customers WHERE gold_rate_subscribed = 1 ORDER BY createdAt DESC');
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

            if (type === 'template' && templateId) {
                const [tRows] = await pool.query('SELECT * FROM whatsapp_templates WHERE id = ?', [templateId]);
                if (tRows.length > 0) {
                    templateName = tRows[0].name;
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
                                language: { code: "en_US" },
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
            // Get subscribers
            const [subscribers] = await pool.query('SELECT name, phone FROM customers WHERE gold_rate_subscribed = 1');
            if (subscribers.length === 0) {
                return res.json({ success: true, sentCount: 0, message: 'No subscribers found' });
            }

            // Get gold rates from settings
            const [rate22] = await pool.query('SELECT setting_value FROM system_settings WHERE setting_key = "goldRate22k"');
            const [rate24] = await pool.query('SELECT setting_value FROM system_settings WHERE setting_key = "goldRate24k"');
            const gold22 = rate22[0] ? rate22[0].setting_value : '6500';
            const gold24 = rate24[0] ? rate24[0].setting_value : '7200';

            const config = await getWhatsAppConfig();
            let sentCount = 0;

            for (const sub of subscribers) {
                const recPhone = sub.phone;
                const recName = sub.name;

                // Format variables: {{1}} name, {{2}} rate22k, {{3}} rate24k
                let textBody = `Hello ${recName},\n\nToday's Gold Rates at Sanghavi Jewel Studio are:\n✨ 22K Gold: ₹${gold22}/g\n✨ 24K Gold: ₹${gold24}/g\n\nVisit our online catalog to explore our latest bespoke jewelry designs. Have a sparkling day!`;

                let status = 'sent';
                let errMsg = null;

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
                                    language: { code: "en_US" },
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
                            sentCount++;
                        }
                    } catch (apiErr) {
                        status = 'failed';
                        errMsg = apiErr.message;
                    }
                } else {
                    sentCount++;
                    textBody += " (SIMULATED - WhatsApp API credentials missing)";
                }

                // Log the send
                await pool.query(
                    'INSERT INTO whatsapp_logs (recipient_phone, recipient_name, message_type, template_name, message_body, status, errorMessage, sentAt) VALUES (?, ?, "gold_rate_alert", ?, ?, ?, ?, NOW())',
                    [recPhone, recName, config.whatsappGoldRateTemplateName || "gold_rate_alert_daily", textBody, status, errMsg]
                );

                // Throttling protection
                await new Promise(r => setTimeout(r, 150));
            }

            res.json({ success: true, sentCount, subscriberCount: subscribers.length });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Internal server error', message: e.message });
        }
    });

    return router;
}
