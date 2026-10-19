import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface LogoProps {
  variant?: 'full' | 'icon' | 'monochrome';
  className?: string;
  size?: number;
  href?: string;
  theme?: 'auto' | 'dark' | 'light';
}

export function Logo({ variant = 'full', className = '', size = 32, href = '/', theme = 'auto' }: LogoProps) {
  const isIcon = variant === 'icon' || variant === 'monochrome';

  // Use explicit pixel dimensions — more reliable than `fill` on Vercel production
  const imgWidth = isIcon ? size : Math.round(size * 3.8);
  const imgHeight = size;

  let content: React.ReactNode;

  if (isIcon) {
    content = (
      <Image
        src="/logo-icon.png"
        alt="Collabo"
        width={imgWidth}
        height={imgHeight}
        className={`object-contain shrink-0 ${className}`}
        priority
      />
    );
  } else if (theme === 'dark') {
    content = (
      <Image
        src="/logo-full.png"
        alt="Collabo"
        width={imgWidth}
        height={imgHeight}
        className={`object-contain shrink-0 hover:opacity-90 transition-opacity ${className}`}
        priority
      />
    );
  } else if (theme === 'light') {
    content = (
      <Image
        src="/logo-full-light.png"
        alt="Collabo"
        width={imgWidth}
        height={imgHeight}
        className={`object-contain shrink-0 hover:opacity-90 transition-opacity ${className}`}
        priority
      />
    );
  } else {
    // Responsive auto theme: light logo in light mode, white text logo in dark mode
    content = (
      <>
        <Image
          src="/logo-full-light.png"
          alt="Collabo"
          width={imgWidth}
          height={imgHeight}
          className={`object-contain shrink-0 hover:opacity-90 transition-opacity dark:hidden ${className}`}
          priority
        />
        <Image
          src="/logo-full.png"
          alt="Collabo"
          width={imgWidth}
          height={imgHeight}
          className={`object-contain shrink-0 hover:opacity-90 transition-opacity hidden dark:block ${className}`}
          priority
        />
      </>
    );
  }

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

