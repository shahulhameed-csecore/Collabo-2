'use client';

import { useState, useEffect, useMemo } from 'react';
import { getInfluencers, InfluencerProfile, updateInfluencerProfile, getCampaigns } from '@/lib/api';
import type { Campaign } from '@/lib/types';
import { toast } from 'sonner';
import {
  Users,
  Search,
  ShieldCheck,
  TrendingUp,
  Clock,
  Sparkles,
  DollarSign,
  X
} from 'lucide-react';
import Link from 'next/link';
import InfluencerCard, { normalizeHandle, formatDisplayHandle, parsePlatformBadges } from '@/components/influencers/InfluencerCard';
import InfluencerDrawer from '@/components/influencers/InfluencerDrawer';

export default function InfluencersPage() {
  const [influencers, setInfluencers] = useState<InfluencerProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState('All');
  const [selectedInfluencer, setSelectedInfluencer] = useState<InfluencerProfile | null>(null);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [allCampaigns, setAllCampaigns] = useState<Campaign[]>([]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [infData, campData] = await Promise.allSettled([
        getInfluencers(),
        getCampaigns(200, 0)
      ]);
      
      let fetchedCampaigns: Campaign[] = [];
      if (campData.status === 'fulfilled') {
        fetchedCampaigns = campData.value.data || [];
        setAllCampaigns(fetchedCampaigns);
      } else {
        setAllCampaigns([]);
      }

      if (infData.status === 'fulfilled') {
        // Airtight deduplication and merging on normalized handle
        const rawList = infData.value || [];
        const mergedMap = new Map<string, InfluencerProfile>();

        for (const item of rawList) {
          const key = normalizeHandle(item.handle, item.name);
          if (!mergedMap.has(key)) {
            mergedMap.set(key, { ...item, handle: key });
          } else {
            const existing = mergedMap.get(key)!;
            existing.total_campaigns += item.total_campaigns;
            existing.total_spend = (existing.total_spend || 0) + (item.total_spend || 0);
            if (!existing.notes && item.notes) existing.notes = item.notes;
            if (item.last_collaboration) {
              if (!existing.last_collaboration || item.last_collaboration > existing.last_collaboration) {
                existing.last_collaboration = item.last_collaboration;
              }
            }
          }
        }

        setInfluencers(Array.from(mergedMap.values()));
      } else {
        toast.error('Failed to load influencer metrics');
        setInfluencers([]);
      }
    } catch (_err) {
      toast.error('Failed to load CRM data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRowClick = (inf: InfluencerProfile) => {
    setSelectedInfluencer(inf);
    setNotes(inf.notes || '');
  };

  const handleSaveNotes = async () => {
    if (!selectedInfluencer) return;
    setIsSaving(true);
    try {
      await updateInfluencerProfile(selectedInfluencer.handle, { notes });
      toast.success('Dossier notes saved successfully');
      setInfluencers(prev => prev.map(inf => inf.handle === selectedInfluencer.handle ? { ...inf, notes } : inf));
      setSelectedInfluencer(prev => prev ? { ...prev, notes } : null);
    } catch (_err) {
      toast.error('Failed to save notes');
    } finally {
      setIsSaving(false);
    }
  };

  // KPI Calculations
  const stats = useMemo(() => {
    const totalCreators = influencers.length;

    // Active partnerships: creators with active or in-review campaigns
    const activePartnershipCreatorKeys = new Set(
      allCampaigns
        .filter(c => ['active', 'content_received', 'needs_revision', 'draft'].includes(c.status))
        .map(c => normalizeHandle(c.influencer_handle, c.influencer_name))
    );
    const activePartnerships = activePartnershipCreatorKeys.size;

    // Reliability score: average across resolved creators (success_rate >= 0)
    const resolvedCreators = influencers.filter(inf => inf.success_rate >= 0);
    const avgReliability = resolvedCreators.length > 0
      ? Math.round(resolvedCreators.reduce((acc, curr) => acc + curr.success_rate, 0) / resolvedCreators.length)
      : 100;

    // Repeat creators: creators with > 1 campaigns
    const repeatCreators = influencers.filter(inf => inf.total_campaigns > 1).length;

    return {
      totalCreators,
      activePartnerships,
      avgReliability,
      repeatCreators,
    };
  }, [influencers, allCampaigns]);

  // Filtered creators
  const filtered = useMemo(() => {
    return influencers.filter(inf => {
      const displayHandle = formatDisplayHandle(inf.handle, inf.name);
      const searchTarget = `${inf.name || ''} ${displayHandle} ${inf.platform || ''}`.toLowerCase();
      const matchesSearch = searchTarget.includes(search.toLowerCase());

      if (platformFilter === 'All') return matchesSearch;
      const creatorPlatforms = parsePlatformBadges(inf.platform).map(p => p.toLowerCase());
      const matchesPlatform = creatorPlatforms.some(p => p.includes(platformFilter.toLowerCase()));

      return matchesSearch && matchesPlatform;
    });
  }, [influencers, search, platformFilter]);

  // Selected creator's campaign history (matches on normalized handle)
  const selectedCreatorCampaigns = useMemo(() => {
    if (!selectedInfluencer) return [];
    const targetKey = normalizeHandle(selectedInfluencer.handle, selectedInfluencer.name);
    return allCampaigns
      .filter(c => normalizeHandle(c.influencer_handle, c.influencer_name) === targetKey)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [selectedInfluencer, allCampaigns]);

  const platforms = ['All', 'YouTube', 'Instagram', 'TikTok', 'X', 'LinkedIn'];

  return (
    <>
      <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-12">
        {/* Top Command Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                Influencer CRM
              </h1>
              <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/[0.08] border border-emerald-500/20 px-2 py-0.5 rounded-full">
                {influencers.length} Roster
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-sans mt-1 font-normal">
              Your creator directory, history, and notes.
            </p>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="py-2 px-3 border border-slate-200 dark:border-white/[0.08] rounded-xl bg-white dark:bg-[#0A0E17] text-slate-700 dark:text-slate-200 focus:outline-none focus:border-emerald-500/50 text-xs transition-all appearance-none cursor-pointer"
            >
              {platforms.map(p => (
                <option key={p} value={p} className="bg-white dark:bg-[#0A0E17] text-slate-700 dark:text-slate-200">
                  {p === 'All' ? 'All Platforms' : p}
                </option>
              ))}
            </select>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search creator or @handle..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 border border-slate-200 dark:border-white/[0.08] rounded-xl bg-white dark:bg-[#0A0E17] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 text-xs transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 4-Metric Architectural CRM Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-[#0A0E17] border border-slate-200 dark:border-white/[0.07] rounded-xl p-4 shadow-sm hover:border-slate-300 dark:hover:border-white/[0.12] transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Creators</span>
              <Users className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            </div>
            <div className="font-mono text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">
              {isLoading ? '—' : stats.totalCreators}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Verified roster talent</p>
          </div>

          <div className="bg-white dark:bg-[#0A0E17] border border-slate-200 dark:border-white/[0.07] rounded-xl p-4 shadow-sm hover:border-slate-300 dark:hover:border-white/[0.12] transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Active Partnerships</span>
              <Sparkles className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div className="font-mono text-2xl font-semibold text-emerald-600 dark:text-emerald-400 tracking-tight">
              {isLoading ? '—' : stats.activePartnerships}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Deliverables in flight</p>
          </div>

          <div className="bg-white dark:bg-[#0A0E17] border border-slate-200 dark:border-white/[0.07] rounded-xl p-4 shadow-sm hover:border-slate-300 dark:hover:border-white/[0.12] transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Avg. Reliability</span>
              <ShieldCheck className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div className="font-mono text-2xl font-semibold text-emerald-600 dark:text-emerald-400 tracking-tight">
              {isLoading ? '—' : `${stats.avgReliability}%`}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Approved & on-time delivery</p>
          </div>

          <div className="bg-white dark:bg-[#0A0E17] border border-slate-200 dark:border-white/[0.07] rounded-xl p-4 shadow-sm hover:border-slate-300 dark:hover:border-white/[0.12] transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Repeat Creators</span>
              <TrendingUp className="w-4 h-4 text-slate-400" />
            </div>
            <div className="font-mono text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">
              {isLoading ? '—' : stats.repeatCreators}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Multi-campaign partners</p>
          </div>
        </div>

        {/* High-Density Attio-Style CRM Table */}
        <div className="bg-white dark:bg-[#0A0E17] border border-slate-200 dark:border-white/[0.07] rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/[0.07] bg-slate-50 dark:bg-[#070A10]">
                  <th className="px-5 py-3 font-mono text-[11px] font-medium tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                    Creator
                  </th>
                  <th className="px-5 py-3 font-mono text-[11px] font-medium tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                    Platforms
                  </th>
                  <th className="px-5 py-3 font-mono text-[11px] font-medium tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                    Campaigns
                  </th>
                  <th className="px-5 py-3 font-mono text-[11px] font-medium tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                    Lifetime Spend
                  </th>
                  <th className="px-5 py-3 font-mono text-[11px] font-medium tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                    Reliability
                  </th>
                  <th className="px-5 py-3 font-mono text-[11px] font-medium tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                    Last Collab
                  </th>
                  <th className="px-5 py-3 font-mono text-[11px] font-medium tracking-wider text-slate-500 dark:text-slate-400 uppercase text-right">
                    Dossier
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                {isLoading ? (
                  [1, 2, 3, 4, 5].map(i => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.06]" />
                          <div className="space-y-1.5">
                            <div className="h-3 w-28 bg-slate-100 dark:bg-white/[0.04] rounded" />
                            <div className="h-2.5 w-16 bg-slate-100 dark:bg-white/[0.04] rounded" />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4"><div className="h-5 w-20 bg-slate-100 dark:bg-white/[0.04] rounded" /></td>
                      <td className="px-5 py-4"><div className="h-5 w-14 bg-slate-100 dark:bg-white/[0.04] rounded" /></td>
                      <td className="px-5 py-4"><div className="h-5 w-16 bg-slate-100 dark:bg-white/[0.04] rounded" /></td>
                      <td className="px-5 py-4"><div className="h-5 w-24 bg-slate-100 dark:bg-white/[0.04] rounded" /></td>
                      <td className="px-5 py-4"><div className="h-4 w-20 bg-slate-100 dark:bg-white/[0.04] rounded" /></td>
                      <td className="px-5 py-4 text-right"><div className="h-4 w-12 bg-slate-100 dark:bg-white/[0.04] rounded ml-auto" /></td>
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="p-4 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] rounded-2xl mb-3">
                          <Users className="w-7 h-7 text-slate-400" />
                        </div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                          {(search || platformFilter !== 'All') ? 'No creators found' : 'No creator relationships yet'}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-4 leading-relaxed">
                          {(search || platformFilter !== 'All')
                            ? 'No creators match your current filter parameters. Try clearing your query.'
                            : 'Creators appear automatically as campaigns are logged. Start tracking to build your command CRM.'}
                        </p>
                        {(search || platformFilter !== 'All') ? (
                          <button
                            onClick={() => { setSearch(''); setPlatformFilter('All'); }}
                            className="px-3.5 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/[0.08] rounded-lg transition"
                          >
                            Clear Filters
                          </button>
                        ) : (
                          <Link
                            href="/dashboard"
                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-[#05070B] font-semibold rounded-lg text-xs transition shadow-lg shadow-emerald-500/20"
                          >
                            Go to Dashboard
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((inf) => (
                    <InfluencerCard
                      key={inf.handle}
                      influencer={inf}
                      onClick={() => handleRowClick(inf)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Creator Slide-Over Dossier Drawer */}
      <InfluencerDrawer
        influencer={selectedInfluencer}
        campaigns={selectedCreatorCampaigns}
        notes={notes}
        isSaving={isSaving}
        onNotesChange={setNotes}
        onSaveNotes={handleSaveNotes}
        onClose={() => setSelectedInfluencer(null)}
      />
    </>
  );
}
