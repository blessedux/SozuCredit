# Testing Checklist - Phase 1 & Phase 2

## 🎯 Quick Start

1. **Open Browser Console** (F12 → Console tab)
2. **Open Application Tab** (F12 → Application tab)
3. **Navigate to** `http://localhost:3001/auth`

---

## ✅ Test Checklist

### Phase 1: Key Derivation

#### Test 1.1: Registration Flow
- [ ] Navigate to `/auth`
- [ ] Click fingerprint scan button
- [ ] Create new passkey
- [ ] Enter username when prompted
- [ ] **Check Console** for:
  - `[Auth] Reg Step 1.5: Generated temporary userId`
  - `[Key Derivation] ✅ Keypair derived successfully`
  - `[Browser Keys] ✅ Encrypted key stored successfully`
- [ ] **Check SessionStorage** (Application → Session Storage):
  - [ ] `credential_id` exists
  - [ ] `stellar_public_key` exists (starts with "G")
  - [ ] `dev_username` exists (UUID)
  - [ ] `dev_authenticated` is "true"
- [ ] **Check IndexedDB** (Application → IndexedDB → sozu-wallet-db → encrypted-keys):
  - [ ] At least one entry exists
  - [ ] Entry has `credentialId`, `publicKey`, `encryptedSeed`

**Result:** ✅ Pass / ❌ Fail

---

#### Test 1.2: Login Flow
- [ ] Logout or clear sessionStorage
- [ ] Navigate to `/auth`
- [ ] Click fingerprint scan button
- [ ] Select existing passkey
- [ ] **Check Console** for:
  - `[Auth] ✅ Extracted userId from passkey userHandle`
  - `[Browser Keys] Key already exists, returning existing keypair`
- [ ] **Verify** same public key as registration

**Result:** ✅ Pass / ❌ Fail

---

#### Test 1.3: Key Consistency
- [ ] Note public key from Test 1.1
- [ ] Logout and login again
- [ ] **Verify** same public key derived

**Result:** ✅ Pass / ❌ Fail

---

### Phase 2: Client-Side Signing

#### Test 2.1: Credential ID Detection
- [ ] After login, run in console:
```javascript
console.log('Credential ID:', sessionStorage.getItem('credential_id'))
console.log('Public Key:', sessionStorage.getItem('stellar_public_key'))
```
- [ ] **Verify** both values exist

**Result:** ✅ Pass / ❌ Fail

---

#### Test 2.2: Transaction Signing
- [ ] Run this in console:
```javascript
(async () => {
  const credentialId = sessionStorage.getItem('credential_id')
  const publicKey = sessionStorage.getItem('stellar_public_key')
  
  if (!credentialId || !publicKey) {
    console.log('❌ Missing credential ID or public key')
    return
  }
  
  try {
    const { TransactionBuilder, Networks, BASE_FEE, Operation, Account } = await import('@stellar/stellar-sdk')
    const { signTransactionClientSide } = await import('/lib/stellar/client-signing')
    
    const account = new Account(publicKey, "0")
    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET
    })
      .addOperation(Operation.accountMerge({ destination: publicKey }))
      .setTimeout(30)
      .build()
    
    const signed = await signTransactionClientSide(transaction, credentialId, publicKey)
    console.log('✅ Transaction signed!')
    console.log('Signatures:', signed.transaction.signatures.length)
    return { success: true }
  } catch (error) {
    console.error('❌ Error:', error)
    return { success: false, error: error.message }
  }
})()
```
- [ ] **Check Console** for success message
- [ ] **Verify** signature count > 0

**Result:** ✅ Pass / ❌ Fail

---

#### Test 2.3: Key Retrieval
- [ ] Run this in console:
```javascript
(async () => {
  const { retrieveKeypair } = await import('/lib/storage/browser-keys')
  const credentialId = sessionStorage.getItem('credential_id')
  
  if (!credentialId) {
    console.log('❌ No credential ID')
    return
  }
  
  const keypair = await retrieveKeypair(credentialId)
  if (keypair) {
    console.log('✅ Keypair retrieved:', keypair.publicKey().substring(0, 10) + '...')
    return { success: true }
  } else {
    console.log('❌ Keypair not found')
    return { success: false }
  }
})()
```
- [ ] **Verify** keypair retrieved successfully

**Result:** ✅ Pass / ❌ Fail

---

## 📊 Overall Results

### Phase 1 Results
- Test 1.1 (Registration): ✅ / ❌
- Test 1.2 (Login): ✅ / ❌
- Test 1.3 (Consistency): ✅ / ❌

### Phase 2 Results
- Test 2.1 (Credential ID): ✅ / ❌
- Test 2.2 (Signing): ✅ / ❌
- Test 2.3 (Retrieval): ✅ / ❌

---

## 🐛 Issues Found

List any issues encountered:

1. 
2. 
3. 

---

## 📝 Notes

Add any observations or notes here:



