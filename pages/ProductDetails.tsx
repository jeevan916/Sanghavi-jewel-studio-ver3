
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Product, AppConfig, ProductSuggestion } from '../types';
import { ArrowLeft, Share2, MessageCircle, Info, Tag, Calendar, ChevronLeft, ChevronRight, Lock, Heart, ShoppingBag, Gem, BarChart2, Loader2 } from 'lucide-react';
import { ImageViewer } from '../components/ImageViewer';
import { storeService, ProductStats } from '../services/storeService';

export const ProductDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [stats, setStats] = useState<ProductStats>({ like: 0, dislike: 0, inquiry: 0, purchase: 0 });

  const user = storeService.getCurrentUser();
  const isGuest = !user;
  
  // Gestures and Context
  const productContext = (location.state as any)?.productContext || [];
  const currentContextIndex = productContext.indexOf(id || '');
  const touchStart = useRef<{ x: number, y: number } | null>(null);

  useEffect(() => {
    setIsLoading(true);
    const fetchData = async () => {
      if (!id) return;
      const fetchedProduct = await storeService.getProductById(id);
      if (fetchedProduct) {
          setProduct(fetchedProduct);
          setIsLiked(storeService.getLikes().includes(fetchedProduct.id));
          const pStats = await storeService.getProductStats(fetchedProduct.id);
          setStats(pStats);
          storeService.logEvent('view', fetchedProduct);
      }
      setIsLoading(false);
    };
    fetchData();
  }, [id]);

  const navigateToSibling = (direction: 'next' | 'prev') => {
      if (currentContextIndex === -1) return;
      const targetId = direction === 'next' ? productContext[currentContextIndex + 1] : productContext[currentContextIndex - 1];
      if (targetId) {
          if (navigator.vibrate) navigator.vibrate(15);
          navigate(`/product/${targetId}`, { state: location.state, replace: true });
      }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) navigateToSibling('prev');
        else navigateToSibling('next');
    }
    touchStart.current = null;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50">
        <Loader2 className="animate-spin text-gold-600 mb-4" size={40} />
      </div>
    );
  }

  if (!product) return null;

  // Strict Privacy: Demo users only see image index 0
  const productImages = isGuest ? product.images.slice(0, 1) : product.images;
  const getFullUrl = (path: string) => {
      if (!path) return '';
      if (path.startsWith('data:') || path.startsWith('http')) return path;
      return `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`;
  };

  const toggleLike = () => {
      if (navigator.vibrate) navigator.vibrate(10);
      const liked = storeService.toggleLike(product.id);
      setIsLiked(liked);
      setStats(prev => ({...prev, like: liked ? prev.like + 1 : Math.max(0, prev.like - 1)}));
  };

  return (
    <div className="min-h-screen bg-stone-50 pb-20 animate-in slide-in-from-right duration-500" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="bg-white/80 backdrop-blur-md border-b border-stone-200 px-4 h-16 flex items-center justify-between sticky top-0 z-30">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-stone-600"><ArrowLeft size={24} /></button>
        <h2 className="font-serif font-bold text-stone-800 text-lg truncate flex-1 px-4">{product.title}</h2>
        <button onClick={() => navigator.share?.({ title: product.title, url: window.location.href })} className="p-2 text-stone-600"><Share2 size={20} /></button>
      </div>

      <div key={product.id} className="animate-in fade-in duration-500">
          <div className="relative aspect-square md:aspect-video bg-stone-200 overflow-hidden select-none">
            <img src={getFullUrl(productImages[0])} className="w-full h-full object-cover" onClick={() => setShowFullScreen(true)} />
            {isGuest && product.images.length > 1 && (
               <div className="absolute bottom-4 right-4 bg-black/70 backdrop-blur text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 border border-white/10" onClick={() => navigate('/login')}>
                   <Lock size={12} /> +{product.images.length - 1} Private Views Locked
               </div>
            )}
            <button onClick={toggleLike} className={`absolute top-4 right-4 p-3 rounded-full backdrop-blur shadow-sm ${isLiked ? 'bg-red-500 text-white' : 'bg-white/70 text-stone-400'}`}>
                 <Heart size={20} fill={isLiked ? "currentColor" : "none"} />
            </button>
          </div>
          
          <div className="max-w-3xl mx-auto p-6 space-y-6">
             <div>
                 <span className="text-gold-600 text-xs font-bold tracking-wider uppercase">{product.category}</span>
                 <h1 className="font-serif text-2xl md:text-3xl text-stone-900 mt-1 mb-2 leading-tight">{product.title}</h1>
                 <div className="flex items-center gap-4 text-stone-500 text-sm">
                     <span className="flex items-center gap-1"><Tag size={14}/> {product.subCategory || 'Bespoke'}</span>
                     <span>•</span>
                     <span>{product.weight}g</span>
                 </div>
             </div>

             <div className="grid grid-cols-4 gap-2">
                {[
                  { icon: Heart, label: 'Likes', val: stats.like, color: 'text-red-400' },
                  { icon: ShoppingBag, label: 'Inquiries', val: stats.inquiry, color: 'text-gold-600' },
                  { icon: Gem, label: 'Sold', val: stats.purchase, color: 'text-blue-500' },
                  { icon: BarChart2, label: 'Trend', val: 'High', color: 'text-stone-400' }
                ].map((s, idx) => (
                  <div key={idx} className="bg-white border border-stone-200 rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-sm">
                      <s.icon size={18} className={`mb-1 ${s.color}`} />
                      <span className="font-bold text-stone-800">{s.val}</span>
                      <span className="text-[9px] uppercase font-bold text-stone-400">{s.label}</span>
                  </div>
                ))}
             </div>

             <div className="prose prose-stone">
                 <h3 className="text-sm font-bold text-stone-400 uppercase tracking-wider flex items-center gap-2 mb-2"><Info size={16} /> Craftsmanship Story</h3>
                 <p className="text-stone-600 leading-relaxed text-lg font-light">{product.description}</p>
             </div>

             <button 
               onClick={() => isGuest ? navigate('/login') : storeService.shareToWhatsApp(product)} 
               className="w-full py-4 bg-gold-600 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
             >
               <MessageCircle size={20} /> {isGuest ? 'Login to Inquire' : 'Inquire on WhatsApp'}
             </button>
          </div>
      </div>

      {showFullScreen && <ImageViewer images={productImages.map(getFullUrl)} title={product.title} onClose={() => setShowFullScreen(false)} />}
    </div>
  );
};
