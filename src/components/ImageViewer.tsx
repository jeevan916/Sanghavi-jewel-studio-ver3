
import React, { useState, useEffect, useRef } from 'react';
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, RotateCcw, ChevronUp, ChevronDown, AlertCircle } from 'lucide-react';

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
  const [loadError, setLoadError] = useState(false);

  // Lock body scroll when viewer is open
  useEffect(() => {
    const scrollY = window.scrollY;
    const originalStyle = document.body.style.overflow;
    
    // Modern scroll lock for mobile (prevents background scrolling)
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    
    return () => {
      document.body.style.overflow = originalStyle;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollY);
    };
  }, []);

  // Separate effect for wheel handling
  useEffect(() => {
    // Prevent mouse wheel from scrolling background
    const handleWheel = (e: WheelEvent) => {
      if (scale === 1) return; // Allow normal behavior if not zoomed (though viewer is fixed)
      
      e.preventDefault();
      
      // Optional: Implement wheel-to-zoom
      if (e.ctrlKey || e.metaKey) {
        const delta = -e.deltaY;
        setScale(s => Math.max(1, Math.min(5, s + delta * 0.01)));
      } else if (scale > 1) {
        // Implement wheel-to-pan when zoomed
        const w = window.innerWidth;
        const h = window.innerHeight;
        const maxPanX = (w * (scale - 1)) / 2;
        const maxPanY = (h * (scale - 1)) / 2;
        
        setPan(prev => ({
          x: Math.max(-maxPanX, Math.min(maxPanX, prev.x - e.deltaX)),
          y: Math.max(-maxPanY, Math.min(maxPanY, prev.y - e.deltaY))
        }));
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [scale]);

  // Gesture Tracking Refs
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const lastTouchPos = useRef<{ x: number; y: number } | null>(null);
  const lastTouchCount = useRef<number>(0);
  const initialPinchDistance = useRef<number | null>(null);
  const initialPinchScale = useRef<number>(1);
  const swipeLocked = useRef<'x' | 'y' | null>(null); // Locks axis during swipe

  // Safely determine which image to show
  // If currentIndex is out of bounds (e.g. data changed), default to 0 to prevent crashes/broken images
  const safeIndex = currentIndex < images.length ? currentIndex : 0;
  const activeImageSrc = images[safeIndex];

  // Effect to sync state if we detect mismatch or change
  useEffect(() => {
     if (currentIndex >= images.length) {
         setCurrentIndex(0);
         resetView();
     }
  }, [images, currentIndex]);

  // Reset view when image or index changes
  useEffect(() => {
    // Ensure we are reset when the index changes (fallback)
    if (scale !== 1 || pan.x !== 0 || pan.y !== 0) resetView();
    setLoadError(false);
  }, [currentIndex]);

  const vibrate = (pattern: number | number[] = 10) => {
    if (navigator.vibrate) navigator.vibrate(pattern);
  };

  const resetView = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
    setSwipeX(0);
    setIsDragging(false);
    swipeLocked.current = null;
    lastTouchCount.current = 0;
  };

  const nextImage = () => {
    resetView(); // Reset immediately before state update to prevent flash
    if (currentIndex < images.length - 1) {
      setCurrentIndex(prev => prev + 1);
      vibrate(10);
    } else {
      vibrate(20); // Rubber band effect
    }
  };

  const prevImage = () => {
    resetView(); // Reset immediately before state update
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      vibrate(10);
    } else {
      vibrate(20);
    }
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
    setIsDragging(true);
    swipeLocked.current = null;
    lastTouchCount.current = e.touches.length;

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
    e.preventDefault(); // Prevent browser scrolling/navigation
    
    const touchCount = e.touches.length;

    // 1. Handle Finger Count Change (Prevent Jumps)
    if (touchCount !== lastTouchCount.current) {
        lastTouchCount.current = touchCount;
        if (touchCount === 1) {
            // Re-anchor drag if we went from 2 fingers to 1
            lastTouchPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else if (touchCount === 2) {
            // Re-anchor pinch if we went from 1 finger to 2
            initialPinchDistance.current = getDistance(e.touches);
            initialPinchScale.current = scale;
        }
        return;
    }
    
    // 2. PINCH ZOOM Logic
    if (touchCount === 2 && initialPinchDistance.current !== null) {
      const currentDistance = getDistance(e.touches);
      const newScale = (currentDistance / initialPinchDistance.current) * initialPinchScale.current;
      setScale(Math.max(1, Math.min(5, newScale)));
      return;
    } 
    
    // 3. PAN & SWIPE Logic (1 Finger)
    if (touchCount === 1 && lastTouchPos.current && touchStartPos.current) {
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const dx = currentX - lastTouchPos.current.x;
      const dy = currentY - lastTouchPos.current.y;
      
      const totalDx = currentX - touchStartPos.current.x;
      const totalDy = currentY - touchStartPos.current.y;

      if (scale > 1) {
        // PANNING (Zoomed) - Strictly constrained to image boundaries
        
        // Calculate max allowed pan based on screen size and scale
        // Logic: The image overflows the screen by (width * scale - width) / 2 on each side
        const w = window.innerWidth;
        const h = window.innerHeight;
        const maxPanX = (w * (scale - 1)) / 2;
        const maxPanY = (h * (scale - 1)) / 2;

        setPan(prev => ({ 
            x: Math.max(-maxPanX, Math.min(maxPanX, prev.x + dx)),
            y: Math.max(-maxPanY, Math.min(maxPanY, prev.y + dy)) 
        }));
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
            // Resistance at edges
            let effectiveDx = dx;
            if ((currentIndex === 0 && swipeX > 0) || (currentIndex === images.length - 1 && swipeX < 0)) {
                effectiveDx *= 0.3; // High resistance
            }
            setSwipeX(prev => prev + effectiveDx);
        }
      }
      lastTouchPos.current = { x: currentX, y: currentY };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation(); 
    setIsDragging(false); 
    initialPinchDistance.current = null;
    lastTouchCount.current = e.touches.length; // Update count for remaining fingers

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
              setSwipeX(0); 
          } else if (swipeX > threshold && currentIndex > 0) {
              prevImage();
              setSwipeX(0);
          } else {
              // Rubber band back
              setSwipeX(0);
          }
      }
      // Handle Vertical Swipe (Product Nav) - Only if we haven't locked X
      else if (Math.abs(diffY) > 60 && Math.abs(diffY) > Math.abs(diffX)) {
         if (diffY > 0 && onNextProduct) { 
            vibrate(30); 
            onNextProduct();
         } else if (diffY < 0 && onPrevProduct) {
            vibrate(30);
            onPrevProduct();
         }
      }
    }

    // Auto-reset zoom bounds if zoomed out too far
    if (scale < 1.1) {
      resetView();
    }

    // Don't nullify touchStartPos if fingers remain, but usually lift = end of gesture
    if (e.touches.length === 0) {
        touchStartPos.current = null;
        lastTouchPos.current = null;
        swipeLocked.current = null;
    }
  };

  return (
    <div 
        className={`fixed inset-0 z-[100] bg-black text-white flex flex-col h-[100dvh] select-none touch-none ${disableAnimation ? '' : 'animate-fade-in'}`}
        style={{ touchAction: 'none' }} // Critical for stopping browser gestures
    >
      
      {/* 1. Header */}
      <div className="flex-none p-4 flex justify-between items-center z-20 bg-black/50 backdrop-blur-sm border-b border-white/5">
        <div className="flex flex-col">
            <h3 className="font-serif text-lg font-medium truncate max-w-[200px] md:max-w-md">{title}</h3>
            <span className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">{safeIndex + 1} of {images.length}</span>
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
        className="flex-1 w-full overflow-hidden relative flex items-center justify-center bg-black"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
         {loadError || !activeImageSrc ? (
             <div className="flex flex-col items-center gap-2 text-stone-500">
                 <AlertCircle size={48} />
                 <p className="text-xs uppercase font-bold tracking-widest">Media Unavailable</p>
             </div>
         ) : (
             (() => {
                 const isVideo = activeImageSrc.endsWith('.webm') || activeImageSrc.endsWith('.mp4');
                 return isVideo ? (
                     <video 
                        key={safeIndex} 
                        src={activeImageSrc} 
                        draggable={false}
                        onError={() => setLoadError(true)}
                        className="max-w-full max-h-full object-contain will-change-transform"
                        style={{ 
                          transform: `translate3d(${scale > 1 ? pan.x : swipeX}px, ${pan.y}px, 0) scale(${scale})`,
                          transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.19, 1, 0.22, 1)', 
                          cursor: scale > 1 ? 'move' : 'grab'
                        }}
                        autoPlay muted loop playsInline controls
                     />
                 ) : (
                     <img 
                        key={safeIndex} 
                        src={activeImageSrc} 
                        alt="Zoom View"
                        draggable={false}
                        onError={() => setLoadError(true)}
                        className="max-w-full max-h-full object-contain will-change-transform"
                        style={{ 
                          transform: `translate3d(${scale > 1 ? pan.x : swipeX}px, ${pan.y}px, 0) scale(${scale})`,
                          transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.19, 1, 0.22, 1)', 
                          cursor: scale > 1 ? 'move' : 'grab'
                        }}
                     />
                 );
             })()
         )}
         
         {/* Desktop Navigation Arrows */}
         <div className="hidden md:block">
            {safeIndex > 0 && (
                <button 
                    onClick={(e) => { e.stopPropagation(); prevImage(); }}
                    className="absolute left-6 top-1/2 -translate-y-1/2 p-4 bg-black/40 rounded-full hover:bg-black/60 backdrop-blur transition-all border border-white/10"
                >
                    <ChevronLeft size={32} />
                </button>
            )}
            {safeIndex < images.length - 1 && (
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
                    className={`h-1 rounded-full transition-all duration-300 ${idx === safeIndex ? 'w-6 bg-gold-50' : 'w-2 bg-white/30'}`} 
                />
            ))}
         </div>
      </div>
    </div>
  );
};
