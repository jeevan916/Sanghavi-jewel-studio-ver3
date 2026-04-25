import React, { useEffect, useState } from 'react';
import { storeService } from '@/services/storeService';
import { ProductCard } from '@/components/ProductCard';
import { Product, User } from '@/types';
import { useNavigate } from 'react-router-dom';
import { Loader2, HeartCrack, Heart } from 'lucide-react';

interface WishlistProps {
  user: User | null;
}

export const Wishlist: React.FC<WishlistProps> = ({ user }) => {
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.role !== 'customer') {
      setIsLoading(false);
      return;
    }
    storeService.getWishlist(user.id).then(data => {
      setWishlist(data);
      setIsLoading(false);
    });
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen pt-24 pb-32 px-6 flex flex-col items-center justify-center text-center max-w-md mx-auto">
        <Heart className="text-stone-200 mb-6" size={64} />
        <h2 className="text-2xl font-bold font-sans text-brand-dark mb-3 uppercase tracking-widest">Your Private Collection</h2>
        <p className="text-stone-500 mb-8 text-sm">Sign in to curate your favorite pieces and track pricing updates.</p>
        <button onClick={() => navigate('/login')} className="bg-brand-dark text-white px-8 py-3.5 rounded-full font-bold uppercase tracking-widest text-[10px] w-full">Sign In to Continue</button>
      </div>
    );
  }

  if (isLoading) {
    return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-brand-gold" size={32} /></div>;
  }

  return (
    <div className="min-h-screen bg-stone-50 pt-24 pb-32 px-4 sm:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-10 text-center animate-fade-in">
          <h1 className="font-sans text-3xl font-bold text-brand-dark uppercase tracking-tighter mb-2">Your Wishlist</h1>
          <p className="text-[10px] text-stone-400 font-bold uppercase tracking-[0.2em]">{wishlist.length} Pieces Curated</p>
        </div>

        {wishlist.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-stone-100 shadow-sm">
            <HeartCrack className="text-stone-200 mb-4" size={48} />
            <p className="text-stone-400 font-serif italic mb-6">Your wishlist is currently empty.</p>
            <button onClick={() => navigate('/collection')} className="text-[10px] font-bold text-brand-dark uppercase tracking-widest border border-stone-200 px-6 py-2.5 rounded-full hover:bg-stone-50 transition-colors">Explore Collection</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
            {wishlist.map((pd, index) => (
              <ProductCard 
                key={pd.id} 
                product={pd} 
                priority={index < 4}
                isAdmin={false}
                onClick={() => navigate(`/product/${pd.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
