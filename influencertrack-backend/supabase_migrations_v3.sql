-- =============================================================================
-- Collabo — Campaign Workflow & Secure Uploads v3 Migration
-- =============================================================================

-- 1. Add new columns for the Proof of Posting workflow
ALTER TABLE public.campaigns
    ADD COLUMN IF NOT EXISTS magic_link_token UUID DEFAULT gen_random_uuid(),
    ADD COLUMN IF NOT EXISTS proof_url TEXT;

-- 2. Migrate existing status values to the new linear workflow
-- Old statuses: 'draft', 'active', 'completed', 'cancelled'
-- New statuses: 'draft', 'active', 'content_received', 'approved', 'paid'

UPDATE public.campaigns SET status = 'paid' WHERE status = 'completed';
-- If cancelled needs to be mapped to a valid state, we might map it to draft or leave it if we choose to allow cancelled.
-- Let's just allow it or keep it as is, but we will strictly enforce the new flow in the application.
-- Actually, let's make sure magic_link_token is unique.
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaigns_magic_link_token ON public.campaigns(magic_link_token);

-- 3. Create a Storage Bucket for proof files if it doesn't exist
-- Note: Supabase storage buckets are typically created via the Dashboard or Storage API,
-- but we can attempt to insert into storage.buckets if using service role.
-- (Assuming the standard Supabase storage schema)
INSERT INTO storage.buckets (id, name, public)
VALUES ('proof-uploads', 'proof-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- 4. Enable RLS on the bucket
-- Allow authenticated users (brands) to read
CREATE POLICY "Brand can view proofs"
    ON storage.objects FOR SELECT
    USING ( bucket_id = 'proof-uploads' AND auth.role() = 'authenticated' );

-- Allow the backend service role to insert (since our FastAPI server will handle the upload)
-- Service role bypasses RLS anyway, so no explicit policy needed for inserts.
