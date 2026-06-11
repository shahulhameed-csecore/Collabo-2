'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import CampaignTable from '@/components/CampaignTable';
import CreateCampaignModal from '@/components/CreateCampaignModal';
import { getCampaigns } from '@/lib/api';
import type { Campaign } from '@/lib/types';
import { Plus, RefreshCw, TrendingUp, Users, Clock, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-5 flex items-center gap-4">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchCampaigns = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    try {
      const data = await getCampaigns();
      setCampaigns(data);
    } catch (err: unknown) {
      const status = (err as { response?: { status: number } }).response?.status;
      if (status !== 401) toast.error('Failed to load campaigns.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  // Stats derived from campaigns
  const stats = {
    total: campaigns.length,
    active: campaigns.filter(c => c.status === 'active').length,
    overdue: campaigns.filter(c => c.deadline && c.status === 'active' && new Date(c.deadline) < new Date()).length,
    totalSpend: campaigns.reduce((sum, c) => sum + (c.payment_amount || 0), 0),
  };

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Campaigns</h1>
          <p className="text-slate-500 text-sm mt-0.5">Track and manage all your influencer partnerships</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchCampaigns(true)}
            disabled={isRefreshing || isLoading}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl px-4 py-2.5 text-sm transition-all border border-slate-700/50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>New Campaign</span>
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Campaigns" value={String(stats.total)} icon={Users} color="bg-slate-800 text-slate-400" />
        <StatCard label="Active Now" value={String(stats.active)} icon={TrendingUp} color="bg-emerald-500/10 text-emerald-400" />
        <StatCard label="Overdue" value={String(stats.overdue)} icon={Clock} color={stats.overdue > 0 ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-800 text-slate-400'} />
        <StatCard label="Total Spend" value={`₹${stats.totalSpend.toLocaleString('en-IN')}`} icon={DollarSign} color="bg-amber-500/10 text-amber-400" />
      </div>

      {/* Campaigns Table */}
      <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800/40 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">
            All Campaigns
            {!isLoading && <span className="ml-2 text-xs text-slate-500 font-normal">({campaigns.length})</span>}
          </h2>
        </div>
        <CampaignTable
          campaigns={campaigns}
          isLoading={isLoading}
          onRefresh={() => fetchCampaigns(true)}
          onCreateNew={() => setIsModalOpen(true)}
        />
      </div>

      {/* Create Campaign Modal */}
      <CreateCampaignModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => fetchCampaigns(true)}
      />
    </DashboardLayout>
  );
}
