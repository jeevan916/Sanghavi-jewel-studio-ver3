
import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Product, ProductStats, PromptTemplate, AppConfig } from '../types';
import { ArrowLeft, Share2, MessageCircle, Info, Tag, Heart, ShoppingBag, Gem, BarChart2, Loader2, Lock, Edit2, Save, Link as LinkIcon, Wand2, Eraser, ChevronLeft, ChevronRight, Calendar, Camera, User, Package, MapPin, Hash, Sparkles } from 'lucide-react';
import { ImageViewer } from '../components/ImageViewer';
import { ComparisonSlider } from '../components/ComparisonSlider';
import { storeService } from '../services/storeService';
import { enhanceJewelryImage, removeWatermark } from '../services/geminiService';
import { useUpload } from '../contexts/UploadContext';

export const ProductDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { processImage } = useUpload();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [stats, setStats] = useState<ProductStats>({ like: 0, dislike: 0, inquiry: 0, purchase: 0 });
  
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Product>>({});
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [aiComparison, setAiComparison] = useState<{original: string, enhanced: string} | null>(null);
  const [showTemplateSelector, setShowTemplateSelector] = useState<{mode: 'enhance' | 'cleanup', templates: PromptTemplate[]} | null>(null);

  const [neighbors, setNeighbors] = useState<{prev: string | null, next: string | null}>({ prev: null, next: null });

  const user = storeService.getCurrentUser();
  const isAdmin = user?.role === 'admin' || user?.role === 'contributor';
  const isGuest = !user;

  // Touch handling refs
  const touchStart = useRef(0);
  const touchEnd = useRef(0);
  
  // Animation Direction Logic
  const direction = (location.state as any)?.direction || 'fade';
  const animationClass = direction === 'next' ? 'animate-slide-in-right' 
                       : direction === 'prev' ? 'animate-slide-in-left' 
                       : 'animate-fade-in';

  // Ensure scroll resets immediately when ID changes
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    
    // Reset interaction states on navigation to prevent data crossover
    setAiComparison(null);
    setIsProcessingAI(false);
    setIsEditing(false);
    setShowTemplateSelector(null);

    const fetchData = async () => {
      // Check cache first to avoid loader flicker
      const cached = storeService.getCached();
      const cachedProduct = cached.products?.find(p => p.id === id);
      
      if (cached.config) setConfig(cached.config);
      
      if (cachedProduct) {
         setProduct(cachedProduct);
         setIsLoading(false);
      } else {
         setIsLoading(true);
      }

      try {
        const [fetchedProduct, fetchedConfig] = await Promise.all([
             storeService.getProductById(id),
             storeService.getConfig()
        ]);
        
        setConfig(fetchedConfig);

        if (fetchedProduct) {
            const safeProduct = {
                ...fetchedProduct,
                images: Array.isArray(fetchedProduct.images) ? fetchedProduct.images : [],
                thumbnails: Array.isArray(fetchedProduct.thumbnails) ? fetchedProduct.thumbnails : [],
                tags: Array.isArray(fetchedProduct.tags) ? fetchedProduct.tags : []
            };
            setProduct(safeProduct);
            setEditForm(safeProduct);
            setIsLiked(storeService.getLikes().includes(safeProduct.id));
            const pStats = await storeService.getProductStats(safeProduct.id);
            setStats(pStats);
            storeService.logEvent('view', safeProduct);

            // Fetch neighbors for navigation
            const listData = await storeService.getProducts(1, 1000, { publicOnly: true }); // Always fetch public for nav
            const items = listData.items;
            const idx = items.findIndex(p => p.id === fetchedProduct.id);
            if (idx !== -1) {
                setNeighbors({
                    prev: idx > 0 ? items[idx - 1].id : null,
                    next: idx < items.length - 1 ? items[idx + 1].id : null
                });
            }
        }
      } catch (e) {
        console.error("Fetch error", e);
      } finally { setIsLoading(false); }
    };
    fetchData();
  }, [id, isGuest]);

  const handleSave = async () => {
    if (!product || !editForm) return;
    setIsLoading(true);
    try {
        const updated = { ...product, ...editForm };
        await storeService.updateProduct(updated);
        setProduct(updated);
        setIsEditing(false);
    } catch (e) {
        alert("Failed to save changes");
    } finally {
        setIsLoading(false);
    }
  };

  const urlToBase64 = async (url: string): Promise<string> => {
      try {
        if (url.startsWith('data:')) return url;
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });
      } catch (e) {
          console.error("Image conversion failed", e);
          return "";
      }
  };

  const initiateAI = (mode: 'enhance' | 'cleanup') => {
      if (!config) return;
      const templates = mode === 'enhance' 
        ? (config.aiConfig.templates?.enhancement || []) 
        : (config.aiConfig.templates?.watermark || []);
      
      if (templates.length > 0) {
          setShowTemplateSelector({ mode, templates });
      } else {
          // No templates, just run default
          runAIProcess(mode);
      }
  };

  const runAIProcess = async (mode: 'enhance' | 'cleanup', promptOverride?: string) => {
      if (!product) return;
      setShowTemplateSelector(null);
      setIsProcessingAI(true);
      
      try {
          const imgUrl = product.images[0];
          const base64Input = await urlToBase64(imgUrl);
          if (!base64Input) throw new Error("Could not load source image for processing");

          const rawBase64 = mode === 'enhance' 
            ? await enhanceJewelryImage(base64Input, promptOverride) 
            : await removeWatermark(base64Input, promptOverride);
          
          const enhancedDataUri = `data:image/jpeg;base64,${rawBase64}`;
          setAiComparison({ original: imgUrl, enhanced: enhancedDataUri });
      } catch (e: any) {
          console.error(e);
          alert(`Processing Failed: ${e.message}`);
      } finally {
          setIsProcessingAI(false);
      }
  };

  const handleApplyAI = async () => {
     // Safety check: ensure we are modifying the currently viewed product
     if (!product || !aiComparison || product.id !== id) return;
     
     setIsLoading(true);
     try {
        const optimizedUrl = await processImage(aiComparison.enhanced, { width: 1600, quality: 0.9, format: 'image/webp' });
        const updated = { ...product, images: [optimizedUrl, ...product.images] };
        await storeService.updateProduct(updated);
        
        // Only update state if we are still on the same product
        if (id === updated.id) {
            setProduct(updated);
            setAiComparison(null);
        }
     } catch (e) {
        alert("Failed to save enhanced image to vault.");
     } finally {
        setIsLoading(false);
     }
  };

  const handlePrivateLink = async () => {
      if (!product) return;
      try {
          const url = await storeService.createSharedLink(product.id, 'product');
          await navigator.clipboard.writeText(url);
          alert("Secure Private Link copied to clipboard!");
      } catch (e) { alert("Link generation failed"); }
  };

  // --- SWIPE HANDLERS ---
  const handleTouchStart = (e: React.TouchEvent) => {
      touchStart.current = e.targetTouches[0].clientX;
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
      touchEnd.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
      if (!touchStart.current || !touchEnd.current) return;
      
      const distance = touchStart.current - touchEnd.current;
      const isSwipeLeft = distance > 50;  // Swiping Left -> Go Next (User moves finger left)
      const isSwipeRight = distance < -50; // Swiping Right -> Go Prev

      if (isSwipeLeft && neighbors.next) {
          navigate(`/product/${neighbors.next}`, { state: { direction: 'next' } });
      }
      
      if (isSwipeRight && neighbors.prev) {
          navigate(`/product/${neighbors.prev}`, { state: { direction: 'prev' } });
      }

      // Reset
      touchStart.current = 0;
      touchEnd.current = 0;
  };

  if (isLoading && !product) return <div className="h-screen flex items-center justify-center bg-stone-50"><Loader2 className="animate-spin text-gold-600" size={40} /></div>;
  if (!product) return <div className="h-screen flex flex-col items-center justify-center bg-stone-50 p-6 text-center"><p className="text-stone-500 mb-4">Product not found.</p><button onClick={() => navigate('/collection')} className="text-gold-600 font-bold">Return to Gallery</button></div>;

  const images = product.images;
  const displayImages = isGuest ? images.slice(0, 1) : images;

  const toggleLike = () => {
      if (navigator.vibrate) navigator.vibrate(10);
      const liked = storeService.toggleLike(product.id);
      setIsLiked(liked);
      setStats(prev => ({...prev, like: liked ? prev.like + 1 : Math.max(0, prev.like - 1)}));
  };

  return (
    <div 
        key={product.id} 
        className={`min-h-screen bg-stone-50 pb-20 ${animationClass}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ overscrollBehaviorX: 'none' }}
    >
      <div className="bg-white/80 backdrop-blur-md border-b border-stone-200 px-4 h-16 flex items-center justify-between sticky top-0 z-30 transition-transform duration-300">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-stone-600 hover:bg-stone-100 rounded-full transition-colors"><ArrowLeft size={24} /></button>
        <h2 className="font-serif font-bold text-stone-800 text-lg truncate flex-1 px-4 text-center">{product.title}</h2>
        <button onClick={() => navigator.share?.({ title: product.title, url: window.location.href })} className="p-2 text-stone-600 hover:bg-stone-100 rounded-full transition-colors"><Share2 size={20} /></button>
      </div>

      <div className="relative aspect-square md:aspect-video bg-white overflow-hidden select-none group border-b border-stone-100">
        {aiComparison ? (
            <ComparisonSlider 
                before={aiComparison.original} 
                after={aiComparison.enhanced} 
                onAccept={handleApplyAI} 
                onDiscard={() => setAiComparison(null)} 
            />
        ) : (
            <>
                {displayImages.length > 0 ? (
                    <img 
                        src={displayImages[0]} 
                        className="w-full h-full object-contain cursor-zoom-in active:scale-105 transition-transform duration-500 bg-stone-50" 
                        onClick={() => setShowFullScreen(true)} 
                        alt={product.title} 
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-400 italic">No image available</div>
                )}
                
                <div className="hidden md:flex absolute inset-x-0 top-1/2 -translate-y-1/2 justify-between px-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    {neighbors.prev && (
                        <button 
                            onClick={() => navigate(`/product/${neighbors.prev}`, { state: { direction: 'prev' } })} 
                            className="p-3 bg-black/30 text-white rounded-full hover:bg-black/50 pointer-events-auto backdrop-blur transition-all active:scale-95"
                        >
                            <ChevronLeft size={24}/>
                        </button>
                    )}
                    {neighbors.next && (
                        <button 
                            onClick={() => navigate(`/product/${neighbors.next}`, { state: { direction: 'next' } })} 
                            className="p-3 bg-black/30 text-white rounded-full hover:bg-black/50 pointer-events-auto backdrop-blur transition-all active:scale-95"
                        >
                            <ChevronRight size={24}/>
                        </button>
                    )}
                </div>

                {isGuest && images.length > 1 && (
                    <div className="absolute bottom-4 right-4 bg-black/70 backdrop-blur text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer hover:bg-black/80 transition" onClick={() => navigate('/login')}>
                        <Lock size={12} /> +{images.length - 1} Private Views Locked
                    </div>
                )}
                <button onClick={toggleLike} className={`absolute top-4 right-4 p-3 rounded-full shadow-sm transition-transform active:scale-90 ${isLiked ? 'bg-red-500 text-white' : 'bg-white/70 text-stone-400'}`}>
                        <Heart size={20} fill={isLiked ? "currentColor" : "none"} />
                </button>

                {isAdmin && (
                    <div className="absolute bottom-4 left-4 flex gap-2">
                        <button onClick={handlePrivateLink} className="p-2 bg-white/90 backdrop-blur rounded-lg shadow text-stone-700 hover:text-gold-600" title="Copy Private Link"><LinkIcon size={18}/></button>
                        <button onClick={() => setIsEditing(!isEditing)} className={`p-2 bg-white/90 backdrop-blur rounded-lg shadow text-stone-700 hover:text-gold-600 ${isEditing ? 'text-gold-600 ring-2 ring-gold-500' : ''}`} title="Edit Details"><Edit2 size={18}/></button>
                    </div>
                )}
            </>
        )}

        {isProcessingAI && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center text-white z-40">
                <Loader2 className="animate-spin mb-4 text-gold-500" size={48} />
                <p className="font-serif text-lg animate-pulse">AI Vision Processing...</p>
            </div>
        )}
      </div>

      {isAdmin && isEditing && !aiComparison && (
          <div className="bg-stone-900 p-4 flex items-center justify-around gap-4 text-white">
               <button onClick={() => initiateAI('enhance')} className="flex flex-col items-center gap-1 text-xs font-bold uppercase tracking-widest hover:text-gold-500 transition"><Wand2 size={20}/> AI Enhance</button>
               <button onClick={() => initiateAI('cleanup')} className="flex flex-col items-center gap-1 text-xs font-bold uppercase tracking-widest hover:text-gold-500 transition"><Eraser size={20}/> Cleanup</button>
          </div>
      )}

      {showTemplateSelector && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center p-4">
              <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-sm overflow-hidden animate-slide-up shadow-2xl">
                  <div className="p-4 bg-stone-50 border-b border-stone-200 flex justify-between items-center">
                      <h3 className="font-bold text-stone-800 flex items-center gap-2">
                          <Sparkles size={16} className="text-gold-600"/> Select AI Template
                      </h3>
                      <button onClick={() => setShowTemplateSelector(null)} className="p-1 hover:bg-stone-200 rounded-full"><Lock size={16} className="text-stone-400 rotate-45" /></button>
                  </div>
                  <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2">
                      <button onClick={() => runAIProcess(showTemplateSelector.mode)} className="w-full text-left p-3 rounded-lg border border-stone-200 hover:border-gold-500 hover:bg-gold-50 transition group">
                          <span className="block font-bold text-xs uppercase text-stone-400 group-hover:text-gold-600 mb-1">Default</span>
                          <span className="block text-sm text-stone-700 font-medium">Use System Default Prompt</span>
                      </button>
                      {showTemplateSelector.templates.map(t => (
                          <button key={t.id} onClick={() => runAIProcess(showTemplateSelector.mode, t.content)} className="w-full text-left p-3 rounded-lg border border-stone-200 hover:border-gold-500 hover:bg-gold-50 transition group">
                              <span className="block font-bold text-xs uppercase text-stone-400 group-hover:text-gold-600 mb-1">{t.label}</span>
                              <span className="block text-xs text-stone-600 line-clamp-2">{t.content}</span>
                          </button>
                      ))}
                  </div>
              </div>
          </div>
      )}
      
      <div className="max-w-3xl mx-auto p-6 space-y-8">
            {/* Header Details */}
            <div>
                <span className="text-gold-600 text-xs font-bold uppercase tracking-widest">{product.category}</span>
                {isEditing ? (
                    <input 
                        value={editForm.title || ''} 
                        onChange={e => setEditForm({...editForm, title: e.target.value})}
                        className="w-full font-serif text-3xl text-stone-900 mt-1 bg-white border-b border-gold-500 outline-none"
                    />
                ) : (
                    <h1 className="font-serif text-3xl text-stone-900 mt-1">{product.title}</h1>
                )}

                <div className="flex items-center gap-4 text-stone-500 text-sm mt-2">
                    <span className="flex items-center gap-1"><Tag size={14}/> {product.subCategory || 'Bespoke'}</span>
                    <span>•</span>
                    {isEditing ? (
                        <div className="flex items-center gap-1">
                            <input 
                                type="number" 
                                value={editForm.weight || 0} 
                                onChange={e => setEditForm({...editForm, weight: parseFloat(e.target.value)})}
                                className="w-20 bg-white border-b border-gold-500 outline-none text-right"
                            />
                            <span>g</span>
                        </div>
                    ) : (
                        // LIMITED VIEW: Hide weight for guests
                        <span className={`${isGuest ? 'blur-sm select-none opacity-50' : ''}`}>
                            {isGuest ? '00.00g' : `${product.weight}g`}
                        </span>
                    )}
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-2">
            {[
                { icon: Heart, label: 'Likes', val: stats.like, color: 'text-red-400' },
                { icon: ShoppingBag, label: 'Inquiries', val: stats.inquiry, color: 'text-gold-600' },
                { icon: Gem, label: 'Sold', val: stats.purchase, color: 'text-blue-500' },
                { icon: BarChart2, label: 'Trend', val: 'High', color: 'text-stone-400' }
            ].map((s, idx) => (
                <div key={idx} className="bg-white border border-stone-200 rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-sm">
                    <s.icon size={18} className={`mb-1 ${s.color}`} />
                    <span className="font-bold text-stone-800">{s.val}</span>
                    <span className="text-[9px] uppercase font-bold text-stone-400">{s.label}</span>
                </div>
            ))}
            </div>

            {/* Specifications Section */}
            <div className="bg-stone-100 rounded-2xl p-6 space-y-4">
                <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
                    <Info size={16} /> Specifications
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="flex items-start gap-3">
                         <Calendar size={18} className="text-stone-400 mt-0.5" />
                         <div>
                             <p className="text-xs font-bold uppercase text-stone-400">Date Added</p>
                             {/* LIMITED VIEW: Hide Date */}
                             <p className={`text-sm font-medium text-stone-700 ${isGuest ? 'blur-sm select-none opacity-50' : ''}`}>
                                 {isGuest ? 'dd/mm/yyyy' : new Date(product.createdAt).toLocaleDateString()}
                             </p>
                         </div>
                     </div>
                     {product.meta?.cameraModel && !isGuest && (
                        <div className="flex items-start gap-3 animate-fade-in">
                            <Camera size={18} className="text-stone-400 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold uppercase text-stone-400">Captured On</p>
                                <p className="text-sm font-medium text-stone-700">{product.meta.cameraModel}</p>
                            </div>
                        </div>
                     )}
                     {isAdmin && product.supplier && (
                        <div className="flex items-start gap-3">
                            <Package size={18} className="text-stone-400 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold uppercase text-stone-400">Supplier</p>
                                <p className="text-sm font-medium text-stone-700">{product.supplier}</p>
                            </div>
                        </div>
                     )}
                     {isAdmin && product.uploadedBy && (
                        <div className="flex items-start gap-3">
                            <User size={18} className="text-stone-400 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold uppercase text-stone-400">Uploaded By</p>
                                <p className="text-sm font-medium text-stone-700">{product.uploadedBy}</p>
                            </div>
                        </div>
                     )}
                     {product.meta?.location && !isGuest && (
                        <div className="flex items-start gap-3 animate-fade-in">
                            <MapPin size={18} className="text-stone-400 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold uppercase text-stone-400">Studio Location</p>
                                <p className="text-sm font-medium text-stone-700">{product.meta.location}</p>
                            </div>
                        </div>
                     )}
                     {isGuest && (
                         <div className="col-span-full bg-white/50 p-3 rounded-lg border border-dashed border-stone-300 flex items-center justify-center gap-2 text-stone-500 text-xs italic">
                             <Lock size={12}/> Technical specifications are locked for guests.
                         </div>
                     )}
                </div>

                {product.tags && product.tags.length > 0 && !isGuest && (
                    <div className="pt-4 border-t border-stone-200 animate-fade-in">
                        <div className="flex items-center gap-2 mb-3">
                            <Hash size={16} className="text-stone-400" />
                            <span className="text-xs font-bold uppercase text-stone-400">Tags</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {product.tags.map((tag, i) => (
                                <span key={i} className="px-3 py-1 bg-white border border-stone-200 rounded-full text-xs font-medium text-stone-600">
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Description Section */}
            <div className="prose prose-stone max-w-none">
                <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2 mb-2"><Info size={16} /> Craftsmanship Story</h3>
                {isEditing ? (
                    <textarea 
                        value={editForm.description || ''} 
                        onChange={e => setEditForm({...editForm, description: e.target.value})}
                        className="w-full h-40 p-4 bg-white border border-stone-200 rounded-xl focus:ring-1 focus:ring-gold-500 outline-none"
                    />
                ) : (
                    <p className="text-stone-600 leading-relaxed font-light whitespace-pre-line">{product.description || "A bespoke masterpiece from the Sanghavi collection."}</p>
                )}
            </div>

            {isEditing ? (
                 <div className="flex gap-4">
                     <button onClick={() => setIsEditing(false)} className="flex-1 py-4 bg-stone-200 text-stone-600 rounded-xl font-bold uppercase tracking-widest text-xs">Cancel</button>
                     <button onClick={handleSave} className="flex-1 py-4 bg-stone-900 text-white rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2"><Save size={16}/> Save Changes</button>
                 </div>
            ) : (
                <button 
                    onClick={() => isGuest ? navigate('/login') : storeService.shareToWhatsApp(product)} 
                    className="w-full py-4 bg-gold-600 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                >
                    <MessageCircle size={20} /> {isGuest ? 'Login to Inquire' : 'Inquire on WhatsApp'}
                </button>
            )}
      </div>

      {showFullScreen && displayImages.length > 0 && (
        <ImageViewer 
            images={displayImages} 
            title={product.title} 
            onClose={() => setShowFullScreen(false)} 
            onNextProduct={neighbors.next ? () => navigate(`/product/${neighbors.next}`, { state: { direction: 'next' } }) : undefined}
            onPrevProduct={neighbors.prev ? () => navigate(`/product/${neighbors.prev}`, { state: { direction: 'prev' } }) : undefined}
        />
      )}
    </div>
  );
};
