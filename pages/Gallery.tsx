
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { storeService } from '../services/storeService';
import { Search, Grid, LayoutGrid, LogOut, Loader2, Filter, RefreshCw, Lock, Sparkles, UserPlus, TrendingUp, Clock, Heart, ShoppingBag, Gem, ChevronLeft, ChevronRight } from 'lucide-react';
import { Product, AnalyticsEvent } from '../types';

export const Gallery: React.FC = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'masonry'>('grid');
  
  // Pagination for Browse All
  const [browsePage, setBrowsePage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const user = storeService.getCurrentUser();
  const isAdmin = user?.role === 'admin' || user?.role === 'contributor';
  const isGuest = !user;

  const loadData = async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    else setIsRefreshing(true);
    
    try {
        const [prodData, analyticsData] = await Promise.all([
            storeService.getProducts(),
            storeService.getAnalytics()
        ]);
        setProducts(prodData);
        setAnalytics(analyticsData);
    } catch (e) {
        console.warn('Live sync failed');
    } finally {
        setIsLoading(false);
        setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(true), 30000);
    return () => clearInterval(interval);
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category));
    return ['All', ...Array.from(cats)];
  }, [products]);

  // --- Segmentation Logic ---

  const { trending, recent, desired, purchased, browseAll } = useMemo(() => {
    // 1. Calculate Scores
    const scores: Record<string, { views: number, likes: number, inquiries: number, sold: number, score: number }> = {};
    
    products.forEach(p => {
        scores[p.id] = { views: 0, likes: 0, inquiries: 0, sold: 0, score: 0 };
    });

    analytics.forEach(e => {
        if (!e.productId || !scores[e.productId]) return;
        if (e.type === 'view') scores[e.productId].views++;
        if (e.type === 'like') scores[e.productId].likes++;
        if (e.type === 'inquiry') scores[e.productId].inquiries++;
        if (e.type === 'sold') scores[e.productId].sold++;
    });

    // Calculate composite score for Trending
    Object.keys(scores).forEach(id => {
        const s = scores[id];
        // Weighting: Sold(10) > Inquiry(5) > Like(2) > View(0.5)
        s.score = (s.sold * 10) + (s.inquiries * 5) + (s.likes * 2) + (s.views * 0.5);
    });

    // Helper to filter hidden/private unless admin
    const availableProducts = products.filter(p => !p.isHidden || isAdmin);
    const featuredIds = new Set<string>();

    // 2. Define Groups
    
    // A. Trending (Top 10 by Score)
    const sortedByTrend = [...availableProducts].sort((a, b) => scores[b.id].score - scores[a.id].score);
    const trendingList = sortedByTrend.slice(0, 10);
    trendingList.forEach(p => featuredIds.add(p.id));

    // B. Recently Added (Top 10 by Date)
    const sortedByDate = [...availableProducts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const recentList = sortedByDate.slice(0, 10);
    recentList.forEach(p => featuredIds.add(p.id));

    // C. Most Desire (Top 10 by Inquiry)
    const sortedByDesire = [...availableProducts].sort((a, b) => scores[b.id].inquiries - scores[a.id].inquiries);
    const desiredList = sortedByDesire.filter(p => scores[p.id].inquiries > 0).slice(0, 10);
    desiredList.forEach(p => featuredIds.add(p.id));

    // D. Most Purchased (Top 10 by Sold)
    const sortedBySold = [...availableProducts].sort((a, b) => scores[b.id].sold - scores[a.id].sold);
    const purchasedList = sortedBySold.filter(p => scores[p.id].sold > 0).slice(0, 10);
    purchasedList.forEach(p => featuredIds.add(p.id));

    // E. Browse All (Remaining)
    // Filter out ANY product that appeared in the lists above
    const remaining = sortedByDate.filter(p => !featuredIds.has(p.id));

    return {
        trending: trendingList,
        recent: recentList,
        desired: desiredList,
        purchased: purchasedList,
        browseAll: remaining
    };
  }, [products, analytics, isAdmin]);


  // Determine if we are in "Search/Filter Mode" or "Dashboard Mode"
  const isFiltering = search.length > 0 || activeCategory !== 'All';

  // Get current viewable products based on mode
  const currentViewProducts = useMemo(() => {
      if (isFiltering) {
          return products.filter(p => {
            const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
            const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase());
            const visible = !p.isHidden || isAdmin;
            return matchesCategory && matchesSearch && visible;
          });
      }
      return []; // Not used in dashboard mode
  }, [isFiltering, products, activeCategory, search, isAdmin]);

  // Guest Logic
  const handleGuestInteraction = () => {
      if (confirm("Unlock our full bespoke collection?\n\nLogin securely with WhatsApp to view all 500+ designs and live pricing.")) {
          navigate('/login');
      }
  };

  // Scroll to top on page change
  useEffect(() => {
    if (!isFiltering) {
        // window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); // Optional: auto scroll
    }
  }, [browsePage]);


  if (isLoading) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50">
          <Loader2 className="animate-spin text-gold-600 mb-2" size={32} />
          <p className="text-stone-400 text-xs uppercase tracking-widest font-bold">Accessing Vault...</p>
        </div>
      );
  }

  const SectionHeader: React.FC<{ icon: any, title: string, subtitle?: string }> = ({ icon: Icon, title, subtitle }) => (
    <div className="flex items-center gap-3 mb-4 mt-8 px-1">
        <div className="p-2 bg-white rounded-full shadow-sm border border-stone-100 text-gold-600">
            <Icon size={20} />
        </div>
        <div>
            <h3 className="font-serif text-xl text-stone-800 font-bold">{title}</h3>
            {subtitle && <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">{subtitle}</p>}
        </div>
    </div>
  );

  const HorizontalScroll: React.FC<{ items: Product[] }> = ({ items }) => (
      <div className="flex overflow-x-auto gap-4 pb-6 -mx-4 px-4 scrollbar-hide snap-x snap-mandatory">
          {items.map(product => (
              <div key={product.id} className="min-w-[280px] w-[280px] snap-center">
                  <ProductCard product={product} isAdmin={isAdmin} onClick={() => navigate(`/product/${product.id}`)} />
              </div>
          ))}
          {items.length === 0 && (
              <div className="w-full text-center py-10 text-stone-400 text-sm italic bg-stone-100/50 rounded-xl border border-dashed border-stone-200">
                  Coming soon...
              </div>
          )}
      </div>
  );

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
                onClick={() => { setActiveCategory(cat); setBrowsePage(1); }}
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
             {isFiltering && (
                <button onClick={() => setViewMode(viewMode === 'grid' ? 'masonry' : 'grid')} className="p-2 text-stone-400 hover:text-gold-600 transition" title="Change View">
                    {viewMode === 'grid' ? <LayoutGrid size={20}/> : <Grid size={20}/>}
                </button>
             )}
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
            <div className="mb-8 p-4 bg-stone-900 rounded-2xl text-white flex items-center justify-between shadow-xl animate-in fade-in slide-in-from-top-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gold-500 rounded-full animate-pulse"><Sparkles size={16} className="text-white" /></div>
                    <div>
                        <p className="font-bold text-sm">Preview Mode Active</p>
                        <p className="text-[10px] text-stone-400">Login to unlock full catalog pricing.</p>
                    </div>
                </div>
                <button onClick={() => navigate('/login')} className="bg-white text-stone-900 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-gold-50 transition">
                    Login
                </button>
            </div>
        )}

        {isFiltering ? (
            /* --- FILTERED GRID VIEW --- */
            <div className={`grid gap-6 ${
              viewMode === 'grid' 
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
              : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
            }`}>
              {currentViewProducts.map(product => (
                <ProductCard key={product.id} product={product} isAdmin={isAdmin} onClick={() => navigate(`/product/${product.id}`)} />
              ))}
              {currentViewProducts.length === 0 && (
                  <div className="col-span-full h-64 flex flex-col items-center justify-center text-stone-400 border-2 border-dashed border-stone-200 rounded-3xl bg-white m-4">
                    <Filter size={48} className="mb-4 opacity-20" />
                    <p className="font-serif text-xl">No items found</p>
                    <button onClick={() => { setSearch(''); setActiveCategory('All'); }} className="mt-4 text-gold-600 font-bold uppercase text-xs tracking-widest hover:underline">Clear Filters</button>
                  </div>
              )}
            </div>
        ) : (
            /* --- DASHBOARD SECTIONS VIEW --- */
            <div className="space-y-8 animate-in fade-in duration-500">
                
                {/* 1. Trending (Limited for Guests) */}
                <section>
                    <SectionHeader icon={TrendingUp} title="Trending Now" subtitle="Most Engaged Designs" />
                    <HorizontalScroll items={isGuest ? trending.slice(0, 4) : trending} />
                </section>
                
                {/* GUEST LOCK WALL: Hides all other sections */}
                {isGuest ? (
                   <div className="relative mt-8 py-16 text-center border-t border-stone-200 overflow-hidden rounded-3xl bg-stone-100/50">
                       <div className="absolute inset-0 bg-white/40 backdrop-blur-md z-10 flex flex-col items-center justify-center p-6">
                           <div className="p-4 bg-stone-900 text-gold-500 rounded-full mb-4 shadow-xl">
                               <Lock size={32} />
                           </div>
                           <h3 className="font-serif text-3xl text-stone-900 mb-3 font-bold">Vault Access Restricted</h3>
                           <p className="text-stone-600 mb-8 max-w-md mx-auto leading-relaxed">
                               You are viewing a limited public preview. Join our exclusive client list to access the full 
                               <span className="font-bold text-stone-900"> {products.length}+ item collection</span>, 
                               view detailed pricing, and make inquiries.
                           </p>
                           <button onClick={() => navigate('/login')} className="bg-gold-600 text-white px-10 py-4 rounded-xl font-bold uppercase tracking-widest shadow-lg hover:bg-gold-700 transition transform hover:scale-105 active:scale-95">
                               Secure Client Login
                           </button>
                           <p className="mt-6 text-[10px] text-stone-400 uppercase tracking-widest font-bold">Verified by WhatsApp</p>
                       </div>
                       
                       {/* Fake Blurred Background Content to simulate depth */}
                       <div className="opacity-30 pointer-events-none filter blur-sm select-none grayscale flex flex-col gap-8">
                           <div>
                               <SectionHeader icon={Clock} title="Fresh Arrivals" subtitle="Just Added" />
                               <div className="flex gap-4 px-4 overflow-hidden">
                                   {[1,2,3,4].map(i => <div key={i} className="min-w-[280px] h-[350px] bg-stone-300 rounded-xl" />)}
                               </div>
                           </div>
                           <div>
                               <SectionHeader icon={Gem} title="Royal Collection" subtitle="Premium Sets" />
                               <div className="flex gap-4 px-4 overflow-hidden">
                                   {[1,2,3,4].map(i => <div key={i} className="min-w-[280px] h-[350px] bg-stone-300 rounded-xl" />)}
                               </div>
                           </div>
                       </div>
                   </div>
                ) : (
                    <>
                        {/* 2. Recently Added */}
                        <section>
                            <SectionHeader icon={Clock} title="Fresh Arrivals" subtitle="Just Added to Vault" />
                            <HorizontalScroll items={recent} />
                        </section>

                        {/* 3. Most Desired */}
                        <section>
                            <SectionHeader icon={ShoppingBag} title="Most Desired" subtitle="High Inquiry Volume" />
                            <HorizontalScroll items={desired} />
                        </section>

                        {/* 4. Most Purchased */}
                        <section>
                            <SectionHeader icon={Gem} title="Sanghavi Icons" subtitle="Most Purchased Collections" />
                            <HorizontalScroll items={purchased} />
                        </section>

                        {/* 5. Browse All (Paginated) */}
                        <section id="browse-all" className="pt-8 border-t border-stone-200 mt-8">
                            <div className="flex items-center justify-between mb-6">
                                <SectionHeader icon={Grid} title="Browse Collection" subtitle="Explore Full Catalog" />
                                <span className="text-xs text-stone-400 font-mono">
                                    Showing {(browsePage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(browsePage * ITEMS_PER_PAGE, browseAll.length)} of {browseAll.length}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {browseAll
                                    .slice((browsePage - 1) * ITEMS_PER_PAGE, browsePage * ITEMS_PER_PAGE)
                                    .map(product => (
                                        <ProductCard key={product.id} product={product} isAdmin={isAdmin} onClick={() => navigate(`/product/${product.id}`)} />
                                ))}
                            </div>

                            {/* Pagination Controls */}
                            {browseAll.length > ITEMS_PER_PAGE && (
                                <div className="flex justify-center gap-4 mt-12">
                                    <button 
                                        onClick={() => setBrowsePage(p => Math.max(1, p - 1))}
                                        disabled={browsePage === 1}
                                        className="p-3 rounded-full bg-white border border-stone-200 disabled:opacity-50 hover:border-gold-500 hover:text-gold-600 transition"
                                    >
                                        <ChevronLeft size={24} />
                                    </button>
                                    <div className="flex items-center px-6 bg-white border border-stone-200 rounded-full text-sm font-bold text-stone-600">
                                        Page {browsePage} of {Math.ceil(browseAll.length / ITEMS_PER_PAGE)}
                                    </div>
                                    <button 
                                        onClick={() => setBrowsePage(p => Math.min(Math.ceil(browseAll.length / ITEMS_PER_PAGE), p + 1))}
                                        disabled={browsePage >= Math.ceil(browseAll.length / ITEMS_PER_PAGE)}
                                        className="p-3 rounded-full bg-white border border-stone-200 disabled:opacity-50 hover:border-gold-500 hover:text-gold-600 transition"
                                    >
                                        <ChevronRight size={24} />
                                    </button>
                                </div>
                            )}
                        </section>
                    </>
                )}

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
