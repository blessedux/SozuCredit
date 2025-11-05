# Passkey Reset Guide

This guide helps you clean up all passkeys and start fresh with a new authentication setup.

## Problem

When you get a 401 error with "Passkey not found. Please register a new passkey," it usually means:

1. The browser has a passkey stored that doesn't match what's in the database
2. The database has passkeys that don't match what's in the browser
3. There's a mismatch between the credential_id stored and what's being searched

## Solution: Complete Reset

### Step 1: Clean Up Browser Passkeys

#### Chrome/Edge (Chromium-based browsers)

1. **Via Browser Settings:**

   - Go to `chrome://settings/passkeys` (or `edge://settings/passkeys` for Edge)
   - Find passkeys for `localhost:3000` or `localhost`
   - Delete them manually

2. **Via macOS Keychain Access:**

   - Open **Keychain Access** app
   - Search for "localhost" or "webauthn"
   - Find entries related to passkeys
   - Delete them

3. **Via Browser Console (Quick Method):**
   - Open browser DevTools (F12)
   - Go to Console tab
   - Run the cleanup script (see below)

#### Safari

1. **Via System Settings:**

   - Go to **System Settings** > **Passwords**
   - Search for "localhost"
   - Find and delete passkey entries

2. **Via Keychain Access:**
   - Open **Keychain Access** app
   - Search for "localhost" or "webauthn"
   - Delete related entries

#### Firefox

- Firefox doesn't support WebAuthn passkeys in the same way
- Use Chrome/Edge or Safari for passkey testing

### Step 2: Clean Up Database Passkeys

#### Option A: Delete via SQL (Recommended)

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Run this query to see all passkeys:

```sql
SELECT
  p.id,
  p.user_id,
  p.credential_id,
  pr.username,
  p.created_at
FROM passkeys p
JOIN profiles pr ON p.user_id = pr.id
ORDER BY p.created_at DESC;
```

4. Delete all passkeys (use with caution):

```sql
-- Delete all passkeys
DELETE FROM passkeys;
```

5. Or delete passkeys for a specific username:

```sql
-- Delete passkeys for a specific user
DELETE FROM passkeys
WHERE user_id IN (
  SELECT id FROM profiles WHERE username = 'your_username'
);
```

#### Option B: Use the Cleanup API (Development Only)

See the cleanup utility script below.

### Step 3: Clean Up Local Storage

1. Open browser DevTools (F12)
2. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
3. Under **Local Storage**, find `http://localhost:3000`
4. Delete the following keys:
   - `sozu_username`
5. Under **Session Storage**, find `http://localhost:3000`
6. Delete the following keys:
   - `dev_username`
   - `dev_authenticated`
   - `passkey_registered`
   - `dev_username_display`

### Step 4: Clean Up Users (Optional - Development Only)

If you want to start completely fresh:

```sql
-- WARNING: This deletes ALL users and their data
-- Only use in development!

-- Delete in order (respecting foreign key constraints)
DELETE FROM passkeys;
DELETE FROM stellar_wallets;
DELETE FROM profiles;
DELETE FROM auth.users; -- This may require admin access
```

### Step 5: Verify Cleanup

1. **Check Browser:**

   - Open DevTools Console
   - Run: `navigator.credentials.get({ publicKey: { challenge: new Uint8Array(32), rpId: 'localhost' } })`
   - You should see a "No passkeys found" error or no passkeys available

2. **Check Database:**

   ```sql
   SELECT COUNT(*) FROM passkeys;
   -- Should return 0
   ```

3. **Check Local Storage:**
   - Open DevTools > Application > Local Storage
   - Verify `sozu_username` is cleared
   - Verify Session Storage is cleared

### Step 6: Register a New Passkey

1. Navigate to `/auth`
2. Click the fingerprint scan button
3. When prompted, select "Create a new passkey"
4. Complete the registration
5. Verify you're redirected to `/wallet`

## Browser Console Cleanup Script

Run this in your browser console to clean up local storage:

```javascript
// Clean up localStorage
localStorage.removeItem("sozu_username");
console.log("✅ Cleared localStorage");

// Clean up sessionStorage
sessionStorage.clear();
console.log("✅ Cleared sessionStorage");

// Note: Browser passkeys need to be deleted manually via browser settings
// or Keychain Access (macOS)
console.log(
  "⚠️  Remember to delete passkeys via browser settings or Keychain Access"
);
```

## Verification Script

Run this to verify everything is clean:

```javascript
// Check localStorage
const localStorageKeys = Object.keys(localStorage);
console.log("LocalStorage keys:", localStorageKeys);

// Check sessionStorage
const sessionStorageKeys = Object.keys(sessionStorage);
console.log("SessionStorage keys:", sessionStorageKeys);

// Check if passkeys exist (will prompt if they do)
navigator.credentials
  .get({
    publicKey: {
      challenge: new Uint8Array(32),
      rpId: "localhost",
      allowCredentials: [],
      userVerification: "required",
    },
  })
  .then(() => {
    console.log("⚠️  Passkeys still exist in browser");
  })
  .catch((e) => {
    if (e.name === "NotAllowedError" || e.name === "NotFoundError") {
      console.log("✅ No passkeys found in browser");
    } else {
      console.log("Error:", e);
    }
  });
```

## Troubleshooting

### Issue: "Passkey not found" after cleanup

**Solution:**

1. Make sure you deleted browser passkeys (not just database)
2. Clear browser cache and cookies for localhost:3000
3. Restart the browser
4. Try registration again

### Issue: "Invalid passkey" error

**Solution:**

1. Verify database passkeys were deleted
2. Check server logs for credential_id mismatch
3. Ensure you're using the same rpId (localhost) for both registration and login

### Issue: Passkeys still showing up

**Solution:**

1. Check Keychain Access (macOS) for leftover entries
2. Check browser settings for saved passkeys
3. Try incognito/private mode to test with a clean slate
4. Clear browser data completely and restart

## Prevention

To avoid this issue in the future:

1. Always use the same rpId for registration and login
2. Ensure credential_id is stored exactly as received from browser
3. Don't manually edit database passkeys
4. Test passkey persistence in a clean environment first
