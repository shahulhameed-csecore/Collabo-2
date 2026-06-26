-- =============================================================================
-- Collabo — Master Security & RLS Migration
-- Run this in the Supabase SQL Editor (Project → SQL Editor → New query)
-- =============================================================================

-- 1. Ensure all core tables have Row Level Security (RLS) enabled
DO $$ 
BEGIN
    -- Enable RLS on campaigns
    ALTER TABLE IF EXISTS public.campaigns ENABLE ROW LEVEL SECURITY;
    
    -- Enable RLS on user_settings
    ALTER TABLE IF EXISTS public.user_settings ENABLE ROW LEVEL SECURITY;
    
    -- Enable RLS on subscriptions (if exists)
    ALTER TABLE IF EXISTS public.subscriptions ENABLE ROW LEVEL SECURITY;
    
    -- Enable RLS on influencers (if exists)
    ALTER TABLE IF EXISTS public.influencers ENABLE ROW LEVEL SECURITY;
END $$;

-- 2. Drop overly permissive or generic policies if they exist to start fresh
DROP POLICY IF EXISTS "Enable read access for all users" ON public.campaigns;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.campaigns;
DROP POLICY IF EXISTS "user_settings_self_select" ON public.user_settings;
DROP POLICY IF EXISTS "user_settings_self_insert" ON public.user_settings;
DROP POLICY IF EXISTS "user_settings_self_update" ON public.user_settings;
DROP POLICY IF EXISTS "user_settings_self_delete" ON public.user_settings;

-- 3. Strict RLS for Campaigns: A user can ONLY view/edit their own campaigns.
DROP POLICY IF EXISTS "campaigns_select" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns_insert" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns_update" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns_delete" ON public.campaigns;

CREATE POLICY "campaigns_select" ON public.campaigns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "campaigns_insert" ON public.campaigns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "campaigns_update" ON public.campaigns FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "campaigns_delete" ON public.campaigns FOR DELETE USING (auth.uid() = user_id);

-- 4. Strict RLS for User Settings: A user can ONLY view/edit their own settings.
DROP POLICY IF EXISTS "user_settings_select" ON public.user_settings;
DROP POLICY IF EXISTS "user_settings_insert" ON public.user_settings;
DROP POLICY IF EXISTS "user_settings_update" ON public.user_settings;
DROP POLICY IF EXISTS "user_settings_delete" ON public.user_settings;

CREATE POLICY "user_settings_select" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_settings_insert" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_settings_update" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_settings_delete" ON public.user_settings FOR DELETE USING (auth.uid() = user_id);

-- 5. Strict RLS for Subscriptions: A user can ONLY view their own subscription.
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'subscriptions') THEN
        DROP POLICY IF EXISTS "subscriptions_select" ON public.subscriptions;
        CREATE POLICY "subscriptions_select" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
        
        -- Generally, users shouldn't insert/update their own subscriptions directly from the client.
        -- That is done via Stripe webhooks bypassing RLS (service role).
    END IF;
END $$;

-- 6. Strict RLS for Influencers: A user can ONLY view/edit influencers they added.
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'influencers') THEN
        DROP POLICY IF EXISTS "influencers_select" ON public.influencers;
        DROP POLICY IF EXISTS "influencers_insert" ON public.influencers;
        DROP POLICY IF EXISTS "influencers_update" ON public.influencers;
        DROP POLICY IF EXISTS "influencers_delete" ON public.influencers;
        
        CREATE POLICY "influencers_select" ON public.influencers FOR SELECT USING (auth.uid() = user_id);
        CREATE POLICY "influencers_insert" ON public.influencers FOR INSERT WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "influencers_update" ON public.influencers FOR UPDATE USING (auth.uid() = user_id);
        CREATE POLICY "influencers_delete" ON public.influencers FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;
