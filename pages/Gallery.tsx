import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { storeService } from '../services/storeService';
import { Search, Grid, LayoutGrid, LogOut, Loader2, Filter, RefreshCw, Lock, Sparkles, UserPlus } from 'lucide-react';
import { Product } from '../types';

export const Gallery: React.FC = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'masonry'>('grid');
  const [randomSeed, setRandomSeed] = useState(Math.random());
  
  const user = storeService.getCurrentUser();
  const isAdmin = user?.role === 'admin' || user?.role === 'contributor';
  const isGuest = !user;

  const loadProducts = async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    else setIsRefreshing(true);
    
    try {
        const data = await storeService.getProducts();
        setProducts(data);
    } catch (e) {
        console.warn('Live sync failed');
    } finally {
        setIsLoading(false);
        setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadProducts();
    const interval = setInterval(() => loadProducts(true), 30000);
    return () => clearInterval(interval);
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category));
    return ['All', ...Array.from(cats)];
  }, [products]);

  // Filter Logic with Guest Restriction
  const visibleProducts = useMemo(() => {
    let filtered = products.filter(p => {
        const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
        const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase());
        const visible = !p.isHidden || isAdmin;
        return matchesCategory && matchesSearch && visible;
    });

    if (isGuest) {
        // The Trick: Shuffle and pick 5 to show "Trending" vibes
        // We use a seed so it doesn't jitter on every re-render, but changes on reload
        return filtered
            .map(value => ({ value, sort: Math.sin(value.id.length + randomSeed) }))
            .sort((a, b) => a.sort - b.sort)
            .map(({ value }) => value)
            .slice(0, 5);
    }

    return filtered;
  }, [products, activeCategory, search, isAdmin, isGuest, randomSeed]);

  const handleGuestInteraction = () => {
      if (confirm("Unlock our full bespoke collection?\n\nLogin securely with WhatsApp to view all 500+ designs and live pricing.")) {
          navigate('/login');
      }
  };

  if (isLoading) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50">
          <Loader2 className="animate-spin text-gold-600 mb-2" size={32} />
          <p className="text-stone-400 text-xs uppercase tracking-widest font-bold">Accessing Vault...</p>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-20 md:pt-16">
      {/* Sticky Header */}
      <div className="sticky top-0 md:top-16 bg-white/80 backdrop-blur-md border-b border-stone-200 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-4">
          <div className={`flex-1 max-w-md relative transition-opacity ${isGuest ? 'opacity-50' : 'opacity-100'}`} onClick={isGuest ? handleGuestInteraction : undefined}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
            <input 
              type="text" 
              placeholder={isGuest ? "Login to search..." : "Search designs..."}
              value={search}
              onChange={(e) => !isGuest && setSearch(e.target.value)}
              disabled={isGuest}
              className="w-full pl-9 pr-4 py-2 bg-stone-100 border-none rounded-xl text-sm focus:ring-1 focus:ring-gold-500 outline-none disabled:cursor-not-allowed"
            />
          </div>
          
          <div className={`hidden lg:flex gap-1 bg-stone-100 p-1 rounded-xl transition-opacity ${isGuest ? 'opacity-50 pointer-events-none' : ''}`}>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  activeCategory === cat ? 'bg-white shadow-sm text-gold-600' : 'text-stone-400 hover:text-stone-600'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex gap-2 items-center">
             {isRefreshing && <RefreshCw size={14} className="text-gold-500 animate-spin" />}
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
      </div>

      <main className="max-w-7xl mx-auto p-4 md:p-8">
        {/* Guest Banner */}
        {isGuest && (
            <div className="mb-6 p-4 bg-stone-900 rounded-2xl text-white flex items-center justify-between shadow-xl animate-in fade-in slide-in-from-top-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gold-500 rounded-full animate-pulse"><Sparkles size={16} className="text-white" /></div>
                    <div>
                        <p className="font-bold text-sm">Preview Mode Active</p>
                        <p className="text-[10px] text-stone-400">Showing top 5 trending bespoke designs.</p>
                    </div>
                </div>
                <button onClick={() => navigate('/login')} className="bg-white text-stone-900 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-gold-50 transition">
                    Login
                </button>
            </div>
        )}

        <div className={`grid gap-6 ${
          viewMode === 'grid' 
          ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
          : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
        }`}>
          {visibleProducts.map(product => (
            <ProductCard 
              key={product.id} 
              product={product} 
              isAdmin={isAdmin} 
              onClick={() => navigate(`/product/${product.id}`)} 
            />
          ))}

          {/* The Trick: Blurred Card for Guests */}
          {isGuest && (
              <div 
                onClick={() => navigate('/login')}
                className="relative bg-white rounded-xl overflow-hidden shadow-sm border border-gold-200 cursor-pointer group h-[350px] flex flex-col items-center justify-center text-center p-6"
              >
                  {/* Blurred Background effect */}
                  <div className="absolute inset-0 bg-stone-200 filter blur-xl opacity-50 scale-110"></div>
                  <div className="absolute inset-0 bg-white/60 z-10"></div>
                  
                  <div className="relative z-20 flex flex-col items-center space-y-4">
                      <div className="w-16 h-16 bg-stone-900 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                          <Lock size={24} className="text-gold-500" />
                      </div>
                      <div>
                          <h3 className="font-serif text-xl font-bold text-stone-800">500+ Exclusive Designs</h3>
                          <p className="text-xs text-stone-500 mt-2 max-w-[200px] mx-auto">Register to unlock the full bespoke catalog, live pricing, and customization options.</p>
                      </div>
                      <button className="px-6 py-2 bg-gold-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-gold-200">
                          Unlock Access
                      </button>
                  </div>
              </div>
          )}
        </div>

        {visibleProducts.length === 0 && !isGuest && (
          <div className="h-64 flex flex-col items-center justify-center text-stone-400 border-2 border-dashed border-stone-200 rounded-3xl bg-white m-4">
            <Filter size={48} className="mb-4 opacity-20" />
            <p className="font-serif text-xl">No items found</p>
            <button onClick={() => { setSearch(''); setActiveCategory('All'); }} className="mt-4 text-gold-600 font-bold uppercase text-xs tracking-widest hover:underline">Clear Filters</button>
          </div>
        )}
      </main>

      {/* Sticky Bottom CTA for Guests */}
      {isGuest && (
          <div className="fixed bottom-[70px] md:bottom-8 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-auto z-50">
              <button 
                onClick={() => navigate('/login')}
                className="w-full md:w-auto bg-stone-900/95 backdrop-blur text-white pl-4 pr-6 py-3 rounded-full shadow-2xl flex items-center justify-between md:justify-center gap-4 border border-stone-700 animate-in slide-in-from-bottom-10"
              >
                  <div className="flex items-center gap-3">
                      <div className="bg-green-500 p-1.5 rounded-full"><UserPlus size={14} className="text-white"/></div>
                      <div className="text-left">
                          <p className="text-xs font-bold text-gold-500">Don't miss out</p>
                          <p className="text-[10px] text-stone-400">Join 1,200+ clients viewing live collections.</p>
                      </div>
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest bg-white text-stone-900 px-3 py-1 rounded-lg">Register</span>
              </button>
          </div>
      )}
    </div>
  );
};