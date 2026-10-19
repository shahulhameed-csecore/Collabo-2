'use client';

import { useState, useEffect, useMemo } from 'react';
import { Campaign, PaginatedCampaigns } from '@/lib/types';
import api, { getApiErrorMessage } from '@/lib/api';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus } from 'lucide-react';
import Link from 'next/link';
import { PlatformIcon } from '@/components/PlatformIcon';
import EditCampaignModal from '@/components/EditCampaignModal';
import DayViewModal from '@/components/DayViewModal';
import { useCalendarStats } from '@/hooks/useCalendarStats';

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

  const handleJumpToToday = () => {
    setCurrentDate(new Date());
  };

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const prevMonthDaysCount = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0).getDate();
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
  
  const { stats } = useCalendarStats(campaigns, currentDate);

  // Month-scoped Completed count
  const completedThisMonth = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth() + 1;
    const prefix = `${y}-${String(m).padStart(2, '0')}`;
    return campaigns.filter(c => 
      ['approved', 'paid'].includes(c.status) && c.deadline?.startsWith(prefix)
    ).length;
  }, [campaigns, currentDate]);

  // Check if an event is overdue
  const isEventOverdue = (c: Campaign) => {
    if (!c.deadline) return false;
    const isClosed = ['approved', 'paid', 'cancelled'].includes(c.status);
    if (isClosed) return false;
    const [y, m, d] = c.deadline.split('-');
    const deadlineDate = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return deadlineDate < today;
  };

  // Compact currency formatter (e.g. ₹35k, ₹1.5L)
  const formatCompactCurrency = (amount?: number | null) => {
    if (amount == null || amount <= 0) return '';
    if (amount >= 100000) {
      const val = amount / 100000;
      return `₹${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}L`;
    }
    if (amount >= 1000) {
      const val = amount / 1000;
      return `₹${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}k`;
    }
    return `₹${amount}`;
  };

  // Trailing previous month days
  const prevMonthDays = useMemo(() => {
    return Array.from({ length: firstDayOfMonth }, (_, i) => {
      const day = prevMonthDaysCount - firstDayOfMonth + 1 + i;
      const prevDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, day);
      const dateStr = formatDateStr(prevDate.getFullYear(), prevDate.getMonth() + 1, day);
      const events = eventsByDate[dateStr] || [];
      return { day, dateStr, events };
    });
  }, [firstDayOfMonth, prevMonthDaysCount, currentDate, eventsByDate]);

  // Leading next month days to complete the 7-column grid
  const nextMonthDays = useMemo(() => {
    const totalFilled = firstDayOfMonth + daysInMonth;
    const remainingCells = (7 - (totalFilled % 7)) % 7;
    return Array.from({ length: remainingCells }, (_, i) => {
      const day = i + 1;
      const nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, day);
      const dateStr = formatDateStr(nextDate.getFullYear(), nextDate.getMonth() + 1, day);
      const events = eventsByDate[dateStr] || [];
      return { day, dateStr, events };
    });
  }, [firstDayOfMonth, daysInMonth, currentDate, eventsByDate]);

  const isCalendarEmpty = !isLoading && campaigns.length === 0;

  const today = new Date();

  return (
    <div className="w-full max-w-7xl mx-auto space-y-3.5 animate-fade-in pb-4">
      {/* ── Top Calendar Command Bar ── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left: Title & Subtitle */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CalendarIcon className="w-4 h-4" />
            </div>
            Content Calendar
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Schedule deliverables and track influencer deadline commitments.
          </p>
        </div>

        {/* Center / Right: Inline Architectural KPI Pills */}
        {!isCalendarEmpty && (
          <div className="bg-[#0A0E17] border border-white/[0.07] rounded-xl px-4 py-2 flex flex-wrap items-center gap-4 sm:gap-6 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06] shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Due Next 7d</span>
              <span className="font-mono text-sm font-semibold text-emerald-400 tabular-nums">
                {stats.thisWeek}
              </span>
            </div>

            <div className="flex items-center gap-2 pt-2 sm:pt-0 sm:pl-6">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Overdue</span>
              <span className={`font-mono text-sm font-semibold tabular-nums ${stats.overdue > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                {stats.overdue}
              </span>
            </div>

            <div className="flex items-center gap-2 pt-2 sm:pt-0 sm:pl-6">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">This Month</span>
              <span className="font-mono text-sm font-semibold text-white tabular-nums">
                {stats.thisMonth}
              </span>
            </div>

            <div className="flex items-center gap-2 pt-2 sm:pt-0 sm:pl-6">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Completed</span>
              <span className="font-mono text-sm font-semibold text-slate-300 tabular-nums">
                {completedThisMonth}
              </span>
            </div>
          </div>
        )}

        {/* Right: Month Navigation & Today Jump Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleJumpToToday}
            className="px-3 py-1.5 text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-lg text-slate-200 hover:text-white transition shadow-sm font-mono"
          >
            Today
          </button>

          <div className="flex items-center bg-[#0A0E17] border border-white/[0.07] p-1 rounded-xl shadow-sm">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/[0.04] rounded-lg transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="font-sans text-sm font-medium text-white min-w-[130px] text-center select-none">
              {monthName}
            </span>

            <button
              onClick={handleNextMonth}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/[0.04] rounded-lg transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Global Empty State ── */}
      {isCalendarEmpty ? (
        <div className="bg-[#0A0E17] rounded-2xl border border-white/[0.07] shadow-xl overflow-hidden text-center py-20 px-4 relative">
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto text-emerald-400">
              <CalendarIcon className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-semibold text-white">Your Calendar is Clear</h2>
            <p className="text-slate-400 text-xs">
              Plan influencer deadlines and track delivery commitments in real-time.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-[#05070B] px-4 py-2 rounded-lg text-xs font-semibold transition-all shadow-[0_1px_8px_rgba(16,185,129,0.25)]"
            >
              <Plus className="w-4 h-4" />
              Create Campaign
            </Link>
          </div>
        </div>
      ) : (
        /* ── Architectural Calendar Grid ── */
        <div className="bg-[#0A0E17] border border-white/[0.07] rounded-xl overflow-hidden shadow-2xl">
          {/* Day-of-Week Header */}
          <div className="grid grid-cols-7 border-b border-white/[0.07] bg-[#070A10]">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div 
                key={day} 
                className="py-2.5 text-center font-mono text-[11px] font-medium tracking-widest uppercase text-slate-400"
              >
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar Day Grid */}
          <div className="grid grid-cols-7 divide-x divide-y divide-white/[0.06]">
            {/* Trailing Days (Previous Month) */}
            {prevMonthDays.map(item => (
              <div 
                key={`prev-${item.dateStr}`}
                onClick={() => setSelectedDayStr(item.dateStr)}
                className="min-h-[96px] lg:min-h-[104px] p-1.5 lg:p-2 bg-[#05070B]/60 transition-colors relative group cursor-pointer hover:bg-white/[0.02]"
              >
                <div className="flex items-start justify-between mb-1.5">
                  <span className="font-mono tabular-nums text-xs font-medium text-slate-700">
                    {item.day}
                  </span>
                  {item.events.length > 0 && (
                    <span className="font-mono text-[9px] text-slate-600 bg-white/[0.02] border border-white/[0.04] px-1 py-0.5 rounded">
                      {item.events.length}
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  {item.events.slice(0, 2).map(event => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCampaign(event);
                      }}
                      className="w-full text-left px-1.5 py-0.5 rounded text-[11px] flex items-center justify-between gap-1 border border-white/[0.04] bg-white/[0.02] text-slate-600 hover:text-slate-400 truncate cursor-pointer transition-colors"
                    >
                      <span className="truncate">{event.influencer_name || event.influencer_handle}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            
            {/* Current Month Days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = formatDateStr(currentDate.getFullYear(), currentDate.getMonth() + 1, day);
              const isToday = today.getFullYear() === currentDate.getFullYear() &&
                              today.getMonth() === currentDate.getMonth() &&
                              today.getDate() === day;
              const events = getEventsForDay(day);

              return (
                <div 
                  key={`cur-${day}`} 
                  onClick={() => setSelectedDayStr(dateStr)}
                  className={`
                    min-h-[96px] lg:min-h-[104px] p-1.5 lg:p-2 transition-colors relative group cursor-pointer hover:bg-white/[0.02]
                    ${isToday ? 'bg-emerald-500/[0.03] border-t-2 border-t-emerald-500' : ''}
                  `}
                >
                  <div className="flex items-start justify-between mb-1.5">
                    {isToday ? (
                      <span className="bg-[#10B981] text-[#05070B] font-mono text-xs font-bold px-1.5 py-0.5 rounded-md shadow-sm">
                        {day}
                      </span>
                    ) : (
                      <span className="font-mono tabular-nums text-xs font-medium text-slate-400 group-hover:text-white transition-colors">
                        {day}
                      </span>
                    )}

                    {events.length > 0 && (
                      <span className="font-mono text-[10px] text-slate-400 bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 rounded">
                        {events.length}
                      </span>
                    )}
                  </div>

                  {/* Campaign Chips */}
                  <div className="space-y-1">
                    {isLoading ? (
                      <div className="space-y-1 animate-pulse">
                        <div className="h-5 bg-white/[0.03] rounded" />
                      </div>
                    ) : (
                      <>
                        {events.slice(0, 3).map(event => {
                          const overdue = isEventOverdue(event);
                          let chipStyle = 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08]';
                          if (overdue) {
                            chipStyle = 'bg-rose-500/[0.10] border-rose-500/30 text-rose-300 hover:bg-rose-500/[0.16]';
                          } else if (event.status === 'active') {
                            chipStyle = 'bg-emerald-500/[0.08] border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/[0.14]';
                          } else if (event.status === 'content_received') {
                            chipStyle = 'bg-amber-500/[0.08] border-amber-500/25 text-amber-300 hover:bg-amber-500/[0.14]';
                          }

                          return (
                            <button
                              key={event.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCampaign(event);
                              }}
                              className={`w-full text-left px-2 py-1 rounded-md text-xs flex items-center justify-between gap-1.5 border transition-all truncate ${chipStyle}`}
                              title={`${event.influencer_name || event.influencer_handle} • ${event.deliverables || event.status} • ₹${(event.payment_amount || 0).toLocaleString('en-IN')}`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0 truncate">
                                <PlatformIcon platform={event.platform} className="w-3 h-3 flex-shrink-0 opacity-80" fallbackToImage={false} />
                                <span className="font-medium truncate text-[11px]">
                                  {event.influencer_name || event.influencer_handle}
                                </span>
                              </div>
                              {event.payment_amount != null && event.payment_amount > 0 && (
                                <span className="font-mono text-[10px] opacity-75 shrink-0">
                                  {formatCompactCurrency(event.payment_amount)}
                                </span>
                              )}
                            </button>
                          );
                        })}

                        {events.length > 3 && (
                          <div className="font-mono text-[10px] text-slate-400 bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 rounded text-center hover:text-white transition-colors">
                            +{events.length - 3} more
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Leading Days (Next Month) */}
            {nextMonthDays.map(item => (
              <div 
                key={`next-${item.dateStr}`}
                onClick={() => setSelectedDayStr(item.dateStr)}
                className="min-h-[96px] lg:min-h-[104px] p-1.5 lg:p-2 bg-[#05070B]/60 transition-colors relative group cursor-pointer hover:bg-white/[0.02]"
              >
                <div className="flex items-start justify-between mb-1.5">
                  <span className="font-mono tabular-nums text-xs font-medium text-slate-700">
                    {item.day}
                  </span>
                  {item.events.length > 0 && (
                    <span className="font-mono text-[9px] text-slate-600 bg-white/[0.02] border border-white/[0.04] px-1 py-0.5 rounded">
                      {item.events.length}
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  {item.events.slice(0, 2).map(event => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCampaign(event);
                      }}
                      className="w-full text-left px-1.5 py-0.5 rounded text-[11px] flex items-center justify-between gap-1 border border-white/[0.04] bg-white/[0.02] text-slate-600 hover:text-slate-400 truncate cursor-pointer transition-colors"
                    >
                      <span className="truncate">{event.influencer_name || event.influencer_handle}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Edit Campaign Modal ── */}
      {selectedCampaign && (
        <EditCampaignModal
          campaign={selectedCampaign}
          isOpen={true}
          onClose={() => setSelectedCampaign(null)}
          onSuccess={fetchData}
        />
      )}

      {/* ── Day View Modal ── */}
      {selectedDayStr && (
        <DayViewModal
          isOpen={true}
          onClose={() => setSelectedDayStr(null)}
          dateStr={selectedDayStr}
          campaigns={eventsByDate[selectedDayStr] || []}
          onSelectCampaign={(c) => setSelectedCampaign(c)}
        />
      )}
    </div>
  );
}
