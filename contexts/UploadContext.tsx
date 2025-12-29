import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Product, QueueItem } from '../types';
import { analyzeJewelryImage, removeWatermark, enhanceJewelryImage } from '../services/geminiService';
import { storeService } from '../services/storeService';

interface UploadContextType {
  queue: QueueItem[];
  addToQueue: (files: File[], supplier: string, category: string, subCategory: string, device: string) => void;
  removeFromQueue: (id: string) => void;
  updateQueueItem: (id: string, updates: Partial<QueueItem>) => void;
  clearCompleted: () => void;
  isProcessing: boolean;
  useAI: boolean;
  setUseAI: (value: boolean) => void;
  cleanImage: (id: string) => void;
  studioEnhance: (id: string) => void;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export const useUpload = () => {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error('useUpload must be used within an UploadProvider');
  }
  return context;
};

export const UploadProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [useAI, setUseAI] = useState(false); 
  const currentUser = storeService.getCurrentUser();

  const addToQueue = (files: File[], supplier: string, category: string, subCategory: string, device: string) => {
    const newItems: QueueItem[] = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'pending',
      supplier,
      category,
      subCategory,
      weight: 0,
      device
    }));
    setQueue(prev => [...prev, ...newItems]);
  };

  const removeFromQueue = (id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  };

  const updateQueueItem = (id: string, updates: Partial<QueueItem>) => {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const clearCompleted = () => {
    setQueue(prev => prev.filter(item => item.status !== 'complete'));
  };

  const cleanImage = async (id: string) => {
    const item = queue.find(i => i.id === id);
    if (!item) return;

    updateQueueItem(id, { status: 'analyzing' }); 
    try {
        // Optimized 1200px for storage efficiency
        const base64 = await fileToBase64(item.file, true, 1200, 'image/jpeg'); 
        const cleanedBase64 = await removeWatermark(base64.split(',')[1]);
        const cleanedUrl = `data:image/jpeg;base64,${cleanedBase64}`;
        
        updateQueueItem(id, { 
            status: 'pending', 
            previewUrl: cleanedUrl,
        });
        
    } catch (e) {
        console.error("Clean failed", e);
        updateQueueItem(id, { status: 'error', error: 'Cleanup failed' });
    }
  };

  const studioEnhance = async (id: string) => {
    const item = queue.find(i => i.id === id);
    if (!item) return;

    updateQueueItem(id, { status: 'analyzing' }); 
    try {
        // Optimized 1200px for storage efficiency
        const base64 = await fileToBase64(item.file, true, 1200, 'image/jpeg');
        const enhancedBase64 = await enhanceJewelryImage(base64.split(',')[1]);
        const enhancedUrl = `data:image/jpeg;base64,${enhancedBase64}`;
        
        updateQueueItem(id, { 
            status: 'pending', 
            previewUrl: enhancedUrl,
        });
        
    } catch (e) {
        console.error("Studio Enhancement failed", e);
        updateQueueItem(id, { status: 'error', error: 'Enhancement failed' });
    }
  };

  const fileToBase64 = (file: File, compress = true, maxWidth = 1200, mimeType = 'image/jpeg'): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (!compress) {
            resolve(event.target?.result as string);
            return;
        }
        
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = maxWidth; 
            let width = img.width;
            let height = img.height;

            if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);
            }
            
            // Reduced quality slightly to 0.8 to save space significantly
            const dataUrl = canvas.toDataURL(mimeType, 0.8); 
            resolve(dataUrl);
        };
        img.onerror = reject;
        img.src = event.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const getTodayDate = () => new Date().toISOString().split('T')[0];

  useEffect(() => {
    const processQueue = async () => {
      if (isProcessing) return;
      
      const nextItem = queue.find(item => item.status === 'pending');
      if (!nextItem) return;

      setIsProcessing(true);
      
      try {
        updateQueueItem(nextItem.id, { status: 'analyzing' });

        let base64 = "";
        if (nextItem.previewUrl.startsWith('data:image')) {
            base64 = nextItem.previewUrl;
        } else {
            base64 = await fileToBase64(nextItem.file);
        }

        let analysis: Partial<Product> = {};

        if (useAI) {
            const aiResult = await analyzeJewelryImage(base64.split(',')[1]);
            analysis = aiResult;
        } else {
            analysis = {
                title: nextItem.file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
                description: "Direct upload.",
                tags: ["direct-upload"],
                weight: 0,
            };
        }

        const finalCategory = nextItem.category || analysis.category || 'Other';
        const finalSubCategory = nextItem.subCategory || analysis.subCategory;
        const finalWeight = (nextItem.weight && nextItem.weight > 0) ? nextItem.weight : (analysis.weight || 0);

        updateQueueItem(nextItem.id, { 
            status: 'saving', 
            productTitle: analysis.title 
        });

        const newProduct: Product = {
          id: Date.now().toString() + Math.random().toString().slice(2, 6),
          title: analysis.title || 'Untitled Item',
          category: finalCategory,
          subCategory: finalSubCategory,
          weight: finalWeight,
          description: analysis.description || '',
          tags: analysis.tags || [],
          images: [base64],
          supplier: nextItem.supplier || 'Unknown',
          uploadedBy: currentUser?.name || 'Batch Loader',
          isHidden: false,
          createdAt: new Date().toISOString(),
          dateTaken: getTodayDate(),
          meta: { 
              cameraModel: nextItem.device || 'Unknown',
          }
        };

        await storeService.addProduct(newProduct);
        updateQueueItem(nextItem.id, { status: 'complete' });

      } catch (err) {
        console.error("Batch Upload Error:", err);
        updateQueueItem(nextItem.id, { status: 'error', error: 'Failed' });
      } finally {
        setIsProcessing(false);
      }
    };

    if (queue.some(i => i.status === 'pending')) {
      processQueue();
    }
  }, [queue, isProcessing, currentUser, useAI]);

  return (
    <UploadContext.Provider value={{ queue, addToQueue, removeFromQueue, updateQueueItem, clearCompleted, isProcessing, useAI, setUseAI, cleanImage, studioEnhance }}>
      {children}
    </UploadContext.Provider>
  );
};