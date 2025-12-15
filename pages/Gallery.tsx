import React, { useState, useMemo, useEffect } from 'react';
import { ProductCard } from '../components/ProductCard';
import { storeService } from '../services/storeService';
import { Search, Folder, Tag, Calendar, Menu, X, Filter, Loader2 } from 'lucide-react';
import { Product } from '../types';

interface GalleryProps {
  onProductSelect?: (product: Product, list: Product[]) => void;
}

export const Gallery: React.FC<GalleryProps> = ({ onProductSelect }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const user = storeService.getCurrentUser();
  const isAdmin = user?.role === 'admin' || user?.role === 'contributor';

  useEffect(() => {
    storeService.getProducts().then(data => {
        setProducts(data);
        setIsLoading(false);
    });
  }, []);

  const categories = useMemo(() => {
    const counts: Record<string, number> = { 'All': products.length };
    products.forEach(p => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [products]);

  const allTags = useMemo(() => {
     const tags = new Set<string>();
     products.forEach(p => p.tags.forEach(t => tags.add(t)));
     return Array.from(tags).slice(0, 15);
  }, [products]);

  const years = useMemo(() => {
     const y = new Set<string>();
     products.forEach(p => {
         if (p.dateTaken) y.add(p.dateTaken.split('-')[0]);
     });
     return Array.from(y).sort().reverse();
  }, [products]);

  const filteredProducts = useMemo(() => {
      return products.filter(p => {
        const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
        const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase());
        const matchesTag = activeTag ? p.tags.includes(activeTag) : true;
        const visible = !p.isHidden || isAdmin;
        return matchesCategory && matchesSearch && matchesTag && visible;
      });
  }, [products, activeCategory, search, activeTag, isAdmin]);

  if (isLoading) {
      return <div className="min-h-screen flex items-center justify-center bg-stone-50"><Loader2 className="animate-spin text-gold-600" size={32} /></div>;
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col md:flex-row animate-fade-in pb-20 md:pb-0">
      <div className="md:hidden bg-white p-4 flex items-center justify-between border-b border-stone-200 sticky top-0 z-30">
          <div className="font-serif text-xl text-gold-700 font-bold">Sanghavi</div>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-stone-600">
             {isSidebarOpen ? <X /> : <Menu />}
          </button>
      </div>

      <aside className={`
          fixed md:sticky md:top-0 h-[calc(100vh-64px)] md:h-screen w-64 bg-white border-r border-stone-200 z-20 transition-transform duration-300 overflow-y-auto
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 top-16 md:top-0
      `}>
          <div className="p-6">
              <div className="hidden md:block mb-8">
                  <h1 className="font-serif text-2xl text-gold-700 font-bold">Sanghavi</h1>
                  <p className="text-xs tracking-widest text-gold-500 uppercase">Jewel Studio</p>
              </div>

              <div className="relative mb-8">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                  <input 
                      type="text" 
                      placeholder="Quick search..." 
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-gold-400"
                  />
              </div>

              <div className="mb-8">
                  <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Folder size={14} /> Albums
                  </h3>
                  <div className="space-y-1">
                      {categories.map(([cat, count]) => (
                          <button
                              key={cat}
                              onClick={() => { setActiveCategory(cat); setActiveTag(null); setIsSidebarOpen(false); }}
                              className={`w-full text-left px-3 py-2 rounded-lg text-sm flex justify-between items-center transition-colors ${
                                  activeCategory === cat 
                                  ? 'bg-gold-50 text-gold-800 font-medium' 
                                  : 'text-stone-600 hover:bg-stone-50'
                              }`}
                          >
                              <span>{cat}</span>
                              <span className="text-xs bg-white border border-stone-100 px-1.5 py-0.5 rounded-md text-stone-400">{count}</span>
                          </button>
                      ))}
                  </div>
              </div>

              <div className="mb-8">
                  <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Tag size={14} /> Popular Tags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                      {allTags.map(tag => (
                          <button
                              key={tag}
                              onClick={() => { setActiveTag(activeTag === tag ? null : tag); setIsSidebarOpen(false); }}
                              className={`text-xs px-2 py-1 rounded border transition-colors ${
                                  activeTag === tag
                                  ? 'bg-stone-800 text-white border-stone-800'
                                  : 'bg-white border-stone-200 text-stone-500 hover:border-gold-300'
                              }`}
                          >
                              {tag}
                          </button>
                      ))}
                  </div>
              </div>
          </div>
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto h-screen">
          <div className="mb-6 flex items-center gap-2 text-sm text-stone-500">
              <span className="cursor-pointer hover:text-gold-600" onClick={() => setActiveCategory('All')}>Home</span>
              <span>/</span>
              <span className="font-medium text-stone-800">{activeCategory}</span>
              {activeTag && (
                  <>
                    <span>/</span>
                    <span className="bg-stone-100 px-2 py-0.5 rounded text-stone-600 flex items-center gap-1">
                        #{activeTag} <button onClick={() => setActiveTag(null)}><X size={12}/></button>
                    </span>
                  </>
              )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.map(product => (
                  <ProductCard 
                    key={product.id} 
                    product={product} 
                    isAdmin={isAdmin} 
                    onClick={() => onProductSelect && onProductSelect(product, filteredProducts)}
                  />
              ))}
          </div>

          {filteredProducts.length === 0 && (
              <div className="h-64 flex flex-col items-center justify-center text-stone-400 border-2 border-dashed border-stone-200 rounded-2xl bg-white">
                  <Filter size={32} className="mb-2 opacity-50"/>
                  <p>No items found in this album.</p>
              </div>
          )}
      </main>

      {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-10 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          ></div>
      )}
    </div>
  );
};