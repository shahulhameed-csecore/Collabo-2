import { useMemo } from 'react';
import { Campaign } from '@/lib/types';

export function useCalendarStats(campaigns: Campaign[], currentDate: Date) {
  // Parse YYYY-MM-DD string to local midnight to avoid timezone shifts
  const parseLocalDate = (dateStr: string) => {
    if (!dateStr || !dateStr.includes('-')) return new Date();
    const [y, m, d] = dateStr.split('-');
    return new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
  };

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(today.getDate() + 7);

    let thisWeek = 0;
    let overdue = 0;
    let thisMonth = 0;

    const y = currentDate.getFullYear();
    const m = currentDate.getMonth() + 1; // 1-indexed for string building
    const monthPrefix = `${y}-${String(m).padStart(2, '0')}`;

    campaigns.forEach((c) => {
      if (!c.deadline) return;

      const deadlineDate = parseLocalDate(c.deadline);
      deadlineDate.setHours(0, 0, 0, 0);

      const isClosed = ['approved', 'paid', 'cancelled'].includes(c.status);

      // Overdue (in the past, and not completed/cancelled)
      if (deadlineDate < today && !isClosed) {
        overdue++;
      }

      // This week (today <= deadline <= today + 7)
      if (deadlineDate >= today && deadlineDate <= sevenDaysFromNow && !isClosed) {
        thisWeek++;
      }

      // This viewed month
      if (c.deadline.startsWith(monthPrefix)) {
        thisMonth++;
      }
    });

    return { thisWeek, overdue, thisMonth };
  }, [campaigns, currentDate]);

  return { stats, parseLocalDate };
}
