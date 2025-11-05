# Passkey Persistence Testing Guide

This document describes how to test passkey persistence and login functionality.

## Overview

Passkeys should persist across sessions, allowing users to log in with the same passkey they registered with. The credential_id is the unique identifier that links a passkey to a user account.

## Testing Flow

### 1. Registration (First Time)

1. Navigate to `/auth`
2. Click the fingerprint scan button
3. When prompted, select "Create a new passkey" or allow the browser to create one
4. Complete the passkey creation
5. **Check server logs for:**
   - `[Register] Credential ID being stored:` - Shows the credential_id being saved
   - `[Register] ✅ Passkey stored successfully:` - Confirms storage
   - `[Register] ✅ Verified: Can retrieve passkey immediately after storage` - Confirms retrieval works

### 2. Logout

1. Click logout button in the wallet menu
2. Verify you're redirected to `/auth`
3. **Clear sessionStorage** (optional, but recommended for testing):
   ```javascript
   sessionStorage.clear()
   ```

### 3. Login (Second Time)

1. Navigate to `/auth`
2. Click the fingerprint scan button
3. When prompted, select the same passkey you created during registration
4. **Check server logs for:**
   - `[Login] Credential ID details:` - Shows what credential_id is being searched
   - `[Login] DEBUG: All passkeys in database` - Shows all stored passkeys
   - `[Login] DEBUG: Searching for credential_id` - Shows the search value
   - `[Login] ✅ Found user by passkey credential_id` - Success!

## Expected Behavior

### ✅ Success Case

- Registration stores credential_id correctly
- Login finds the passkey by credential_id
- User is authenticated and redirected to `/wallet`
- Same user account is used (same wallet, same profile)

### ❌ Failure Cases

1. **"Passkey not found"** - The credential_id from login doesn't match what's stored
   - Check server logs to compare stored vs searched credential_ids
   - Verify credential_id format (base64url encoding)
   - Check for whitespace or encoding differences

2. **"Challenge not found"** - The challenge isn't being passed correctly
   - Ensure challenge is passed from client to server
   - Check serverless environment (challenge might not persist in memory)

3. **New wallet created** - User is being created as new instead of using existing
   - Check userId consistency
   - Verify passkey lookup is working
   - Ensure service client is used for RLS bypass

## Debugging Steps

### Check Stored Passkeys

Query the database to see all stored passkeys:

```sql
SELECT 
  id,
  user_id,
  credential_id,
  LENGTH(credential_id) as credential_id_length,
  SUBSTRING(credential_id, 1, 20) as first_20_chars,
  SUBSTRING(credential_id, LENGTH(credential_id) - 19, 20) as last_20_chars,
  created_at
FROM passkeys
ORDER BY created_at DESC
LIMIT 10;
```

### Compare Credential IDs

During login, compare:
- **Stored credential_id** (from database)
- **Searched credential_id** (from login request)

They should match exactly (character-by-character).

### Check Server Logs

Look for these log entries:

**During Registration:**
```
[Register] Credential ID being stored: { id: "...", length: ..., first_20: "...", last_20: "..." }
[Register] ✅ Passkey stored successfully: { credential_id: "...", ... }
[Register] ✅ Verified: Can retrieve passkey immediately after storage
```

**During Login:**
```
[Login] Credential ID details: { id: "...", length: ..., first_20: "...", last_20: "..." }
[Login] DEBUG: All passkeys in database: [...]
[Login] DEBUG: Searching for credential_id: { full: "...", length: ... }
[Login] ✅ Found user by passkey credential_id: <user_id> username: <username>
```

## Common Issues

### Issue 1: Credential ID Format Mismatch

**Symptom:** Passkey not found even though it exists in database

**Possible Causes:**
- Base64 vs base64url encoding
- Whitespace differences
- Character encoding issues

**Solution:**
- Ensure credential.id is stored exactly as received from browser
- Check for any encoding/decoding transformations
- Compare stored vs searched credential_ids character-by-character

### Issue 2: RLS Blocking Queries

**Symptom:** Passkey exists but query returns empty

**Solution:**
- Ensure service client is used for passkey lookups
- Verify SUPABASE_SERVICE_ROLE_KEY is set correctly

### Issue 3: Multiple Passkeys for Same User

**Symptom:** User has multiple passkeys, but login fails

**Solution:**
- Check for duplicate passkey creation
- Ensure only one passkey per user is created during registration
- Verify wallet creation logic doesn't create duplicate accounts

## Testing Checklist

- [ ] Register a new passkey
- [ ] Verify passkey is stored in database
- [ ] Logout completely
- [ ] Login with the same passkey
- [ ] Verify login succeeds
- [ ] Verify same user account is used
- [ ] Verify same wallet is accessible
- [ ] Test with multiple browsers/devices (if applicable)
- [ ] Test passkey discovery mode (no username)
- [ ] Test with username-based login

## Next Steps

If passkey persistence is working:
1. Test with different browsers
2. Test with different devices
3. Test passkey deletion and re-registration
4. Test multiple passkeys per user (if supported)

If passkey persistence is not working:
1. Check server logs for detailed error messages
2. Compare stored vs searched credential_ids
3. Verify database schema and indexes
4. Check RLS policies
5. Verify service client configuration

