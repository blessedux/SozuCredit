# Phase 1 & Phase 2 Testing Guide

## 🎯 Testing Overview

This guide helps you test both Phase 1 (Key Derivation) and Phase 2 (Client-Side Signing) together.

---

## ✅ Pre-Testing Checklist

- [ ] Development server running (`npm run dev`)
- [ ] Browser DevTools open (Console tab)
- [ ] IndexedDB accessible (Application tab in DevTools)
- [ ] Testnet Stellar account with XLM (for trustline testing)

---

## 🧪 Test Suite

### Test 1: Complete Registration Flow

**Goal:** Verify key derivation and storage during registration

**Steps:**
1. Navigate to `/auth`
2. Click fingerprint scan button
3. Create a new passkey (register new user)
4. Enter a username when prompted
5. Complete passkey creation

**Expected Console Logs:**
```
[Auth] Reg Step 1.5: Generated temporary userId for userHandle: <UUID>
[Auth] Reg Step 3: createPasskey result: Got credential
[Auth] UserHandle stored in passkey: <userId>
[Auth] Reg Step 6.5: Deriving Stellar keypair from passkey...
[Browser Keys] Deriving and storing key...
[Key Derivation] Deriving key from credential ID...
[Key Derivation] ✅ Keypair derived successfully
[Browser Keys] ✅ Encrypted key stored successfully
[Auth] ✅ Stellar keypair derived and stored after registration
[Auth] ✅ Credential ID stored in sessionStorage for client-side signing
```

**Verify:**
- [ ] Check IndexedDB: `Application` → `IndexedDB` → `sozu-wallet-db` → `encrypted-keys`
  - Should see one entry with your credential ID
  - Should see encrypted seed and public key
- [ ] Check sessionStorage: `Application` → `Session Storage`
  - `credential_id` should contain your credential ID
  - `stellar_public_key` should contain your Stellar public key
  - `dev_username` should contain your userId
  - `dev_authenticated` should be "true"

**Success Criteria:**
- ✅ Keypair derived successfully
- ✅ Keys stored encrypted in IndexedDB
- ✅ Credential ID and public key in sessionStorage
- ✅ User redirected to `/wallet`

---

### Test 2: Complete Login Flow

**Goal:** Verify key retrieval and userHandle extraction during login

**Steps:**
1. Logout (or clear sessionStorage)
2. Navigate to `/auth`
3. Click fingerprint scan button
4. Select the same passkey you created in Test 1
5. Complete authentication

**Expected Console Logs:**
```
[Auth] Step 4: Verifying authentication...
[Auth] ✅ Extracted userId from passkey userHandle: <userId>
[Auth] This enables decentralized authentication - no database lookup needed!
[Auth] Step 6.5: Deriving Stellar keypair from passkey...
[Browser Keys] Key already exists, returning existing keypair
[Auth] ✅ Stellar keypair derived and stored
[Auth] ✅ Credential ID stored in sessionStorage for client-side signing
```

**Verify:**
- [ ] Same public key as Test 1 (deterministic derivation)
- [ ] Keys retrieved from IndexedDB (not re-derived)
- [ ] Credential ID extracted from passkey userHandle
- [ ] SessionStorage populated correctly

**Success Criteria:**
- ✅ Same keys as registration (deterministic)
- ✅ Keys retrieved from storage (not re-derived)
- ✅ UserHandle extracted successfully
- ✅ User authenticated and redirected

---

### Test 3: Key Consistency Verification

**Goal:** Verify deterministic key derivation

**Steps:**
1. Note your public key from Test 1 or 2
2. Clear sessionStorage (keep IndexedDB)
3. Logout
4. Login again with same passkey
5. Check if same public key is derived

**Expected:**
- Same public key should be derived
- Keys should be retrieved from IndexedDB
- No new key derivation needed

**Verify:**
```javascript
// In browser console
const publicKey1 = sessionStorage.getItem('stellar_public_key')
console.log('Public Key 1:', publicKey1)

// After logout/login
const publicKey2 = sessionStorage.getItem('stellar_public_key')
console.log('Public Key 2:', publicKey2)

// Should match
console.log('Keys match:', publicKey1 === publicKey2) // Should be true
```

**Success Criteria:**
- ✅ Same public key derived every time
- ✅ Keys retrieved from IndexedDB when available
- ✅ Deterministic derivation confirmed

---

### Test 4: Client-Side Transaction Signing

**Goal:** Verify transactions are signed client-side

**Prerequisites:**
- DeFindex configured and working
- Account funded with XLM
- USDC trustline created

**Steps:**
1. Login with passkey
2. Navigate to wallet page
3. Attempt a deposit transaction (if DeFindex is configured)
4. Monitor console logs

**Expected Console Logs:**
```
[DeFindex] Signing transaction...
[DeFindex] Found credentialId for client-side signing: <credentialId>...
[Client Signing] Starting client-side transaction signing
[Client Signing] Transaction source (public key): <publicKey>
[Client Signing] Retrieving keypair by credential ID...
[Browser Keys] ✅ Key retrieved and decrypted successfully
[Client Signing] ✅ Keypair retrieved and verified
[Client Signing] Signing transaction...
[Client Signing] ✅ Transaction signed successfully
[Soroban Signing] ✅ Transaction signed client-side (non-custodial)
```

**Verify:**
- [ ] Credential ID found automatically
- [ ] Keypair retrieved from IndexedDB
- [ ] Transaction signed client-side
- [ ] No Turnkey API calls (check Network tab)

**Success Criteria:**
- ✅ Transaction signed client-side
- ✅ No server-side key access
- ✅ Transaction submitted successfully

---

### Test 5: Fallback to Turnkey

**Goal:** Verify graceful fallback when browser keys unavailable

**Steps:**
1. Clear IndexedDB: `Application` → `IndexedDB` → `sozu-wallet-db` → Delete database
2. Clear sessionStorage: `Application` → `Session Storage` → Clear All
3. Attempt a transaction (or wallet operation)
4. Monitor console logs

**Expected Console Logs:**
```
[DeFindex] Signing transaction...
[DeFindex] No credentialId found, will use Turnkey signing
[Soroban Signing] Using Turnkey signing (fallback)...
[Turnkey Soroban Signing] Starting transaction signing...
```

**Verify:**
- [ ] Client-side signing skipped gracefully
- [ ] Falls back to Turnkey signing
- [ ] Transaction still succeeds

**Success Criteria:**
- ✅ Graceful fallback to Turnkey
- ✅ No errors or crashes
- ✅ Transaction succeeds

---

### Test 6: Wallet Creation Client-Side

**Goal:** Verify wallet can be created client-side

**Steps:**
1. Register new user (or use existing)
2. Check if wallet is created automatically
3. Verify public key matches derived keypair

**Expected:**
- Wallet created from passkey credential ID
- Public key matches derived keypair
- No Turnkey wallet creation needed

**Verify:**
```javascript
// In browser console
const { getCurrentCredentialId } = await import('/lib/storage/key-utils')
const { getPublicKey } = await import('/lib/stellar/client-signing')

const credentialId = await getCurrentCredentialId()
const publicKey = await getPublicKey(credentialId)

console.log('Credential ID:', credentialId)
console.log('Public Key:', publicKey)
console.log('Matches sessionStorage:', publicKey === sessionStorage.getItem('stellar_public_key'))
```

**Success Criteria:**
- ✅ Wallet created client-side
- ✅ Public key matches derived keypair
- ✅ No server-side key generation

---

### Test 7: USDC Trustline Creation

**Goal:** Verify trustline can be created client-side

**Prerequisites:**
- Account funded with XLM (minimum 1 XLM for fees)

**Steps:**
1. Login with passkey
2. Navigate to wallet page
3. Click "Establish USDC Trustline" (if available)
4. Monitor console logs

**Expected Console Logs:**
```
[Client Wallet] Creating USDC trustline client-side...
[Client Wallet] Transaction built, signing client-side...
[Client Wallet] Transaction signed, submitting to network...
[Client Wallet] ✅ USDC trustline created successfully
```

**Verify:**
- [ ] Trustline created client-side
- [ ] Transaction signed in browser
- [ ] No Turnkey API calls

**Success Criteria:**
- ✅ Trustline created client-side
- ✅ Transaction signed locally
- ✅ Trustline appears on Stellar network

---

## 🔍 Debugging Commands

### Check IndexedDB Contents
```javascript
// In browser console
const { getAllStoredPublicKeys } = await import('/lib/storage/browser-keys')
const keys = await getAllStoredPublicKeys()
console.table(keys)
```

### Verify Key Derivation
```javascript
// In browser console
const { deriveStellarKeypair } = await import('/lib/webauthn/key-derivation')
const credentialId = sessionStorage.getItem('credential_id')
const userId = sessionStorage.getItem('dev_username')

if (credentialId) {
  const keypair = await deriveStellarKeypair(credentialId, userId)
  console.log('Derived Public Key:', keypair.publicKey())
  console.log('Matches stored:', keypair.publicKey() === sessionStorage.getItem('stellar_public_key'))
}
```

### Test Key Retrieval
```javascript
// In browser console
const { retrieveKeypair } = await import('/lib/storage/browser-keys')
const credentialId = sessionStorage.getItem('credential_id')

if (credentialId) {
  const keypair = await retrieveKeypair(credentialId)
  if (keypair) {
    console.log('✅ Keypair retrieved:', keypair.publicKey())
  } else {
    console.log('❌ Keypair not found')
  }
}
```

### Test Transaction Signing
```javascript
// In browser console
const { TransactionBuilder, Networks, Keypair, BASE_FEE } = await import('@stellar/stellar-sdk')
const { signTransactionClientSide } = await import('/lib/stellar/client-signing')
const { retrieveKeypair } = await import('/lib/storage/browser-keys')

const credentialId = sessionStorage.getItem('credential_id')
const publicKey = sessionStorage.getItem('stellar_public_key')

if (credentialId && publicKey) {
  // Create a test transaction
  const keypair = await retrieveKeypair(credentialId)
  const account = new Account(publicKey, "0")
  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET
  })
    .addOperation(Operation.accountMerge({ destination: publicKey }))
    .setTimeout(30)
    .build()
  
  try {
    const signed = await signTransactionClientSide(transaction, credentialId, publicKey)
    console.log('✅ Transaction signed successfully')
    console.log('Signed XDR length:', signed.transactionXdr.length)
  } catch (error) {
    console.error('❌ Signing failed:', error)
  }
}
```

---

## 🐛 Common Issues & Solutions

### Issue: "Keypair not found in browser storage"

**Cause:** Keys not derived during authentication

**Solution:**
1. Check if credential ID exists in sessionStorage
2. Re-authenticate to trigger key derivation
3. Check IndexedDB for stored keys

---

### Issue: "Credential ID not found"

**Cause:** Credential ID not stored in sessionStorage

**Solution:**
1. Logout and login again
2. Check browser console for key derivation logs
3. Verify credential ID is stored after auth

---

### Issue: "Transaction signing failed"

**Cause:** Keypair mismatch or missing keys

**Solution:**
1. Verify public key matches transaction source
2. Check if keypair exists in IndexedDB
3. Try re-deriving keys from credential ID

---

### Issue: "IndexedDB not available"

**Cause:** Browser doesn't support IndexedDB or privacy mode

**Solution:**
1. Use a modern browser (Chrome, Firefox, Safari)
2. Disable privacy mode
3. Check browser permissions

---

## ✅ Success Checklist

After completing all tests, verify:

- [ ] Keys derived deterministically (same passkey = same keys)
- [ ] Keys stored encrypted in IndexedDB
- [ ] Credential ID stored in sessionStorage
- [ ] Public key matches derived keypair
- [ ] Transactions signed client-side
- [ ] No server-side key access
- [ ] Fallback to Turnkey works
- [ ] Trustline creation works client-side

---

## 📊 Test Results Template

```
Test 1: Registration Flow
- Key Derivation: ✅ / ❌
- Key Storage: ✅ / ❌
- SessionStorage: ✅ / ❌

Test 2: Login Flow
- Key Retrieval: ✅ / ❌
- UserHandle Extraction: ✅ / ❌
- Deterministic Keys: ✅ / ❌

Test 3: Key Consistency
- Same Keys: ✅ / ❌
- Storage Retrieval: ✅ / ❌

Test 4: Client-Side Signing
- Credential ID Found: ✅ / ❌
- Transaction Signed: ✅ / ❌
- No Server Access: ✅ / ❌

Test 5: Turnkey Fallback
- Graceful Fallback: ✅ / ❌
- Transaction Success: ✅ / ❌

Test 6: Wallet Creation
- Client-Side Creation: ✅ / ❌
- Public Key Match: ✅ / ❌

Test 7: Trustline Creation
- Client-Side Creation: ✅ / ❌
- Transaction Success: ✅ / ❌
```

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-06  
**Status:** Ready for Testing ✅
