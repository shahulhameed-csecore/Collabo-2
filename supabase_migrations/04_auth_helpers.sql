-- =============================================================================
-- Collabo — Auth Helpers Migration
-- Run this in the Supabase SQL Editor (Project → SQL Editor → New query)
-- =============================================================================

-- Creates a secure, server-side function to resolve a username to an email
-- This uses SECURITY DEFINER to bypass RLS, because unauthenticated users
-- (anon role) need to look up an email address when they try to log in via username.
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_email TEXT;
BEGIN
    -- Look up the user's email by joining auth.users and public.user_settings
    SELECT auth.users.email INTO v_email
    FROM public.user_settings
    JOIN auth.users ON auth.users.id = public.user_settings.user_id
    WHERE public.user_settings.username = p_username
    LIMIT 1;
    
    RETURN v_email;
END;
$$;

-- Allow unauthenticated and authenticated users to execute this function
GRANT EXECUTE ON FUNCTION public.get_email_by_username(TEXT) TO anon, authenticated;
