import { GoogleGenAI, Type } from "@google/genai";
import { AspectRatio } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Image Analysis ---

export const analyzeJewelryImage = async (base64Image: string) => {
  try {
    // Switched to gemini-2.5-flash for speed
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", 
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image,
            },
          },
          {
            text: `Analyze this jewelry image for inventory management. 
            Extract the likely title, category (Necklace, Ring, Earrings, Bracelet, Bangle, Set, Other), 
            and a specific sub-category (e.g., Choker, Solitaire, Jhumka).
            Estimate gold weight in grams (if visible on tag, otherwise estimate based on visual size), 
            a luxurious marketing description, and 5 relevant search tags.
            Also, determine if the image contains any visible price tags or clutter that should be removed.`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            category: { type: Type.STRING },
            subCategory: { type: Type.STRING },
            weight: { type: Type.NUMBER, description: "Estimated weight in grams" },
            description: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            needsEditing: { type: Type.BOOLEAN, description: "True if price tags or clutter detected" }
          },
          required: ["title", "category", "weight", "description", "tags"],
        },
      },
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Analysis failed:", error);
    // Return basic fallback if AI fails, to allow upload to proceed
    return {
      title: "Unprocessed Jewelry Item",
      category: "Other",
      description: "AI Analysis failed, please edit details manually.",
      tags: ["upload"],
      weight: 0
    };
  }
};

// --- Remove Watermark / Cleanup ---

export const removeWatermark = async (base64Image: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image,
            },
          },
          {
            text: 'Remove any watermarks, text overlays, or price tags from this image. Keep the jewelry exactly as is, just clean up the background and overlays.',
          },
        ],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return part.inlineData.data; // Return cleaned image base64
      }
    }
    return base64Image; // Fallback to original if no image returned
  } catch (error) {
    console.error("Watermark removal failed:", error);
    throw error;
  }
};

// --- Market Trends (Grounding) ---

export const getJewelryMarketTrends = async () => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "What are the current trending gold and diamond jewelry styles in India and globally for this season? Focus on design motifs, gold tones, and gemstone popularity.",
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    
    // Process response for frontend display
    return {
      text: response.text,
      sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (error) {
    console.error("Trends fetch failed:", error);
    throw error;
  }
};

// --- Image Generation ---

export const generateJewelryDesign = async (prompt: string, aspectRatio: AspectRatio) => {
  try {
    // Determine image size based on quality requirements, defaulting to 1K for speed/preview
    const imageSize = "1K"; 
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [{ text: `Professional jewelry design photography, 8k resolution, cinematic lighting, photorealistic. ${prompt}` }],
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: imageSize,
        }
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image data returned");
  } catch (error) {
    console.error("Generation failed:", error);
    throw error;
  }
};