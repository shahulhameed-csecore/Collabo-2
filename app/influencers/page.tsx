'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { getInfluencers, InfluencerProfile, updateInfluencerProfile } from '@/lib/api';
import { toast } from 'sonner';
import { Users, Search, Save, X, Star } from 'lucide-react';

export default function InfluencersPage() {
  const [influencers, setInfluencers] = useState<InfluencerProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedInfluencer, setSelectedInfluencer] = useState<InfluencerProfile | null>(null);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchInfluencers = async () => {
    try {
      setIsLoading(true);
      const data = await getInfluencers();
      setInfluencers(data);
    } catch (err) {
      toast.error('Failed to load influencers');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInfluencers();
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
    } catch (err) {
      toast.error('Failed to save notes');
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = influencers.filter(inf => 
    inf.handle.toLowerCase().includes(search.toLowerCase()) || 
    (inf.name && inf.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-800/60 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-emerald-500" />
              Influencer CRM
            </h1>
            <p className="text-slate-500 mt-1">Manage your creator relationships and notes.</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search influencers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 text-sm w-full sm:w-64"
            />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800/60 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-900/60 text-left">
                  <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400">Influencer</th>
                  <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400">Platform</th>
                  <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400">Campaigns</th>
                  <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400">Success Rate</th>
                  <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400">Last Collab</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                {isLoading ? (
                  [1, 2, 3].map(i => (
                    <tr key={i}>
                      <td className="px-6 py-4"><div className="h-10 w-48 bg-slate-100 dark:bg-slate-800/50 rounded-lg animate-pulse" /></td>
                      <td className="px-6 py-4"><div className="h-6 w-24 bg-slate-100 dark:bg-slate-800/50 rounded-md animate-pulse" /></td>
                      <td className="px-6 py-4"><div className="h-6 w-12 bg-slate-100 dark:bg-slate-800/50 rounded-md animate-pulse" /></td>
                      <td className="px-6 py-4"><div className="h-6 w-16 bg-slate-100 dark:bg-slate-800/50 rounded-md animate-pulse" /></td>
                      <td className="px-6 py-4"><div className="h-6 w-24 bg-slate-100 dark:bg-slate-800/50 rounded-md animate-pulse" /></td>
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-24 text-center">
                      <div className="flex flex-col items-center justify-center animate-fade-in">
                        <div className="relative mb-6">
                          <div className="absolute inset-0 bg-emerald-500/10 rounded-3xl blur-xl" />
                          <div className="relative p-6 bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/40 shadow-sm">
                            <Users className="w-10 h-10 text-emerald-500 dark:text-emerald-400" />
                          </div>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No influencers found</h3>
                        <p className="text-slate-500 text-sm max-w-sm mb-6 leading-relaxed">
                          Your creator relationships will automatically appear here once you start tracking campaigns. Build your ultimate CRM.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map(inf => (
                    <tr 
                      key={inf.handle} 
                      onClick={() => handleRowClick(inf)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center font-bold text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                            {(inf.name || inf.handle).slice(0,2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">{inf.name || 'Unknown'}</p>
                            <p className="text-xs text-slate-500">{inf.handle}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{inf.platform || '—'}</td>
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{inf.total_campaigns}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <Star className={`w-4 h-4 ${inf.success_rate >= 50 ? 'text-amber-400 fill-amber-400' : 'text-slate-300 dark:text-slate-600'}`} />
                          <span className="font-medium text-slate-700 dark:text-slate-300">{inf.success_rate}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-sm">
                        {inf.last_collaboration ? new Date(inf.last_collaboration).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedInfluencer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedInfluencer.name || selectedInfluencer.handle}</h2>
                <p className="text-sm text-slate-500">{selectedInfluencer.platform || 'Platform unknown'}</p>
              </div>
              <button
                onClick={() => setSelectedInfluencer(null)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50">
                  <p className="text-xs text-slate-500 font-medium uppercase mb-1">Campaigns</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{selectedInfluencer.total_campaigns}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50">
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
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedInfluencer.name || selectedInfluencer.handle}</h2>
                    <p className="text-emerald-600 dark:text-emerald-400 font-medium text-sm">{selectedInfluencer.handle}</p>
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
    </DashboardLayout>
  );
}
