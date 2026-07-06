import { AspectRatio } from "@/types.ts";
import { storeService, apiFetch } from "@/services/storeService.ts";

const downsizeBase64 = (base64Str: string, maxDim: number = 768, forceMimeType?: string): Promise<string> => {
  return new Promise((resolve) => {
    let mimeType = 'image/webp'; // Default to webp for better quality/size
    const match = base64Str.match(/^data:(image\/[a-zA-Z0-9+-]+);base64,/);
    if (match) mimeType = match[1];
    if (forceMimeType) mimeType = forceMimeType;

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
      resolve(canvas.toDataURL(mimeType, 0.95)); // Use 95% quality instead of 80%
    };
    img.onerror = () => resolve(base64Str);
    img.src = base64Str.startsWith('data:') ? base64Str : `data:${mimeType};base64,${base64Str}`;
  });
};

export const analyzeJewelryImage = async (base64Image: string, promptOverride?: string) => {
  try {
    const originalMimeType = base64Image.match(/^data:(image\/[a-zA-Z0-9+-]+);base64,/)?.[1] || 'image/webp';
    const optimizedBase64 = await downsizeBase64(base64Image, 768, originalMimeType);
    const finalMimeType = optimizedBase64.match(/^data:(image\/[a-zA-Z0-9+-]+);base64,/)?.[1] || originalMimeType;
    
    const data = await apiFetch('/ai/analyze-image', {
        method: 'POST',
        body: JSON.stringify({ base64Image: optimizedBase64, mimeType: finalMimeType, promptOverride })
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
    const finalMimeType = base64Image.match(/^data:(image\/[a-zA-Z0-9+-]+);base64,/)?.[1] || 'image/webp';

    const data = await apiFetch('/ai/enhance-image', {
        method: 'POST',
        body: JSON.stringify({ base64Image, mimeType: finalMimeType, promptOverride })
    });
    if (!data.success) throw new Error(data.error || "Enhancement Error");
    return data.data;
  } catch (error) { throw error; }
};

export const deterministicEnhance = async (base64Image: string) => {
  try {
    const data = await apiFetch('/media/deterministic-enhance', {
        method: 'POST',
        body: JSON.stringify({ base64Image })
    });
    if (!data.success) throw new Error(data.error || "Deterministic Enhancement Error");
    return data.data; // this returns full data URl
  } catch (error) { throw error; }
};

export const removeWatermark = async (base64Image: string, promptOverride?: string) => {
  try {
    const finalMimeType = base64Image.match(/^data:(image\/[a-zA-Z0-9+-]+);base64,/)?.[1] || 'image/webp';

    const data = await apiFetch('/ai/remove-watermark', {
        method: 'POST',
        body: JSON.stringify({ base64Image, mimeType: finalMimeType, promptOverride })
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
