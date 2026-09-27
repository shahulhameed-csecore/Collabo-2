-- =============================================================================
-- Collabo — Security Audit & Hardening Migration
-- 10_security_audit.sql
-- Run this in the Supabase SQL Editor
-- =============================================================================

-- 1. Enforce strict Row Level Security (RLS) on all tables to prevent owner bypass
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE 'ALTER TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' FORCE ROW LEVEL SECURITY;';
    END LOOP;
END $$;

-- 2. Restrict Supabase Storage for Proof Uploads
-- First, ensure the storage.buckets policy is secure (if manipulating buckets)
-- We only care about storage.objects (the files inside proof-uploads)

-- Drop any existing permissive policies on proof-uploads
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Enable read access for all" ON storage.objects;
DROP POLICY IF EXISTS "Enable insert access for all" ON storage.objects;

-- Create secure policies for proof-uploads bucket
-- 1. Read access: Only authenticated users can read (assuming internal users view proofs)
CREATE POLICY "authenticated_read_proofs" ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'proof-uploads');

-- 2. Insert access: Only service role or authenticated users can upload
-- Note: Currently uploads are done via FastAPI backend using the service_role key, 
-- which bypasses RLS by default. But it's good practice to restrict it anyway.
CREATE POLICY "authenticated_insert_proofs" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'proof-uploads');

-- 3. Block anonymous access entirely
-- (Unless explicitly needed for magic link users to download things directly, 
-- but they interact via the backend which serves it or generates signed URLs if needed. 
-- Wait, the magic link uploads using backend, and backend generates public URLs.
-- If the bucket is public, anyone can read if they have the UUID. If we want it public 
-- for reading so the frontend can just use the public URL without signing:
-- Actually, the backend uploads it and uses `get_public_url`. So SELECT must be public, 
-- but INSERT/UPDATE/DELETE must be restricted!

-- Correcting SELECT to be public so `get_public_url` works without signed tokens.
DROP POLICY IF EXISTS "authenticated_read_proofs" ON storage.objects;
CREATE POLICY "public_read_proofs" ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'proof-uploads');

-- Explicitly deny public INSERT/UPDATE/DELETE
CREATE POLICY "deny_public_insert" ON storage.objects
FOR INSERT
TO anon
WITH CHECK (false);

CREATE POLICY "deny_public_update" ON storage.objects
FOR UPDATE
TO anon
USING (false);

CREATE POLICY "deny_public_delete" ON storage.objects
FOR DELETE
TO anon
USING (false);
