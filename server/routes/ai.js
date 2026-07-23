import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';

export default function aiRoutes(pool) {
    const router = express.Router();

    const aiLimiter = rateLimit({
        windowMs: 60 * 60 * 1000, 
        max: 200, 
        message: { error: 'Strict Rate limit exceeded for AI generation API. Contact support.' }
    });

    const userQuotas = {};
    const MONTHLY_LIMIT = 500;

    // Authentication middleware to block unauthorized AI requests
    const requireStaff = async (req, res, next) => {
        const authToken = req.headers['x-auth-token'];
        const authHeader = req.headers['authorization'];
        
        let token = authToken;
        if (!token && authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }

        if (!token) {
            console.warn("[Security] Blocked unauthorized AI API request: Missing X-Auth-Token header");
            return res.status(401).json({ error: "Unauthorized: Missing credentials" });
        }
        
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.id;
            
            const [rows] = await pool.query('SELECT * FROM staff WHERE id = ?', [userId]);
            if (rows.length === 0 || !rows[0].isActive) {
                console.warn(`[Security] Blocked unauthorized AI API request for user ${userId}: Not an active staff`);
                return res.status(403).json({ error: "Forbidden: Not an active staff member" });
            }

            // Quota Enforcement
            const currentMonth = new Date().toISOString().slice(0, 7); // e.g. '2026-06'
            if (!userQuotas[userId]) userQuotas[userId] = { month: currentMonth, count: 0 };
            if (userQuotas[userId].month !== currentMonth) userQuotas[userId] = { month: currentMonth, count: 0 };
            
            if (userQuotas[userId].count >= MONTHLY_LIMIT) {
                return res.status(429).json({ error: "Monthly AI quota exceeded. Please contact administrator." });
            }
            userQuotas[userId].count++;

            req.user = rows[0];
            next();
        } catch (e) {
            console.error("Auth error in AI route:", e.message);
            return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
        }
    };

    router.use('/ai/*', aiLimiter);
    router.use('/ai/*', requireStaff);

    router.get('/auth/verify', requireStaff, (req, res) => {
        res.json({ success: true, user: { id: req.user.id, role: req.user.role } });
    });

    const getAIConfig = async () => {
        const [rows] = await pool.query('SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ("ai_model_analysis", "ai_model_enhancement", "ai_model_watermark", "ai_model_design")');
        const dbConfig = {};
        rows.forEach(r => dbConfig[r.setting_key] = r.setting_value);
        
        return {
            models: {
                analysis: dbConfig.ai_model_analysis || 'gemini-3.5-flash',
                enhancement: dbConfig.ai_model_enhancement || 'gemini-3.1-flash-image',
                watermark: dbConfig.ai_model_watermark || 'gemini-3.1-flash-image',
                design: dbConfig.ai_model_design || 'gemini-3.1-flash-image'
            },
            prompts: {
                analysis: "Analyze this luxury jewelry piece. Return a JSON object with: title, category, subCategory, weight (number), description, and tags (array of strings).",
                enhancement: "Hyper-realistic macro jewelry photography, 8k resolution, extreme sharpness, studio lighting. Enhance the brilliance, reflections, and metallic luster. STRICTLY PRESERVE the exact original shape, structure, and fine details. Ensure absolute crispness without softness or noise.",
                watermark: "Remove any text or watermarks from this jewelry image.",
                design: "Generate a high-end jewelry design based on: ${prompt}"
            }
        };
    };

    router.post('/ai/analyze-image', async (req, res) => {
        try {
            const { base64Image, mimeType: providedMimeType, promptOverride } = req.body;
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });
            const config = await getAIConfig();
            
            const mimeTypeMatch = base64Image.match(/^data:(image\/[a-zA-Z0-9+-]+);base64,/);
            const mimeType = providedMimeType || (mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg');
            const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
            const response = await ai.models.generateContent({
              model: config.models.analysis || 'gemini-flash-latest', 
              contents: {
                parts: [
                  { inlineData: { mimeType: mimeType, data: cleanBase64 } },
                  { text: promptOverride || config.prompts.analysis }
                ]
              },
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    category: { type: Type.STRING },
                    subCategory: { type: Type.STRING },
                    weight: { type: Type.NUMBER },
                    description: { type: Type.STRING },
                    tags: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ["title", "category", "description"]
                }
              }
            });
        
            const text = response.text;
            if (!text) throw new Error("AI returned empty response");
            res.json({ success: true, data: JSON.parse(text) });
        } catch (e) {
            console.error("Analysis Error:", e);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    router.post('/ai/generate-design', async (req, res) => {
        try {
            const { prompt, aspectRatio, templateOverride } = req.body;
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });
            const config = await getAIConfig();

            const basePrompt = templateOverride || config.prompts.design;
            const finalPrompt = basePrompt.replace('${prompt}', prompt);
            
            const response = await ai.models.generateContent({
              model: config.models.design,
              contents: {
                parts: [
                  { text: finalPrompt },
                ],
              },
              config: {
                imageConfig: {
                  aspectRatio: aspectRatio,
                }
              }
            });
        
            for (const part of response.candidates?.[0]?.content?.parts || []) {
              if (part.inlineData) {
                  return res.json({ success: true, data: `data:image/png;base64,${part.inlineData.data}` });
              }
            }
            throw new Error("Design generation failed.");
        } catch (error) {
            console.error("Generation Error:", error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    router.post('/ai/enhance-image', async (req, res) => {
        try {
            const { base64Image, mimeType: providedMimeType, promptOverride } = req.body;
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });
            const config = await getAIConfig();

            const mimeTypeMatch = base64Image.match(/^data:(image\/[a-zA-Z0-9+-]+);base64,/);
            const mimeType = providedMimeType || (mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg');
            const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
            const response = await ai.models.generateContent({
              model: config.models.enhancement, 
              contents: {
                parts: [
                  { inlineData: { data: cleanBase64, mimeType: mimeType } },
                  { text: promptOverride || config.prompts.enhancement },
                ],
              },
            });
        
            for (const part of response.candidates?.[0]?.content?.parts || []) {
              if (part.inlineData) {
                  return res.json({ success: true, data: part.inlineData.data });
              }
            }
            throw new Error("Studio enhancement failed");
        } catch (error) {
            console.error("Enhancement Error:", error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    router.post('/ai/remove-watermark', async (req, res) => {
        try {
            const { base64Image, mimeType: providedMimeType, promptOverride } = req.body;
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });
            const config = await getAIConfig();

            const mimeTypeMatch = base64Image.match(/^data:(image\/[a-zA-Z0-9+-]+);base64,/);
            const mimeType = providedMimeType || (mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg');
            const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
            const response = await ai.models.generateContent({
              model: config.models.watermark, 
              contents: {
                parts: [
                  { inlineData: { data: cleanBase64, mimeType: mimeType } },
                  { text: promptOverride || config.prompts.watermark },
                ],
              },
            });
        
            for (const part of response.candidates?.[0]?.content?.parts || []) {
              if (part.inlineData) {
                  return res.json({ success: true, data: part.inlineData.data });
              }
            }
            throw new Error("Cleanup failed");
        } catch (error) {
            console.error("Cleanup Error:", error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    router.post('/ai/analyze-comments', async (req, res) => {
        try {
            const { comments } = req.body;
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });
            
            if (!comments || comments.length === 0) return res.json({ success: true, data: { summary: "No comments available for analysis.", demands: [], complaints: [] } });
            
            const rawTexts = comments.map(c => `[${c.username}]: ${c.text}`).join('\n');
            const prompt = `You are an expert Social Media & Brand Sentiment Analyst for a luxury jewelry studio called "Sanghavi Jewel Studio".
            Analyze the following recent Instagram comments left by our customer base. 
            Determine their general reaction, what specific styles or products they are demanding (Demands), and identify any complaints or pain points (Complaints).
            
            Comments:
            ${rawTexts}
            
            Provide the response strictly in JSON format as follows:
            {
              "summary": "A 2-3 sentence overview of the general sentiment and reaction.",
              "demands": ["Demand 1", "Demand 2"],
              "complaints": ["Complaint 1", "Complaint 2"]
            }`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                }
            });

            const jsonResp = JSON.parse(response.text || '{}');
            res.json({ success: true, data: {
                summary: jsonResp.summary || "No clear sentiment.",
                demands: jsonResp.demands || [],
                complaints: jsonResp.complaints || []
            } });
        } catch (error) {
            console.error("AI Comment Analysis Error:", error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    router.post('/public-ai/search-by-image', async (req, res) => {
        try {
            const { base64Image, mimeType: providedMimeType } = req.body;
            if (!base64Image) {
                return res.status(400).json({ error: "Missing uploaded image" });
            }

            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });
            
            // Extract mimetype and base64
            const mimeTypeMatch = base64Image.match(/^data:(image\/[a-zA-Z0-9+-]+);base64,/);
            const mimeType = providedMimeType || (mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg');
            const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

            // Fetch active products from DB or fallback
            let rows = [];
            try {
                const [dbRows] = await pool.query(
                    'SELECT id, title, category, subCategory, description, tags, thumbnails FROM products WHERE isHidden = 0'
                );
                rows = dbRows;
            } catch (dbErr) {
                console.error("Database query error in image search, checking fallback file:", dbErr);
                const fallbackPath = path.resolve(process.cwd(), 'data', 'demo_products.json');
                const fallbackPathAlt = path.resolve(process.cwd(), '..', 'sanghavi_persistence', 'demo_products.json');
                let foundPath = null;
                if (fs.existsSync(fallbackPath)) foundPath = fallbackPath;
                else if (fs.existsSync(fallbackPathAlt)) foundPath = fallbackPathAlt;
                
                if (foundPath) {
                    rows = JSON.parse(fs.readFileSync(foundPath, 'utf8'));
                } else {
                    throw dbErr;
                }
            }

            // Map and reduce payload size to fit smoothly in Gemini's prompt
            const catalog = rows.map(r => ({
                id: r.id,
                title: r.title,
                category: r.category,
                subCategory: r.subCategory,
                description: r.description || '',
                tags: r.tags ? (typeof r.tags === 'string' ? JSON.parse(r.tags) : r.tags) : []
            }));

            const prompt = `You are an expert gemologist and senior jewelry stylist for "Sanghavi Jewel Studio", a luxury high-end jewelry brand.
            Analyze the uploaded image of a jewelry piece and identify the top matching items from our official jewelry catalog.
            
            Catalog List:
            ${JSON.stringify(catalog)}
            
            Compare the uploaded design (shape, setting, metal, diamond cuts, visual aesthetic) with the items in our catalog.
            Find and rank the top 10 best-matching items by relevance.
            
            Respond strictly in JSON format matching this schema:
            {
                "analysis": "A brief 2-3 sentence visual description of the uploaded jewelry (type, metal, style, stones).",
                "matches": [
                    {
                        "id": "product-id-from-catalog",
                        "score": 95, // Match score percentage out of 100
                        "reason": "Explain clearly why this is a close match (e.g., similar floral diamond setting, matching yellow gold metal, or shared modern silhouette)."
                    }
                ]
            }`;

            const response = await ai.models.generateContent({
                model: 'gemini-3.6-flash',
                contents: {
                    parts: [
                        { inlineData: { mimeType: mimeType, data: cleanBase64 } },
                        { text: prompt }
                    ]
                },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            analysis: { type: Type.STRING },
                            matches: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        id: { type: Type.STRING },
                                        score: { type: Type.NUMBER },
                                        reason: { type: Type.STRING }
                                    },
                                    required: ["id", "score", "reason"]
                                }
                            }
                        },
                        required: ["analysis", "matches"]
                    }
                }
            });

            const text = response.text;
            if (!text) throw new Error("AI returned an empty response");
            
            const result = JSON.parse(text);

            // Enrich matches with actual database fields (like thumbnails)
            const enrichedMatches = result.matches.map(m => {
                const matchedProduct = rows.find(p => p.id === m.id);
                if (matchedProduct) {
                    return {
                        ...m,
                        product: {
                            id: matchedProduct.id,
                            title: matchedProduct.title,
                            category: matchedProduct.category,
                            subCategory: matchedProduct.subCategory,
                            thumbnails: matchedProduct.thumbnails ? (typeof matchedProduct.thumbnails === 'string' ? JSON.parse(matchedProduct.thumbnails) : matchedProduct.thumbnails) : []
                        }
                    };
                }
                return null;
            }).filter(Boolean);

            res.json({
                success: true,
                analysis: result.analysis,
                matches: enrichedMatches
            });

        } catch (e) {
            console.error("Image Search API Error:", e);
            res.status(500).json({ error: 'Internal server error', message: e.message });
        }
    });

    return router;
}
