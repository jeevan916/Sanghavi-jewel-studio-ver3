
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { storeService } from '../services/storeService';
import { Search, Grid, LayoutGrid, LogOut, Loader2, Filter, RefreshCw } from 'lucide-react';
import { Product } from '../types';

export const Gallery: React.FC = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'masonry'>('grid');
  
  const user = storeService.getCurrentUser();
  const isAdmin = user?.role === 'admin' || user?.role === 'contributor';

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
    // Live Populate AJAX: Polling every 30 seconds
    const interval = setInterval(() => loadProducts(true), 30000);
    return () => clearInterval(interval);
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category));
    return ['All', ...Array.from(cats)];
  }, [products]);

  const filtered = useMemo(() => {
      return products.filter(p => {
        const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
        const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase());
        const visible = !p.isHidden || isAdmin;
        return matchesCategory && matchesSearch && visible;
      });
  }, [products, activeCategory, search, isAdmin]);

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
      <div className="sticky top-0 md:top-16 bg-white/80 backdrop-blur-md border-b border-stone-200 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
            <input 
              type="text" 
              placeholder="Search designs..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-stone-100 border-none rounded-xl text-sm focus:ring-1 focus:ring-gold-500 outline-none"
            />
          </div>
          
          <div className="hidden lg:flex gap-1 bg-stone-100 p-1 rounded-xl">
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
        <div className={`grid gap-6 ${
          viewMode === 'grid' 
          ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
          : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
        }`}>
          {filtered.map(product => (
            <ProductCard 
              key={product.id} 
              product={product} 
              isAdmin={isAdmin} 
              onClick={() => navigate(`/product/${product.id}`)} 
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="h-64 flex flex-col items-center justify-center text-stone-400 border-2 border-dashed border-stone-200 rounded-3xl bg-white m-4">
            <Filter size={48} className="mb-4 opacity-20" />
            <p className="font-serif text-xl">No items found</p>
            <button onClick={() => { setSearch(''); setActiveCategory('All'); }} className="mt-4 text-gold-600 font-bold uppercase text-xs tracking-widest hover:underline">Clear Filters</button>
          </div>
        )}
      </main>
    </div>
  );
};
