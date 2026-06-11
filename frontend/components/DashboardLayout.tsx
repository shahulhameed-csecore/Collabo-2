'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import {
  Zap, LayoutDashboard, Users, BarChart3, Settings,
  LogOut, Menu, X, ChevronRight, Bell
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/campaigns', label: 'Campaigns', icon: Users },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3, disabled: true },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings, disabled: true },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [user, setUser] = useState<User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success('Signed out successfully');
    router.replace('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="p-3 bg-emerald-500 rounded-xl animate-pulse">
            <Zap className="w-7 h-7 text-white" />
          </div>
          <p className="text-slate-500 text-sm">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const userInitials = user?.email?.slice(0, 2).toUpperCase() ?? 'IT';

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-slate-800/60">
        <div className="p-2 bg-emerald-500 rounded-lg shadow-lg shadow-emerald-500/25">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="text-base font-bold text-white tracking-tight">InfluencerTrack</span>
          <p className="text-xs text-slate-500">Campaign Manager</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon, disabled }) => {
          const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={disabled ? '#' : href}
              onClick={() => setSidebarOpen(false)}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group
                ${isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}
                ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : ''}`} />
              <span>{label}</span>
              {isActive && <ChevronRight className="w-3 h-3 ml-auto text-emerald-400" />}
              {disabled && <span className="ml-auto text-xs bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded-md">Soon</span>}
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="px-3 pb-4 border-t border-slate-800/60 pt-4">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-800/40 mb-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-white">{userInitials}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-white truncate">{user?.email}</p>
            <p className="text-xs text-slate-500">Brand Account</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-150"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-60 bg-slate-900/80 border-r border-slate-800/60 flex-col flex-shrink-0 fixed h-full z-20">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-slate-900 border-r border-slate-800/60 flex flex-col z-50">
            <button onClick={() => setSidebarOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-60 min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-10 h-14 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/60 flex items-center justify-between px-4 lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden lg:block">
            <p className="text-sm text-slate-400">
              Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},{' '}
              <span className="text-white font-medium">{user?.email?.split('@')[0]}</span> 👋
            </p>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <button className="relative p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
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
