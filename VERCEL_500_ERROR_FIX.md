# Vercel 500 Error Debugging Guide

## Common Causes of 500 Errors in Vercel

### 1. Missing Environment Variables (MOST COMMON)

The app requires these environment variables in Vercel:

**Required:**

- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous/public key

**Optional but Recommended:**

- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database operations

**How to Add in Vercel:**

1. Go to your Vercel project dashboard
2. Click on **Settings** → **Environment Variables**
3. Add each variable with its value
4. **Important**: Make sure to add them to **Production**, **Preview**, and **Development** environments
5. **Redeploy** after adding variables

### 2. Challenge Store Not Persisting (Serverless Issue)

The `challengeStore` is an in-memory Map that won't persist across serverless function invocations in Vercel. Each function instance has isolated memory.

**Solution**: The code already has a fallback - if the challenge isn't in the store, it uses the challenge from the request body.

### 3. Database Connection Issues

If Supabase isn't accessible or database isn't set up:

- Check that your Supabase project is active (not paused)
- Verify database tables exist (run SQL scripts in Supabase SQL Editor)
- Check network connectivity from Vercel to Supabase

### 4. Node.js Version Issues

`crypto.randomUUID()` requires Node.js 14.17.0+. Verify your Vercel Node.js version.

**How to Set in Vercel:**

1. Go to **Settings** → **General**
2. Set **Node.js Version** to `20.x` or `18.x`

## Debugging Steps

### Step 1: Check Vercel Logs

1. Go to your Vercel project dashboard
2. Click on **Deployments** → Select the latest deployment
3. Click on **Functions** tab
4. Check the logs for error messages

Look for:

- `Missing Supabase environment variables`
- `Failed to initialize database connection`
- `Challenge not found or expired`
- Any stack traces

### Step 2: Verify Environment Variables

Check that all required variables are set:

```bash
# In Vercel Dashboard → Settings → Environment Variables
# Verify these exist:
NEXT_PUBLIC_SUPABASE_URL=✓
NEXT_PUBLIC_SUPABASE_ANON_KEY=✓
SUPABASE_SERVICE_ROLE_KEY=✓ (optional)
```

### Step 3: Test API Routes Directly

Use curl or Postman to test API routes:

```bash
# Test registration challenge
curl -X POST https://your-app.vercel.app/api/auth/register/challenge \
  -H "Content-Type: application/json" \
  -d '{"username": "test"}'

# Should return a challenge object
```

### Step 4: Check Database Setup

Run these SQL scripts in Supabase SQL Editor:

1. `scripts/001_create_schema.sql`
2. `scripts/002_create_triggers.sql`
3. `scripts/004_add_passkeys.sql`

## Quick Fix Checklist

- [ ] Environment variables added to Vercel (all 3 environments)
- [ ] Environment variables have correct names (no typos)
- [ ] Redeployed after adding environment variables
- [ ] Node.js version set to 18.x or 20.x
- [ ] Database tables created in Supabase
- [ ] Supabase project is active (not paused)
- [ ] Checked Vercel function logs for specific error

## Expected Error Messages

If you see these in Vercel logs:

- `Missing Supabase environment variables` → Add env vars to Vercel
- `Failed to initialize database connection` → Check Supabase URL and project status
- `Challenge not found or expired` → Normal for serverless, should use fallback
- `Database error saving new user` → Check database schema and triggers
