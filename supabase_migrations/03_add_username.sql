-- =============================================================================
-- Collabo — Add unique username feature
-- Run this in the Supabase SQL Editor (Project → SQL Editor → New query)
-- Safe to re-run: all statements use IF NOT EXISTS
-- =============================================================================

-- Add unique username column
ALTER TABLE public.user_settings
    ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- Create an index to quickly look up usernames (e.g. for sign up validation)
CREATE INDEX IF NOT EXISTS idx_user_settings_username
    ON public.user_settings (username);
