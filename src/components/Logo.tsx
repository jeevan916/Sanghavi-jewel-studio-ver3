
import React from 'react';

interface LogoProps {
  className?: string;
  showText?: boolean; // Kept for prop compatibility
  size?: 'sm' | 'md' | 'lg';
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 'md' }) => {
  const sizes = {
    sm: 'h-8 md:h-12',
    md: 'h-16 md:h-24',
    lg: 'h-24 md:h-32'
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <img 
        src="/api/settings/logo.png" 
        alt="Sanghavi Jewellers" 
        className={`${sizes[size]} w-auto object-contain drop-shadow-sm`}
        onError={(e) => {
          (e.target as HTMLImageElement).src = '/logo.png';
        }}
      />
    </div>
  );
};
