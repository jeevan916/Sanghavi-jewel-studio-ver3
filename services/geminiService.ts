
import { GoogleGenAI, Type } from "@google/genai";
import { AspectRatio } from "../types";

/**
 * AI Service for Sanghavi Jewel Studio.
 * Strictly uses Gemini 3.0 for Photo Analysis and 2.5/3.0 for Generation.
 */

export const analyzeJewelryImage = async (base64Image: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", // Gemini 3.0 Vision Analysis
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: cleanBase64 } },
          { text: "Analyze this luxury jewelry piece for a high-end catalog. Respond ONLY with a valid JSON object containing: title, category, subCategory, weight (number), description (marketing tone), tags (array of strings)." }
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
  // Use Gemini 3.0 for high-quality photos, 2.5 Flash for standard
  const model = isPro ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
  
  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          { text: `Hyper-realistic macro studio photography of bespoke jewelry: ${prompt}. Professional luxury lighting, 8k resolution, elegant composition.` },
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
    throw new Error("Design generation failed.");
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
      model: "gemini-2.5-flash-image", // Gemini 2.5 Flash Image for enhancement processing
      contents: {
        parts: [
          { inlineData: { data: cleanBase64, mimeType: 'image/jpeg' } },
          { text: "Jewelry Studio Retouching: Simulate a professional photo box environment. Apply soft, diffused studio lighting with a warm, rich color temperature to enhance the metal's aesthetic. Correct overexposure and remove harsh shadows. Balance the contrast for a high-end Instagram/E-commerce look. CRITICAL: Strictly preserve the original shape, size, and surface texture of the jewelry. DO NOT ADD SPARKLES, starbursts, or artificial glints. Maintain a clean, neutral background." },
        ],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return part.inlineData.data;
    }
    
    // Fallback: If no image, log text if available to understand why
    const textPart = response.candidates?.[0]?.content?.parts?.find(p => p.text);
    if (textPart) console.warn("Gemini returned text instead of image:", textPart.text);
    
    throw new Error("Studio enhancement failed - No image returned");
  } catch (error) { throw error; }
};

export const removeWatermark = async (base64Image: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image", // Gemini 2.5 Flash Image for text/logo removal
      contents: {
        parts: [
          { inlineData: { data: cleanBase64, mimeType: 'image/jpeg' } },
          { text: "Seamlessly remove any watermarks, text, or branding logos from this jewelry image. CRITICAL: Do not blur or distort the jewelry. Keep the metal texture and gemstone facets 100% sharp and original." },
        ],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return part.inlineData.data;
    }
    
    // Fallback: If no image, log text if available to understand why
    const textPart = response.candidates?.[0]?.content?.parts?.find(p => p.text);
    if (textPart) console.warn("Gemini returned text instead of image:", textPart.text);

    throw new Error("Cleanup failed - No image returned");
  } catch (error) { throw error; }
};
