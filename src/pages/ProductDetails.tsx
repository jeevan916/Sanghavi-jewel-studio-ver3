
// ... (Previous imports)
// We need to keep the file content intact but add key={product.id}
import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Product, ProductStats, PromptTemplate, AppConfig } from '@/types.ts';
import { ArrowLeft, Share2, MessageCircle, Info, Tag, Heart, ShoppingBag, Gem, BarChart2, Loader2, Lock, Edit2, Save, Link as LinkIcon, Wand2, Eraser, ChevronLeft, ChevronRight, Calendar, Camera, User, Package, MapPin, Hash, Sparkles, Eye, EyeOff, X, CheckCircle, Copy, TrendingUp, Settings, DollarSign, ShieldCheck, Smartphone, RefreshCw, Clock, Layers } from 'lucide-react';
import { ImageViewer } from '@/components/ImageViewer.tsx';
import { ComparisonSlider } from '@/components/ComparisonSlider.tsx';
import { storeService } from '@/services/storeService.ts';
import { enhanceJewelryImage, removeWatermark } from '@/services/geminiService.ts';
import { useUpload } from '@/contexts/UploadContext.tsx';

export const ProductDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { processImage } = useUpload();
  
  // Initialize full screen state from navigation state to support seamless swiping
  const startInFullScreen = !!(location.state as any)?.startInFullScreen;
  const [showFullScreen, setShowFullScreen] = useState(startInFullScreen);
  
  const [product, setProduct] = useState<Product | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [stats, setStats] = useState<ProductStats>({ like: 0, dislike: 0, inquiry: 0, sold: 0, view: 0 });
  const [isRestricted, setIsRestricted] = useState(false);
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Product>>({});
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [aiComparison, setAiComparison] = useState<{original: string, enhanced: string} | null>(null);
  const [showTemplateSelector, setShowTemplateSelector] = useState<{mode: 'enhance' | 'cleanup', templates: PromptTemplate[]} | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [neighbors, setNeighbors] = useState<{prev: string | null, next: string | null}>({ prev: null, next: null });

  const user = storeService.getCurrentUser();
  const isAdmin = user?.role === 'admin' || user?.role === 'contributor';
  const isGuest = !user;

  // Touch handling refs
  const touchStart = useRef({ x: 0, y: 0 });
  const touchEnd = useRef({ x: 0, y: 0 });
  
  // Animation Logic:
  // Using more robust cubic-bezier curves for 'infused' feel
  const direction = (location.state as any)?.direction || 'fade';
  const shouldAnimatePage = !showFullScreen && !startInFullScreen;
  const animationClass = shouldAnimatePage
                       ? (direction === 'next' ? 'animate-slide-in-right' 
                       : direction === 'prev' ? 'animate-slide-in-left' 
                       : 'animate-fade-in')
                       : '';

  // Ensure scroll resets immediately when ID changes
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  // Sync full screen state when navigating with startInFullScreen
  useEffect(() => {
    if ((location.state as any)?.startInFullScreen) {
      setShowFullScreen(true);
    }
  }, [location.state]);

  useEffect(() => {
    if (!id) return;
    
    // Reset interaction states on navigation to prevent data crossover
    setAiComparison(null);
    setIsProcessingAI(false);
    setIsEditing(false);
    setShowTemplateSelector(null);
    setGeneratedLink(null);
    setIsRestricted(false);
    // Clear neighbors immediately to prevent stale navigation during load
    setNeighbors({ prev: null, next: null });

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
            const GUEST_LIMIT = 8;
            
            // Check if this specific product has been unlocked via shared link
            const isUnlocked = storeService.getUnlockedProducts().includes(fetchedProduct.id);
            const isSharedAccess = (location.state as any)?.fromSharedLink || isUnlocked;

            // Optimization: Use cached products if available to avoid massive fetch
            const cached = storeService.getCached();
            let allItems = cached.products || [];
            
            if (allItems.length === 0 || !allItems.find(p => p.id === fetchedProduct.id)) {
                const listData = await storeService.getProducts(1, 1000, { publicOnly: true }); 
                allItems = listData.items;
            }

            // Filter by category for navigation as per user request
            let navItems = allItems.filter(p => p.category === fetchedProduct.category);

            // SECURITY: STRICT GUEST LOCK (Bypassed if shared)
            if (isGuest && !isSharedAccess) {
                const globalIndex = allItems.findIndex(p => p.id === fetchedProduct.id);
                if (globalIndex >= GUEST_LIMIT) {
                    setIsRestricted(true);
                    setProduct(fetchedProduct); 
                    setIsLoading(false);
                    return; 
                }
                // Restrict navigation for guests within the category
                navItems = navItems.slice(0, GUEST_LIMIT);
            }

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

            // Calculate Neighbors
            const idx = navItems.findIndex(p => p.id === fetchedProduct.id);
            if (idx !== -1) {
                setNeighbors({
                    prev: idx > 0 ? navItems[idx - 1].id : null,
                    next: idx < navItems.length - 1 ? navItems[idx + 1].id : null
                });
            } else {
                setNeighbors({ prev: null, next: null });
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
    setIsSaving(true);
    try {
        const updated = { ...product, ...editForm };
        await storeService.updateProduct(updated);
        setProduct(updated);
        setIsEditing(false);
    } catch (e) {
        alert("Failed to save changes");
    } finally {
        setIsSaving(false);
    }
  };

  const handleToggleVisibility = async () => {
      if (!product) return;
      const newStatus = !product.isHidden;
      const updated = { ...product, isHidden: newStatus };
      setProduct(updated);
      setEditForm(updated);

      try {
          await storeService.updateProduct(updated);
      } catch (e) {
          setProduct({ ...product, isHidden: !newStatus });
          alert("Failed to update visibility status.");
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
     if (!product || !aiComparison || product.id !== id) return;
     setIsLoading(true);
     try {
        // Updated to use new object return
        const { primary, thumbnail } = await processImage(aiComparison.enhanced, { width: 1600, quality: 0.9, format: 'image/webp' });
        
        // Use the proper thumbnail generated by the server
        const updated = { 
            ...product, 
            images: [primary, ...product.images],
            thumbnails: [thumbnail, ...product.thumbnails]
        };
        
        await storeService.updateProduct(updated);
        
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
      setIsLoading(true);
      try {
          const url = await storeService.createSharedLink(product.id, 'product');
          setGeneratedLink(url);
      } catch (e) { 
          alert("Link generation failed. Please check backend connection."); 
      } finally {
          setIsLoading(false);
      }
  };

  // --- SWIPE HANDLERS (VIBRATION ENHANCED) ---
  const handleTouchStart = (e: React.TouchEvent) => {
      touchStart.current = {
          x: e.targetTouches[0].clientX,
          y: e.targetTouches[0].clientY
      };
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
      touchEnd.current = {
          x: e.targetTouches[0].clientX,
          y: e.targetTouches[0].clientY
      };
  };

  const handleTouchEnd = () => {
      if (!touchStart.current.x || !touchEnd.current.x) return;
      
      const deltaX = touchStart.current.x - touchEnd.current.x;
      const deltaY = touchStart.current.y - touchEnd.current.y;
      
      // Sensitivity Threshold: 100px (increased from 50px)
      // Vertical Guard: If vertical movement is greater than horizontal, it's a scroll
      const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY) * 1.5;
      const isSwipeLeft = isHorizontalSwipe && deltaX > 100;
      const isSwipeRight = isHorizontalSwipe && deltaX < -100;

      if (isSwipeLeft && neighbors.next) {
          if(navigator.vibrate) navigator.vibrate(20); // Haptic Feedback
          navigate(`/product/${neighbors.next}`, { state: { direction: 'next' } });
      }
      
      if (isSwipeRight && neighbors.prev) {
          if(navigator.vibrate) navigator.vibrate(20); // Haptic Feedback
          navigate(`/product/${neighbors.prev}`, { state: { direction: 'prev' } });
      }

      // Reset
      touchStart.current = { x: 0, y: 0 };
      touchEnd.current = { x: 0, y: 0 };
  };

  const [selectedCarat, setSelectedCarat] = useState<'9KT' | '14KT' | '18KT' | '22KT'>('22KT');
  const [pincode, setPincode] = useState('');
  const [isPincodeChecked, setIsPincodeChecked] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'price'>('details');

  const priceData = (product && config) ? storeService.calculatePrice(product, config) : null;

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

  // --- STRICT RESTRICTED VIEW ---
  if (isRestricted) {
      return (
          <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-8 text-center animate-fade-in">
              <div className="w-20 h-20 bg-stone-900 rounded-full flex items-center justify-center mb-6 shadow-xl">
                  <Lock size={32} className="text-white" />
              </div>
              <h2 className="font-serif text-3xl text-stone-800 mb-2">Vault Restricted</h2>
              <p className="text-stone-500 text-sm max-w-xs mx-auto mb-8 leading-relaxed">
                  This bespoke asset resides in our private collection. Access is reserved for registered clientele.
              </p>
              <div className="flex gap-4 w-full max-w-xs">
                  <button onClick={() => navigate('/collection')} className="flex-1 py-3 bg-stone-200 text-stone-600 rounded-xl font-bold uppercase text-xs tracking-widest">
                      Gallery
                  </button>
                  <button onClick={() => navigate('/login')} className="flex-1 py-3 bg-gold-600 text-white rounded-xl font-bold uppercase text-xs tracking-widest shadow-lg">
                      Unlock Access
                  </button>
              </div>
          </div>
      );
  }

  return (
    <div 
        className="min-h-screen bg-stone-50 pb-20 pt-0 md:pt-24"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ overscrollBehaviorX: 'none' }}
    >
      {/* HEADER: Stable (Outside Animation Key) */}
      <div className="bg-white/90 backdrop-blur-xl border-b border-stone-100 px-4 h-16 flex items-center justify-between sticky top-0 md:top-24 z-30 transition-all duration-500">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-stone-400 hover:text-brand-dark hover:bg-stone-50 rounded-xl transition-all"><ArrowLeft size={20} /></button>
        <div className="flex flex-col items-center flex-1 px-2 overflow-hidden">
            <span className="text-[7px] font-bold uppercase tracking-[0.3em] text-brand-gold mb-0.5">{product.category}</span>
            <h2 className="font-serif font-bold text-brand-dark text-lg truncate w-full text-center">{product.title}</h2>
        </div>
        <div className="flex gap-2">
            {isAdmin ? (
                <div className="flex bg-stone-100 rounded-xl p-1 mr-2">
                    <button 
                        onClick={handleToggleVisibility}
                        className={`p-2 rounded-lg transition-all ${product.isHidden ? 'bg-rose-500 text-white' : 'text-stone-400 hover:text-brand-dark'}`}
                    >
                        {product.isHidden ? <EyeOff size={18}/> : <Eye size={18}/>}
                    </button>
                    <button onClick={handlePrivateLink} className="p-2 text-stone-400 hover:text-brand-dark transition-all"><LinkIcon size={18}/></button>
                    <button onClick={() => setIsEditing(!isEditing)} className={`p-2 rounded-lg transition-all ${isEditing ? 'bg-brand-gold text-white' : 'text-stone-400 hover:text-brand-dark'}`}><Edit2 size={18}/></button>
                </div>
            ) : (
                <>
                    <button onClick={() => toggleLike()} className={`p-3 rounded-2xl transition-all ${isLiked ? 'text-brand-red bg-brand-red/5' : 'text-stone-300 hover:text-brand-dark hover:bg-stone-50'}`}>
                        <Heart size={22} fill={isLiked ? "currentColor" : "none"} />
                    </button>
                    <button onClick={() => navigator.share?.({ title: product.title, url: window.location.href })} className="p-3 text-stone-300 hover:text-brand-dark hover:bg-stone-50 rounded-2xl transition-all"><Share2 size={22} /></button>
                </>
            )}
        </div>
      </div>

      {/* CONTENT: Animated Wrapper */}
      <div className={`max-w-7xl mx-auto md:p-8 lg:p-12 ${animationClass}`}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
            
            {/* LEFT COLUMN: Visual Media (Sticky on Desktop) */}
            <div className="lg:sticky lg:top-48 lg:h-[calc(100vh-14rem)]">
                <div className="relative w-full aspect-[4/5] md:h-auto md:aspect-video lg:aspect-auto lg:h-full bg-white overflow-hidden select-none group rounded-none md:rounded-[2.5rem] border-b md:border border-stone-100 shadow-2xl transition-all duration-700">
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
                                    className="w-full h-full object-cover bg-white cursor-zoom-in active:scale-105 transition-transform duration-1000 ease-out" 
                                    onClick={() => setShowFullScreen(true)} 
                                    alt={product.title} 
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-stone-300 italic font-serif">Awaiting Visual Asset...</div>
                            )}
                            
                            <div className="hidden md:flex absolute inset-x-0 top-1/2 -translate-y-1/2 justify-between px-8 opacity-0 group-hover:opacity-100 transition-all duration-500 pointer-events-none">
                                {neighbors.prev && (
                                    <button 
                                        onClick={() => navigate(`/product/${neighbors.prev}`, { state: { direction: 'prev' } })} 
                                        className="p-4 bg-white/20 text-white rounded-full hover:bg-white/40 pointer-events-auto backdrop-blur-xl transition-all active:scale-90 border border-white/10"
                                    >
                                        <ChevronLeft size={28}/>
                                    </button>
                                )}
                                {neighbors.next && (
                                    <button 
                                        onClick={() => navigate(`/product/${neighbors.next}`, { state: { direction: 'next' } })} 
                                        className="p-4 bg-white/20 text-white rounded-full hover:bg-white/40 pointer-events-auto backdrop-blur-xl transition-all active:scale-90 border border-white/10"
                                    >
                                        <ChevronRight size={28}/>
                                    </button>
                                )}
                            </div>

                            {isGuest && images.length > 1 && (
                                <div className="absolute bottom-6 right-6 bg-black/60 backdrop-blur-xl text-white px-4 py-2 rounded-xl text-[9px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 cursor-pointer hover:bg-black/80 transition-all shadow-2xl border border-white/10" onClick={() => navigate('/login')}>
                                    <Lock size={12} /> {images.length - 1} Private Views Locked
                                </div>
                            )}
                        </>
                    )}

                    {isProcessingAI && (
                        <div className="absolute inset-0 bg-brand-dark/60 backdrop-blur-md flex flex-col items-center justify-center text-white z-40">
                            <Loader2 className="animate-spin mb-6 text-brand-gold" size={56} />
                            <p className="font-serif text-xl animate-pulse tracking-widest uppercase">AI Vision Processing...</p>
                        </div>
                    )}
                </div>

                {isAdmin && isEditing && !aiComparison && (
                    <div className="bg-brand-dark p-4 rounded-b-[2.5rem] flex items-center justify-around gap-6 text-white -mt-1 md:mt-0 shadow-2xl">
                        <button onClick={() => initiateAI('enhance')} className="flex flex-col items-center gap-2 text-[9px] font-bold uppercase tracking-[0.3em] text-stone-400 hover:text-brand-gold transition-all"><Wand2 size={20}/> Enhance</button>
                        <button onClick={() => initiateAI('cleanup')} className="flex flex-col items-center gap-2 text-[9px] font-bold uppercase tracking-[0.3em] text-stone-400 hover:text-brand-gold transition-all"><Eraser size={20}/> Cleanup</button>
                    </div>
                )}

                {/* Price Display - Just below image */}
                {!isEditing && (
                    <div className="mt-2 flex items-center justify-between px-4 md:px-6 py-3 bg-stone-50 md:rounded-2xl border-y md:border border-stone-100">
                        <div className="space-y-0.5">
                            <p className="text-[7px] font-bold text-stone-400 uppercase tracking-[0.2em]">Live Valuation</p>
                            <div className="flex items-baseline gap-2">
                                <span className={`text-2xl font-bold text-brand-dark ${isGuest ? 'blur-xl select-none opacity-20' : ''}`}>
                                    ₹{Math.round(priceData?.total || 0).toLocaleString('en-IN')}
                                </span>
                                <span className="text-[7px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded uppercase tracking-widest border border-emerald-100">Live</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-[7px] font-bold text-stone-400 uppercase tracking-[0.2em]">Gold Rate</p>
                            <p className="text-[10px] font-mono font-bold text-brand-gold">₹{priceData?.goldRate}/g</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-6 md:p-0 space-y-6">
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <span className="text-brand-gold text-[9px] font-bold uppercase tracking-[0.3em]">{product.category}</span>
                        <span className="w-1 h-1 rounded-full bg-stone-200"></span>
                        <span className="text-stone-400 text-[9px] font-bold uppercase tracking-[0.3em]">Ref: {product.id.slice(-6).toUpperCase()}</span>
                    </div>
                    
                    {isEditing ? (
                        <div className="bg-stone-50 p-6 rounded-3xl border border-stone-100 space-y-6 animate-in fade-in slide-in-from-top-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[9px] font-bold text-brand-gold uppercase tracking-[0.3em] flex items-center gap-2">
                                    <Settings size={14} /> Admin Pricing Controls
                                </h3>
                                <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 bg-brand-dark text-white rounded-lg text-[9px] font-bold uppercase tracking-widest hover:bg-brand-red transition-all flex items-center gap-2">
                                    {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[8px] font-bold uppercase text-stone-400 tracking-widest mb-1.5 ml-1">Product Title</label>
                                    <input 
                                        value={editForm.title || ''} 
                                        onChange={e => setEditForm({...editForm, title: e.target.value})}
                                        className="w-full font-serif text-2xl text-brand-dark bg-white p-3 rounded-xl border border-stone-100 outline-none focus:border-brand-gold transition-all"
                                        placeholder="Product Title"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="block text-[9px] font-bold uppercase text-stone-400 tracking-widest ml-1">Gold Weight (g)</label>
                                        <div className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-stone-100">
                                            <Gem size={18} className="text-brand-gold" />
                                            <input 
                                                type="number" 
                                                step="0.01"
                                                value={editForm.weight || 0} 
                                                onChange={e => setEditForm({...editForm, weight: parseFloat(e.target.value)})}
                                                className="flex-1 bg-transparent outline-none font-mono font-bold text-brand-dark text-lg"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-[9px] font-bold uppercase text-stone-400 tracking-widest ml-1">Making Segment</label>
                                        <div className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-stone-100">
                                            <Tag size={18} className="text-brand-gold" />
                                            <select 
                                                value={editForm.meta?.makingChargeSegmentId || ''}
                                                onChange={e => setEditForm({...editForm, meta: {...(editForm.meta || {}), makingChargeSegmentId: e.target.value, makingChargePercent: e.target.value === 'custom' ? (editForm.meta?.makingChargePercent || 12) : undefined}})}
                                                className="flex-1 bg-transparent outline-none text-xs font-bold uppercase tracking-widest"
                                            >
                                                <option value="">Default ({config?.makingChargeSegments.find(s => s.id === config.defaultMakingChargeSegmentId)?.name || '12%'})</option>
                                                {config?.makingChargeSegments.map(s => (
                                                    <option key={s.id} value={s.id}>{s.name} ({s.percent}%)</option>
                                                ))}
                                                <option value="custom">Custom %</option>
                                            </select>
                                        </div>
                                    </div>

                                    {editForm.meta?.makingChargeSegmentId === 'custom' && (
                                        <div className="space-y-2">
                                            <label className="block text-[9px] font-bold uppercase text-stone-400 tracking-widest ml-1">Custom Making %</label>
                                            <div className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-stone-100">
                                                <TrendingUp size={18} className="text-brand-gold" />
                                                <input 
                                                    type="number"
                                                    value={editForm.meta?.makingChargePercent || 12}
                                                    onChange={e => setEditForm({...editForm, meta: {...(editForm.meta || {}), makingChargePercent: parseFloat(e.target.value)}})}
                                                    className="flex-1 bg-transparent outline-none font-mono font-bold text-brand-dark"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <label className="block text-[9px] font-bold uppercase text-stone-400 tracking-widest ml-1">Other Charges (₹)</label>
                                        <div className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-stone-100">
                                            <DollarSign size={18} className="text-brand-gold" />
                                            <input 
                                                type="number"
                                                value={editForm.meta?.otherCharges || 0}
                                                onChange={e => setEditForm({...editForm, meta: {...(editForm.meta || {}), otherCharges: parseFloat(e.target.value)}})}
                                                className="flex-1 bg-transparent outline-none font-mono font-bold text-brand-dark"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <h1 className="font-serif text-3xl md:text-5xl text-brand-dark leading-tight tracking-tight">{product.title}</h1>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-stone-500 text-sm">
                        <span className="flex items-center gap-2 bg-stone-100 px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest text-stone-600"><Tag size={12} className="text-brand-gold" /> {product.subCategory || 'Bespoke'}</span>
                        <span className="flex items-center gap-2 bg-stone-100 px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest text-stone-600">
                            <Layers size={12} className="text-brand-gold" /> 
                            {product.meta?.makingChargeSegmentId === 'custom' ? 'Custom Segment' : (config?.makingChargeSegments?.find(s => s.id === (product.meta?.makingChargeSegmentId || config?.defaultMakingChargeSegmentId))?.name || 'Standard')}
                        </span>
                        <div className="h-1 w-1 bg-stone-200 rounded-full"></div>
                        {!isEditing && (
                            <div className="flex items-center gap-2">
                                <Gem size={12} className="text-brand-gold" />
                                <span className={`font-mono text-base ${isGuest ? 'blur-md select-none opacity-30' : 'text-brand-dark font-bold'}`}>
                                    {isGuest ? '00.00g' : `${product.weight}g`}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                    {[
                        { icon: Heart, label: 'Likes', val: stats.like, color: 'text-brand-red', bg: 'bg-brand-red/5' },
                        { icon: MessageCircle, label: 'Inquiry', val: stats.inquiry, color: 'text-brand-gold', bg: 'bg-brand-gold/5' },
                        { icon: Gem, label: 'Sold', val: stats.sold, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                        { icon: TrendingUp, label: 'Trend', val: (stats.inquiry * 5 + stats.like * 3 + stats.view) > 50 ? 'Elite' : (stats.inquiry * 5 + stats.like * 3 + stats.view) > 20 ? 'Hot' : 'New', color: 'text-brand-dark', bg: 'bg-stone-100' }
                    ].map((s, idx) => (
                        <div key={idx} className={`${s.bg} rounded-xl p-2 flex flex-col items-center justify-center text-center transition-all border border-stone-100/50`}>
                            <s.icon size={12} className={`mb-0.5 ${s.color}`} />
                            <span className="font-bold text-brand-dark text-xs leading-none mb-0.5">{s.val}</span>
                            <span className="text-[7px] uppercase font-bold text-stone-400 tracking-tighter leading-none">{s.label}</span>
                        </div>
                    ))}
                </div>

                <div className="space-y-4">
                    {/* Accordions */}
                    <div className="space-y-1">
                        <div className="bg-white border border-stone-100 rounded-xl overflow-hidden">
                            <button 
                                onClick={() => setActiveTab(activeTab === 'details' ? 'price' : 'details')}
                                className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-stone-50 transition-colors"
                            >
                                <span className="text-[9px] font-bold text-brand-dark uppercase tracking-widest">Product Details</span>
                                <ChevronRight size={12} className={`text-stone-400 transition-transform ${activeTab === 'details' ? 'rotate-90' : ''}`} />
                            </button>
                            {activeTab === 'details' && (
                                <div className="px-4 pb-3 animate-in fade-in slide-in-from-top-1">
                                    <p className="text-[11px] text-stone-600 leading-relaxed font-serif italic">
                                        {product.description || "A bespoke masterpiece from the Sanghavi collection."}
                                    </p>
                                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                                        <div className="bg-stone-50 p-1.5 rounded-lg border border-stone-100">
                                            <p className="text-[7px] text-stone-400 uppercase font-bold tracking-tighter">Ref ID</p>
                                            <p className="text-[9px] font-bold text-brand-dark">{product.id.slice(-8).toUpperCase()}</p>
                                        </div>
                                        <div className="bg-stone-50 p-1.5 rounded-lg border border-stone-100">
                                            <p className="text-[7px] text-stone-400 uppercase font-bold tracking-tighter">Net Weight</p>
                                            <p className="text-[9px] font-bold text-brand-dark">{product.weight} g</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-white border border-stone-100 rounded-xl overflow-hidden">
                            <button 
                                onClick={() => setActiveTab(activeTab === 'price' ? 'details' : 'price')}
                                className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-stone-50 transition-colors"
                            >
                                <span className="text-[9px] font-bold text-brand-dark uppercase tracking-widest">Price Breakup</span>
                                <ChevronRight size={12} className={`text-stone-400 transition-transform ${activeTab === 'price' ? 'rotate-90' : ''}`} />
                            </button>
                            {activeTab === 'price' && priceData && (
                                <div className="px-4 pb-3 space-y-1.5 animate-in fade-in slide-in-from-top-1">
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[9px]">
                                            <span className="text-stone-500">Gold Value</span>
                                            <span className="font-mono text-brand-dark">₹{Math.round(priceData.basePrice).toLocaleString('en-IN')}</span>
                                        </div>
                                        <div className="flex justify-between text-[9px]">
                                            <span className="text-stone-500">Making ({priceData.makingPercent}%) <span className="text-[7px] bg-stone-100 px-1 py-0.5 rounded text-stone-400 ml-1">{product.meta?.makingChargeSegmentId === 'custom' ? 'Custom' : (config?.makingChargeSegments?.find(s => s.id === (product.meta?.makingChargeSegmentId || config?.defaultMakingChargeSegmentId))?.name || 'Standard')}</span></span>
                                            <span className="font-mono text-brand-dark">₹{Math.round(priceData.makingCharges).toLocaleString('en-IN')}</span>
                                        </div>
                                        <div className="flex justify-between text-[9px]">
                                            <span className="text-stone-500">GST ({config?.gstPercent || 3}%)</span>
                                            <span className="font-mono text-brand-dark">₹{Math.round(priceData.gst).toLocaleString('en-IN')}</span>
                                        </div>
                                        <div className="pt-1 border-t border-stone-100 flex justify-between text-[10px] font-bold">
                                            <span className="text-brand-dark uppercase tracking-widest">Total</span>
                                            <span className="text-brand-gold">₹{Math.round(priceData.total).toLocaleString('en-IN')}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-[9px] font-bold text-stone-400 uppercase tracking-[0.3em] flex items-center gap-2">
                        <div className="h-px flex-1 bg-stone-100"></div>
                        Craftsmanship Story
                        <div className="h-px flex-1 bg-stone-100"></div>
                    </h3>
                    {isEditing ? (
                        <textarea 
                            value={editForm.description || ''} 
                            onChange={e => setEditForm({...editForm, description: e.target.value})}
                            className="w-full h-32 p-4 bg-white border border-stone-100 rounded-2xl focus:ring-2 focus:ring-brand-gold/20 outline-none text-stone-600 leading-relaxed resize-none font-serif text-base"
                            placeholder="Describe the masterpiece..."
                        />
                    ) : (
                        <p className="text-stone-500 leading-relaxed font-serif italic text-lg text-center md:text-left px-2">
                            {product.description || "A bespoke masterpiece from the Sanghavi collection, crafted with precision and elegance."}
                        </p>
                    )}
                </div>

                {/* Specs */}
                <div className="bg-white rounded-3xl p-6 space-y-6 border border-stone-100 shadow-lg">
                    <h3 className="text-[9px] font-bold text-brand-gold uppercase tracking-[0.3em] flex items-center gap-2">
                        <Info size={14} /> Technical Specifications
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-stone-50 rounded-xl text-stone-400 border border-stone-100"><Calendar size={14} /></div>
                            <div>
                                <p className="text-[8px] font-bold uppercase text-stone-400 tracking-widest">Acquisition</p>
                                <p className={`text-xs font-bold text-brand-dark ${isGuest ? 'blur-md select-none opacity-30' : ''}`}>
                                    {isGuest ? 'dd/mm/yyyy' : new Date(product.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </p>
                            </div>
                        </div>
                        {product.meta?.cameraModel && !isGuest && (
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-stone-50 rounded-xl text-stone-400 border border-stone-100"><Camera size={14} /></div>
                                <div>
                                    <p className="text-[8px] font-bold uppercase text-stone-400 tracking-widest">Studio Capture</p>
                                    <p className="text-xs font-bold text-brand-dark truncate max-w-[120px]">{product.meta.cameraModel}</p>
                                </div>
                            </div>
                        )}
                        {isAdmin && product.supplier && (
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-stone-50 rounded-xl text-stone-400 border border-stone-100"><Package size={14} /></div>
                                <div>
                                    <p className="text-[8px] font-bold uppercase text-stone-400 tracking-widest">Artisan Source</p>
                                    <p className="text-xs font-bold text-brand-dark">{product.supplier}</p>
                                </div>
                            </div>
                        )}
                        {product.meta?.location && !isGuest && (
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-stone-50 rounded-xl text-stone-400 border border-stone-100"><MapPin size={14} /></div>
                                <div>
                                    <p className="text-[8px] font-bold uppercase text-stone-400 tracking-widest">Vault Location</p>
                                    <p className="text-xs font-bold text-brand-dark">{product.meta.location}</p>
                                </div>
                            </div>
                        )}
                    </div>
                    {isGuest && (
                         <div className="bg-brand-gold/5 p-4 rounded-2xl border border-dashed border-brand-gold/20 flex items-center justify-center gap-3 text-brand-gold text-[10px] font-bold uppercase tracking-widest">
                             <Lock size={14}/> Detailed specifications reserved for members
                         </div>
                     )}
                </div>

                {product.tags && product.tags.length > 0 && !isGuest && (
                    <div className="flex flex-wrap gap-3">
                        {product.tags.map((tag, i) => (
                            <span key={i} className="px-4 py-2 bg-white border border-stone-100 rounded-full text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] shadow-sm hover:border-brand-gold hover:text-brand-gold transition-all cursor-default">
                                #{tag}
                            </span>
                        ))}
                    </div>
                )}

                <div className="pt-4">
                    {isEditing ? (
                        <div className="flex gap-4">
                            <button onClick={() => setIsEditing(false)} className="flex-1 py-5 bg-stone-100 text-stone-400 rounded-2xl font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-stone-200 transition-all">Cancel</button>
                            <button onClick={handleSave} className="flex-1 py-5 bg-brand-dark text-white rounded-2xl font-bold uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-3 hover:bg-brand-gold transition-all shadow-2xl"><Save size={18}/> Save Masterpiece</button>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
      </div>

      {/* MODALS */}
      {showFullScreen && displayImages.length > 0 && (
        <ImageViewer 
            key={product.id}
            images={displayImages} 
            title={product.title} 
            disableAnimation={startInFullScreen}
            onClose={() => setShowFullScreen(false)} 
            onNextProduct={neighbors.next ? () => navigate(`/product/${neighbors.next}`, { state: { direction: 'next', startInFullScreen: true } }) : undefined}
            onPrevProduct={neighbors.prev ? () => navigate(`/product/${neighbors.prev}`, { state: { direction: 'prev', startInFullScreen: true } }) : undefined}
        />
      )}

      {generatedLink && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl relative">
                <button onClick={() => setGeneratedLink(null)} className="absolute top-4 right-4 text-stone-400 hover:text-stone-800"><X size={20}/></button>
                <div className="flex flex-col items-center text-center gap-4">
                    <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center">
                        <CheckCircle size={24} />
                    </div>
                    <div>
                        <h3 className="font-serif text-xl font-bold text-stone-800">Private Link Ready</h3>
                        <p className="text-stone-500 text-xs mt-1">This secure link expires in 24 hours.</p>
                    </div>
                    
                    <div className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl break-all text-xs font-mono text-stone-600 select-all">
                        {generatedLink}
                    </div>

                    <div className="flex gap-2 w-full">
                         <button 
                            onClick={() => {
                                navigator.clipboard.writeText(generatedLink);
                                setGeneratedLink(null);
                                alert("Copied to clipboard");
                            }}
                            className="flex-1 py-3 bg-stone-900 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest flex items-center justify-center gap-2"
                         >
                            <Copy size={14} /> Copy Link
                         </button>
                         <button 
                             onClick={() => {
                                 if (navigator.share) {
                                     navigator.share({ title: 'Private View', url: generatedLink }).catch(()=>{});
                                 } else {
                                     window.open(`https://wa.me/?text=${encodeURIComponent(generatedLink)}`, '_blank');
                                 }
                             }}
                             className="px-4 py-3 bg-green-50 text-green-700 rounded-xl font-bold uppercase text-[10px] tracking-widest border border-green-100"
                         >
                            <Share2 size={16} />
                         </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {showTemplateSelector && (
          <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-6">
              <div className="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-300 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] border border-stone-100">
                  <div className="p-6 bg-stone-50/50 border-b border-stone-100 flex justify-between items-center">
                      <div>
                          <h3 className="font-serif text-xl font-bold text-brand-dark flex items-center gap-2">
                              <Sparkles size={20} className="text-brand-gold"/> AI Studio
                          </h3>
                          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-0.5">Select Enhancement Style</p>
                      </div>
                      <button onClick={() => setShowTemplateSelector(null)} className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-400 hover:text-brand-dark">
                          <X size={20} />
                      </button>
                  </div>
                  <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
                      <button 
                          onClick={() => runAIProcess(showTemplateSelector.mode)} 
                          className="w-full text-left p-4 rounded-2xl border border-stone-100 hover:border-brand-gold hover:bg-brand-gold/5 transition-all group flex items-center justify-between"
                      >
                          <span className="font-bold text-xs uppercase text-stone-500 group-hover:text-brand-dark tracking-widest">Standard (Default)</span>
                          <div className="w-2 h-2 rounded-full bg-stone-200 group-hover:bg-brand-gold"></div>
                      </button>
                      
                      {showTemplateSelector.templates.map(t => (
                          <button 
                              key={t.id} 
                              onClick={() => runAIProcess(showTemplateSelector.mode, t.content)} 
                              className="w-full text-left p-4 rounded-2xl border border-stone-100 hover:border-brand-gold hover:bg-brand-gold/5 transition-all group flex items-center justify-between"
                          >
                              <span className="font-bold text-xs uppercase text-stone-500 group-hover:text-brand-dark tracking-widest">{t.label}</span>
                              <div className="w-2 h-2 rounded-full bg-stone-200 group-hover:bg-brand-gold"></div>
                          </button>
                      ))}
                  </div>
                  <div className="p-4 bg-stone-50/50 text-center">
                      <p className="text-[8px] font-bold text-stone-400 uppercase tracking-widest">Powered by Gemini Vision Pro</p>
                  </div>
              </div>
          </div>
      )}

      {/* Floating Action Button: WhatsApp Inquiry */}
      {!isEditing && !isAdmin && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-xs px-4 animate-in slide-in-from-bottom-full duration-700">
              <button 
                  onClick={() => isGuest ? navigate('/login') : storeService.shareToWhatsApp(product)} 
                  className="w-full py-3.5 bg-brand-dark text-white rounded-full font-bold shadow-2xl shadow-brand-dark/40 flex items-center justify-center gap-3 active:scale-[0.98] transition-all hover:bg-brand-gold group border border-white/10 backdrop-blur-md"
              >
                  <MessageCircle size={18} className="group-hover:rotate-12 transition-transform" /> 
                  <span className="uppercase tracking-[0.2em] text-[9px] font-bold">{isGuest ? 'Member Access Required' : 'Inquire via WhatsApp'}</span>
              </button>
          </div>
      )}
    </div>
  );
};
