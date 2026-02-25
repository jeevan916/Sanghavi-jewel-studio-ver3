
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, ShieldCheck, Gem } from 'lucide-react';
import { Logo } from '@/components/Logo';

export const Landing: React.FC = () => {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Accents */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-brand-gold/5 rounded-full blur-[140px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-brand-red/5 rounded-full blur-[140px]"></div>
      
      <div className="max-w-3xl w-full text-center space-y-12 relative z-10 animate-fade-in">
        <header className="space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-gold/10 border border-brand-gold/20 text-brand-gold text-[10px] font-bold uppercase tracking-widest mb-4">
             <Sparkles size={12} /> The New Era of Bespoke Luxury
          </div>
          
          <Logo size="lg" className="mb-8" />
        </header>

        <p className="text-brand-dark/60 text-lg md:text-2xl font-serif italic leading-relaxed max-w-xl mx-auto">
          Where timeless high-jewelry artistry meets cutting-edge <span className="text-brand-red font-sans font-bold not-italic">Generative Intelligence</span>.
        </p>

        <div className="flex flex-col md:flex-row gap-4 max-w-sm mx-auto pt-4">
          <Link to="/collection" className="flex-1 group relative overflow-hidden bg-brand-dark text-white py-5 rounded-2xl font-bold text-lg shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98]">
            <span className="relative z-10 flex items-center justify-center gap-3">
              Explore Catalog <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-brand-red to-brand-gold opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </Link>
        </div>

        <div className="pt-8">
            <Link to="/login" className="py-2 text-brand-dark/40 font-bold text-[10px] uppercase tracking-[0.2em] hover:text-brand-red transition-colors border-b border-stone-100 inline-block">
              Secure Client Portal Access
            </Link>
        </div>

        <footer className="grid grid-cols-3 gap-8 pt-16 border-t border-stone-100">
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 bg-white rounded-2xl shadow-sm border border-stone-50"><Gem size={24} className="text-brand-gold" /></div>
            <span className="text-[10px] uppercase font-bold text-brand-dark/40 tracking-widest">Heritage Quality</span>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 bg-white rounded-2xl shadow-sm border border-stone-50"><Sparkles size={24} className="text-brand-gold" /></div>
            <span className="text-[10px] uppercase font-bold text-brand-dark/40 tracking-widest">AI Visualization</span>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 bg-white rounded-2xl shadow-sm border border-stone-50"><ShieldCheck size={24} className="text-brand-gold" /></div>
            <span className="text-[10px] uppercase font-bold text-brand-dark/40 tracking-widest">Global Concierge</span>
          </div>
        </footer>
      </div>
    </div>
  );
};
