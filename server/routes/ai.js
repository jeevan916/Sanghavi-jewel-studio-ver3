import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';

export default function aiRoutes(pool) {
    const router = express.Router();

    // Authentication middleware to block unauthorized AI requests
    const requireStaff = async (req, res, next) => {
        const userId = req.headers['x-user-id'];
        if (!userId) {
            console.warn("[Security] Blocked unauthorized AI API request: Missing X-User-Id header");
            return res.status(401).json({ error: "Unauthorized: Missing credentials" });
        }
        try {
            const [rows] = await pool.query('SELECT * FROM staff WHERE id = ?', [userId]);
            if (rows.length === 0 || !rows[0].isActive) {
                console.warn(`[Security] Blocked unauthorized AI API request for user ${userId}: Not an active staff`);
                return res.status(403).json({ error: "Forbidden: Not an active staff member" });
            }
            next();
        } catch (e) {
            console.error("Auth error in AI route:", e);
            res.status(500).json({ error: "Authentication check failed" });
        }
    };

    router.use('/ai/*', requireStaff);

    const getAIConfig = async () => {
        const [rows] = await pool.query('SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ("ai_model_analysis", "ai_model_enhancement", "ai_model_watermark", "ai_model_design")');
        const dbConfig = {};
        rows.forEach(r => dbConfig[r.setting_key] = r.setting_value);
        
        return {
            models: {
                analysis: dbConfig.ai_model_analysis || 'gemini-flash-latest',
                enhancement: dbConfig.ai_model_enhancement || 'gemini-2.5-flash-image',
                watermark: dbConfig.ai_model_watermark || 'gemini-2.5-flash-image',
                design: dbConfig.ai_model_design || 'gemini-2.5-flash-image'
            },
            prompts: {
                analysis: "Analyze this luxury jewelry piece. Return a JSON object with: title, category, subCategory, weight (number), description, and tags (array of strings).",
                enhancement: "Enhance lighting and clarity for this jewelry piece.",
                watermark: "Remove any text or watermarks from this jewelry image.",
                design: "Generate a high-end jewelry design based on: ${prompt}"
            }
        };
    };

    router.post('/ai/analyze-image', async (req, res) => {
        try {
            const { base64Image, promptOverride } = req.body;
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });
            const config = await getAIConfig();
            
            const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
            const response = await ai.models.generateContent({
              model: config.models.analysis || 'gemini-flash-latest', 
              contents: {
                parts: [
                  { inlineData: { mimeType: "image/jpeg", data: cleanBase64 } },
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
            res.status(500).json({ error: e.message });
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
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/ai/enhance-image', async (req, res) => {
        try {
            const { base64Image, promptOverride } = req.body;
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });
            const config = await getAIConfig();

            const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
            const response = await ai.models.generateContent({
              model: config.models.enhancement, 
              contents: {
                parts: [
                  { inlineData: { data: cleanBase64, mimeType: 'image/jpeg' } },
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
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/ai/remove-watermark', async (req, res) => {
        try {
            const { base64Image, promptOverride } = req.body;
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });
            const config = await getAIConfig();

            const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
            const response = await ai.models.generateContent({
              model: config.models.watermark, 
              contents: {
                parts: [
                  { inlineData: { data: cleanBase64, mimeType: 'image/jpeg' } },
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
            res.status(500).json({ error: error.message });
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
            res.status(500).json({ error: error.message });
        }
    });

    return router;
}
