import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Product, AppConfig, ProductSuggestion } from '../types';
import { ArrowLeft, Share2, MessageCircle, Info, Tag, Calendar, ChevronLeft, ChevronRight, Edit2, Lock, Check, Eye, EyeOff, Sparkles, Eraser, Wand2, Loader2, SlidersHorizontal, Download, Trash2, Cpu, Smartphone, Heart, ThumbsDown, Send, MessageSquare, LogIn, ShoppingBag, Gem, BarChart2, DollarSign } from 'lucide-react';
import { ImageViewer } from '../components/ImageViewer';
import { ImageEditor } from '../components/ImageEditor';
import { storeService, ProductStats } from '../services/storeService';
import { removeWatermark, enhanceJewelryImage } from '../services/geminiService';

export const ProductDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const currentUser = storeService.getCurrentUser();
  const isAuthorized = currentUser?.role === 'admin' || currentUser?.role === 'contributor';
  const isGuest = !currentUser;
  
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageSlideDirection, setImageSlideDirection] = useState<'left' | 'right' | null>(null);
  
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [showAiMenu, setShowAiMenu] = useState(false);
  const [pendingEnhancedImage, setPendingEnhancedImage] = useState<string | null>(null);
  const [compareSliderPos, setCompareSliderPos] = useState(50);
  const [isManualEditing, setIsManualEditing] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editDescValue, setEditDescValue] = useState('');

  // Interactions
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const [isOwned, setIsOwned] = useState(false);
  const [isRequested, setIsRequested] = useState(false);
  const [suggestionText, setSuggestionText] = useState('');
  const [stats, setStats] = useState<ProductStats>({ like: 0, dislike: 0, inquiry: 0, purchase: 0 });

  // Navigation Context & Touch tracking
  const productContext = (location.state as any)?.productContext || [];
  const currentContextIndex = productContext.indexOf(id || '');
  const touchStart = useRef<{ x: number, y: number } | null>(null);

  useEffect(() => {
    setCurrentImageIndex(0);
    setImageSlideDirection(null);
    setIsLoading(true);
    
    const fetchData = async () => {
      try {
        if (!id) return;
        const fetchedProduct = await storeService.getProductById(id);
        if (fetchedProduct) {
            setProduct(fetchedProduct);
            setEditDescValue(fetchedProduct.description);
            setIsLiked(storeService.getLikes().includes(fetchedProduct.id));
            setIsDisliked(storeService.getDislikes().includes(fetchedProduct.id));
            setIsOwned(storeService.getOwned().includes(fetchedProduct.id));
            setIsRequested(storeService.getRequested().includes(fetchedProduct.id));
            
            const pStats = await storeService.getProductStats(fetchedProduct.id);
            setStats(pStats);
            storeService.logEvent('view', fetchedProduct);
        }
      } catch (err) {
        console.error("Fetch details error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleBack = () => {
    if (navigator.vibrate) navigator.vibrate(10);
    navigate(-1);
  };

  const navigateToSibling = (direction: 'next' | 'prev') => {
      if (currentContextIndex === -1) return;
      const targetId = direction === 'next' 
          ? productContext[currentContextIndex + 1] 
          : productContext[currentContextIndex - 1];
      
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
    
    // Threshold: 70px horizontal movement, and horizontal must be dominant
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
        <span className="font-serif text-sm text-stone-400 uppercase tracking-widest">Opening Vault...</span>
      </div>
    );
  }

  if (!product) return null;

  const productImages = isGuest ? product.images.slice(0, 1) : product.images;
  const getFullUrl = (path: string) => {
      if (!path) return '';
      if (path.startsWith('data:') || path.startsWith('http')) return path;
      return `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`;
  };

  const handleUpdateProduct = (updates: Partial<Product>) => {
      if (!product) return;
      const updatedProduct = { ...product, ...updates };
      setProduct(updatedProduct);
      storeService.updateProduct(updatedProduct);
  };

  const toggleLike = () => {
      if (!product) return;
      if (navigator.vibrate) navigator.vibrate(10);
      const liked = storeService.toggleLike(product.id);
      setIsLiked(liked);
      setStats(prev => ({...prev, like: liked ? prev.like + 1 : Math.max(0, prev.like - 1)}));
      if (liked) storeService.logEvent('like', product);
  };

  const displayPreview = getFullUrl(productImages[currentImageIndex] || product.thumbnails[currentImageIndex]);

  return (
    <div 
        className="min-h-screen bg-stone-50 overflow-y-auto pb-20 animate-in slide-in-from-right duration-500"
        onTouchStart={handleTouchStart} 
        onTouchEnd={handleTouchEnd}
    >
      <div className="bg-white/80 backdrop-blur-md border-b border-stone-200 px-4 h-16 flex items-center justify-between sticky top-0 z-30">
        <button onClick={handleBack} className="p-2 -ml-2 text-stone-600 hover:bg-stone-100 rounded-full transition-colors"><ArrowLeft size={24} /></button>
        <div className="flex-1 flex items-center gap-2 px-2 overflow-hidden">
            {product.isHidden && <Lock size={14} className="text-red-500 shrink-0" />}
            <h2 className="font-serif font-bold text-stone-800 text-lg truncate">{product.title}</h2>
        </div>
        <div className="flex gap-1 shrink-0">
            <button onClick={() => navigator.share?.({ title: product.title, url: window.location.href })} className="p-2 text-stone-600 hover:text-gold-600 rounded-full"><Share2 size={20} /></button>
        </div>
      </div>

      <div key={product.id} className="animate-in fade-in duration-500">
          <div className="relative aspect-square md:aspect-video bg-stone-200 overflow-hidden group select-none">
            <img 
                src={displayPreview} 
                className="w-full h-full object-cover" 
                onClick={() => setShowFullScreen(true)} 
            />
            {isGuest && product.images.length > 1 && (
               <button 
                 onClick={() => navigate('/login')}
                 className="absolute bottom-4 right-4 z-20 bg-black/70 backdrop-blur text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 border border-white/10"
               >
                   <Lock size={12} /> +{product.images.length - 1} Locked Photos
               </button>
            )}
            <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
                <button onClick={toggleLike} className={`p-3 rounded-full backdrop-blur shadow-sm transition-all ${isLiked ? 'bg-red-500 text-white' : 'bg-white/70 text-stone-400'}`}>
                     <Heart size={20} fill={isLiked ? "currentColor" : "none"} />
                </button>
            </div>
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
                <div className="bg-white border border-stone-200 rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-sm">
                    <Heart size={18} className="mb-1 text-red-400" fill={isLiked ? "currentColor" : "none"} />
                    <span className="font-bold text-lg text-stone-800">{stats.like}</span>
                    <span className="text-[9px] uppercase font-bold text-stone-400">Likes</span>
                </div>
                <div className="bg-white border border-stone-200 rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-sm">
                    <ShoppingBag size={18} className="mb-1 text-gold-600" />
                    <span className="font-bold text-lg text-stone-800">{stats.inquiry}</span>
                    <span className="text-[9px] uppercase font-bold text-stone-400">Inquiries</span>
                </div>
                <div className="bg-white border border-stone-200 rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-sm">
                    <Gem size={18} className="mb-1 text-blue-500" />
                    <span className="font-bold text-lg text-stone-800">{stats.purchase}</span>
                    <span className="text-[9px] uppercase font-bold text-stone-400">Sold</span>
                </div>
                <div className="bg-stone-100 border border-stone-200 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                    <BarChart2 size={18} className="mb-1 text-stone-400" />
                    <span className="font-bold text-sm text-stone-500">Live</span>
                    <span className="text-[9px] uppercase font-bold text-stone-400">Insights</span>
                </div>
             </div>

             <div className="prose prose-stone">
                 <h3 className="text-sm font-bold text-stone-400 uppercase tracking-wider flex items-center gap-2 mb-2"><Info size={16} /> Craftsmanship Story</h3>
                 <p className="text-stone-600 leading-relaxed text-lg font-light">{product.description}</p>
             </div>

             <div className="flex gap-4">
                <button 
                  onClick={() => isGuest ? navigate('/login') : storeService.shareToWhatsApp(product)} 
                  className="flex-1 py-4 bg-gold-600 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:bg-gold-700 transition active:scale-[0.98]"
                >
                  <MessageCircle size={20} /> {isGuest ? 'Login to Inquire' : 'Inquire on WhatsApp'}
                </button>
             </div>
          </div>
      </div>

      {showFullScreen && (
          <ImageViewer 
              images={productImages.map(getFullUrl)} 
              initialIndex={currentImageIndex} 
              title={product.title} 
              onClose={() => setShowFullScreen(false)}
          />
      )}
    </div>
  );
};