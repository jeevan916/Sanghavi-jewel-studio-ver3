
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Product, QueueItem } from '../types';
import { analyzeJewelryImage, enhanceJewelryImage } from '../services/geminiService';
import { storeService } from '../services/storeService';

interface ProcessOptions {
  enhance?: boolean;
  width?: number;
  quality?: number;
  format?: string;
}

interface ImageResult {
    primary: string;
    thumbnail: string;
}

interface UploadContextType {
  queue: QueueItem[];
  addToQueue: (files: File[], supplier: string, category: string, subCategory: string, device: string, manufacturer: string) => void;
  removeFromQueue: (id: string) => void;
  updateQueueItem: (id: string, updates: Partial<QueueItem>) => void;
  clearCompleted: () => void;
  isProcessing: boolean;
  useAI: boolean;
  setUseAI: (value: boolean) => void;
  processImage: (fileOrBase64: File | string, options?: ProcessOptions) => Promise<ImageResult>;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export const useUpload = () => {
  const context = useContext(UploadContext);
  if (!context) throw new Error('useUpload must be used within an UploadProvider');
  return context;
};

export const UploadProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [useAI, setUseAI] = useState(false); 
  const currentUser = storeService.getCurrentUser();

  /**
   * AI-Powered Image Pipeline:
   * 1. Input Normalization (File/URL/Base64 -> Blob)
   * 2. AI Enhancement (Gemini Vision -> Buffer) [Optional]
   * 3. Server Optimization (Sharp -> WebP/AVIF)
   * 4. CDN Delivery (Final URL)
   */
  const processImage = async (
    input: File | string, 
    options: ProcessOptions = {}
  ): Promise<ImageResult> => {
      const { enhance = false, width = 1600, quality = 0.8, format = 'image/jpeg' } = options;

      try {
          // STEP 1: Input Normalization -> Blob
          let currentBlob: Blob;
          let fileName = 'image.jpg';

          if (input instanceof File) {
            currentBlob = input;
            fileName = input.name;
          } else if (typeof input === 'string') {
            if (input.startsWith('data:')) {
               // Base64 -> Blob
               const arr = input.split(',');
               const mime = arr[0].match(/:(.*?);/)?.[1] || format;
               const bstr = atob(arr[1]);
               let n = bstr.length;
               const u8arr = new Uint8Array(n);
               while (n--) u8arr[n] = bstr.charCodeAt(n);
               currentBlob = new Blob([u8arr], { type: mime });
            } else {
               // URL -> Blob (Fetch)
               const res = await fetch(input);
               currentBlob = await res.blob();
               const urlParts = input.split('/');
               fileName = urlParts[urlParts.length - 1] || 'fetched-image.jpg';
            }
          } else {
            throw new Error("Invalid input type");
          }

          // STEP 2: AI Enhancement (Gemini)
          if (enhance) {
             const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(currentBlob);
             });
             
             // Call Gemini Service
             const enhancedBase64Raw = await enhanceJewelryImage(base64);
             
             if (!enhancedBase64Raw) throw new Error("AI Enhancement returned empty data");

             // Convert Raw Base64 back to Blob (Buffer)
             const byteCharacters = atob(enhancedBase64Raw);
             const byteNumbers = new Array(byteCharacters.length);
             for (let i = 0; i < byteCharacters.length; i++) {
                 byteNumbers[i] = byteCharacters.charCodeAt(i);
             }
             const byteArray = new Uint8Array(byteNumbers);
             currentBlob = new Blob([byteArray], { type: 'image/jpeg' });
          }

          // STEP 3: Server Optimization (Sharp Engine)
          const formData = new FormData();
          formData.append('files', currentBlob, fileName);

          const response = await fetch('/api/media/upload', {
              method: 'POST',
              body: formData
          });

          if (response.ok) {
              const data = await response.json();
              if (data.success && data.files?.[0]) {
                  // STEP 4: CDN Delivery (Return both Primary and Thumbnail)
                  return {
                      primary: data.files[0].primary,
                      thumbnail: data.files[0].thumbnail || data.files[0].primary // Fallback to primary if thumb fails
                  }; 
              }
          }
          throw new Error('Upload Engine Failed');

      } catch (e) {
          console.warn('Backend Pipeline Failed, falling back to Client-Side Transcoding', e);
          
          // Fallback: Client-Side Canvas Transcoding (Offline Mode)
          const fallbackUrl = await new Promise<string>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              let w = img.width;
              let h = img.height;
              if (w > width) {
                h = (h * width) / w;
                w = width;
              }
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d');
              if (!ctx) return reject(new Error("Canvas context failed"));
              ctx.drawImage(img, 0, 0, w, h);
              resolve(canvas.toDataURL(format, quality));
            };
            img.onerror = () => reject(new Error("Image load failed"));
            
            if (input instanceof File) {
               const reader = new FileReader();
               reader.onload = (e) => { img.src = e.target?.result as string; };
               reader.readAsDataURL(input);
            } else {
               img.src = input; 
            }
          });

          return { primary: fallbackUrl, thumbnail: fallbackUrl };
      }
  };

  const addToQueue = (files: File[], supplier: string, category: string, subCategory: string, device: string, manufacturer: string) => {
    const newItems: QueueItem[] = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'pending',
      supplier,
      category,
      subCategory,
      weight: 0,
      device,
      manufacturer
    }));
    setQueue(prev => [...prev, ...newItems]);
  };

  const removeFromQueue = useCallback((id: string) => {
    setQueue(prev => {
      const item = prev.find(i => i.id === id);
      if (item && item.previewUrl.startsWith('blob:')) URL.revokeObjectURL(item.previewUrl);
      return prev.filter(item => item.id !== id);
    });
  }, []);

  const updateQueueItem = (id: string, updates: Partial<QueueItem>) => {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const clearCompleted = () => {
    setQueue(prev => {
      prev.filter(i => i.status === 'complete').forEach(i => {
        if (i.previewUrl.startsWith('blob:')) URL.revokeObjectURL(i.previewUrl);
      });
      return prev.filter(item => item.status !== 'complete');
    });
  };

  useEffect(() => {
    const processQueue = async () => {
      if (isProcessing) return;
      const nextItem = queue.find(item => item.status === 'pending');
      if (!nextItem) return;

      setIsProcessing(true);
      try {
        updateQueueItem(nextItem.id, { status: 'analyzing' });
        
        // Use AI Enhancement pipeline if enabled
        const { primary, thumbnail } = await processImage(nextItem.file, { enhance: useAI });
        
        // Metadata Analysis
        let analysis = { title: '', description: "Studio Asset", category: '', subCategory: '', tags: [], weight: 0 };
        if (useAI) {
             const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target?.result as string);
                reader.readAsDataURL(nextItem.file);
             });
             analysis = await analyzeJewelryImage(base64.split(',')[1]);
        }

        const finalTitle = analysis.title || nextItem.file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");

        updateQueueItem(nextItem.id, { status: 'saving', productTitle: finalTitle });

        const newProduct: Product = {
          id: Date.now().toString() + Math.random().toString().slice(2, 6),
          title: finalTitle,
          category: nextItem.category || analysis.category || 'Legacy',
          subCategory: nextItem.subCategory || analysis.subCategory,
          weight: nextItem.weight || analysis.weight || 0,
          description: analysis.description || '',
          tags: analysis.tags || [],
          images: [primary], 
          thumbnails: [thumbnail], // Uses distinct thumbnail
          supplier: nextItem.supplier || 'Internal',
          uploadedBy: currentUser?.name || 'Staff',
          isHidden: false,
          createdAt: new Date().toISOString(),
          dateTaken: new Date().toISOString().split('T')[0],
          meta: { 
            cameraModel: nextItem.device,
            deviceManufacturer: nextItem.manufacturer
          }
        };

        await storeService.addProduct(newProduct);
        updateQueueItem(nextItem.id, { status: 'complete' });
      } catch (err) {
        console.error("Queue process error:", err);
        updateQueueItem(nextItem.id, { status: 'error', error: 'Upload failed' });
      } finally {
        setIsProcessing(false);
      }
    };

    if (queue.some(i => i.status === 'pending')) processQueue();
  }, [queue, isProcessing, currentUser, useAI]);

  return (
    <UploadContext.Provider value={{ queue, addToQueue, removeFromQueue, updateQueueItem, clearCompleted, isProcessing, useAI, setUseAI, processImage }}>
      {children}
    </UploadContext.Provider>
  );
};
