-- Enable pg_cron if not already enabled
create extension if not exists pg_cron;

-- Schedule webhook events cleanup daily
select cron.schedule(
  'cleanup-webhook-events', 
  '0 0 * * *',
  $$ delete from webhook_events where created_at < now() - interval '1 day' $$
);
