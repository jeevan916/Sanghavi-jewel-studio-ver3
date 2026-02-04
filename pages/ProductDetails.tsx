
import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Product, ProductStats, PromptTemplate, AppConfig } from '../types';
import { ArrowLeft, Share2, MessageCircle, Info, Tag, Heart, ShoppingBag, Gem, BarChart2, Loader2, Lock, Edit2, Save, Link as LinkIcon, Wand2, Eraser, ChevronLeft, ChevronRight, Calendar, Camera, User, Package, MapPin, Hash, Sparkles, Eye, EyeOff, X, CheckCircle, Copy } from 'lucide-react';
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
  
  // Initialize full screen state from navigation state to support seamless swiping
  const startInFullScreen = !!(location.state as any)?.startInFullScreen;
  const [showFullScreen, setShowFullScreen] = useState(startInFullScreen);
  
  const [product, setProduct] = useState<Product | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [stats, setStats] = useState<ProductStats>({ like: 0, dislike: 0, inquiry: 0, purchase: 0 });
  const [isRestricted, setIsRestricted] = useState(false);
  
  const [isEditing, setIsEditing] = useState(false);
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
  const touchStart = useRef(0);
  const touchEnd = useRef(0);
  
  // Animation Logic:
  // If we are in full screen mode, or starting in it, suppress the page slide animation to reduce clutter/flashing behind the viewer.
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
            // Fetch neighbors for navigation
            const listData = await storeService.getProducts(1, 1000, { publicOnly: true }); 
            const allItems = listData.items;
            const GUEST_LIMIT = 8;

            // SECURITY: STRICT GUEST LOCK
            if (isGuest) {
                const globalIndex = allItems.findIndex(p => p.id === fetchedProduct.id);
                if (globalIndex >= GUEST_LIMIT) {
                    setIsRestricted(true);
                    setProduct(fetchedProduct); 
                    setIsLoading(false);
                    return; 
                }
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
            let navItems = allItems;
            if (isGuest) {
                navItems = allItems.slice(0, GUEST_LIMIT);
            }

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
        className="min-h-screen bg-stone-50 pb-20 pt-0 md:pt-16"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ overscrollBehaviorX: 'none' }}
    >
      {/* HEADER: Stable (Outside Animation Key) */}
      <div className="bg-white/80 backdrop-blur-md border-b border-stone-200 px-4 h-16 flex items-center justify-between sticky top-0 md:top-16 z-30">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-stone-600 hover:bg-stone-100 rounded-full transition-colors"><ArrowLeft size={24} /></button>
        <h2 className="font-serif font-bold text-stone-800 text-lg truncate flex-1 px-4 text-center md:text-left">{product.title}</h2>
        <div className="flex gap-2">
            <button onClick={() => toggleLike()} className={`p-2 rounded-full transition-colors ${isLiked ? 'text-red-500 bg-red-50' : 'text-stone-400 hover:bg-stone-100'}`}>
                <Heart size={20} fill={isLiked ? "currentColor" : "none"} />
            </button>
            <button onClick={() => navigator.share?.({ title: product.title, url: window.location.href })} className="p-2 text-stone-600 hover:bg-stone-100 rounded-full transition-colors"><Share2 size={20} /></button>
        </div>
      </div>

      {/* CONTENT: Animated Wrapper */}
      <div key={product.id} className={`max-w-7xl mx-auto md:p-6 lg:p-8 ${animationClass}`}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-12">
            
            {/* LEFT COLUMN: Visual Media (Sticky on Desktop) */}
            <div className="lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)]">
                <div className="relative aspect-square md:aspect-video lg:aspect-auto lg:h-full bg-white overflow-hidden select-none group rounded-none md:rounded-2xl border-b md:border border-stone-100 shadow-sm">
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
                                    className="w-full h-full object-contain bg-stone-50 cursor-zoom-in active:scale-105 transition-transform duration-500" 
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

                            {isAdmin && (
                                <div className="absolute bottom-4 left-4 flex gap-2 animate-fade-in z-20">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleToggleVisibility(); }}
                                        className={`p-2 backdrop-blur rounded-lg shadow transition-colors ${product.isHidden ? 'bg-red-500 text-white' : 'bg-white/90 text-stone-700 hover:text-green-600'}`}
                                        title={product.isHidden ? "Private (Hidden). Click to Make Public." : "Public. Click to Hide."}
                                    >
                                        {product.isHidden ? <EyeOff size={18}/> : <Eye size={18}/>}
                                    </button>
                                    
                                    <button onClick={(e) => { e.stopPropagation(); handlePrivateLink(); }} className="p-2 bg-white/90 backdrop-blur rounded-lg shadow text-stone-700 hover:text-gold-600" title="Copy Private Link"><LinkIcon size={18}/></button>
                                    <button onClick={(e) => { e.stopPropagation(); setIsEditing(!isEditing)} } className={`p-2 bg-white/90 backdrop-blur rounded-lg shadow text-stone-700 hover:text-gold-600 ${isEditing ? 'text-gold-600 ring-2 ring-gold-500' : ''}`} title="Edit Details"><Edit2 size={18}/></button>
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
                    <div className="bg-stone-900 p-3 rounded-b-xl flex items-center justify-around gap-4 text-white -mt-1 md:mt-0">
                        <button onClick={() => initiateAI('enhance')} className="flex flex-col items-center gap-1 text-[10px] font-bold uppercase tracking-widest hover:text-gold-500 transition"><Wand2 size={16}/> Enhance</button>
                        <button onClick={() => initiateAI('cleanup')} className="flex flex-col items-center gap-1 text-[10px] font-bold uppercase tracking-widest hover:text-gold-500 transition"><Eraser size={16}/> Cleanup</button>
                    </div>
                )}
            </div>

            {/* RIGHT COLUMN: Product Details */}
            <div className="p-6 md:p-0 space-y-8">
                <div>
                    <span className="text-gold-600 text-xs font-bold uppercase tracking-widest block mb-2">{product.category}</span>
                    {isEditing ? (
                        <input 
                            value={editForm.title || ''} 
                            onChange={e => setEditForm({...editForm, title: e.target.value})}
                            className="w-full font-serif text-3xl md:text-4xl text-stone-900 bg-white border-b border-gold-500 outline-none placeholder:text-stone-300"
                            placeholder="Product Title"
                        />
                    ) : (
                        <h1 className="font-serif text-3xl md:text-4xl text-stone-900 leading-tight">{product.title}</h1>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-stone-500 text-sm mt-4">
                        <span className="flex items-center gap-1 bg-stone-100 px-3 py-1 rounded-full text-xs font-bold uppercase"><Tag size={12}/> {product.subCategory || 'Bespoke'}</span>
                        <div className="h-1 w-1 bg-stone-300 rounded-full"></div>
                        {isEditing ? (
                            <div className="flex items-center gap-1">
                                <input 
                                    type="number" 
                                    value={editForm.weight || 0} 
                                    onChange={e => setEditForm({...editForm, weight: parseFloat(e.target.value)})}
                                    className="w-20 bg-white border-b border-gold-500 outline-none text-right font-mono"
                                />
                                <span>g</span>
                            </div>
                        ) : (
                            <span className={`font-mono ${isGuest ? 'blur-sm select-none opacity-50' : 'text-stone-700 font-bold'}`}>
                                {isGuest ? '00.00g' : `${product.weight}g`}
                            </span>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                    {[
                        { icon: Heart, label: 'Likes', val: stats.like, color: 'text-red-400', bg: 'bg-red-50 border-red-100' },
                        { icon: ShoppingBag, label: 'Inquiries', val: stats.inquiry, color: 'text-gold-600', bg: 'bg-gold-50 border-gold-100' },
                        { icon: Gem, label: 'Sold', val: stats.purchase, color: 'text-blue-500', bg: 'bg-blue-50 border-blue-100' },
                        { icon: BarChart2, label: 'Trend', val: 'High', color: 'text-stone-400', bg: 'bg-stone-50 border-stone-200' }
                    ].map((s, idx) => (
                        <div key={idx} className={`${s.bg} border rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-sm`}>
                            <s.icon size={20} className={`mb-2 ${s.color}`} />
                            <span className="font-bold text-stone-800 text-lg leading-none mb-1">{s.val}</span>
                            <span className="text-[9px] uppercase font-bold text-stone-400 tracking-wider">{s.label}</span>
                        </div>
                    ))}
                </div>

                <div className="prose prose-stone max-w-none">
                    <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2 mb-3"><Info size={16} /> Craftsmanship Story</h3>
                    {isEditing ? (
                        <textarea 
                            value={editForm.description || ''} 
                            onChange={e => setEditForm({...editForm, description: e.target.value})}
                            className="w-full h-40 p-4 bg-white border border-stone-200 rounded-xl focus:ring-1 focus:ring-gold-500 outline-none text-stone-600 leading-relaxed resize-none"
                        />
                    ) : (
                        <p className="text-stone-600 leading-relaxed font-light whitespace-pre-line text-lg">{product.description || "A bespoke masterpiece from the Sanghavi collection, crafted with precision and elegance."}</p>
                    )}
                </div>

                {/* Specs */}
                <div className="bg-stone-100 rounded-2xl p-6 space-y-4 border border-stone-200/50">
                    <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
                        <Info size={16} /> Technical Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-white rounded-lg text-stone-400 shadow-sm"><Calendar size={16} /></div>
                            <div>
                                <p className="text-[10px] font-bold uppercase text-stone-400 tracking-wide">Added On</p>
                                <p className={`text-sm font-medium text-stone-700 ${isGuest ? 'blur-sm select-none opacity-50' : ''}`}>
                                    {isGuest ? 'dd/mm/yyyy' : new Date(product.createdAt).toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                        {product.meta?.cameraModel && !isGuest && (
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-white rounded-lg text-stone-400 shadow-sm"><Camera size={16} /></div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase text-stone-400 tracking-wide">Captured On</p>
                                    <p className="text-sm font-medium text-stone-700">{product.meta.cameraModel}</p>
                                </div>
                            </div>
                        )}
                        {isAdmin && product.supplier && (
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-white rounded-lg text-stone-400 shadow-sm"><Package size={16} /></div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase text-stone-400 tracking-wide">Source</p>
                                    <p className="text-sm font-medium text-stone-700">{product.supplier}</p>
                                </div>
                            </div>
                        )}
                        {product.meta?.location && !isGuest && (
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-white rounded-lg text-stone-400 shadow-sm"><MapPin size={16} /></div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase text-stone-400 tracking-wide">Studio</p>
                                    <p className="text-sm font-medium text-stone-700">{product.meta.location}</p>
                                </div>
                            </div>
                        )}
                    </div>
                    {isGuest && (
                         <div className="bg-white/50 p-3 rounded-lg border border-dashed border-stone-300 flex items-center justify-center gap-2 text-stone-500 text-xs italic mt-2">
                             <Lock size={12}/> Detailed specifications are reserved for members.
                         </div>
                     )}
                </div>

                {product.tags && product.tags.length > 0 && !isGuest && (
                    <div className="flex flex-wrap gap-2">
                        {product.tags.map((tag, i) => (
                            <span key={i} className="px-3 py-1 bg-white border border-stone-200 rounded-full text-xs font-bold text-stone-500 uppercase tracking-wide shadow-sm">
                                #{tag}
                            </span>
                        ))}
                    </div>
                )}

                <div className="pt-4 sticky bottom-4 md:static z-20">
                    {isEditing ? (
                        <div className="flex gap-4">
                            <button onClick={() => setIsEditing(false)} className="flex-1 py-4 bg-stone-200 text-stone-600 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-stone-300 transition">Cancel</button>
                            <button onClick={handleSave} className="flex-1 py-4 bg-stone-900 text-white rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-gold-600 transition shadow-xl"><Save size={16}/> Save Changes</button>
                        </div>
                    ) : (
                        <button 
                            onClick={() => isGuest ? navigate('/login') : storeService.shareToWhatsApp(product)} 
                            className="w-full py-4 bg-gold-600 text-white rounded-xl font-bold shadow-xl shadow-gold-200/50 flex items-center justify-center gap-3 active:scale-[0.98] transition-all hover:bg-gold-700"
                        >
                            <MessageCircle size={22} /> 
                            <span className="uppercase tracking-widest text-sm">{isGuest ? 'Login to Inquire' : 'Inquire on WhatsApp'}</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
      </div>

      {/* MODALS */}
      {showFullScreen && displayImages.length > 0 && (
        <ImageViewer 
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
    </div>
  );
};
