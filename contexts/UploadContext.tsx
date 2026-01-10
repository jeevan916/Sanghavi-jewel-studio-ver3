
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
  processImage: (file: File | string) => Promise<string>;
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

  const processImage = (fileOrBase64: File | string): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (typeof fileOrBase64 === 'string') return resolve(fileOrBase64);
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(fileOrBase64);
    });
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
        
        const base64Data = await processImage(nextItem.file);
        
        let analysis = useAI 
          ? await analyzeJewelryImage(base64Data.split(',')[1]) 
          : { title: '', description: "Studio Asset" };

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
          images: [base64Data], // Server will replace this with processed URLs
          thumbnails: [],
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
