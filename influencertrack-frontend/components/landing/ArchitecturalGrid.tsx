'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface CrosshairProps {
  className?: string;
}

export function Crosshair({ className }: CrosshairProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute w-3 h-3 flex items-center justify-center text-white/25 pointer-events-none select-none font-mono text-[10px] leading-none z-20",
        className
      )}
    >
      <svg className="w-3 h-3 text-white/30" viewBox="0 0 12 12" fill="none">
        <path d="M6 0V12M0 6H12" stroke="currentColor" strokeWidth="1" />
      </svg>
    </span>
  );
}

export function SectionDivider({ className, showCrosshairs = true }: { className?: string; showCrosshairs?: boolean }) {
  return (
    <div className={cn("relative w-full border-b border-white/[0.06]", className)}>
      {showCrosshairs && (
        <>
          <Crosshair className="-left-[6px] -top-[6px]" />
          <Crosshair className="-right-[6px] -top-[6px]" />
        </>
      )}
    </div>
  );
}

export function SectionEyebrow({
  badge,
  title,
  description,
  align = 'center',
}: {
  badge: string;
  title: string | React.ReactNode;
  description?: string;
  align?: 'center' | 'left';
}) {
  return (
    <div className={cn("mb-12 md:mb-16", align === 'center' ? 'text-center max-w-3xl mx-auto' : 'text-left max-w-2xl')}>
      <div
        className={cn(
          "inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/[0.08] border border-emerald-500/20 text-emerald-400 font-sans text-xs font-medium mb-5 shadow-[inset_0_1px_0_0_rgba(16,185,129,0.12)]",
          align === 'center' ? 'mx-auto' : ''
        )}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span>{badge}</span>
      </div>
      <h2 className="text-3xl sm:text-4xl lg:text-5xl font-medium tracking-[-0.03em] leading-[1.12] text-gradient-metallic">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-base sm:text-lg text-slate-400 leading-relaxed font-sans font-normal">
          {description}
        </p>
      )}
    </div>
  );
}
