# Quick Passkey Cleanup Guide

## Quick Steps to Reset Everything

### 1. Clean Browser Storage (30 seconds)

Open browser console (F12) and run:

```javascript
// Clear localStorage
localStorage.removeItem("sozu_username");
console.log("✅ Cleared localStorage");

// Clear sessionStorage
sessionStorage.clear();
console.log("✅ Cleared sessionStorage");
```

### 2. Delete Browser Passkeys (2 minutes)

**Chrome/Edge:**

1. Go to `chrome://settings/passkeys` (or `edge://settings/passkeys`)
2. Find entries for `localhost` or `localhost:3000`
3. Delete them

**macOS Keychain Access:**

1. Open **Keychain Access** app
2. Search for "localhost"
3. Find WebAuthn entries
4. Delete them

**Safari:**

1. System Settings > Passwords
2. Search for "localhost"
3. Delete passkey entries

### 3. Delete Database Passkeys (1 minute)

**Via Supabase SQL Editor:**

```sql
-- View all passkeys first
SELECT
  p.id,
  p.user_id,
  pr.username,
  p.created_at
FROM passkeys p
JOIN profiles pr ON p.user_id = pr.id
ORDER BY p.created_at DESC;

-- Delete all passkeys
DELETE FROM passkeys;
```

### 4. Verify Cleanup (30 seconds)

Run this in browser console:

```javascript
// Check localStorage
console.log("LocalStorage:", Object.keys(localStorage));
console.log("SessionStorage:", Object.keys(sessionStorage));

// Check passkeys (will prompt if they exist)
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
    console.log("⚠️  Passkeys still exist");
  })
  .catch((e) => {
    if (e.name === "NotAllowedError" || e.name === "NotFoundError") {
      console.log("✅ No passkeys found");
    }
  });
```

### 5. Register New Passkey

1. Navigate to `http://localhost:3000/auth`
2. Click the fingerprint scan button
3. Select "Create a new passkey"
4. Complete registration

## Alternative: Use Cleanup Utility Page

Navigate to: `http://localhost:3000/dev/cleanup`

This page provides buttons to:

- Clear browser storage
- Check for passkeys
- Verify cleanup status

## Troubleshooting

**401 Error Still Happening?**

1. Make sure you deleted browser passkeys (not just database)
2. Clear browser cache: `chrome://settings/clearBrowserData`
3. Restart browser
4. Try incognito/private mode

**Passkeys Still Showing?**

1. Check Keychain Access (macOS) for leftover entries
2. Check browser settings for saved passkeys
3. Try incognito/private mode for a clean test

## Full Reset (Development Only)

If you want to delete everything:

```sql
-- WARNING: This deletes ALL users and data!
DELETE FROM passkeys;
DELETE FROM stellar_wallets;
DELETE FROM profiles;
-- DELETE FROM auth.users; -- Requires admin access
```
