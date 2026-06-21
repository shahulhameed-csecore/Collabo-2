import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface LogoProps {
  variant?: 'full' | 'icon' | 'monochrome';
  className?: string;
  size?: number;
  href?: string;
}

export function Logo({ variant = 'full', className = '', size = 32, href = '/' }: LogoProps) {
  const isIcon = variant === 'icon' || variant === 'monochrome';

  // Use explicit pixel dimensions — more reliable than `fill` on Vercel production
  const imgWidth = isIcon ? size : Math.round(size * 3.8);
  const imgHeight = size;

  const src = isIcon ? '/logo-icon.png' : '/logo-full.png';

  const content = (
    <Image
      src={src}
      alt="Collabo"
      width={imgWidth}
      height={imgHeight}
      className={`object-contain shrink-0 ${variant !== 'icon' ? 'hover:opacity-90 transition-opacity' : ''} ${className}`}
      priority
    />
  );

  // Only wrap in Link if href is a non-empty string
  if (href && href.length > 0) {
    return (
      <Link href={href} className="inline-flex items-center shrink-0">
        {content}
      </Link>
    );
  }

  return content;
}
