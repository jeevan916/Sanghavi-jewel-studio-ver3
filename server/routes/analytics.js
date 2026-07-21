import express from 'express';
import crypto from 'crypto';
import { requireAdmin } from '../auth.js';
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
    } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/api/analytics', requireAdmin, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM analytics ORDER BY timestamp DESC LIMIT 500');
        res.json(rows);
    } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/api/analytics/user/:userId', requireAdmin, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM analytics WHERE userId = ? ORDER BY timestamp DESC LIMIT 1000', [req.params.userId]);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/api/intelligence', requireAdmin, async (req, res) => {
    try {
        const [p] = await pool.query('SELECT COUNT(*) as c FROM products');
        const [cust] = await pool.query('SELECT COUNT(*) as c FROM customers');
        const [inq] = await pool.query('SELECT COUNT(*) as c FROM analytics WHERE type="inquiry"');
        res.json({ summary: { totalInventory: p[0].c, totalLeads: cust[0].c, activeInquiries: inq[0].c } });
    } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

    const { writeFileSync, existsSync, readdirSync, statSync } = fs;

router.post('/api/backups', requireAdmin, async (req, res) => {
    const name = `snapshot_${Date.now()}.json`;
    const [products] = await pool.query('SELECT * FROM products');
    writeFileSync(path.join(BACKUPS_ROOT, name), JSON.stringify(products));
    res.json({ success: true, filename: name, size: JSON.stringify(products).length });
});

router.get('/api/backups', requireAdmin, (req, res) => {
    if (!existsSync(BACKUPS_ROOT)) return res.json([]);
    res.json(readdirSync(BACKUPS_ROOT).filter(f => f.endsWith('.json')).map(f => ({ name: f, date: statSync(path.join(BACKUPS_ROOT, f)).mtime, size: statSync(path.join(BACKUPS_ROOT, f)).size })));
});

router.get('/api/backups/download/:name', requireAdmin, (req, res) => {
    // Note: The frontend appends ?key=..., we can validate if needed
    const filePath = path.resolve(path.join(BACKUPS_ROOT, req.params.name));
    if (!filePath.startsWith(path.resolve(BACKUPS_ROOT))) {
        return res.status(403).json({ error: 'Access denied' });
    }
    if (existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).send('Backup not found');
    }
});

router.post('/api/instagram/sync', requireAdmin, async (req, res) => {
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
    } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/api/instagram/comments', requireAdmin, async (req, res) => {
    try {
        const [comments] = await pool.query('SELECT * FROM instagram_comments ORDER BY timestamp DESC LIMIT 100');
        res.json(comments);
    } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/api/admin/location-stats', requireAdmin, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
              c.pincode, 
              COUNT(DISTINCT c.id) as customer_count,
              COUNT(a.id) as total_events,
              SUM(CASE WHEN a.type = 'inquiry' THEN 1 ELSE 0 END) as total_inquiries,
              SUM(CASE WHEN a.type = 'screenshot' THEN 1 ELSE 0 END) as total_screenshots,
              COALESCE(SUM(a.duration), 0) as total_duration,
              ROUND(COALESCE(AVG(NULLIF(a.duration, 0)), 0), 1) as avg_dwell_time
            FROM customers c
            LEFT JOIN analytics a ON c.phone = a.userPhone OR c.id = a.userId
            WHERE c.pincode IS NOT NULL AND c.pincode != ''
            GROUP BY c.pincode
            ORDER BY customer_count DESC, total_events DESC
        `);
        
        // Calculate percentages
        const totalCustomers = rows.reduce((sum, r) => sum + r.customer_count, 0);
        const processed = rows.map(r => ({
            ...r,
            percentage: totalCustomers > 0 ? ((r.customer_count / totalCustomers) * 100).toFixed(1) : "0.0"
        }));

        res.json({ success: true, data: processed });
    } catch (e) {
        console.error("Location stats error:", e);
        res.status(500).json({ error: 'Internal server error', message: e.message });
    }
});

router.get('/api/admin/top-customers', requireAdmin, async (req, res) => {
    const analyzeCustomer = async (customerId) => {
        try {
            // Fetch customer details and stats
            const [customers] = await pool.query(`
                SELECT 
                  c.id, 
                  c.name, 
                  c.phone, 
                  c.pincode, 
                  c.createdAt,
                  COALESCE(SUM(a.duration), 0) as total_duration,
                  SUM(CASE WHEN a.type = 'view' THEN 1 ELSE 0 END) as view_count,
                  SUM(CASE WHEN a.type = 'screenshot' THEN 1 ELSE 0 END) as screenshot_count,
                  SUM(CASE WHEN a.type = 'inquiry' THEN 1 ELSE 0 END) as inquiry_count
                FROM customers c
                LEFT JOIN analytics a ON c.phone = a.userPhone OR c.id = a.userId
                WHERE c.id = ?
                GROUP BY c.id, c.name, c.phone, c.pincode, c.createdAt
            `, [customerId]);

            if (customers.length === 0) return null;
            const customer = customers[0];

            // Fetch their top product browse list
            const [productDwells] = await pool.query(`
                SELECT 
                  productTitle,
                  COALESCE(SUM(duration), 0) as duration,
                  COUNT(id) as visit_count
                FROM analytics
                WHERE (userId = ? OR userPhone = ?) AND productId IS NOT NULL AND productId != ''
                GROUP BY productId, productTitle
                ORDER BY duration DESC
                LIMIT 15
            `, [customer.id, customer.phone]);

            // Initialize Gemini client using modern GoogleGenAI
            const { GoogleGenAI } = await import('@google/genai');
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });

            const prompt = `You are an expert security and brand-protection analyst at Sanghavi Jewel Studio.
We are analyzing customer phone numbers and browsing activity to detect whether they are genuine retail customers, or if they are competitors, wholesale dealers, jewelry manufacturers, or scrapers "peeking" at our private designs/pricing.

Customer Details:
- Name: ${customer.name}
- Phone: ${customer.phone}
- Pincode: ${customer.pincode || 'Not Provided'}

Website Behavior & Engagement Stats:
- Total products browsed: ${customer.view_count || 0}
- Total dwell time on site: ${customer.total_duration || 0} seconds
- Total screenshots taken: ${customer.screenshot_count || 0}
- Inquiries made: ${customer.inquiry_count || 0}
- Products visited and dwell times:
${JSON.stringify(productDwells || [], null, 2)}

Instructions:
1. Examine the phone number and name for business keywords, business directory presence, spam pattern matches, or jeweler designations (e.g., words like 'Jewel', 'Design', 'Gold', 'Silver', 'Ornaments', 'B2B', 'Wholesale').
2. Evaluate their website behavior. For example, high screenshot counts combined with zero inquiries, or viewing an excessive number of images in a very short duration, is highly characteristic of competitor scanning.
3. Determine if the customer is likely a "genuine" retail customer, a "business" (e.g. general business or wholesaler), a "competitor_suspicious" (competing jeweler/scraper actively harvesting designs), or if the status is "unknown".
4. Provide a confidence score (integer 0-100) and a detailed reason explaining your analysis.

Provide the response strictly in JSON format as follows:
{
  "status": "genuine" | "business" | "competitor_suspicious" | "unknown",
  "confidence": 85,
  "reason": "Provide a thorough explanation details..."
}`;

            const response = await ai.models.generateContent({
                model: 'gemini-3.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                }
            });

            const jsonResp = JSON.parse(response.text || '{}');
            const aiAnalysisString = JSON.stringify(jsonResp);

            // Update customer records
            await pool.query('UPDATE customers SET ai_analysis = ? WHERE id = ?', [aiAnalysisString, customerId]);
            return jsonResp;
        } catch (e) {
            console.error(`AI Analysis failed for customer ${customerId}:`, e);
            return null;
        }
    };

    try {
        // Fetch top 50 customers based on duration & event count
        const [customers] = await pool.query(`
            SELECT 
              c.id, 
              c.name, 
              c.phone, 
              c.pincode, 
              c.createdAt,
              c.ai_analysis,
              COALESCE(SUM(a.duration), 0) as total_duration,
              SUM(CASE WHEN a.type = 'view' THEN 1 ELSE 0 END) as view_count,
              SUM(CASE WHEN a.type = 'screenshot' THEN 1 ELSE 0 END) as screenshot_count,
              SUM(CASE WHEN a.type = 'inquiry' THEN 1 ELSE 0 END) as inquiry_count
            FROM customers c
            LEFT JOIN analytics a ON c.phone = a.userPhone OR c.id = a.userId
            GROUP BY c.id, c.name, c.phone, c.pincode, c.createdAt, c.ai_analysis
            ORDER BY total_duration DESC, view_count DESC
            LIMIT 50
        `);

        // For each customer, query their top product dwell times
        const data = [];
        const missingAnalysisIds = [];

        for (const cust of customers) {
            const [dwells] = await pool.query(`
                SELECT 
                  productId,
                  productTitle,
                  COALESCE(SUM(duration), 0) as duration,
                  COUNT(id) as visit_count
                FROM analytics
                WHERE (userId = ? OR userPhone = ?) AND productId IS NOT NULL AND productId != ''
                GROUP BY productId, productTitle
                ORDER BY duration DESC
                LIMIT 10
            `, [cust.id, cust.phone]);

            // Parse ai_analysis if it exists
            let aiAnalysisParsed = null;
            if (cust.ai_analysis) {
                try {
                    aiAnalysisParsed = typeof cust.ai_analysis === 'string' ? JSON.parse(cust.ai_analysis) : cust.ai_analysis;
                } catch (e) {
                    aiAnalysisParsed = { status: 'unknown', reason: 'Error parsing analysis' };
                }
            } else {
                // Keep track of customers that have no analysis yet to run them in the background
                missingAnalysisIds.push(cust.id);
            }

            data.push({
                ...cust,
                ai_analysis: aiAnalysisParsed,
                productDwells: dwells
            });
        }

        // Fire off asynchronous background analysis for any customer missing it
        if (missingAnalysisIds.length > 0) {
            console.log(`[AI BACKGROUND] Found ${missingAnalysisIds.length} customers with missing AI analysis. Initiating lazy background audit...`);
            (async () => {
                for (const cid of missingAnalysisIds) {
                    try {
                        await analyzeCustomer(cid);
                        // Sleep slightly to respect Gemini rate limits
                        await new Promise(r => setTimeout(r, 1500));
                    } catch (err) {
                        console.error(`Background auto-analysis failed for customer ${cid}:`, err);
                    }
                }
                console.log(`[AI BACKGROUND] Completed lazy background audit for ${missingAnalysisIds.length} customers.`);
            })();
        }

        res.json({ success: true, data });
    } catch (e) {
        console.error("Top customers error:", e);
        res.status(500).json({ error: 'Internal server error', message: e.message });
    }
});

router.post('/api/admin/check-business-number', requireAdmin, async (req, res) => {
    const { customerId } = req.body;
    if (!customerId) return res.status(400).json({ error: "Missing customerId" });

    try {
        // Simple manual execution
        const [customers] = await pool.query(`
            SELECT 
              c.id, 
              c.name, 
              c.phone, 
              c.pincode, 
              c.createdAt,
              COALESCE(SUM(a.duration), 0) as total_duration,
              SUM(CASE WHEN a.type = 'view' THEN 1 ELSE 0 END) as view_count,
              SUM(CASE WHEN a.type = 'screenshot' THEN 1 ELSE 0 END) as screenshot_count,
              SUM(CASE WHEN a.type = 'inquiry' THEN 1 ELSE 0 END) as inquiry_count
            FROM customers c
            LEFT JOIN analytics a ON c.phone = a.userPhone OR c.id = a.userId
            WHERE c.id = ?
            GROUP BY c.id, c.name, c.phone, c.pincode, c.createdAt
        `, [customerId]);

        if (customers.length === 0) return res.status(404).json({ error: "Customer not found" });
        const customer = customers[0];

        // Fetch their top product browse list
        const [productDwells] = await pool.query(`
            SELECT 
              productTitle,
              COALESCE(SUM(duration), 0) as duration,
              COUNT(id) as visit_count
            FROM analytics
            WHERE (userId = ? OR userPhone = ?) AND productId IS NOT NULL AND productId != ''
            GROUP BY productId, productTitle
            ORDER BY duration DESC
            LIMIT 15
        `, [customer.id, customer.phone]);

        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });

        const prompt = `You are an expert security and brand-protection analyst at Sanghavi Jewel Studio.
We are analyzing customer phone numbers and browsing activity to detect whether they are genuine retail customers, or if they are competitors, wholesale dealers, jewelry manufacturers, or scrapers "peeking" at our private designs/pricing.

Customer Details:
- Name: ${customer.name}
- Phone: ${customer.phone}
- Pincode: ${customer.pincode || 'Not Provided'}

Website Behavior & Engagement Stats:
- Total products browsed: ${customer.view_count || 0}
- Total dwell time on site: ${customer.total_duration || 0} seconds
- Total screenshots taken: ${customer.screenshot_count || 0}
- Inquiries made: ${customer.inquiry_count || 0}
- Products visited and dwell times:
${JSON.stringify(productDwells || [], null, 2)}

Instructions:
1. Examine the phone number and name for business keywords, business directory presence, spam pattern matches, or jeweler designations (e.g., words like 'Jewel', 'Design', 'Gold', 'Silver', 'Ornaments', 'B2B', 'Wholesale').
2. Evaluate their website behavior. For example, high screenshot counts combined with zero inquiries, or viewing an excessive number of images in a very short duration, is highly characteristic of competitor scanning.
3. Determine if the customer is likely a "genuine" retail customer, a "business" (e.g. general business or wholesaler), a "competitor_suspicious" (competing jeweler/scraper actively harvesting designs), or if the status is "unknown".
4. Provide a confidence score (integer 0-100) and a detailed reason explaining your analysis.

Provide the response strictly in JSON format as follows:
{
  "status": "genuine" | "business" | "competitor_suspicious" | "unknown",
  "confidence": 85,
  "reason": "Provide a thorough explanation details..."
}`;

        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });

        const jsonResp = JSON.parse(response.text || '{}');
        const aiAnalysisString = JSON.stringify(jsonResp);

        await pool.query('UPDATE customers SET ai_analysis = ? WHERE id = ?', [aiAnalysisString, customerId]);
        res.json({ success: true, data: jsonResp });
    } catch (e) {
        console.error("AI check business number error:", e);
        res.status(500).json({ error: 'Internal server error', message: e.message });
    }
});


    return router;
}
