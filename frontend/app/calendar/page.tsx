'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Campaign } from '@/lib/types';
import api from '@/lib/api';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, CheckCircle2 } from 'lucide-react';
import EditCampaignModal from '@/components/EditCampaignModal';

export default function CalendarPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  const fetchCampaigns = async () => {
    try {
      setIsLoading(true);
      const res = await api.get<Campaign[]>('/api/campaigns/');
      setCampaigns(res.data);
    } catch (err) {
      toast.error('Failed to fetch campaigns for calendar');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
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

  const getEventsForDay = (day: number) => {
    const targetDateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toISOString().split('T')[0];
    return campaigns.filter(c => c.deadline === targetDateStr);
  };

  const STATUS_COLORS: Record<string, string> = {
    draft: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
    active: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
    content_received: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
    approved: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
    paid: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
    cancelled: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800',
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-800/60 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarIcon className="w-6 h-6 text-emerald-500" />
              Content Calendar
            </h1>
            <p className="text-slate-500 mt-1">Track upcoming campaign deadlines.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={handlePrevMonth}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
            >
              <ChevronLeft className="w-5 h-5 text-slate-700 dark:text-slate-300" />
            </button>
            <span className="text-lg font-semibold w-40 text-center text-slate-900 dark:text-white">
              {monthName}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
            >
              <ChevronRight className="w-5 h-5 text-slate-700 dark:text-slate-300" />
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800/60 shadow-sm overflow-hidden">
          {/* Calendar Header */}
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800/60">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50 dark:bg-slate-800/50">
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 auto-rows-fr">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[120px] p-2 border-b border-r border-slate-100 dark:border-slate-800/40 bg-slate-50/50 dark:bg-slate-900/20" />
            ))}
            
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();
              const events = getEventsForDay(day);
              
              return (
                <div key={day} className={`min-h-[120px] p-2 border-b border-r border-slate-100 dark:border-slate-800/40 transition-colors ${isToday ? 'bg-emerald-50/50 dark:bg-emerald-500/5' : 'hover:bg-slate-50 dark:hover:bg-slate-800/20'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20' : 'text-slate-700 dark:text-slate-300'}`}>
                      {day}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {events.map(event => (
                      <div
                        key={event.id}
                        onClick={() => setSelectedCampaign(event)}
                        className={`text-[10px] px-2 py-1 rounded truncate border cursor-pointer hover:opacity-80 transition-opacity ${STATUS_COLORS[event.status] || STATUS_COLORS.draft}`}
                        title={`${event.influencer_name || event.influencer_handle} - ${event.status}`}
                      >
                        {event.influencer_name || event.influencer_handle}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedCampaign && (
        <EditCampaignModal
          campaign={selectedCampaign}
          isOpen={true}
          onClose={() => setSelectedCampaign(null)}
          onUpdated={fetchCampaigns}
        />
      )}
    </DashboardLayout>
  );
}
