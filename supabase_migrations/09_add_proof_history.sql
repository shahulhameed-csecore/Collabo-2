-- =============================================================================
-- Collabo — Add 'proof_history' Column Migration
-- Safe to run in Supabase SQL Editor
-- =============================================================================

ALTER TABLE public.campaigns 
ADD COLUMN IF NOT EXISTS proof_history JSONB DEFAULT '[]'::jsonb;
