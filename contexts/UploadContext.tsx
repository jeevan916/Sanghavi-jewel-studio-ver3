
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Product, QueueItem } from '../types';
import { analyzeJewelryImage } from '../services/geminiService';
import { storeService } from '../services/storeService';

interface UploadContextType {
  queue: QueueItem[];
  addToQueue: (files: File[], supplier: string, category: string, subCategory: string, device: string, manufacturer: string) => void;
  removeFromQueue: (id: string) => void;
  updateQueueItem: (id: string, updates: Partial<QueueItem>) => void;
  clearCompleted: () => void;
  isProcessing: boolean;
  useAI: boolean;
  setUseAI: (value: boolean) => void;
  processImage: (fileOrBase64: File | string, maxWidth?: number, quality?: number, format?: string) => Promise<string>;
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
   * Enhanced image processor that delegates to the Backend Photo Engine
   * Falls back to client-side canvas if server is unreachable (Offline/PWA)
   */
  const processImage = async (
    fileOrBase64: File | string, 
    maxWidth: number = 1600, 
    quality: number = 0.8, 
    format: string = 'image/jpeg'
  ): Promise<string> => {
      try {
          // 1. Prepare FormData
          const formData = new FormData();
          
          if (typeof fileOrBase64 === 'string') {
              // Convert Base64 to Blob
              const fetchResponse = await fetch(fileOrBase64);
              const blob = await fetchResponse.blob();
              formData.append('files', blob, 'image.jpg');
          } else {
              formData.append('files', fileOrBase64);
          }

          // 2. Upload to Engine
          const response = await fetch('/api/media/upload', {
              method: 'POST',
              body: formData
          });

          if (response.ok) {
              const data = await response.json();
              if (data.success && data.files?.[0]) {
                  return data.files[0].primary; // Returns the optimized URL
              }
          }
          throw new Error('Upload Engine Failed');
      } catch (e) {
          console.warn('Backend Upload Failed, falling back to Client-Side Transcoding', e);
          
          // Fallback: Client-Side Canvas Transcoding (Offline Mode)
          return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              let width = img.width;
              let height = img.height;
              if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
              }
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              if (!ctx) return reject(new Error("Canvas context failed"));
              ctx.drawImage(img, 0, 0, width, height);
              resolve(canvas.toDataURL(format, quality));
            };
            img.onerror = () => reject(new Error("Image load failed"));
            if (typeof fileOrBase64 === 'string') {
              img.src = fileOrBase64;
            } else {
              const reader = new FileReader();
              reader.onload = (e) => { img.src = e.target?.result as string; };
              reader.readAsDataURL(fileOrBase64);
            }
          });
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
        
        // Upload to Engine (Auto-transcodes to WebP/AVIF)
        const primaryUrl = await processImage(nextItem.file);
        
        // For thumbnails, we can use the same URL or process a smaller one. 
        // The Engine returns variants but `processImage` helper returns primary string.
        // For simple queue logic, we use primaryUrl for both or trigger another small upload if strictly needed,
        // but backend already optimizes.
        const thumbUrl = primaryUrl; 
        
        // AI Analysis requires Base64. If `primaryUrl` is a server path, we need to convert original file to base64 for Gemini.
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
          images: [primaryUrl], 
          thumbnails: [thumbUrl],
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
