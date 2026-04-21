
import { GoogleGenAI, Type } from "@google/genai";
import { AspectRatio } from "@/types.ts";
import { storeService } from "@/services/storeService.ts";

/**
 * AI Service for Sanghavi Jewel Studio.
 * Optimized for Speed and Cost Efficiency (Flash Series Only).
 * Dynamically configured via Database Settings.
 */

// Helper to get active configuration or fallbacks
const getAIConfig = async () => {
    const appConfig = await storeService.getConfig();
    return appConfig.aiConfig || {
        models: {
            analysis: 'gemini-flash-latest',
            enhancement: 'gemini-2.5-flash-image',
            watermark: 'gemini-2.5-flash-image',
            design: 'gemini-2.5-flash-image'
        },
        prompts: {
            analysis: "Analyze this luxury jewelry piece. Return a JSON object with: title, category, subCategory, weight (number), description, and tags (array of strings).",
            enhancement: "Enhance lighting and clarity for this jewelry piece.",
            watermark: "Remove any text or watermarks from this jewelry image.",
            design: "Generate a high-end jewelry design based on: ${prompt}"
        }
    };
};

export const analyzeJewelryImage = async (base64Image: string, promptOverride?: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const config = await getAIConfig();
  
  try {
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
    return JSON.parse(text);
  } catch (error) {
    console.error("Analysis Error:", error);
    throw error;
  }
};

export const generateJewelryDesign = async (prompt: string, aspectRatio: AspectRatio, templateOverride?: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const config = await getAIConfig();

  try {
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
          aspectRatio: aspectRatio as any,
          // imageSize not supported on Flash, defaults to standard
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("Design generation failed.");
  } catch (error) {
    console.error("Generation Error:", error);
    throw error;
  }
};

export const enhanceJewelryImage = async (base64Image: string, promptOverride?: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const config = await getAIConfig();

  try {
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
      if (part.inlineData) return part.inlineData.data;
    }
    
    const textPart = response.candidates?.[0]?.content?.parts?.find(p => p.text);
    if (textPart) console.warn("AI returned text instead of image:", textPart.text);
    
    throw new Error("Studio enhancement failed");
  } catch (error) { throw error; }
};

export const removeWatermark = async (base64Image: string, promptOverride?: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const config = await getAIConfig();

  try {
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
      if (part.inlineData) return part.inlineData.data;
    }
    
    const textPart = response.candidates?.[0]?.content?.parts?.find(p => p.text);
    if (textPart) console.warn("AI returned text instead of image:", textPart.text);

    throw new Error("Cleanup failed");
  } catch (error) { throw error; }
};

export const generateCustomerInsight = async (recentViews: any[], likes: any[], igFeed: any[] = []) => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });
  
  try {
    const activeCategories = Array.from(new Set(recentViews.map(v => v.category))).join(', ');
    const activeTitles = recentViews.slice(0, 3).map(v => v.title).join(', ');
    
    // Inject recent Instagram brand messaging if available
    let igContext = "";
    if (igFeed && igFeed.length > 0) {
        const captions = igFeed.slice(0, 2).map((post: any) => post.caption).filter(Boolean);
        if (captions.length > 0) {
            igContext = `\nOur latest brand inspiration from Instagram:\n"${captions.join(' ')}"\nIncorporate the vibe or specific collections mentioned here if it fits naturally.`;
        }
    }
    
    let prompt = `You are an elite, warm jewelry consultant for "Sanghavi Jewel Studio". 
    The customer is currently browsing these categories: ${activeCategories}. 
    They recently looked at: ${activeTitles}.${igContext}
    
    Write a very short, elegant, and engaging 2-sentence note. 
    Act as their personal AI stylist.
    Encourage them gently based on what they are viewing. Emphasize quality, timelessness, or current trends.
    Do NOT use hashtags. Keep it under 250 characters. Speak directly to them ("I notice you're exploring...").`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Your taste in jewelry is impeccable. Let us know if you need help finding the perfect piece!";
  } catch (error) {
    console.error("Insight Generation Error:", error);
    return "These pieces are truly special. We'd love to help you find the perfect match.";
  }
};

export const analyzeInstagramComments = async (comments: any[]) => {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });
    
    try {
        if (!comments || comments.length === 0) return { summary: "No comments available for analysis.", demands: [], complaints: [] };
        
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
        return {
            summary: jsonResp.summary || "No clear sentiment.",
            demands: jsonResp.demands || [],
            complaints: jsonResp.complaints || []
        };
    } catch (error) {
        console.error("AI Comment Analysis Error:", error);
        return { summary: "Failed to analyze comments using AI.", demands: [], complaints: [] };
    }
};
