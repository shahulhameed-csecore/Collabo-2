'use client';

import { useState, useEffect, useMemo } from 'react';
import { getInfluencers, InfluencerProfile, updateInfluencerProfile, getCampaigns } from '@/lib/api';
import type { Campaign } from '@/lib/types';
import { toast } from 'sonner';
import {
  Users,
  Search,
  Save,
  X,
  Star,
  ShieldCheck,
  TrendingUp,
  ChevronRight,
  FileText,
  Lock,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  DollarSign
} from 'lucide-react';
import { PlatformIcon } from '@/components/PlatformIcon';
import Link from 'next/link';

// Normalize handle helper: strip '@', lowercase, trim. Fallback to slugifying name if handle is placeholder
const normalizeHandle = (handle?: string | null, name?: string | null): string => {
  let h = (handle || '').trim().toLowerCase();
  if (h.startsWith('@')) h = h.slice(1).trim();
  if (!h || ['n/a', 'none', 'unknown', 'null', 'undefined'].includes(h)) {
    const n = (name || '').trim().toLowerCase();
    if (n && !['unknown', 'n/a', 'none'].includes(n)) {
      return n.replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '') || 'creator';
    }
    return 'creator';
  }
  return h.replace(/^[^\w]+/, '') || h;
};

// Formatted display handle with clean leading '@'
const formatDisplayHandle = (handle: string, name?: string | null): string => {
  const norm = normalizeHandle(handle, name);
  return `@${norm}`;
};

// Clean comma-separated platform list
const parsePlatformBadges = (platformStr?: string | null): string[] => {
  if (!platformStr) return [];
  return platformStr
    .split(',')
    .map(p => p.trim())
    .filter(Boolean);
};

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
              <h1 className="text-2xl font-semibold tracking-tight text-white flex items-center gap-2">
                Influencer CRM
              </h1>
              <span className="font-mono text-xs text-emerald-400 bg-emerald-500/[0.08] border border-emerald-500/20 px-2 py-0.5 rounded-full">
                {influencers.length} Roster
              </span>
            </div>
            <p className="text-xs text-slate-400 font-sans mt-1 font-normal">
              Your creator directory, history, and notes.
            </p>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="py-2 px-3 border border-white/[0.08] rounded-xl bg-[#0A0E17] text-slate-200 focus:outline-none focus:border-emerald-500/50 text-xs transition-all appearance-none cursor-pointer"
            >
              {platforms.map(p => (
                <option key={p} value={p} className="bg-[#0A0E17] text-slate-200">
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
                className="w-full pl-9 pr-8 py-2 border border-white/[0.08] rounded-xl bg-[#0A0E17] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 text-xs transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-white rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 4-Metric Architectural CRM Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#0A0E17] border border-white/[0.07] rounded-xl p-4 shadow-sm hover:border-white/[0.12] transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">Total Creators</span>
              <Users className="w-4 h-4 text-slate-500" />
            </div>
            <div className="font-mono text-2xl font-semibold text-white tracking-tight">
              {isLoading ? '—' : stats.totalCreators}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Verified roster talent</p>
          </div>

          <div className="bg-[#0A0E17] border border-white/[0.07] rounded-xl p-4 shadow-sm hover:border-white/[0.12] transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">Active Partnerships</span>
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="font-mono text-2xl font-semibold text-emerald-400 tracking-tight">
              {isLoading ? '—' : stats.activePartnerships}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Deliverables in flight</p>
          </div>

          <div className="bg-[#0A0E17] border border-white/[0.07] rounded-xl p-4 shadow-sm hover:border-white/[0.12] transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">Avg. Reliability</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="font-mono text-2xl font-semibold text-emerald-400 tracking-tight">
              {isLoading ? '—' : `${stats.avgReliability}%`}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Approved & on-time delivery</p>
          </div>

          <div className="bg-[#0A0E17] border border-white/[0.07] rounded-xl p-4 shadow-sm hover:border-white/[0.12] transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">Repeat Creators</span>
              <TrendingUp className="w-4 h-4 text-slate-400" />
            </div>
            <div className="font-mono text-2xl font-semibold text-white tracking-tight">
              {isLoading ? '—' : stats.repeatCreators}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Multi-campaign partners</p>
          </div>
        </div>

        {/* High-Density Attio-Style CRM Table */}
        <div className="bg-[#0A0E17] border border-white/[0.07] rounded-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.07] bg-[#070A10]">
                  <th className="px-5 py-3 font-mono text-[11px] font-medium tracking-wider text-slate-400 uppercase">
                    Creator
                  </th>
                  <th className="px-5 py-3 font-mono text-[11px] font-medium tracking-wider text-slate-400 uppercase">
                    Platforms
                  </th>
                  <th className="px-5 py-3 font-mono text-[11px] font-medium tracking-wider text-slate-400 uppercase">
                    Campaigns
                  </th>
                  <th className="px-5 py-3 font-mono text-[11px] font-medium tracking-wider text-slate-400 uppercase">
                    Lifetime Spend
                  </th>
                  <th className="px-5 py-3 font-mono text-[11px] font-medium tracking-wider text-slate-400 uppercase">
                    Reliability
                  </th>
                  <th className="px-5 py-3 font-mono text-[11px] font-medium tracking-wider text-slate-400 uppercase">
                    Last Collab
                  </th>
                  <th className="px-5 py-3 font-mono text-[11px] font-medium tracking-wider text-slate-400 uppercase text-right">
                    Dossier
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {isLoading ? (
                  [1, 2, 3, 4, 5].map(i => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.06]" />
                          <div className="space-y-1.5">
                            <div className="h-3 w-28 bg-white/[0.04] rounded" />
                            <div className="h-2.5 w-16 bg-white/[0.04] rounded" />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4"><div className="h-5 w-20 bg-white/[0.04] rounded" /></td>
                      <td className="px-5 py-4"><div className="h-5 w-14 bg-white/[0.04] rounded" /></td>
                      <td className="px-5 py-4"><div className="h-5 w-16 bg-white/[0.04] rounded" /></td>
                      <td className="px-5 py-4"><div className="h-5 w-24 bg-white/[0.04] rounded" /></td>
                      <td className="px-5 py-4"><div className="h-4 w-20 bg-white/[0.04] rounded" /></td>
                      <td className="px-5 py-4 text-right"><div className="h-4 w-12 bg-white/[0.04] rounded ml-auto" /></td>
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="p-4 bg-white/[0.03] border border-white/[0.07] rounded-2xl mb-3">
                          <Users className="w-7 h-7 text-slate-400" />
                        </div>
                        <h3 className="text-sm font-semibold text-white mb-1">
                          {(search || platformFilter !== 'All') ? 'No creators found' : 'No creator relationships yet'}
                        </h3>
                        <p className="text-xs text-slate-400 max-w-sm mb-4 leading-relaxed">
                          {(search || platformFilter !== 'All')
                            ? 'No creators match your current filter parameters. Try clearing your query.'
                            : 'Creators appear automatically as campaigns are logged. Start tracking to build your command CRM.'}
                        </p>
                        {(search || platformFilter !== 'All') ? (
                          <button
                            onClick={() => { setSearch(''); setPlatformFilter('All'); }}
                            className="px-3.5 py-1.5 text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 border border-white/[0.08] rounded-lg transition"
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
                  filtered.map((inf) => {
                    const initials = (inf.name || inf.handle)
                      .replace(/^[^a-zA-Z0-9]+/, '')
                      .slice(0, 2)
                      .toUpperCase() || 'CR';

                    const platformsList = parsePlatformBadges(inf.platform);
                    const displayHandle = formatDisplayHandle(inf.handle, inf.name);

                    return (
                      <tr
                        key={inf.handle}
                        onClick={() => handleRowClick(inf)}
                        className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
                      >
                        {/* 1. CREATOR */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-[#101624] border border-white/[0.10] text-slate-200 font-mono text-xs font-semibold flex items-center justify-center shadow-inner relative flex-shrink-0">
                              {initials}
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-[#0A0E17] ${
                                  inf.success_rate >= 70
                                    ? 'bg-emerald-400'
                                    : inf.success_rate < 0
                                    ? 'bg-amber-400'
                                    : 'bg-rose-400'
                                }`}
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="font-sans text-sm font-medium text-slate-100 group-hover:text-emerald-400 transition-colors truncate">
                                {inf.name || 'Unknown'}
                              </p>
                              <p className="font-mono text-xs text-slate-400 truncate">
                                {displayHandle}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* 2. PLATFORMS */}
                        <td className="px-5 py-3.5">
                          {platformsList.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {platformsList.map(p => {
                                const pLower = p.toLowerCase();
                                const isYoutube = pLower.includes('youtube') || pLower.includes('yt');
                                const isInstagram = pLower.includes('instagram') || pLower.includes('ig');
                                const isTiktok = pLower.includes('tiktok');
                                const isTwitter = pLower.includes('twitter') || pLower.includes('x');
                                const isLinkedin = pLower.includes('linkedin');

                                const badgeStyle = isYoutube
                                  ? 'bg-rose-500/[0.08] text-rose-300 border-rose-500/20'
                                  : isInstagram
                                  ? 'bg-pink-500/[0.08] text-pink-300 border-pink-500/20'
                                  : isTiktok
                                  ? 'bg-cyan-500/[0.08] text-cyan-300 border-cyan-500/20'
                                  : isTwitter
                                  ? 'bg-sky-500/[0.08] text-sky-300 border-sky-500/20'
                                  : isLinkedin
                                  ? 'bg-blue-500/[0.08] text-blue-300 border-blue-500/20'
                                  : 'bg-white/[0.04] text-slate-300 border-white/[0.08]';

                                return (
                                  <span
                                    key={p}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${badgeStyle}`}
                                  >
                                    <PlatformIcon platform={p} className="w-3 h-3 flex-shrink-0 opacity-80" fallbackToImage={false} />
                                    <span>{p}</span>
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-slate-500 text-xs">—</span>
                          )}
                        </td>

                        {/* 3. CAMPAIGNS */}
                        <td className="px-5 py-3.5">
                          <span className="font-mono tabular-nums text-xs text-slate-300 bg-white/[0.04] border border-white/[0.07] px-2 py-0.5 rounded">
                            {inf.total_campaigns} {inf.total_campaigns === 1 ? 'collab' : 'collabs'}
                          </span>
                        </td>

                        {/* 4. TOTAL SPEND */}
                        <td className="px-5 py-3.5">
                          <span className="font-mono tabular-nums text-sm font-medium text-slate-200">
                            {(inf.total_spend || 0) > 0 ? (
                              `₹${inf.total_spend.toLocaleString('en-IN')}`
                            ) : (
                              <span className="text-slate-400 text-xs font-mono">Gifted / Barter</span>
                            )}
                          </span>
                        </td>

                        {/* 5. RELIABILITY / SUCCESS RATE */}
                        <td className="px-5 py-3.5">
                          {inf.success_rate < 0 ? (
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-amber-400 bg-amber-500/[0.08] border border-amber-500/20 px-2 py-0.5 rounded">
                              <Clock className="w-3 h-3" />
                              In Progress
                            </span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    inf.success_rate >= 70
                                      ? 'bg-emerald-400'
                                      : inf.success_rate >= 40
                                      ? 'bg-amber-400'
                                      : 'bg-rose-400'
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(5, inf.success_rate))}%` }}
                                />
                              </div>
                              <span className="font-mono tabular-nums text-xs font-semibold text-emerald-400">
                                {inf.success_rate}%
                              </span>
                            </div>
                          )}
                        </td>

                        {/* 6. LAST COLLAB */}
                        <td className="px-5 py-3.5 font-mono tabular-nums text-xs text-slate-400">
                          {inf.last_collaboration
                            ? new Date(inf.last_collaboration).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '—'}
                        </td>

                        {/* 7. DOSSIER ACTION */}
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {inf.notes && (
                              <span className="inline-flex items-center gap-1 font-mono text-[10px] text-slate-300 bg-white/[0.04] border border-white/[0.08] px-1.5 py-0.5 rounded truncate max-w-[90px]">
                                <FileText className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                Notes
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 group-hover:text-emerald-400 transition-colors">
                              <span>Dossier</span>
                              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Creator Slide-Over Dossier Drawer */}
      {selectedInfluencer && (
        <div className="fixed inset-0 z-50 overflow-hidden animate-fade-in">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedInfluencer(null)}
          />

          {/* Slide-over panel */}
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div
              className="w-screen max-w-xl bg-[#0A0E17] border-l border-white/[0.08] shadow-2xl flex flex-col justify-between overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              {/* Drawer Content */}
              <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] pb-5">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-[#101624] border border-white/[0.12] text-slate-200 font-mono text-base font-bold flex items-center justify-center shadow-inner">
                      {(selectedInfluencer.name || selectedInfluencer.handle)
                        .replace(/^[^a-zA-Z0-9]+/, '')
                        .slice(0, 2)
                        .toUpperCase() || 'CR'}
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-white tracking-tight">
                        {selectedInfluencer.name || 'Unknown'}
                      </h2>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-xs text-emerald-400">
                          {formatDisplayHandle(selectedInfluencer.handle, selectedInfluencer.name)}
                        </span>
                        {parsePlatformBadges(selectedInfluencer.platform).map(p => (
                          <span
                            key={p}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-300 bg-white/[0.04] border border-white/[0.08]"
                          >
                            <PlatformIcon platform={p} className="w-2.5 h-2.5 opacity-80" fallbackToImage={false} />
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedInfluencer(null)}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* 3-Column Mini Stat Bar */}
                <div className="bg-[#05070B] border border-white/[0.07] rounded-xl p-3 grid grid-cols-3 divide-x divide-white/[0.06] text-center">
                  <div className="px-2">
                    <p className="text-[10px] font-mono uppercase text-slate-500 tracking-wider">Campaigns</p>
                    <p className="font-mono text-lg font-semibold text-white mt-0.5">
                      {selectedInfluencer.total_campaigns}
                    </p>
                  </div>
                  <div className="px-2">
                    <p className="text-[10px] font-mono uppercase text-slate-500 tracking-wider">Total Spend</p>
                    <p className="font-mono text-lg font-semibold text-emerald-400 mt-0.5">
                      {(selectedInfluencer.total_spend || 0) > 0
                        ? `₹${selectedInfluencer.total_spend.toLocaleString('en-IN')}`
                        : 'Gifted'}
                    </p>
                  </div>
                  <div className="px-2">
                    <p className="text-[10px] font-mono uppercase text-slate-500 tracking-wider">Reliability</p>
                    <p className="font-mono text-lg font-semibold text-white mt-0.5">
                      {selectedInfluencer.success_rate < 0 ? 'In Progress' : `${selectedInfluencer.success_rate}%`}
                    </p>
                  </div>
                </div>

                {/* Encrypted Brand Notes Terminal */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-white tracking-wide uppercase font-mono">
                      <Lock className="w-3.5 h-3.5 text-emerald-400" />
                      Private Creator Dossier & Rates
                    </label>
                    <span className="text-[10px] font-mono text-slate-500">Internal only</span>
                  </div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Enter creator rate cards, manager contact, shipping address, or collaboration nuances..."
                    className="w-full h-32 px-4 py-3 bg-[#05070B] border border-white/[0.08] focus:border-emerald-500/50 rounded-xl text-xs font-sans text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 resize-none transition-all leading-relaxed"
                  />
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-500">
                      Auto-syncs across team workspace
                    </span>
                    <button
                      onClick={handleSaveNotes}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-[#05070B] text-xs font-semibold rounded-lg transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {isSaving ? 'Saving...' : 'Save Notes'}
                    </button>
                  </div>
                </div>

                {/* Collaboration History Timeline */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-white tracking-wide uppercase font-mono flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Collaboration History
                    </h3>
                    <span className="font-mono text-[11px] text-slate-400">
                      {selectedCreatorCampaigns.length} {selectedCreatorCampaigns.length === 1 ? 'record' : 'records'}
                    </span>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {selectedCreatorCampaigns.map(camp => (
                      <div
                        key={camp.id}
                        className="bg-[#05070B] border border-white/[0.07] hover:border-white/[0.14] rounded-xl p-3 flex items-center justify-between gap-3 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-200 truncate">
                            {camp.deliverables || 'Deliverables Package'}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-mono text-[10px] text-slate-400">
                              {new Date(camp.created_at).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                            <span className="text-slate-600 text-[10px]">•</span>
                            <span
                              className={`text-[9px] font-mono font-medium uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                                camp.status === 'paid'
                                  ? 'bg-emerald-500/[0.08] text-emerald-300 border-emerald-500/20'
                                  : camp.status === 'approved'
                                  ? 'bg-blue-500/[0.08] text-blue-300 border-blue-500/20'
                                  : camp.status === 'active'
                                  ? 'bg-emerald-500/[0.08] text-emerald-300 border-emerald-500/20'
                                  : camp.status === 'content_received'
                                  ? 'bg-amber-500/[0.08] text-amber-300 border-amber-500/20'
                                  : 'bg-white/[0.04] text-slate-300 border-white/[0.08]'
                              }`}
                            >
                              {camp.status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <span className="font-mono text-xs font-semibold text-emerald-400">
                            {(camp.payment_amount || 0) > 0
                              ? `₹${camp.payment_amount?.toLocaleString('en-IN')}`
                              : 'Gifted'}
                          </span>
                        </div>
                      </div>
                    ))}

                    {selectedCreatorCampaigns.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-8 bg-[#05070B] rounded-xl border border-white/[0.06] border-dashed">
                        <Star className="w-5 h-5 text-slate-600 mb-1.5" />
                        <p className="text-xs text-slate-500 font-mono">No active campaign records found.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-white/[0.07] bg-[#070A10] flex justify-end">
                <button
                  onClick={() => setSelectedInfluencer(null)}
                  className="px-4 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-lg transition"
                >
                  Close Dossier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
