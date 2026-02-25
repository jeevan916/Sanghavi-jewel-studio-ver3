
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, ShieldCheck, Gem, ChevronRight } from 'lucide-react';
import { Logo } from '@/components/Logo';

export const Landing: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col relative overflow-hidden font-sans">
      {/* Immersive Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black z-10"></div>
        <img 
          src="https://picsum.photos/seed/jewelry-hero/1920/1080?blur=2" 
          alt="Luxury Background" 
          className="w-full h-full object-cover opacity-40 scale-105 animate-pulse"
          referrerPolicy="no-referrer"
        />
        {/* Animated Orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-gold/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-red/5 rounded-full blur-[120px]"></div>
      </div>

      {/* Navigation Rail / Header */}
      <header className="relative z-20 flex items-center justify-between px-8 py-6">
        <Logo size="sm" showText={false} className="opacity-80 hover:opacity-100 transition-opacity" />
        <div className="hidden md:flex items-center gap-8">
          <Link to="/collection" className="text-[10px] uppercase tracking-[0.3em] font-bold text-white/60 hover:text-brand-gold transition-colors">Collection</Link>
          <Link to="/login" className="text-[10px] uppercase tracking-[0.3em] font-bold text-white/60 hover:text-brand-gold transition-colors">Client Portal</Link>
        </div>
      </header>
      
      <main className="flex-1 flex flex-col items-center justify-center px-6 relative z-10 text-center">
        <div className="max-w-4xl space-y-12 animate-fade-in">
          <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md text-brand-gold text-[10px] font-bold uppercase tracking-[0.4em] mb-4">
             <Sparkles size={12} /> The Future of Bespoke Artistry
          </div>
          
          <div className="space-y-4">
            <h1 className="text-6xl md:text-8xl lg:text-9xl font-sans font-bold tracking-tighter leading-[0.85] uppercase">
              Crafted <br /> 
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-gold via-white to-brand-gold">Intelligence</span>
            </h1>
            <p className="text-white/40 text-lg md:text-2xl font-serif italic leading-relaxed max-w-2xl mx-auto">
              Where heritage jewelry craftsmanship meets the precision of <span className="text-white font-sans font-bold not-italic">Generative AI</span>.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-6 justify-center pt-8">
            <Link to="/collection" className="group relative px-12 py-5 bg-white text-black rounded-full font-bold text-sm uppercase tracking-widest transition-all hover:scale-105 active:scale-95 overflow-hidden">
              <span className="relative z-10 flex items-center gap-3">
                Enter Studio <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </span>
              <div className="absolute inset-0 bg-brand-gold opacity-0 group-hover:opacity-10 transition-opacity"></div>
            </Link>
            
            <Link to="/login" className="group px-12 py-5 bg-white/5 border border-white/10 backdrop-blur-md text-white rounded-full font-bold text-sm uppercase tracking-widest transition-all hover:bg-white/10 active:scale-95">
              Client Login
            </Link>
          </div>
        </div>
      </main>

      <footer className="relative z-20 px-8 py-12 border-t border-white/5 bg-black/40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 items-center">
          <div className="flex items-center gap-6">
            <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center text-brand-gold">
              <Gem size={20} />
            </div>
            <div>
              <h4 className="text-[10px] uppercase font-bold tracking-widest text-white/40 mb-1">Heritage</h4>
              <p className="text-xs text-white/80 font-serif italic">Uncompromising Quality</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center text-brand-gold">
              <Sparkles size={20} />
            </div>
            <div>
              <h4 className="text-[10px] uppercase font-bold tracking-widest text-white/40 mb-1">Innovation</h4>
              <p className="text-xs text-white/80 font-serif italic">AI-Powered Visualization</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center text-brand-gold">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h4 className="text-[10px] uppercase font-bold tracking-widest text-white/40 mb-1">Security</h4>
              <p className="text-xs text-white/80 font-serif italic">Private Vault Access</p>
            </div>
          </div>
        </div>
      </footer>

      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 p-8 opacity-20 pointer-events-none">
        <div className="text-[120px] font-bold leading-none select-none">SJ</div>
      </div>
    </div>
  );
};
