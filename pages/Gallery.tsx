
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { storeService, CuratedCollections } from '../services/storeService';
import { Search, LayoutGrid, RectangleVertical, Clock, Heart, Loader2, Lock, User } from 'lucide-react';
import { Product, AppConfig } from '../types';

export const Gallery: React.FC = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [curated, setCurated] = useState<CuratedCollections>({ latest: [], loved: [], trending: [], ideal: [] });
  const [config, setConfig] = useState<AppConfig | null>(null);
  
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'detail'>('grid');
  const [isLoading, setIsLoading] = useState(true);

  const user = storeService.getCurrentUser();
  const isAdmin = user?.role === 'admin' || user?.role === 'contributor';
  const isGuest = !user;
  const GUEST_VIEW_LIMIT = 8;

  useEffect(() => {
    const initializeGallery = async () => {
        // 1. Instant Render from Cache (if available)
        const cached = storeService.getCached();
        let hasCache = false;
        if (cached.products && cached.products.length > 0) {
            setProducts(cached.products);
            hasCache = true;
        }
        if (cached.config) setConfig(cached.config);
        if (cached.curated) setCurated(cached.curated);

        if (hasCache) setIsLoading(false);

        // 2. Background Refresh (Always update with latest data)
        try {
            const [conf, cur, prodRes] = await Promise.all([
            storeService.getConfig().catch(() => null),
            storeService.getCuratedProducts().catch(() => ({ latest: [], loved: [], trending: [], ideal: [] })),
            // We fetch all public items so we can show the "X more locked" count correctly
            storeService.getProducts(1, 1000, { publicOnly: true }).catch(() => ({ items: [] }))
            ]);
            
            if (conf) setConfig(conf);
            if (cur) setCurated(cur);
            if (prodRes?.items) setProducts(prodRes.items);
        } catch (e) {
            console.error("Gallery Sync failed", e);
        } finally {
            setIsLoading(false);
        }
    };
    
    initializeGallery();
  }, [isGuest]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    const s = search.toLowerCase();
    return products.filter(p => {
      if (!p) return false;
      const matchesCat = activeCategory === 'All' || p.category === activeCategory;
      if (!matchesCat) return false;
      if (!s) return true;
      return (p.title || '').toLowerCase().includes(s) || 
             (p.tags || []).some(t => t.toLowerCase().includes(s));
    });
  }, [products, activeCategory, search]);

  // Apply Guest Limit
  const visibleProducts = useMemo(() => {
      if (isGuest) {
          return filteredProducts.slice(0, GUEST_VIEW_LIMIT);
      }
      return filteredProducts;
  }, [filteredProducts, isGuest]);

  const lockedCount = Math.max(0, filteredProducts.length - GUEST_VIEW_LIMIT);

  const navigateToProduct = useCallback((productId: string) => {
    if (navigator.vibrate) navigator.vibrate(10);
    navigate(`/product/${productId}`);
  }, [navigate]);

  if (isLoading && products.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="animate-spin text-gold-600" size={32} />
      </div>
    );
  }

  // REIMPLEMENTED ACCESS CONTROL: 
  // Filter out private categories if the user is a guest
  const categoryList = (config?.categories || [])
    .filter(c => !isGuest || !c.isPrivate)
    .map(c => c.name);

  return (
    <div className="min-h-screen bg-stone-50 pb-20 overflow-x-hidden animate-fade-in">
      <div className="sticky top-0 md:top-16 bg-white/90 backdrop-blur-md border-b border-stone-200 z-40 transition-transform duration-300">
        <div className="max-w-7xl mx-auto p-2">
            <div className="px-2 md:px-6 h-12 flex items-center justify-between gap-4">
                <div className="flex-1 max-w-md relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                    <input 
                      type="text" 
                      placeholder="Search Studio..." 
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-stone-100 border-none rounded-xl text-sm focus:ring-1 focus:ring-gold-500 outline-none transition-all"
                    />
                </div>
                <button 
                  onClick={() => setViewMode(v => v === 'grid' ? 'detail' : 'grid')} 
                  className="p-2 text-stone-400 hover:text-gold-600 transition"
                  title={viewMode === 'grid' ? "Switch to Large View" : "Switch to Grid View"}
                >
                    {viewMode === 'grid' ? <RectangleVertical size={24}/> : <LayoutGrid size={24}/>}
                </button>
            </div>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide px-2 md:px-6 pb-2">
                {['All', ...categoryList].map(cat => (
                <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                      activeCategory === cat ? 'bg-stone-900 text-white shadow-lg' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                    }`}
                >
                    {cat}
                </button>
                ))}
                
                {/* Visual cue for guests about restricted access */}
                {isGuest && (
                    <button onClick={() => navigate('/login')} className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gold-50 text-gold-600 border border-gold-200 flex items-center gap-1 whitespace-nowrap">
                        <Lock size={10} /> + More
                    </button>
                )}
            </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto pt-4">
        {activeCategory === 'All' && !search && (curated?.latest?.length || 0) > 0 && (
          <div className="mb-8">
            <h3 className="px-6 font-serif text-xl font-bold mb-4 flex items-center gap-2">
              <Clock size={20} className="text-gold-600" /> New Arrivals
            </h3>
            <div className="flex gap-4 overflow-x-auto px-6 pb-4 scrollbar-hide snap-x">
              {curated.latest.map(p => (
                <div key={p.id} className="w-48 shrink-0 snap-start">
                  <ProductCard product={p} isAdmin={isAdmin} onClick={() => navigateToProduct(p.id)} />
                </div>
              ))}
            </div>
          </div>
        )}

        <div 
          className={`grid gap-4 px-4 pb-8 ${
            viewMode === 'grid' 
                ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' 
                : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
          }`}
          style={{ 
            transform: 'translateZ(0)' // Keep GPU promotion
          }}
        >
          {visibleProducts.map(product => (
            <ProductCard 
              key={product.id} 
              product={product} 
              isAdmin={isAdmin} 
              onClick={() => navigateToProduct(product.id)} 
            />
          ))}

          {/* GUEST LOCK CARD */}
          {isGuest && lockedCount > 0 && (
             <div className="bg-stone-100 rounded-xl overflow-hidden border border-dashed border-stone-300 flex flex-col items-center justify-center p-6 text-center space-y-4 min-h-[300px] hover:bg-stone-200/50 transition-colors animate-fade-in">
                 <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-gold-500 shadow-sm mb-2 relative">
                    <Lock size={28} />
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-stone-900 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                        {Math.min(99, lockedCount)}+
                    </div>
                 </div>
                 <div>
                    <h3 className="font-serif text-xl text-stone-800 font-bold">Private Vault</h3>
                    <p className="text-xs text-stone-500 mt-2 max-w-[200px] mx-auto leading-relaxed">
                        Join our exclusive clientele to unlock {lockedCount} more bespoke designs.
                    </p>
                 </div>
                 <button onClick={() => navigate('/login')} className="px-6 py-3 bg-stone-900 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-lg hover:bg-gold-600 transition-colors flex items-center gap-2">
                    <User size={14} /> Member Access
                 </button>
            </div>
          )}
        </div>
        
        {filteredProducts.length === 0 && !isLoading && (
          <div className="text-center py-20 text-stone-400 font-serif italic">
            No pieces found matching your criteria.
          </div>
        )}
      </main>
    </div>
  );
};
