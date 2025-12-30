
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Product, QueueItem } from '../types';
import { analyzeJewelryImage, removeWatermark, enhanceJewelryImage } from '../services/geminiService';
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
  cleanImage: (id: string) => void;
  studioEnhance: (id: string) => void;
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

  const addToQueue = (files: File[], supplier: string, category: string, subCategory: string, device: string, manufacturer: string) => {
    const newItems: QueueItem[] = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      previewUrl: URL.createObjectURL(file), // Important: Must revoke later
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
        if (item && item.previewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(item.previewUrl);
        }
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

  const fileToBase64 = (file: File, compress = true, maxWidth = 1600): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (!compress) { resolve(event.target?.result as string); return; }
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            if (width > maxWidth) {
                height *= maxWidth / width;
                width = maxWidth;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);
            }
            resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = reject;
        img.src = event.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const studioEnhance = async (id: string) => {
    const item = queue.find(i => i.id === id);
    if (!item) return;
    updateQueueItem(id, { status: 'analyzing' }); 
    try {
        const base64 = await fileToBase64(item.file);
        const enhancedBase64 = await enhanceJewelryImage(base64.split(',')[1]);
        const enhancedUrl = `data:image/jpeg;base64,${enhancedBase64}`;
        if (item.previewUrl.startsWith('blob:')) URL.revokeObjectURL(item.previewUrl);
        updateQueueItem(id, { status: 'pending', previewUrl: enhancedUrl });
    } catch (e) {
        updateQueueItem(id, { status: 'error', error: 'Enhancement failed' });
    }
  };

  useEffect(() => {
    const processQueue = async () => {
      if (isProcessing) return;
      const nextItem = queue.find(item => item.status === 'pending');
      if (!nextItem) return;

      setIsProcessing(true);
      try {
        updateQueueItem(nextItem.id, { status: 'analyzing' });
        const base64 = nextItem.previewUrl.startsWith('data:image') 
          ? nextItem.previewUrl 
          : await fileToBase64(nextItem.file);

        let analysis = useAI 
          ? await analyzeJewelryImage(base64.split(',')[1]) 
          : { title: nextItem.file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "), description: "Batch upload." };

        updateQueueItem(nextItem.id, { status: 'saving', productTitle: analysis.title });

        const newProduct: Product = {
          id: Date.now().toString() + Math.random().toString().slice(2, 6),
          title: analysis.title || 'Untitled',
          category: nextItem.category || analysis.category || 'Other',
          subCategory: nextItem.subCategory || analysis.subCategory,
          weight: nextItem.weight || analysis.weight || 0,
          description: analysis.description || '',
          tags: analysis.tags || [],
          images: [base64],
          supplier: nextItem.supplier || 'Unknown',
          uploadedBy: currentUser?.name || 'Batch System',
          isHidden: false,
          createdAt: new Date().toISOString(),
          dateTaken: new Date().toISOString().split('T')[0],
          meta: { 
              cameraModel: nextItem.device || 'Unknown',
              deviceManufacturer: nextItem.manufacturer || 'Unknown'
          }
        };

        await storeService.addProduct(newProduct);
        updateQueueItem(nextItem.id, { status: 'complete' });
      } catch (err) {
        updateQueueItem(nextItem.id, { status: 'error', error: 'Upload failed' });
      } finally {
        setIsProcessing(false);
      }
    };

    if (queue.some(i => i.status === 'pending')) processQueue();
  }, [queue, isProcessing, currentUser, useAI]);

  return (
    <UploadContext.Provider value={{ queue, addToQueue, removeFromQueue, updateQueueItem, clearCompleted, isProcessing, useAI, setUseAI, cleanImage: () => {}, studioEnhance }}>
      {children}
    </UploadContext.Provider>
  );
};
