# Complete Authentication Flow Testing Guide

## ✅ Prerequisites Check

### 1. Health Endpoint Working

- **Status:** ✅ Working
- **URL:** https://sozu-credit.vercel.app/api/health
- **Response:** All environment variables set correctly

### 2. Environment Variables Set in Vercel

✅ `NEXT_PUBLIC_SUPABASE_URL` - Set  
✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Set  
⚠️ `SUPABASE_SERVICE_ROLE_KEY` - Optional (but recommended)

### 3. Database Setup

**Important:** Make sure database tables exist in Supabase:

Run these SQL scripts in Supabase SQL Editor (in order):

1. `scripts/001_create_schema.sql` - Creates tables (profiles, passkeys, vaults, trust_points)
2. `scripts/002_create_triggers.sql` - Creates triggers for auto-creating profiles, vaults, trust_points
3. `scripts/004_add_passkeys.sql` - Creates passkeys table (if not already created)

## 🧪 Step-by-Step Testing Guide

### Step 1: Test Registration Challenge Endpoint

Open browser console or use curl:

```bash
curl -X POST https://sozu-credit.vercel.app/api/auth/register/challenge \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser"}'
```

**Expected Response:**

```json
{
  "challenge": "base64-encoded-challenge",
  "rp": {
    "name": "MicroCredit Platform",
    "id": "sozu-credit.vercel.app"
  },
  "user": {
    "id": "testuser",
    "name": "testuser",
    "displayName": "testuser"
  },
  "pubKeyCredParams": [...],
  "timeout": 60000
}
```

✅ **Check:** `rp.id` should be `sozu-credit.vercel.app` (not `localhost`)

### Step 2: Test Login Challenge Endpoint

```bash
curl -X POST https://sozu-credit.vercel.app/api/auth/login/challenge \
  -H "Content-Type: application/json" \
  -d '{"username": "user"}'
```

**For New User (Expected):**

```json
{
  "error": "User not found"
}
```

Status: 404

**For Existing User (Expected):**

```json
{
  "challenge": "base64-encoded-challenge",
  "allowCredentials": [...],
  "timeout": 60000,
  "userVerification": "required"
}
```

### Step 3: Test Full Authentication Flow in Browser

#### 3a. Open the App

1. Go to: https://sozu-credit.vercel.app/auth
2. **Open Browser DevTools** (F12 or Cmd+Option+I)
3. Go to **Console** tab
4. Go to **Network** tab (to see API calls)

#### 3b. Click Fingerprint Button

1. Click the circular fingerprint button
2. Browser will show WebAuthn/biometric prompt
3. **Authenticate** (Touch ID, Face ID, Windows Hello, etc.)

#### 3c. Watch Console Logs

**For First-Time User (Registration):**

```
[Auth] ====== Starting authentication ======
[Auth] Step 1: Attempting login...
[Auth] Login failed, attempting registration...
[Auth] Reg Step 1: Generating registration challenge...
[Auth] Reg Step 2: Challenge generated, calling createPasskey...
[Auth] Reg Step 3: createPasskey result: Got credential
[Auth] Reg Step 4: Verifying registration...
[Auth] Reg Step 5: Verification result: {success: true, userId: "..."}
[Auth] Registration successful: {...}
[Auth] Reg Step 6: Setting up authentication...
[Auth] Reg Step 7: Redirecting to wallet...
[Auth] About to redirect after registration...
[Auth] Successfully navigated to: /wallet
```

**For Existing User (Login):**

```
[Auth] ====== Starting authentication ======
[Auth] Step 1: Attempting login...
[Auth] Step 2: Challenge generated, calling getPasskey...
[Auth] Step 3: getPasskey result: Got credential
[Auth] Step 4: Verifying authentication...
[Auth] Step 5: Verification result: {success: true, userId: "..."}
[Auth] Login successful: {...}
[Auth] Step 6: Setting up authentication...
[Auth] Step 7: Redirecting to wallet...
[Auth] About to redirect - final check...
[Auth] Successfully navigated to: /wallet
```

#### 3d. Check Network Tab

Look for these API calls (should all return 200):

1. **Registration Flow:**

   - `POST /api/auth/register/challenge` → 200 ✅
   - `POST /api/auth/register/verify` → 200 ✅

2. **Login Flow:**
   - `POST /api/auth/login/challenge` → 200 ✅
   - `POST /api/auth/login/verify` → 200 ✅

### Step 4: Verify Wallet Page Loads

After authentication:

1. Should redirect to: https://sozu-credit.vercel.app/wallet
2. Should see:
   - ✅ Balance display (masked with \*\*\*)
   - ✅ Trust Points button (bottom left)
   - ✅ Wallet icon button (bottom right)
   - ✅ Animated background

### Step 5: Test Wallet Data Loading

Open browser console on `/wallet` page and check:

**Expected Console Logs:**

```
[Wallet] Fetching vault data...
[Wallet] Vault data: {...}
[Wallet] Trust points: {...}
```

**Check Network Tab:**

- `GET /api/wallet/vault` → 200 ✅
- `GET /api/wallet/trust-points` → 200 ✅

## 🔍 Troubleshooting Common Issues

### Issue 1: "Challenge not found or expired"

**Symptom:** Error when verifying authentication/registration

**Cause:** Challenge store doesn't persist in serverless (already fixed!)

**Fix:** ✅ Already fixed - challenge is passed in request body

### Issue 2: WebAuthn prompt not showing

**Symptom:** Nothing happens when clicking fingerprint button

**Possible Causes:**

1. Browser doesn't support WebAuthn (use Chrome, Edge, Safari, or Firefox)
2. Not on HTTPS (required for WebAuthn)
3. Browser security settings blocking biometrics

**Fix:**

- ✅ Vercel uses HTTPS automatically
- Use a modern browser
- Allow biometric prompts in browser settings

### Issue 3: "User not found" on login

**Symptom:** Always goes to registration flow

**Cause:** User doesn't exist yet (this is expected!)

**Fix:** This is normal for first-time users. After registration, subsequent logins will work.

### Issue 4: Redirect loop

**Symptom:** Keeps redirecting between /auth and /wallet

**Cause:** sessionStorage not persisting

**Fix:**

1. Check browser console for sessionStorage errors
2. Make sure cookies are enabled
3. Try in incognito/private mode (to clear cache)

### Issue 5: Database errors

**Symptom:** "Failed to create user" or "Database error"

**Cause:** Database tables or triggers not set up

**Fix:**

1. Go to Supabase Dashboard → SQL Editor
2. Run scripts in order:
   - `001_create_schema.sql`
   - `002_create_triggers.sql`
   - `004_add_passkeys.sql`

### Issue 6: CORS errors

**Symptom:** Network requests blocked by CORS

**Cause:** Missing CORS headers (already fixed!)

**Fix:** ✅ Already fixed - all API routes have CORS headers

## ✅ Success Checklist

Use this checklist to verify everything works:

- [ ] Health endpoint returns 200 with all env vars set
- [ ] Registration challenge endpoint works
- [ ] Login challenge endpoint works (404 for new users is expected)
- [ ] Browser shows WebAuthn/biometric prompt
- [ ] User can authenticate successfully
- [ ] Registration flow completes (for first-time user)
- [ ] Login flow completes (for existing user)
- [ ] Redirects to /wallet after authentication
- [ ] Wallet page loads with balance display
- [ ] Wallet API calls return 200 (vault, trust-points)
- [ ] No console errors
- [ ] No network errors (all requests return 200)

## 🚀 Next Steps After Testing

Once authentication is working:

1. **Test Trust Points:**

   - Click Trust Points button (bottom left)
   - Should open modal
   - Check invite code generation
   - Test vouch functionality

2. **Test Profile:**

   - Click wallet icon (bottom right)
   - Should open profile sheet
   - Test editing username
   - Test language switching

3. **Test Session Persistence:**
   - Refresh page
   - Should stay logged in (if sessionStorage persists)
   - Close and reopen browser
   - Should require re-authentication (expected)

## 📝 Testing Checklist for Production

Before going live, test:

- [ ] First-time user registration works
- [ ] Existing user login works
- [ ] Session persistence (refresh page)
- [ ] Multiple users can register
- [ ] Passkeys are stored correctly in database
- [ ] Wallet data loads correctly
- [ ] All API endpoints work
- [ ] No console errors
- [ ] Mobile device testing (iOS Safari, Android Chrome)

## 🆘 Still Having Issues?

If you're still seeing errors:

1. **Check Vercel Function Logs:**

   - Vercel Dashboard → Deployments → Latest deployment
   - Click **Functions** tab
   - Look for error logs

2. **Check Browser Console:**

   - Look for JavaScript errors
   - Check Network tab for failed requests

3. **Check Supabase Logs:**

   - Supabase Dashboard → Logs
   - Look for database errors

4. **Share Error Details:**
   - Console error messages
   - Network tab screenshots
   - Vercel function logs
   - Specific step where it fails

---

**Remember:** The health endpoint shows all environment variables are set correctly, so the issue is likely in the authentication flow itself or database setup. Follow the testing steps above to identify exactly where it's failing.
