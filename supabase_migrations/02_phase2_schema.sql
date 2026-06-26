-- =============================================================================
-- Collabo — Phase 2 Features Migration
-- Run this in the Supabase SQL Editor (Project → SQL Editor → New query)
-- Safe to re-run: all statements use IF NOT EXISTS / DO $$ guards.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Create influencer_profiles table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.influencer_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    handle TEXT NOT NULL,
    platform TEXT,
    name TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, handle)
);

-- Enable RLS
ALTER TABLE public.influencer_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_policies WHERE tablename = 'influencer_profiles' AND policyname = 'user_self_select_influencer'
    ) THEN
        CREATE POLICY "user_self_select_influencer" ON public.influencer_profiles FOR SELECT USING (auth.uid() = user_id);
        CREATE POLICY "user_self_insert_influencer" ON public.influencer_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "user_self_update_influencer" ON public.influencer_profiles FOR UPDATE USING (auth.uid() = user_id);
        CREATE POLICY "user_self_delete_influencer" ON public.influencer_profiles FOR DELETE USING (auth.uid() = user_id);
    END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 2. Update subscriptions table for AI extraction limits
-- ---------------------------------------------------------------------------
ALTER TABLE public.subscriptions 
    ADD COLUMN IF NOT EXISTS ai_extractions_count INTEGER DEFAULT 0;

-- ---------------------------------------------------------------------------
-- 3. Function to atomically increment AI extractions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION increment_ai_extractions(p_user_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.subscriptions 
    SET ai_extractions_count = COALESCE(ai_extractions_count, 0) + 1 
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
