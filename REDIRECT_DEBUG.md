# Redirect Debugging Guide

## Environment Variables Required

The app requires these environment variables to work properly:

### Required Variables

1. **`NEXT_PUBLIC_SUPABASE_URL`** - Your Supabase project URL
   - Example: `https://xxxxx.supabase.co`

2. **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** - Your Supabase anonymous/public key
   - Found in Supabase Dashboard → Settings → API

### Optional (but recommended)

3. **`SUPABASE_SERVICE_ROLE_KEY`** - Service role key for creating sessions
   - Found in Supabase Dashboard → Settings → API
   - **IMPORTANT**: This is needed for proper session management
   - Without this, the app falls back to `sessionStorage` only

## How to Check Environment Variables

1. **Check if variables are set in `.env.local`:**
   ```bash
   cat .env.local | grep SUPABASE
   ```

2. **Check if they're loaded in the app:**
   - The app should log errors if variables are missing
   - Check browser console for Supabase client errors

## Debugging Redirect Issues

### Step 1: Check Browser Console

After clicking the fingerprint button, check the browser console for:

1. **Authentication Steps:**
   - `[Auth] Step 1: Attempting login...`
   - `[Auth] Step 2: Challenge generated...`
   - `[Auth] Step 3: getPasskey result...`
   - `[Auth] Step 4: Verifying authentication...`
   - `[Auth] Step 5: Verification result...`

2. **Success Indicators:**
   - `[Auth] Login successful:` or `[Auth] Registration successful:`
   - `[Auth] SessionStorage verified: true`
   - `[Auth] Step 7: Redirecting to wallet...`
   - `[Auth] Executing redirect to /wallet`

### Step 2: Check Network Tab

1. Open DevTools → Network tab
2. Look for API calls:
   - `/api/auth/login/challenge` or `/api/auth/register/challenge`
   - `/api/auth/login/verify` or `/api/auth/register/verify`
3. Check if they return JSON (not HTML)
4. Check if they return `{ success: true, userId: "..." }`

### Step 3: Check sessionStorage

In browser console, run:
```javascript
console.log({
  authenticated: sessionStorage.getItem("dev_authenticated"),
  username: sessionStorage.getItem("dev_username"),
  passkey: sessionStorage.getItem("passkey_registered")
})
```

Should show:
```javascript
{
  authenticated: "true",
  username: "user", // or actual userId
  passkey: "true"
}
```

### Step 4: Common Issues

#### Issue 1: API Routes Returning HTML
**Symptom:** Console shows `SyntaxError: Unexpected token '<', "<!DOCTYPE "...`

**Solution:**
- Restart your dev server (`pnpm dev`)
- Check middleware isn't intercepting API routes

#### Issue 2: Verification Returns Error
**Symptom:** `[Auth] Step 5: Verification result: { success: false }`

**Possible Causes:**
- User doesn't exist in database
- Passkey not saved to database
- Database schema not set up (missing `passkeys` or `profiles` tables)

**Solution:**
- Run SQL migration scripts in Supabase SQL Editor
- Check database has `passkeys` and `profiles` tables

#### Issue 3: Redirect Not Executing
**Symptom:** See `[Auth] Step 7: Redirecting...` but no redirect happens

**Possible Causes:**
- `setTimeout` or `requestAnimationFrame` blocked
- Browser blocking redirect
- JavaScript error preventing execution

**Solution:**
- Check for JavaScript errors in console
- Try manually running: `window.location.href = "/wallet"` in console

#### Issue 4: Wallet Page Immediately Redirects Back
**Symptom:** Redirects to `/wallet` but immediately redirects to `/auth`

**Possible Causes:**
- `sessionStorage` not set before redirect
- Race condition - wallet page loads before storage is ready

**Solution:**
- Check `sessionStorage` is set (Step 3)
- The wallet page has retry logic, but if storage isn't set, it will redirect

## Testing the Full Flow

1. **Clear everything:**
   ```javascript
   // In browser console
   sessionStorage.clear()
   ```

2. **Click fingerprint button**

3. **Watch console logs:**
   - Should see all steps from Step 1 to Step 7
   - Should see redirect executed

4. **Check final state:**
   - URL should change to `/wallet`
   - Wallet page should load
   - Should see balance and credit request options

## Environment Variables Checklist

Create `.env.local` with:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Important:** After adding/changing environment variables:
1. Restart your dev server
2. Clear browser cache
3. Try again

## Still Not Working?

1. **Share browser console output** - Especially lines starting with `[Auth]`
2. **Share Network tab** - Screenshot of API calls
3. **Share sessionStorage contents** - What's actually stored
4. **Share environment variable names** - (Don't share the actual values!)
