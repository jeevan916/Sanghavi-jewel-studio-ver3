
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ProductCard } from '@/components/ProductCard.tsx';
import { storeService, CuratedCollections } from '@/services/storeService.ts';
import { localAIVisualEngine } from '@/services/localAIVisualEngine.ts';
import { Search, LayoutGrid, RectangleVertical, Clock, Heart, Loader2, Lock, User, RefreshCw, TrendingUp, Gem, ChevronRight, X, Sparkles, MessageCircle, Camera, Upload } from 'lucide-react';
import { Product, AppConfig } from '@/types.ts';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor.ts';

const ProductSkeleton = () => (
  <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-stone-100 animate-pulse">
    <div className="aspect-[3/4] bg-stone-100" />
    <div className="p-4 space-y-3">
      <div className="flex justify-between">
        <div className="h-3 w-20 bg-stone-100 rounded" />
        <div className="h-3 w-12 bg-stone-100 rounded" />
      </div>
      <div className="h-4 w-full bg-stone-100 rounded" />
      <div className="h-3 w-2/3 bg-stone-100 rounded" />
    </div>
  </div>
);

export const Gallery: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [products, setProducts] = useState<Product[]>([]);
  const [curated, setCurated] = useState<CuratedCollections>({ latest: [], loved: [], trending: [], ideal: [] });
  const [config, setConfig] = useState<AppConfig | null>(null);
  
  // Filtering State (Persisted)
  const getPersisted = (key: string, def: string) => {
      const stateVal = (location.state as any)?.[key];
      if (stateVal) return stateVal;
      try { return sessionStorage.getItem(`gallery_${key}`) || def; } catch { return def; }
  };

  const [activeCategory, _setActiveCategory] = useState<string>(getPersisted('category', 'All'));
  const [activeSubCategory, _setActiveSubCategory] = useState<string>(getPersisted('subCategory', 'All'));
  const [search, _setSearch] = useState<string>(getPersisted('search', ''));
  const [viewMode, setViewMode] = useState<'grid' | 'detail'>('grid');

  const setActiveCategory = (val: string) => {
      _setActiveCategory(val);
      sessionStorage.setItem('gallery_category', val);
  };
  const setActiveSubCategory = (val: string) => {
      _setActiveSubCategory(val);
      sessionStorage.setItem('gallery_subCategory', val);
  };
  const setSearch = (val: string) => {
      _setSearch(val);
      sessionStorage.setItem('gallery_search', val);
  };
  
  // Image Search State
  const [isImageSearchOpen, setIsImageSearchOpen] = useState(false);
  const [searchImageBase64, setSearchImageBase64] = useState<string | null>(null);
  const [isSearchingImage, setIsSearchingImage] = useState(false);
  const [imageSearchResults, setImageSearchResults] = useState<any[] | null>(null);
  const [imageSearchAnalysis, setImageSearchAnalysis] = useState<string | null>(null);
  const [imageSearchError, setImageSearchError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchMode, setSearchMode] = useState<'cloud' | 'local'>('cloud');
  const [imageSearchCategory, setImageSearchCategory] = useState<string>('all');
  const [trainingProgress, setTrainingProgress] = useState<number | null>(null);
  const [localStatus, setLocalStatus] = useState({ isTrained: false, indexSize: 0 });

  // Update local engine status when modal opens or shifts
  useEffect(() => {
    if (isImageSearchOpen) {
      setLocalStatus(localAIVisualEngine.getStatus());
    }
  }, [isImageSearchOpen]);

  const handleTrainLocalEngine = async () => {
    try {
      setTrainingProgress(0);
      setImageSearchError(null);
      // Fetch entire catalog (up to 1000 items) for indexing
      const allCatalogRes = await storeService.getProducts(1, 1000, { publicOnly: !isAdmin });
      const allCatalog = allCatalogRes.items || [];
      await localAIVisualEngine.train(allCatalog, (pct) => setTrainingProgress(pct));
      setLocalStatus(localAIVisualEngine.getStatus());
    } catch (err: any) {
      setImageSearchError("Training error: " + (err.message || err));
    } finally {
      setTrainingProgress(null);
    }
  };

  const performImageSearch = async (base64: string, mode: 'cloud' | 'local', category: string) => {
    setIsSearchingImage(true);
    setImageSearchResults(null);
    setImageSearchAnalysis(null);
    setImageSearchError(null);

    try {
      if (mode === 'cloud') {
        const response = await fetch('/api/public-ai/search-by-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64Image: base64 })
        });
        const resData = await response.json();
        if (resData.success) {
          setImageSearchResults(resData.matches);
          setImageSearchAnalysis(resData.analysis);
        } else {
          setImageSearchError(resData.error || 'Failed to search catalog.');
        }
      } else {
        // Local Visual Search Engine
        // 1. Fetch entire catalog to ensure full offline search index is populated
        const allCatalogRes = await storeService.getProducts(1, 1000, { publicOnly: !isAdmin });
        const allCatalog = allCatalogRes.items || [];
        
        // 2. Ensure model has been trained
        const status = localAIVisualEngine.getStatus();
        if (!status.isTrained) {
          setTrainingProgress(0);
          await localAIVisualEngine.train(allCatalog, (pct) => setTrainingProgress(pct));
          setTrainingProgress(null);
          setLocalStatus(localAIVisualEngine.getStatus());
        }

        // 3. Match offline using visual characteristics, aspect analysis, and target category lock
        const localResults = await localAIVisualEngine.searchByImage(base64, allCatalog, category);
        setImageSearchResults(localResults.matches);
        setImageSearchAnalysis(localResults.analysis);
      }
    } catch (err: any) {
      setImageSearchError(err.message || 'An unexpected error occurred during search.');
    } finally {
      setIsSearchingImage(false);
      setTrainingProgress(null);
    }
  };

  // Re-run search if user switches mode or changes the design category filter while an image is loaded
  useEffect(() => {
    if (searchImageBase64) {
      performImageSearch(searchImageBase64, searchMode, imageSearchCategory);
    }
  }, [searchMode, imageSearchCategory]);

  const handleImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setImageSearchError('Please select a valid image file.');
      return;
    }
    setImageSearchError(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      setSearchImageBase64(base64);
      performImageSearch(base64, searchMode, imageSearchCategory);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageFile(e.dataTransfer.files[0]);
    }
  };

  const resetImageSearch = () => {
    setSearchImageBase64(null);
    setImageSearchResults(null);
    setImageSearchAnalysis(null);
    setImageSearchError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  
  // Pagination State
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const observer = useRef<IntersectionObserver | null>(null);
  
  // Initial Load State
  const [isLoading, setIsLoading] = useState(true);
  usePerformanceMonitor('Gallery', isLoading);

  const user = storeService.getCurrentUser();
  const isAdmin = user?.role === 'admin' || user?.role === 'contributor';
  const isGuest = !user;
  const GUEST_VIEW_LIMIT = 8;
  const BATCH_SIZE = 24; // Scalable batch size

  // WhatsApp Subscription States
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user?.phone) {
      storeService.checkWhatsAppSubscriptionStatus(user.phone).then(res => {
        setIsSubscribed(res.subscribed);
      });
    }
  }, [user]);

  const handleToggleSubscription = async () => {
    if (!user?.phone) return;

    setIsSubmitting(true);
    try {
      const newStatus = !isSubscribed;
      await storeService.subscribeWhatsApp(user.name || 'Valued Customer', user.phone, newStatus);
      setIsSubscribed(newStatus);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Initial Data Setup (Config + Curated)
  useEffect(() => {
    const initializeGallery = async () => {
        // Use Cache for instant render of structure
        const cached = storeService.getCached();
        if (cached.config) setConfig(cached.config);
        if (cached.curated && cached.curated.latest.length > 0) {
            setCurated(cached.curated);
            setIsLoading(false);
        }

        try {
            const [conf, cur] = await Promise.all([
                storeService.getConfig().catch(() => null),
                storeService.getCuratedProducts().catch(() => ({ latest: [], loved: [], trending: [], ideal: [] }))
            ]);
            
            if (conf) setConfig(conf);
            if (cur) setCurated(cur);

        } catch (e) {
            console.error("Gallery Sync failed", e);
        } finally {
            setIsLoading(false);
        }
    };
    initializeGallery();
  }, []);

  // 2. Fetch Products (Reset on filter change)
  const fetchProducts = useCallback(async (reset = false) => {
      // Don't fetch grid products if we are in 'All' mode without search (Overview Mode)
      if (activeCategory === 'All' && !search) return;

      if (!reset && (!hasMore || isFetchingMore)) return;
      
      const targetPage = reset ? 1 : page + 1;
      setIsFetchingMore(true);
      
      const fetchFilters = {
          publicOnly: !isAdmin,
          category: (activeCategory !== 'All' && activeCategory !== 'Latest') ? activeCategory : undefined,
          subCategory: activeSubCategory !== 'All' ? activeSubCategory : undefined,
          search: search || undefined
      };

      if (reset) {
          const syncCached = storeService.getCachedProductsSync(1, BATCH_SIZE, fetchFilters);
          if (syncCached) {
              setProducts(syncCached.items);
              setPage(1);
              setHasMore(syncCached.items.length === BATCH_SIZE);
              setIsLoading(false);
          } else {
              setIsLoading(true);
              setProducts([]);
          }
      }

      try {
          // Optimized Fetch: Only gets what we need based on category/search
          const res = await storeService.getProducts(targetPage, BATCH_SIZE, fetchFilters);
          
          if (res.items && res.items.length > 0) {
              setProducts(prev => reset ? res.items : [...prev, ...res.items]);
              setPage(targetPage);
              setHasMore(res.items.length === BATCH_SIZE);
          } else {
              setHasMore(false);
              if (reset) setProducts([]);
          }
      } catch (e) {
          console.error("Fetch failed", e);
      } finally {
          setIsFetchingMore(false);
          setIsLoading(false);
      }
  }, [page, hasMore, isFetchingMore, activeCategory, activeSubCategory, search]);

  // Trigger fetch when category or search changes
  useEffect(() => {
      setPage(0);
      setHasMore(true);
      fetchProducts(true);
  }, [activeCategory, activeSubCategory, search]);

  useEffect(() => {
      const state = location.state as any;
      if (state) {
          if (state.category && state.category !== activeCategory) setActiveCategory(state.category);
          if (state.subCategory && state.subCategory !== activeSubCategory) setActiveSubCategory(state.subCategory);
          if (state.search && state.search !== search) setSearch(state.search);
      }
  }, [location.state]);

  // 3. Infinite Scroll Observer
  useEffect(() => {
    return () => {
      if (observer.current) observer.current.disconnect();
    };
  }, []);

  const lastProductElementRef = useCallback((node: HTMLDivElement) => {
      if (isFetchingMore) return;
      if (observer.current) observer.current.disconnect();
      
      observer.current = new IntersectionObserver(entries => {
          if (entries[0].isIntersecting && hasMore) {
              fetchProducts(false);
          }
      });
      
      if (node) observer.current.observe(node);
  }, [isFetchingMore, hasMore, fetchProducts]);

  const navigateToProduct = useCallback((productId: string) => {
    if (navigator.vibrate) navigator.vibrate(10);
    navigate(`/product/${productId}`, {
        state: {
            fromGallery: true,
            category: activeCategory,
            subCategory: activeSubCategory,
            search: search
        }
    });
  }, [navigate, activeCategory, activeSubCategory, search]);

  const unlockedCats = useMemo(() => storeService.getUnlockedCategories(), []);
  const isCategoryUnlocked = unlockedCats.includes(activeCategory);
  
  const categoryList = (config?.categories || [])
    .filter(c => !isGuest || !c.isPrivate || unlockedCats.includes(c.name))
    .map(c => c.name);

  const subCategoryList = useMemo(() => {
    if (activeCategory === 'All' || activeCategory === 'Latest') return [];
    const cat = config?.categories.find(c => c.name === activeCategory);
    return cat ? ['All', ...cat.subCategories] : ['All'];
  }, [activeCategory, config]);

  useEffect(() => {
    // Only reset if it's not a direct navigation from product details or initial load
    // Actually we can simply check if the subCategory is valid for the current category, 
    // but the easiest is only resetting it when user clicks a new category manually,
    // rather than resetting on every category change.
    // We will handle this by only clearing if the current subcat is not in the new list.
  }, [activeCategory]);

  const isOverviewMode = activeCategory === 'All' && !search;

  return (
    <div className="min-h-screen bg-stone-50 pb-20 overflow-x-hidden animate-fade-in">
      <div className="sticky top-0 md:top-24 bg-white/80 backdrop-blur-xl border-b border-stone-100 z-40 transition-all duration-500">
        <div className="max-w-7xl mx-auto p-4">
            <div className="px-2 md:px-6 min-h-14 py-2 flex items-center justify-between gap-3 md:gap-6">
                <div className="flex-1 max-w-xl relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300 group-focus-within:text-brand-gold transition-colors" size={22} />
                    <input 
                      type="text" 
                      placeholder="Search the Vault..." 
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-12 pr-12 py-3 bg-stone-50 border border-stone-100 rounded-2xl text-sm focus:ring-2 focus:ring-brand-gold/20 focus:bg-white outline-none transition-all font-sans placeholder:text-stone-300"
                    />
                    <button
                      onClick={() => setIsImageSearchOpen(true)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-300 hover:text-brand-gold active:scale-95 transition-all p-1"
                      title="Search by Image (AI Match)"
                    >
                      <Camera size={22} />
                    </button>
                </div>
                
                {config?.goldRate22k ? (
                    <div className="flex flex-col items-end justify-center gap-1 shrink-0">
                        <div className="flex flex-col items-end justify-center bg-stone-50 px-3 md:px-4 py-1 md:py-1.5 rounded-xl border border-stone-100 whitespace-nowrap">
                            <span className="text-[8px] md:text-[9px] font-bold uppercase tracking-widest text-stone-400">22k Gold</span>
                            <span className="text-xs md:text-sm font-bold text-brand-gold font-mono">₹{config.goldRate22k.toLocaleString('en-IN')}/g</span>
                        </div>
                        {user && user.role === 'customer' && user.phone ? (
                            <button
                                onClick={handleToggleSubscription}
                                disabled={isSubmitting}
                                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest transition-all border ${
                                    isSubscribed 
                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' 
                                    : 'bg-stone-50 text-stone-400 border-stone-200 hover:border-emerald-300 hover:text-emerald-500'
                                }`}
                                title="Receive automated gold rate updates on WhatsApp daily twice a day"
                            >
                                <MessageCircle size={10} className={isSubscribed ? 'text-emerald-500 animate-pulse' : 'text-stone-400'} />
                                <span>{isSubscribed ? 'Subscribed' : 'Alert on WhatsApp'}</span>
                            </button>
                        ) : null}
                    </div>
                ) : null}

                {!isOverviewMode && (
                    <button 
                    onClick={() => setViewMode(v => v === 'grid' ? 'detail' : 'grid')} 
                    className="p-3 text-stone-300 hover:text-brand-gold hover:bg-stone-50 rounded-xl transition-all shrink-0"
                    title={viewMode === 'grid' ? "Switch to Large View" : "Switch to Grid View"}
                    >
                        {viewMode === 'grid' ? <RectangleVertical size={29}/> : <LayoutGrid size={29}/>}
                    </button>
                )}
            </div>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide px-2 md:px-6 pb-2 pt-2">
                {[{id: 'All', label: 'Overview'}, {id: 'Latest', label: 'Latest'}, ...categoryList.map(c => ({id: c, label: c}))].map(cat => (
                <button
                    key={cat.id}
                    onClick={() => {
                        setActiveCategory(cat.id);
                        setActiveSubCategory('All');
                    }}
                    className={`px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] transition-all whitespace-nowrap border ${
                      activeCategory === cat.id ? 'bg-brand-dark text-white border-brand-dark shadow-xl' : 'bg-white text-stone-400 border-stone-100 hover:border-brand-gold/30 hover:text-brand-gold'
                    }`}
                >
                    {cat.label}
                </button>
                ))}
                
                {isGuest && (
                    <button onClick={() => navigate('/login')} className="px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] bg-brand-gold/5 text-brand-gold border border-brand-gold/20 flex items-center gap-2 whitespace-nowrap hover:bg-brand-gold/10 transition-colors">
                        <Lock size={14} /> Unlock More
                    </button>
                )}
            </div>
            {/* Sub-category Filter */}
            {!isOverviewMode && subCategoryList.length > 1 && (
                <div className="px-2 md:px-6 py-2 flex gap-2 overflow-x-auto scrollbar-hide">
                    {subCategoryList.map(sub => (
                        <button
                            key={sub}
                            onClick={() => setActiveSubCategory(sub)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${activeSubCategory === sub ? 'bg-brand-gold text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}
                        >
                            {sub}
                        </button>
                    ))}
                </div>
            )}
        </div>
      </div>

      <main className="max-w-7xl mx-auto pt-8 px-4 sm:px-8 lg:px-12">
        {/* OVERVIEW MODE: Sections Only */}
        {isOverviewMode ? (
            <div className="space-y-16 md:space-y-24 pb-12 animate-fade-in">
                {/* 1. New Arrivals (Horizontal) */}
                {(isLoading && curated.latest.length === 0) ? (
                    <section>
                        <div className="flex items-center justify-between mb-8">
                            <div className="h-8 w-48 bg-stone-200 rounded animate-pulse" />
                        </div>
                        <div className="flex gap-6 md:gap-8 overflow-x-auto pb-8 scrollbar-hide">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="w-64 md:w-72 shrink-0">
                                    <ProductSkeleton />
                                </div>
                            ))}
                        </div>
                    </section>
                ) : curated.latest.length > 0 && (
                    <section>
                        <div className="flex items-center justify-between mb-8">
                            <div className="space-y-1">
                                <h3 className="font-sans text-2xl md:text-3xl font-bold flex items-center gap-3 text-brand-dark uppercase tracking-tighter">
                                    <Clock size={29} className="text-brand-gold" /> New Arrivals
                                </h3>
                                <p className="text-[10px] text-stone-400 uppercase tracking-[0.3em] font-bold ml-9">The Latest From Our Studio</p>
                            </div>
                            <button onClick={() => { setActiveCategory('Latest'); setActiveSubCategory('All'); }} className="text-[10px] font-bold uppercase tracking-widest text-brand-gold flex items-center gap-1 hover:gap-2 transition-all">
                                View All <ChevronRight size={17} />
                            </button>
                        </div>
                        <div className="flex gap-6 md:gap-8 overflow-x-auto pb-8 scrollbar-hide snap-x">
                            {curated.latest.slice(0, isGuest ? 8 : undefined).map((p, idx) => {
                                const isProductUnlocked = unlockedCats.includes(p.category);
                                if (isGuest && idx >= 3 && !isProductUnlocked) return null;
                                return (
                                    <div key={p.id} className="w-64 md:w-72 shrink-0 snap-start">
                                        <ProductCard 
                                            product={p} 
                                            isAdmin={isAdmin} 
                                            onClick={() => navigateToProduct(p.id)} 
                                            priority={idx < 4}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* 2. Trending (Grid 4) */}
                {(isLoading && curated.trending.length === 0) ? (
                    <section>
                        <div className="h-8 w-48 bg-stone-200 rounded animate-pulse mb-10" />
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-8 lg:gap-10">
                            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <ProductSkeleton key={i} />)}
                        </div>
                    </section>
                ) : curated.trending.length > 0 && (
                    <section>
                        <div className="space-y-1 mb-10">
                            <h3 className="font-sans text-2xl md:text-3xl font-bold flex items-center gap-3 text-brand-dark uppercase tracking-tighter">
                                <TrendingUp size={29} className="text-brand-gold" /> Trending Now
                            </h3>
                            <p className="text-[10px] text-stone-400 uppercase tracking-[0.3em] font-bold ml-9">Most Coveted Pieces This Week</p>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-8 lg:gap-10">
                            {curated.trending.slice(0, isGuest ? 12 : 8).map((p, idx) => {
                                const isProductUnlocked = unlockedCats.includes(p.category);
                                if (isGuest && idx >= 3 && !isProductUnlocked) return null;
                                return (
                                    <ProductCard 
                                        key={p.id} 
                                        product={p} 
                                        isAdmin={isAdmin} 
                                        onClick={() => navigateToProduct(p.id)} 
                                        priority={idx < 4}
                                    />
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* 3. Most Sold / Loved (Grid 4) */}
                {(isLoading && curated.loved.length === 0) ? (
                    <section>
                        <div className="h-8 w-48 bg-stone-200 rounded animate-pulse mb-10" />
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-8 lg:gap-10">
                            {[1, 2, 3, 4].map(i => <ProductSkeleton key={i} />)}
                        </div>
                    </section>
                ) : curated.loved.length > 0 && (
                    <section>
                        <div className="space-y-1 mb-10">
                            <h3 className="font-sans text-2xl md:text-3xl font-bold flex items-center gap-3 text-brand-dark uppercase tracking-tighter">
                                <Gem size={29} className="text-brand-red" /> Best Sellers
                            </h3>
                            <p className="text-[10px] text-stone-400 uppercase tracking-[0.3em] font-bold ml-9">Timeless Favorites</p>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-8 lg:gap-10">
                            {curated.loved.slice(0, isGuest ? 12 : 4).map((p, idx) => {
                                const isProductUnlocked = unlockedCats.includes(p.category);
                                if (isGuest && idx >= 3 && !isProductUnlocked) return null;
                                return (
                                    <ProductCard 
                                        key={p.id} 
                                        product={p} 
                                        isAdmin={isAdmin} 
                                        onClick={() => navigateToProduct(p.id)} 
                                        priority={idx < 4}
                                    />
                                );
                            })}
                        </div>
                    </section>
                )}

                {curated.latest.length === 0 && !isLoading && (
                    <div className="text-center py-32 space-y-4">
                        <Gem size={48} className="mx-auto text-stone-200" />
                        <p className="text-stone-300 font-serif italic text-xl">The collection is currently being curated.</p>
                    </div>
                )}
            </div>
        ) : (
            /* LIST MODE: Infinite Scroll Grid (Filtered) */
            <div 
              className={`grid pb-12 animate-fade-in gap-4 md:gap-8 lg:gap-10 ${
                viewMode === 'grid' 
                    ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' 
                    : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
              }`}
            >
              {isLoading && products.length === 0 ? (
                  Array.from({ length: 10 }).map((_, i) => <ProductSkeleton key={i} />)
              ) : products.map((product, index) => {
                 if (isGuest && !isCategoryUnlocked && index >= 3) return null;

                 if (!isGuest && index === products.length - 1) {
                     return (
                        <div ref={lastProductElementRef} key={product.id}>
                            <ProductCard 
                                product={product} 
                                isAdmin={isAdmin} 
                                onClick={() => navigateToProduct(product.id)} 
                                priority={index < 8}
                            />
                        </div>
                     )
                 } 
                 return (
                    <ProductCard 
                      key={product.id} 
                      product={product} 
                      isAdmin={isAdmin} 
                      onClick={() => navigateToProduct(product.id)} 
                      priority={index < 8}
                    />
                 )
              })}

              {/* GUEST LOCK CARD */}
              {isGuest && !isCategoryUnlocked && (
                 <div className="bg-white rounded-2xl overflow-hidden border border-dashed border-stone-200 flex flex-col items-center justify-center p-8 text-center space-y-6 min-h-[400px] hover:bg-stone-50 transition-all duration-500 group relative">
                     <div className="absolute inset-0 bg-gradient-to-b from-transparent to-stone-50/80 pointer-events-none"></div>
                     <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center text-brand-gold shadow-sm mb-2 relative border border-stone-100 group-hover:scale-110 transition-transform z-10">
                        <Lock size={38} />
                     </div>
                     <div className="z-10">
                        <h3 className="font-sans text-2xl text-brand-dark font-bold uppercase tracking-tighter">Unlock the Vault</h3>
                        <p className="text-xs text-stone-500 mt-3 max-w-[260px] mx-auto leading-relaxed font-serif italic">
                            Login to reveal exclusive pricing, detailed price breakups, and our complete bespoke collection.
                        </p>
                     </div>
                     <button onClick={() => navigate('/login')} className="px-8 py-4 bg-brand-dark text-white rounded-xl font-bold uppercase tracking-[0.2em] text-[10px] shadow-2xl hover:bg-brand-gold transition-all flex items-center gap-3 active:scale-95 z-10">
                        <User size={19} /> Login to Reveal
                     </button>
                </div>
              )}
            </div>
        )}
        
        {/* Quick View Modal Removed as per user request */}

        {/* Loading Indicators */}
        {isFetchingMore && !isLoading && (
            <div className="py-8 flex justify-center">
                <Loader2 className="animate-spin text-stone-300" size={24} />
            </div>
        )}
        
        {!hasMore && products.length > 0 && !isGuest && !isOverviewMode && (
            <div className="text-center py-10 text-stone-200 text-[10px] font-bold uppercase tracking-widest">
                — End of Collection —
            </div>
        )}

        {products.length === 0 && !isLoading && !isOverviewMode && (
          <div className="text-center py-20 text-stone-300 font-serif italic">
            No pieces found matching your criteria.
          </div>
        )}

      </main>

      {/* Search by Image AI Modal */}
      {isImageSearchOpen && (
        <div className="fixed inset-0 bg-brand-dark/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in" id="image-search-modal">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-stone-100 flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-gold/10 flex items-center justify-center text-brand-gold">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h2 className="font-sans text-lg font-bold text-brand-dark uppercase tracking-wide">AI Image Search</h2>
                  <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Match designs to the Sanghavi Catalogue</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  resetImageSearch();
                  setIsImageSearchOpen(false);
                }}
                className="p-2 hover:bg-stone-50 rounded-xl text-stone-400 hover:text-brand-dark transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Model & Method Selector */}
            <div className="px-6 py-3 bg-stone-50 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Search Intelligence:</span>
                <div className="flex bg-stone-200/60 p-0.5 rounded-xl border border-stone-200/80">
                  <button 
                    onClick={() => {
                      setSearchMode('cloud');
                      resetImageSearch();
                    }}
                    className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                      searchMode === 'cloud' 
                        ? 'bg-white text-brand-dark shadow-sm' 
                        : 'text-stone-500 hover:text-brand-dark'
                    }`}
                  >
                    Cloud Neural
                  </button>
                  <button 
                    onClick={() => {
                      setSearchMode('local');
                      resetImageSearch();
                    }}
                    className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                      searchMode === 'local' 
                        ? 'bg-white text-brand-dark shadow-sm' 
                        : 'text-stone-500 hover:text-brand-dark'
                    }`}
                  >
                    Local Agent
                  </button>
                </div>
              </div>

              {searchMode === 'local' && (
                <div className="flex items-center gap-2 text-[10px]">
                  {localStatus.isTrained ? (
                    <span className="text-emerald-600 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                      ● Active ({localStatus.indexSize} designs learned)
                    </span>
                  ) : (
                    <span className="text-amber-600 font-bold bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100 animate-pulse">
                      ○ Learning Required
                    </span>
                  )}
                  
                  <button 
                    onClick={handleTrainLocalEngine}
                    disabled={trainingProgress !== null}
                    className="px-2.5 py-1 bg-white hover:bg-stone-100 border border-stone-200 text-stone-600 font-bold uppercase rounded-lg active:scale-95 transition-all disabled:opacity-50"
                  >
                    {trainingProgress !== null ? 'Learning...' : 'Train Agent'}
                  </button>
                </div>
              )}
            </div>

            {/* Category Lock Pills */}
            <div className="px-6 py-2.5 bg-stone-50/50 border-b border-stone-100 flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0" id="image-search-category-lock">
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 whitespace-nowrap">Category Lock:</span>
              <div className="flex gap-1.5">
                {[
                  { value: 'all', label: 'All Designs' },
                  { value: 'ring', label: 'Rings' },
                  { value: 'necklace', label: 'Necklaces' },
                  { value: 'bangle', label: 'Bangles & Kadas' },
                  { value: 'earring', label: 'Earrings' }
                ].map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setImageSearchCategory(cat.value)}
                    className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border transition-all whitespace-nowrap ${
                      imageSearchCategory === cat.value
                        ? 'bg-brand-gold text-white border-brand-gold shadow-sm font-semibold'
                        : 'bg-white text-stone-600 border-stone-200 hover:text-brand-dark hover:border-stone-300'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {trainingProgress !== null && (
                <div className="bg-brand-gold/5 border border-brand-gold/20 p-6 rounded-2xl space-y-3 animate-fade-in">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-serif font-bold text-brand-dark">Local Agent is learning jewelry designs...</span>
                    <span className="font-mono font-bold text-brand-gold">{trainingProgress}%</span>
                  </div>
                  <div className="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-brand-gold h-full transition-all duration-300 rounded-full"
                      style={{ width: `${trainingProgress}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-stone-400 font-sans leading-relaxed">
                    Analyzing geometric boundaries, hue values, reflection maps, and texture densities of your entire catalogue. This builds a local mathematical design fingerprint to allow instant, offline style matching.
                  </p>
                </div>
              )}
              {!searchImageBase64 ? (
                /* Upload Zone */
                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                    isDragging 
                      ? 'border-brand-gold bg-brand-gold/5 scale-[0.99]' 
                      : 'border-stone-200 hover:border-brand-gold/40 hover:bg-stone-50'
                  }`}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleImageFile(e.target.files[0]);
                      }
                    }}
                    accept="image/*" 
                    className="hidden" 
                  />
                  <div className="w-16 h-16 bg-stone-50 rounded-2xl flex items-center justify-center mx-auto text-stone-400 group-hover:text-brand-gold transition-colors mb-4">
                    <Upload size={32} />
                  </div>
                  <p className="font-serif text-lg text-brand-dark">Drag and drop your jewelry image here</p>
                  <p className="text-stone-400 text-xs mt-2 font-sans">or click to browse your files</p>
                  <p className="text-[9px] text-stone-300 font-bold uppercase tracking-wider mt-6">Supports JPEG, PNG, WEBP</p>
                </div>
              ) : (
                /* Search Actions & Results */
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row gap-4 bg-stone-50 p-4 rounded-2xl border border-stone-100">
                    {/* Image Preview */}
                    <div className="w-full sm:w-1/3 aspect-square rounded-xl overflow-hidden border border-stone-200 shrink-0">
                      <img 
                        src={searchImageBase64} 
                        alt="Uploaded query" 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex-1 flex flex-col justify-between py-1">
                      <div>
                        <h3 className="font-serif text-base text-brand-dark">Uploaded Specification</h3>
                        <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                          Currently matching against all active rings, necklaces, bangles, and bespoke jewelry vault items.
                        </p>
                      </div>
                      <button 
                        onClick={resetImageSearch}
                        className="text-stone-400 hover:text-brand-gold font-sans text-xs font-bold uppercase tracking-wider text-left mt-4 sm:mt-0"
                      >
                        Upload another image
                      </button>
                    </div>
                  </div>

                  {/* Loading State */}
                  {isSearchingImage && (
                    <div className="py-12 text-center space-y-4">
                      <Loader2 className="animate-spin text-brand-gold mx-auto" size={36} />
                      <div className="space-y-1">
                        <p className="font-serif text-base text-brand-dark animate-pulse">Running Neural Feature Matching...</p>
                        <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Scanning metal types, shapes, and gemstone cuts</p>
                      </div>
                    </div>
                  )}

                  {/* Error State */}
                  {imageSearchError && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm text-center font-sans border border-red-100">
                      {imageSearchError}
                    </div>
                  )}

                  {/* Analysis & Matches */}
                  {!isSearchingImage && imageSearchResults && (
                    <div className="space-y-6">
                      {imageSearchAnalysis && (
                        <div className="bg-brand-gold/5 border border-brand-gold/20 p-4 rounded-2xl">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-brand-gold mb-1 flex items-center gap-1">
                            <Sparkles size={12} /> AI Visual Analysis
                          </h4>
                          <p className="text-xs text-brand-dark font-sans leading-relaxed">
                            {imageSearchAnalysis}
                          </p>
                        </div>
                      )}

                      <div className="space-y-4">
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Closest Catalogue Matches</h4>
                        
                        {imageSearchResults.length === 0 ? (
                          <p className="text-stone-400 text-xs italic font-serif">No highly matching pieces found in the catalog.</p>
                        ) : (
                          <div className="space-y-3">
                            {imageSearchResults.map((match: any) => (
                              <div 
                                key={match.id}
                                onClick={() => {
                                  setIsImageSearchOpen(false);
                                  navigateToProduct(match.id);
                                }}
                                className="group flex gap-4 p-3 bg-white hover:bg-stone-50 border border-stone-100 hover:border-brand-gold/25 rounded-2xl cursor-pointer transition-all duration-300"
                              >
                                {/* Thumbnail */}
                                <div className="w-16 h-16 rounded-xl bg-stone-50 border border-stone-100 overflow-hidden shrink-0">
                                  {match.product?.thumbnails?.[0] ? (
                                    <img 
                                      src={match.product.thumbnails[0]} 
                                      alt={match.product.title} 
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-stone-300 bg-stone-50 font-serif italic text-[10px]">No Image</div>
                                  )}
                                </div>

                                {/* Match details */}
                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                  <div className="flex justify-between items-start gap-2">
                                    <div>
                                      <h5 className="font-serif text-sm text-brand-dark truncate">{match.product?.title || 'Bespoke Design'}</h5>
                                      <p className="text-[9px] text-stone-400 font-bold uppercase tracking-wider mt-0.5">
                                        {match.product?.category} • {match.product?.subCategory}
                                      </p>
                                    </div>
                                    <span className="shrink-0 px-2 py-1 bg-brand-gold/10 text-brand-gold text-[10px] font-bold rounded-lg border border-brand-gold/20 font-mono">
                                      {match.score}% match
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-stone-500 line-clamp-1 mt-1 leading-relaxed italic">
                                    {match.reason}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
