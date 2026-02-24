
import React, { useState, useRef, useEffect } from 'react';
import { Check, X, Sparkles, MoveHorizontal } from 'lucide-react';

interface ComparisonSliderProps {
  before: string;
  after: string;
  onAccept: () => void;
  onDiscard: () => void;
}

export const ComparisonSlider: React.FC<ComparisonSliderProps> = ({ before, after, onAccept, onDiscard }) => {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setPosition((x / rect.width) * 100);
  };

  const onMouseDown = () => setIsDragging(true);
  const onMouseUp = () => setIsDragging(false);
  const onMouseMove = (e: React.MouseEvent) => isDragging && handleMove(e.clientX);
  const onTouchMove = (e: React.TouchEvent) => handleMove(e.touches[0].clientX);

  useEffect(() => {
    const stopDrag = () => setIsDragging(false);
    window.addEventListener('mouseup', stopDrag);
    window.addEventListener('touchend', stopDrag);
    return () => {
      window.removeEventListener('mouseup', stopDrag);
      window.removeEventListener('touchend', stopDrag);
    };
  }, []);

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-stone-900 animate-in fade-in">
       <div 
         ref={containerRef}
         className="relative flex-1 overflow-hidden select-none cursor-ew-resize group"
         onMouseDown={onMouseDown}
         onMouseMove={onMouseMove}
         onTouchMove={onTouchMove}
         onClick={(e) => handleMove(e.clientX)}
       >
         {/* After (Enhanced) - Background */}
         <img src={after} className="absolute inset-0 w-full h-full object-cover" alt="Enhanced" />
         <div className="absolute top-4 right-4 bg-gold-600 text-white px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest shadow-lg flex items-center gap-1 z-10">
           <Sparkles size={12}/> Enhanced
         </div>

         {/* Before (Original) - Clipped Overlay */}
         <div className="absolute inset-0 overflow-hidden border-r-2 border-white shadow-[5px_0_15px_rgba(0,0,0,0.3)]" style={{ width: `${position}%` }}>
            <img src={before} className="absolute inset-0 w-full h-full object-cover max-w-none" style={{ width: containerRef.current?.offsetWidth || '100%' }} alt="Original" />
            <div className="absolute top-4 left-4 bg-black/60 text-white px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest backdrop-blur">
               Original
            </div>
         </div>

         {/* Handle */}
         <div className="absolute inset-y-0 -ml-4 w-8 flex items-center justify-center cursor-ew-resize" style={{ left: `${position}%` }}>
            <div className="w-8 h-8 bg-white rounded-full shadow-xl flex items-center justify-center transform group-hover:scale-110 transition-transform">
                <MoveHorizontal size={16} className="text-stone-800" />
            </div>
         </div>
       </div>

       <div className="h-16 bg-white border-t border-stone-200 flex items-center justify-between px-6 shrink-0">
          <button onClick={onDiscard} className="text-stone-500 hover:text-red-500 font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-colors">
             <X size={18}/> Discard
          </button>
          <span className="text-[10px] text-stone-300 font-bold uppercase tracking-widest hidden md:inline-block">Swipe to Compare</span>
          <button onClick={onAccept} className="bg-stone-900 text-white px-6 py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-gold-600 transition-colors shadow-lg flex items-center gap-2">
             <Check size={18}/> Keep Changes
          </button>
       </div>
    </div>
  );
};
