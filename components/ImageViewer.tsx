
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
  const isPanning = useRef(false);

  // Vibration helper
  const vibrate = () => {
    if (navigator.vibrate) navigator.vibrate(10);
  };

  const nextImage = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(prev => prev + 1);
      resetView();
      vibrate();
    }
  };

  const prevImage = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      resetView();
      vibrate();
    }
  };

  const resetView = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Distance calculator for pinch
  const getDistance = (touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch start
      initialPinchDistance.current = getDistance(e.touches);
      initialPinchScale.current = scale;
      isPanning.current = false;
    } else if (e.touches.length === 1) {
      // Single touch start (pan or swipe)
      touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      lastTouchPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      isPanning.current = scale > 1;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistance.current !== null) {
      // Handle Pinch
      e.preventDefault();
      const currentDistance = getDistance(e.touches);
      const newScale = (currentDistance / initialPinchDistance.current) * initialPinchScale.current;
      // Clamp scale between 1 and 5
      setScale(Math.max(1, Math.min(5, newScale)));
    } else if (e.touches.length === 1 && lastTouchPos.current) {
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;

      if (scale > 1) {
        // Handle Pan
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
    if (e.touches.length < 2) {
      initialPinchDistance.current = null;
    }

    // Handle Swipe Navigation only if scale is 1
    if (scale === 1 && touchStartPos.current && e.changedTouches.length === 1) {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      
      const diffX = touchStartPos.current.x - touchEndX;
      const diffY = touchStartPos.current.y - touchEndY;

      // Horizontal Swipe (Image Nav) - Priority if Horizontal drag is dominant
      if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX > 0) nextImage();
        else prevImage();
      }
      // Vertical Swipe (Product Nav - Reels Style) - Priority if Vertical drag is dominant
      else if (Math.abs(diffY) > 50 && Math.abs(diffY) > Math.abs(diffX)) {
         if (diffY > 0 && onNextProduct) { // Swipe Up -> Next
            onNextProduct();
            vibrate();
         }
         if (diffY < 0 && onPrevProduct) { // Swipe Down -> Prev
            onPrevProduct();
            vibrate();
         }
      }
    }

    // If scale returns to 1, reset position
    if (scale <= 1) {
      setPosition({ x: 0, y: 0 });
      setScale(1);
    }

    touchStartPos.current = null;
    lastTouchPos.current = null;
  };

  // Reset view when image changes
  useEffect(() => {
    resetView();
  }, [currentIndex]);

  return (
    <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col animate-fade-in select-none">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-20 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <div className="flex flex-col pointer-events-auto">
            <h3 className="font-serif text-lg font-medium truncate max-w-[250px] drop-shadow-md">{title}</h3>
            <span className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">{currentIndex + 1} of {images.length}</span>
        </div>
        <div className="flex gap-2 pointer-events-auto">
            {scale !== 1 && (
                <button onClick={resetView} className="p-2 bg-white/10 rounded-full hover:bg-white/20 backdrop-blur">
                  <RotateCcw size={20} />
                </button>
            )}
            <button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-white/20 backdrop-blur">
              <X size={24} />
            </button>
        </div>
      </div>

      {/* Main Image Area */}
      <div 
        className="flex-1 flex items-center justify-center overflow-hidden relative touch-none bg-stone-950"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
         <img 
            src={images[currentIndex]} 
            alt="Full Screen"
            draggable={false}
            className="max-w-full max-h-full object-contain transition-transform duration-75 will-change-transform"
            style={{ 
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            }}
         />
         
         {/* Navigation Arrows (Desktop Only) */}
         <div className="hidden md:block">
            {currentIndex > 0 && (
                <button 
                    onClick={(e) => { e.stopPropagation(); prevImage(); }}
                    className="absolute left-6 p-4 bg-black/40 rounded-full hover:bg-black/60 backdrop-blur transition-all border border-white/10"
                >
                    <ChevronLeft size={32} />
                </button>
            )}
            {currentIndex < images.length - 1 && (
                <button 
                    onClick={(e) => { e.stopPropagation(); nextImage(); }}
                    className="absolute right-6 p-4 bg-black/40 rounded-full hover:bg-black/60 backdrop-blur transition-all border border-white/10"
                >
                    <ChevronRight size={32} />
                </button>
            )}
            
            {/* Product Nav Desktop Controls */}
            {onPrevProduct && (
               <button 
                   onClick={(e) => { e.stopPropagation(); onPrevProduct(); }}
                   className="absolute top-1/4 left-1/2 -translate-x-1/2 p-2 bg-black/20 rounded-full hover:bg-black/40 backdrop-blur transition-all"
                   title="Previous Product"
               >
                   <ChevronUp size={24} className="text-white/50 hover:text-white" />
               </button>
            )}
             {onNextProduct && (
               <button 
                   onClick={(e) => { e.stopPropagation(); onNextProduct(); }}
                   className="absolute bottom-1/4 left-1/2 -translate-x-1/2 p-2 bg-black/20 rounded-full hover:bg-black/40 backdrop-blur transition-all"
                   title="Next Product"
               >
                   <ChevronDown size={24} className="text-white/50 hover:text-white" />
               </button>
            )}
         </div>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-4 z-20 pointer-events-none">
         {/* Mobile Vertical Swipe Hint */}
         {scale === 1 && (onNextProduct || onPrevProduct) && (
             <div className="flex flex-col items-center opacity-50 animate-pulse pb-4">
                 {onPrevProduct && <ChevronUp size={16} />}
                 <span className="text-[9px] font-bold uppercase tracking-widest text-shadow">Swipe for more</span>
                 {onNextProduct && <ChevronDown size={16} />}
             </div>
         )}

         {/* Zoom Indicator/Controls */}
         <div className="flex gap-4 p-2 bg-black/40 backdrop-blur rounded-full border border-white/10 pointer-events-auto shadow-2xl">
            <button 
              onClick={() => setScale(s => Math.max(1, s - 0.5))} 
              className="p-2 hover:bg-white/20 rounded-full transition-colors text-stone-300"
            >
                <ZoomOut size={22}/>
            </button>
            <div className="flex flex-col items-center justify-center min-w-[60px]">
                <span className="text-xs font-mono font-bold">{Math.round(scale * 100)}%</span>
                <div className="w-8 h-0.5 bg-gold-500 rounded-full mt-0.5"></div>
            </div>
            <button 
              onClick={() => setScale(s => Math.min(5, s + 0.5))} 
              className="p-2 hover:bg-white/20 rounded-full transition-colors text-stone-300"
            >
                <ZoomIn size={22}/>
            </button>
         </div>

         {/* Image Progress Dots */}
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
