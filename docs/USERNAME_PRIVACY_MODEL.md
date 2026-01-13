# Username (Sozu Tag) Privacy Model

## Overview

The Sozu tag (username) is a **private identifier** used for authentication. It is stored securely in Supabase and is only visible to the account owner. This document explains how usernames are stored, secured, and used.

## Privacy Model

### Username Storage
- **Location**: `public.profiles.username` column in Supabase
- **Visibility**: Private - only visible to the account owner
- **Purpose**: Authentication identifier (1 passkey = 1 tag = 1 wallet address)
- **Uniqueness**: Enforced at database level with unique constraint

### Display Name
- **Location**: `public.profiles.display_name` column
- **Visibility**: Public - visible to all authenticated users
- **Purpose**: Public-facing identifier for community features
- **Usage**: Used in search, business ideas, vouches, etc.

## Security Implementation

### Row Level Security (RLS) Policies

1. **Users can view their own profile**
   - Allows users to see their complete profile including username
   - Policy: `auth.uid() = id`

2. **Users can view other profiles**
   - Allows authenticated users to view other users' profiles
   - **Important**: Application code must exclude `username` when querying other users
   - Policy: `auth.uid() is not null and auth.uid() != id`

### Service Role Usage

The service role client is used for legitimate administrative operations:

1. **Username Availability Checks** (`/api/auth/username/check`)
   - Checks if a username exists during registration
   - Uses service role to bypass RLS (legitimate use case)
   - Only checks existence, doesn't expose sensitive data

2. **Registration Challenge** (`/api/auth/register/challenge`)
   - Validates username uniqueness before creating account
   - Uses service role to bypass RLS

### Database Function

A secure function `get_public_profile(uuid)` is available to query public profile data:
- Returns: `id`, `display_name`, `profile_picture`, `created_at`, `updated_at`
- Excludes: `username` (private field)
- Access: Available to all authenticated users

## Application-Level Privacy

### Code Patterns

**✅ Correct - Exclude username when querying other users:**
```typescript
// Public profile query
const { data } = await supabase
  .from("profiles")
  .select("id, display_name, profile_picture")
  .eq("id", otherUserId)
```

**✅ Correct - Use service role for username checks:**
```typescript
// Username availability check (registration)
const serviceClient = createServiceClient(url, serviceKey)
const { data } = await serviceClient
  .from("profiles")
  .select("id, username")
  .eq("username", usernameToCheck)
```

**❌ Incorrect - Don't query username for other users:**
```typescript
// DON'T DO THIS for other users
const { data } = await supabase
  .from("profiles")
  .select("*")  // This includes username!
  .eq("id", otherUserId)
```

### Updated Files

1. **Search Functionality** (`app/dashboard/community/search/search-user-form.tsx`)
   - Updated to explicitly exclude `username` from search results
   - Only returns: `id`, `display_name`, `email`, `profile_picture`, `created_at`, `updated_at`

2. **Community Pages**
   - Already use `display_name` for public display
   - No changes needed (they don't query username)

3. **Username Check API** (`app/api/auth/username/check/route.ts`)
   - Uses service role client to bypass RLS
   - Only checks existence, doesn't expose usernames

4. **Registration Challenge API** (`app/api/auth/register/challenge/route.ts`)
   - Uses service role client to bypass RLS
   - Validates username uniqueness

## Migration

Run the migration script to apply the privacy model:

```sql
-- Run in Supabase SQL Editor
\i scripts/018_make_username_private.sql
```

This script:
1. Updates RLS policies to separate own profile vs. other profiles
2. Creates `get_public_profile()` function for secure queries
3. Adds documentation comments to database columns

## Best Practices

1. **Always exclude username** when querying other users' profiles
2. **Use service role** only for legitimate administrative operations (username checks)
3. **Use display_name** for all public-facing features
4. **Test privacy** by querying profiles as different users
5. **Document** any new profile queries to ensure username is excluded

## Privacy Guarantees

- ✅ Usernames are only visible to the account owner
- ✅ Usernames cannot be queried by other users via RLS
- ✅ Application code enforces privacy by excluding username in queries
- ✅ Service role is only used for legitimate username availability checks
- ✅ Display names remain public for community features

## Future Considerations

If you need to make usernames searchable or shareable in the future:
1. Add a privacy setting column to profiles
2. Allow users to opt-in to making their username public
3. Update RLS policies to respect privacy settings
4. Update application code to conditionally include username based on privacy setting
