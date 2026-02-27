
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ProductCard } from '@/components/ProductCard.tsx';
import { storeService, CuratedCollections } from '@/services/storeService.ts';
import { Search, LayoutGrid, RectangleVertical, Clock, Heart, Loader2, Lock, User, RefreshCw, TrendingUp, Gem, ChevronRight, X, Sparkles, MessageCircle } from 'lucide-react';
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
      <div className="sticky top-0 md:top-24 bg-white/80 backdrop-blur-xl border-b border-stone-100 z-40 transition-all duration-500">
        <div className="max-w-7xl mx-auto p-4">
            <div className="px-2 md:px-6 h-14 flex items-center justify-between gap-6">
                <div className="flex-1 max-w-xl relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300 group-focus-within:text-brand-gold transition-colors" size={18} />
                    <input 
                      type="text" 
                      placeholder="Search the Vault..." 
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-stone-50 border border-stone-100 rounded-2xl text-sm focus:ring-2 focus:ring-brand-gold/20 focus:bg-white outline-none transition-all font-sans placeholder:text-stone-300"
                    />
                </div>
                {!isOverviewMode && (
                    <button 
                    onClick={() => setViewMode(v => v === 'grid' ? 'detail' : 'grid')} 
                    className="p-3 text-stone-300 hover:text-brand-gold hover:bg-stone-50 rounded-xl transition-all"
                    title={viewMode === 'grid' ? "Switch to Large View" : "Switch to Grid View"}
                    >
                        {viewMode === 'grid' ? <RectangleVertical size={24}/> : <LayoutGrid size={24}/>}
                    </button>
                )}
            </div>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide px-2 md:px-6 pb-2 pt-2">
                {['All', ...categoryList].map(cat => (
                <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] transition-all whitespace-nowrap border ${
                      activeCategory === cat ? 'bg-brand-dark text-white border-brand-dark shadow-xl' : 'bg-white text-stone-400 border-stone-100 hover:border-brand-gold/30 hover:text-brand-gold'
                    }`}
                >
                    {cat}
                </button>
                ))}
                
                {isGuest && (
                    <button onClick={() => navigate('/login')} className="px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] bg-brand-gold/5 text-brand-gold border border-brand-gold/20 flex items-center gap-2 whitespace-nowrap hover:bg-brand-gold/10 transition-colors">
                        <Lock size={12} /> Unlock More
                    </button>
                )}
            </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto pt-8">
        {/* OVERVIEW MODE: Sections Only */}
        {isOverviewMode ? (
            <div className="space-y-16 pb-12 animate-fade-in">
                {/* 1. New Arrivals (Horizontal) */}
                {curated.latest.length > 0 && (
                    <section>
                        <div className="flex items-center justify-between px-8 mb-6">
                            <div className="space-y-1">
                                <h3 className="font-sans text-2xl font-bold flex items-center gap-3 text-brand-dark uppercase tracking-tighter">
                                    <Clock size={24} className="text-brand-gold" /> New Arrivals
                                </h3>
                                <p className="text-[10px] text-stone-400 uppercase tracking-[0.3em] font-bold ml-9">The Latest From Our Studio</p>
                            </div>
                            <button onClick={() => setActiveCategory('Rings')} className="text-[10px] font-bold uppercase tracking-widest text-brand-gold flex items-center gap-1 hover:gap-2 transition-all">
                                View All <ChevronRight size={14} />
                            </button>
                        </div>
                        <div className="flex gap-6 overflow-x-auto px-8 pb-8 scrollbar-hide snap-x">
                            {curated.latest.slice(0, isGuest ? 3 : undefined).map(p => (
                                <div key={p.id} className="w-64 shrink-0 snap-start">
                                    <ProductCard product={p} isAdmin={isAdmin} onClick={() => navigateToProduct(p.id)} />
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* 2. Trending (Grid 4) */}
                {curated.trending.length > 0 && (
                    <section className="px-8">
                        <div className="space-y-1 mb-8">
                            <h3 className="font-sans text-2xl font-bold flex items-center gap-3 text-brand-dark uppercase tracking-tighter">
                                <TrendingUp size={24} className="text-brand-gold" /> Trending Now
                            </h3>
                            <p className="text-[10px] text-stone-400 uppercase tracking-[0.3em] font-bold ml-9">Most Coveted Pieces This Week</p>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                            {curated.trending.slice(0, isGuest ? 3 : 8).map(p => (
                                <ProductCard key={p.id} product={p} isAdmin={isAdmin} onClick={() => navigateToProduct(p.id)} />
                            ))}
                        </div>
                    </section>
                )}

                {/* 3. Most Sold / Loved (Grid 4) */}
                {curated.loved.length > 0 && (
                    <section className="px-8">
                        <div className="space-y-1 mb-8">
                            <h3 className="font-sans text-2xl font-bold flex items-center gap-3 text-brand-dark uppercase tracking-tighter">
                                <Gem size={24} className="text-brand-red" /> Best Sellers
                            </h3>
                            <p className="text-[10px] text-stone-400 uppercase tracking-[0.3em] font-bold ml-9">Timeless Favorites</p>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                            {curated.loved.slice(0, isGuest ? 3 : 4).map(p => (
                                <ProductCard key={p.id} product={p} isAdmin={isAdmin} onClick={() => navigateToProduct(p.id)} />
                            ))}
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
              className={`grid gap-6 px-6 pb-12 animate-fade-in ${
                viewMode === 'grid' 
                    ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' 
                    : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
              }`}
            >
              {products.slice(0, isGuest ? 3 : undefined).map((product, index) => {
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
                 <div className="bg-white rounded-2xl overflow-hidden border border-dashed border-stone-200 flex flex-col items-center justify-center p-8 text-center space-y-6 min-h-[400px] hover:bg-stone-50 transition-all duration-500 group">
                     <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center text-brand-gold shadow-sm mb-2 relative border border-stone-100 group-hover:scale-110 transition-transform">
                        <Lock size={32} />
                     </div>
                     <div>
                        <h3 className="font-sans text-2xl text-brand-dark font-bold uppercase tracking-tighter">Private Vault</h3>
                        <p className="text-xs text-stone-400 mt-3 max-w-[240px] mx-auto leading-relaxed font-serif italic">
                            Join our exclusive clientele to unlock the full bespoke collection and technical specifications.
                        </p>
                     </div>
                     <button onClick={() => navigate('/login')} className="px-8 py-4 bg-brand-dark text-white rounded-xl font-bold uppercase tracking-[0.2em] text-[10px] shadow-2xl hover:bg-brand-gold transition-all flex items-center gap-3 active:scale-95">
                        <User size={16} /> Member Access
                     </button>
                </div>
              )}
            </div>
        )}
        
        {/* Quick View Modal Removed as per user request */}
        
        {/* Floating AI Concierge Button */}
        <button 
            onClick={() => navigate('/admin/studio')} 
            className="fixed bottom-28 right-8 w-16 h-16 bg-brand-dark text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-90 transition-all z-40 group border border-white/10"
        >
            <Sparkles size={28} className="group-hover:rotate-12 transition-transform" />
            <div className="absolute right-full mr-4 bg-white text-brand-dark px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-stone-100">
                AI Concierge
            </div>
        </button>

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
