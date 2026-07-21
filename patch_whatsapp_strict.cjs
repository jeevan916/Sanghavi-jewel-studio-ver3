const fs = require('fs');
let content = fs.readFileSync('server/routes/whatsapp.js', 'utf8');

// Replace Sync
const syncReplacement = `    router.post('/templates/:id/sync', requireStaff, async (req, res) => {
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
                const wabaUrl = \`https://graph.facebook.com/v17.0/\${config.whatsappPhoneId}?fields=whatsapp_business_account&access_token=\${config.whatsappToken}\`;
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
            const checkUrl = \`https://graph.facebook.com/v17.0/\${wabaId}/message_templates?name=\${encodeURIComponent(template.name)}&access_token=\${config.whatsappToken}\`;
            const checkRes = await fetch(checkUrl);
            
            if (!checkRes.ok) {
                const errData = await checkRes.json().catch(() => ({}));
                let errMsg = errData.error?.message || \`Meta API returned HTTP \${checkRes.status}\`;
                
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
                throw new Error(\`Template '\${template.name}' not found on Meta. Please create it in WhatsApp Manager first with exactly this name.\`);
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
            
            await pool.query(
                'UPDATE whatsapp_templates SET body_text = ?, buttons = ?, sample_variables = ?, category = ?, status = ?, is_synced = 1, updatedAt = NOW() WHERE id = ?',
                [bodyText, JSON.stringify(formattedButtons), JSON.stringify(sampleVariables), matchedMeta.category, metaStatus, template.id]
            );

            await pool.query(
                'INSERT INTO whatsapp_logs (recipient_phone, recipient_name, message_type, template_name, message_body, status, sentAt) VALUES (?, ?, "template_sync", ?, ?, "sent", NOW())',
                ['Meta API', 'System', 'Sync Template', template.name, \`Synchronized template '\${template.name}' from Meta (Status: \${metaStatus})\`]
            );

            res.json({ success: true, message: \`Template successfully synced from Meta!\`, status: metaStatus });

        } catch (e) {
            console.error('[WhatsApp Sync Error]:', e.message);
            res.status(400).json({ error: e.message || 'Sync failed.' });
        }
    });`;

// Replace Check-Status
const checkStatusReplacement = `    router.post('/templates/:id/check-status', requireStaff, async (req, res) => {
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
                const wabaUrl = \`https://graph.facebook.com/v17.0/\${config.whatsappPhoneId}?fields=whatsapp_business_account&access_token=\${config.whatsappToken}\`;
                const wabaRes = await fetch(wabaUrl);
                if (!wabaRes.ok) throw new Error('Failed to resolve WABA ID. Please configure it explicitly.');
                const wabaData = await wabaRes.json();
                wabaId = wabaData.whatsapp_business_account?.id;
                if (!wabaId) throw new Error('WABA ID could not be resolved from Phone ID.');
            }

            const checkUrl = \`https://graph.facebook.com/v17.0/\${wabaId}/message_templates?name=\${encodeURIComponent(template.name)}&access_token=\${config.whatsappToken}\`;
            const checkRes = await fetch(checkUrl);
            
            if (!checkRes.ok) {
                const errData = await checkRes.json().catch(() => ({}));
                let errMsg = errData.error?.message || \`Meta API returned HTTP \${checkRes.status}\`;
                if (errMsg.includes('(#100)') && errMsg.includes('message_templates')) {
                    errMsg = 'Your WABA ID is incorrect. It appears you provided a Phone ID in the WABA ID field in Settings. Please use the WhatsApp Business Account ID.';
                }
                throw new Error(errMsg);
            }
            
            const checkData = await checkRes.json();
            const matchedMeta = (checkData.data || []).find(t => t.name.toLowerCase() === template.name.toLowerCase());
            
            if (!matchedMeta) {
                return res.status(404).json({ error: \`Template '\${template.name}' not found on Meta.\` });
            }

            const metaStatus = matchedMeta.status;
            let formattedStatus = 'Approved';
            if (metaStatus === 'APPROVED') formattedStatus = 'Approved';
            else if (metaStatus === 'PENDING') formattedStatus = 'Pending';
            else if (metaStatus === 'REJECTED' || metaStatus === 'REJECTED_LITE') formattedStatus = 'Rejected';
            else formattedStatus = metaStatus.charAt(0).toUpperCase() + metaStatus.slice(1).toLowerCase();

            await pool.query('UPDATE whatsapp_templates SET status = ?, is_synced = 1, updatedAt = NOW() WHERE id = ?', [formattedStatus, template.id]);

            res.json({
                success: true,
                message: \`Meta status: \${metaStatus}\`,
                status: formattedStatus
            });
        } catch (e) {
            console.error('[WhatsApp Check Status Error]:', e.message);
            res.status(400).json({ error: e.message || 'Check status failed.' });
        }
    });`;

content = content.replace(/router\.post\('\/templates\/:id\/sync'[\s\S]*?\}\);/m, syncReplacement);
content = content.replace(/router\.post\('\/templates\/:id\/check-status'[\s\S]*?\}\);/m, checkStatusReplacement);

fs.writeFileSync('server/routes/whatsapp.js', content);
console.log('Patched strict whatsapp endpoints');
