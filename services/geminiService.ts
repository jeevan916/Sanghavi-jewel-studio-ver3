
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { AspectRatio } from "../types";

/**
 * AI Service for Sanghavi Jewel Studio.
 * Optimized for low-cost Gemini 2.5 Flash as default.
 */

export const analyzeJewelryImage = async (base64Image: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-09-2025", // Low-cost flash model
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: cleanBase64 } },
          { text: "Analyze this jewelry piece. JSON output: title, category, subCategory, weight (number), description (marketing tone), tags (array of strings)." }
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

export const generateJewelryDesign = async (prompt: string, aspectRatio: AspectRatio, isPro: boolean = false) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  // Default to flash for cost savings unless user explicitly enables Pro
  const model = isPro ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
  
  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          { text: `Professional macro studio photography of ${prompt}. Luxury lighting, clear reflections, high-end jewelry style.` },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio as any,
          imageSize: isPro ? "2K" : "1K"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("Generation failed.");
  } catch (error) {
    console.error("Generation Error:", error);
    throw error;
  }
};

export const enhanceJewelryImage = async (base64Image: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-09-2025",
      contents: {
        parts: [
          { inlineData: { data: cleanBase64, mimeType: 'image/jpeg' } },
          { text: "Apply luxury jewelry photo enhancement: balance exposure, sharpen facets, clean background." },
        ],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return part.inlineData.data;
    }
    throw new Error("Enhancement failed");
  } catch (error) { throw error; }
};

export const removeWatermark = async (base64Image: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-09-2025",
      contents: {
        parts: [
          { inlineData: { data: cleanBase64, mimeType: 'image/jpeg' } },
          { text: "Remove any watermarks or text overlays from this jewelry image while preserving all fine details." },
        ],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return part.inlineData.data;
    }
    throw new Error("Cleanup failed");
  } catch (error) { throw error; }
};
