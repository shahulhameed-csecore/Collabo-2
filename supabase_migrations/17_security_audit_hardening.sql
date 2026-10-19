-- =============================================================================
-- Collabo — Security Audit Hardening Migration
-- 17_security_audit_hardening.sql
-- Run this in the Supabase SQL Editor
-- Addresses: SEC-01, SEC-02/DB-Uniqueness, SEC-04, SEC-06
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. SEC-01: Revoke Client-Side Write Access to public.subscriptions
-- ---------------------------------------------------------------------------
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'subscriptions') THEN
        -- Drop all permissive user update/insert/delete policies
        DROP POLICY IF EXISTS "Users can update their own subscription" ON public.subscriptions;
        DROP POLICY IF EXISTS "subscriptions_update" ON public.subscriptions;
        DROP POLICY IF EXISTS "subscriptions_insert" ON public.subscriptions;
        DROP POLICY IF EXISTS "subscriptions_delete" ON public.subscriptions;

        -- Ensure read-only access for authenticated users
        DROP POLICY IF EXISTS "subscriptions_select" ON public.subscriptions;
        CREATE POLICY "subscriptions_select" ON public.subscriptions
            FOR SELECT TO authenticated
            USING (auth.uid() = user_id);

        -- Force RLS to prevent table owner bypass
        ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.subscriptions FORCE ROW LEVEL SECURITY;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. SEC-02: Ensure processed_transactions Table & Strict Unique Constraints
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.processed_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT NOT NULL,
    payment_id TEXT,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure payment_id column exists if table was previously created without it
ALTER TABLE public.processed_transactions 
    ADD COLUMN IF NOT EXISTS payment_id TEXT;

-- Enforce strict uniqueness on order_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'processed_transactions_order_id_key'
    ) THEN
        ALTER TABLE public.processed_transactions 
            ADD CONSTRAINT processed_transactions_order_id_key UNIQUE (order_id);
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- If duplicate data exists or index already covers it
    CREATE UNIQUE INDEX IF NOT EXISTS idx_processed_transactions_order_id 
        ON public.processed_transactions(order_id);
END $$;

-- Enforce strict uniqueness on payment_id (when provided)
CREATE UNIQUE INDEX IF NOT EXISTS idx_processed_transactions_payment_id 
    ON public.processed_transactions(payment_id) 
    WHERE payment_id IS NOT NULL;

-- Enable and force RLS on processed_transactions
ALTER TABLE public.processed_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_transactions FORCE ROW LEVEL SECURITY;

-- Only service_role should access processed_transactions (users cannot view/tamper)
DROP POLICY IF EXISTS "processed_transactions_service_only" ON public.processed_transactions;
CREATE POLICY "processed_transactions_service_only" ON public.processed_transactions
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 3. SEC-04: Secure increment_ai_extractions RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_ai_extractions(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Assert that caller is either the owner user or the service_role
    IF auth.role() <> 'service_role' AND auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'Access Denied: You cannot modify extraction counters for other users.';
    END IF;

    UPDATE public.subscriptions 
    SET ai_extractions_count = COALESCE(ai_extractions_count, 0) + 1 
    WHERE user_id = p_user_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. SEC-06: Revoke Public & Anon Access to get_email_by_username
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'get_email_by_username'
    ) THEN
        REVOKE EXECUTE ON FUNCTION public.get_email_by_username(TEXT) FROM anon;
        REVOKE EXECUTE ON FUNCTION public.get_email_by_username(TEXT) FROM authenticated;
        REVOKE EXECUTE ON FUNCTION public.get_email_by_username(TEXT) FROM public;
        GRANT EXECUTE ON FUNCTION public.get_email_by_username(TEXT) TO service_role;
    END IF;
END $$;
