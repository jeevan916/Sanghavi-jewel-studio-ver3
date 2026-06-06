import { AspectRatio } from "@/types.ts";
import { storeService, apiFetch } from "@/services/storeService.ts";

const downsizeBase64 = (base64Str: string, maxDim: number = 768): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width <= maxDim && height <= maxDim) return resolve(base64Str);
      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(base64Str);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => resolve(base64Str);
    img.src = base64Str.startsWith('data:') ? base64Str : `data:image/jpeg;base64,${base64Str}`;
  });
};

export const analyzeJewelryImage = async (base64Image: string, promptOverride?: string) => {
  try {
    const optimizedBase64 = await downsizeBase64(base64Image, 768);
    const data = await apiFetch('/ai/analyze-image', {
        method: 'POST',
        body: JSON.stringify({ base64Image: optimizedBase64, promptOverride })
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
    const optimizedBase64 = await downsizeBase64(base64Image, 768);
    const data = await apiFetch('/ai/enhance-image', {
        method: 'POST',
        body: JSON.stringify({ base64Image: optimizedBase64, promptOverride })
    });
    if (!data.success) throw new Error(data.error || "Enhancement Error");
    return data.data;
  } catch (error) { throw error; }
};

export const removeWatermark = async (base64Image: string, promptOverride?: string) => {
  try {
    const optimizedBase64 = await downsizeBase64(base64Image, 768);
    const data = await apiFetch('/ai/remove-watermark', {
        method: 'POST',
        body: JSON.stringify({ base64Image: optimizedBase64, promptOverride })
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
