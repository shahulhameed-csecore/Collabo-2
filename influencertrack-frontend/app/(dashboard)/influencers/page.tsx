'use client';

import { useState, useEffect } from 'react';
import { getInfluencers, InfluencerProfile, updateInfluencerProfile, getCampaigns } from '@/lib/api';
import type { Campaign } from '@/lib/types';
import { toast } from 'sonner';
import { Users, Search, Save, X, Star } from 'lucide-react';
import Link from 'next/link';

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
        getCampaigns()
      ]);
      
      if (infData.status === 'fulfilled') {
        setInfluencers(infData.value);
      } else {
        toast.error('Failed to load influencer metrics');
        setInfluencers([]);
      }

      if (campData.status === 'fulfilled') {
        setAllCampaigns(campData.value.data);
      } else {
        setAllCampaigns([]);
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
      toast.success('Notes saved successfully');
      setInfluencers(prev => prev.map(inf => inf.handle === selectedInfluencer.handle ? { ...inf, notes } : inf));
      setSelectedInfluencer(null);
    } catch (_err) {
      toast.error('Failed to save notes');
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = influencers.filter(inf => {
    const matchesSearch = inf.handle.toLowerCase().includes(search.toLowerCase()) || 
                          (inf.name && inf.name.toLowerCase().includes(search.toLowerCase()));
    const matchesPlatform = platformFilter === 'All' || inf.platform === platformFilter;
    return matchesSearch && matchesPlatform;
  });

  const platforms = ['All', 'Instagram', 'YouTube', 'TikTok', 'Twitter', 'X', 'LinkedIn'];

  return (
    <>
      <div className="max-w-6xl mx-auto space-y-5 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <Users className="w-4 h-4 text-emerald-400" />
              </div>
              Influencer CRM
            </h1>
            <p className="text-slate-500 text-sm mt-1">Manage your creator relationships and notes.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="py-2.5 px-3 border border-slate-200 dark:border-slate-700/80 rounded-xl bg-white dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/15 text-sm w-full sm:w-auto transition-all appearance-none cursor-pointer"
            >
              {platforms.map(p => (
                <option key={p} value={p}>{p === 'All' ? 'All Platforms' : p}</option>
              ))}
            </select>
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search creators..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-8 py-2.5 border border-slate-200 dark:border-slate-700/80 rounded-xl bg-white dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/15 text-sm w-full sm:w-60 transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800/50 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/80 dark:bg-slate-900/60 text-left">
                  <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-widest">Influencer</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-widest">Platform</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-widest">Campaigns</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-widest">Success Rate</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-widest">Last Collab</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                {isLoading ? (
                  [1, 2, 3, 4].map(i => (
                    <tr key={i}>
                      <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="skeleton w-10 h-10 rounded-full" /><div className="space-y-1.5"><div className="skeleton h-3 w-28 rounded" /><div className="skeleton h-2.5 w-20 rounded" /></div></div></td>
                      <td className="px-6 py-4"><div className="skeleton h-5 w-16 rounded-full" /></td>
                      <td className="px-6 py-4"><div className="skeleton h-5 w-8 rounded" /></td>
                      <td className="px-6 py-4"><div className="skeleton h-5 w-12 rounded" /></td>
                      <td className="px-6 py-4"><div className="skeleton h-5 w-20 rounded" /></td>
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center justify-center animate-fade-in">
                        <div className="p-5 bg-emerald-500/8 border border-emerald-500/15 rounded-3xl mb-4">
                          <Users className="w-8 h-8 text-emerald-400" />
                        </div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1.5">
                          {(search || platformFilter !== 'All') ? 'No creators found' : 'No creator relationships yet'}
                        </h3>
                        <p className="text-slate-500 text-sm max-w-sm leading-relaxed mb-4">
                          {(search || platformFilter !== 'All')
                            ? 'No creators match your current filters. Try adjusting them.'
                            : 'Creator profiles appear automatically as you add campaigns. Start tracking to build your CRM.'}
                        </p>
                        {(search || platformFilter !== 'All') ? (
                          <button
                            onClick={() => { setSearch(''); setPlatformFilter('All'); }}
                            className="flex items-center gap-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-full px-5 py-2.5 text-sm transition-all border border-slate-200 dark:border-slate-700"
                          >
                            <X className="w-4 h-4" />
                            Clear Filters
                          </button>
                        ) : (
                          <Link
                            href="/dashboard"
                            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl px-5 py-2.5 text-sm transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                          >
                            Go to Dashboard
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((inf, idx) => {
                    // Deterministic gradient based on handle
                    const gradients = [
                      'from-emerald-400 to-teal-500',
                      'from-blue-400 to-purple-500',
                      'from-amber-400 to-orange-500',
                      'from-pink-400 to-rose-500',
                      'from-violet-400 to-indigo-500',
                      'from-cyan-400 to-blue-500',
                    ];
                    const gradientIdx = inf.handle.charCodeAt(1) % gradients.length;
                    const gradient = gradients[gradientIdx];

                    const platformStyles: Record<string, string> = {
                      Instagram: 'bg-pink-500/15 text-pink-400 border border-pink-500/20',
                      YouTube:   'bg-red-500/15 text-red-400 border border-red-500/20',
                      Twitter:   'bg-sky-500/15 text-sky-400 border border-sky-500/20',
                      X:         'bg-sky-500/15 text-sky-400 border border-sky-500/20',
                      LinkedIn:  'bg-blue-500/15 text-blue-400 border border-blue-500/20',
                    };
                    const platformStyle = platformStyles[inf.platform ?? ''] ?? 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700';

                    return (
                      <tr
                        key={inf.handle}
                        onClick={() => handleRowClick(inf)}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors cursor-pointer group"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center font-bold text-white text-xs flex-shrink-0 ring-2 ring-white dark:ring-slate-900 shadow-md`}>
                              {(inf.name || inf.handle).slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white text-sm group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                {inf.name || 'Unknown'}
                              </p>
                              <p className="text-xs text-slate-400">
                                {inf.handle.startsWith('[name]:') || inf.handle.startsWith('[id]:') ? 'N/A' : inf.handle}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {inf.platform ? (
                            <span className={`inline-block text-[11px] font-bold px-2.5 py-1 rounded-full ${platformStyle}`}>
                              {inf.platform}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-slate-900 dark:text-white">{inf.total_campaigns}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  inf.success_rate < 0 ? 'bg-slate-300 dark:bg-slate-600' :
                                  inf.success_rate >= 70 ? 'bg-emerald-400' :
                                  inf.success_rate >= 40 ? 'bg-amber-400' :
                                  'bg-rose-400'
                                }`}
                                style={{ width: `${inf.success_rate < 0 ? 100 : inf.success_rate}%` }}
                              />
                            </div>
                            <span className={`text-xs font-bold ${
                              inf.success_rate < 0 ? 'text-slate-500 dark:text-slate-400' :
                              inf.success_rate >= 70 ? 'text-emerald-500 dark:text-emerald-400' :
                              inf.success_rate >= 40 ? 'text-amber-500 dark:text-amber-400' :
                              'text-rose-500 dark:text-rose-400'
                            }`}>{inf.success_rate < 0 ? 'N/A' : `${inf.success_rate}%`}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs">
                          {inf.last_collaboration
                            ? new Date(inf.last_collaboration).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '—'}
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

      {/* Premium CRM Modal / Drawer */}
      {selectedInfluencer && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div 
            className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-600 dark:text-emerald-400 text-xl shadow-inner">
                  {(selectedInfluencer.name || selectedInfluencer.handle).slice(0,2).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedInfluencer.name || 'Unknown'}</h2>
                  <p className="text-emerald-600 dark:text-emerald-400 font-medium text-sm">
                    {selectedInfluencer.handle.startsWith('[name]:') || selectedInfluencer.handle.startsWith('[id]:') ? 'N/A' : selectedInfluencer.handle}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedInfluencer(null)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Collabs</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">{selectedInfluencer.total_campaigns}</p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-500/10 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-500/20">
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-500 uppercase tracking-wider mb-1">Success Rate</p>
                  <div className="flex items-center gap-1.5">
                    <Star className="w-5 h-5 text-emerald-500 fill-emerald-500" />
                    <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{selectedInfluencer.success_rate}%</p>
                  </div>
                </div>
              </div>

              {/* Campaign History List */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-3">Recent Campaigns</label>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                  {allCampaigns
                    .filter(c => c.influencer_handle === selectedInfluencer.handle)
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .map(camp => (
                      <div key={camp.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/60 rounded-xl hover:border-emerald-500/30 dark:hover:border-emerald-500/30 transition-colors shadow-sm gap-3">
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[250px]">{camp.deliverables || 'Unnamed Campaign'}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-[10px] font-semibold text-slate-500 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded shadow-sm border border-slate-100 dark:border-slate-800">{new Date(camp.created_at).toLocaleDateString()}</p>
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm border ${
                              camp.status === 'paid' ? 'bg-slate-100 text-slate-700 border-slate-200' :
                              camp.status === 'approved' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              camp.status === 'draft' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>{camp.status.replace('_', ' ')}</span>
                          </div>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                            {(camp.payment_amount || 0) > 0 ? `₹${camp.payment_amount?.toLocaleString('en-IN')}` : 'Gifted'}
                          </p>
                        </div>
                      </div>
                    ))}
                  {allCampaigns.filter(c => c.influencer_handle === selectedInfluencer.handle).length === 0 && (
                    <div className="flex flex-col items-center justify-center py-6 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800/50 border-dashed">
                      <Star className="w-6 h-6 text-slate-300 dark:text-slate-600 mb-2" />
                      <p className="text-xs text-slate-500 font-medium">No campaigns found for this creator.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-900 dark:text-white">Relationship Notes & Details</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add address, rates, preferences, or past experiences..."
                  className="w-full h-32 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 resize-none transition-all placeholder:text-slate-400"
                />
              </div>
            </div>
            <div className="p-6 pt-0 flex justify-end gap-3">
              <button
                onClick={() => setSelectedInfluencer(null)}
                className="px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNotes}
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save Notes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
