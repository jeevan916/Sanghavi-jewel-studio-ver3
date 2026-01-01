
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

  useEffect(() => {
    const likes = storeService.getLikes();
    setIsLiked(likes.includes(product.id));
  }, [product.id]);

  const handleToggleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    const liked = storeService.toggleLike(product.id);
    setIsLiked(liked);
    if (liked) {
      storeService.logEvent('like', product, null, currentImageIndex);
    }
  };

  const handleInquiry = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await storeService.shareToWhatsApp(product, currentImageIndex);
  };

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % product.images.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + product.images.length) % product.images.length);
  };

  /**
   * Helper to ensure image URLs are correctly resolved.
   * If it's a relative path starting with /uploads, we ensure it uses the full origin.
   */
  const getImageUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('data:') || path.startsWith('http')) return path;
    
    // In production on Hostinger, the origin is the actual domain.
    // Ensure we don't double-slash or miss the root.
    const origin = window.location.origin;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${origin}${cleanPath}`;
  };

  // Favor thumbnail for performance, fallback to main image
  const displayImage = getImageUrl(
    product.thumbnails?.[currentImageIndex] || 
    product.images?.[currentImageIndex] || 
    product.images?.[0]
  );

  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-stone-100 group transition-all hover:shadow-md flex flex-col h-full cursor-pointer" onClick={onClick}>
      <div className="relative aspect-square overflow-hidden bg-stone-100 group/image">
        <img 
          src={displayImage} 
          alt={product.title} 
          className="w-full h-full object-cover transition-transform duration-700 group-hover/image:scale-105" 
          loading="lazy" 
          onError={(e) => {
            // Fallback if thumbnail is broken
            const target = e.target as HTMLImageElement;
            if (product.images?.[currentImageIndex] && target.src !== getImageUrl(product.images[currentImageIndex])) {
               target.src = getImageUrl(product.images[currentImageIndex]);
            }
          }}
        />
        
        <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/10 transition-colors flex items-center justify-center">
            <Maximize2 className="text-white opacity-0 group-hover/image:opacity-100 transition-opacity drop-shadow-md" size={32} />
        </div>

        <button onClick={handleToggleLike} className={`absolute top-2 left-2 p-2 rounded-full backdrop-blur shadow-sm transition-all z-20 ${isLiked ? 'bg-red-50 text-white' : 'bg-white/70 text-stone-400 hover:text-red-500'}`}>
            <Heart size={16} fill={isLiked ? "currentColor" : "none"} />
        </button>

        {product.images.length > 1 && (
          <>
            <button onClick={prevImage} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 p-1 rounded-full shadow-sm opacity-0 group-hover/image:opacity-100 transition-opacity hover:bg-white z-10"><ChevronLeft size={16} /></button>
            <button onClick={nextImage} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 p-1 rounded-full shadow-sm opacity-0 group-hover/image:opacity-100 transition-opacity hover:bg-white z-10"><ChevronRight size={16} /></button>
          </>
        )}
      </div>
      
      <div className="p-4 flex flex-col flex-grow">
        <h3 className="font-serif text-lg text-stone-800 leading-tight mb-1 truncate">{product.title}</h3>
        <div className="flex items-center flex-wrap gap-2 text-xs uppercase tracking-wide text-stone-500 mb-3">
          <span className="font-bold text-gold-600">{product.category}</span>
          <span className="text-stone-300">•</span>
          <span>{product.weight}g</span>
        </div>
        <p className="text-stone-600 text-sm line-clamp-2 mb-4 font-light">{product.description}</p>

        <div className="flex gap-2 mt-auto">
          <button onClick={handleInquiry} className="flex-1 bg-gold-600 text-white text-sm py-2 px-4 rounded-lg hover:bg-gold-700 transition flex items-center justify-center gap-2 font-bold"><MessageCircle size={16} /> Inquire</button>
          <button onClick={(e) => { e.stopPropagation(); navigator.share?.({ title: product.title, url: window.location.href }); }} className="p-2 text-stone-400 hover:text-gold-600 border border-stone-200 rounded-lg"><Share2 size={18} /></button>
        </div>
      </div>
    </div>
  );
};
