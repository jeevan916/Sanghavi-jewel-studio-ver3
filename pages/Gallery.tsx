
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { storeService, CuratedCollections } from '../services/storeService';
import { Search, Grid, LayoutGrid, LogOut, Loader2, Filter, Sparkles, TrendingUp, Clock, Heart, Gem, Unlock } from 'lucide-react';
import { Product, AnalyticsEvent, AppConfig } from '../types';

const CuratedSection: React.FC<{ title: string, products: Product[], icon: React.ElementType, accent: string, onProductClick: (id: string) => void }> = ({ title, products, icon: Icon, accent, onProductClick }) => {
    if (!products || products.length === 0) return null;
    return (
        <div className="mb-8 pl-4 md:pl-8 animate-in fade-in slide-in-from-right-8 duration-700">
            <h3 className={`font-serif text-lg md:text-xl font-bold mb-3 flex items-center gap-2 ${accent}`}>
                <Icon size={20} /> {title}
            </h3>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide pr-4">
                {products.map(p => (
                    <div key={p.id} className="w-40 md:w-48 shrink-0">
                        <ProductCard product={p} isAdmin={false} onClick={() => onProductClick(p.id)} />
                    </div>
                ))}
            </div>
        </div>
    );
};

export const Gallery: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [products, setProducts] = useState<Product[]>([]);
  const [curated, setCurated] = useState<CuratedCollections>({ latest: [], loved: [], trending: [], ideal: [] });
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
  
  // Race Condition Handling
  const requestRef = useRef<number>(0);
  
  // Infinite Scroll Observer
  const observer = useRef<IntersectionObserver | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

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

  // Initial Configuration & Curated Data Fetch
  useEffect(() => {
      Promise.all([
          storeService.getConfig(),
          storeService.getAnalytics(),
          storeService.getCuratedProducts()
      ]).then(([conf, ana, cur]) => {
          setConfig(conf);
          setAnalytics(ana);
          setCurated(cur);
      });
  }, []);

  // Filter Change Handler: Reset state immediately
  useEffect(() => {
      setPage(1);
      setProducts([]); 
      setHasMore(true);
  }, [activeCategory, activeSubCategory, search]);

  // Main Fetch Effect with Race Condition Guard
  useEffect(() => {
    const requestId = ++requestRef.current;
    
    const fetchProducts = async () => {
        setIsLoading(true);
        try {
            const filters = {
                publicOnly: !isAdmin, 
                category: activeCategory !== 'All' ? activeCategory : undefined,
                subCategory: activeSubCategory !== 'All' ? activeSubCategory : undefined,
                search: search || undefined
            };

            const response = await storeService.getProducts(page, 20, filters);
            
            if (requestId !== requestRef.current) return;

            setProducts(prev => {
                if (page === 1) return response.items;
                const existingIds = new Set(prev.map(p => p.id));
                const newItems = response.items.filter(p => !existingIds.has(p.id));
                return [...prev, ...newItems];
            });
            
            setHasMore(page < response.meta.totalPages);
        } catch (error) {
            if (requestId === requestRef.current) console.error("Gallery Load Error", error);
        } finally {
            if (requestId === requestRef.current) {
                setIsLoading(false);
                setIsInitialLoad(false);
            }
        }
    };

    const timeout = setTimeout(fetchProducts, 300);
    return () => clearTimeout(timeout);
  }, [page, activeCategory, activeSubCategory, search, isAdmin]);

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
    return ['All'];
  }, [config, restrictedCategory, isAdmin, unlockedCategories, sharedCategoryState]);

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
      if (navigator.vibrate) navigator.vibrate(10);
      
      // Build context list for swipe navigation in ProductDetails
      const contextIds = products.map(p => p.id);
      
      // If the clicked product isn't in main list (e.g. from Curated), add it loosely
      if (!contextIds.includes(productId)) contextIds.unshift(productId);

      navigate(`/product/${productId}`, { 
          state: { 
              sharedCategory: restrictedCategory,
              productContext: contextIds // Pass list for swipe nav
          } 
      });
  };

  const scrollToGrid = () => {
      gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const trendingStats = useMemo(() => {
      const topProduct = analytics.find(e => e.type === 'inquiry' || e.type === 'like');
      const liveViewers = Math.floor(Math.random() * 5) + 3; 
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

  const isMainCatalogView = activeCategory === 'All' && activeSubCategory === 'All' && !search;

  return (
    <div className="min-h-screen bg-stone-50 pb-20 md:pt-16 animate-in fade-in duration-500">
      
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

      <main className="max-w-7xl mx-auto md:p-8">
        
        {isMainCatalogView && (
            <div className="py-6 space-y-2">
                <CuratedSection title="Latest Arrivals" products={curated.latest} icon={Clock} accent="text-stone-800" onProductClick={navigateToProduct} />
                <CuratedSection title="Most Loved" products={curated.loved} icon={Heart} accent="text-red-500" onProductClick={navigateToProduct} />
                <CuratedSection title="Trending Now" products={curated.trending} icon={TrendingUp} accent="text-gold-600" onProductClick={navigateToProduct} />
                <CuratedSection title="Sanghavi Ideal (Most Sold)" products={curated.ideal} icon={Gem} accent="text-blue-600" onProductClick={navigateToProduct} />
                
                <div className="flex justify-center px-6 py-8">
                    <button 
                        onClick={scrollToGrid}
                        className="group relative px-8 py-4 bg-gradient-to-r from-gold-500 to-gold-700 text-white rounded-full font-serif font-bold text-lg shadow-xl hover:shadow-2xl hover:scale-105 transition-all flex items-center gap-3 overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 skew-x-12"></div>
                        <Sparkles className="animate-pulse" /> Browse Whole Collection
                    </button>
                </div>
                <div className="h-px bg-gradient-to-r from-transparent via-stone-200 to-transparent w-full mb-8"></div>
            </div>
        )}

        {isGuest && (
            <div className={`mx-4 mb-8 p-4 rounded-2xl flex items-center justify-between shadow-xl animate-in fade-in slide-in-from-top-4 ${sharedCategory ? 'bg-green-800 text-white' : 'bg-stone-900 text-white'}`}>
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

        <div ref={gridRef} className={`grid gap-4 px-4 pb-8 animate-in slide-in-from-bottom-8 duration-700 ${
            viewMode === 'grid' 
            ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' 
            : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
        }`}>
            {products.map((product, index) => {
                const isLast = products.length === index + 1;
                return (
                    <div ref={isLast ? lastProductElementRef : undefined} key={product.id}>
                        <ProductCard product={product} isAdmin={isAdmin} onClick={() => navigateToProduct(product.id)} />
                    </div>
                );
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
