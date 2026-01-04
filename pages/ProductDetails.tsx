
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Product, AppConfig, ProductSuggestion } from '../types';
import { ArrowLeft, Share2, MessageCircle, Info, Tag, Calendar, ChevronLeft, ChevronRight, Camera, Edit2, Lock, Check, Eye, EyeOff, Sparkles, Eraser, Wand2, Loader2, SlidersHorizontal, Download, Trash2, Cpu, Smartphone, Heart, ThumbsDown, Send, MessageSquare, LogIn, ShoppingBag, Gem, BarChart2, DollarSign, Image as ImageIcon } from 'lucide-react';
import { ImageViewer } from '../components/ImageViewer';
import { ImageEditor } from '../components/ImageEditor';
import { storeService, ProductStats } from '../services/storeService';
import { removeWatermark, enhanceJewelryImage } from '../services/geminiService';

export const ProductDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [currentUser] = useState(storeService.getCurrentUser());
  const isAuthorized = currentUser?.role === 'admin' || currentUser?.role === 'contributor';
  const isGuest = !currentUser;
  
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageSlideDirection, setImageSlideDirection] = useState<'left' | 'right' | null>(null);
  
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [showAiMenu, setShowAiMenu] = useState(false);
  const [pendingEnhancedImage, setPendingEnhancedImage] = useState<string | null>(null);
  const [compareSliderPos, setCompareSliderPos] = useState(50);
  const [isManualEditing, setIsManualEditing] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editDescValue, setEditDescValue] = useState('');

  // Interactions & Suggestions
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const [isOwned, setIsOwned] = useState(false);
  const [isRequested, setIsRequested] = useState(false);
  const [suggestionText, setSuggestionText] = useState('');
  const [isSubmittingSuggestion, setIsSubmittingSuggestion] = useState(false);
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Live Stats
  const [stats, setStats] = useState<ProductStats>({ like: 0, dislike: 0, inquiry: 0, purchase: 0 });

  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Time Tracking & Touch Refs
  const entryTime = useRef<number>(Date.now());
  const longPressTimer = useRef<any>(null);
  
  // Separate touch trackers to avoid collisions
  const pageTouchStart = useRef<{ x: number, y: number } | null>(null);
  const imageTouchStart = useRef<{ x: number, y: number } | null>(null);

  // Navigation Direction State for Page Transition
  const navDirection = location.state?.direction || 'none';

  useEffect(() => {
    // Reset state on ID change
    setCurrentImageIndex(0);
    setImageSlideDirection(null);
    entryTime.current = Date.now();
    setIsLoading(true);
    setProduct(null); // Clear previous product to avoid stagnant data
    
    // Check for FullScreen navigation intent
    if (location.state?.startFullScreen) {
        setShowFullScreen(true);
    }

    // 1. Screenshot Detection (Key Press)
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'PrintScreen' || (e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4'))) {
            if (product) storeService.logEvent('screenshot', product, currentUser, currentImageIndex);
        }
    };
    window.addEventListener('keyup', handleKeyDown);

    // 2. Fetch Single Product Data from Server (Lightweight Fetch)
    const fetchData = async () => {
      try {
        if (!id) return;
        
        // Fetch specific product + config concurrently
        const [fetchedProduct, conf] = await Promise.all([
            storeService.getProductById(id),
            storeService.getConfig()
        ]);
        setConfig(conf);
        
        if (fetchedProduct) {
            // Security Check
            let isAllowed = true;
            if (!isAuthorized) {
                if (fetchedProduct.isHidden) isAllowed = false;
                else {
                    const catConfig = conf.categories.find(c => c.name === fetchedProduct.category);
                    if (catConfig?.isPrivate) {
                        const unlockedCats = storeService.getUnlockedCategories();
                        const sharedCat = location.state?.sharedCategory;
                        if (!unlockedCats.includes(fetchedProduct.category) && sharedCat !== fetchedProduct.category) {
                            isAllowed = false;
                        }
                    }
                }
            }

            if (isAllowed) {
                setProduct(fetchedProduct);
                setEditDescValue(fetchedProduct.description);
                
                // Set Interactions
                setIsLiked(storeService.getLikes().includes(fetchedProduct.id));
                setIsDisliked(storeService.getDislikes().includes(fetchedProduct.id));
                setIsOwned(storeService.getOwned().includes(fetchedProduct.id));
                setIsRequested(storeService.getRequested().includes(fetchedProduct.id));
                
                // Fetch stats concurrently after product loads
                const [productStats, suggestionsList] = await Promise.all([
                    storeService.getProductStats(fetchedProduct.id),
                    isAuthorized ? storeService.getSuggestions(fetchedProduct.id) : Promise.resolve([])
                ]);
                setStats(productStats);
                if (suggestionsList) setSuggestions(suggestionsList);
                
                storeService.logEvent('view', fetchedProduct);
            } else {
                console.warn("Access denied: Product is private or hidden.");
                setProduct(null); 
            }
        } else {
             setProduct(null);
        }
        
      } catch (err) {
        console.error("Fetch details error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();

    return () => {
        window.removeEventListener('keyup', handleKeyDown);
        if (product) {
            const duration = Math.floor((Date.now() - entryTime.current) / 1000);
            if (duration > 2) { 
                storeService.logEvent('view', product, currentUser, currentImageIndex, duration);
            }
        }
    };
  }, [id, isAuthorized]); 

  // Smart Back Navigation
  const handleBack = () => {
    if (location.state?.sharedCategory) {
        navigate('/collection', { state: { sharedCategory: location.state.sharedCategory } });
        return;
    }
    if (isGuest && product) {
        const unlocked = storeService.getUnlockedCategories();
        if (unlocked.includes(product.category)) {
            navigate('/collection', { state: { sharedCategory: product.category } });
            return;
        }
    }
    navigate('/collection');
  };

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
        <p className="text-stone-500 mb-6 max-w-xs mx-auto">This item may be private, deleted, or you do not have the required access permissions.</p>
        <button onClick={handleBack} className="px-6 py-2 bg-stone-900 text-white rounded-xl">Back to Collection</button>
      </div>
    );
  }

  // Defensive array access & Guest Logic
  const allImages = Array.isArray(product.images) ? product.images : [];
  const allThumbnails = Array.isArray(product.thumbnails) ? product.thumbnails : [];
  const productTags = Array.isArray(product.tags) ? product.tags : [];

  const productImages = isGuest ? allImages.slice(0, 1) : allImages;
  const productThumbnails = isGuest ? allThumbnails.slice(0, 1) : allThumbnails;
  const hiddenCount = allImages.length - productImages.length;

  const getFullUrl = (path: string) => {
      if (!path) return '';
      if (path.startsWith('data:') || path.startsWith('http')) return path;
      const origin = window.location.origin;
      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      return `${origin}${cleanPath}`;
  };

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
      const updatedImages = [...allImages];
      const updatedThumbs = [...allThumbnails];
      
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
          let base64Data = '';
          
          if (currentImg.startsWith('data:')) {
             base64Data = currentImg.split(',')[1];
          } else {
             const fullUrl = getFullUrl(currentImg);
             const response = await fetch(fullUrl);
             if (!response.ok) throw new Error("Failed to fetch image source");
             const blob = await response.blob();
             base64Data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const res = reader.result as string;
                    resolve(res.split(',')[1]);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
             });
          }

          let newBase64 = action === 'clean' ? await removeWatermark(base64Data) : await enhanceJewelryImage(base64Data);
          if (newBase64) {
              setPendingEnhancedImage(`data:image/jpeg;base64,${newBase64}`);
          }
      } catch (error) {
          console.error("AI Action Failed:", error);
          alert("AI Processing Failed. Ensure the image is loaded and accessible.");
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
      storeService.logEvent('download', product, currentUser, currentImageIndex);
      const link = document.createElement('a');
      link.href = getFullUrl(productImages[currentImageIndex]);
      link.download = `sanghavi-${product.title.replace(/\s+/g, '-').toLowerCase()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleInquiry = async () => {
      if (isGuest) {
          if(confirm("To inquire about pricing and customization, please login.")) {
              navigate('/login', { state: { from: location.pathname } });
          }
          return;
      }
      if (!product) return;
      const requested = storeService.toggleRequested(product.id);
      setIsRequested(requested);
      setStats(prev => ({...prev, inquiry: requested ? prev.inquiry + 1 : Math.max(0, prev.inquiry - 1)}));
      if (requested) await storeService.shareToWhatsApp(product, currentImageIndex);
  };

  const handleMarkAsSold = async () => {
      if (!product) return;
      if (confirm("Record a new manual sale? This increments the global 'Purchased' counter.")) {
          await storeService.logEvent('sold', product);
          setStats(prev => ({...prev, purchase: prev.purchase + 1}));
      }
  };

  const toggleLike = () => {
      if (!product) return;
      if (isDisliked) {
          storeService.toggleDislike(product.id);
          setIsDisliked(false);
          setStats(prev => ({...prev, dislike: Math.max(0, prev.dislike - 1)}));
      }
      const liked = storeService.toggleLike(product.id);
      setIsLiked(liked);
      setStats(prev => ({...prev, like: liked ? prev.like + 1 : Math.max(0, prev.like - 1)}));
      if (liked) storeService.logEvent('like', product);
  };

  const toggleDislike = () => {
      if (!product) return;
      if (isLiked) {
          storeService.toggleLike(product.id);
          setIsLiked(false);
          setStats(prev => ({...prev, like: Math.max(0, prev.like - 1)}));
      }
      const disliked = storeService.toggleDislike(product.id);
      setIsDisliked(disliked);
      setStats(prev => ({...prev, dislike: disliked ? prev.dislike + 1 : Math.max(0, prev.dislike - 1)}));
      if (disliked) storeService.logEvent('dislike', product);
  };

  const toggleOwned = () => {
      if (!product || isGuest) {
        if(isGuest && confirm("Login to add this to your collection?")) {
            navigate('/login', { state: { from: location.pathname } });
        }
        return;
      }
      const owned = storeService.toggleOwned(product.id);
      setIsOwned(owned);
      setStats(prev => ({...prev, purchase: owned ? prev.purchase + 1 : Math.max(0, prev.purchase - 1)}));
      if (owned) storeService.logEvent('sold', product);
  };

  const submitSuggestion = async () => {
      if (!suggestionText.trim() || !product) return;
      setIsSubmittingSuggestion(true);
      try {
          await storeService.submitSuggestion(product.id, suggestionText);
          setSuggestionText('');
          alert("Thank you! Your feedback helps us craft better jewelry.");
      } catch (e) {
          alert("Failed to send suggestion.");
      } finally {
          setIsSubmittingSuggestion(false);
      }
  };

  // --- SPLIT TOUCH HANDLERS START ---
  const handleImageTouchStart = (e: React.TouchEvent) => {
      e.stopPropagation(); 
      imageTouchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      longPressTimer.current = setTimeout(() => {
          if(product) storeService.logEvent('long_press', product, currentUser, currentImageIndex);
      }, 700);
  };

  const handleImageTouchEnd = (e: React.TouchEvent) => {
      e.stopPropagation(); 
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      if (!imageTouchStart.current) return;
      const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
      const dx = touchEnd.x - imageTouchStart.current.x;
      const dy = touchEnd.y - imageTouchStart.current.y;

      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
          if (pendingEnhancedImage) return; 
          if (productImages.length > 1) {
              if (dx > 0) {
                  if (currentImageIndex > 0) {
                      setImageSlideDirection('right');
                      setCurrentImageIndex(prev => prev - 1);
                      if (navigator.vibrate) navigator.vibrate(10);
                  }
              } else {
                  if (currentImageIndex < productImages.length - 1) {
                      setImageSlideDirection('left');
                      setCurrentImageIndex(prev => prev + 1);
                      if (navigator.vibrate) navigator.vibrate(10);
                  }
              }
          }
      }
      imageTouchStart.current = null;
  };

  const handlePageTouchStart = (e: React.TouchEvent) => {
    pageTouchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handlePageTouchEnd = (e: React.TouchEvent) => {
    if (!pageTouchStart.current) return;
    const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    const dx = touchEnd.x - pageTouchStart.current.x;
    // Removed Next/Prev Product nav in Single Product view because we don't have the full list context easily available anymore
    // or it requires complex state management. For speed, we rely on Gallery nav.
    // If client insists on next/prev, we need to pass IDs or fetch next/prev ID from server.
    // For now, removing to keep it lightweight as per request.
    pageTouchStart.current = null;
  };
  // --- SPLIT TOUCH HANDLERS END ---

  const displayPreview = getFullUrl(productImages[currentImageIndex] || productThumbnails[currentImageIndex]);
  const transitionClass = 'animate-in fade-in duration-500';

  return (
    <div 
        className="min-h-screen bg-stone-50 overflow-y-auto pb-20 overflow-x-hidden"
        onTouchStart={handlePageTouchStart} 
        onTouchEnd={handlePageTouchEnd}
        onContextMenu={(e) => {
             if(product) storeService.logEvent('screenshot', product, currentUser, currentImageIndex);
        }}
    >
      {/* Custom Styles for Apple-like Slide Transitions */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(30px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideInLeft {
          from { transform: translateX(-30px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in-right { animation: slideInRight 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
        .animate-slide-in-left { animation: slideInLeft 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
      `}</style>

      {showFullScreen && (
          <ImageViewer 
              images={productImages.map(getFullUrl)} 
              initialIndex={currentImageIndex} 
              title={product.title} 
              onClose={() => setShowFullScreen(false)}
          />
      )}
      
      {isManualEditing && <ImageEditor imageSrc={getFullUrl(productImages[currentImageIndex])} onSave={handleManualSave} onCancel={() => setIsManualEditing(false)} />}

      <div className="bg-white/80 backdrop-blur-md border-b border-stone-200 px-4 h-16 flex items-center justify-between sticky top-0 z-30">
        <button onClick={handleBack} className="p-2 -ml-2 text-stone-600 hover:bg-stone-100 rounded-full transition-colors"><ArrowLeft size={24} /></button>
        <div className="flex-1 flex items-center gap-2 px-2 overflow-hidden">
            {product.isHidden && <Lock size={14} className="text-red-500 shrink-0" />}
            <h2 className="font-serif font-bold text-stone-800 text-lg truncate break-words">
                {product.title}
            </h2>
        </div>
        <div className="flex gap-1 shrink-0">
            <button onClick={handleDownload} className="p-2 text-stone-600 hover:text-gold-600 rounded-full hover:bg-stone-100"><Download size={20} /></button>
            <button onClick={() => { 
                storeService.logEvent('screenshot', product, currentUser, currentImageIndex); 
                navigator.share?.({ title: product.title, url: window.location.href }); 
            }} className="p-2 text-stone-600 hover:text-gold-600 rounded-full hover:bg-stone-100"><Share2 size={20} /></button>
        </div>
      </div>

      <div key={product.id} className={transitionClass}>
          <div 
            ref={imageContainerRef} 
            className="relative aspect-square md:aspect-video bg-stone-200 overflow-hidden group select-none image-nav-container" 
            onTouchStart={handleImageTouchStart} // Isolated Image Swipe
            onTouchEnd={handleImageTouchEnd}     // Isolated Image Swipe
            onMouseMove={(e) => pendingEnhancedImage && handleSliderMove(e.clientX)}
            onTouchMove={(e) => {
                if(pendingEnhancedImage) handleSliderMove(e.touches[0].clientX);
            }}
          >
            {displayPreview && (
              <img 
                key={`${product.id}-${currentImageIndex}`} 
                src={displayPreview} 
                className={`w-full h-full object-cover ${isProcessingImage ? 'opacity-50 blur-sm' : ''} ${imageSlideDirection === 'left' ? 'animate-in slide-in-from-right duration-300' : imageSlideDirection === 'right' ? 'animate-in slide-in-from-left duration-300' : ''}`} 
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
                            const nextImgs = [...allImages]; 
                            const nextThumbs = [...allThumbnails];
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

            {!pendingEnhancedImage && (
                <>
                    {/* Guest Locked Badge */}
                    {isGuest && hiddenCount > 0 && (
                       <button 
                         onClick={() => navigate('/login', { state: { from: location.pathname } })}
                         className="absolute bottom-4 right-4 z-20 bg-black/70 backdrop-blur text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 border border-white/10 hover:bg-gold-600 transition-colors shadow-lg animate-pulse"
                       >
                           <Lock size={12} /> +{hiddenCount} Photos Locked
                       </button>
                    )}

                    {/* Image Nav Dots (Only if multiple images) */}
                    {!isGuest && productImages.length > 1 && (
                        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-20">
                            {productImages.map((_, idx) => (
                                <button
                                    key={idx}
                                    onClick={(e) => { 
                                        e.stopPropagation(); 
                                        setImageSlideDirection(idx > currentImageIndex ? 'left' : 'right');
                                        setCurrentImageIndex(idx); 
                                    }}
                                    className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentImageIndex ? 'w-6 bg-gold-500 shadow-sm' : 'w-1.5 bg-white/60'}`}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}
            
            {!pendingEnhancedImage && (
                <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
                    <button onClick={toggleLike} className={`p-3 rounded-full backdrop-blur shadow-sm transition-all ${isLiked ? 'bg-red-500 text-white' : 'bg-white/70 text-stone-400 hover:text-red-500'}`}>
                         <Heart size={20} fill={isLiked ? "currentColor" : "none"} />
                    </button>
                    <button onClick={toggleDislike} className={`p-3 rounded-full backdrop-blur shadow-sm transition-all ${isDisliked ? 'bg-stone-800 text-white' : 'bg-white/70 text-stone-400 hover:text-stone-800'}`}>
                         <ThumbsDown size={20} fill={isDisliked ? "currentColor" : "none"} />
                    </button>
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

             {/* Live Market Sentiment Stats */}
             <div className="mb-4">
                <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 flex items-center gap-2"><BarChart2 size={12}/> Live Market Insights</h3>
                <div className="grid grid-cols-4 gap-2 md:gap-4">
                    <button onClick={toggleLike} className={`border rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-sm transition-all ${isLiked ? 'bg-red-50 border-red-200' : 'bg-white/60 border-stone-200 hover:bg-stone-50'}`}>
                        <Heart size={18} className="mb-1 transition-colors" fill={isLiked ? "currentColor" : "none"} color={isLiked ? "#ef4444" : "#9ca3af"} />
                        <span className={`font-bold text-lg leading-none ${isLiked ? 'text-red-600' : 'text-stone-800'}`}>{stats.like}</span>
                        <span className="text-[9px] uppercase font-bold text-stone-400">Likes</span>
                    </button>
                    
                    <button onClick={toggleDislike} className={`border rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-sm transition-all ${isDisliked ? 'bg-stone-100 border-stone-300' : 'bg-white/60 border-stone-200 hover:bg-stone-50'}`}>
                        <ThumbsDown size={18} className={`mb-1 transition-colors ${isDisliked ? 'text-stone-800' : 'text-stone-400'}`} fill={isDisliked ? "currentColor" : "none"}/>
                        <span className={`font-bold text-lg leading-none ${isDisliked ? 'text-stone-900' : 'text-stone-800'}`}>{stats.dislike}</span>
                        <span className="text-[9px] uppercase font-bold text-stone-400">Dislikes</span>
                    </button>
                    
                    <button onClick={handleInquiry} className={`border rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-sm transition-all ${isRequested ? 'bg-gold-50 border-gold-200' : 'bg-white/60 border-stone-200 hover:bg-stone-50'}`}>
                        <ShoppingBag size={18} className={`mb-1 transition-colors ${isRequested ? 'text-gold-600' : 'text-stone-400'}`} fill={isRequested ? "currentColor" : "none"} />
                        <span className={`font-bold text-lg leading-none ${isRequested ? 'text-gold-700' : 'text-stone-800'}`}>{stats.inquiry}</span>
                        <span className="text-[9px] uppercase font-bold text-stone-400">{isRequested ? 'Added' : 'Will Buy'}</span>
                    </button>
                    
                    <button onClick={toggleOwned} className={`border rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-sm transition-all ${isOwned ? 'bg-blue-50 border-blue-200' : 'bg-white/60 border-stone-200 hover:bg-stone-50'}`}>
                        <Gem size={18} className={`mb-1 transition-colors ${isOwned ? 'text-blue-500' : 'text-stone-400'}`} fill={isOwned ? "currentColor" : "none"} />
                        <span className={`font-bold text-lg leading-none ${isOwned ? 'text-blue-700' : 'text-stone-800'}`}>{stats.purchase}</span>
                        <span className="text-[9px] uppercase font-bold text-stone-400">{isOwned ? 'Owned' : 'Purchased'}</span>
                    </button>
                </div>
             </div>

             {/* Admin and Content Sections */}
             {isAuthorized && (
                 <div className="bg-stone-800 p-4 rounded-xl text-white space-y-4">
                     <div className="flex justify-between items-center"><h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider flex items-center gap-2"><Lock size={12} /> Authorized Control</h3><button onClick={handleDeleteProduct} className="text-red-400 hover:text-red-300 text-[10px] font-bold uppercase flex items-center gap-1"><Trash2 size={12}/> Delete</button></div>
                     <button onClick={handleMarkAsSold} className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium flex items-center justify-center gap-2 transition"><DollarSign size={16}/> Record Manual Sale (+1)</button>
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
                     <button onClick={() => setShowSuggestions(!showSuggestions)} className="w-full py-2 bg-stone-700 rounded text-sm font-medium flex items-center justify-center gap-2">
                         <MessageSquare size={16} /> View Client Suggestions ({suggestions.length})
                     </button>
                     {showSuggestions && (
                         <div className="bg-stone-900 rounded-xl p-4 max-h-60 overflow-y-auto space-y-3">
                             {suggestions.length === 0 ? <p className="text-stone-500 text-xs italic">No suggestions yet.</p> : suggestions.map(s => (
                                 <div key={s.id} className="bg-stone-800 p-3 rounded-lg text-xs">
                                     <div className="flex justify-between text-stone-400 mb-1"><span className="font-bold">{s.userName} ({s.userPhone})</span><span>{new Date(s.createdAt).toLocaleDateString()}</span></div>
                                     <p className="text-stone-300">{s.suggestion}</p>
                                 </div>
                             ))}
                         </div>
                     )}
                 </div>
             )}

             <div className="flex gap-4 border-b border-stone-100 pb-6">
                <button 
                  onClick={handleInquiry} 
                  className={`flex-1 py-3.5 rounded-xl font-medium shadow-lg flex items-center justify-center gap-2 transition-colors ${isGuest ? 'bg-stone-200 text-stone-500 hover:bg-stone-300' : 'bg-gold-600 text-white hover:bg-gold-700'}`}
                >
                  {isGuest ? <LogIn size={20} /> : <MessageCircle size={20} />} 
                  {isGuest ? 'Login to Inquire' : 'Inquire via WhatsApp'}
                </button>
             </div>

             <div className="prose prose-stone">
                 <h3 className="text-sm font-bold text-stone-400 uppercase tracking-wider flex items-center justify-between gap-2 mb-2"><span className="flex items-center gap-2"><Info size={16} /> Description</span>{isAuthorized && <button onClick={() => { if(isEditingDescription) handleSaveDescription(); else setIsEditingDescription(true); }} className="p-1 hover:bg-stone-100 rounded text-gold-600 transition">{isEditingDescription ? <Check size={16} /> : <Edit2 size={16} />}</button>}</h3>
                 {isEditingDescription ? <div className="space-y-2"><textarea value={editDescValue} onChange={(e) => setEditDescValue(e.target.value)} className="w-full p-4 border border-gold-300 rounded-xl text-stone-700 min-h-[120px]" /><div className="flex justify-end gap-2"><button onClick={() => { setIsEditingDescription(false); setEditDescValue(product.description); }} className="px-4 py-1 text-xs text-stone-400 uppercase">Cancel</button><button onClick={handleSaveDescription} className="px-4 py-1 text-xs text-gold-600 border border-gold-200 rounded-lg">Apply</button></div></div> : <p className="text-stone-600 leading-relaxed text-lg font-light">{product.description}</p>}
             </div>
             
             {!isAuthorized && currentUser && (
                 <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm mt-4">
                     <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Sparkles size={14} className="text-gold-500" /> Suggest Customization</h4>
                     <textarea value={suggestionText} onChange={(e) => setSuggestionText(e.target.value)} placeholder="Love this? Tell us if you'd prefer it in Rose Gold, Diamond cut variations, or other changes..." className="w-full p-3 bg-stone-50 border border-stone-100 rounded-lg text-sm text-stone-800 focus:border-gold-300 outline-none min-h-[80px]" />
                     <div className="flex justify-end mt-2"><button onClick={submitSuggestion} disabled={isSubmittingSuggestion || !suggestionText.trim()} className="px-4 py-2 bg-stone-900 text-white text-xs font-bold uppercase tracking-widest rounded-lg flex items-center gap-2 hover:bg-stone-800 disabled:opacity-50 transition">{isSubmittingSuggestion ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Send Feedback</button></div>
                 </div>
             )}

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
