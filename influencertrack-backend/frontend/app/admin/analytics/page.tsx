'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { Logo } from '@/components/Logo';
import { 
  Users, 
  LayoutDashboard, 
  Sparkles, 
  IndianRupee,
  TrendingUp,
  Activity
} from 'lucide-react';

export default function AdminAnalyticsPage() {
  const [stats, setStats] = useState({
    totalCampaigns: 0,
    activeUsers: 0,
    aiSuccessRate: 94.2, // Mocked/calculated value
    totalRevenue: 24500 // Placeholder
  });
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchStats = async () => {
      // Fetch total campaigns
      const { count: campaignsCount } = await supabase
        .from('campaigns')
        .select('*', { count: 'exact', head: true });

      // Fetch active users (by checking auth users or user_settings)
      // Since auth.users is admin only, we can count distinct users in campaigns or subscriptions
      const { count: usersCount } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true });

      setStats(prev => ({
        ...prev,
        totalCampaigns: campaignsCount || 0,
        activeUsers: usersCount || 0, // Fallback to 0 if count fails (due to RLS for instance, if admin doesn't have bypass)
        // In a real app, this page would use an Admin-only Supabase Service Role client API route, 
        // but for now we fetch what we can or mock the rest.
      }));
      setLoading(false);
    };

    fetchStats();
  }, [supabase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-4" />
          <p className="text-emerald-400 font-medium">Loading metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#020617]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Logo variant="icon" size={28} />
            <div className="h-6 w-px bg-slate-800" />
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-500" />
              Internal Analytics
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium px-2.5 py-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full">
              Admin Only
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">Platform Overview</h2>
          <p className="text-slate-400">Key metrics and usage statistics for Collabo.</p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Total Campaigns */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-2xl group-hover:bg-blue-500/10 transition-colors" />
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                <LayoutDashboard className="w-5 h-5 text-blue-400" />
              </div>
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">
                <TrendingUp className="w-3 h-3" /> +12%
              </span>
            </div>
            <p className="text-slate-400 text-sm font-medium mb-1">Total Campaigns</p>
            <h3 className="text-3xl font-extrabold text-white">{stats.totalCampaigns.toLocaleString()}</h3>
          </div>

          {/* AI Success Rate */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                <Sparkles className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">
                <TrendingUp className="w-3 h-3" /> +2.4%
              </span>
            </div>
            <p className="text-slate-400 text-sm font-medium mb-1">AI Extraction Success</p>
            <h3 className="text-3xl font-extrabold text-white">{stats.aiSuccessRate}%</h3>
          </div>

          {/* Active Users */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-2xl group-hover:bg-purple-500/10 transition-colors" />
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
                <Users className="w-5 h-5 text-purple-400" />
              </div>
            </div>
            <p className="text-slate-400 text-sm font-medium mb-1">Active Users</p>
            <h3 className="text-3xl font-extrabold text-white">{stats.activeUsers.toLocaleString()}</h3>
          </div>

          {/* Total Revenue */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-2xl group-hover:bg-amber-500/10 transition-colors" />
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                <IndianRupee className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <p className="text-slate-400 text-sm font-medium mb-1">Total Revenue (MRR)</p>
            <h3 className="text-3xl font-extrabold text-white">₹{stats.totalRevenue.toLocaleString()}</h3>
          </div>

        </div>

      </main>
    </div>
  );
}
