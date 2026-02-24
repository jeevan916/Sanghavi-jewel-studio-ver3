
import React, { useState, useRef, useEffect } from 'react';
import { X, RotateCw, Crop, Sun, Contrast, Droplet, Thermometer, Check, Undo2, ZoomIn, Move } from 'lucide-react';

interface ImageEditorProps {
  imageSrc: string;
  onSave: (newImageBase64: string) => void;
  onCancel: () => void;
}

type AspectRatio = 'original' | '1:1' | '4:3' | '16:9';
type ToolType = 'tune' | 'rotate' | 'crop';

interface EditSettings {
  brightness: number; 
  contrast: number;   
  saturation: number; 
  warmth: number;     
  rotation: number;   
  aspectRatio: AspectRatio;
  scale: number;
  offsetX: number;
  offsetY: number;
}

const DEFAULT_SETTINGS: EditSettings = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  warmth: 0,
  rotation: 0,
  aspectRatio: 'original',
  scale: 1,
  offsetX: 0,
  offsetY: 0
};

export const ImageEditor: React.FC<ImageEditorProps> = ({ imageSrc, onSave, onCancel }) => {
  const [settings, setSettings] = useState<EditSettings>(DEFAULT_SETTINGS);
  const [activeTool, setActiveTool] = useState<ToolType>('tune');
  const [isSaving, setIsSaving] = useState(false);
  const [activeTune, setActiveTune] = useState<'brightness' | 'contrast' | 'saturation' | 'warmth'>('brightness');
  
  // Dragging State
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
     setSettings(s => ({ ...s, offsetX: 0, offsetY: 0, scale: 1 }));
  }, [settings.rotation, settings.aspectRatio]);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
        const img = new Image();
        img.src = imageSrc;
        img.crossOrigin = "anonymous";
        
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const isRotated90 = settings.rotation % 180 !== 0;
            const originalW = isRotated90 ? img.height : img.width;
            const originalH = isRotated90 ? img.width : img.height;
            
            let targetW = originalW;
            let targetH = originalH;

            if (settings.aspectRatio !== 'original') {
                const [rW, rH] = settings.aspectRatio.split(':').map(Number);
                const ratio = rW / rH;
                
                if (originalW / originalH > ratio) {
                    targetH = originalH;
                    targetW = originalH * ratio;
                } else {
                    targetW = originalW;
                    targetH = originalW / ratio;
                }
            }

            canvas.width = targetW;
            canvas.height = targetH;

            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const tempCanvas = document.createElement('canvas');
            const dim = Math.max(img.width, img.height) * 2; 
            tempCanvas.width = dim;
            tempCanvas.height = dim;
            const tCtx = tempCanvas.getContext('2d');
            if (!tCtx) return;

            tCtx.translate(dim/2, dim/2);
            tCtx.rotate((settings.rotation * Math.PI) / 180);
            tCtx.filter = `
                brightness(${settings.brightness}%) 
                contrast(${settings.contrast}%) 
                saturate(${settings.saturation}%) 
                sepia(${settings.warmth}%)
            `;
            tCtx.drawImage(img, -img.width/2, -img.height/2);

            const domContainer = containerRef.current;
            const domContainerW = domContainer?.offsetWidth || 1;
            const uiToCanvasRatio = targetW / domContainerW; 
            
            const finalOffsetX = settings.offsetX * uiToCanvasRatio;
            const finalOffsetY = settings.offsetY * uiToCanvasRatio;
            
            ctx.translate(canvas.width/2, canvas.height/2);
            ctx.translate(finalOffsetX, finalOffsetY);
            ctx.scale(settings.scale, settings.scale);
            
            let drawW, drawH;
            const imgRatio = originalW / originalH;
            const canvasRatio = targetW / targetH;
            
            if (imgRatio > canvasRatio) {
                drawW = targetW;
                drawH = targetW / imgRatio;
            } else {
                drawH = targetH;
                drawW = targetH * imgRatio;
            }
            
            ctx.drawImage(
                tempCanvas, 
                (dim - originalW)/2, (dim - originalH)/2, originalW, originalH, 
                -drawW/2, -drawH/2, drawW, drawH 
            );

            const resultBase64 = canvas.toDataURL('image/jpeg', 0.9);
            onSave(resultBase64);
            setIsSaving(false);
        };
    }, 100);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
      isDragging.current = true;
      lastPos.current = { x: e.clientX, y: e.clientY };
      if(containerRef.current) containerRef.current.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      if (!isDragging.current) return;
      e.preventDefault();
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      lastPos.current = { x: e.clientX, y: e.clientY };
      
      setSettings(s => ({
          ...s,
          offsetX: s.offsetX + dx,
          offsetY: s.offsetY + dy
      }));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      isDragging.current = false;
      if(containerRef.current) containerRef.current.releasePointerCapture(e.pointerId);
  };

  const renderSlider = (
    value: number, 
    min: number, 
    max: number, 
    onChange: (val: number) => void,
    label: string
  ) => (
      <div className="w-full max-w-sm mx-auto px-4 pb-4">
           <div className="flex justify-between text-[10px] text-stone-400 mb-2 font-bold uppercase tracking-widest">
               <span>{label}</span>
               <span className="text-gold-500">{Math.round(value)}</span>
           </div>
           <input 
              type="range" 
              min={min} max={max} 
              value={value} 
              onChange={(e) => onChange(Number(e.target.value))}
              className="w-full accent-gold-500 h-0.5 bg-stone-700 rounded-lg appearance-none cursor-pointer"
           />
      </div>
  );

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col text-white animate-fade-in select-none">
      
      {/* 1. TOP HEADER */}
      <div className="flex justify-between items-center p-4 h-16 bg-black/80 backdrop-blur border-b border-stone-800 z-10">
          <button onClick={onCancel} className="p-2 text-stone-400 hover:text-white transition">
            <X size={24} />
          </button>
          <div className="flex flex-col items-center">
            <span className="font-serif text-sm font-bold tracking-widest uppercase text-gold-500">Sanghavi Studio</span>
            <span className="text-[10px] text-stone-500 uppercase font-medium">Fine Jewelry Editor</span>
          </div>
          <button 
            onClick={handleSave} 
            disabled={isSaving}
            className="px-6 py-1.5 bg-white text-black rounded-full text-xs font-bold uppercase tracking-widest hover:bg-gold-100 transition disabled:opacity-50"
          >
             {isSaving ? 'Processing' : 'Save'}
          </button>
      </div>

      {/* 2. MAIN WORKSPACE (Maximized) */}
      <div className="flex-1 relative overflow-hidden bg-[#0a0a0a] flex items-center justify-center p-6 touch-none">
          <div 
            ref={containerRef}
            className="relative shadow-2xl overflow-hidden ring-1 ring-stone-800 transition-all duration-300 ease-in-out"
            style={{
                aspectRatio: settings.aspectRatio === 'original' ? 'auto' : settings.aspectRatio.replace(':', '/'),
                width: settings.aspectRatio === 'original' ? 'auto' : '100%',
                height: settings.aspectRatio === 'original' ? '100%' : 'auto',
                maxWidth: '100%',
                maxHeight: '100%',
                cursor: 'move'
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
             <img 
                ref={imageRef}
                src={imageSrc} 
                draggable={false}
                alt="Edit Target"
                className="max-w-none max-h-none block origin-center" 
                style={{
                    width: settings.aspectRatio === 'original' ? 'auto' : '100%',
                    height: settings.aspectRatio === 'original' ? '100%' : 'auto',
                    objectFit: 'contain', 
                    transform: `
                        translate(${settings.offsetX}px, ${settings.offsetY}px) 
                        rotate(${settings.rotation}deg) 
                        scale(${settings.scale})
                    `,
                    filter: `
                        brightness(${settings.brightness}%) 
                        contrast(${settings.contrast}%) 
                        saturate(${settings.saturation}%) 
                        sepia(${settings.warmth}%)
                    `
                }}
             />
             
             {/* Editorial Gridlines */}
             <div className="absolute inset-0 pointer-events-none border border-white/5 grid grid-cols-3 grid-rows-3">
                  <div className="border-r border-white/5"></div>
                  <div className="border-r border-white/5"></div>
                  <div></div>
                  <div className="border-t border-b border-white/5 col-span-3 row-start-2"></div>
             </div>
          </div>

          {/* Quick Zoom Tooltip */}
          <div className="absolute bottom-6 left-6 flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-full backdrop-blur border border-white/10 opacity-60 hover:opacity-100 transition">
              <ZoomIn size={14} className="text-stone-400" />
              <span className="text-[10px] font-mono">{Math.round(settings.scale * 100)}%</span>
              <button onClick={() => setSettings(s => ({...s, scale: 1, offsetX: 0, offsetY: 0}))} className="ml-2 text-[8px] bg-white/10 px-1.5 py-0.5 rounded hover:bg-white/20">Reset</button>
          </div>
      </div>

      {/* 3. CONTEXTUAL CONTROLS (Bottom Panel) */}
      <div className="bg-black border-t border-stone-800 pb-safe z-10 shadow-[0_-20px_50px_rgba(0,0,0,1)]">
          {/* Active Tool Sub-options */}
          <div className="p-4 flex flex-col items-center">
              {activeTool === 'tune' && (
                  <div className="w-full flex flex-col">
                      <div className="mb-4">
                        {activeTune === 'brightness' && renderSlider(settings.brightness, 50, 150, (v) => setSettings({...settings, brightness: v}), 'Luminance')}
                        {activeTune === 'contrast' && renderSlider(settings.contrast, 50, 150, (v) => setSettings({...settings, contrast: v}), 'Depth')}
                        {activeTune === 'saturation' && renderSlider(settings.saturation, 0, 200, (v) => setSettings({...settings, saturation: v}), 'Vibrance')}
                        {activeTune === 'warmth' && renderSlider(settings.warmth, 0, 50, (v) => setSettings({...settings, warmth: v}), 'Amber Balance')}
                      </div>
                      <div className="flex gap-6 justify-center">
                          {[
                            {id: 'brightness', icon: Sun, label: 'Light'},
                            {id: 'contrast', icon: Contrast, label: 'Pop'},
                            {id: 'saturation', icon: Droplet, label: 'Color'},
                            {id: 'warmth', icon: Thermometer, label: 'Tone'}
                          ].map(t => (
                              <button 
                                key={t.id}
                                onClick={() => setActiveTune(t.id as any)} 
                                className={`flex flex-col items-center gap-1.5 transition ${activeTune === t.id ? 'text-gold-500' : 'text-stone-600 hover:text-stone-400'}`}
                              >
                                  <t.icon size={18} strokeWidth={activeTune === t.id ? 2.5 : 2} />
                                  <span className="text-[8px] font-bold uppercase tracking-widest">{t.label}</span>
                              </button>
                          ))}
                      </div>
                  </div>
              )}
              
              {activeTool === 'crop' && (
                   <div className="flex gap-4 w-full justify-center">
                       {['original', '1:1', '4:3', '16:9'].map(r => (
                           <button 
                                key={r}
                                onClick={() => setSettings({...settings, aspectRatio: r as AspectRatio, offsetX: 0, offsetY: 0, scale: 1})}
                                className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition ${settings.aspectRatio === r ? 'border-gold-500 text-gold-500 bg-gold-500/10' : 'border-stone-800 text-stone-600'}`}
                           >
                               {r === 'original' ? 'Full' : r}
                           </button>
                       ))}
                   </div>
              )}
              
              {activeTool === 'rotate' && (
                  <div className="flex items-center gap-8">
                       <button onClick={() => setSettings(s => ({...s, rotation: s.rotation - 90}))} className="p-3 bg-stone-900 rounded-full hover:text-gold-500 transition border border-stone-800"><Undo2 size={20}/></button>
                       <div className="flex flex-col items-center">
                            <span className="text-xl font-serif text-white">{settings.rotation % 360}°</span>
                            <span className="text-[8px] font-bold text-stone-500 uppercase tracking-widest">Rotation</span>
                       </div>
                       <button onClick={() => setSettings(s => ({...s, rotation: s.rotation + 90}))} className="p-3 bg-stone-900 rounded-full hover:text-gold-500 transition border border-stone-800"><RotateCw size={20}/></button>
                  </div>
              )}
          </div>

          {/* MAIN TOOL CATEGORIES */}
          <div className="flex justify-around items-center h-20 border-t border-stone-900 bg-[#050505]">
              {[
                {id: 'tune', icon: SlidersHorizontal, label: 'Adjust'},
                {id: 'crop', icon: Crop, label: 'Aspect'},
                {id: 'rotate', icon: RotateCw, label: 'Orient'}
              ].map(tool => (
                  <button 
                    key={tool.id}
                    onClick={() => setActiveTool(tool.id as any)} 
                    className={`flex flex-col items-center gap-1.5 p-2 transition-all ${activeTool === tool.id ? 'text-white' : 'text-stone-600 hover:text-stone-400'}`}
                  >
                      <tool.icon size={22} strokeWidth={activeTool === tool.id ? 2 : 1.5} />
                      <span className={`text-[9px] font-bold uppercase tracking-[0.2em] transition-all ${activeTool === tool.id ? 'opacity-100' : 'opacity-50'}`}>
                        {tool.label}
                      </span>
                      {activeTool === tool.id && <div className="w-1 h-1 rounded-full bg-gold-500 mt-0.5 animate-pulse"></div>}
                  </button>
              ))}
          </div>
      </div>

    </div>
  );
};

const SlidersHorizontal = ({ size = 20, strokeWidth = 2, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="21" y1="4" x2="14" y2="4"/><line x1="10" y1="4" x2="3" y2="4"/><line x1="21" y1="12" x2="12" y2="12"/><line x1="8" y1="12" x2="3" y2="12"/><line x1="21" y1="20" x2="16" y2="20"/><line x1="12" y1="20" x2="3" y2="20"/><line x1="14" y1="2" x2="14" y2="6"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="16" y1="18" x2="16" y2="22"/>
  </svg>
);
