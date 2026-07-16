'use client';

import { useState, useEffect, useCallback } from 'react';
import CampaignTable from '@/components/CampaignTable';
import CreateCampaignModal from '@/components/CreateCampaignModal';
import EditCampaignModal from '@/components/EditCampaignModal';
import { useCampaignModal } from '@/contexts/CampaignModalContext';

import { getCampaigns, computeDashboardStats, computeHealthAndInsights, getApiErrorMessage, loadSampleDataApi } from '@/lib/api';

import type { Campaign, DashboardStats, DashboardInsights, CampaignAction } from '@/lib/types';
import {
  Plus, RefreshCw, TrendingUp, Users, Clock,
  DollarSign, AlertCircle, Calendar,
  Zap, CheckCircle2, BarChart2, Check,
  FileText, Table as TableIcon, Download, ChevronDown, HeartPulse, ShieldCheck, ArrowRight, X
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Stat Card (Campaign Overview) ────────────────────────────────────────────
function StatCard({
  label, value, sub, icon: Icon, accent, trend, id,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent: 'emerald' | 'amber' | 'rose' | 'slate' | 'blue';
  trend?: { value: string; positive: boolean };
  id?: string;
}) {
  const accentMap = {
    emerald: { bg: 'bg-emerald-500/12', text: 'text-emerald-400', border: 'border-emerald-500/20', iconBg: 'bg-emerald-500/12' },
    amber: { bg: 'bg-amber-500/12', text: 'text-amber-400', border: 'border-amber-500/20', iconBg: 'bg-amber-500/12' },
    rose: { bg: 'bg-rose-500/12', text: 'text-rose-400', border: 'border-rose-500/20', iconBg: 'bg-rose-500/12' },
    slate: { bg: 'bg-slate-700/40', text: 'text-slate-300', border: 'border-slate-700/40', iconBg: 'bg-slate-700/40' },
    blue: { bg: 'bg-blue-500/12', text: 'text-blue-400', border: 'border-blue-500/20', iconBg: 'bg-blue-500/12' },
  };
  const a = accentMap[accent];
  return (
    <div id={id} className={`flex-shrink-0 w-64 md:w-auto relative bg-slate-900/40 border ${a.border} rounded-2xl p-5`}>
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-3 leading-none">{label}</p>
          <p className={`text-2xl sm:text-3xl font-extrabold ${a.text} leading-none mb-2`}>{value}</p>
          {sub && <p className="text-[11px] text-slate-500 mt-1 truncate">{sub}</p>}
          {trend && (
            <div className={`flex items-center gap-1 mt-2.5 text-xs font-bold ${trend.positive ? 'text-emerald-400' : 'text-rose-400'}`}>
              <TrendingUp className={`w-3 h-3 ${!trend.positive ? 'rotate-180' : ''}`} />
              {trend.value}
            </div>
          )}
        </div>
        <div className={`p-2.5 rounded-xl border ${a.border} ${a.iconBg}`}>
          <Icon className={`w-4 h-4 ${a.text}`} />
        </div>
      </div>
    </div>
  );
}

// ─── Mobile Campaign Card ──────────────────────────────────────────────────────
function MobileCampaignCard({ campaign, onEdit }: { campaign: Campaign, onEdit: (c: Campaign) => void }) {
  const deadline = campaign.deadline ? new Date(campaign.deadline) : null;
  const overdue = deadline ? (deadline.getTime() - new Date().getTime()) / 86400000 < 0 : false;
  
  return (
    <div onClick={() => onEdit(campaign)} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 active:scale-[0.98] transition-transform">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="font-bold text-white text-sm">{campaign.influencer_name || campaign.influencer_handle}</h3>
          <p className="text-xs text-slate-400">{campaign.platform || 'Unknown platform'}</p>
        </div>
        <div className={`px-2 py-0.5 rounded text-[10px] font-bold ${
          campaign.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
          campaign.status === 'active' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
          'bg-slate-700 text-slate-300'
        }`}>
          {campaign.status.toUpperCase()}
        </div>
      </div>
      <div className="flex justify-between items-center mt-4">
        <div className="text-xs">
          <span className="text-slate-500 block mb-0.5">Payment</span>
          <span className="font-semibold text-slate-300">₹{campaign.payment_amount.toLocaleString()}</span>
        </div>
        <div className="text-xs text-right">
          <span className="text-slate-500 block mb-0.5">Deadline</span>
          <span className={`font-semibold ${overdue ? 'text-rose-400' : 'text-slate-300'}`}>
            {deadline ? deadline.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : 'None'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [insights, setInsights] = useState<DashboardInsights | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { isModalOpen, openModal, closeModal } = useCampaignModal();
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);
    try {
      const data = await getCampaigns();
      setCampaigns(data.data);
      setStats(computeDashboardStats(data.data));
      setInsights(computeHealthAndInsights(data.data));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load campaigns.'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  // Derived banner text
  let bannerText = "You're all caught up today.";
  let bannerIcon = <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
  let bannerColor = "border-emerald-500/20 bg-emerald-500/10";
  
  if (insights) {
    if (insights.criticalCount > 0) {
      bannerText = `${insights.criticalCount} campaign${insights.criticalCount > 1 ? 's' : ''} requires immediate attention.`;
      bannerIcon = <AlertCircle className="w-5 h-5 text-rose-400" />;
      bannerColor = "border-rose-500/20 bg-rose-500/10";
    } else if (insights.needsAttentionCount > 0) {
      bannerText = `${insights.needsAttentionCount} campaign${insights.needsAttentionCount > 1 ? 's' : ''} needs attention.`;
      bannerIcon = <Clock className="w-5 h-5 text-amber-400" />;
      bannerColor = "border-amber-500/20 bg-amber-500/10";
    } else if (campaigns.length === 0) {
      bannerText = "Welcome to Collabo. Create your first campaign to get started.";
      bannerIcon = <Zap className="w-5 h-5 text-blue-400" />;
      bannerColor = "border-blue-500/20 bg-blue-500/10";
    }
  }

  const loadSampleData = async () => {
    try {
      setIsLoading(true);
      await loadSampleDataApi();
      toast.success('Sample data loaded! Feel free to explore.');
      await fetchCampaigns(true);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to load sample data.'));
      setIsLoading(false);
    }
  };

  return (
    <div className="pb-20 md:pb-8">
      {/* ── 1. Executive Brief Banner ── */}
      <div className={`mb-6 p-4 rounded-2xl border flex items-center gap-3 ${bannerColor}`}>
        {bannerIcon}
        <h2 className="font-bold text-white text-sm">{bannerText}</h2>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-extrabold text-white">Dashboard</h1>
        <div className="flex gap-2">
          <button onClick={() => fetchCampaigns(true)} className="p-2.5 bg-slate-800 rounded-xl border border-slate-700 text-slate-300">
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={openModal} className="flex items-center gap-2 bg-emerald-500 text-white font-bold rounded-xl px-4 py-2 text-sm shadow-lg shadow-emerald-500/20">
            <Plus className="w-4 h-4" /> New
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-6">
          <div className="h-32 bg-slate-800/50 rounded-2xl" />
          <div className="h-32 bg-slate-800/50 rounded-2xl" />
          <div className="h-64 bg-slate-800/50 rounded-2xl" />
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm">
          {error}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-20 bg-slate-900/40 border border-slate-800/50 rounded-3xl">
          <Zap className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-white mb-2">No Campaigns Yet</h2>
          <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">Your AI Campaign Manager is ready. Add your first campaign to see the magic.</p>
          <button onClick={openModal} className="bg-emerald-500 text-white font-bold rounded-xl px-6 py-3 text-sm">
            Create Campaign
          </button>
          <button onClick={loadSampleData} className="block mx-auto mt-4 text-xs text-slate-500 underline">Load Sample Data</button>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* ── 2. Today's Priorities ── */}
          {insights && insights.todayPriorities.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Today's Priorities</h2>
              <div className="flex md:grid md:grid-cols-3 gap-4 overflow-x-auto pb-2 snap-x">
                {insights.todayPriorities.map(p => (
                  <div key={p.id} className="snap-start flex-shrink-0 w-72 md:w-auto bg-rose-500/5 border border-rose-500/20 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                      <span className="text-xs font-bold text-rose-400">{p.reason}</span>
                    </div>
                    <p className="font-bold text-white text-lg mb-4">{p.influencerName}</p>
                    <button className="w-full py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 rounded-lg text-xs font-bold transition-colors">
                      {p.actionText}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 3. Recommended Actions ── */}
          {insights && insights.recommendedActions.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Recommended Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {insights.recommendedActions.slice(0, 4).map(r => (
                  <div key={r.id} className="flex items-center justify-between p-3.5 bg-slate-900/60 border border-slate-700/50 rounded-xl">
                    <div>
                      <p className="text-sm font-bold text-white">{r.influencerName}</p>
                      <p className="text-xs text-slate-500">{r.reason}</p>
                    </div>
                    <button className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg border border-slate-700 transition-colors">
                      {r.actionText}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 4. Mobile Campaign Cards (Hidden on Desktop) ── */}
          <div className="md:hidden">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex justify-between">
              Active Campaigns
              <span className="text-slate-500">({stats?.active})</span>
            </h2>
            <div className="space-y-3">
              {campaigns.filter(c => c.status !== 'cancelled').slice(0, 5).map(c => (
                <MobileCampaignCard key={c.id} campaign={c} onEdit={setEditingCampaign} />
              ))}
            </div>
          </div>

          {/* ── 5. Campaign Overview (Scrollable on mobile) ── */}
          {stats && (
            <div>
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Overview</h2>
              <div className="flex md:grid md:grid-cols-4 gap-4 overflow-x-auto pb-2 snap-x">
                <StatCard label="Active Campaigns" value={String(stats.active)} icon={TrendingUp} accent="emerald" />
                <StatCard label="Overdue" value={String(stats.overdue)} icon={AlertCircle} accent={stats.overdue > 0 ? 'rose' : 'slate'} />
                <StatCard label="Pending Spend" value={`₹${(stats.pendingSpend / 1000).toFixed(0)}K`} icon={DollarSign} accent="amber" />
                <StatCard label="Total Managed" value={String(stats.total)} icon={Users} accent="blue" />
              </div>
            </div>
          )}

          {/* ── 6. Campaign Table (Desktop Only) ── */}
          <div className="hidden md:block">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Campaign Directory</h2>
            </div>
            <div className="bg-slate-900/40 border border-slate-800/50 rounded-2xl p-4">
              <CampaignTable
                campaigns={campaigns}
                isLoading={isLoading}
                onRefresh={() => fetchCampaigns(true)}
                onCreateNew={openModal}
                onEdit={setEditingCampaign}
                onLoadSampleData={loadSampleData}
              />
            </div>
          </div>

          {/* ── 7. Founder Productivity Metrics ── */}
          {insights && (
            <div>
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Productivity ROI</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                  <Clock className="w-5 h-5 text-emerald-400 mb-2" />
                  <p className="text-2xl font-black text-white">{insights.productivity.estimatedTimeSavedHours}h</p>
                  <p className="text-[10px] uppercase text-emerald-500 font-bold mt-1">Time Saved</p>
                </div>
                
                <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4">
                  <ShieldCheck className="w-5 h-5 text-blue-400 mb-2" />
                  <p className="text-2xl font-black text-white">{insights.productivity.deadlinesProtected}</p>
                  <p className="text-[10px] uppercase text-slate-500 font-bold mt-1">Deadlines Protected</p>
                </div>
                
                <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4">
                  <Zap className="w-5 h-5 text-amber-400 mb-2" />
                  <p className="text-2xl font-black text-white">{insights.productivity.aiExtractions}</p>
                  <p className="text-[10px] uppercase text-slate-500 font-bold mt-1">AI Extractions</p>
                </div>

                <div className="hidden md:block bg-slate-900/60 border border-slate-700/50 rounded-xl p-4">
                  <Users className="w-5 h-5 text-purple-400 mb-2" />
                  <p className="text-2xl font-black text-white">{insights.productivity.creatorFollowUpsAutomated}</p>
                  <p className="text-[10px] uppercase text-slate-500 font-bold mt-1">Automated Follow-ups</p>
                </div>

              </div>
              <div className="md:hidden mt-3 text-center">
                <button className="text-xs text-slate-500 hover:text-slate-400 font-semibold underline">View More Metrics</button>
              </div>
            </div>
          )}
          
        </div>
      )}

      {/* Modals */}
      <CreateCampaignModal isOpen={isModalOpen} onClose={closeModal} onSuccess={() => fetchCampaigns(true)} />
      <EditCampaignModal campaign={editingCampaign} isOpen={!!editingCampaign} onClose={() => setEditingCampaign(null)} onSuccess={() => { fetchCampaigns(true); setEditingCampaign(null); }} />
    </div>
  );
}
