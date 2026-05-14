import { AspectRatio } from "@/types.ts";
import { storeService, apiFetch } from "@/services/storeService.ts";

export const analyzeJewelryImage = async (base64Image: string, promptOverride?: string) => {
  try {
    const data = await apiFetch('/ai/analyze-image', {
        method: 'POST',
        body: JSON.stringify({ base64Image, promptOverride })
    });
    if (!data.success) throw new Error(data.error || "Analysis Error");
    return data.data;
  } catch (error) {
    console.error("Analysis Error:", error);
    throw error;
  }
};

export const generateJewelryDesign = async (prompt: string, aspectRatio: AspectRatio, templateOverride?: string) => {
  try {
    const data = await apiFetch('/ai/generate-design', {
        method: 'POST',
        body: JSON.stringify({ prompt, aspectRatio, templateOverride })
    });
    if (!data.success) throw new Error(data.error || "Generation Error");
    return data.data;
  } catch (error) {
    console.error("Generation Error:", error);
    throw error;
  }
};

export const enhanceJewelryImage = async (base64Image: string, promptOverride?: string) => {
  try {
    const data = await apiFetch('/ai/enhance-image', {
        method: 'POST',
        body: JSON.stringify({ base64Image, promptOverride })
    });
    if (!data.success) throw new Error(data.error || "Enhancement Error");
    return data.data;
  } catch (error) { throw error; }
};

export const removeWatermark = async (base64Image: string, promptOverride?: string) => {
  try {
    const data = await apiFetch('/ai/remove-watermark', {
        method: 'POST',
        body: JSON.stringify({ base64Image, promptOverride })
    });
    if (!data.success) throw new Error(data.error || "Watermark Removal Error");
    return data.data;
  } catch (error) { throw error; }
};

export const analyzeInstagramComments = async (comments: any[]) => {
    try {
        const data = await apiFetch('/ai/analyze-comments', {
            method: 'POST',
            body: JSON.stringify({ comments })
        });
        if (!data.success) throw new Error(data.error || "Analysis Error");
        return data.data;
    } catch (error) {
        console.error("AI Comment Analysis Error:", error);
        return { summary: "Failed to analyze comments using AI.", demands: [], complaints: [] };
    }
};
