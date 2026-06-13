'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import {
  Zap, LayoutDashboard, BarChart3, Settings,
  LogOut, Menu, X, ChevronRight, Bell, Plus,
  Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface DashboardLayoutProps {
  children: React.ReactNode;
  onNewCampaign?: () => void;
}

const navItems = [
  { href: '/dashboard', label: 'Campaigns', icon: LayoutDashboard },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3, disabled: true, soon: true },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings, disabled: true, soon: true },
];

function NavLink({
  href, label, icon: Icon, disabled, soon, isActive, onClick,
}: {
  href: string; label: string; icon: React.ElementType;
  disabled?: boolean; soon?: boolean; isActive: boolean; onClick: () => void;
}) {
  return (
    <Link
      href={disabled ? '#' : href}
      onClick={disabled ? undefined : onClick}
      className={`
        group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
        transition-all duration-150 select-none
        ${isActive
          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm'
          : 'text-slate-400 hover:text-white hover:bg-slate-800/70 border border-transparent'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-emerald-400' : 'group-hover:text-white'}`} />
      <span className="flex-1">{label}</span>
      {isActive && <ChevronRight className="w-3.5 h-3.5 text-emerald-400" />}
      {soon && !isActive && (
        <span className="text-[10px] font-semibold bg-slate-700/80 text-slate-400 px-1.5 py-0.5 rounded-md border border-slate-600/40">
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
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      setUser(session.user);
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
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="relative">
            <div className="absolute inset-0 bg-emerald-500 rounded-xl blur-lg opacity-40 animate-pulse" />
            <div className="relative p-3 bg-emerald-500 rounded-xl">
              <Zap className="w-7 h-7 text-white" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-white font-semibold text-sm">InfluencerTrack</p>
            <p className="text-slate-500 text-xs mt-0.5">Loading your workspace...</p>
          </div>
        </div>
      </div>
    );
  }

  const userInitials = user?.email?.slice(0, 2).toUpperCase() ?? 'IT';
  const userName = user?.email?.split('@')[0] ?? 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800/60">
        <div className="relative">
          <div className="absolute inset-0 bg-emerald-500 rounded-lg blur opacity-30" />
          <div className="relative p-1.5 bg-emerald-500 rounded-lg">
            <Zap className="w-5 h-5 text-white" />
          </div>
        </div>
        <div>
          <span className="text-sm font-bold text-white tracking-tight">InfluencerTrack</span>
          <div className="flex items-center gap-1 mt-0.5">
            <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
            <p className="text-[10px] text-emerald-400 font-medium">Pro Plan</p>
          </div>
        </div>
      </div>

      {/* New Campaign CTA */}
      {onNewCampaign && (
        <div className="px-3 pt-4 pb-2">
          <button
            onClick={() => { onNewCampaign(); setSidebarOpen(false); }}
            className="
              w-full flex items-center justify-center gap-2
              bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98]
              text-white text-sm font-semibold rounded-xl py-2.5
              transition-all duration-150 shadow-lg shadow-emerald-500/25
              hover:shadow-emerald-500/40
            "
          >
            <Plus className="w-4 h-4" />
            New Campaign
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-1">
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
          />
        ))}
      </nav>

      {/* AI Hint */}
      <div className="mx-3 mb-3 p-3 bg-emerald-500/5 border border-emerald-500/15 rounded-xl">
        <div className="flex items-start gap-2">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-emerald-400 mb-0.5">AI Extraction</p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Upload a DM screenshot to auto-fill campaign details instantly.
            </p>
          </div>
        </div>
      </div>

      {/* User Profile */}
      <div className="px-3 pb-4 border-t border-slate-800/60 pt-3">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-800/50 mb-2 border border-slate-700/30">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-xs font-bold text-white">{userInitials}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white truncate">{userName}</p>
            <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-slate-500 hover:text-rose-400 hover:bg-rose-500/8 transition-all duration-150 group"
        >
          <LogOut className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-60 bg-slate-900/90 border-r border-slate-800/60 flex-col flex-shrink-0 fixed h-full z-20">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 animate-fade-in">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-slate-900 border-r border-slate-800/60 flex flex-col z-50 animate-slide-up">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
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
        <header className="sticky top-0 z-10 h-14 bg-slate-950/95 backdrop-blur-xl border-b border-slate-800/50 flex items-center justify-between px-4 lg:px-6">
          {/* Mobile menu button */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Desktop greeting */}
          <div className="hidden lg:flex items-center gap-2">
            <p className="text-sm text-slate-400">
              {greeting},{' '}
              <span className="text-white font-semibold">{userName}</span> 👋
            </p>
          </div>

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2">
            <div className="p-1 bg-emerald-500 rounded-md">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-white">InfluencerTrack</span>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            <button
              className="relative p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center flex-shrink-0">
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
