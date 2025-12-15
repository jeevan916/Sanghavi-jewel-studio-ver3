import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Product, QueueItem } from '../types';
import { analyzeJewelryImage, removeWatermark } from '../services/geminiService';
import { storeService } from '../services/storeService';

interface UploadContextType {
  queue: QueueItem[];
  addToQueue: (files: File[], supplier: string, device: string) => void;
  removeFromQueue: (id: string) => void;
  clearCompleted: () => void;
  isProcessing: boolean;
  useAI: boolean;
  setUseAI: (value: boolean) => void;
  cleanImage: (id: string) => void;
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
  const [useAI, setUseAI] = useState(false); // Default OFF for speed
  const currentUser = storeService.getCurrentUser();

  const addToQueue = (files: File[], supplier: string, device: string) => {
    const newItems: QueueItem[] = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'pending',
      supplier,
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

    updateQueueItem(id, { status: 'analyzing' }); // Reuse analyzing status for cleaning
    try {
        const base64 = await fileToBase64(item.file, true); // Compress first
        const cleanedBase64 = await removeWatermark(base64.split(',')[1]);
        
        // We need to update the file in the queue effectively, but File is immutable.
        // We will store the cleaned base64 as the image source for the product later.
        // For now, let's update previewUrl to show the cleaned version and store it.
        const cleanedUrl = `data:image/jpeg;base64,${cleanedBase64}`;
        
        // Convert back to file if we needed to, but we mainly need the base64 for saving.
        // Let's attach the cleaned base64 to the item to be used during 'process'
        updateQueueItem(id, { 
            status: 'pending', 
            previewUrl: cleanedUrl,
            // hack: store cleaned data on the item so we don't re-compress original file later
            // In a real app we'd extend QueueItem type
        });
        
        // We'll leverage a custom property on the item in the process loop, 
        // but for now, since we haven't changed the Type, let's assume the process loop re-reads the file.
        // To make this work properly, we should really update the process loop to prefer existing base64.
        
    } catch (e) {
        console.error("Clean failed", e);
        updateQueueItem(id, { status: 'error', error: 'Cleanup failed' });
    }
  };

  // Image Compression Helper
  const fileToBase64 = (file: File, compress = true): Promise<string> => {
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
            const MAX_WIDTH = 1200; // Optimize for speed/quality balance
            let width = img.width;
            let height = img.height;

            if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            
            // Compress to JPEG 0.7 quality
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
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

        // Check if we have a "cleaned" version already (from Remove Watermark action)
        let base64 = "";
        if (nextItem.previewUrl.startsWith('data:image')) {
            base64 = nextItem.previewUrl;
        } else {
            base64 = await fileToBase64(nextItem.file);
        }

        let analysis: Partial<Product> = {};

        if (useAI) {
            // AI Analysis ON
            const aiResult = await analyzeJewelryImage(base64.split(',')[1]);
            analysis = aiResult;
        } else {
            // AI Analysis OFF - Fast Path
            analysis = {
                title: nextItem.file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
                category: "Uncategorized",
                description: "Direct upload.",
                tags: ["direct-upload"],
                weight: 0,
            };
        }

        updateQueueItem(nextItem.id, { 
            status: 'saving', 
            productTitle: analysis.title 
        });

        const newProduct: Product = {
          id: Date.now().toString() + Math.random().toString().slice(2, 6),
          title: analysis.title || 'Untitled Item',
          category: analysis.category || 'Other',
          subCategory: analysis.subCategory,
          weight: analysis.weight || 0,
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

        storeService.addProduct(newProduct);
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
    <UploadContext.Provider value={{ queue, addToQueue, removeFromQueue, clearCompleted, isProcessing, useAI, setUseAI, cleanImage }}>
      {children}
    </UploadContext.Provider>
  );
};