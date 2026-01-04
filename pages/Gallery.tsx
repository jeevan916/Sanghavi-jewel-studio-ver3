
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { storeService } from '../services/storeService';
import { Search, Grid, LayoutGrid, LogOut, Loader2, Filter, RefreshCw, Lock, Sparkles, UserPlus, TrendingUp, Clock, Heart, ShoppingBag, Gem, ChevronLeft, ChevronRight, Unlock, X, ArrowDown } from 'lucide-react';
import { Product, AnalyticsEvent, AppConfig } from '../types';

export const Gallery: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [products, setProducts] = useState<Product[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsEvent[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  
  // Pagination State
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeSubCategory, setActiveSubCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'masonry'>('grid');
  
  // Infinite Scroll Observer
  const observer = useRef<IntersectionObserver | null>(null);
  const lastProductElementRef = useCallback((node: HTMLDivElement) => {
    if (isLoading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [isLoading, hasMore]);

  const user = storeService.getCurrentUser();
  const isAdmin = user?.role === 'admin' || user?.role === 'contributor';
  const isGuest = !user;

  // Handle Shared Link Access
  const sharedCategoryState = (location.state as any)?.sharedCategory;
  const restrictedCategory = isGuest ? sharedCategoryState : null;
  const unlockedCategories = storeService.getUnlockedCategories();
  const sharedCategory = restrictedCategory || (unlockedCategories.includes(activeCategory) ? activeCategory : null);

  useEffect(() => {
    if (restrictedCategory) setActiveCategory(restrictedCategory);
    else if (sharedCategoryState) setActiveCategory(sharedCategoryState);
  }, [restrictedCategory, sharedCategoryState]);

  // Initial Configuration Fetch
  useEffect(() => {
      storeService.getConfig().then(setConfig);
      storeService.getAnalytics().then(setAnalytics);
  }, []);

  // Fetch Products with Server-Side Filtering
  useEffect(() => {
    const fetchProducts = async () => {
        setIsLoading(true);
        try {
            // Apply filtering at the database level to ensure full pages of content
            const filters = {
                publicOnly: !isAdmin, // Critical fix for guest view
                category: activeCategory !== 'All' ? activeCategory : undefined,
                subCategory: activeSubCategory !== 'All' ? activeSubCategory : undefined,
                search: search || undefined
            };

            const response = await storeService.getProducts(page, 20, filters);
            
            setProducts(prev => {
                if (page === 1) return response.items;
                // Deduplicate items based on ID
                const existingIds = new Set(prev.map(p => p.id));
                const newItems = response.items.filter(p => !existingIds.has(p.id));
                return [...prev, ...newItems];
            });
            
            setHasMore(page < response.meta.totalPages);
        } catch (error) {
            console.error("Gallery Load Error", error);
        } finally {
            setIsLoading(false);
            setIsInitialLoad(false);
        }
    };

    const timeout = setTimeout(fetchProducts, 300); // Debounce search
    return () => clearTimeout(timeout);
  }, [page, activeCategory, activeSubCategory, search, isAdmin]);

  // Reset pagination when filters change
  useEffect(() => {
      setPage(1);
      setProducts([]); // Clear to show loading state
      setHasMore(true);
  }, [activeCategory, activeSubCategory, search]);

  // Compute available categories from Config
  const categoryList = useMemo(() => {
    if (restrictedCategory) return [restrictedCategory];
    if (config?.categories && config.categories.length > 0) {
        const visibleCats = config.categories
            .filter(c => {
                 const isUnlocked = unlockedCategories.includes(c.name) || (sharedCategoryState === c.name);
                 return c.isPrivate ? (isAdmin || isUnlocked) : true;
            })
            .map(c => c.name);
        return ['All', ...visibleCats];
    }
    // Fallback if config failed
    return ['All'];
  }, [config, restrictedCategory, isAdmin, unlockedCategories, sharedCategoryState]);

  // Compute sub-categories
  const subCategoryList = useMemo(() => {
      if (activeCategory === 'All') return [];
      const catConfig = config?.categories.find(c => c.name === activeCategory);
      if (catConfig && catConfig.subCategories.length > 0) return ['All', ...catConfig.subCategories];
      return [];
  }, [activeCategory, config]);

  const handleGuestInteraction = () => {
      if (confirm("Unlock our full bespoke collection?\n\nLogin securely with WhatsApp to view all 500+ designs and live pricing.")) {
          navigate('/login');
      }
  };

  const handleClearFilters = () => {
      setSearch('');
      setActiveSubCategory('All');
      if (!restrictedCategory) setActiveCategory('All');
  };

  const navigateToProduct = (productId: string) => {
      navigate(`/product/${productId}`, { state: { sharedCategory: restrictedCategory } });
  };

  // AI Insights Pulse Logic
  const trendingStats = useMemo(() => {
      const topProduct = analytics.find(e => e.type === 'inquiry' || e.type === 'like');
      const liveViewers = Math.floor(Math.random() * 5) + 3; // Simulated live users for UX
      return { 
          hotItem: topProduct?.productTitle || 'Solitaire Rings', 
          live: liveViewers,
          total: products.length > 0 ? products.length : 'Loading...'
      };
  }, [analytics, products]);

  if (isInitialLoad && products.length === 0) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50">
          <Loader2 className="animate-spin text-gold-600 mb-2" size={32} />
          <p className="text-stone-400 text-xs uppercase tracking-widest font-bold">Opening Vault...</p>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-20 md:pt-16">
      
      {/* AI Market Pulse Ticker */}
      {!isGuest && (
          <div className="bg-stone-900 text-gold-500 text-[10px] font-bold uppercase tracking-widest py-1.5 px-4 flex items-center justify-between overflow-hidden relative z-50">
             <div className="flex items-center gap-2 animate-pulse">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                Live Studio Pulse
             </div>
             <div className="flex items-center gap-4 animate-in slide-in-from-right duration-1000">
                <span className="text-white hidden sm:inline">Active Clients: {trendingStats.live}</span>
                <span className="text-gold-300">Trending: {trendingStats.hotItem}</span>
             </div>
          </div>
      )}

      {/* Sticky Header */}
      <div className="sticky top-0 md:top-16 bg-white/90 backdrop-blur-md border-b border-stone-200 z-40 transition-all duration-300">
        <div className="max-w-7xl mx-auto flex flex-col gap-2 p-2">
            <div className="px-2 md:px-6 h-12 flex items-center justify-between gap-4">
                <div className={`flex-1 max-w-md relative transition-opacity ${isGuest && !sharedCategory ? 'opacity-50' : 'opacity-100'}`} onClick={isGuest && !sharedCategory ? handleGuestInteraction : undefined}>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                    <input 
                    type="text" 
                    placeholder={isGuest && !sharedCategory ? "Login to search..." : "Search..."}
                    value={search}
                    onChange={(e) => (!isGuest || sharedCategory) && setSearch(e.target.value)}
                    disabled={isGuest && !sharedCategory}
                    className="w-full pl-9 pr-4 py-2 bg-stone-100 border-none rounded-xl text-sm focus:ring-1 focus:ring-gold-500 outline-none disabled:cursor-not-allowed"
                    />
                </div>

                <div className="flex gap-2 items-center">
                    <button onClick={() => setViewMode(viewMode === 'grid' ? 'masonry' : 'grid')} className="p-2 text-stone-400 hover:text-gold-600 transition" title="Change View">
                        {viewMode === 'grid' ? <LayoutGrid size={20}/> : <Grid size={20}/>}
                    </button>
                    {user && (
                    <button onClick={() => storeService.logout()} className="p-2 text-stone-400 hover:text-red-500 transition" title="Logout">
                        <LogOut size={20} />
                    </button>
                    )}
                </div>
            </div>

            <div className={`flex gap-2 overflow-x-auto scrollbar-hide px-2 md:px-6 pb-2 transition-opacity ${isGuest && !sharedCategory ? 'opacity-50 pointer-events-none' : ''}`}>
                {categoryList.map(cat => (
                <button
                    key={cat}
                    onClick={() => { setActiveCategory(cat); setActiveSubCategory('All'); }}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap flex-shrink-0 ${
                    activeCategory === cat ? 'bg-stone-900 text-white shadow-lg' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                    }`}
                >
                    {cat}
                </button>
                ))}
            </div>

            {activeCategory !== 'All' && subCategoryList.length > 0 && (
                <div className="flex gap-2 overflow-x-auto scrollbar-hide px-2 md:px-6 pb-2 border-t border-stone-100 pt-2 bg-stone-50/50">
                    <span className="text-[10px] uppercase font-bold text-stone-400 self-center mr-2">Filter:</span>
                    {subCategoryList.map(sub => (
                        <button
                            key={sub}
                            onClick={() => setActiveSubCategory(sub)}
                            className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all whitespace-nowrap flex-shrink-0 border ${
                            activeSubCategory === sub 
                                ? 'bg-gold-50 border-gold-200 text-gold-700' 
                                : 'bg-white border-stone-200 text-stone-500 hover:border-gold-300'
                            }`}
                        >
                            {sub}
                        </button>
                    ))}
                </div>
            )}
        </div>
      </div>

      <main className="max-w-7xl mx-auto p-4 md:p-8">
        {isGuest && (
            <div className={`mb-8 p-4 rounded-2xl flex items-center justify-between shadow-xl animate-in fade-in slide-in-from-top-4 ${sharedCategory ? 'bg-green-800 text-white' : 'bg-stone-900 text-white'}`}>
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full animate-pulse ${sharedCategory ? 'bg-green-500' : 'bg-gold-500'}`}>
                        {sharedCategory ? <Unlock size={16} /> : <Sparkles size={16} />}
                    </div>
                    <div>
                        <p className="font-bold text-sm">{sharedCategory ? `Private Access: ${sharedCategory}` : 'Preview Mode'}</p>
                        <p className="text-[10px] text-stone-300">{sharedCategory ? 'Private collection unlocked.' : 'Login to view full catalog & prices.'}</p>
                    </div>
                </div>
                {!sharedCategory && (
                    <button onClick={() => navigate('/login')} className="bg-white text-stone-900 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-gold-50 transition">
                        Login
                    </button>
                )}
            </div>
        )}

        <div className={`grid gap-4 ${
            viewMode === 'grid' 
            ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' 
            : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
        }`}>
            {products.map((product, index) => {
                if (products.length === index + 1) {
                    return (
                        <div ref={lastProductElementRef} key={product.id}>
                            <ProductCard product={product} isAdmin={isAdmin} onClick={() => navigateToProduct(product.id)} />
                        </div>
                    );
                } else {
                    return <ProductCard key={product.id} product={product} isAdmin={isAdmin} onClick={() => navigateToProduct(product.id)} />;
                }
            })}
        </div>

        {isLoading && (
            <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-gold-500" size={24} />
            </div>
        )}
        
        {!hasMore && products.length > 0 && (
            <div className="text-center py-8 text-stone-400 text-xs uppercase tracking-widest font-bold flex items-center justify-center gap-2">
                <div className="h-px w-8 bg-stone-300"></div> End of Collection <div className="h-px w-8 bg-stone-300"></div>
            </div>
        )}

        {products.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center py-20 text-stone-400">
                <Filter size={48} className="mb-4 opacity-20" />
                <p className="font-serif text-xl">No public items found.</p>
                {(search || activeCategory !== 'All') ? (
                    <button onClick={handleClearFilters} className="mt-4 text-gold-600 font-bold uppercase text-xs tracking-widest hover:underline">
                        Reset Filters
                    </button>
                ) : (
                    <p className="text-xs mt-2">New collection arriving soon.</p>
                )}
            </div>
        )}
      </main>
    </div>
  );
};
