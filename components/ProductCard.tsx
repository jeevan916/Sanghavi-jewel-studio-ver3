import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { Share2, MessageCircle, ChevronLeft, ChevronRight, Maximize2, Heart } from 'lucide-react';
import { storeService } from '../services/storeService';

interface ProductCardProps {
  product: Product;
  isAdmin: boolean;
  onClick?: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, isAdmin, onClick }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const isGuest = !storeService.getCurrentUser();

  useEffect(() => {
    const likes = storeService.getLikes();
    setIsLiked(likes.includes(product.id));
  }, [product.id]);

  const handleToggleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.vibrate) navigator.vibrate(10);
    const liked = storeService.toggleLike(product.id);
    setIsLiked(liked);
    if (liked) storeService.logEvent('like', product);
  };

  const handleInquiry = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.vibrate) navigator.vibrate(10);
    await storeService.shareToWhatsApp(product, currentImageIndex);
  };

  const getImageUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('data:') || path.startsWith('http')) return path;
    return `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`;
  };

  const displayImage = getImageUrl(product.thumbnails[currentImageIndex] || product.images[0]);

  return (
    <div 
        className="bg-white rounded-xl overflow-hidden shadow-sm border border-stone-100 group transition-all hover:shadow-md flex flex-col h-full cursor-pointer active:scale-[0.98] select-none" 
        onClick={() => { if(navigator.vibrate) navigator.vibrate(5); onClick?.(); }}
    >
      <div className="relative aspect-square overflow-hidden bg-stone-100">
        <img 
            src={displayImage} 
            alt={product.title} 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
            loading="lazy" 
        />
        
        {/* CRITICAL: High-priority tap overlay to ensure 'button not working' is fixed */}
        <div className="absolute inset-0 z-10 bg-transparent active:bg-black/5" />

        <button onClick={handleToggleLike} className={`absolute top-2 left-2 p-2 rounded-full backdrop-blur shadow-sm z-20 transition-all ${isLiked ? 'bg-red-50 text-red-500' : 'bg-white/70 text-stone-400'}`}>
            <Heart size={16} fill={isLiked ? "currentColor" : "none"} />
        </button>

        {isGuest && product.images.length > 1 && (
             <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 backdrop-blur rounded text-[9px] font-bold text-white uppercase tracking-widest pointer-events-none z-20">
                 +{product.images.length - 1} Locked
             </div>
        )}
      </div>
      
      <div className="p-4 flex flex-col flex-grow relative z-20">
        <h3 className="font-serif text-lg text-stone-800 leading-tight mb-1 truncate font-bold">{product.title}</h3>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-stone-500 mb-3 font-bold">
          <span className="text-gold-600">{product.category}</span>
          <span className="text-stone-300">•</span>
          <span>{product.weight}g</span>
        </div>
        
        <div className="flex gap-2 mt-auto">
          <button onClick={handleInquiry} className="flex-1 bg-gold-600 text-white text-[10px] py-2.5 rounded-lg hover:bg-gold-700 transition flex items-center justify-center gap-2 font-bold uppercase tracking-widest">
            <MessageCircle size={14} /> Inquire
          </button>
          <button onClick={(e) => { e.stopPropagation(); navigator.share?.({ title: product.title, url: window.location.href }); }} className="p-2 text-stone-400 hover:text-gold-600 border border-stone-200 rounded-lg">
            <Share2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};