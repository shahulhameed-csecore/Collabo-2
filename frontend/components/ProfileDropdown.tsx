'use client';

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import {
  User,
  Settings,
  CreditCard,
  LogOut,
  ChevronRight,
  Sparkles,
  Crown,
  Zap,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';

interface ProfileDropdownProps {
  userName: string;
  userEmail?: string;
  userInitials: string;
  isPro: boolean;
  tier: string;
  onSignOut: () => void;
}

export function ProfileDropdown({
  userName,
  userEmail,
  userInitials,
  isPro,
  
  onSignOut,
}: ProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    // Close on Escape
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, []);

  const menuItems = [
    {
      label: 'Settings',
      icon: Settings,
      href: '/settings',
      description: 'Manage integrations',
    },
    {
      label: 'Billing',
      icon: CreditCard,
      href: '/billing',
      description: 'Plans & invoices',
    },
  ];

  // Determine plan display
  const planLabel = isPro ? 'Pro Plan' : 'Free Plan';
  const planColor = isPro
    ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
    : 'text-amber-500 bg-amber-500/10 border-amber-500/20';

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Avatar Trigger */}
      <button
        id="profile-menu-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open profile menu"
        aria-expanded={isOpen}
        className={`
          w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500
          flex items-center justify-center flex-shrink-0
          ring-2 ring-emerald-500/20
          hover:ring-emerald-500/50 hover:scale-105
          transition-all duration-200 cursor-pointer
          focus:outline-none focus:ring-2 focus:ring-emerald-500
          ${isOpen ? 'ring-emerald-500/50 scale-105' : ''}
        `}
      >
        <span className="text-xs font-bold text-white select-none">
          {userInitials}
        </span>
      </button>

      {/* ── Desktop Dropdown / Mobile Bottom Sheet ── */}
      {isOpen && (
        <>
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 sm:hidden animate-fade-in"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown panel */}
          <div
            className={`
              z-[60]
              absolute top-[calc(100%+8px)] right-0 origin-top-right
              w-[calc(100vw-32px)] max-w-[280px] sm:w-72
              animate-slide-down
              bg-white dark:bg-slate-900
              border border-slate-200 dark:border-slate-800/80
              shadow-2xl shadow-slate-900/10 dark:shadow-black/60
              overflow-hidden
            `}
          >

            {/* ── User info header ── */}
            <div className="px-4 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-500/20 ring-2 ring-emerald-500/20">
                  <span className="text-sm font-bold text-white">{userInitials}</span>
                </div>
                {/* Name & email */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate capitalize">
                    {userName}
                  </p>
                  {userEmail && (
                    <p className="text-xs text-slate-500 truncate">{userEmail}</p>
                  )}
                </div>
              </div>

              {/* Plan Badge */}
              <div className={`
                mt-3 flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold
                ${planColor}
              `}>
                {isPro
                  ? <Crown className="w-3.5 h-3.5" />
                  : <Zap className="w-3.5 h-3.5" />
                }
                <span>{planLabel}</span>
                {isPro && (
                  <CheckCircle2 className="w-3.5 h-3.5 ml-auto opacity-70" />
                )}
              </div>
            </div>

            {/* ── Upgrade CTA (if not pro) ── */}
            {!isPro && (
              <div className="px-3 pt-3">
                <Link
                  href="/billing"
                  onClick={() => setIsOpen(false)}
                  className="
                    flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-xl
                    bg-gradient-to-r from-emerald-500 to-teal-500
                    hover:from-emerald-400 hover:to-teal-400
                    text-white text-sm font-bold
                    shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40
                    active:scale-[0.98] transition-all duration-200
                    group
                  "
                >
                  <Sparkles className="w-4 h-4" />
                  Upgrade to Pro
                  <ChevronRight className="w-4 h-4 ml-auto group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            )}

            {/* ── Nav links ── */}
            <nav className="p-3 space-y-0.5">
              {menuItems.map(({ label, icon: Icon, href, description }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setIsOpen(false)}
                  className="
                    flex items-center gap-3 px-3 py-2.5 rounded-xl
                    text-sm font-medium text-slate-700 dark:text-slate-300
                    hover:bg-slate-50 dark:hover:bg-slate-800/60
                    hover:text-slate-900 dark:hover:text-white
                    transition-all duration-150 group
                  "
                >
                  <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors flex-shrink-0">
                    <Icon className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{label}</p>
                    <p className="text-[11px] text-slate-400 font-normal truncate">{description}</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 dark:group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                </Link>
              ))}
            </nav>

            {/* ── Divider + Sign Out ── */}
            <div className="px-3 pb-4 border-t border-slate-100 dark:border-slate-800/80 pt-2">
              <button
                onClick={() => { setIsOpen(false); onSignOut(); }}
                className="
                  flex items-center gap-3 w-full px-3 py-2.5 rounded-xl
                  text-sm font-medium text-slate-500 dark:text-slate-400
                  hover:bg-rose-50 dark:hover:bg-rose-500/8
                  hover:text-rose-600 dark:hover:text-rose-400
                  transition-all duration-150 group
                "
              >
                <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:bg-rose-100 dark:group-hover:bg-rose-500/15 transition-colors flex-shrink-0">
                  <LogOut className="w-3.5 h-3.5 transition-colors" />
                </div>
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
