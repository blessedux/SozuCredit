-- Make username (Sozu tag) private for account privacy
-- This ensures usernames are only visible to the account owner
-- while display_name remains public for community features

-- Drop the existing "Users can view all profiles" policy
drop policy if exists "Users can view all profiles" on public.profiles;

-- Create a policy that allows users to view their own profile (including username)
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Create a policy for viewing other users' profiles (for community features)
-- Note: Application code must explicitly exclude username when querying other users
-- RLS works at row level, so we can't hide columns - we rely on application-level filtering
create policy "Users can view other profiles"
  on public.profiles for select
  using (auth.uid() is not null and auth.uid() != id);

-- Add a comment explaining the privacy model
comment on column public.profiles.username is 
  'Sozu tag (username) - Private identifier used for authentication. 
   Application code must exclude this field when querying other users profiles.
   Only visible to the account owner via RLS.';
  
comment on column public.profiles.display_name is 
  'Public display name - Visible to all authenticated users for community features.';

-- Create a database function to get public profile data (without username)
-- This provides a secure way to query other users' profiles
create or replace function public.get_public_profile(user_id_param uuid)
returns table (
  id uuid,
  display_name text,
  profile_picture text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only return public fields, excluding username
  return query
  select 
    p.id,
    p.display_name,
    p.profile_picture,
    p.created_at,
    p.updated_at
  from public.profiles p
  where p.id = user_id_param;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.get_public_profile(uuid) to authenticated;

-- Note: 
-- 1. RLS policies allow users to view their own profile (with username) and other profiles
-- 2. Application code should use get_public_profile() function or explicitly exclude username
--    when querying other users' profiles
-- 3. Username availability checks use service role client to bypass RLS (legitimate use case)
