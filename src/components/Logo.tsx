
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
      <svg 
        viewBox="0 0 100 100" 
        className={`${currentSize.img} w-auto object-contain drop-shadow-sm`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <path id="petalR" d="M 52 42 C 65 35, 65 15, 52 5 C 58 15, 58 30, 52 42 Z" fill="#D4AF37"/>
          <path id="petalL" d="M 48 42 C 35 35, 35 15, 48 5 C 42 15, 42 30, 48 42 Z" fill="#D4AF37"/>
        </defs>
        <use href="#petalR" />
        <use href="#petalL" />
        <use href="#petalR" transform="rotate(90 50 50)" />
        <use href="#petalL" transform="rotate(90 50 50)" />
        <use href="#petalR" transform="rotate(180 50 50)" />
        <use href="#petalL" transform="rotate(180 50 50)" />
        <use href="#petalR" transform="rotate(270 50 50)" />
        <use href="#petalL" transform="rotate(270 50 50)" />
      </svg>
      {showText && (
        <div className="text-center leading-none mt-3">
          <h1 className={`font-sans font-bold tracking-[0.15em] text-[#E31E24] uppercase ${currentSize.title}`}>
            Sanghavi
          </h1>
          <p className={`font-serif font-light text-stone-500 tracking-[0.25em] mt-1 ${currentSize.sub}`}>
            jewellers
          </p>
        </div>
      )}
    </div>
  );
};
