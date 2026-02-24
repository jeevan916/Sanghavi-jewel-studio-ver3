
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
            analysis: 'gemini-3-flash-preview',
            enhancement: 'gemini-2.5-flash-image',
            watermark: 'gemini-2.5-flash-image',
            design: 'gemini-2.5-flash-image'
        },
        prompts: {
            analysis: "Analyze this luxury jewelry piece...",
            enhancement: "Enhance lighting...",
            watermark: "Remove text...",
            design: "Generate jewelry..."
        }
    };
};

export const analyzeJewelryImage = async (base64Image: string, promptOverride?: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const config = await getAIConfig();
  
  try {
    const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
    const response = await ai.models.generateContent({
      model: config.models.analysis, 
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

    return JSON.parse(response.text || "{}");
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
