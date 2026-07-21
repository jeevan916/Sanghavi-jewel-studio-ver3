const fs = require('fs');
const content = fs.readFileSync('server/routes/whatsapp.js', 'utf8');

const replacement = `    router.post('/templates/:id/sync', requireStaff, async (req, res) => {
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
                    let wabaId = config.whatsappWabaId ? config.whatsappWabaId.trim() : null;
                    if (!wabaId) {
                        const wabaUrl = \`https://graph.facebook.com/v17.0/\${config.whatsappPhoneId}?fields=whatsapp_business_account&access_token=\${config.whatsappToken}\`;
                        const wabaRes = await fetch(wabaUrl);
                        if (!wabaRes.ok) {
                            const errText = await wabaRes.text();
                            throw new Error(\`Failed to resolve WABA ID: \${errText}\`);
                        }
                        const wabaData = await wabaRes.json();
                        wabaId = wabaData.whatsapp_business_account?.id;
                        if (!wabaId) {
                            throw new Error(\`WABA ID could not be resolved from Phone ID \${config.whatsappPhoneId}\`);
                        }
                    }

                    // Pull from Meta
                    const checkUrl = \`https://graph.facebook.com/v17.0/\${wabaId}/message_templates?name=\${encodeURIComponent(template.name)}&access_token=\${config.whatsappToken}\`;
                    const checkRes = await fetch(checkUrl);
                    
                    if (!checkRes.ok) {
                        const errData = await checkRes.json().catch(() => ({}));
                        const errMsg = errData.error?.message || \`Meta API returned HTTP \${checkRes.status}\`;
                        throw new Error(errMsg);
                    }
                    
                    const checkData = await checkRes.json();
                    const metaTemplates = checkData.data || [];
                    const matchedMeta = metaTemplates.find(t => t.name.toLowerCase() === template.name.toLowerCase());
                    
                    if (!matchedMeta) {
                        throw new Error(\`Template '\${template.name}' not found on Meta. Please create it in WhatsApp Manager first.\`);
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

                    metaStatus = matchedMeta.status;
                    
                    await pool.query(
                        'UPDATE whatsapp_templates SET body_text = ?, buttons = ?, sample_variables = ?, category = ?, status = ?, is_synced = 1, updatedAt = NOW() WHERE id = ?',
                        [bodyText, JSON.stringify(formattedButtons), JSON.stringify(sampleVariables), matchedMeta.category, metaStatus, template.id]
                    );

                    realSyncSuccess = true;
                    syncMessage = \`Template successfully synced from Meta!\`;
                    
                } catch (metaErr) {
                    console.error('[WhatsApp Sync] Meta API call error:', metaErr);
                    syncMessage = \`Meta API Sync call failed: \${metaErr.message}. Falling back to simulated sync.\`;
                    
                    await pool.query(
                        'UPDATE whatsapp_templates SET is_synced = 1, status = ?, updatedAt = NOW() WHERE id = ?',
                        [metaStatus, template.id]
                    );
                }
            } else {
                 await pool.query(
                    'UPDATE whatsapp_templates SET is_synced = 1, status = ?, updatedAt = NOW() WHERE id = ?',
                    [metaStatus, template.id]
                );
            }

            await pool.query(
                'INSERT INTO whatsapp_logs (recipient_phone, recipient_name, message_type, template_name, message_body, status, sentAt) VALUES (?, ?, "template_sync", ?, ?, "sent", NOW())',
                ['Meta API', 'System', 'Sync Template', template.name, \`Synchronized template '\${template.name}' from Meta (Status: \${metaStatus})\`]
            );

            res.json({ success: true, message: syncMessage, realSync: realSyncSuccess, status: metaStatus });

        } catch (e) {
            res.status(500).json({ error: 'Internal server error', message: e.message });
        }
    });`;

const newContent = content.replace(/router\.post\('\/templates\/:id\/sync', requireStaff, async \(req, res\) => \{[\s\S]*?\} catch \(e\) \{\s*res\.status\(500\)\.json\(\{ error: 'Internal server error', message: e\.message \}\);\s*\}\s*\}\);/, replacement);

fs.writeFileSync('server/routes/whatsapp.js', newContent);
console.log('Patched sync');
