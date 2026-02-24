
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, ShieldCheck, Gem } from 'lucide-react';

export const Landing: React.FC = () => {
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Accents */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-gold-100/30 rounded-full blur-[140px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-gold-200/20 rounded-full blur-[140px]"></div>
      
      <div className="max-w-3xl w-full text-center space-y-12 relative z-10 animate-in fade-in zoom-in-95 duration-1000">
        <header className="space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold-50 border border-gold-100 text-gold-600 text-[10px] font-bold uppercase tracking-widest mb-4">
             <Sparkles size={12} /> The New Era of Bespoke Luxury
          </div>
          <h1 className="font-serif text-6xl md:text-9xl text-stone-900 font-bold tracking-tight leading-none">Sanghavi</h1>
          <div className="flex items-center justify-center gap-4">
            <div className="h-px w-12 bg-gold-400"></div>
            <p className="font-sans text-[10px] md:text-sm tracking-[0.6em] text-gold-600 uppercase font-bold">Jewel Studio</p>
            <div className="h-px w-12 bg-gold-400"></div>
          </div>
        </header>

        <p className="text-stone-500 text-lg md:text-2xl font-light leading-relaxed max-w-xl mx-auto">
          Where timeless high-jewelry artistry meets cutting-edge <span className="text-stone-900 font-medium">Generative Intelligence</span>.
        </p>

        <div className="flex flex-col md:flex-row gap-4 max-w-sm mx-auto">
          <Link to="/collection" className="flex-1 group relative overflow-hidden bg-stone-900 text-white py-5 rounded-2xl font-bold text-lg shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98]">
            <span className="relative z-10 flex items-center justify-center gap-3">
              Explore Catalog <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-gold-600 to-gold-400 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </Link>
        </div>

        <div className="pt-8">
            <Link to="/login" className="py-2 text-stone-400 font-bold text-[10px] uppercase tracking-[0.2em] hover:text-gold-600 transition-colors border-b border-stone-200 inline-block">
              Secure Client Portal Access
            </Link>
        </div>

        <footer className="grid grid-cols-3 gap-8 pt-16 border-t border-stone-200/60">
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 bg-white rounded-2xl shadow-sm"><Gem size={24} className="text-gold-500" /></div>
            <span className="text-[10px] uppercase font-bold text-stone-400 tracking-widest">Heritage Quality</span>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 bg-white rounded-2xl shadow-sm"><Sparkles size={24} className="text-gold-500" /></div>
            <span className="text-[10px] uppercase font-bold text-stone-400 tracking-widest">AI Visualization</span>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 bg-white rounded-2xl shadow-sm"><ShieldCheck size={24} className="text-gold-500" /></div>
            <span className="text-[10px] uppercase font-bold text-stone-400 tracking-widest">Global Concierge</span>
          </div>
        </footer>
      </div>
    </div>
  );
};
