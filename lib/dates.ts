/**
 * Collabo Centralized Date & Timezone Utilities
 * Ensures local timezone accuracy (IST and client local time) without UTC midnight drift.
 */

/**
 * Returns today's date formatted as YYYY-MM-DD in the client's local timezone.
 * Uses 'en-CA' locale (standard ISO 8601 calendar date YYYY-MM-DD).
 */
export function getTodayLocalStr(): string {
  return new Date().toLocaleDateString('en-CA');
}

/**
 * Checks whether a given deadline (YYYY-MM-DD) is strictly in the past (overdue).
 * CRITICAL (BUG-07): Compares lexicographically with today's local date string
 * so campaigns due today are NOT marked overdue until tomorrow local time.
 */
export function isDateOverdue(deadlineStr: string | null | undefined): boolean {
  if (!deadlineStr) return false;
  const todayStr = getTodayLocalStr();
  return deadlineStr.slice(0, 10) < todayStr;
}

/**
 * Formats a date string into an Indian-formatted display string (e.g. "20 Oct 2026").
 * Safely parses YYYY-MM-DD strings using local date constructors to prevent UTC off-by-one shifts.
 */
export function formatDisplayDate(
  dateStr: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }
): string {
  if (!dateStr) return '—';
  const parts = dateStr.slice(0, 10).split('-').map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    const localDate = new Date(parts[0], parts[1] - 1, parts[2]);
    return localDate.toLocaleDateString('en-IN', options);
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', options);
}

/**
 * Computes calendar days remaining until deadline relative to today local time.
 */
export function formatRelativeDays(deadlineStr: string | null | undefined): {
  days: number;
  label: string;
  isOverdue: boolean;
  isToday: boolean;
} {
  if (!deadlineStr) {
    return { days: 0, label: '—', isOverdue: false, isToday: false };
  }
  const parts = deadlineStr.slice(0, 10).split('-').map(Number);
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return { days: 0, label: '—', isOverdue: false, isToday: false };
  }
  const deadlineDate = new Date(parts[0], parts[1] - 1, parts[2]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.round((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const isOverdue = diffDays < 0;
  const isToday = diffDays === 0;

  let label = `${diffDays}d left`;
  if (isOverdue) label = `${Math.abs(diffDays)}d overdue`;
  else if (isToday) label = 'Today';

  return { days: diffDays, label, isOverdue, isToday };
}
