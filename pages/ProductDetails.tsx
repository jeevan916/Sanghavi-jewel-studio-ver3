
import React, { useState, useEffect, useRef } from 'react';
import { Product, AppConfig } from '../types';
import { ArrowLeft, Share2, MessageCircle, Info, Tag, Calendar, ChevronLeft, ChevronRight, Maximize2, Camera, Edit2, Lock, Link, Check, Plus, Upload, Eye, EyeOff, Sparkles, Eraser, Wand2, StickyNote, Loader2, CheckCircle2, XCircle, SlidersHorizontal, Download, Trash2, Cpu, Smartphone } from 'lucide-react';
import { ImageViewer } from '../components/ImageViewer';
import { ImageEditor } from '../components/ImageEditor';
import { storeService } from '../services/storeService';
import { removeWatermark, enhanceJewelryImage } from '../services/geminiService';

interface ProductDetailsProps {
  initialProduct: Product;
  productList: Product[];
  onClose: () => void;
}

export const ProductDetails: React.FC<ProductDetailsProps> = ({ initialProduct, productList, onClose }) => {
  const [product, setProduct] = useState(initialProduct);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [currentUser] = useState(storeService.getCurrentUser());
  const isAuthorized = currentUser?.role === 'admin' || currentUser?.role === 'contributor';
  
  const [isAnimating, setIsAnimating] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [showAiMenu, setShowAiMenu] = useState(false);
  const [pendingEnhancedImage, setPendingEnhancedImage] = useState<string | null>(null);
  const [compareSliderPos, setCompareSliderPos] = useState(50);
  const [isManualEditing, setIsManualEditing] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editDescValue, setEditDescValue] = useState(product.description);

  // Gesture Tracking
  const touchStart = useRef<{ x: number, y: number } | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setProduct(initialProduct);
    setGeneratedLink(null);
    setPendingEnhancedImage(null);
    setCurrentImageIndex(0);
    setIsManualEditing(false);
    setIsEditingDescription(false);
    setEditDescValue(initialProduct.description);
  }, [initialProduct]);

  useEffect(() => {
    storeService.getConfig().then(setConfig);
  }, []);

  const currentIndex = productList.findIndex(p => p.id === product.id);
  const hasNext = currentIndex < productList.length - 1;
  const hasPrev = currentIndex > 0;

  const handleUpdateProduct = (updates: Partial<Product>) => {
      const updatedProduct = { ...product, ...updates };
      setProduct(updatedProduct);
      storeService.updateProduct(updatedProduct);
  };

  const handleSaveDescription = () => {
    handleUpdateProduct({ description: editDescValue });
    setIsEditingDescription(false);
  };

  const handleDeleteProduct = async () => {
    if (window.confirm("Are you sure you want to delete this product? This action cannot be undone.")) {
        await storeService.deleteProduct(product.id);
        onClose();
    }
  };

  const handleAddImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
        const file = files[0];
        const reader = new FileReader();
        reader.onload = (ev) => {
            const base64 = ev.target?.result as string;
            const newImages = [...product.images, base64];
            handleUpdateProduct({ images: newImages });
        };
        reader.readAsDataURL(file);
    }
  };

  const handleManualSave = (newBase64: string) => {
      const updatedImages = [...product.images];
      updatedImages[currentImageIndex] = newBase64;
      handleUpdateProduct({ images: updatedImages });
      setIsManualEditing(false);
  };

  const handleAiAction = async (action: 'clean' | 'enhance') => {
      setIsProcessingImage(true);
      setShowAiMenu(false);
      try {
          const currentImg = product.images[currentImageIndex];
          const base64Data = currentImg.split(',')[1] || currentImg;
          let newBase64 = action === 'clean' ? await removeWatermark(base64Data) : await enhanceJewelryImage(base64Data);
          if (newBase64) {
              setPendingEnhancedImage(`data:image/jpeg;base64,${newBase64}`);
          }
      } catch (error) {
          alert("AI Processing Failed. Please try again.");
      } finally { setIsProcessingImage(false); }
  };

  const handleSliderMove = (clientX: number) => {
    if (imageContainerRef.current) {
        const rect = imageContainerRef.current.getBoundingClientRect();
        const x = clientX - rect.left;
        setCompareSliderPos(Math.max(0, Math.min(100, (x / rect.width) * 100)));
    }
  };

  const handleDownload = () => {
      storeService.logEvent('screenshot', product, currentUser, currentImageIndex);
      const link = document.createElement('a');
      link.href = product.images[currentImageIndex];
      link.download = `sanghavi-${product.title.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleInquiry = async () => {
      await storeService.shareToWhatsApp(product, currentImageIndex);
  };

  const goToNext = () => { if (hasNext && !isAnimating) { setIsAnimating(true); setSlideDirection('left'); setTimeout(() => { setProduct(productList[currentIndex+1]); setSlideDirection(null); setIsAnimating(false); }, 300); } };
  const goToPrev = () => { if (hasPrev && !isAnimating) { setIsAnimating(true); setSlideDirection('right'); setTimeout(() => { setProduct(productList[currentIndex-1]); setSlideDirection(null); setIsAnimating(false); }, 300); } };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    const dx = touchEnd.x - touchStart.current.x;
    const dy = touchEnd.y - touchStart.current.y;

    // Detect horizontal swipe if larger than vertical movement
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        if (pendingEnhancedImage) return; // Disable swipe during comparison

        // If swipe is on the image container, navigate images first
        const isOnImage = (e.target as HTMLElement).closest('.image-nav-container');
        if (isOnImage && product.images.length > 1) {
            if (dx > 0) { // Swipe Right
                if (currentImageIndex > 0) {
                    setCurrentImageIndex(prev => prev - 1);
                } else if (hasPrev) {
                    goToPrev();
                }
            } else { // Swipe Left
                if (currentImageIndex < product.images.length - 1) {
                    setCurrentImageIndex(prev => prev + 1);
                } else if (hasNext) {
                    goToNext();
                }
            }
        } else {
            // General page swipe for navigation between products
            if (dx > 0) goToPrev();
            else goToNext();
        }
    }
    touchStart.current = null;
  };

  return (
    <div 
        className="fixed inset-0 z-40 bg-stone-50 overflow-y-auto animate-in slide-in-from-bottom-10 duration-300 pb-20"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
    >
      {showFullScreen && <ImageViewer images={product.images} initialIndex={currentImageIndex} title={product.title} onClose={() => setShowFullScreen(false)} />}
      {isManualEditing && <ImageEditor imageSrc={product.images[currentImageIndex]} onSave={handleManualSave} onCancel={() => setIsManualEditing(false)} />}

      <div className="bg-white/80 backdrop-blur-md border-b border-stone-200 px-4 h-16 flex items-center justify-between sticky top-0 z-30">
        <button onClick={onClose} className="p-2 -ml-2 text-stone-600 hover:bg-stone-100 rounded-full"><ArrowLeft size={24} /></button>
        <div className="flex items-center gap-2 font-serif font-bold text-stone-800 text-lg truncate">{product.isHidden && <Lock size={14} className="text-red-500" />}{product.title}</div>
        <div className="flex gap-2"><button onClick={handleDownload} className="p-2 text-stone-600 hover:text-gold-600 rounded-full hover:bg-stone-100"><Download size={22} /></button><button onClick={() => navigator.share?.({ title: product.title, url: window.location.href })} className="p-2 text-stone-600 hover:text-gold-600 rounded-full hover:bg-stone-100"><Share2 size={22} /></button></div>
      </div>

      <div className={`transition-all duration-300 ease-out ${isAnimating ? (slideDirection === 'left' ? 'opacity-0 -translate-x-10' : 'opacity-0 translate-x-10') : 'opacity-100'}`}>
          <div 
            ref={imageContainerRef} 
            className="relative aspect-square md:aspect-video bg-stone-200 overflow-hidden group select-none image-nav-container" 
            onMouseMove={(e) => pendingEnhancedImage && handleSliderMove(e.clientX)}
            onTouchMove={(e) => pendingEnhancedImage && handleSliderMove(e.touches[0].clientX)}
          >
            <img 
                src={product.images[currentImageIndex]} 
                className={`w-full h-full object-cover ${isProcessingImage ? 'opacity-50 blur-sm' : ''}`} 
                onClick={() => !pendingEnhancedImage && setShowFullScreen(true)} 
            />
            
            {pendingEnhancedImage && (
                <>
                    <img src={pendingEnhancedImage} className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none" style={{ clipPath: `inset(0 ${100 - compareSliderPos}% 0 0)` }} />
                    <div className="absolute inset-y-0 w-1 bg-white z-20 cursor-col-resize shadow-lg flex items-center justify-center pointer-events-none" style={{ left: `${compareSliderPos}%` }}><div className="bg-white rounded-full p-1 shadow text-stone-900"><MoveHorizontal size={16} /></div></div>
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-4 z-30 w-full max-w-sm px-4"><button onClick={() => setPendingEnhancedImage(null)} className="flex-1 py-3 bg-stone-900/90 backdrop-blur text-white rounded-xl border border-stone-700 font-medium">Discard</button><button onClick={() => { const next = [...product.images]; next[currentImageIndex] = pendingEnhancedImage; handleUpdateProduct({ images: next }); setPendingEnhancedImage(null); }} className="flex-1 py-3 bg-gold-600/90 backdrop-blur text-white rounded-xl border border-gold-500 font-medium">Save</button></div>
                </>
            )}

            {!pendingEnhancedImage && product.images.length > 1 && (
                <>
                    {/* Navigation Arrows (Desktop Only) */}
                    <button onClick={goToPrev} className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full shadow-lg hidden md:block hover:bg-white z-20"><ChevronLeft size={24}/></button>
                    <button onClick={goToNext} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full shadow-lg hidden md:block hover:bg-white z-20"><ChevronRight size={24}/></button>
                    
                    {/* Multi-angle Navigation Dots */}
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-20">
                        {product.images.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(idx); }}
                                className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentImageIndex ? 'w-6 bg-gold-500 shadow-sm' : 'w-1.5 bg-white/60 hover:bg-white'}`}
                            />
                        ))}
                    </div>
                </>
            )}
          </div>

          {/* New Admin Control Bar below image */}
          {isAuthorized && !pendingEnhancedImage && (
              <div className="max-w-3xl mx-auto px-6 py-4 flex flex-wrap gap-3 items-center justify-center border-b border-stone-200 bg-white">
                <div className="flex gap-2">
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 bg-stone-100 text-stone-700 rounded-lg hover:bg-stone-200 transition text-xs font-bold uppercase tracking-wider">
                        <Upload size={16} /> Add Photo
                    </button>
                    <button onClick={() => cameraInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 bg-stone-100 text-stone-700 rounded-lg hover:bg-stone-200 transition text-xs font-bold uppercase tracking-wider">
                        <Camera size={16} /> Capture
                    </button>
                </div>

                <div className="h-6 w-px bg-stone-200 mx-2 hidden sm:block" />

                <div className="flex gap-2 relative">
                    <button 
                      onClick={() => setShowAiMenu(!showAiMenu)} 
                      className={`flex items-center gap-2 px-3 py-2 ${showAiMenu ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700'} rounded-lg hover:bg-purple-100 hover:text-purple-800 transition text-xs font-bold uppercase tracking-wider shadow-sm`}
                    >
                        {isProcessingImage ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} 
                        AI Studio
                    </button>

                    {showAiMenu && (
                        <div className="absolute top-12 left-0 bg-white rounded-xl shadow-2xl border border-stone-200 p-2 w-48 z-40 animate-in fade-in slide-in-from-top-2">
                            <button onClick={() => handleAiAction('clean')} className="w-full text-left px-3 py-3 text-sm hover:bg-stone-50 rounded-lg flex items-center gap-2 transition-colors">
                                <Eraser size={16} className="text-red-400" /> Remove Branding
                            </button>
                            <button onClick={() => handleAiAction('enhance')} className="w-full text-left px-3 py-3 text-sm hover:bg-stone-50 rounded-lg flex items-center gap-2 transition-colors">
                                <Wand2 size={16} className="text-gold-500" /> Studio Enhance
                            </button>
                        </div>
                    )}
                </div>

                <button 
                  onClick={() => setIsManualEditing(true)} 
                  className="flex items-center gap-2 px-3 py-2 bg-stone-800 text-white rounded-lg hover:bg-stone-900 transition text-xs font-bold uppercase tracking-wider shadow-sm"
                >
                    <SlidersHorizontal size={16} /> Edit Details
                </button>

                <input type="file" ref={fileInputRef} onChange={handleAddImage} className="hidden" accept="image/*" />
                <input type="file" ref={cameraInputRef} onChange={handleAddImage} className="hidden" accept="image/*" capture="environment" />
              </div>
          )}

          <div className="max-w-3xl mx-auto p-6 space-y-6">
             <div className="flex justify-between items-start">
                 <div>
                     <span className="text-gold-600 text-sm font-bold tracking-wider uppercase">{product.category}</span>
                     <h1 className="font-serif text-3xl text-stone-900 mt-1 mb-2">{product.title}</h1>
                     <div className="flex items-center gap-4 text-stone-500 text-sm">
                         <span className="flex items-center gap-1"><Tag size={14}/> {product.subCategory || product.category}</span>
                         <span>•</span>
                         {isAuthorized ? <div className="flex items-center gap-1"><input type="number" step="0.01" value={product.weight} onChange={(e) => handleUpdateProduct({weight: parseFloat(e.target.value)})} className="w-16 bg-transparent border-b border-stone-300 focus:border-gold-500 outline-none text-right font-medium text-stone-900 p-0" /><span>g</span></div> : <span>{product.weight}g</span>}
                     </div>
                 </div>
                 <div className="bg-stone-100 px-3 py-1 rounded text-xs font-mono text-stone-500">#{product.id.slice(-6)}</div>
             </div>

             {isAuthorized && (
                 <div className="bg-stone-800 p-4 rounded-xl text-white space-y-4">
                     <div className="flex justify-between items-center"><h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider flex items-center gap-2"><Lock size={12} /> Authorized Control</h3><button onClick={handleDeleteProduct} className="text-red-400 hover:text-red-300 text-[10px] font-bold uppercase flex items-center gap-1"><Trash2 size={12}/> Delete</button></div>
                     <div className="flex gap-2">
                         <button onClick={() => handleUpdateProduct({isHidden: !product.isHidden})} className={`flex-1 py-2 rounded text-sm font-medium flex items-center justify-center gap-2 ${product.isHidden ? 'bg-red-500/20 text-red-200' : 'bg-stone-700'}`}>{product.isHidden ? <EyeOff size={16}/> : <Eye size={16}/>} {product.isHidden ? 'Private' : 'Public'}</button>
                         <button onClick={async () => { const link = await storeService.createSharedLink(product.id, 'product'); setGeneratedLink(link); navigator.clipboard.writeText(link); }} className="flex-[2] py-2 bg-gold-600 text-white rounded text-sm font-medium flex items-center justify-center gap-2">{generatedLink ? 'Link Copied' : 'Generate Secret Link'}</button>
                     </div>
                 </div>
             )}

             <div className="flex gap-4 border-b border-stone-100 pb-6"><button onClick={handleInquiry} className="flex-1 bg-gold-600 text-white py-3.5 rounded-xl font-medium shadow-lg flex items-center justify-center gap-2 hover:bg-gold-700 transition-colors"><MessageCircle size={20} /> Inquire via WhatsApp</button></div>

             <div className="prose prose-stone">
                 <h3 className="text-sm font-bold text-stone-400 uppercase tracking-wider flex items-center justify-between gap-2 mb-2"><span className="flex items-center gap-2"><Info size={16} /> Description</span>{isAuthorized && <button onClick={() => { if(isEditingDescription) handleSaveDescription(); else setIsEditingDescription(true); }} className="p-1 hover:bg-stone-100 rounded text-gold-600 transition">{isEditingDescription ? <Check size={16} /> : <Edit2 size={16} />}</button>}</h3>
                 {isEditingDescription ? <div className="space-y-2"><textarea value={editDescValue} onChange={(e) => setEditDescValue(e.target.value)} className="w-full p-4 border border-gold-300 rounded-xl text-stone-700 min-h-[120px]" /><div className="flex justify-end gap-2"><button onClick={() => { setIsEditingDescription(false); setEditDescValue(product.description); }} className="px-4 py-1 text-xs text-stone-400 uppercase">Cancel</button><button onClick={handleSaveDescription} className="px-4 py-1 text-xs text-gold-600 border border-gold-200 rounded-lg">Apply</button></div></div> : <p className="text-stone-600 leading-relaxed text-lg font-light">{product.description}</p>}
             </div>

             <div className="bg-stone-50 rounded-xl p-4 border border-stone-100 grid grid-cols-2 gap-4 text-sm">
                 <div><span className="block text-stone-400 text-xs uppercase font-bold mb-1">Date Added</span><div className="flex items-center gap-2 text-stone-700"><Calendar size={14} /> {product.dateTaken || new Date(product.createdAt).toLocaleDateString()}</div></div>
                 <div><span className="block text-stone-400 text-xs uppercase font-bold mb-1">Supplier</span><div className="text-stone-700 font-medium">{product.supplier || 'N/A'}</div></div>
                 {isAuthorized && product.meta?.cameraModel && (<div><span className="block text-stone-400 text-xs uppercase font-bold mb-1">Device Type</span><div className="flex items-center gap-2 text-stone-700"><Smartphone size={14} /> {product.meta.cameraModel}</div></div>)}
                 {isAuthorized && product.meta?.deviceManufacturer && (<div><span className="block text-stone-400 text-xs uppercase font-bold mb-1">Manufacturer</span><div className="flex items-center gap-2 text-stone-700"><Cpu size={14} /> {product.meta.deviceManufacturer}</div></div>)}
                 <div className="col-span-2"><span className="block text-stone-400 text-xs uppercase font-bold mb-1">Tags</span><div className="flex flex-wrap gap-2">{product.tags.map(tag => <span key={tag} className="bg-white border border-stone-200 px-2 py-1 rounded text-xs text-stone-600">#{tag}</span>)}</div></div>
             </div>
          </div>
      </div>
    </div>
  );
};

// Fixed: Explicit local MoveHorizontal definition used for the compare slider icon
const MoveHorizontal = ({ size = 20 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 8 22 12 18 16"/><polyline points="6 8 2 12 6 16"/><line x1="2" y1="12" x2="22" y2="12"/></svg>);
