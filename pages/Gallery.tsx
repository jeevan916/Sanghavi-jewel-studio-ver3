
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
  const [config, setConfig] = useState<AppConfig | null>(null);
  
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'masonry'>('grid');
  
  const requestRef = useRef<number>(0);
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

  const sharedCategoryState = (location.state as any)?.sharedCategory;
  const unlockedCategories = storeService.getUnlockedCategories();

  useEffect(() => {
    if (sharedCategoryState) setActiveCategory(sharedCategoryState);
  }, [sharedCategoryState]);

  useEffect(() => {
      Promise.all([
          storeService.getConfig(),
          storeService.getCuratedProducts()
      ]).then(([conf, cur]) => {
          setConfig(conf);
          setCurated(cur);
      });
  }, []);

  useEffect(() => {
      setPage(1);
      setProducts([]); 
      setHasMore(true);
  }, [activeCategory, search]);

  useEffect(() => {
    const requestId = ++requestRef.current;
    const fetchProducts = async () => {
        setIsLoading(true);
        try {
            const filters = {
                publicOnly: isGuest, 
                category: activeCategory !== 'All' ? activeCategory : undefined,
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
            console.error("Gallery Sync Error", error);
        } finally {
            if (requestId === requestRef.current) {
                setIsLoading(false);
                setIsInitialLoad(false);
            }
        }
    };
    const timeout = setTimeout(fetchProducts, 300);
    return () => clearTimeout(timeout);
  }, [page, activeCategory, search, isGuest]);

  const categoryList = useMemo(() => {
    if (!config?.categories) return ['All'];
    return ['All', ...config.categories
        .filter(c => {
             // Strict Privacy: Hide private cats from guests unless explicitly unlocked
             const isUnlocked = unlockedCategories.includes(c.name) || (sharedCategoryState === c.name);
             if (c.isPrivate) return isAdmin || isUnlocked;
             return true;
        })
        .map(c => c.name)];
  }, [config, isAdmin, unlockedCategories, sharedCategoryState]);

  const navigateToProduct = (productId: string) => {
      if (navigator.vibrate) navigator.vibrate(10);
      // Pass the current visible product IDs for horizontal swipe navigation in Details
      const contextIds = products.map(p => p.id);
      navigate(`/product/${productId}`, { 
          state: { 
              sharedCategory: sharedCategoryState,
              productContext: contextIds 
          } 
      });
  };

  if (isInitialLoad && products.length === 0) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50">
          <Loader2 className="animate-spin text-gold-600 mb-2" size={32} />
          <p className="text-stone-400 text-xs uppercase tracking-widest font-bold">Synchronizing Vault...</p>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-20 md:pt-16 animate-in fade-in duration-700">
      <div className="sticky top-0 md:top-16 bg-white/90 backdrop-blur-md border-b border-stone-200 z-40">
        <div className="max-w-7xl mx-auto p-2">
            <div className="px-2 md:px-6 h-12 flex items-center justify-between gap-4">
                <div className="flex-1 max-w-md relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                    <input 
                    type="text" placeholder="Search Studio..." value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-stone-100 border-none rounded-xl text-sm focus:ring-1 focus:ring-gold-500 outline-none"
                    />
                </div>
                <button onClick={() => setViewMode(viewMode === 'grid' ? 'masonry' : 'grid')} className="p-2 text-stone-400 hover:text-gold-600 transition">
                    {viewMode === 'grid' ? <LayoutGrid size={20}/> : <Grid size={20}/>}
                </button>
            </div>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide px-2 md:px-6 pb-2">
                {categoryList.map(cat => (
                <button
                    key={cat}
                    onClick={() => { setActiveCategory(cat); if(navigator.vibrate) navigator.vibrate(5); }}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                    activeCategory === cat ? 'bg-stone-900 text-white shadow-lg' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                    }`}
                >
                    {cat}
                </button>
                ))}
            </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto md:p-8">
        {activeCategory === 'All' && !search && (
            <div className="py-6">
                <CuratedSection title="Latest Masterpieces" products={curated.latest} icon={Clock} accent="text-stone-800" onProductClick={navigateToProduct} />
                <CuratedSection title="Most Loved Designs" products={curated.loved} icon={Heart} accent="text-red-500" onProductClick={navigateToProduct} />
            </div>
        )}

        <div ref={gridRef} className={`grid gap-4 px-4 pb-8 animate-in slide-in-from-bottom-8 duration-1000 ${
            viewMode === 'grid' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
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
        {isLoading && <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gold-500" size={24} /></div>}
      </main>
    </div>
  );
};
