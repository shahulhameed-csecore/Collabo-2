-- =============================================================================
-- Collabo — Add 'rejected' Status Migration
-- Safe to run in Supabase SQL Editor
-- =============================================================================

-- Add the new status directly to the enum type.
-- This must be run outside of any transaction block.
ALTER TYPE public.campaign_status ADD VALUE IF NOT EXISTS 'rejected';
