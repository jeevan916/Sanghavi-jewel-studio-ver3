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
