
import React, { useState, useEffect, useRef } from 'react';
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, RotateCcw, ChevronUp, ChevronDown } from 'lucide-react';

interface ImageViewerProps {
  images: string[];
  initialIndex?: number;
  title?: string;
  onClose: () => void;
  onNextProduct?: () => void;
  onPrevProduct?: () => void;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ 
  images, 
  initialIndex = 0, 
  title, 
  onClose,
  onNextProduct,
  onPrevProduct
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  
  // Refs for gesture tracking
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const lastTouchPos = useRef<{ x: number; y: number } | null>(null);
  const initialPinchDistance = useRef<number | null>(null);
  const initialPinchScale = useRef<number>(1);

  // Reset view when image or index changes
  useEffect(() => {
    resetView();
  }, [currentIndex, images]);

  const vibrate = () => {
    if (navigator.vibrate) navigator.vibrate(10);
  };

  const nextImage = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(prev => prev + 1);
      vibrate();
    }
  };

  const prevImage = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      vibrate();
    }
  };

  const resetView = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Preload neighboring images
  useEffect(() => {
    const preload = (url: string) => {
        if (!url) return;
        const img = new Image();
        img.src = url;
    };
    if (currentIndex < images.length - 1) preload(images[currentIndex + 1]);
    if (currentIndex > 0) preload(images[currentIndex - 1]);
  }, [currentIndex, images]);

  const getDistance = (touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation(); 
    if (e.touches.length === 2) {
      initialPinchDistance.current = getDistance(e.touches);
      initialPinchScale.current = scale;
    } else if (e.touches.length === 1) {
      touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      lastTouchPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (e.touches.length === 2 && initialPinchDistance.current !== null) {
      e.preventDefault();
      const currentDistance = getDistance(e.touches);
      const newScale = (currentDistance / initialPinchDistance.current) * initialPinchScale.current;
      setScale(Math.max(1, Math.min(5, newScale)));
    } else if (e.touches.length === 1 && lastTouchPos.current) {
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;

      if (scale > 1) {
        e.preventDefault();
        const dx = currentX - lastTouchPos.current.x;
        const dy = currentY - lastTouchPos.current.y;
        setPosition(prev => ({
          x: prev.x + dx,
          y: prev.y + dy
        }));
      }
      lastTouchPos.current = { x: currentX, y: currentY };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (e.touches.length < 2) {
      initialPinchDistance.current = null;
    }

    if (scale === 1 && touchStartPos.current && e.changedTouches.length === 1) {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      
      const diffX = touchStartPos.current.x - touchEndX;
      const diffY = touchStartPos.current.y - touchEndY;

      // Horizontal Swipe (Image Nav)
      if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX > 0) nextImage();
        else prevImage();
      }
      // Vertical Swipe (Product Nav)
      else if (Math.abs(diffY) > 50 && Math.abs(diffY) > Math.abs(diffX)) {
         if (diffY > 0 && onNextProduct) { 
            onNextProduct();
            vibrate();
         }
         if (diffY < 0 && onPrevProduct) {
            onPrevProduct();
            vibrate();
         }
      }
    }

    // Auto-reset if zoomed out too much
    if (scale < 1.1) {
      resetView();
    }

    touchStartPos.current = null;
    lastTouchPos.current = null;
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col h-[100dvh] animate-fade-in select-none">
      
      {/* 1. Header (Static - Reserves Space) */}
      <div className="flex-none p-4 flex justify-between items-center z-20 bg-black/50 backdrop-blur-sm border-b border-white/5">
        <div className="flex flex-col">
            <h3 className="font-serif text-lg font-medium truncate max-w-[200px] md:max-w-md">{title}</h3>
            <span className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">{currentIndex + 1} of {images.length}</span>
        </div>
        <div className="flex gap-2">
            {scale !== 1 && (
                <button onClick={resetView} className="p-2 bg-white/10 rounded-full hover:bg-white/20 backdrop-blur transition-colors">
                  <RotateCcw size={20} />
                </button>
            )}
            <button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-white/20 backdrop-blur transition-colors">
              <X size={24} />
            </button>
        </div>
      </div>

      {/* 2. Main Image Area (Flex-1 - Takes Remaining Safe Space) */}
      <div 
        className="flex-1 w-full overflow-hidden relative touch-none flex items-center justify-center bg-stone-950"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
         <img 
            key={images[currentIndex]} 
            src={images[currentIndex]} 
            alt="Full Screen"
            draggable={false}
            // max-w-full and max-h-full ensure it fits within the flex-1 area
            className="max-w-full max-h-full object-contain transition-transform duration-75 will-change-transform"
            style={{ 
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            }}
         />
         
         {/* Desktop Navigation Arrows (Inside relative container) */}
         <div className="hidden md:block">
            {currentIndex > 0 && (
                <button 
                    onClick={(e) => { e.stopPropagation(); prevImage(); }}
                    className="absolute left-6 top-1/2 -translate-y-1/2 p-4 bg-black/40 rounded-full hover:bg-black/60 backdrop-blur transition-all border border-white/10"
                >
                    <ChevronLeft size={32} />
                </button>
            )}
            {currentIndex < images.length - 1 && (
                <button 
                    onClick={(e) => { e.stopPropagation(); nextImage(); }}
                    className="absolute right-6 top-1/2 -translate-y-1/2 p-4 bg-black/40 rounded-full hover:bg-black/60 backdrop-blur transition-all border border-white/10"
                >
                    <ChevronRight size={32} />
                </button>
            )}
            
            {onPrevProduct && (
               <button 
                   onClick={(e) => { e.stopPropagation(); onPrevProduct(); }}
                   className="absolute top-4 left-1/2 -translate-x-1/2 p-2 bg-black/20 rounded-full hover:bg-black/40 backdrop-blur transition-all"
                   title="Previous Product"
               >
                   <ChevronUp size={24} className="text-white/50 hover:text-white" />
               </button>
            )}
             {onNextProduct && (
               <button 
                   onClick={(e) => { e.stopPropagation(); onNextProduct(); }}
                   className="absolute bottom-4 left-1/2 -translate-x-1/2 p-2 bg-black/20 rounded-full hover:bg-black/40 backdrop-blur transition-all"
                   title="Next Product"
               >
                   <ChevronDown size={24} className="text-white/50 hover:text-white" />
               </button>
            )}
         </div>
      </div>

      {/* 3. Footer (Static - Reserves Space) */}
      <div className="flex-none p-4 pb-safe flex flex-col items-center gap-4 z-20 bg-black/50 backdrop-blur-sm border-t border-white/5">
         
         {scale === 1 && (onNextProduct || onPrevProduct) && (
             <div className="flex flex-col items-center opacity-50 animate-pulse">
                 {onPrevProduct && <ChevronUp size={16} />}
                 <span className="text-[9px] font-bold uppercase tracking-widest text-shadow">Swipe for more</span>
                 {onNextProduct && <ChevronDown size={16} />}
             </div>
         )}

         <div className="flex gap-4 p-2 bg-black/40 backdrop-blur rounded-full border border-white/10 shadow-2xl">
            <button 
              onClick={() => setScale(s => Math.max(1, s - 0.5))} 
              className="p-2 hover:bg-white/20 rounded-full transition-colors text-stone-300"
            >
                <ZoomOut size={22}/>
            </button>
            <div className="flex flex-col items-center justify-center min-w-[60px]">
                <span className="text-xs font-mono font-bold">{Math.round(scale * 100)}%</span>
                <div className="w-8 h-0.5 bg-gold-50 rounded-full mt-0.5"></div>
            </div>
            <button 
              onClick={() => setScale(s => Math.min(5, s + 0.5))} 
              className="p-2 hover:bg-white/20 rounded-full transition-colors text-stone-300"
            >
                <ZoomIn size={22}/>
            </button>
         </div>

         <div className="flex gap-2">
            {images.map((_, idx) => (
                <div 
                    key={idx} 
                    className={`h-1 rounded-full transition-all duration-300 ${idx === currentIndex ? 'w-6 bg-gold-500' : 'w-2 bg-white/30'}`} 
                />
            ))}
         </div>
      </div>
    </div>
  );
};
