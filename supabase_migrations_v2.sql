-- =============================================================================
-- Collabo — Reminder System v2 Migration
-- Run this in the Supabase SQL Editor (Project → SQL Editor → New query)
-- Safe to re-run: all statements use IF NOT EXISTS / DO $$ guards.
--
-- WHY THIS MIGRATION EXISTS:
-- The PostgREST join syntax   campaigns(user_settings(...))   in reminders.py
-- only works when PostgreSQL has an explicit FOREIGN KEY declared from
-- campaigns.user_id → user_settings.user_id.  Without that constraint,
-- PostgREST raises: "Could not find a relationship between 'campaigns' and
-- 'user_settings'".
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Ensure user_settings table exists with all required columns
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_settings (
    id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                  UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    whatsapp_number          TEXT,
    email_reminders_enabled  BOOLEAN     NOT NULL DEFAULT TRUE,
    whatsapp_reminders_enabled BOOLEAN   NOT NULL DEFAULT TRUE,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add missing columns to user_settings (safe no-ops if already present)
ALTER TABLE public.user_settings
    ADD COLUMN IF NOT EXISTS email_reminders_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS whatsapp_reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- ---------------------------------------------------------------------------
-- 2. Ensure campaigns table has user_id column (should already exist)
-- ---------------------------------------------------------------------------
ALTER TABLE public.campaigns
    ADD COLUMN IF NOT EXISTS user_id               UUID,
    ADD COLUMN IF NOT EXISTS reminder_48h_sent     BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS overdue_alert_sent    BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- 3. THE CRITICAL FIX: Foreign Key from campaigns.user_id → user_settings.user_id
--    PostgREST reads this FK to resolve the relationship for JOIN queries.
--    We add it only if it doesn't already exist (idempotent check via pg_constraint).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    -- FK: campaigns.user_id → auth.users(id)   (usually already exists)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'campaigns_user_id_fkey'
          AND conrelid = 'public.campaigns'::regclass
    ) THEN
        ALTER TABLE public.campaigns
            ADD CONSTRAINT campaigns_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added campaigns_user_id_fkey';
    ELSE
        RAISE NOTICE 'campaigns_user_id_fkey already exists — skipped';
    END IF;

    -- FK: user_settings.user_id → auth.users(id)  (usually already exists)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'user_settings_user_id_fkey'
          AND conrelid = 'public.user_settings'::regclass
    ) THEN
        ALTER TABLE public.user_settings
            ADD CONSTRAINT user_settings_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added user_settings_user_id_fkey';
    ELSE
        RAISE NOTICE 'user_settings_user_id_fkey already exists — skipped';
    END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Performance indexes
-- ---------------------------------------------------------------------------

-- Campaigns: partial index for the hourly job (only unprocessed active rows)
CREATE INDEX IF NOT EXISTS idx_campaigns_reminder_active
    ON public.campaigns (status, reminder_48h_sent, overdue_alert_sent)
    WHERE status = 'active';

-- Campaigns: index on user_id for the JOIN to user_settings
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id
    ON public.campaigns (user_id);

-- user_settings: index on user_id (already UNIQUE so this is implicit, but explicit is clearer)
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id
    ON public.user_settings (user_id);

-- ---------------------------------------------------------------------------
-- 5. RLS policies for user_settings
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own row
DROP POLICY IF EXISTS "user_settings_self_select" ON public.user_settings;
CREATE POLICY "user_settings_self_select"
    ON public.user_settings FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_settings_self_insert" ON public.user_settings;
CREATE POLICY "user_settings_self_insert"
    ON public.user_settings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_settings_self_update" ON public.user_settings;
CREATE POLICY "user_settings_self_update"
    ON public.user_settings FOR UPDATE
    USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 6. Scheduler logs table (optional observability)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scheduler_logs (
    id         BIGSERIAL PRIMARY KEY,
    job_name   TEXT        NOT NULL,
    status     TEXT        NOT NULL,   -- 'completed' | 'error'
    run_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    details    JSONB
);

ALTER TABLE public.scheduler_logs ENABLE ROW LEVEL SECURITY;
-- No RLS policies = service-role-only access (background job uses service role)

-- ---------------------------------------------------------------------------
-- 7. Verify the relationship PostgREST will use (run this SELECT to confirm)
-- ---------------------------------------------------------------------------
-- SELECT
--     tc.table_name,
--     kcu.column_name,
--     ccu.table_name  AS foreign_table_name,
--     ccu.column_name AS foreign_column_name
-- FROM information_schema.table_constraints   AS tc
-- JOIN information_schema.key_column_usage    AS kcu USING (constraint_name, table_schema)
-- JOIN information_schema.constraint_column_usage AS ccu USING (constraint_name, table_schema)
-- WHERE tc.constraint_type = 'FOREIGN KEY'
--   AND tc.table_schema = 'public'
--   AND tc.table_name IN ('campaigns', 'user_settings');

-- ---------------------------------------------------------------------------
-- 8. Testing helpers
-- ---------------------------------------------------------------------------
-- Reset reminder flags for a specific campaign (use during manual testing):
--   UPDATE public.campaigns
--   SET reminder_48h_sent = FALSE, overdue_alert_sent = FALSE
--   WHERE id = '<your-campaign-uuid>';
--
-- Insert a test user_settings row (replace UUIDs):
--   INSERT INTO public.user_settings (user_id, whatsapp_number, email_reminders_enabled, whatsapp_reminders_enabled)
--   VALUES ('<your-user-uuid>', '919876543210', true, true)
--   ON CONFLICT (user_id) DO UPDATE SET whatsapp_number = EXCLUDED.whatsapp_number;
