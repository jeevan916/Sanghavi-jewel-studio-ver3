import React from 'react';

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  lightText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 'md', showText = true, lightText = false }) => {
  const sizes = {
    sm: 'h-8 md:h-12',
    md: 'h-16 md:h-24',
    lg: 'h-24 md:h-32',
    xl: 'h-32 md:h-48'
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-2 group ${className}`}>
      <div className="relative">
        <div className="absolute inset-0 bg-brand-gold/10 blur-xl rounded-full scale-150 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
        <img 
          src="/api/settings/logo.png" 
          alt="Sanghavi Jewellers Logo" 
          className={`${sizes[size]} w-auto object-contain drop-shadow-md group-hover:scale-105 transition-transform duration-500 relative z-10`}
          referrerPolicy="no-referrer"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.onerror = null;
            target.src = 'https://cdn-icons-png.flaticon.com/512/2611/2611152.png';
          }}
        />
      </div>
      {showText && (
         <div className="flex flex-col items-center">
            <span className={`font-serif text-lg md:text-xl tracking-[0.2em] uppercase font-bold ${lightText ? 'text-white' : 'text-brand-dark'}`}>Sanghavi</span>
            <span className={`font-sans text-[10px] md:text-xs tracking-[0.4em] uppercase ${lightText ? 'text-white/60' : 'text-stone-400'}`}>Jewel Studio</span>
         </div>
      )}
    </div>
  );
};
