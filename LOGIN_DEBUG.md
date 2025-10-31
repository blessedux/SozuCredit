# Login Debug Guide

## What We Fixed

1. ✅ **Passkey Registration** - Now saves to database via `/api/auth/register/verify`
2. ✅ **Login Verification** - Updated to handle passkey verification
3. ✅ **Redirect** - Using Next.js router instead of `window.location`
4. ✅ **API Integration** - All passkey functions now call API endpoints

## Current Issue: Login Not Working

The login flow may be failing because:

### Possible Causes:

1. **Username doesn't exist** - Login tries username "user" but user hasn't registered yet
2. **No passkeys found** - User registered but passkey wasn't saved correctly
3. **Challenge verification failing** - Passkey verification is failing
4. **No Supabase session** - Middleware expects Supabase session but we're using sessionStorage

## How to Debug

### Step 1: Check if user exists in database

Run this in your Supabase SQL Editor:

```sql
-- Check if user exists
SELECT * FROM public.profiles WHERE username = 'user';

-- Check if passkey exists
SELECT * FROM public.passkeys;

-- Check auth.users
SELECT id, email FROM auth.users;
```

### Step 2: Check Browser Console

Open browser DevTools and check the console logs. You should see:

- `[Auth] Step 1: Attempting login...`
- `[Auth] Step 2: Challenge generated...`
- Any error messages

### Step 3: Check Network Tab

Look at the API calls:

1. `/api/auth/login/challenge` - Should return 200 if user exists
2. `/api/auth/login/verify` - Should return 200 if passkey verification succeeds

### Step 4: Common Errors

**Error: "User not found"**

- User hasn't registered yet
- Solution: Let the registration flow complete

**Error: "No passkeys found"**

- Passkey wasn't saved during registration
- Solution: Check `/api/auth/register/verify` logs

**Error: "Invalid passkey"**

- Passkey ID doesn't match
- Solution: Check credential_id in passkeys table matches

## Recommended Fixes

### Option 1: Add Service Role Key (Best for Production)

1. Get your service role key from Supabase Dashboard:

   - Go to Settings → API
   - Copy the `service_role` key (⚠️ Keep this secret!)

2. Add to `.env.local`:

   ```
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

3. This will enable proper Supabase session creation

### Option 2: Use Dynamic Username

Instead of hardcoding "user", let users enter a username:

```tsx
// In auth/page.tsx
const [username, setUsername] = useState("user"); // Make this dynamic
```

### Option 3: Check Database Schema

Make sure you've run all SQL scripts:

1. `001_create_schema.sql`
2. `002_create_triggers.sql`
3. `003_daily_trust_points_cron.sql` (optional)
4. `004_add_passkeys.sql`

See `scripts/README.md` for instructions.

## Testing the Flow

1. **First Time (Registration)**:

   - Click fingerprint button
   - Should create user "user" in database
   - Should save passkey to `passkeys` table
   - Should redirect to `/dashboard`

2. **Second Time (Login)**:
   - Click fingerprint button
   - Should find user "user"
   - Should verify passkey
   - Should redirect to `/dashboard`

## Next Steps

1. Check the database - verify user and passkey exist
2. Check browser console - see what errors occur
3. Check network tab - verify API calls succeed
4. Add service role key if available
5. Test the flow again

## Environment Variables

Make sure your `.env.local` has:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://hxzwqsywmahgngbgeinb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
# Optional but recommended:
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Restart dev server after adding environment variables:

```bash
pnpm dev
```
