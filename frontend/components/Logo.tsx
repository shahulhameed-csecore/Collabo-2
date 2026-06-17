import React from 'react';
import Link from 'next/link';

interface LogoProps {
  variant?: 'full' | 'icon' | 'monochrome';
  className?: string;
  size?: number;
  href?: string;
}

export function Logo({ variant = 'full', className = '', size = 28, href = '/' }: LogoProps) {
  const iconSvg = (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 32 32" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={`shrink-0 ${className}`}
    >
      <defs>
        <linearGradient id="emeraldGradient" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34d399" /> {/* emerald-400 */}
          <stop offset="1" stopColor="#059669" /> {/* emerald-600 */}
        </linearGradient>
      </defs>
      
      {/* Outer C shape representing communication/chat */}
      <path 
        d="M26 16C26 21.5228 21.5228 26 16 26C13.568 26 11.3387 25.1328 9.58579 23.6841L4 26L5.87413 21.0028C4.69756 19.3361 4 17.2483 4 15C4 9.47715 8.47715 5 14 5C19.5228 5 24 9.47715 24 15" 
        stroke={variant === 'monochrome' ? 'currentColor' : 'url(#emeraldGradient)'} 
        strokeWidth="3.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      {/* Inner connected dot/arc for collaboration */}
      <path 
        d="M20 15C20 18.3137 17.3137 21 14 21C11.5147 21 9.38318 19.4891 8.41162 17.3712" 
        stroke={variant === 'monochrome' ? 'currentColor' : '#10b981'} 
        strokeWidth="3.5" 
        strokeLinecap="round"
      />
      <circle 
        cx="20" 
        cy="15" 
        r="3.5" 
        fill={variant === 'monochrome' ? 'currentColor' : '#10b981'} 
      />
    </svg>
  );

  const content = (
    <div className={`flex items-center gap-2.5 ${variant !== 'icon' ? 'hover:opacity-90 transition-opacity' : ''}`}>
      {iconSvg}
      {variant === 'full' && (
        <span className="text-xl font-bold tracking-tight text-white font-sans" style={{ letterSpacing: '-0.02em' }}>
          Collabo
        </span>
      )}
    </div>
  );

  if (href) {
    return <Link href={href} className="inline-block">{content}</Link>;
  }

  return content;
}
