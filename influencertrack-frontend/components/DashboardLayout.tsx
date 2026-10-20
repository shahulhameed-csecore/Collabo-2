'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import {
  LayoutDashboard, BarChart3, Settings,
  LogOut, Menu, X, ChevronRight, Plus,
  Sparkles, TrendingUp, Sun, Moon, Calendar, Users, CreditCard,
  ChevronsLeft, ChevronsRight
} from 'lucide-react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { toast } from 'sonner';
import { Logo } from '@/components/Logo';
import { NotificationDropdown } from '@/components/NotificationDropdown';
import { ProfileDropdown } from '@/components/ProfileDropdown';
import { IS_TESTING_PHASE } from '@/lib/config';
import { isDevAuthBypassEnabled, DEV_MOCK_USER } from '@/lib/dev-auth';
import dynamic from 'next/dynamic';
import { useCampaignModal } from '@/contexts/CampaignModalContext';

const OnboardingTour = dynamic(() => import('@/components/OnboardingTour'), { ssr: false });

interface Subscription {
  tier: string;
  trial_ends_at: string | null;
  created_at?: string | null;
  is_paid?: boolean;
  status?: string | null;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  disabled?: boolean;
  soon?: boolean;
  id?: string;
}

const navItems: NavItem[] = [
  { href: '/dashboard',           label: 'Campaigns',   icon: LayoutDashboard },
  { href: '/calendar',            label: 'Calendar',    icon: Calendar, id: 'tour-nav-calendar' },
  { href: '/influencers',         label: 'Influencers', icon: Users },
  { href: '/dashboard/analytics', label: 'Analytics',   icon: BarChart3 },
  { href: '/settings',            label: 'Settings',    icon: Settings },
  { href: '/billing',             label: 'Billing',     icon: CreditCard },
];

/* ── NavLink ─────────────────────────────────────────────────────────────── */
function NavLink({
  href, label, icon: Icon, disabled, soon, isActive, onClick, id, isCollapsed
}: {
  href: string; label: string; icon: React.ElementType;
  disabled?: boolean; soon?: boolean; isActive: boolean; onClick: () => void; id?: string; isCollapsed?: boolean;
}) {
  return (
    <Link
      id={id}
      href={disabled ? '#' : href}
      onClick={disabled ? undefined : onClick}
      title={isCollapsed ? label : undefined}
      className={`
        group flex items-center gap-3 rounded-lg font-medium
        transition-all duration-150 select-none relative overflow-hidden
        ${isCollapsed ? 'justify-center p-2.5' : 'px-3 py-2 text-xs'}
        ${isActive
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-sm shadow-emerald-500/10 font-semibold'
          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.04] border border-transparent'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {/* Active left indicator */}
      {isActive && !isCollapsed && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-emerald-500 dark:bg-emerald-400 rounded-r-full shadow-sm shadow-emerald-400/50" />
      )}
      {isActive && isCollapsed && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-emerald-500 dark:bg-emerald-400 rounded-r-full shadow-sm shadow-emerald-400/50" />
      )}
      <Icon className={`flex-shrink-0 transition-colors ${isCollapsed ? 'w-4 h-4' : 'w-3.5 h-3.5'} ${
        isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'
      }`} />
      {!isCollapsed && <span className="flex-1 leading-none">{label}</span>}
      {isActive && !isCollapsed && <ChevronRight className="w-3 h-3 text-emerald-500/60" />}
      {soon && !isActive && !isCollapsed && (
        <span className="text-[9px] font-mono font-medium bg-slate-100 dark:bg-white/[0.04] text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/[0.06] tracking-wide">
          SOON
        </span>
      )}
    </Link>
  );
}

/* ── Main Layout ─────────────────────────────────────────────────────────── */
export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [user, setUser]                     = useState<User | null>(null);
  const [subscription, setSubscription]     = useState<Subscription | null>(null);
  const [customUsername, setCustomUsername] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [loading, setLoading]               = useState(true);
  const [mounted, setMounted]               = useState(false);
  const sidebarRef                          = useRef<HTMLElement>(null);
  const router                              = useRouter();
  const pathname                            = usePathname();
  const supabase                            = useMemo(() => createClient(), []);
  const { theme, setTheme, resolvedTheme }   = useTheme();
  const { openModal }                       = useCampaignModal();

  /* ── Auth ── */
  useEffect(() => {
    setMounted(true);
    const getUser = async () => {
      try {
        let activeUser = null;
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          activeUser = user;
        } else if (isDevAuthBypassEnabled()) {
          activeUser = DEV_MOCK_USER;
        } else if (process.env.NODE_ENV !== 'production' && typeof document !== 'undefined') {
          const match = document.cookie.match(/collabo-test-session=([^;]+)/);
          if (match) {
            try {
              activeUser = JSON.parse(decodeURIComponent(match[1]));
            } catch {}
          }
        }

        if (!activeUser) {
          router.replace('/login');
          return;
        }
        setUser(activeUser);

        if (activeUser.id === DEV_MOCK_USER.id) {
          setSubscription({
            tier: 'pro',
            trial_ends_at: '2026-10-29T00:00:00.000Z',
            is_paid: true,
          });
          setCustomUsername('Dev User');
        } else {
          const { data: subData } = await supabase
            .from('subscriptions')
            .select('tier, trial_ends_at, is_paid')
            .eq('user_id', activeUser.id)
            .maybeSingle();
          if (subData) setSubscription(subData);

          const { data: settingsData } = await supabase
            .from('user_settings')
            .select('username')
            .eq('user_id', activeUser.id)
            .maybeSingle();
          if (settingsData?.username) setCustomUsername(settingsData.username);
        }
      } catch (err) {
        console.warn('User auth state check:', err);
      } finally {
        setLoading(false);
      }
    };
    getUser();

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((event, session) => {
      if (isDevAuthBypassEnabled()) return;
      if (event === 'SIGNED_OUT') router.replace('/login');
      if (session) setUser(session.user);
    });
    return () => authSub.unsubscribe();
  }, [router, supabase]);

  /* ── Close sidebar on Escape ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileSidebarOpen(false); };
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
      <div className="min-h-screen bg-[#05070B] flex flex-col items-center justify-center space-y-4">
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 bg-emerald-500/10 rounded-full blur-xl animate-pulse"></div>
          <div className="relative w-12 h-12 bg-[#0A0E17] rounded-xl flex items-center justify-center border border-white/[0.08] shadow-2xl">
            <svg className="w-6 h-6 text-emerald-400 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="opacity-20" />
              <path d="M12 2C6.47715 2 2 6.47715 2 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="31.4 31.4" className="opacity-80" />
            </svg>
          </div>
        </div>
        <div className="flex flex-col items-center space-y-1.5">
          <p className="text-slate-400 text-xs font-mono">Initializing workspace...</p>
          <div className="w-32 h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <div className="h-full bg-emerald-400 rounded-full animate-shimmer" style={{ width: '50%' }}></div>
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
  
  // Evaluate Trial & Pro Status strictly based on tier, is_paid and trial expiration
  const now = new Date();
  const trialEndsAt = subscription?.trial_ends_at ? new Date(subscription.trial_ends_at) : null;
  
  const rawTier = subscription?.tier?.toLowerCase() || 'free';
  const isPaid = subscription?.is_paid === true;
  const hasValidTime = !trialEndsAt || trialEndsAt > now;

  let isPro = false;
  let isTrialActive = false;

  if (isPaid && (hasValidTime || rawTier === 'pro')) {
    isPro = true;
    isTrialActive = false; // Paid PRO, completely hide trial box
  } else if (rawTier === 'pro' && (isPaid || hasValidTime)) {
    isPro = true;
    isTrialActive = !isPaid && Boolean(trialEndsAt && trialEndsAt > now);
  } else if (trialEndsAt && trialEndsAt > now) {
    // Treat as free trial if still has trial time left
    isPro = true;
    isTrialActive = true;
  } else {
    // Expired or no active subscription
    isPro = false;
    isTrialActive = false;
  }

  // Overrides for Testing phase
  if (IS_TESTING_PHASE) {
    isPro = true;
    isTrialActive = false;
  }
  
  const displayTier = isPro ? 'PRO' : 'FREE';
  const daysLeft = trialEndsAt ? Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 3600 * 24)) : 0;

  const getGreeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  };

  /* ── Sidebar content component ── */
  const SidebarContent = ({ isMobile = false, isCollapsed = false, toggleCollapse }: { isMobile?: boolean, isCollapsed?: boolean, toggleCollapse?: () => void }) => (
    <div className="flex flex-col h-full overflow-hidden select-none">
      {/* Logo row */}
      <div className={`flex items-center gap-3 py-4 border-b border-slate-200 dark:border-white/[0.06] flex-shrink-0 transition-all duration-200 ${isCollapsed ? 'px-4 justify-center' : 'px-4'}`}>
        <Logo variant={isCollapsed ? 'icon' : 'full'} size={24} href="/dashboard" />
        {!isCollapsed && (
          <div className="flex items-center gap-1.5 ml-auto">
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-mono font-medium ${isPro ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'}`}>
              <Sparkles className="w-2.5 h-2.5" />
              <span>{displayTier}</span>
            </div>
            {!isMobile && toggleCollapse && (
              <button
                onClick={toggleCollapse}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04] rounded-md transition-colors flex-shrink-0"
                aria-label="Collapse sidebar"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Trial Expiry Banner */}
      {!isCollapsed && isTrialActive && (
        <div className="mx-3 mt-3 px-3 py-1.5 bg-emerald-500/[0.05] border border-emerald-500/20 rounded-lg flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Trial
          </span>
          <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-300">{daysLeft}d remaining</span>
        </div>
      )}

      {/* Primary Sidebar Action: New Campaign CTA */}
      <div className={`pt-3 pb-1 flex-shrink-0 transition-all duration-200 ${isCollapsed ? 'px-2' : 'px-3'}`}>
        <button
          id={`tour-new-campaign-sidebar-${isMobile ? 'mobile' : 'desktop'}`}
          onClick={() => { openModal(); if(isMobile) setMobileSidebarOpen(false); }}
          className={`
            w-full flex items-center justify-center gap-2
            bg-emerald-500 hover:bg-emerald-400
            active:scale-[0.98] text-[#05070B] font-semibold rounded-lg
            transition-all duration-150 shadow-[0_1px_8px_rgba(16,185,129,0.25)]
            ${isCollapsed ? 'py-2.5 aspect-square' : 'py-2 text-xs'}
          `}
        >
          <Plus className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && <span className="whitespace-nowrap font-medium">New Campaign</span>}
        </button>
      </div>

      {/* Nav */}
      <nav className={`flex-1 py-3 space-y-0.5 overflow-y-auto no-scrollbar ${isCollapsed ? 'px-2' : 'px-3'}`}>
        {!isCollapsed && (
          <p className="text-[10px] font-mono font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 pb-2 pt-1">
            Workspace
          </p>
        )}
        {navItems.map(({ href, label, icon, disabled, soon, id }: NavItem) => (
          <NavLink
            key={href}
            href={href}
            label={label}
            icon={icon}
            disabled={disabled}
            soon={soon}
            isActive={pathname === href || (href !== '/dashboard' && pathname.startsWith(href))}
            onClick={() => isMobile && setMobileSidebarOpen(false)}
            id={isMobile ? (id ? `${id}-mobile` : `tour-nav-${href.replace(/\//g, '') || 'dashboard'}-mobile`) : (id || `tour-nav-${href.replace(/\//g, '') || 'dashboard'}`)}
            isCollapsed={isCollapsed}
          />
        ))}
      </nav>

      {/* AI Extraction Sleek Promo Box */}
      {!isCollapsed && (
        <div
          id={`tour-ai-insight-${isMobile ? 'mobile' : 'desktop'}`}
          className="mx-3 mb-3 p-3 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/[0.1] rounded-xl flex-shrink-0 transition-colors"
        >
          <div className="flex items-start gap-2.5">
            <div className="p-1 bg-emerald-500/10 rounded-md flex-shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5">
              <Sparkles className="w-3 h-3" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-800 dark:text-slate-200 mb-0.5">AI Extraction</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                Forward creator DMs to auto-fill briefs in seconds.
              </p>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-200 dark:border-white/[0.04] flex items-center gap-1.5 text-[10px] font-mono text-emerald-600 dark:text-emerald-400/90">
            <TrendingUp className="w-3 h-3" />
            <span>Saves ~20 min per deal</span>
          </div>
        </div>
      )}

      {/* Collapse Toggle (Bottom) */}
      {!isMobile && toggleCollapse && isCollapsed && (
        <div className="px-3 pb-2 flex justify-center">
          <button
            onClick={toggleCollapse}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04] rounded-md transition-colors"
            aria-label="Expand sidebar"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* User profile */}
      <div className={`pb-3 border-t border-slate-200 dark:border-white/[0.06] pt-3 flex-shrink-0 transition-all duration-200 ${isCollapsed ? 'px-2' : 'px-3'}`}>
        {!isCollapsed ? (
          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-white/[0.02] mb-1.5 border border-slate-200 dark:border-white/[0.05]">
            <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
              <span className="text-[11px] font-mono font-medium text-emerald-600 dark:text-emerald-300">{userInitials}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate capitalize">{userName}</p>
              <p className="text-[10px] text-slate-500 font-mono truncate">{user?.email}</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center mb-1.5">
            <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-mono font-medium text-emerald-600 dark:text-emerald-300">{userInitials}</span>
            </div>
          </div>
        )}
        <button
          id="sign-out-btn"
          onClick={handleSignOut}
          title={isCollapsed ? "Sign out" : undefined}
          className={`w-full flex items-center text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors group ${isCollapsed ? 'justify-center p-2 rounded-lg' : 'gap-2 px-2.5 py-1.5 rounded-lg text-xs'}`}
        >
          <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
          {!isCollapsed && <span className="whitespace-nowrap font-medium">Sign out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#05070B] text-slate-900 dark:text-slate-100 flex font-sans selection:bg-emerald-500/30 selection:text-emerald-300 transition-colors duration-200">

      {/* ── Desktop Sidebar ── */}
      <aside className={`hidden lg:flex flex-col bg-white dark:bg-[#070A10] border-r border-slate-200 dark:border-white/[0.06] flex-shrink-0 fixed h-full z-20 transition-all duration-300 ease-in-out ${desktopSidebarOpen ? 'w-60' : 'w-[72px]'}`}>
        <SidebarContent isMobile={false} isCollapsed={!desktopSidebarOpen} toggleCollapse={() => setDesktopSidebarOpen(!desktopSidebarOpen)} />
      </aside>

      {/* ── Mobile Sidebar Overlay ── */}
      {mobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 animate-fade-in">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
          />
          {/* Drawer */}
          <aside
            ref={sidebarRef}
            className="absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-[#070A10] border-r border-slate-200 dark:border-white/[0.06] flex flex-col z-50 animate-slide-in-left shadow-2xl shadow-black/80"
          >
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="absolute right-3 top-3 p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04] rounded-lg transition-colors z-10"
              aria-label="Close sidebar"
            >
              <X className="w-4 h-4" />
            </button>
            <SidebarContent isMobile={true} />
          </aside>
        </div>
      )}

      {/* ── Main Content Container ── */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${desktopSidebarOpen ? 'lg:ml-60' : 'lg:ml-[72px]'}`}>

        {/* ── Top Header ── */}
        <header className="sticky top-0 z-10 h-14 bg-white/90 dark:bg-[#05070B]/90 backdrop-blur-xl border-b border-slate-200 dark:border-white/[0.06] flex items-center justify-between px-4 lg:px-6 gap-3 transition-colors duration-200">

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors flex-shrink-0"
            aria-label="Open menu"
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Desktop greeting */}
          <div className="hidden lg:flex items-center gap-2 min-w-0">
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {mounted ? getGreeting() : 'Welcome'},{' '}
              <span className="text-slate-900 dark:text-slate-200 font-medium capitalize">{userName}</span>
            </p>
          </div>

          {/* Mobile logo (centered) */}
          <div className="lg:hidden flex items-center">
            <Logo variant="full" size={20} href="/dashboard" />
          </div>

          {/* Right side utility bar */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">

            {/* Notifications */}
            <NotificationDropdown />

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors"
              aria-label="Toggle theme"
              title={mounted ? (resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode') : 'Toggle theme'}
            >
              {!mounted ? (
                <div className="w-4 h-4" />
              ) : resolvedTheme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400 hover:text-amber-300 transition-colors" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600 hover:text-slate-900 transition-colors" />
              )}
            </button>

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

        {/* ── Page Content (Unconstrained full width) ── */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>

      <OnboardingTour 
        setMobileSidebarOpen={setMobileSidebarOpen} 
        setDesktopSidebarOpen={setDesktopSidebarOpen} 
        desktopSidebarOpen={desktopSidebarOpen} 
      />
    </div>
  );
}
