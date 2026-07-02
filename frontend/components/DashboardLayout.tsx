'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import {
  Zap, LayoutDashboard, BarChart3, Settings,
  LogOut, Menu, X, ChevronRight, Bell, Plus,
  Sparkles, TrendingUp, Sun, Moon, Calendar, Users, CreditCard
} from 'lucide-react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { toast } from 'sonner';
import { Logo } from '@/components/Logo';
import { NotificationDropdown } from '@/components/NotificationDropdown';
import { ProfileDropdown } from '@/components/ProfileDropdown';
import { IS_TESTING_PHASE } from '@/lib/config';

interface Subscription {
  tier: string;
  trial_ends_at: string | null;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  onNewCampaign?: () => void;
}

const navItems = [
  { href: '/dashboard',           label: 'Campaigns',  icon: LayoutDashboard },
  { href: '/calendar',            label: 'Calendar',   icon: Calendar },
  { href: '/influencers',         label: 'Influencers',icon: Users },
  { href: '/dashboard/analytics', label: 'Analytics',  icon: BarChart3 },
  { href: '/settings',            label: 'Settings',   icon: Settings },
  { href: '/billing',             label: 'Billing',    icon: CreditCard },
];

/* ── NavLink ─────────────────────────────────────────────────────────────── */
function NavLink({
  href, label, icon: Icon, disabled, soon, isActive, onClick, id,
}: {
  href: string; label: string; icon: React.ElementType;
  disabled?: boolean; soon?: boolean; isActive: boolean; onClick: () => void; id?: string;
}) {
  return (
    <Link
      id={id}
      href={disabled ? '#' : href}
      onClick={disabled ? undefined : onClick}
      className={`
        group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium
        transition-all duration-200 select-none relative overflow-hidden
        ${isActive
          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm shadow-emerald-500/10'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {/* Active left indicator */}
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-emerald-400 rounded-r-full shadow-sm shadow-emerald-400/50" />
      )}
      <Icon className={`w-4 h-4 flex-shrink-0 transition-all ${
        isActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300'
      }`} />
      <span className="flex-1 leading-none">{label}</span>
      {isActive && <ChevronRight className="w-3.5 h-3.5 text-emerald-500/70" />}
      {soon && !isActive && (
        <span className="text-[9px] font-bold bg-slate-100 dark:bg-slate-700/80 text-slate-500 px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-600/30 tracking-wide">
          SOON
        </span>
      )}
    </Link>
  );
}

/* ── Main Layout ─────────────────────────────────────────────────────────── */
export default function DashboardLayout({ children, onNewCampaign }: DashboardLayoutProps) {
  const [user, setUser]                     = useState<User | null>(null);
  const [subscription, setSubscription]     = useState<Subscription | null>(null);
  const [customUsername, setCustomUsername] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen]       = useState(false);
  const [loading, setLoading]               = useState(true);
  const [mounted, setMounted]               = useState(false);
  const sidebarRef                          = useRef<HTMLElement>(null);
  const router                              = useRouter();
  const pathname                            = usePathname();
  const supabase                            = useMemo(() => createClient(), []);
  const { theme, setTheme }                 = useTheme();

  /* ── Auth ── */
  useEffect(() => {
    setMounted(true);
    const getUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!user || error) {
        if (error) console.error('Auth error:', error.message);
        router.replace('/login');
        return;
      }
      setUser(user);

      const { data: subData } = await supabase
        .from('subscriptions')
        .select('tier, trial_ends_at')
        .eq('user_id', user.id)
        .single();
      if (subData) setSubscription(subData);

      const { data: settingsData } = await supabase
        .from('user_settings')
        .select('username')
        .eq('user_id', user.id)
        .single();
      if (settingsData?.username) setCustomUsername(settingsData.username);

      setLoading(false);
    };
    getUser();

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') router.replace('/login');
      if (session) setUser(session.user);
    });
    return () => authSub.unsubscribe();
  }, [router, supabase]);

  /* ── Close sidebar on Escape ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSidebarOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  /* ── Sign out ── */
  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    toast.success('Signed out. See you soon! 👋');
    router.replace('/login');
  }, [supabase.auth, router]);

  /* ── Loading screen ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center space-y-6">
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl animate-pulse"></div>
          <div className="relative w-16 h-16 bg-white dark:bg-slate-900 rounded-2xl shadow-xl flex items-center justify-center border border-slate-200 dark:border-slate-800">
            <svg className="w-8 h-8 text-emerald-500 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-20" />
              <path d="M12 2C6.47715 2 2 6.47715 2 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="31.4 31.4" className="opacity-80" />
            </svg>
          </div>
        </div>
        <div className="flex flex-col items-center space-y-2">
          <p className="text-slate-600 dark:text-slate-400 text-sm font-medium animate-pulse">Loading your workspace...</p>
          <div className="w-40 h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full animate-shimmer" style={{ width: '50%' }}></div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Derived values ── */
  const userName     = customUsername || user?.email?.split('@')[0] || 'there';
  const userInitials = customUsername
    ? customUsername.slice(0, 2).toUpperCase()
    : (user?.email?.slice(0, 2).toUpperCase() ?? 'IT');
  
  // Clean, dynamic check: defaults to Pro during testing phase, otherwise checks DB tier
  const isPro        = IS_TESTING_PHASE || subscription?.tier === 'pro' || subscription?.tier === 'Pro';
  const displayTier  = isPro ? 'PRO' : 'FREE';

  const getGreeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  };

  /* ── Sidebar content component ── */
  const SidebarContent = () => (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Logo row */}
      <div className="flex items-center gap-3 px-5 py-[18px] border-b border-slate-200 dark:border-slate-800/50 flex-shrink-0">
        <Logo variant="full" size={24} href="/dashboard" />
        <div className="flex items-center gap-1 ml-auto px-2 py-1 rounded-lg bg-emerald-500/8 border border-emerald-500/15">
          <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
          <p className="text-[9px] font-bold text-emerald-400 tracking-wide">{displayTier}</p>
        </div>
      </div>

      {/* New Campaign CTA */}
      {onNewCampaign && (
        <div className="px-3 pt-4 pb-1 flex-shrink-0">
          <button
            id="new-campaign-btn"
            onClick={() => { onNewCampaign(); setSidebarOpen(false); }}
            className="
              w-full flex items-center justify-center gap-2
              bg-gradient-to-r from-emerald-500 to-teal-500
              hover:from-emerald-400 hover:to-teal-400
              active:scale-[0.98] text-white text-sm font-bold rounded-xl py-2.5
              transition-all duration-200 shadow-lg shadow-emerald-500/25
              hover:shadow-emerald-500/40 hover:shadow-xl glow-emerald-sm
            "
          >
            <Plus className="w-4 h-4" />
            New Campaign
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest px-3 pb-2 pt-1">
          Navigation
        </p>
        {navItems.map(({ href, label, icon, disabled, soon }: any) => (
          <NavLink
            key={href}
            href={href}
            label={label}
            icon={icon}
            disabled={disabled}
            soon={soon}
            isActive={pathname === href || (href !== '/dashboard' && pathname.startsWith(href))}
            onClick={() => setSidebarOpen(false)}
            id={`tour-nav-${href.replace('/', '') || 'dashboard'}`}
          />
        ))}
      </nav>

      {/* AI Insight card */}
      <div
        id="tour-ai-insight"
        className="mx-3 mb-3 p-3.5 bg-gradient-to-br from-emerald-500/6 to-teal-500/4 border border-emerald-500/15 rounded-xl flex-shrink-0"
      >
        <div className="flex items-start gap-2.5">
          <div className="p-1.5 bg-emerald-500/15 rounded-lg flex-shrink-0">
            <Sparkles className="w-3 h-3 text-emerald-400" />
          </div>
          <div>
            <p className="text-xs font-bold text-emerald-400 mb-0.5">AI Extraction</p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Upload a DM screenshot to auto-fill campaign details in seconds.
            </p>
          </div>
        </div>
        <div className="mt-2.5 flex items-center gap-1.5">
          <TrendingUp className="w-3 h-3 text-emerald-500" />
          <span className="text-[10px] text-emerald-500 font-semibold">Saves ~20 min per campaign</span>
        </div>
      </div>

      {/* User profile */}
      <div className="px-3 pb-4 border-t border-slate-200 dark:border-slate-800/50 pt-3 flex-shrink-0">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white dark:bg-slate-800/40 mb-2 border border-slate-200 dark:border-slate-700/25 hover:border-slate-300 dark:hover:border-slate-600/40 transition-all shadow-sm dark:shadow-none">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-500/20 ring-2 ring-emerald-500/20">
            <span className="text-xs font-bold text-white">{userInitials}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-900 dark:text-white truncate capitalize">{userName}</p>
            <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          id="sign-out-btn"
          onClick={handleSignOut}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-slate-500 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/8 transition-all duration-200 group"
        >
          <LogOut className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex">

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden lg:flex w-60 bg-white dark:bg-slate-900/95 border-r border-slate-200 dark:border-slate-800/50 flex-col flex-shrink-0 fixed h-full z-20 backdrop-blur-xl">
        <SidebarContent />
      </aside>

      {/* ── Mobile Sidebar Overlay ── */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 animate-fade-in">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/60 dark:bg-black/70 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Drawer */}
          <aside
            ref={sidebarRef}
            className="absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800/60 flex flex-col z-50 animate-slide-in-left shadow-2xl shadow-slate-900/10 dark:shadow-slate-900/50"
          >
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute right-3 top-3 p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all z-10"
              aria-label="Close sidebar"
            >
              <X className="w-4 h-4" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col lg:ml-60 min-w-0">

        {/* ── Top Header ── */}
        <header className="sticky top-0 z-10 h-14 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800/40 flex items-center justify-between px-4 lg:px-6 gap-3">

          {/* Mobile menu button */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Desktop greeting */}
          <div className="hidden lg:flex items-center gap-2 min-w-0">
            <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
              {mounted ? getGreeting() : 'Welcome'},{' '}
              <span className="text-slate-900 dark:text-white font-semibold capitalize">{userName}</span>{' '}
              <span>👋</span>
            </p>
          </div>

          {/* Mobile logo (centered) */}
          <div className="lg:hidden flex items-center">
            <Logo variant="full" size={20} href="/dashboard" />
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">

            {/* New Campaign (header shortcut on desktop) */}
            {onNewCampaign && (
              <button
                onClick={onNewCampaign}
                className="hidden sm:flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/18 border border-emerald-500/20 text-emerald-500 dark:text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 text-xs font-bold rounded-xl px-3 py-1.5 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                New
              </button>
            )}

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              aria-label="Toggle theme"
            >
              {mounted && theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-500" />
              )}
            </button>

            {/* Notifications */}
            <NotificationDropdown />

            {/* Profile Dropdown */}
            <ProfileDropdown
              userName={userName}
              userEmail={user?.email}
              userInitials={userInitials}
              isPro={isPro}
              tier={displayTier}
              onSignOut={handleSignOut}
            />
          </div>
        </header>

        {/* ── Page Content ── */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
