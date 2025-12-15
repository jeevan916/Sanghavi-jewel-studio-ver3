import React, { useState, useEffect, useRef } from 'react';
import { Product, AppConfig } from '../types';
import { ArrowLeft, Share2, MessageCircle, Info, Tag, Calendar, ChevronLeft, ChevronRight, Maximize2, Camera, Edit2, Lock, Link, Check, Plus, Upload, Eye, EyeOff } from 'lucide-react';
import { ImageViewer } from '../components/ImageViewer';
import { storeService } from '../services/storeService';

interface ProductDetailsProps {
  initialProduct: Product;
  productList: Product[];
  onClose: () => void;
}

export const ProductDetails: React.FC<ProductDetailsProps> = ({ initialProduct, productList, onClose }) => {
  const [product, setProduct] = useState(initialProduct);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [currentUser] = useState(storeService.getCurrentUser());
  const isAuthorized = currentUser?.role === 'admin' || currentUser?.role === 'contributor';
  
  // UI States
  const [isAnimating, setIsAnimating] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  // File Input for Adding Images
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setProduct(initialProduct);
    setGeneratedLink(null);
  }, [initialProduct]);

  useEffect(() => {
    // Fetch config for supplier list
    storeService.getConfig().then(setConfig);
  }, []);

  const currentIndex = productList.findIndex(p => p.id === product.id);
  const hasNext = currentIndex < productList.length - 1;
  const hasPrev = currentIndex > 0;

  const vibrate = () => {
    if (navigator.vibrate) navigator.vibrate(20);
  };

  // --- Actions ---

  const handleUpdateProduct = (updates: Partial<Product>) => {
      const updatedProduct = { ...product, ...updates };
      setProduct(updatedProduct);
      storeService.updateProduct(updatedProduct); // Fire and forget async
  };

  const handleAddImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
        const file = files[0];
        const reader = new FileReader();
        reader.onload = (ev) => {
            const base64 = ev.target?.result as string;
            const newImages = [...product.images, base64];
            handleUpdateProduct({ images: newImages });
        };
        reader.readAsDataURL(file);
    }
  };

  const generateSecretLink = async () => {
      const link = await storeService.createSharedLink(product.id, 'product');
      setGeneratedLink(link);
      navigator.clipboard.writeText(link);
  };

  // --- Navigation Logic ---
  const goToNext = () => {
    if (hasNext && !isAnimating) {
        vibrate();
        setSlideDirection('left');
        setIsAnimating(true);
        setTimeout(() => {
            setProduct(productList[currentIndex + 1]);
            setCurrentImageIndex(0);
            setGeneratedLink(null);
            setIsAnimating(false);
            setSlideDirection(null);
        }, 300);
    }
  };

  const goToPrev = () => {
    if (hasPrev && !isAnimating) {
        vibrate();
        setSlideDirection('right');
        setIsAnimating(true);
        setTimeout(() => {
            setProduct(productList[currentIndex - 1]);
            setCurrentImageIndex(0);
            setGeneratedLink(null);
            setIsAnimating(false);
            setSlideDirection(null);
        }, 300);
    }
  };

  // Swipe Gestures
  const touchStart = useRef<number | null>(null);
  const touchEnd = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    touchEnd.current = null;
    touchStart.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchEnd.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
    if (!touchStart.current || !touchEnd.current) return;
    const distance = touchStart.current - touchEnd.current;
    if (distance > 50) goToNext();
    if (distance < -50) goToPrev();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.title,
          text: product.description,
          url: window.location.href,
        });
      } catch (error) { console.log('Error sharing', error); }
    }
  };

  const handleInquiry = () => {
    const phone = config?.whatsappNumber ? config.whatsappNumber.replace(/\D/g, '') : '';
    const msg = `Hi, I am interested in ${product.title} (ID: ${product.id}).`;
    const url = phone 
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` 
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  let animationClass = "opacity-100 translate-x-0";
  if (isAnimating) {
    if (slideDirection === 'left') animationClass = "opacity-0 -translate-x-10";
    if (slideDirection === 'right') animationClass = "opacity-0 translate-x-10";
  }

  return (
    <div 
        className="fixed inset-0 z-40 bg-stone-50 overflow-y-auto animate-in slide-in-from-bottom-10 duration-300"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
    >
      {showFullScreen && (
          <ImageViewer 
            images={product.images} 
            initialIndex={currentImageIndex} 
            title={product.title}
            onClose={() => setShowFullScreen(false)} 
          />
      )}

      {/* --- Header --- */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-stone-200 px-4 h-16 flex items-center justify-between">
        <button onClick={onClose} className="p-2 -ml-2 text-stone-600 hover:text-stone-900 rounded-full hover:bg-stone-100">
            <ArrowLeft size={24} />
        </button>
        <div className="flex items-center gap-2 max-w-[60%]">
             {product.isHidden && <Lock size={14} className="text-red-500" />}
             <span className="font-serif font-bold text-stone-800 text-lg truncate">{product.title}</span>
        </div>
        <button onClick={handleShare} className="p-2 -mr-2 text-stone-600 hover:text-gold-600 rounded-full hover:bg-stone-100">
            <Share2 size={24} />
        </button>
      </div>

      <div className={`transition-all duration-300 ease-out ${animationClass}`}>
          {/* --- Main Image --- */}
          <div className="relative aspect-square md:aspect-video bg-stone-200 overflow-hidden group">
            <img 
                src={product.images[currentImageIndex]} 
                alt={product.title}
                className="w-full h-full object-cover"
                onClick={() => setShowFullScreen(true)}
            />
            
            {/* Image Dots */}
            {product.images.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 p-2 bg-black/20 rounded-full backdrop-blur">
                    {product.images.map((_, idx) => (
                        <button 
                            key={idx}
                            onClick={() => setCurrentImageIndex(idx)}
                            className={`w-2 h-2 rounded-full transition-all ${idx === currentImageIndex ? 'bg-white scale-125' : 'bg-white/50'}`}
                        />
                    ))}
                </div>
            )}

            <button onClick={() => setShowFullScreen(true)} className="absolute top-4 right-4 p-2 bg-white/20 backdrop-blur rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                <Maximize2 size={20} />
            </button>

            {/* Admin Add Image Button */}
            {isAuthorized && (
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute top-4 left-4 p-2 bg-gold-600 text-white rounded-full shadow-lg hover:bg-gold-700 z-10"
                >
                    <Camera size={20} />
                </button>
            )}
            <input type="file" ref={fileInputRef} onChange={handleAddImage} className="hidden" accept="image/*" />
            
            {hasPrev && <button onClick={(e) => { e.stopPropagation(); goToPrev(); }} className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full shadow-lg hidden md:block hover:bg-white"><ChevronLeft size={24} className="text-stone-800"/></button>}
            {hasNext && <button onClick={(e) => { e.stopPropagation(); goToNext(); }} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full shadow-lg hidden md:block hover:bg-white"><ChevronRight size={24} className="text-stone-800"/></button>}
          </div>

          {/* --- Product Info --- */}
          <div className="max-w-3xl mx-auto p-6 space-y-6">
             <div className="flex justify-between items-start">
                 <div>
                     <span className="text-gold-600 text-sm font-bold tracking-wider uppercase">{product.category}</span>
                     <h1 className="font-serif text-3xl text-stone-900 mt-1 mb-2">{product.title}</h1>
                     <div className="flex items-center gap-4 text-stone-500 text-sm">
                         <span className="flex items-center gap-1"><Tag size={14}/> {product.subCategory || product.category}</span>
                         <span>•</span>
                         <span>{product.weight} grams</span>
                     </div>
                 </div>
                 <div className="bg-stone-100 px-3 py-1 rounded text-xs font-mono text-stone-500">#{product.id.slice(-6)}</div>
             </div>

             {/* ADMIN CONTROLS */}
             {isAuthorized && (
                 <div className="bg-stone-800 p-4 rounded-xl text-white space-y-4">
                     <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider flex items-center gap-2">
                         <Lock size={12} /> Authorized Controls
                     </h3>
                     
                     {/* Supplier Dropdown */}
                     <div className="flex flex-col gap-1">
                         <label className="text-xs text-stone-400">Supplier</label>
                         <select 
                            value={product.supplier || ''}
                            onChange={(e) => handleUpdateProduct({supplier: e.target.value})}
                            className="bg-stone-700 border-none rounded p-2 text-sm text-white focus:ring-1 focus:ring-gold-500"
                         >
                             <option value="">Select Supplier</option>
                             {config?.suppliers.map(s => <option key={s.id} value={s.name}>{s.name} {s.isPrivate ? '(Private)' : ''}</option>)}
                         </select>
                     </div>

                     {/* Privacy & Link Gen */}
                     <div className="flex gap-2">
                         <button 
                            onClick={() => handleUpdateProduct({isHidden: !product.isHidden})}
                            className={`flex-1 py-2 rounded text-sm font-medium flex items-center justify-center gap-2 ${product.isHidden ? 'bg-red-500/20 text-red-200' : 'bg-stone-700'}`}
                         >
                             {product.isHidden ? <EyeOff size={16}/> : <Eye size={16}/>}
                             {product.isHidden ? 'Private' : 'Public'}
                         </button>
                         
                         <button 
                            onClick={generateSecretLink}
                            className="flex-[2] py-2 bg-gold-600 text-white rounded text-sm font-medium flex items-center justify-center gap-2 hover:bg-gold-700"
                         >
                             <Link size={16}/> {generatedLink ? 'Link Copied!' : 'Generate Secret Link'}
                         </button>
                     </div>
                     {generatedLink && (
                         <div className="text-[10px] text-stone-400 break-all bg-black/20 p-2 rounded">
                             {generatedLink}
                             <div className="mt-1 text-gold-400">Valid for {config?.linkExpiryHours || 24} hours.</div>
                         </div>
                     )}
                 </div>
             )}

             {/* Action Bar */}
             <div className="flex gap-4 border-b border-stone-100 pb-6">
                 <button onClick={handleInquiry} className="flex-1 bg-gold-600 text-white py-3.5 rounded-xl font-medium shadow-lg hover:bg-gold-700 transition flex items-center justify-center gap-2">
                     <MessageCircle size={20} /> Inquire via WhatsApp
                 </button>
             </div>

             {/* Description & Meta */}
             <div className="prose prose-stone">
                 <h3 className="text-sm font-bold text-stone-400 uppercase tracking-wider flex items-center gap-2 mb-2"><Info size={16} /> Description</h3>
                 <p className="text-stone-600 leading-relaxed text-lg font-light">{product.description}</p>
             </div>

             <div className="bg-stone-50 rounded-xl p-4 border border-stone-100 grid grid-cols-2 gap-4 text-sm">
                 <div>
                     <span className="block text-stone-400 text-xs uppercase font-bold mb-1">Date Added</span>
                     <div className="flex items-center gap-2 text-stone-700"><Calendar size={14} /> {product.dateTaken || new Date(product.createdAt).toLocaleDateString()}</div>
                 </div>
                 <div>
                     <span className="block text-stone-400 text-xs uppercase font-bold mb-1">Supplier</span>
                     <div className="text-stone-700 font-medium">{product.supplier || 'N/A'}</div>
                 </div>
                 {product.meta?.cameraModel && (
                     <div>
                         <span className="block text-stone-400 text-xs uppercase font-bold mb-1">Device / Camera</span>
                         <div className="flex items-center gap-2 text-stone-700"><Camera size={14} /> {product.meta.cameraModel}</div>
                     </div>
                 )}
                 <div className="col-span-2">
                     <span className="block text-stone-400 text-xs uppercase font-bold mb-1">Tags</span>
                     <div className="flex flex-wrap gap-2">
                         {product.tags.map(tag => <span key={tag} className="bg-white border border-stone-200 px-2 py-1 rounded text-xs text-stone-600">#{tag}</span>)}
                     </div>
                 </div>
             </div>
          </div>
      </div>
    </div>
  );
};