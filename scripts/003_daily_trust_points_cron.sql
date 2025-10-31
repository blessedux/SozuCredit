-- This script sets up a cron job to automatically add daily trust points
-- Note: This requires pg_cron extension which may need to be enabled by your database provider

-- Enable pg_cron extension (if not already enabled)
-- create extension if not exists pg_cron;

-- Create a function to add daily trust points to all users
create or replace function public.distribute_daily_trust_points()
returns void
language plpgsql
security definer
as $$
begin
  update public.trust_points
  set 
    balance = balance + 5,
    last_daily_credit = now(),
    updated_at = now()
  where 
    last_daily_credit < now() - interval '24 hours';
end;
$$;

-- Schedule the function to run every hour (it will only update users who are eligible)
-- Uncomment the line below if pg_cron is available:
-- select cron.schedule('distribute-daily-trust-points', '0 * * * *', 'select public.distribute_daily_trust_points()');

-- Alternative: Manual trigger
-- Users can also manually claim their daily points through the UI
-- The function checks if 24 hours have passed since last credit
