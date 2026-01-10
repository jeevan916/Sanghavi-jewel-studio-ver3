
import React, { useState, useEffect, useRef } from 'react';
import { Product } from '../types';
import { Heart } from 'lucide-react';
import { storeService } from '../services/storeService';

interface ProductCardProps {
  product: Product;
  isAdmin: boolean;
  onClick?: () => void;
}

// Global cache to prevent re-creating Blobs for the same image session
const blobCache = new Map<string, string>();

export const ProductCard: React.FC<ProductCardProps> = ({ product, onClick }) => {
  const [isLiked, setIsLiked] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [imageSrc, setImageSrc] = useState<string>('');
  const [isLoaded, setIsLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsLiked(storeService.getLikes().includes(product.id));
    
    // Intersection Observer for lazy-loading and memory management
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          prepareImage();
          observer.unobserve(entry.target);
        }
      },
      { 
        rootMargin: '400px', // Pre-load further out for 120hz high-speed scrolling
        threshold: 0.01 
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [product.id]);

  const prepareImage = () => {
    const rawData = product.thumbnails?.[0] || product.images?.[0] || '';
    if (!rawData) return;

    if (rawData.startsWith('http') || rawData.startsWith('/')) {
      setImageSrc(rawData);
      return;
    }

    if (blobCache.has(product.id)) {
      setImageSrc(blobCache.get(product.id)!);
    } else if (rawData.startsWith('data:')) {
      try {
        const parts = rawData.split(',');
        const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/webp';
        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) u8arr[n] = bstr.charCodeAt(n);
        const blob = new Blob([u8arr], { type: mime });
        const url = URL.createObjectURL(blob);
        blobCache.set(product.id, url);
        setImageSrc(url);
      } catch (e) {
        setImageSrc(rawData);
      }
    }
  };

  const handleToggleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.vibrate) navigator.vibrate(10);
    const liked = storeService.toggleLike(product.id);
    setIsLiked(liked);
    if (liked) storeService.logEvent('like', product);
  };

  const isGuest = !storeService.getCurrentUser();

  return (
    <div 
      ref={containerRef}
      className="bg-white rounded-xl overflow-hidden shadow-sm border border-stone-100 group transition-all duration-300 hover:shadow-md flex flex-col h-full cursor-pointer active:scale-[0.98] select-none"
      style={{ 
        contain: 'layout size paint', // Full isolation for GPU optimization
        transform: 'translate3d(0, 0, 0)', // Force GPU layer promotion
        willChange: 'transform',
        backfaceVisibility: 'hidden'
      }}
      onClick={() => { 
        if(navigator.vibrate) navigator.vibrate(5); 
        onClick?.(); 
      }}
    >
      <div className="relative aspect-square overflow-hidden bg-stone-100">
        {isVisible && imageSrc && (
          <img 
            src={imageSrc} 
            alt={product.title} 
            onLoad={() => setIsLoaded(true)}
            decoding="async" // Off-thread decoding prevents scroll stutter
            loading="lazy"
            className={`w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`} 
          />
        )}
        
        {!isLoaded && (
          <div className="absolute inset-0 bg-stone-200 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-stone-300 border-t-gold-500 animate-spin opacity-20" />
          </div>
        )}

        <button 
          onClick={handleToggleLike} 
          className={`absolute top-2 left-2 p-2 rounded-full backdrop-blur shadow-sm z-20 transition-all active:scale-125 ${isLiked ? 'bg-red-50 text-red-500' : 'bg-white/70 text-stone-400'}`}
        >
          <Heart size={16} fill={isLiked ? "currentColor" : "none"} />
        </button>

        {isGuest && (product.images?.length || 0) > 1 && (
          <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 backdrop-blur rounded text-[9px] font-bold text-white uppercase tracking-widest pointer-events-none z-20">
            +{(product.images?.length || 0) - 1} Locked
          </div>
        )}
      </div>
      
      <div className="p-3 flex flex-col flex-grow relative z-20 bg-white">
        <h3 className="font-serif text-sm text-stone-800 leading-tight mb-0.5 truncate font-bold">{product.title}</h3>
        <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-stone-500 mb-1 font-bold">
          <span>{product.category}</span>
          <span>•</span>
          <span>{product.weight}g</span>
        </div>
      </div>
    </div>
  );
};
