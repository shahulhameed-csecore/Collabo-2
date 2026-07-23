'use client';

import { useState, useEffect, useMemo } from 'react';
import { Campaign, PaginatedCampaigns } from '@/lib/types';
import api from '@/lib/api';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlertCircle, Sparkles, Plus, Flag, Play, Video, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';
import EditCampaignModal from '@/components/EditCampaignModal';
import DayViewModal from '@/components/DayViewModal';
import { useCalendarStats } from '@/hooks/useCalendarStats';
import { getApiErrorMessage } from '@/lib/api';

export default function CalendarPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  
  // Day View Modal State
  const [selectedDayStr, setSelectedDayStr] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      let allCampaigns: Campaign[] = [];
      let currentOffset = 0;
      const limit = 200;
      let hasMore = true;

      // Scalability Fix: Paginate through all campaigns so nothing drops off the calendar
      while (hasMore) {
        const campRes = await api.get<PaginatedCampaigns>(`/campaigns/?limit=${limit}&offset=${currentOffset}`);
        const data = campRes.data.data;
        allCampaigns = [...allCampaigns, ...data];
        
        if (data.length < limit) {
          hasMore = false;
        } else {
          currentOffset += limit;
        }
      }
      setCampaigns(allCampaigns);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to load campaigns'));
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Format YYYY-MM-DD
  const formatDateStr = (y: number, m: number, d: number) => {
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };

  // Efficiency Fix: Pre-compute events by date for O(1) lookup during grid render
  const eventsByDate = useMemo(() => {
    const map: Record<string, Campaign[]> = {};
    campaigns.forEach(c => {
      if (c.deadline) {
        if (!map[c.deadline]) map[c.deadline] = [];
        map[c.deadline].push(c);
      }
    });
    return map;
  }, [campaigns]);

  const getEventsForDay = (day: number) => {
    const targetDateStr = formatDateStr(currentDate.getFullYear(), currentDate.getMonth() + 1, day);
    return eventsByDate[targetDateStr] || [];
  };
  
  const { stats, parseLocalDate } = useCalendarStats(campaigns, currentDate);

  const getPlatformIcon = (platform: string | null | undefined) => {
    const p = platform?.toLowerCase() || '';
    if (p.includes('instagram') || p.includes('reel') || p.includes('story')) return <Play className="w-3 h-3 flex-shrink-0" />;
    if (p.includes('youtube') || p.includes('shorts')) return <Video className="w-3 h-3 flex-shrink-0" />;
    if (p) return <ImageIcon className="w-3 h-3 flex-shrink-0" />;
    return null;
  };

  const STATUS_COLORS: Record<string, string> = {
    draft: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
    active: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
    content_received: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
    approved: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
    paid: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
    cancelled: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800',
  };

  const isCalendarEmpty = !isLoading && campaigns.length === 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-800/60 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-emerald-500" />
            Content Calendar
          </h1>
          <p className="text-slate-500 mt-1">Plan and track your influencer deadlines.</p>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4 bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
          <button
            onClick={handlePrevMonth}
            className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors shadow-sm"
          >
            <ChevronLeft className="w-5 h-5 text-slate-700 dark:text-slate-300" />
          </button>
          <span className="text-base sm:text-lg font-bold w-32 sm:w-40 text-center text-slate-900 dark:text-white">
            {monthName}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors shadow-sm"
          >
            <ChevronRight className="w-5 h-5 text-slate-700 dark:text-slate-300" />
          </button>
        </div>
      </div>

      {/* Stats Dashboard */}
      {!isCalendarEmpty && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-100 dark:border-emerald-900/50 p-5 rounded-2xl shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
                <Flag className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              {/* Changed text from 'Due This Week' to accurately reflect logic */}
              <h3 className="font-semibold text-emerald-900 dark:text-emerald-400">Due Next 7 Days</h3>
            </div>
            <p className="text-3xl font-black text-emerald-700 dark:text-emerald-300 ml-12">{stats.thisWeek}</p>
          </div>

          <div className="bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-950/30 dark:to-red-950/30 border border-rose-100 dark:border-rose-900/50 p-5 rounded-2xl shadow-sm relative overflow-hidden">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-rose-100 dark:bg-rose-900/50 rounded-lg">
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              </div>
              <h3 className="font-semibold text-rose-900 dark:text-rose-400">Overdue</h3>
            </div>
            <p className="text-3xl font-black text-rose-700 dark:text-rose-300 ml-12">{stats.overdue}</p>
            {stats.overdue > 0 && (
              <div className="absolute top-0 right-0 w-2 h-full bg-rose-500 animate-pulse" />
            )}
          </div>

          <div className="bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-800/40 dark:to-slate-800/20 border border-slate-200 dark:border-slate-700/50 p-5 rounded-2xl shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-slate-200 dark:bg-slate-700/50 rounded-lg">
                <CalendarIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-300">Total This Month</h3>
            </div>
            <p className="text-3xl font-black text-slate-700 dark:text-slate-200 ml-12">{stats.thisMonth}</p>
          </div>
        </div>
      )}

      {/* Global Empty State */}
      {isCalendarEmpty ? (
        <div className="bg-white dark:bg-slate-900/60 rounded-3xl border border-slate-200 dark:border-slate-800/60 shadow-xl overflow-hidden text-center py-24 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent dark:from-emerald-500/10" />
          <div className="relative z-10 max-w-md mx-auto space-y-6 px-4">
            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mx-auto transform -rotate-6 shadow-inner">
              <Sparkles className="w-10 h-10 text-emerald-500" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white">Your Calendar is Clear!</h2>
            <p className="text-slate-500 dark:text-slate-400 text-lg">
              Start tracking your influencer deadlines to see them beautifully organized here.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold transition-all hover:scale-105 hover:shadow-lg hover:shadow-emerald-500/25"
            >
              <Plus className="w-5 h-5" />
              Create First Campaign
            </Link>
          </div>
        </div>
      ) : (
        /* The Calendar Grid */
        <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800/60 shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800/60">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="py-2 sm:py-3 text-center text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50 dark:bg-slate-800/50">
                <span className="hidden sm:inline">{day}</span>
                <span className="sm:hidden">{day.charAt(0)}</span>
              </div>
            ))}
          </div>
          
          <div className="w-full">
            <div className="grid grid-cols-7 auto-rows-fr">
              {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[70px] sm:min-h-[140px] p-1 sm:p-2 border-b border-r border-slate-100 dark:border-slate-800/40 bg-slate-50/50 dark:bg-slate-900/20" />
              ))}
              
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();
                const events = getEventsForDay(day);
                const hasEvents = events.length > 0;
                
                return (
                  <div 
                    key={day} 
                    onClick={() => hasEvents && setSelectedDayStr(formatDateStr(currentDate.getFullYear(), currentDate.getMonth() + 1, day))}
                    className={`
                      min-h-[70px] sm:min-h-[140px] p-1 sm:p-2 border-b border-r border-slate-100 dark:border-slate-800/40 transition-all
                      ${isToday ? 'bg-emerald-50/30 dark:bg-emerald-500/5 relative overflow-hidden' : 'hover:bg-slate-50 dark:hover:bg-slate-800/20'}
                      ${hasEvents ? 'cursor-pointer hover:shadow-inner' : ''}
                    `}
                  >
                    {isToday && <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />}

                    <div className="flex items-start justify-between mb-1 sm:mb-2">
                      <span className={`text-[10px] sm:text-sm font-bold w-5 h-5 sm:w-7 sm:h-7 flex items-center justify-center flex-shrink-0 rounded-full ${isToday ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30' : 'text-slate-700 dark:text-slate-300'}`}>
                        {day}
                      </span>
                      {events.length > 0 && (
                        <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/50 px-1 py-0.5 rounded-full flex-shrink-0">
                          {events.length}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap sm:flex-col gap-1 sm:gap-1.5 items-start justify-start">
                      {isLoading ? (
                        Array.from({ length: 2 }).map((_, i) => (
                          <div key={`skel-${i}`} className="h-1.5 w-1.5 sm:h-6 bg-slate-200 dark:bg-slate-700 rounded-full sm:rounded animate-pulse sm:w-full" />
                        ))
                      ) : (
                        <>
                          {events.slice(0, 3).map(event => (
                            <div key={event.id}>
                              <div 
                                className={`sm:hidden w-1.5 h-1.5 rounded-full bg-current ${STATUS_COLORS[event.status]?.split(' ').filter(c => c.startsWith('text-')).join(' ')}`}
                              />
                              <div
                                className={`hidden sm:flex items-center gap-1.5 text-[10px] font-bold px-2 py-1.5 rounded-lg truncate border shadow-sm ${STATUS_COLORS[event.status] || STATUS_COLORS.draft}`}
                                title={`${event.influencer_name || event.influencer_handle} - ${event.status}`}
                              >
                                {getPlatformIcon(event.platform)}
                                <span className="truncate">{event.influencer_name || event.influencer_handle}</span>
                              </div>
                            </div>
                          ))}
                          {events.length > 3 && (
                            <div className="w-1.5 h-1.5 sm:w-auto sm:h-auto rounded-full bg-slate-300 dark:bg-slate-600 sm:bg-slate-50 sm:dark:bg-slate-800/50 sm:text-[10px] font-semibold text-slate-500 dark:text-slate-400 text-center sm:py-0.5 sm:rounded border border-transparent sm:border-slate-100 sm:dark:border-slate-800/60 flex items-center justify-center">
                              <span className="hidden sm:inline">+{events.length - 3} more</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {selectedCampaign && (
        <EditCampaignModal
          campaign={selectedCampaign}
          isOpen={true}
          onClose={() => setSelectedCampaign(null)}
          onSuccess={fetchData}
        />
      )}

      {selectedDayStr && (
        <DayViewModal
          isOpen={true}
          onClose={() => setSelectedDayStr(null)}
          dateStr={selectedDayStr}
          campaigns={campaigns.filter(c => c.deadline === selectedDayStr)}
          onSelectCampaign={(c) => setSelectedCampaign(c)}
        />
      )}
    </div>
  );
}
