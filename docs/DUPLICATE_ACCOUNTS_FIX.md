# Duplicate Accounts Fix

## Problem

Multiple accounts were being created with the same username (e.g., "alice") due to a bug in the `handle_new_user()` database trigger. The trigger was catching username conflict errors silently, which allowed duplicate `auth.users` entries to be created even when the username already existed.

## Root Cause

The trigger had an exception handler that caught all errors (including username conflicts) and just logged a warning, then continued. This meant:

1. User tries to register with username "alice"
2. Trigger tries to create profile with username "alice"
3. Username already exists → unique constraint violation
4. Trigger catches error, logs warning, but continues
5. `auth.users` entry is created anyway (orphaned account)
6. Registration verify route tries to handle it, but creates modified username like "alice-123456"

## Solution

Three scripts have been created to fix this issue:

### 1. Find Duplicate Accounts (`019_find_duplicate_accounts.sql`)

Run this script first to identify all duplicate accounts:

```sql
-- Run in Supabase SQL Editor
\i scripts/019_find_duplicate_accounts.sql
```

This will show you:
- All profiles with duplicate usernames (shouldn't happen due to unique constraint)
- Orphaned `auth.users` entries (no profile)
- Accounts with mismatched intended vs actual usernames
- Summary of all duplicate accounts

### 2. Fix the Trigger (`020_fix_trigger_username_conflict.sql`)

This script updates the trigger to properly check for username conflicts BEFORE creating the profile:

```sql
-- Run in Supabase SQL Editor
\i scripts/020_fix_trigger_username_conflict.sql
```

**What it does:**
- Checks if username exists before creating profile
- Raises an error if username is taken (prevents `auth.users` creation)
- Only catches non-critical errors, re-raises unique violations

### 3. Cleanup Duplicate Accounts (`021_cleanup_duplicate_accounts.sql`)

This script provides helper functions and views to clean up duplicate accounts:

```sql
-- Run in Supabase SQL Editor
\i scripts/021_cleanup_duplicate_accounts.sql
```

**Helper functions:**
- `identify_primary_account(username)` - Finds the account to keep (oldest with valid profile)
- `get_orphaned_accounts()` - Lists all orphaned accounts
- `duplicate_accounts_summary` - View showing all duplicates

## Code Changes

The registration verify route (`app/api/auth/register/verify/route.ts`) has been updated to:

1. **Double-check username availability** before creating the user (prevents race conditions)
2. **Better error handling** for username conflicts from the trigger
3. **Return proper 409 Conflict** status when username is taken

## How to Clean Up Existing Duplicates

### Step 1: Identify Duplicates

```sql
-- See all duplicate accounts
select * from public.duplicate_accounts_summary;

-- See orphaned accounts for a specific username
select * from public.get_orphaned_accounts()
where intended_username = 'alice';
```

### Step 2: Identify Primary Account

```sql
-- Find which account to keep (oldest with valid profile)
select public.identify_primary_account('alice');
```

### Step 3: Review Before Deleting

**IMPORTANT:** Review the results carefully before deleting anything. Make sure you:
- Identify which account has the correct wallet/balance
- Check which account has the passkey you want to keep
- Verify which account was created first

### Step 4: Manual Cleanup (if needed)

```sql
-- Example: Delete orphaned accounts for 'alice'
-- WARNING: This will permanently delete auth.users entries!
-- Make sure you've identified the correct account to keep first!

-- First, identify the account to keep
select public.identify_primary_account('alice') as keep_this_account;

-- Then delete orphaned accounts (those without profiles)
-- Only run this if you're sure!
-- delete from auth.users 
-- where id in (
--   select auth_user_id from public.get_orphaned_accounts()
--   where intended_username = 'alice'
--   and auth_user_id != (select public.identify_primary_account('alice'))
-- );
```

## Prevention

After running the fix scripts, duplicate accounts should no longer be created because:

1. **Registration challenge** checks username availability
2. **Registration verify** double-checks before creating user
3. **Database trigger** now properly fails if username exists
4. **Error handling** properly catches and reports conflicts

## Testing

After applying the fixes, test registration:

1. Try to register with an existing username - should get 409 Conflict
2. Try to register with a new username - should succeed
3. Check that only one account exists per username

## Notes

- The unique constraint on `profiles.username` prevents duplicate profiles
- The trigger now prevents orphaned `auth.users` entries
- Existing duplicates need to be cleaned up manually (see above)
- Always backup your database before running cleanup scripts
