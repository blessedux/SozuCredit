# Full Authentication Flow Fix Guide

## Current Status

✅ Health endpoint working: [https://sozu-credit.vercel.app/api/health](https://sozu-credit.vercel.app/api/health)
✅ Environment variables set correctly
⚠️ Need to test and fix full auth flow

## Step-by-Step Fix

### Step 1: Test Authentication Endpoints

Test each endpoint individually to identify where it fails:

#### Test 1: Registration Challenge

```bash
curl -X POST https://sozu-credit.vercel.app/api/auth/register/challenge \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser"}'
```

**Expected Response:**

```json
{
  "challenge": "...",
  "rp": { "name": "...", "id": "..." },
  "user": { "id": "...", "name": "...", "displayName": "..." }
}
```

#### Test 2: Login Challenge (after user exists)

```bash
curl -X POST https://sozu-credit.vercel.app/api/auth/login/challenge \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser"}'
```

**Expected Response if user exists:**

```json
{
  "challenge": "...",
  "allowCredentials": [...]
}
```

**Expected Response if user doesn't exist:**

```json
{
  "error": "User not found"
}
```

Status: 404

### Step 2: Common Issues & Fixes

#### Issue 1: Challenge Store Not Persisting (Serverless)

**Problem:** In Vercel serverless functions, the in-memory challenge store doesn't persist between requests.

**Solution:** The code already handles this by:

- Passing the challenge in the request body during registration
- The verify endpoint falls back to the provided challenge if not in store

**Status:** ✅ Already handled in code

#### Issue 2: Hardcoded Username "user"

**Problem:** The auth page uses hardcoded username "user"

**Location:** `app/auth/page.tsx` line 42:

```typescript
challenge = await generateAuthChallenge("user");
```

**Fix Options:**

1. Keep "user" as default (for single-user app)
2. Add username input field (for multi-user app)

**Recommendation:** For testing, keep "user" but document it.

#### Issue 3: Database Tables Missing

**Problem:** If database tables don't exist, registration will fail.

**Fix:** Run SQL scripts in Supabase:

1. `scripts/001_create_schema.sql` - Creates tables
2. `scripts/002_create_triggers.sql` - Creates triggers
3. `scripts/004_add_passkeys.sql` - Creates passkeys table

### Step 3: Testing the Full Flow

#### In Browser (Recommended):

1. **Open the app:**

   ```
   https://sozu-credit.vercel.app/auth
   ```

2. **Open Browser DevTools Console** (F12 or Cmd+Option+I)

3. **Click the fingerprint button**

4. **Watch console logs** for:

   - `[Auth] ====== Starting authentication ======`
   - `[Auth] Step 1: Attempting login...`
   - `[Auth] Step 2: Challenge generated...`
   - Either:
     - Login success → redirects to `/wallet`
     - Registration flow → creates user → redirects to `/wallet`

5. **Check Network Tab:**
   - Look for `/api/auth/login/challenge` or `/api/auth/register/challenge`
   - Check response status (200 = success, 404/500 = error)
   - Check response body for errors

#### Using curl (For Testing API):

**Registration Flow:**

```bash
# 1. Get challenge
CHALLENGE_RESPONSE=$(curl -X POST https://sozu-credit.vercel.app/api/auth/register/challenge \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser"}')

echo $CHALLENGE_RESPONSE

# 2. Create passkey (this requires browser WebAuthn API - can't test with curl)
# 3. Verify registration
# (Requires actual credential from browser)
```

### Step 4: Debugging Specific Errors

#### Error: "User not found" (404)

**Cause:** User doesn't exist in database
**Fix:** This is expected for first-time users - triggers registration flow
**Status:** ✅ Working as designed

#### Error: "Challenge not found or expired"

**Cause:** Challenge store doesn't persist in serverless
**Fix:** ✅ Already fixed - challenge passed in request body

#### Error: "Failed to initialize database connection"

**Cause:** Missing or incorrect Supabase environment variables
**Fix:** Check Vercel environment variables:

- `NEXT_PUBLIC_SUPABASE_URL` ✓ (already set)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` ✓ (already set)

#### Error: CORS errors

**Cause:** Missing CORS headers
**Fix:** ✅ Already fixed - all routes have CORS headers

#### Error: "No passkeys found"

**Cause:** User exists but no passkey registered
**Fix:** This should trigger registration - check registration flow

### Step 5: Verification Checklist

Run through this checklist:

- [ ] Health endpoint returns 200: `/api/health`
- [ ] Registration challenge endpoint returns 200: `/api/auth/register/challenge`
- [ ] Login challenge returns 404 for new users (expected)
- [ ] Login challenge returns 200 for existing users
- [ ] Browser can access `/auth` page
- [ ] Fingerprint button triggers WebAuthn prompt
- [ ] After authentication, redirects to `/wallet`
- [ ] `/wallet` page loads with balance

### Step 6: If Still Not Working

**Check Vercel Function Logs:**

1. Go to Vercel Dashboard → Deployments → Latest deployment
2. Click **Functions** tab
3. Check logs for:
   - API route errors
   - Database connection errors
   - Challenge generation errors

**Common Log Messages to Look For:**

- `[Register] User created:` - ✅ Registration successful
- `[Login] Login verification error:` - ❌ Login failed
- `Missing Supabase environment variables` - ❌ Env vars not set
- `Failed to create Supabase client` - ❌ Connection issue

### Step 7: Full Auth Flow Success Indicators

**Successful Registration:**

```
1. User clicks fingerprint button
2. Browser shows WebAuthn prompt
3. User authenticates
4. Console shows: "[Register] Registration successful for user: <id>"
5. Redirects to /wallet
6. Wallet page shows balance
```

**Successful Login:**

```
1. User clicks fingerprint button
2. Browser shows WebAuthn prompt
3. User authenticates
4. Console shows: "[Auth] Login successful: <result>"
5. Redirects to /wallet
6. Wallet page shows balance
```

## Next Steps

1. **Test the auth flow in browser** and share any console errors
2. **Check Vercel function logs** for server-side errors
3. **Verify database tables exist** in Supabase (run SQL scripts)
4. **Check browser console** for client-side errors

Let me know what specific error you're seeing, and I'll help you fix it!
