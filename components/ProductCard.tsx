
import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { Heart } from 'lucide-react';
import { storeService } from '../services/storeService';

interface ProductCardProps {
  product: Product;
  isAdmin: boolean;
  onClick?: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onClick }) => {
  const [isLiked, setIsLiked] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLiked(storeService.getLikes().includes(product.id));
  }, [product.id]);

  const handleToggleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.vibrate) navigator.vibrate(10);
    const liked = storeService.toggleLike(product.id);
    setIsLiked(liked);
    if (liked) storeService.logEvent('like', product);
  };

  const isGuest = !storeService.getCurrentUser();
  const displayImage = product.thumbnails?.[0] || product.images?.[0] || '';

  return (
    <div 
      className="bg-white rounded-xl overflow-hidden shadow-sm border border-stone-100 group transition-all duration-300 hover:shadow-md flex flex-col h-full cursor-pointer active:scale-[0.98] select-none"
      style={{ 
        contain: 'layout paint',
        transform: 'translate3d(0, 0, 0)', 
        willChange: 'transform',
        backfaceVisibility: 'hidden'
      }}
      onClick={() => { 
        if(navigator.vibrate) navigator.vibrate(5); 
        onClick?.(); 
      }}
    >
      <div className="relative aspect-square overflow-hidden bg-stone-100">
        <img 
            src={displayImage} 
            alt={product.title} 
            onLoad={() => setIsLoaded(true)}
            decoding="async" 
            loading="lazy" 
            className={`w-full h-full object-cover transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`} 
        />
        
        {!isLoaded && (
          <div className="absolute inset-0 bg-stone-100 flex items-center justify-center">
             <div className="w-6 h-6 rounded-full border-2 border-stone-200 border-t-gold-400 animate-spin" />
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
