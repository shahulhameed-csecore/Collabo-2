-- 12_notifications_grants.sql
-- Grants necessary permissions for the backend service_role and authenticated users to access the notifications table

-- Grant usage on schema (usually already granted, but safe to include)
GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant all privileges to the service_role so the backend can insert/select notifications
GRANT ALL PRIVILEGES ON TABLE public.notifications TO service_role;

-- Grant select/update to authenticated users (they are constrained by RLS)
GRANT SELECT, UPDATE ON TABLE public.notifications TO authenticated;
