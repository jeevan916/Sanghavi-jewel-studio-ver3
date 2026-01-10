
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Product, ProductStats } from '../types';
import { ArrowLeft, Share2, MessageCircle, Info, Tag, Heart, ShoppingBag, Gem, BarChart2, Loader2, Lock } from 'lucide-react';
import { ImageViewer } from '../components/ImageViewer';
import { storeService } from '../services/storeService';

export const ProductDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [stats, setStats] = useState<ProductStats>({ like: 0, dislike: 0, inquiry: 0, purchase: 0 });

  const user = storeService.getCurrentUser();
  const isGuest = !user;
  
  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const fetched = await storeService.getProductById(id);
        if (fetched) {
            // Stability: Backend sanitization is the first line, but frontend defense is the second.
            const safeProduct = {
                ...fetched,
                images: Array.isArray(fetched.images) ? fetched.images : [],
                thumbnails: Array.isArray(fetched.thumbnails) ? fetched.thumbnails : []
            };
            setProduct(safeProduct);
            setIsLiked(storeService.getLikes().includes(safeProduct.id));
            const pStats = await storeService.getProductStats(safeProduct.id);
            setStats(pStats);
            storeService.logEvent('view', safeProduct);
        }
      } catch (e) {
        console.error("Fetch error", e);
      } finally { setIsLoading(false); }
    };
    fetchData();
  }, [id]);

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-stone-50"><Loader2 className="animate-spin text-gold-600" size={40} /></div>;
  if (!product) return <div className="h-screen flex flex-col items-center justify-center bg-stone-50 p-6 text-center"><p className="text-stone-500 mb-4">Product not found.</p><button onClick={() => navigate('/collection')} className="text-gold-600 font-bold">Return to Gallery</button></div>;

  const images = product.images;
  const displayImages = isGuest ? images.slice(0, 1) : images;

  const toggleLike = () => {
      if (navigator.vibrate) navigator.vibrate(10);
      const liked = storeService.toggleLike(product.id);
      setIsLiked(liked);
      setStats(prev => ({...prev, like: liked ? prev.like + 1 : Math.max(0, prev.like - 1)}));
  };

  return (
    <div className="min-h-screen bg-stone-50 pb-20 animate-fade-in">
      <div className="bg-white/80 backdrop-blur-md border-b border-stone-200 px-4 h-16 flex items-center justify-between sticky top-0 z-30">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-stone-600"><ArrowLeft size={24} /></button>
        <h2 className="font-serif font-bold text-stone-800 text-lg truncate flex-1 px-4">{product.title}</h2>
        <button onClick={() => navigator.share?.({ title: product.title, url: window.location.href })} className="p-2 text-stone-600"><Share2 size={20} /></button>
      </div>

      <div className="relative aspect-square md:aspect-video bg-stone-200 overflow-hidden select-none">
        {displayImages.length > 0 ? (
            <img src={displayImages[0]} className="w-full h-full object-cover cursor-zoom-in" onClick={() => setShowFullScreen(true)} alt={product.title} />
        ) : (
            <div className="w-full h-full flex items-center justify-center text-stone-400 italic">No image available</div>
        )}
        
        {isGuest && images.length > 1 && (
            <div className="absolute bottom-4 right-4 bg-black/70 backdrop-blur text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2" onClick={() => navigate('/login')}>
                <Lock size={12} /> +{images.length - 1} Private Views Locked
            </div>
        )}
        <button onClick={toggleLike} className={`absolute top-4 right-4 p-3 rounded-full shadow-sm ${isLiked ? 'bg-red-500 text-white' : 'bg-white/70 text-stone-400'}`}>
                <Heart size={20} fill={isLiked ? "currentColor" : "none"} />
        </button>
      </div>
      
      <div className="max-w-3xl mx-auto p-6 space-y-6">
            <div>
                <span className="text-gold-600 text-xs font-bold uppercase tracking-widest">{product.category}</span>
                <h1 className="font-serif text-3xl text-stone-900 mt-1">{product.title}</h1>
                <div className="flex items-center gap-4 text-stone-500 text-sm mt-2">
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

            <div className="prose prose-stone max-w-none">
                <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2 mb-2"><Info size={16} /> Craftsmanship Story</h3>
                <p className="text-stone-600 leading-relaxed font-light">{product.description || "A bespoke masterpiece from the Sanghavi collection."}</p>
            </div>

            <button 
                onClick={() => isGuest ? navigate('/login') : storeService.shareToWhatsApp(product)} 
                className="w-full py-4 bg-gold-600 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
            >
                <MessageCircle size={20} /> {isGuest ? 'Login to Inquire' : 'Inquire on WhatsApp'}
            </button>
      </div>

      {showFullScreen && displayImages.length > 0 && (
        <ImageViewer images={displayImages} title={product.title} onClose={() => setShowFullScreen(false)} />
      )}
    </div>
  );
};
