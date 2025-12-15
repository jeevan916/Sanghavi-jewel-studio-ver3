import React, { useState, useEffect, useRef } from 'react';
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';

interface ImageViewerProps {
  images: string[];
  initialIndex?: number;
  title?: string;
  onClose: () => void;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ images, initialIndex = 0, title, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const touchStart = useRef<number | null>(null);
  
  // Vibration helper
  const vibrate = () => {
    if (navigator.vibrate) navigator.vibrate(10);
  };

  const nextImage = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setScale(1);
      vibrate();
    }
  };

  const prevImage = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setScale(1);
      vibrate();
    }
  };

  // Touch Swipe Logic
  const handleTouchStart = (e: React.TouchEvent) => {
    // Only allow swipe if not zoomed in
    if (scale === 1) {
        touchStart.current = e.touches[0].clientX;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current === null || scale !== 1) return;

    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart.current - touchEnd;

    if (Math.abs(diff) > 50) { // Threshold
        if (diff > 0) nextImage();
        else prevImage();
    }
    touchStart.current = null;
  };

  // Reset scale when index changes
  useEffect(() => {
    setScale(1);
  }, [currentIndex]);

  return (
    <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col animate-fade-in">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/60 to-transparent">
        <h3 className="font-serif text-lg font-medium truncate max-w-[80%] drop-shadow-md">{title}</h3>
        <button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-white/20 backdrop-blur">
          <X size={24} />
        </button>
      </div>

      {/* Main Image Area */}
      <div 
        className="flex-1 flex items-center justify-center overflow-hidden relative touch-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
         <img 
            src={images[currentIndex]} 
            alt="Full Screen"
            className="max-w-full max-h-full object-contain transition-transform duration-200"
            style={{ transform: `scale(${scale})` }}
         />
         
         {/* Navigation Overlays */}
         {currentIndex > 0 && (
            <button 
                onClick={(e) => { e.stopPropagation(); prevImage(); }}
                className="absolute left-4 p-3 bg-black/20 rounded-full hover:bg-black/40 backdrop-blur transition-all"
            >
                <ChevronLeft size={32} />
            </button>
         )}
         {currentIndex < images.length - 1 && (
            <button 
                onClick={(e) => { e.stopPropagation(); nextImage(); }}
                className="absolute right-4 p-3 bg-black/20 rounded-full hover:bg-black/40 backdrop-blur transition-all"
            >
                <ChevronRight size={32} />
            </button>
         )}
      </div>

      {/* Bottom Zoom Controls */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 z-10 p-2 bg-black/40 backdrop-blur rounded-full">
         <button onClick={() => setScale(s => Math.max(1, s - 0.5))} className="p-2 hover:bg-white/20 rounded-full"><ZoomOut size={20}/></button>
         <span className="text-sm font-mono flex items-center">{Math.round(scale * 100)}%</span>
         <button onClick={() => setScale(s => Math.min(4, s + 0.5))} className="p-2 hover:bg-white/20 rounded-full"><ZoomIn size={20}/></button>
      </div>

      {/* Image Counter */}
      <div className="absolute bottom-8 right-8 text-xs font-bold bg-black/40 px-3 py-1 rounded-full">
        {currentIndex + 1} / {images.length}
      </div>
    </div>
  );
};