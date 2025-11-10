-- Migration: Add profile_picture column to profiles table
-- This migration adds support for storing profile pictures in the database

-- Add profile_picture column to profiles table
alter table public.profiles
  add column if not exists profile_picture text;

-- Add comment explaining the column
comment on column public.profiles.profile_picture is 
'Base64 encoded profile picture or URL to profile picture. Stored in database for persistence across sessions.';

