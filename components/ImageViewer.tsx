
import React, { useState, useEffect, useRef } from 'react';
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, RotateCcw, ChevronUp, ChevronDown } from 'lucide-react';

interface ImageViewerProps {
  images: string[];
  initialIndex?: number;
  title?: string;
  onClose: () => void;
  onNextProduct?: () => void;
  onPrevProduct?: () => void;
  disableAnimation?: boolean;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ 
  images, 
  initialIndex = 0, 
  title, 
  onClose,
  onNextProduct,
  onPrevProduct,
  disableAnimation = false
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  
  // Transformation State
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 }); // For zoomed panning
  const [swipeX, setSwipeX] = useState(0);        // For unzoomed image swiping
  const [isDragging, setIsDragging] = useState(false); // Disables transition during drag

  // Gesture Tracking Refs
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const lastTouchPos = useRef<{ x: number; y: number } | null>(null);
  const initialPinchDistance = useRef<number | null>(null);
  const initialPinchScale = useRef<number>(1);
  const swipeLocked = useRef<'x' | 'y' | null>(null); // Locks axis during swipe

  // Reset view when image or index changes
  useEffect(() => {
    resetView();
  }, [currentIndex]);

  const vibrate = (pattern: number | number[] = 10) => {
    if (navigator.vibrate) navigator.vibrate(pattern);
  };

  const nextImage = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(prev => prev + 1);
      vibrate(10);
    } else {
      // Bounds effect (Rubber band release)
      vibrate(20); 
    }
  };

  const prevImage = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      vibrate(10);
    } else {
      vibrate(20);
    }
  };

  const resetView = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
    setSwipeX(0);
    setIsDragging(false);
    swipeLocked.current = null;
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
    e.stopPropagation(); // CRITICAL: Stop bubble to ProductDetails navigation logic
    setIsDragging(true);
    swipeLocked.current = null;

    if (e.touches.length === 2) {
      initialPinchDistance.current = getDistance(e.touches);
      initialPinchScale.current = scale;
    } else if (e.touches.length === 1) {
      touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      lastTouchPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation(); // CRITICAL: Stop bubble to ProductDetails navigation logic
    
    if (e.touches.length === 2 && initialPinchDistance.current !== null) {
      // PINCH ZOOM
      e.preventDefault();
      const currentDistance = getDistance(e.touches);
      const newScale = (currentDistance / initialPinchDistance.current) * initialPinchScale.current;
      setScale(Math.max(1, Math.min(5, newScale)));
    } else if (e.touches.length === 1 && lastTouchPos.current && touchStartPos.current) {
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const dx = currentX - lastTouchPos.current.x;
      const dy = currentY - lastTouchPos.current.y;
      
      const totalDx = currentX - touchStartPos.current.x;
      const totalDy = currentY - touchStartPos.current.y;

      if (scale > 1) {
        // PANNING (Zoomed)
        e.preventDefault(); // Prevent scroll
        setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      } else {
        // SWIPING (Not Zoomed)
        // Determine Axis Lock if not yet set
        if (!swipeLocked.current) {
            if (Math.abs(totalDx) > 10 && Math.abs(totalDx) > Math.abs(totalDy)) {
                swipeLocked.current = 'x';
            } else if (Math.abs(totalDy) > 10) {
                swipeLocked.current = 'y';
            }
        }

        if (swipeLocked.current === 'x') {
            e.preventDefault(); // Prevent browser nav
            // Resistance at edges
            let effectiveDx = dx;
            if ((currentIndex === 0 && swipeX > 0) || (currentIndex === images.length - 1 && swipeX < 0)) {
                effectiveDx *= 0.3; // High resistance
            }
            setSwipeX(prev => prev + effectiveDx);
        } else if (swipeLocked.current === 'y') {
            // Let native scroll happen or handle vertical product swipe logic if we want to drag content
        }
      }
      lastTouchPos.current = { x: currentX, y: currentY };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation(); // CRITICAL: Stop bubble to ProductDetails navigation logic
    setIsDragging(false); // Re-enable transitions
    initialPinchDistance.current = null;

    if (scale === 1 && touchStartPos.current) {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      
      const diffX = touchStartPos.current.x - touchEndX;
      const diffY = touchStartPos.current.y - touchEndY;

      // Handle Horizontal Swipe (Image Nav)
      if (swipeLocked.current === 'x') {
          const threshold = window.innerWidth * 0.25; // Swipe 25% to trigger
          if (swipeX < -threshold && currentIndex < images.length - 1) {
              nextImage();
              setSwipeX(0); // Transition handled by key change or we can animate out
          } else if (swipeX > threshold && currentIndex > 0) {
              prevImage();
              setSwipeX(0);
          } else {
              // Rubber band back
              setSwipeX(0);
          }
      }
      // Handle Vertical Swipe (Product Nav) - Only if we haven't locked X
      else if (swipeLocked.current !== 'x' && Math.abs(diffY) > 60 && Math.abs(diffY) > Math.abs(diffX)) {
         if (diffY > 0 && onNextProduct) { 
            vibrate(30); // Distinct vibration
            onNextProduct();
         } else if (diffY < 0 && onPrevProduct) {
            vibrate(30);
            onPrevProduct();
         }
      }
    }

    // Auto-reset zoom bounds
    if (scale < 1.1) {
      resetView();
    }

    touchStartPos.current = null;
    lastTouchPos.current = null;
    swipeLocked.current = null;
  };

  return (
    <div className={`fixed inset-0 z-[100] bg-black text-white flex flex-col h-[100dvh] select-none ${disableAnimation ? '' : 'animate-fade-in'}`}>
      
      {/* 1. Header */}
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

      {/* 2. Main Image Area */}
      <div 
        className="flex-1 w-full overflow-hidden relative touch-none flex items-center justify-center bg-black"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
         <img 
            key={images[currentIndex]} 
            src={images[currentIndex]} 
            alt="Full Screen"
            draggable={false}
            className="max-w-full max-h-full object-contain will-change-transform"
            style={{ 
              // Synchronized Physics Transform
              transform: `translate3d(${scale > 1 ? pan.x : swipeX}px, ${pan.y}px, 0) scale(${scale})`,
              transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.19, 1, 0.22, 1)', // Apple-like ease-out-expo
              cursor: scale > 1 ? 'move' : 'grab'
            }}
         />
         
         {/* Desktop Navigation Arrows */}
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
                   onClick={(e) => { e.stopPropagation(); vibrate(30); onPrevProduct(); }}
                   className="absolute top-4 left-1/2 -translate-x-1/2 p-2 bg-black/20 rounded-full hover:bg-black/40 backdrop-blur transition-all"
                   title="Previous Product"
               >
                   <ChevronUp size={24} className="text-white/50 hover:text-white" />
               </button>
            )}
             {onNextProduct && (
               <button 
                   onClick={(e) => { e.stopPropagation(); vibrate(30); onNextProduct(); }}
                   className="absolute bottom-4 left-1/2 -translate-x-1/2 p-2 bg-black/20 rounded-full hover:bg-black/40 backdrop-blur transition-all"
                   title="Next Product"
               >
                   <ChevronDown size={24} className="text-white/50 hover:text-white" />
               </button>
            )}
         </div>
      </div>

      {/* 3. Footer */}
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
              onClick={() => { vibrate(); setScale(s => Math.max(1, s - 0.5)); }}
              className="p-2 hover:bg-white/20 rounded-full transition-colors text-stone-300"
            >
                <ZoomOut size={22}/>
            </button>
            <div className="flex flex-col items-center justify-center min-w-[60px]">
                <span className="text-xs font-mono font-bold">{Math.round(scale * 100)}%</span>
                <div className="w-8 h-0.5 bg-gold-50 rounded-full mt-0.5"></div>
            </div>
            <button 
              onClick={() => { vibrate(); setScale(s => Math.min(5, s + 0.5)); }}
              className="p-2 hover:bg-white/20 rounded-full transition-colors text-stone-300"
            >
                <ZoomIn size={22}/>
            </button>
         </div>

         <div className="flex gap-2">
            {images.map((_, idx) => (
                <div 
                    key={idx} 
                    className={`h-1 rounded-full transition-all duration-300 ${idx === currentIndex ? 'w-6 bg-gold-50' : 'w-2 bg-white/30'}`} 
                />
            ))}
         </div>
      </div>
    </div>
  );
};
