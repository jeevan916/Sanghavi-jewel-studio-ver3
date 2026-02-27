
import React, { useState, useEffect } from 'react';
import { Product } from '@/types.ts';
import { Heart, Lock } from 'lucide-react';
import { storeService } from '@/services/storeService.ts';

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
  const config = storeService.getCached().config;
  const priceData = config ? storeService.calculatePrice(product, config) : null;

  return (
    <div 
      className="bg-white rounded-2xl overflow-hidden shadow-sm border border-stone-100 group transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 flex flex-col h-full cursor-pointer active:scale-[0.98] select-none"
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
      <div className="relative aspect-[4/5] overflow-hidden bg-stone-50">
        <img 
            src={displayImage} 
            alt={product.title} 
            onLoad={() => setIsLoaded(true)}
            decoding="async" 
            loading="lazy" 
            className={`w-full h-full object-cover transition-all duration-700 group-hover:scale-110 ${isLoaded ? 'opacity-100' : 'opacity-0'}`} 
        />
        
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-500"></div>

        {!isLoaded && (
          <div className="absolute inset-0 bg-stone-50 flex items-center justify-center">
             <div className="w-6 h-6 rounded-full border-2 border-stone-200 border-t-brand-gold animate-spin" />
          </div>
        )}

        <button 
          onClick={handleToggleLike} 
          className={`absolute top-3 left-3 p-2.5 rounded-full backdrop-blur-md shadow-sm z-20 transition-all duration-300 active:scale-125 ${isLiked ? 'bg-brand-red text-white' : 'bg-white/80 text-stone-400 hover:bg-white hover:text-brand-red'}`}
        >
          <Heart size={14} fill={isLiked ? "currentColor" : "none"} />
        </button>

        {isGuest && (product.images?.length || 0) > 1 && (
          <div className="absolute top-3 right-3 px-2 py-1 bg-black/40 backdrop-blur-md rounded text-[8px] font-bold text-white uppercase tracking-[0.2em] pointer-events-none z-20">
            +{(product.images?.length || 0) - 1} Locked
          </div>
        )}

        {/* Quick View Overlay */}
        <div className="absolute inset-x-0 bottom-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-500 z-20">
            <div className="w-full py-3 bg-white/90 backdrop-blur-md text-brand-dark text-[10px] font-bold uppercase tracking-[0.2em] text-center rounded-xl shadow-xl">
                View Details
            </div>
        </div>
      </div>
      
      <div className="p-4 flex flex-col flex-grow relative z-20 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 text-[8px] uppercase tracking-[0.3em] text-brand-gold font-bold min-w-0">
              <span className="truncate">{product.category}</span>
              <span className="w-1 h-1 rounded-full bg-stone-200 shrink-0"></span>
              <span className="shrink-0">{product.weight}g</span>
            </div>
            {priceData && (
                <div className={`text-[10px] font-bold bg-stone-50 px-2 py-0.5 rounded-full border border-stone-100 shrink-0 flex items-center gap-1 ${isGuest ? 'text-stone-400' : 'text-brand-dark'}`}>
                    {isGuest ? (
                        <>
                            <Lock size={8} />
                            <span className="blur-[3px] select-none">₹XX,XXX</span>
                        </>
                    ) : (
                        `₹${Math.round(priceData.total).toLocaleString('en-IN')}`
                    )}
                </div>
            )}
        </div>
        <h3 className="font-serif text-base text-stone-900 leading-snug mb-1 font-medium group-hover:text-brand-gold transition-colors">{product.title}</h3>
        <div className="flex justify-between items-center mt-1">
            <p className="text-[10px] text-stone-400 line-clamp-1 font-serif italic">Ref: {product.id.slice(0, 8)}</p>
            <span className="text-[8px] bg-stone-100 px-1.5 py-0.5 rounded text-stone-500 uppercase tracking-widest font-bold">
                {product.meta?.makingChargeSegmentId === 'custom' ? 'Custom' : (config?.makingChargeSegments?.find(s => s.id === (product.meta?.makingChargeSegmentId || config?.defaultMakingChargeSegmentId))?.name || 'Standard')}
            </span>
        </div>
      </div>
    </div>
  );
};
