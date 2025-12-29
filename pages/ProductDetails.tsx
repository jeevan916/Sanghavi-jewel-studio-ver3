
import React, { useState, useEffect, useRef } from 'react';
import { Product, AppConfig } from '../types';
import { ArrowLeft, Share2, MessageCircle, Info, Tag, Calendar, ChevronLeft, ChevronRight, Maximize2, Camera, Edit2, Lock, Link, Check, Plus, Upload, Eye, EyeOff, Sparkles, Eraser, Wand2, StickyNote, Loader2, MoveHorizontal, CheckCircle2, XCircle, SlidersHorizontal, Download } from 'lucide-react';
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
  
  // UI States
  const [isAnimating, setIsAnimating] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  
  // AI Processing State
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [showAiMenu, setShowAiMenu] = useState(false);
  const [pendingEnhancedImage, setPendingEnhancedImage] = useState<string | null>(null);
  const [compareSliderPos, setCompareSliderPos] = useState(50);
  
  // Manual Edit State
  const [isManualEditing, setIsManualEditing] = useState(false);

  const imageContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setProduct(initialProduct);
    setGeneratedLink(null);
    setPendingEnhancedImage(null);
    setCurrentImageIndex(0); // Reset image index on product change
    setIsManualEditing(false);
  }, [initialProduct]);

  useEffect(() => {
    // Fetch config for supplier list
    storeService.getConfig().then(setConfig);
  }, []);

  const currentIndex = productList.findIndex(p => p.id === product.id);
  const hasNext = currentIndex < productList.length - 1;
  const hasPrev = currentIndex > 0;

  const vibrate = () => {
    if (navigator.vibrate) navigator.vibrate(20);
  };

  // --- Actions ---

  const handleUpdateProduct = (updates: Partial<Product>) => {
      const updatedProduct = { ...product, ...updates };
      setProduct(updatedProduct);
      storeService.updateProduct(updatedProduct); // Fire and forget async
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
          // Ensure we have base64 pure data
          const base64Data = currentImg.split(',')[1] || currentImg;
          
          let newBase64 = '';
          if (action === 'clean') {
              newBase64 = await removeWatermark(base64Data);
          } else {
              newBase64 = await enhanceJewelryImage(base64Data);
          }

          if (newBase64) {
              const fullUrl = `data:image/jpeg;base64,${newBase64}`;
              setPendingEnhancedImage(fullUrl); // Store pending state for comparison
          }
      } catch (error) {
          console.error("AI Action Failed", error);
          alert("AI Processing Failed. Please try again.");
      } finally {
          setIsProcessingImage(false);
      }
  };

  const handleSliderMove = (clientX: number) => {
    if (imageContainerRef.current) {
        const rect = imageContainerRef.current.getBoundingClientRect();
        const x = clientX - rect.left;
        const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
        setCompareSliderPos(percentage);
    }
  };

  const generateSecretLink = async () => {
      const link = await storeService.createSharedLink(product.id, 'product');
      setGeneratedLink(link);
      navigator.clipboard.writeText(link);
  };

  const handleDownload = () => {
      // 1. Log Event
      storeService.logEvent('screenshot', product, currentUser, currentImageIndex);
      
      // 2. Trigger Download
      const link = document.createElement('a');
      link.href = product.images[currentImageIndex];
      link.download = `sanghavi-${product.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  // --- Navigation Logic ---
  const goToNext = () => {
    if (hasNext && !isAnimating) {
        vibrate();
        setSlideDirection('left');
        setIsAnimating(true);
        setTimeout(() => {
            setProduct(productList[currentIndex + 1]);
            setGeneratedLink(null);
            setPendingEnhancedImage(null);
            setIsAnimating(false);
            setSlideDirection(null);
        }, 300);
    }
  };

  const goToPrev = () => {
    if (hasPrev && !isAnimating) {
        vibrate();
        setSlideDirection('right');
        setIsAnimating(true);
        setTimeout(() => {
            setProduct(productList[currentIndex - 1]);
            setGeneratedLink(null);
            setPendingEnhancedImage(null);
            setIsAnimating(false);
            setSlideDirection(null);
        }, 300);
    }
  };

  // --- Product Swipe Logic (Global) ---
  const touchStart = useRef<number | null>(null);
  const touchEnd = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    if (pendingEnhancedImage || isManualEditing) return; // Disable swipe nav when editing
    touchEnd.current = null;
    touchStart.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (pendingEnhancedImage || isManualEditing) return;
    touchEnd.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
    if (pendingEnhancedImage || isManualEditing) return;
    if (!touchStart.current || !touchEnd.current) return;
    const distance = touchStart.current - touchEnd.current;
    if (distance > 50) goToNext();
    if (distance < -50) goToPrev();
  };

  // --- Image Swipe Logic (Carousel) ---
  const imgTouchStart = useRef<number | null>(null);
  const imgTouchEnd = useRef<number | null>(null);

  const onImageTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation(); // Stop bubbling to product navigation
    if (pendingEnhancedImage || isManualEditing) return;
    imgTouchStart.current = e.touches[0].clientX;
    imgTouchEnd.current = null;
  };

  const onImageTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation(); // Stop bubbling
    if (pendingEnhancedImage) {
        handleSliderMove(e.touches[0].clientX);
        return;
    }
    if (isManualEditing) return;
    imgTouchEnd.current = e.touches[0].clientX;
  };

  const onImageTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation(); // Stop bubbling
    if (pendingEnhancedImage || isManualEditing) return;

    if (!imgTouchStart.current || !imgTouchEnd.current) return;
    const distance = imgTouchStart.current - imgTouchEnd.current;
    
    // Swipe Threshold
    if (Math.abs(distance) > 50) {
        if (distance > 0) {
            // Swipe Left -> Next Image
            if (currentImageIndex < product.images.length - 1) {
                setCurrentImageIndex(prev => prev + 1);
            }
        } else {
            // Swipe Right -> Prev Image
            if (currentImageIndex > 0) {
                 setCurrentImageIndex(prev => prev - 1);
            }
        }
    }
    imgTouchStart.current = null;
    imgTouchEnd.current = null;
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.title,
          text: product.description,
          url: window.location.href,
        });
      } catch (error) { console.log('Error sharing', error); }
    }
  };

  const handleInquiry = () => {
    // 1. Log Event
    storeService.logEvent('inquiry', product, currentUser);

    const phone = config?.whatsappNumber ? config.whatsappNumber.replace(/\D/g, '') : '';
    const msg = `Hi, I am interested in ${product.title} (ID: ${product.id}).`;
    const url = phone 
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` 
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  let animationClass = "opacity-100 translate-x-0";
  if (isAnimating) {
    if (slideDirection === 'left') animationClass = "opacity-0 -translate-x-10";
    if (slideDirection === 'right') animationClass = "opacity-0 translate-x-10";
  }

  return (
    <div 
        className="fixed inset-0 z-40 bg-stone-50 overflow-y-auto animate-in slide-in-from-bottom-10 duration-300"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
    >
      {showFullScreen && (
          <ImageViewer 
            images={product.images} 
            initialIndex={currentImageIndex} 
            title={product.title}
            onClose={() => setShowFullScreen(false)} 
          />
      )}

      {/* Manual Studio Editor Overlay */}
      {isManualEditing && (
          <ImageEditor 
              imageSrc={product.images[currentImageIndex]}
              onSave={handleManualSave}
              onCancel={() => setIsManualEditing(false)}
          />
      )}

      {/* --- Header --- */}
      <div className="relative z-20 bg-white/80 backdrop-blur-md border-b border-stone-200 px-4 h-16 flex items-center justify-between">
        <button onClick={onClose} className="p-2 -ml-2 text-stone-600 hover:text-stone-900 rounded-full hover:bg-stone-100">
            <ArrowLeft size={24} />
        </button>
        <div className="flex items-center gap-2 max-w-[60%]">
             {product.isHidden && <Lock size={14} className="text-red-500" />}
             <span className="font-serif font-bold text-stone-800 text-lg truncate">{product.title}</span>
        </div>
        <div className="flex gap-2 -mr-2">
            <button onClick={handleDownload} className="p-2 text-stone-600 hover:text-gold-600 rounded-full hover:bg-stone-100" title="Save / Screenshot">
                <Download size={22} />
            </button>
            <button onClick={handleShare} className="p-2 text-stone-600 hover:text-gold-600 rounded-full hover:bg-stone-100">
                <Share2 size={22} />
            </button>
        </div>
      </div>

      <div className={`transition-all duration-300 ease-out ${animationClass}`}>
          {/* --- Main Image --- */}
          <div 
            ref={imageContainerRef}
            className="relative aspect-square md:aspect-video bg-stone-200 overflow-hidden group select-none"
            onMouseMove={(e) => pendingEnhancedImage && handleSliderMove(e.clientX)}
            onTouchStart={onImageTouchStart}
            onTouchMove={onImageTouchMove}
            onTouchEnd={onImageTouchEnd}
          >
            {/* Base Image (Original) */}
            <img 
                src={product.images[currentImageIndex]} 
                alt={product.title}
                className={`w-full h-full object-cover ${isProcessingImage ? 'opacity-50 blur-sm' : ''}`}
                onClick={() => !pendingEnhancedImage && setShowFullScreen(true)}
            />
            
            {/* Comparison Overlay (Enhanced) */}
            {pendingEnhancedImage && (
                <>
                    <img 
                        src={pendingEnhancedImage} 
                        className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none"
                        style={{ clipPath: `inset(0 ${100 - compareSliderPos}% 0 0)` }}
                    />
                    
                    {/* Slider Handle */}
                    <div 
                        className="absolute inset-y-0 w-1 bg-white z-20 cursor-col-resize shadow-lg flex items-center justify-center pointer-events-none"
                        style={{ left: `${compareSliderPos}%` }}
                    >
                        <div className="bg-white rounded-full p-1 shadow text-stone-900">
                            <MoveHorizontal size={16} />
                        </div>
                    </div>
                    
                    {/* Labels */}
                    <div className="absolute top-4 left-4 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur z-20 pointer-events-none">✨ Enhanced</div>
                    <div className="absolute top-4 right-4 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur z-20 pointer-events-none">Original</div>

                    {/* Confirmation Buttons */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-4 z-30 w-full max-w-sm px-4 justify-center pointer-events-auto">
                        <button 
                            onClick={() => { setPendingEnhancedImage(null); setCompareSliderPos(50); }}
                            className="flex-1 py-3 bg-stone-900/90 backdrop-blur text-white rounded-xl shadow-xl flex items-center justify-center gap-2 hover:bg-black font-medium border border-stone-700"
                        >
                            <XCircle size={18}/> Discard
                        </button>
                        <button 
                            onClick={() => {
                                const updatedImages = [...product.images];
                                updatedImages[currentImageIndex] = pendingEnhancedImage;
                                handleUpdateProduct({ images: updatedImages });
                                setPendingEnhancedImage(null);
                                setCompareSliderPos(50);
                            }}
                            className="flex-1 py-3 bg-gold-600/90 backdrop-blur text-white rounded-xl shadow-xl flex items-center justify-center gap-2 hover:bg-gold-700 font-medium border border-gold-500"
                        >
                            <CheckCircle2 size={18}/> Save & Use
                        </button>
                    </div>
                </>
            )}
            
            {/* Loading Overlay */}
            {isProcessingImage && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-20 pointer-events-none">
                    <Loader2 className="animate-spin mb-2" size={32} />
                    <span className="text-sm font-medium text-center px-4 bg-black/40 rounded-full backdrop-blur py-1">AI Studio Enhancing...</span>
                </div>
            )}

            {/* Image Dots & Nav */}
            {!pendingEnhancedImage && (
                <>
                    {product.images.length > 1 && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 p-2 bg-black/20 rounded-full backdrop-blur z-10 pointer-events-none">
                            {product.images.map((_, idx) => (
                                <button 
                                    key={idx}
                                    onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(idx); }}
                                    className={`w-2 h-2 rounded-full transition-all pointer-events-auto ${idx === currentImageIndex ? 'bg-white scale-125' : 'bg-white/50'}`}
                                />
                            ))}
                        </div>
                    )}

                    <button onClick={() => setShowFullScreen(true)} className="absolute top-4 right-4 p-2 bg-white/20 backdrop-blur rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <Maximize2 size={20} />
                    </button>
                    
                    {hasPrev && <button onClick={(e) => { e.stopPropagation(); goToPrev(); }} className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full shadow-lg hidden md:block hover:bg-white z-10"><ChevronLeft size={24} className="text-stone-800"/></button>}
                    {hasNext && <button onClick={(e) => { e.stopPropagation(); goToNext(); }} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full shadow-lg hidden md:block hover:bg-white z-10"><ChevronRight size={24} className="text-stone-800"/></button>}
                </>
            )}

            {/* Authorized Image Controls */}
            {isAuthorized && !pendingEnhancedImage && (
                <>
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute top-4 left-4 p-2 bg-gold-600 text-white rounded-full shadow-lg hover:bg-gold-700 z-10"
                    >
                        <Camera size={20} />
                    </button>
                    
                    {/* AI Tools Toggle */}
                    <div className="absolute top-4 left-16 flex gap-2 z-10">
                        <button 
                            onClick={() => setShowAiMenu(!showAiMenu)}
                            className="p-2 bg-purple-600 text-white rounded-full shadow-lg hover:bg-purple-700 flex items-center justify-center"
                        >
                            <Sparkles size={20} />
                        </button>

                        <button 
                            onClick={() => setIsManualEditing(true)}
                            className="p-2 bg-stone-800 text-white rounded-full shadow-lg hover:bg-stone-900 flex items-center justify-center"
                        >
                            <SlidersHorizontal size={20} />
                        </button>
                        
                        {/* AI Menu Dropdown */}
                        {showAiMenu && (
                            <div className="absolute top-12 left-0 bg-white rounded-xl shadow-xl border border-stone-100 p-2 w-52 animate-in slide-in-from-top-2">
                                <button 
                                    onClick={() => handleAiAction('clean')}
                                    className="w-full text-left px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 rounded-lg flex items-center gap-2"
                                >
                                    <Eraser size={16} className="text-red-400" />
                                    <span>Remove Branding</span>
                                </button>
                                <button 
                                    onClick={() => handleAiAction('enhance')}
                                    className="w-full text-left px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 rounded-lg flex items-center gap-2"
                                >
                                    <Wand2 size={16} className="text-gold-500" />
                                    <span>AI Studio Enhancement</span>
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
            <input type="file" ref={fileInputRef} onChange={handleAddImage} className="hidden" accept="image/*" />
          </div>

          {/* --- Product Info --- */}
          <div className="max-w-3xl mx-auto p-6 space-y-6">
             <div className="flex justify-between items-start">
                 <div>
                     <span className="text-gold-600 text-sm font-bold tracking-wider uppercase">{product.category}</span>
                     <h1 className="font-serif text-3xl text-stone-900 mt-1 mb-2">{product.title}</h1>
                     <div className="flex items-center gap-4 text-stone-500 text-sm">
                         <span className="flex items-center gap-1"><Tag size={14}/> {product.subCategory || product.category}</span>
                         <span>•</span>
                         {/* Editable Weight for Authorized Users */}
                         {isAuthorized ? (
                             <div className="flex items-center gap-1">
                                 <input 
                                     type="number" 
                                     step="0.01"
                                     value={product.weight}
                                     onChange={(e) => handleUpdateProduct({weight: parseFloat(e.target.value)})}
                                     className="w-16 bg-transparent border-b border-stone-300 focus:border-gold-500 outline-none text-right font-medium text-stone-900 p-0"
                                 />
                                 <span>g</span>
                                 <Edit2 size={10} className="text-stone-300 mb-2"/>
                             </div>
                         ) : (
                             <span>{product.weight} grams</span>
                         )}
                     </div>
                 </div>
                 <div className="bg-stone-100 px-3 py-1 rounded text-xs font-mono text-stone-500">#{product.id.slice(-6)}</div>
             </div>

             {/* ADMIN CONTROLS */}
             {isAuthorized && (
                 <div className="bg-stone-800 p-4 rounded-xl text-white space-y-4">
                     <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider flex items-center gap-2">
                         <Lock size={12} /> Authorized Controls
                     </h3>
                     
                     {/* Supplier Dropdown */}
                     <div className="flex flex-col gap-1">
                         <label className="text-xs text-stone-400">Supplier</label>
                         <select 
                            value={product.supplier || ''}
                            onChange={(e) => handleUpdateProduct({supplier: e.target.value})}
                            className="bg-stone-700 border-none rounded p-2 text-sm text-white focus:ring-1 focus:ring-gold-500"
                         >
                             <option value="">Select Supplier</option>
                             {config?.suppliers.map(s => <option key={s.id} value={s.name}>{s.name} {s.isPrivate ? '(Private)' : ''}</option>)}
                         </select>
                     </div>

                     {/* Privacy & Link Gen */}
                     <div className="flex gap-2">
                         <button 
                            onClick={() => handleUpdateProduct({isHidden: !product.isHidden})}
                            className={`flex-1 py-2 rounded text-sm font-medium flex items-center justify-center gap-2 ${product.isHidden ? 'bg-red-500/20 text-red-200' : 'bg-stone-700'}`}
                         >
                             {product.isHidden ? <EyeOff size={16}/> : <Eye size={16}/>}
                             {product.isHidden ? 'Private' : 'Public'}
                         </button>
                         
                         <button 
                            onClick={generateSecretLink}
                            className="flex-[2] py-2 bg-gold-600 text-white rounded text-sm font-medium flex items-center justify-center gap-2 hover:bg-gold-700"
                         >
                             <Link size={16}/> {generatedLink ? 'Link Copied!' : 'Generate Secret Link'}
                         </button>
                     </div>
                     {generatedLink && (
                         <div className="text-[10px] text-stone-400 break-all bg-black/20 p-2 rounded">
                             {generatedLink}
                             <div className="mt-1 text-gold-400">Valid for {config?.linkExpiryHours || 24} hours.</div>
                         </div>
                     )}

                     {/* Private Notes */}
                     <div className="border-t border-stone-700 pt-3 mt-2">
                        <label className="text-xs text-stone-400 mb-1 flex items-center gap-2"><StickyNote size={12}/> Hidden Notes (Internal Only)</label>
                        <textarea 
                            value={product.privateNotes || ''}
                            onChange={(e) => handleUpdateProduct({privateNotes: e.target.value})}
                            placeholder="Add private details, cost price, or specific customer requests..."
                            className="w-full bg-stone-700 border-none rounded p-2 text-sm text-white focus:ring-1 focus:ring-gold-500 h-20 resize-none"
                        />
                     </div>
                 </div>
             )}

             {/* Action Bar */}
             <div className="flex gap-4 border-b border-stone-100 pb-6">
                 <button onClick={handleInquiry} className="flex-1 bg-gold-600 text-white py-3.5 rounded-xl font-medium shadow-lg hover:bg-gold-700 transition flex items-center justify-center gap-2">
                     <MessageCircle size={20} /> Inquire via WhatsApp
                 </button>
             </div>

             {/* Description & Meta */}
             <div className="prose prose-stone">
                 <h3 className="text-sm font-bold text-stone-400 uppercase tracking-wider flex items-center gap-2 mb-2"><Info size={16} /> Description</h3>
                 <p className="text-stone-600 leading-relaxed text-lg font-light">{product.description}</p>
             </div>

             <div className="bg-stone-50 rounded-xl p-4 border border-stone-100 grid grid-cols-2 gap-4 text-sm">
                 <div>
                     <span className="block text-stone-400 text-xs uppercase font-bold mb-1">Date Added</span>
                     <div className="flex items-center gap-2 text-stone-700"><Calendar size={14} /> {product.dateTaken || new Date(product.createdAt).toLocaleDateString()}</div>
                 </div>
                 <div>
                     <span className="block text-stone-400 text-xs uppercase font-bold mb-1">Supplier</span>
                     <div className="text-stone-700 font-medium">{product.supplier || 'N/A'}</div>
                 </div>
                 {/* Visible Camera Meta for All */}
                 {product.meta?.cameraModel && (
                     <div>
                         <span className="block text-stone-400 text-xs uppercase font-bold mb-1">Device / Camera</span>
                         <div className="flex items-center gap-2 text-stone-700"><Camera size={14} /> {product.meta.cameraModel}</div>
                     </div>
                 )}
                 <div className="col-span-2">
                     <span className="block text-stone-400 text-xs uppercase font-bold mb-1">Tags</span>
                     <div className="flex flex-wrap gap-2">
                         {product.tags.map(tag => <span key={tag} className="bg-white border border-stone-200 px-2 py-1 rounded text-xs text-stone-600">#{tag}</span>)}
                     </div>
                 </div>
             </div>
          </div>
      </div>
    </div>
  );
};
