
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ProductCard } from '@/components/ProductCard.tsx';
import { storeService, CuratedCollections } from '@/services/storeService.ts';
import { Search, LayoutGrid, RectangleVertical, Clock, Heart, Loader2, Lock, User, RefreshCw, TrendingUp, Gem, ChevronRight } from 'lucide-react';
import { Product, AppConfig } from '@/types.ts';

export const Gallery: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [products, setProducts] = useState<Product[]>([]);
  const [curated, setCurated] = useState<CuratedCollections>({ latest: [], loved: [], trending: [], ideal: [] });
  const [config, setConfig] = useState<AppConfig | null>(null);
  
  // Filtering State
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'detail'>('grid');
  
  // Pagination State
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const observer = useRef<IntersectionObserver | null>(null);
  
  // Initial Load State
  const [isLoading, setIsLoading] = useState(true);

  const user = storeService.getCurrentUser();
  const isAdmin = user?.role === 'admin' || user?.role === 'contributor';
  const isGuest = !user;
  const GUEST_VIEW_LIMIT = 8;
  const BATCH_SIZE = 24; // Scalable batch size

  // 1. Initial Data Setup (Config + Curated)
  useEffect(() => {
    const initializeGallery = async () => {
        // Use Cache for instant render of structure
        const cached = storeService.getCached();
        if (cached.config) setConfig(cached.config);
        if (cached.curated) setCurated(cached.curated);

        try {
            const [conf, cur] = await Promise.all([
                storeService.getConfig().catch(() => null),
                storeService.getCuratedProducts().catch(() => ({ latest: [], loved: [], trending: [], ideal: [] }))
            ]);
            
            if (conf) setConfig(conf);
            if (cur) setCurated(cur);

            // Handle Shared Category Link Logic
            const sharedCat = (location.state as any)?.sharedCategory;
            if (sharedCat) {
                setActiveCategory(sharedCat);
                // Clear state to prevent sticky behavior
                window.history.replaceState({}, document.title);
            }

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
      if (reset) {
          setIsLoading(true);
          setProducts([]);
      }

      try {
          // Optimized Fetch: Only gets what we need based on category/search
          const res = await storeService.getProducts(targetPage, BATCH_SIZE, { 
              publicOnly: true,
              category: activeCategory !== 'All' ? activeCategory : undefined,
              search: search || undefined
          });
          
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
  }, [page, hasMore, isFetchingMore, activeCategory, search]);

  // Trigger fetch when category or search changes
  useEffect(() => {
      setPage(0);
      setHasMore(true);
      fetchProducts(true);
  }, [activeCategory, search]);

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
    navigate(`/product/${productId}`);
  }, [navigate]);

  const unlockedCats = useMemo(() => storeService.getUnlockedCategories(), []);
  
  const categoryList = (config?.categories || [])
    .filter(c => !isGuest || !c.isPrivate || unlockedCats.includes(c.name))
    .map(c => c.name);

  const isOverviewMode = activeCategory === 'All' && !search;

  return (
    <div className="min-h-screen bg-stone-50 pb-20 overflow-x-hidden animate-fade-in">
      <div className="sticky top-0 md:top-16 bg-white/90 backdrop-blur-md border-b border-stone-100 z-40 transition-transform duration-300">
        <div className="max-w-7xl mx-auto p-2">
            <div className="px-2 md:px-6 h-12 flex items-center justify-between gap-4">
                <div className="flex-1 max-w-md relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-300" size={16} />
                    <input 
                      type="text" 
                      placeholder="Search Studio..." 
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-100 rounded-xl text-sm focus:ring-1 focus:ring-brand-gold outline-none transition-all font-sans"
                    />
                </div>
                {!isOverviewMode && (
                    <button 
                    onClick={() => setViewMode(v => v === 'grid' ? 'detail' : 'grid')} 
                    className="p-2 text-stone-300 hover:text-brand-gold transition"
                    title={viewMode === 'grid' ? "Switch to Large View" : "Switch to Grid View"}
                    >
                        {viewMode === 'grid' ? <RectangleVertical size={24}/> : <LayoutGrid size={24}/>}
                    </button>
                )}
            </div>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide px-2 md:px-6 pb-2">
                {['All', ...categoryList].map(cat => (
                <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                      activeCategory === cat ? 'bg-brand-dark text-white shadow-lg' : 'bg-stone-50 text-stone-400 hover:bg-stone-100'
                    }`}
                >
                    {cat}
                </button>
                ))}
                
                {isGuest && (
                    <button onClick={() => navigate('/login')} className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-brand-gold/10 text-brand-gold border border-brand-gold/20 flex items-center gap-1 whitespace-nowrap">
                        <Lock size={10} /> + More
                    </button>
                )}
            </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto pt-4">
        {/* OVERVIEW MODE: Sections Only */}
        {isOverviewMode ? (
            <div className="space-y-10 pb-12 animate-fade-in">
                {/* 1. New Arrivals (Horizontal) */}
                {curated.latest.length > 0 && (
                    <div>
                        <div className="flex items-center justify-between px-6 mb-4">
                            <h3 className="font-sans text-xl font-bold flex items-center gap-2 text-brand-dark uppercase tracking-tight">
                                <Clock size={20} className="text-brand-gold" /> New Arrivals
                            </h3>
                        </div>
                        <div className="flex gap-4 overflow-x-auto px-6 pb-4 scrollbar-hide snap-x">
                            {curated.latest.map(p => (
                                <div key={p.id} className="w-48 shrink-0 snap-start">
                                    <ProductCard product={p} isAdmin={isAdmin} onClick={() => navigateToProduct(p.id)} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 2. Trending (Grid 4) */}
                {curated.trending.length > 0 && (
                    <div className="px-6">
                        <h3 className="font-sans text-xl font-bold mb-4 flex items-center gap-2 text-brand-dark uppercase tracking-tight">
                            <TrendingUp size={20} className="text-brand-gold" /> Trending Now
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {curated.trending.slice(0, 8).map(p => (
                                <ProductCard key={p.id} product={p} isAdmin={isAdmin} onClick={() => navigateToProduct(p.id)} />
                            ))}
                        </div>
                    </div>
                )}

                {/* 3. Most Sold / Loved (Grid 4) */}
                {curated.loved.length > 0 && (
                    <div className="px-6">
                        <h3 className="font-sans text-xl font-bold mb-4 flex items-center gap-2 text-brand-dark uppercase tracking-tight">
                            <Gem size={20} className="text-brand-red" /> Best Sellers
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {curated.loved.slice(0, 4).map(p => (
                                <ProductCard key={p.id} product={p} isAdmin={isAdmin} onClick={() => navigateToProduct(p.id)} />
                            ))}
                        </div>
                    </div>
                )}

                {curated.latest.length === 0 && !isLoading && (
                    <div className="text-center py-20 text-stone-300 font-serif italic">
                        The collection is currently being curated.
                    </div>
                )}
            </div>
        ) : (
            /* LIST MODE: Infinite Scroll Grid (Filtered) */
            <div 
              className={`grid gap-4 px-4 pb-8 animate-fade-in ${
                viewMode === 'grid' 
                    ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' 
                    : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
              }`}
            >
              {products.map((product, index) => {
                 if (!isGuest && index === products.length - 1) {
                     return (
                        <div ref={lastProductElementRef} key={product.id}>
                            <ProductCard product={product} isAdmin={isAdmin} onClick={() => navigateToProduct(product.id)} />
                        </div>
                     )
                 } 
                 return (
                    <ProductCard 
                      key={product.id} 
                      product={product} 
                      isAdmin={isAdmin} 
                      onClick={() => navigateToProduct(product.id)} 
                    />
                 )
              })}

              {/* GUEST LOCK CARD */}
              {isGuest && (
                 <div className="bg-white rounded-2xl overflow-hidden border border-dashed border-stone-200 flex flex-col items-center justify-center p-6 text-center space-y-4 min-h-[300px] hover:bg-stone-50 transition-colors">
                     <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center text-brand-gold shadow-sm mb-2 relative border border-stone-100">
                        <Lock size={28} />
                     </div>
                     <div>
                        <h3 className="font-sans text-xl text-brand-dark font-bold uppercase tracking-tight">Private Vault</h3>
                        <p className="text-xs text-stone-400 mt-2 max-w-[200px] mx-auto leading-relaxed font-serif italic">
                            Join our exclusive clientele to unlock the full bespoke collection.
                        </p>
                     </div>
                     <button onClick={() => navigate('/login')} className="px-6 py-3 bg-brand-dark text-white rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-xl hover:bg-brand-red transition-colors flex items-center gap-2">
                        <User size={14} /> Member Access
                     </button>
                </div>
              )}
            </div>
        )}
        
        {/* Loading Indicators */}
        {isLoading && products.length === 0 && !isOverviewMode && (
          <div className="min-h-[50vh] flex items-center justify-center bg-stone-50">
            <Loader2 className="animate-spin text-brand-gold" size={32} />
          </div>
        )}

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
    </div>
  );
};
