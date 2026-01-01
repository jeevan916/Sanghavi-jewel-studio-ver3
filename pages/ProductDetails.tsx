
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Product, AppConfig } from '../types';
import { ArrowLeft, Share2, MessageCircle, Info, Tag, Calendar, ChevronLeft, ChevronRight, Camera, Edit2, Lock, Check, Eye, EyeOff, Sparkles, Eraser, Wand2, Loader2, SlidersHorizontal, Download, Trash2, Cpu, Smartphone } from 'lucide-react';
import { ImageViewer } from '../components/ImageViewer';
import { ImageEditor } from '../components/ImageEditor';
import { storeService } from '../services/storeService';
import { removeWatermark, enhanceJewelryImage } from '../services/geminiService';

export const ProductDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [productList, setProductList] = useState<Product[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [currentUser] = useState(storeService.getCurrentUser());
  const isAuthorized = currentUser?.role === 'admin' || currentUser?.role === 'contributor';
  
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [showAiMenu, setShowAiMenu] = useState(false);
  const [pendingEnhancedImage, setPendingEnhancedImage] = useState<string | null>(null);
  const [compareSliderPos, setCompareSliderPos] = useState(50);
  const [isManualEditing, setIsManualEditing] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editDescValue, setEditDescValue] = useState('');

  const touchStart = useRef<{ x: number, y: number } | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Decisive Scroll Reset logic
  const forceScrollTop = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
    if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
  };

  // Run on mount, on ID change, AND after loading state transitions to false
  useLayoutEffect(() => {
    forceScrollTop();
    
    // Perform multiple resets in succession to catch browser re-renders
    const rafId = requestAnimationFrame(() => {
        forceScrollTop();
    });

    const timeoutId = setTimeout(forceScrollTop, 10);
    const timeoutId2 = setTimeout(forceScrollTop, 100);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
      clearTimeout(timeoutId2);
    };
  }, [id, isLoading]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const allProducts = await storeService.getProducts();
        setProductList(allProducts);
        
        const found = allProducts.find(p => p.id === id);
        if (found) {
          setProduct(found);
          setEditDescValue(found.description);
        }
        
        const conf = await storeService.getConfig();
        setConfig(conf);
      } catch (err) {
        console.error("Fetch details error:", err);
      } finally {
        setIsLoading(false);
        // Additional immediate reset after state change triggers render
        requestAnimationFrame(forceScrollTop);
      }
    };
    fetchData();
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50">
        <Loader2 className="animate-spin text-gold-600 mb-4" size={40} strokeWidth={1.5} />
        <span className="font-serif text-sm text-stone-400 uppercase tracking-widest">Opening Vault...</span>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 p-6 text-center">
        <h2 className="font-serif text-2xl text-stone-800 mb-4">Product Not Found</h2>
        <button onClick={() => navigate('/collection')} className="px-6 py-2 bg-stone-900 text-white rounded-xl">Back to Collection</button>
      </div>
    );
  }

  const productImages = Array.isArray(product.images) ? product.images : [];
  const productThumbnails = Array.isArray(product.thumbnails) ? product.thumbnails : [];
  const productTags = Array.isArray(product.tags) ? product.tags : [];

  const currentIndex = productList.findIndex(p => p.id === product.id);
  const hasNext = currentIndex < productList.length - 1;
  const hasPrev = currentIndex > 0;

  const createThumbnail = (base64: string, size = 1000): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > size) {
          height *= size / width;
          width = size;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
        }
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = base64;
    });
  };

  const handleUpdateProduct = (updates: Partial<Product>) => {
      if (!product) return;
      const updatedProduct = { ...product, ...updates };
      setProduct(updatedProduct);
      storeService.updateProduct(updatedProduct);
  };

  const handleSaveDescription = () => {
    handleUpdateProduct({ description: editDescValue });
    setIsEditingDescription(false);
  };

  const handleDeleteProduct = async () => {
    if (window.confirm("Delete this product permanently?")) {
        await storeService.deleteProduct(product.id);
        navigate('/collection');
    }
  };

  const handleManualSave = async (newBase64: string) => {
      const updatedImages = [...productImages];
      const updatedThumbs = [...productThumbnails];
      updatedImages[currentImageIndex] = newBase64;
      try {
        const thumbBase64 = await createThumbnail(newBase64);
        updatedThumbs[currentImageIndex] = thumbBase64;
      } catch (e) {
        updatedThumbs[currentImageIndex] = newBase64;
      }
      handleUpdateProduct({ images: updatedImages, thumbnails: updatedThumbs });
      setIsManualEditing(false);
  };

  const handleAiAction = async (action: 'clean' | 'enhance') => {
      if (!product || productImages.length === 0) return;
      setIsProcessingImage(true);
      setShowAiMenu(false);
      try {
          const currentImg = productImages[currentImageIndex];
          const base64Data = currentImg.includes(',') ? currentImg.split(',')[1] : currentImg;
          let newBase64 = action === 'clean' ? await removeWatermark(base64Data) : await enhanceJewelryImage(base64Data);
          if (newBase64) {
              setPendingEnhancedImage(`data:image/jpeg;base64,${newBase64}`);
          }
      } catch (error) {
          alert("AI Processing Failed.");
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
      if (!product || productImages.length === 0) return;
      storeService.logEvent('screenshot', product, currentUser, currentImageIndex);
      const link = document.createElement('a');
      link.href = getFullUrl(productImages[currentImageIndex]);
      link.download = `sanghavi-${product.title.replace(/\s+/g, '-').toLowerCase()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleInquiry = async () => {
      if (!product) return;
      await storeService.shareToWhatsApp(product, currentImageIndex);
  };

  const goToNext = () => { if (hasNext) navigate(`/product/${productList[currentIndex+1].id}`); };
  const goToPrev = () => { if (hasPrev) navigate(`/product/${productList[currentIndex-1].id}`); };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    const dx = touchEnd.x - touchStart.current.x;
    const dy = touchEnd.y - touchStart.current.y;

    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        if (pendingEnhancedImage) return; 
        const isOnImage = (e.target as HTMLElement).closest('.image-nav-container');
        if (isOnImage && productImages.length > 1) {
            if (dx > 0) {
                if (currentImageIndex > 0) setCurrentImageIndex(prev => prev - 1);
                else if (hasPrev) goToPrev();
            } else {
                if (currentImageIndex < productImages.length - 1) setCurrentImageIndex(prev => prev + 1);
                else if (hasNext) goToNext();
            }
        } else {
            if (dx > 0) goToPrev();
            else goToNext();
        }
    }
    touchStart.current = null;
  };

  const getFullUrl = (path: string) => {
      if (!path) return '';
      if (path.startsWith('data:') || path.startsWith('http')) return path;
      const origin = window.location.origin;
      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      return `${origin}${cleanPath}`;
  };

  const displayPreview = getFullUrl(productImages[currentImageIndex] || productThumbnails[currentImageIndex]);

  return (
    <div 
        key={id} // Force re-mount on ID change to ensure clean state
        ref={scrollContainerRef}
        className="min-h-screen bg-stone-50 pb-20 overflow-x-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
    >
      {showFullScreen && <ImageViewer images={productImages.map(getFullUrl)} initialIndex={currentImageIndex} title={product.title} onClose={() => setShowFullScreen(false)} />}
      {isManualEditing && <ImageEditor imageSrc={getFullUrl(productImages[currentImageIndex])} onSave={handleManualSave} onCancel={() => setIsManualEditing(false)} />}

      <div className="bg-white/80 backdrop-blur-md border-b border-stone-200 px-4 h-16 flex items-center justify-between sticky top-0 z-30">
        <button onClick={() => navigate('/collection')} className="p-2 -ml-2 text-stone-600 hover:bg-stone-100 rounded-full transition-colors"><ArrowLeft size={24} /></button>
        <div className="flex-1 flex items-center gap-2 px-2 overflow-hidden">
            {product.isHidden && <Lock size={14} className="text-red-500 shrink-0" />}
            <h2 className="font-serif font-bold text-stone-800 text-lg truncate break-words">
                {product.title}
            </h2>
        </div>
        <div className="flex gap-1 shrink-0">
            <button onClick={handleDownload} className="p-2 text-stone-600 hover:text-gold-600 rounded-full hover:bg-stone-100"><Download size={20} /></button>
            <button onClick={() => navigator.share?.({ title: product.title, url: window.location.href })} className="p-2 text-stone-600 hover:text-gold-600 rounded-full hover:bg-stone-100"><Share2 size={20} /></button>
        </div>
      </div>

      <div className="transition-all duration-300 ease-out animate-in fade-in">
          <div 
            ref={imageContainerRef} 
            className="relative aspect-square md:aspect-video bg-stone-200 overflow-hidden group select-none image-nav-container" 
            onMouseMove={(e) => pendingEnhancedImage && handleSliderMove(e.clientX)}
            onTouchMove={(e) => pendingEnhancedImage && handleSliderMove(e.touches[0].clientX)}
          >
            {displayPreview && (
              <img 
                src={displayPreview} 
                className={`w-full h-full object-cover ${isProcessingImage ? 'opacity-50 blur-sm' : ''}`} 
                style={{ imageRendering: '-webkit-optimize-contrast' }}
                onClick={() => !pendingEnhancedImage && setShowFullScreen(true)} 
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (productThumbnails[currentImageIndex] && target.src !== getFullUrl(productThumbnails[currentImageIndex])) {
                     target.src = getFullUrl(productThumbnails[currentImageIndex]);
                  }
                }}
              />
            )}
            
            {pendingEnhancedImage && (
                <>
                    <img src={pendingEnhancedImage} className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none" style={{ clipPath: `inset(0 ${100 - compareSliderPos}% 0 0)`, imageRendering: '-webkit-optimize-contrast' }} />
                    <div className="absolute inset-y-0 w-1 bg-white z-20 cursor-col-resize shadow-lg flex items-center justify-center pointer-events-none" style={{ left: `${compareSliderPos}%` }}><div className="bg-white rounded-full p-1 shadow text-stone-900"><MoveHorizontal size={16} /></div></div>
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-4 z-30 w-full max-w-sm px-4">
                        <button onClick={() => setPendingEnhancedImage(null)} className="flex-1 py-3 bg-stone-900/90 backdrop-blur text-white rounded-xl border border-stone-700 font-medium">Discard</button>
                        <button onClick={async () => { 
                            const nextImgs = [...productImages]; 
                            const nextThumbs = [...productThumbnails];
                            nextImgs[currentImageIndex] = pendingEnhancedImage; 
                            try {
                              const thumbBase64 = await createThumbnail(pendingEnhancedImage);
                              nextThumbs[currentImageIndex] = thumbBase64;
                            } catch (e) {
                              nextThumbs[currentImageIndex] = pendingEnhancedImage;
                            }
                            handleUpdateProduct({ images: nextImgs, thumbnails: nextThumbs }); 
                            setPendingEnhancedImage(null); 
                        }} className="flex-1 py-3 bg-gold-600/90 backdrop-blur text-white rounded-xl border border-gold-500 font-medium">Save</button>
                    </div>
                </>
            )}

            {!pendingEnhancedImage && productImages.length > 1 && (
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-20">
                    {productImages.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(idx); }}
                            className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentImageIndex ? 'w-6 bg-gold-500 shadow-sm' : 'w-1.5 bg-white/60'}`}
                        />
                    ))}
                </div>
            )}
          </div>

          <div className="max-w-3xl mx-auto p-6 space-y-6">
             <div className="flex flex-col md:flex-row md:justify-between items-start gap-4">
                 <div className="flex-1 min-w-0">
                     <span className="text-gold-600 text-xs font-bold tracking-wider uppercase">{product.category}</span>
                     <h1 className="font-serif text-2xl md:text-3xl text-stone-900 mt-1 mb-2 leading-tight break-words">
                        {product.title}
                     </h1>
                     <div className="flex items-center gap-4 text-stone-500 text-sm">
                         <span className="flex items-center gap-1"><Tag size={14}/> {product.subCategory || product.category}</span>
                         <span>•</span>
                         {isAuthorized ? <div className="flex items-center gap-1"><input type="number" step="0.01" value={product.weight} onChange={(e) => handleUpdateProduct({weight: parseFloat(e.target.value)})} className="w-16 bg-transparent border-b border-stone-300 focus:border-gold-500 outline-none text-right font-medium text-stone-900 p-0" /><span>g</span></div> : <span>{product.weight}g</span>}
                     </div>
                 </div>
                 <div className="bg-stone-100 px-3 py-1 rounded text-[10px] font-mono text-stone-500 uppercase shrink-0">ID: {product.id.slice(-6)}</div>
             </div>

             {isAuthorized && (
                 <div className="bg-stone-800 p-4 rounded-xl text-white space-y-4">
                     <div className="flex justify-between items-center"><h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider flex items-center gap-2"><Lock size={12} /> Authorized Control</h3><button onClick={handleDeleteProduct} className="text-red-400 hover:text-red-300 text-[10px] font-bold uppercase flex items-center gap-1"><Trash2 size={12}/> Delete</button></div>
                     <div className="flex gap-2 relative">
                        <button onClick={() => handleUpdateProduct({isHidden: !product.isHidden})} className={`flex-1 py-2 rounded text-sm font-medium flex items-center justify-center gap-2 ${product.isHidden ? 'bg-red-500/20 text-red-200' : 'bg-stone-700'}`}>{product.isHidden ? <EyeOff size={16}/> : <Eye size={16}/>} {product.isHidden ? 'Private' : 'Public'}</button>
                        <button onClick={async () => { const link = await storeService.createSharedLink(product.id, 'product'); setGeneratedLink(link); navigator.clipboard.writeText(link); }} className="flex-[2] py-2 bg-gold-600 text-white rounded font-medium flex items-center justify-center gap-2">{generatedLink ? 'Link Copied' : 'Generate Secret Link'}</button>
                     </div>

                     <div className="flex gap-2">
                        <button onClick={() => setShowAiMenu(!showAiMenu)} className={`flex-1 py-2 rounded text-sm font-medium flex items-center justify-center gap-2 ${showAiMenu ? 'bg-purple-600' : 'bg-purple-900/30'}`}>
                            {isProcessingImage ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16}/>} AI Studio
                        </button>
                        <button onClick={() => setIsManualEditing(true)} className="flex-1 py-2 bg-stone-700 rounded text-sm font-medium flex items-center justify-center gap-2"><SlidersHorizontal size={16}/> Edit Image</button>
                     </div>

                     {showAiMenu && (
                        <div className="bg-stone-900 rounded-lg p-1 border border-stone-700 grid grid-cols-2 gap-1">
                             <button onClick={() => handleAiAction('clean')} className="px-3 py-2 text-xs hover:bg-stone-800 rounded flex items-center gap-2"><Eraser size={14}/> Clear Branding</button>
                             <button onClick={() => handleAiAction('enhance')} className="px-3 py-2 text-xs hover:bg-stone-800 rounded flex items-center gap-2"><Wand2 size={14}/> Studio Enhance</button>
                        </div>
                     )}
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
                 <div className="col-span-2"><span className="block text-stone-400 text-xs uppercase font-bold mb-1">Tags</span><div className="flex flex-wrap gap-2">{productTags.map(tag => <span key={tag} className="bg-white border border-stone-200 px-2 py-1 rounded text-xs text-stone-600">#{tag}</span>)}</div></div>
             </div>
          </div>
      </div>
    </div>
  );
};

const MoveHorizontal = ({ size = 20 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 8 22 12 18 16"/><polyline points="6 8 2 12 6 16"/><line x1="2" y1="12" x2="22" y2="12"/></svg>);
