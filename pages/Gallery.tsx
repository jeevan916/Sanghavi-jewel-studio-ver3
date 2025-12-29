import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ProductCard } from '../components/ProductCard';
import { storeService } from '../services/storeService';
import { identifyJewelryFeatures } from '../services/geminiService';
import { Search, Folder, Tag, Menu, X, Filter, Loader2, LogIn, Upload, Camera, Image as ImageIcon, Sparkles } from 'lucide-react';
import { Product } from '../types';

interface GalleryProps {
  onProductSelect?: (product: Product, list: Product[]) => void;
}

interface VisualSearchState {
  category: string;
  material: string;
  styles: string[];
  previewUrl: string;
}

export const Gallery: React.FC<GalleryProps> = ({ onProductSelect }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Visual Search State
  const [visualSearch, setVisualSearch] = useState<VisualSearchState | null>(null);
  const [isVisualSearching, setIsVisualSearching] = useState(false);
  const imageSearchRef = useRef<HTMLInputElement>(null);
  
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

  // Handle Image Search Upload
  const handleImageSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsVisualSearching(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
        const base64 = ev.target?.result as string;
        try {
            const features = await identifyJewelryFeatures(base64.split(',')[1]);
            setVisualSearch({
                ...features,
                previewUrl: base64
            });
            // Auto-switch to appropriate visual category if it exists
            if (features.category && features.category !== 'Other') {
              setActiveCategory(features.category);
            }
        } catch (err) {
            alert("Could not analyze image for search. Please try a different photo.");
        } finally {
            setIsVisualSearching(false);
        }
    };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = '';
  };

  const filteredProducts = useMemo(() => {
      return products.filter(p => {
        const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
        const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase());
        const matchesTag = activeTag ? p.tags.includes(activeTag) : true;
        
        // Visual Search Logic:
        // If visual search is active, we check if materials match or if at least one style tag matches
        let matchesVisual = true;
        if (visualSearch) {
          const materialMatch = p.description.toLowerCase().includes(visualSearch.material.toLowerCase()) || 
                                p.tags.some(t => t.toLowerCase() === visualSearch.material.toLowerCase());
          
          const styleMatch = p.tags.some(t => visualSearch.styles.some(s => s.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(s.toLowerCase())));
          
          // We broaden the visual search if category matches
          matchesVisual = materialMatch || styleMatch;
        }

        const visible = !p.isHidden || isAdmin;
        return matchesCategory && matchesSearch && matchesTag && visible && matchesVisual;
      });
  }, [products, activeCategory, search, activeTag, isAdmin, visualSearch]);

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
          fixed md:sticky md:top-16 h-[calc(100vh-64px)] w-64 bg-white border-r border-stone-200 z-20 transition-transform duration-300 overflow-y-auto
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 top-16 md:top-16
      `}>
          <div className="p-6">
              <div className="hidden md:block mb-8">
                  <h1 className="font-serif text-2xl text-gold-700 font-bold">Sanghavi</h1>
                  <p className="text-xs tracking-widest text-gold-500 uppercase">Jewel Studio</p>
              </div>

              <div className="flex flex-col gap-2 mb-8">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                    <input 
                        type="text" 
                        placeholder="Quick search..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-10 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-gold-400"
                    />
                    <button 
                      onClick={() => imageSearchRef.current?.click()}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gold-500 hover:text-gold-600 transition"
                      title="Search by Image"
                    >
                      <Camera size={18} />
                    </button>
                </div>
                
                {/* Visual Search Indicator */}
                {visualSearch && (
                  <div className="mt-2 p-2 bg-gold-50 border border-gold-200 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <div className="relative w-10 h-10 rounded border border-gold-300 overflow-hidden shrink-0">
                      <img src={visualSearch.previewUrl} className="w-full h-full object-cover" alt="Search" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-gold-600 uppercase flex items-center gap-1">
                        <Sparkles size={8}/> Visual Similarity
                      </p>
                      <p className="text-[10px] text-stone-500 truncate">{visualSearch.material} {visualSearch.category}</p>
                    </div>
                    <button onClick={() => setVisualSearch(null)} className="text-stone-400 hover:text-red-500">
                      <X size={14} />
                    </button>
                  </div>
                )}

                {isVisualSearching && (
                  <div className="mt-2 p-2 bg-stone-50 border border-stone-100 rounded-lg flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin text-gold-500" />
                    <span className="text-[10px] text-stone-500 font-medium">Analyzing Search Image...</span>
                  </div>
                )}
                
                <input 
                  type="file" 
                  ref={imageSearchRef} 
                  onChange={handleImageSearch} 
                  className="hidden" 
                  accept="image/*" 
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

      <main className="flex-1 p-4 md:p-8 overflow-y-auto md:h-[calc(100vh-64px)] h-screen">
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
              {visualSearch && (
                <>
                  <span>/</span>
                  <span className="bg-gold-100 px-2 py-0.5 rounded text-gold-700 font-medium flex items-center gap-1">
                    <Sparkles size={12}/> Similar Visuals
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
              <div className="h-96 flex flex-col items-center justify-center text-stone-400 border-2 border-dashed border-stone-200 rounded-2xl bg-white p-8">
                  <Filter size={48} className="mb-4 opacity-50 text-gold-300"/>
                  <h3 className="text-xl font-serif text-stone-700 mb-2">No Matches Found</h3>
                  <p className="text-center max-w-sm mb-6">We couldn't find any items matching your current filters or visual search. Try broadening your selection.</p>
                  
                  <div className="flex gap-4">
                        <button 
                          onClick={() => {
                            setSearch('');
                            setActiveCategory('All');
                            setActiveTag(null);
                            setVisualSearch(null);
                          }}
                          className="flex items-center gap-2 px-6 py-2 bg-stone-100 text-stone-600 rounded-lg hover:bg-stone-200"
                        >
                            Reset All Filters
                        </button>
                  </div>
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