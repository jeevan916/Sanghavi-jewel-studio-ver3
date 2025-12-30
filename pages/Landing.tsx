
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, ShieldCheck, Gem } from 'lucide-react';

export const Landing: React.FC = () => {
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Accents */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-gold-100/30 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-gold-200/20 rounded-full blur-[120px]"></div>
      
      <div className="max-w-2xl w-full text-center space-y-12 relative z-10 animate-in fade-in zoom-in-95 duration-700">
        <header className="space-y-4">
          <h1 className="font-serif text-6xl md:text-8xl text-stone-900 font-bold tracking-tight">Sanghavi</h1>
          <div className="flex items-center justify-center gap-4">
            <div className="h-px w-8 bg-gold-400"></div>
            <p className="font-sans text-[10px] md:text-xs tracking-[0.5em] text-gold-600 uppercase font-bold">Jewel Studio</p>
            <div className="h-px w-8 bg-gold-400"></div>
          </div>
        </header>

        <p className="text-stone-500 text-lg md:text-xl font-light leading-relaxed max-w-lg mx-auto">
          Where timeless luxury meets artificial intelligence. Explore a curated collection of bespoke jewelry.
        </p>

        <div className="flex flex-col gap-4 max-w-sm mx-auto">
          <Link to="/collection" className="group relative overflow-hidden bg-stone-900 text-white py-5 rounded-2xl font-bold text-lg shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98]">
            <span className="relative z-10 flex items-center justify-center gap-3">
              Explore Collection <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-gold-600 to-gold-400 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </Link>
          
          <Link to="/login" className="py-4 text-stone-600 font-bold text-sm uppercase tracking-widest hover:text-gold-600 transition-colors">
            Sign In for Custom Inquiry
          </Link>
        </div>

        <footer className="grid grid-cols-3 gap-8 pt-12 border-t border-stone-200/60">
          <div className="flex flex-col items-center gap-2">
            <Gem size={20} className="text-gold-500" />
            <span className="text-[10px] uppercase font-bold text-stone-400">Pure Gold</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Sparkles size={20} className="text-gold-500" />
            <span className="text-[10px] uppercase font-bold text-stone-400">AI Verified</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <ShieldCheck size={20} className="text-gold-500" />
            <span className="text-[10px] uppercase font-bold text-stone-400">Bespoke</span>
          </div>
        </footer>
      </div>
    </div>
  );
};
