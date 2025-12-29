
import React, { useState } from 'react';
import { Product } from '../types';
import { Share2, MessageCircle, ChevronLeft, ChevronRight, Camera, User, Calendar, Box, Maximize2 } from 'lucide-react';
import { storeService } from '../services/storeService';

interface ProductCardProps {
  product: Product;
  isAdmin: boolean;
  onClick?: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, isAdmin, onClick }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.title,
          text: product.description,
          url: window.location.href,
        });
      } catch (error) {
        console.log('Error sharing', error);
      }
    }
  };

  const handleInquiry = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const config = await storeService.getConfig();
    const phone = config.whatsappNumber ? config.whatsappNumber.replace(/\D/g, '') : '';
    const msg = `Hi, I am interested in ${product.title} (ID: ${product.id}).`;
    const url = phone 
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` 
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % product.images.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + product.images.length) % product.images.length);
  };

  const mainImage = product.images?.[currentImageIndex] || product.images?.[0];

  return (
    <div 
        className="bg-white rounded-xl overflow-hidden shadow-sm border border-stone-100 group transition-all hover:shadow-md flex flex-col h-full cursor-pointer"
        onClick={onClick}
    >
      {/* Image Carousel */}
      <div className="relative aspect-square overflow-hidden bg-stone-100 group/image">
        <img 
          src={mainImage} 
          alt={product.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover/image:scale-105"
          loading="lazy"
        />
        
        {/* Hover Overlay Icon */}
        <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/10 transition-colors flex items-center justify-center">
            <Maximize2 className="text-white opacity-0 group-hover/image:opacity-100 transition-opacity drop-shadow-md" size={32} />
        </div>

        {/* Navigation Arrows */}
        {product.images.length > 1 && (
          <>
            <button 
              onClick={prevImage}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 p-1 rounded-full shadow-sm opacity-0 group-hover/image:opacity-100 transition-opacity hover:bg-white z-10"
            >
              <ChevronLeft size={16} />
            </button>
            <button 
              onClick={nextImage}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 p-1 rounded-full shadow-sm opacity-0 group-hover/image:opacity-100 transition-opacity hover:bg-white z-10"
            >
              <ChevronRight size={16} />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
              {product.images.map((_, idx) => (
                <div 
                  key={idx} 
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${idx === currentImageIndex ? 'bg-white' : 'bg-white/50'}`}
                />
              ))}
            </div>
          </>
        )}

        {/* Camera Model - Visible to All */}
        {product.meta.cameraModel && (
             <span className="absolute top-2 right-2 bg-black/50 backdrop-blur text-white text-[10px] px-2 py-1 rounded-full flex items-center gap-1 z-10">
               <Camera size={10} />
               {product.meta.cameraModel}
             </span>
        )}
      </div>
      
      <div className="p-4 flex flex-col flex-grow">
        <div className="mb-1">
          <h3 className="font-serif text-lg text-stone-800 leading-tight">{product.title}</h3>
        </div>
        
        <div className="flex items-center flex-wrap gap-2 text-xs uppercase tracking-wide text-stone-500 mb-3">
          <span className="font-bold text-gold-600">{product.category}</span>
          {product.subCategory && (
            <>
              <span className="text-stone-300">•</span>
              <span>{product.subCategory}</span>
            </>
          )}
          <span className="text-stone-300">•</span>
          <span>{product.weight}g</span>
        </div>
        
        <p className="text-stone-600 text-sm line-clamp-2 mb-4 font-light">
          {product.description}
        </p>

        {/* Admin / Internal Details Section */}
        {isAdmin && (
            <div className="mt-auto mb-4 pt-3 border-t border-dashed border-stone-200 text-xs text-stone-400 space-y-1">
                <div className="flex justify-between">
                    <span className="flex items-center gap-1"><User size={10} /> By: {product.uploadedBy || 'Unknown'}</span>
                    <span className="flex items-center gap-1"><Calendar size={10} /> Taken: {product.dateTaken || 'N/A'}</span>
                </div>
                {product.supplier && (
                    <div className="flex items-center gap-1 text-stone-500 font-medium">
                        <Box size={10} /> Supplier: {product.supplier}
                    </div>
                )}
            </div>
        )}

        {/* Actions */}
        <div className={`flex gap-2 ${!isAdmin ? 'mt-auto' : ''}`}>
          <button 
            onClick={handleInquiry}
            className="flex-1 bg-gold-600 text-white text-sm py-2 px-4 rounded-lg hover:bg-gold-700 transition flex items-center justify-center gap-2"
          >
            <MessageCircle size={16} />
            Inquire
          </button>
          <button 
            onClick={handleShare}
            className="p-2 text-stone-400 hover:text-gold-600 border border-stone-200 rounded-lg"
          >
            <Share2 size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
