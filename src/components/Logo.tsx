
import React from 'react';

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const Logo: React.FC<LogoProps> = ({ className = '', showText = true, size = 'md' }) => {
  const sizes = {
    sm: { icon: 'h-8 w-8', title: 'text-xl', sub: 'text-[8px]' },
    md: { icon: 'h-12 w-12', title: 'text-3xl', sub: 'text-[10px]' },
    lg: { icon: 'h-20 w-20', title: 'text-5xl', sub: 'text-[14px]' }
  };

  const currentSize = sizes[size];

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      {/* The Gold Symbol (Simplified SVG representation) */}
      <div className={`${currentSize.icon} text-brand-gold mb-1`}>
        <svg viewBox="0 0 100 100" fill="currentColor" className="w-full h-full">
          <path d="M50 0 C60 20 80 20 100 0 C80 20 80 40 100 50 C80 40 60 40 50 60 C40 40 20 40 0 50 C20 40 20 20 0 0 C20 20 40 20 50 0 Z" opacity="0.8" />
          <path d="M50 100 C40 80 20 80 0 100 C20 80 20 60 0 50 C20 60 40 60 50 40 C60 60 80 60 100 50 C80 60 80 80 100 100 C80 80 60 80 50 100 Z" opacity="0.8" />
          <circle cx="50" cy="50" r="8" />
        </svg>
      </div>
      
      {showText && (
        <div className="text-center leading-none">
          <h1 className={`font-sans font-bold tracking-[0.15em] text-brand-red uppercase ${currentSize.title}`}>
            Sanghavi
          </h1>
          <p className={`font-serif italic text-brand-dark tracking-widest mt-0.5 ${currentSize.sub}`}>
            jewellers
          </p>
        </div>
      )}
    </div>
  );
};
