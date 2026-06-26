-- =============================================================================
-- Collabo — Phase 2 Reminders Flags Migration
-- Safe to re-run
-- =============================================================================

ALTER TABLE public.campaigns 
    ADD COLUMN IF NOT EXISTS reminder_48h_sent BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS overdue_alert_sent BOOLEAN DEFAULT FALSE;
