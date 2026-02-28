
import React from 'react';

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const Logo: React.FC<LogoProps> = ({ className = '', showText = true, size = 'md' }) => {
  const sizes = {
    sm: { img: 'h-12', title: 'text-xl', sub: 'text-[8px]' },
    md: { img: 'h-20', title: 'text-3xl', sub: 'text-[10px]' },
    lg: { img: 'h-32', title: 'text-5xl', sub: 'text-[14px]' }
  };

  const currentSize = sizes[size];

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <img 
        src="/logo.png" 
        alt="Sanghavi Jewellers" 
        className={`${currentSize.img} w-auto object-contain`}
      />
      {showText && (
        <div className="text-center leading-none mt-2">
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
