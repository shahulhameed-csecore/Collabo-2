'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import {
  Zap, LayoutDashboard, BarChart3, Settings,
  LogOut, Menu, X, ChevronRight, Bell, Plus,
  Sparkles, TrendingUp, Sun, Moon
} from 'lucide-react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { toast } from 'sonner';
import { Logo } from '@/components/Logo';

interface DashboardLayoutProps {
  children: React.ReactNode;
  onNewCampaign?: () => void;
}

const navItems = [
  { href: '/dashboard', label: 'Campaigns', icon: LayoutDashboard },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3, disabled: true, soon: true },
  { href: '/settings', label: 'Settings', icon: Settings },
];

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
        group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
        transition-all duration-200 select-none relative overflow-hidden
        ${isActive
          ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 shadow-sm shadow-emerald-500/10'
          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/70 border border-transparent'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-emerald-400 rounded-r-full" />
      )}
      <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${isActive ? 'text-emerald-400' : 'group-hover:text-white'}`} />
      <span className="flex-1">{label}</span>
      {isActive && <ChevronRight className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 opacity-70" />}
      {soon && !isActive && (
        <span className="text-[9px] font-bold bg-slate-100 dark:bg-slate-700/80 text-slate-500 px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-600/30 tracking-wide">
          SOON
        </span>
      )}
    </Link>
  );
}

export default function DashboardLayout({ children, onNewCampaign }: DashboardLayoutProps) {
  const [user, setUser] = useState<User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
    const getUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!user || error) {
        if (error) console.error("Auth error:", error.message);
        router.replace('/login');
        return;
      }
      setUser(user);
      setLoading(false);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') router.replace('/login');
      if (session) setUser(session.user);
    });
    return () => subscription.unsubscribe();
  }, [router, supabase.auth]);

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    toast.success('Signed out. See you soon!');
    router.replace('/login');
  }, [supabase.auth, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-5 animate-fade-in">
          <div className="relative">
            <div className="absolute inset-0 bg-emerald-500 rounded-2xl blur-xl opacity-30 animate-pulse" />
            <div className="relative p-4 bg-slate-900 rounded-2xl shadow-2xl shadow-emerald-500/30 border border-slate-800">
              <Logo variant="icon" size={32} />
            </div>
          </div>
          <div className="text-center mt-2">
            <Logo variant="full" />
            <p className="text-slate-500 text-sm mt-2">Loading your workspace...</p>
          </div>
          {/* Loading bar */}
          <div className="w-40 h-0.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full animate-shimmer" style={{
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.4s ease-in-out infinite',
            }} />
          </div>
        </div>
      </div>
    );
  }

  const userInitials = user?.email?.slice(0, 2).toUpperCase() ?? 'IT';
  const userName = user?.email?.split('@')[0] ?? 'there';
  
  // Safe greeting calculation without hydration error
  const getGreeting = () => {
    const hour = new Date().getHours();
    return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-200 dark:border-slate-800/50">
        <Logo variant="full" size={24} href="/dashboard" />
        <div className="flex items-center gap-1 ml-auto">
          <Sparkles className="w-2.5 h-2.5 text-emerald-500 dark:text-emerald-400" />
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold tracking-wide">PRO PLAN</p>
        </div>
      </div>

      {/* New Campaign CTA */}
      {onNewCampaign && (
        <div className="px-3 pt-4 pb-1">
          <button
            id="new-campaign-btn"
            onClick={() => { onNewCampaign(); setSidebarOpen(false); }}
            className="
              w-full flex items-center justify-center gap-2
              bg-gradient-to-r from-emerald-500 to-teal-500
              hover:from-emerald-400 hover:to-teal-400
              active:scale-[0.98] text-white text-sm font-bold rounded-xl py-2.5
              transition-all duration-200 shadow-lg shadow-emerald-500/30
              hover:shadow-emerald-500/50 hover:shadow-xl
            "
          >
            <Plus className="w-4 h-4" />
            New Campaign
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-600 uppercase tracking-widest px-3 pb-2 pt-1">
          Navigation
        </p>
        {navItems.map(({ href, label, icon, disabled, soon }) => (
          <NavLink
            key={href}
            href={href}
            label={label}
            icon={icon}
            disabled={disabled}
            soon={soon}
            isActive={pathname === href || (href !== '/dashboard' && pathname.startsWith(href))}
            onClick={() => setSidebarOpen(false)}
            id={href === '/settings' ? 'tour-nav-settings' : undefined}
          />
        ))}
      </nav>

      {/* AI Insight card */}
      <div id="tour-ai-insight" className="mx-3 mb-3 p-3.5 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 dark:from-emerald-500/8 dark:to-teal-500/5 border border-emerald-500/20 dark:border-emerald-500/15 rounded-xl">
        <div className="flex items-start gap-2.5">
          <div className="p-1.5 bg-emerald-500/10 dark:bg-emerald-500/15 rounded-lg flex-shrink-0">
            <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-0.5">AI Extraction</p>
            <p className="text-[11px] text-slate-600 dark:text-slate-500 leading-relaxed">
              Upload a DM screenshot to auto-fill campaign details in seconds.
            </p>
          </div>
        </div>
        <div className="mt-2.5 flex items-center gap-1">
          <TrendingUp className="w-3 h-3 text-emerald-600 dark:text-emerald-500" />
          <span className="text-[10px] text-emerald-600 dark:text-emerald-500 font-medium">Saves ~20 min per campaign</span>
        </div>
      </div>

      {/* User Profile */}
      <div className="px-3 pb-4 border-t border-slate-200 dark:border-slate-800/50 pt-3">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/40 mb-2 border border-slate-200 dark:border-slate-700/25 hover:border-slate-300 dark:hover:border-slate-600/40 transition-all">
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
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-slate-600 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/8 transition-all duration-200 group"
        >
          <LogOut className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-60 bg-white/95 dark:bg-slate-900/95 border-r border-slate-200 dark:border-slate-800/50 flex-col flex-shrink-0 fixed h-full z-20 backdrop-blur-xl">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 animate-fade-in">
          <div
            className="absolute inset-0 bg-slate-900/40 dark:bg-black/70 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800/60 flex flex-col z-50 animate-slide-up shadow-2xl shadow-slate-900/10">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute right-4 top-4 p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
            >
              <X className="w-4 h-4" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-60 min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-10 h-14 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800/40 flex items-center justify-between px-4 lg:px-6">
          {/* Mobile menu button */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Desktop greeting */}
          <div className="hidden lg:flex items-center gap-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {mounted ? getGreeting() : 'Welcome'},{' '}
              <span className="text-slate-900 dark:text-white font-semibold capitalize">{userName}</span> 👋
            </p>
          </div>

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2">
            <Logo variant="full" size={20} href="/dashboard" />
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            {/* New Campaign quick access on desktop */}
            {onNewCampaign && (
              <button
                onClick={onNewCampaign}
                className="hidden sm:flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-400 hover:text-emerald-300 text-xs font-semibold rounded-lg px-3 py-1.5 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                New
              </button>
            )}
            
            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle theme"
            >
              {mounted && theme === 'dark' ? (
                <Sun className="w-4 h-4 text-emerald-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-500" />
              )}
            </button>

            <button
              className="relative p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center flex-shrink-0 ring-2 ring-emerald-500/20">
              <span className="text-xs font-bold text-white">{userInitials}</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
