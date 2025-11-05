# Wallet Creation Fix - Console Testing Guide

## Overview

This document describes what to look for in console logs when testing the wallet creation and maintenance fixes.

## Critical Fixes Applied

1. **userId Consistency**: Always use userId (UUID) from API response, never fallback to username
2. **Duplicate Prevention**: Check for existing wallet BEFORE creating a new one
3. **Better Logging**: Comprehensive logging throughout the wallet creation/retrieval process

## Console Log Flow - Expected Behavior

### Login Flow (Same Passkey)

#### 1. Authentication (Client-side)

```
[Auth] Step 5: Verification result: { success: true, userId: "uuid-here", username: "username" }
[Auth] Verification userId: "uuid-here"
[Auth] Stored userId in sessionStorage: "uuid-here" Username: "username"
```

**✅ PASS**: Should see `userId` is a UUID (not a username string)
**❌ FAIL**: If you see `userId` is a username string, there's still an issue

#### 2. Login API (Server-side)

```
[Login] Found user by passkey credential_id: "uuid-here" username: "username"
[Login] Checking for existing wallet for userId: "uuid-here"
[getStellarWallet] Querying wallet for userId: "uuid-here"
[getStellarWallet] Wallet found for userId: "uuid-here" publicKey: "G..."
[Login] ✅ Stellar wallet already exists for userId: "uuid-here" publicKey: "G..."
```

**✅ PASS**: Should see "Wallet already exists" if you've logged in before
**❌ FAIL**: If you see "No Stellar wallet found" after first login, wallet creation might be failing

#### 3. Wallet Retrieval (If wallet already exists)

```
[storeStellarWallet] Wallet already exists for userId: "uuid-here" NOT creating duplicate
[storeStellarWallet] Existing wallet: { id: "...", turnkeyWalletId: "...", publicKey: "G..." }
```

**✅ PASS**: Should see "NOT creating duplicate" message
**❌ FAIL**: If you see "No existing wallet found, creating new wallet" after first login, duplicate prevention isn't working

### Registration Flow (New User)

#### 1. Registration (Client-side)

```
[Auth] Reg Step 5: Verification result: { success: true, userId: "uuid-here", username: "username" }
[Auth] Registration userId: "uuid-here"
[Auth] Stored userId in sessionStorage after registration: "uuid-here" Username: "username"
```

**✅ PASS**: Should see `userId` is a UUID
**❌ FAIL**: If `userId` is missing or is a username string

#### 2. Registration API (Server-side)

```
[Register] Username is available, creating new user with email: "passkey-uuid@test.com"
[Register] User created: "uuid-here"
[Register] Checking for existing wallet for userId: "uuid-here"
[getStellarWallet] Querying wallet for userId: "uuid-here"
[getStellarWallet] No wallet found for userId: "uuid-here"
[Register] No Stellar wallet found for userId: "uuid-here" - creating new wallet
[Register] Created wallet with Turnkey, storing in database...
[storeStellarWallet] No existing wallet found, creating new wallet: { userId: "uuid-here", ... }
[Register] ✅ Stellar wallet created and stored successfully: { userId: "uuid-here", publicKey: "G...", ... }
```

**✅ PASS**: Should see wallet creation only on first registration
**❌ FAIL**: If wallet creation fails or throws errors

### Second Login (Same Passkey)

#### Expected Console Output:

```
[Auth] Stored userId in sessionStorage: "same-uuid-here" Username: "username"
[Login] Found user by passkey credential_id: "same-uuid-here" username: "username"
[Login] Checking for existing wallet for userId: "same-uuid-here"
[getStellarWallet] Querying wallet for userId: "same-uuid-here"
[getStellarWallet] Wallet found for userId: "same-uuid-here" publicKey: "G..."
[Login] ✅ Stellar wallet already exists for userId: "same-uuid-here" publicKey: "G..."
```

**✅ PASS**:

- Same `userId` as first login
- Wallet already exists (not creating new one)
- Same `publicKey` as before

**❌ FAIL**:

- Different `userId` than first login
- "No Stellar wallet found" message (should find existing wallet)
- Different `publicKey` than before

## Testing Checklist

### Test 1: First Login/Registration

- [ ] `userId` in console is a UUID (not a username)
- [ ] Wallet is created successfully
- [ ] `publicKey` is present and valid
- [ ] No errors in console

### Test 2: Second Login (Same Passkey)

- [ ] Same `userId` as first login
- [ ] Console shows "Wallet already exists"
- [ ] Same `publicKey` as before
- [ ] No "creating new wallet" message
- [ ] No duplicate wallet creation

### Test 3: Wallet Lookup

- [ ] `getStellarWallet` query finds existing wallet
- [ ] `storeStellarWallet` returns existing wallet (doesn't create duplicate)
- [ ] No errors during wallet lookup

## Common Issues to Watch For

### Issue 1: userId is Username Instead of UUID

**Symptoms**:

- Console shows `userId` as a string like "username" instead of UUID
- Wallet lookup fails or finds wrong wallet

**Fix**: Already applied - always require userId from API

### Issue 2: Duplicate Wallet Creation

**Symptoms**:

- Console shows "creating new wallet" even after first login
- Multiple wallets for same user in database

**Fix**: Already applied - check for existing wallet before creating

### Issue 3: Different userId Each Login

**Symptoms**:

- Different `userId` in console each login
- New wallet created each time

**Fix**: Already applied - use userId from passkey lookup, not username

## Debugging Commands

If you need to check the database directly:

```sql
-- Check all wallets for a user
SELECT * FROM stellar_wallets WHERE user_id = 'user-uuid-here';

-- Check passkeys for a user
SELECT * FROM passkeys WHERE user_id = 'user-uuid-here';

-- Check if user has multiple wallets (should be 0 or 1)
SELECT user_id, COUNT(*) as wallet_count
FROM stellar_wallets
GROUP BY user_id
HAVING COUNT(*) > 1;
```

## Expected Console Output Summary

### ✅ Healthy Flow (Login with Existing Wallet)

1. `[Auth] Stored userId in sessionStorage: "uuid"`
2. `[Login] Found user by passkey credential_id: "uuid"`
3. `[getStellarWallet] Wallet found for userId: "uuid"`
4. `[Login] ✅ Stellar wallet already exists`
5. `[storeStellarWallet] Wallet already exists... NOT creating duplicate`

### ❌ Problematic Flow (Would Create Duplicate)

1. `[Auth] Stored userId in sessionStorage: "username"` ← WRONG (should be UUID)
2. `[Login] No Stellar wallet found` ← Should find existing wallet
3. `[storeStellarWallet] No existing wallet found, creating new wallet` ← Should return existing

## Next Steps After Console Testing

1. Verify console logs match expected flow
2. Check that userId is consistent across logins
3. Verify no duplicate wallet creation
4. Run E2E test on frontend to confirm user experience
