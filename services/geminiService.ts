
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { AspectRatio } from "../types";

/**
 * AI Service for Sanghavi Jewel Studio.
 * Optimized for Gemini 3 Flash Performance.
 */

export const analyzeJewelryImage = async (base64Image: string) => {
  // Always initialize fresh to ensure latest API key is used
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", 
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: cleanBase64 } },
          { text: "Analyze this jewelry piece for a luxury catalog. Respond ONLY with a JSON object containing: title, category, subCategory, weight (number), description (marketing tone), tags (array of strings)." }
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
  const model = isPro ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
  
  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          { text: `Hyper-realistic high-end jewelry photography of ${prompt}. Macro lens, luxury studio lighting, isolated on elegant background.` },
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
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { data: cleanBase64, mimeType: 'image/jpeg' } },
          { text: "Act as a jewelry retoucher. Enhance stone clarity, sharpen facets, and clean up shadows for a professional luxury look." },
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
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { data: cleanBase64, mimeType: 'image/jpeg' } },
          { text: "Digitally remove any text, watermarks, or branding logos from this jewelry image while keeping the jewelry and its details perfectly intact." },
        ],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return part.inlineData.data;
    }
    throw new Error("Cleanup failed");
  } catch (error) { throw error; }
};
