# Quick Test Guide - Phase 1 & Phase 2

## 🚀 Step-by-Step Testing

### Step 1: Open Browser and DevTools

1. Open your browser (Chrome/Edge recommended)
2. Open DevTools (F12 or Cmd+Option+I)
3. Go to **Console** tab
4. Go to **Application** tab (for checking IndexedDB and sessionStorage)

---

### Step 2: Navigate to Auth Page

1. Go to `http://localhost:3001/auth` (or your dev server URL)
2. You should see the authentication page

---

### Step 3: Test Registration (Phase 1)

1. **Click the fingerprint scan button**
2. **Create a new passkey** when prompted
3. **Enter a username** when prompted (e.g., "testuser123")
4. **Complete passkey creation**

**Watch the Console for:**
```
[Auth] Reg Step 1.5: Generated temporary userId for userHandle: <UUID>
[Auth] Reg Step 3: createPasskey result: Got credential
[Auth] Reg Step 6.5: Deriving Stellar keypair from passkey...
[Key Derivation] ✅ Keypair derived successfully
[Browser Keys] ✅ Encrypted key stored successfully
[Auth] ✅ Credential ID stored in sessionStorage for client-side signing
```

**Verify in Application Tab:**
1. Go to **Application** → **Session Storage** → `http://localhost:3001`
2. Check for:
   - `credential_id` - Should have a long base64 string
   - `stellar_public_key` - Should start with "G"
   - `dev_username` - Should have a UUID
   - `dev_authenticated` - Should be "true"

3. Go to **Application** → **IndexedDB** → `sozu-wallet-db` → `encrypted-keys`
4. Click on the store and verify:
   - At least one entry exists
   - Entry has `credentialId`, `publicKey`, `encryptedSeed`, `iv`

**✅ Success if:** You see all the console logs and data in sessionStorage/IndexedDB

---

### Step 4: Run Browser Console Test

1. Stay on the wallet page (or navigate to `/wallet`)
2. Open **Console** tab
3. Copy and paste this test script:

```javascript
(async () => {
  console.log('🧪 Running Phase 1 & 2 Tests...\n')
  
  // Test 1: Check SessionStorage
  console.log('1️⃣ SessionStorage Check:')
  const credentialId = sessionStorage.getItem('credential_id')
  const publicKey = sessionStorage.getItem('stellar_public_key')
  const userId = sessionStorage.getItem('dev_username')
  
  console.log('   Credential ID:', credentialId ? '✅ ' + credentialId.substring(0, 20) + '...' : '❌ Missing')
  console.log('   Public Key:', publicKey ? '✅ ' + publicKey.substring(0, 10) + '...' : '❌ Missing')
  console.log('   User ID:', userId ? '✅ ' + userId : '❌ Missing')
  
  if (!credentialId || !publicKey || !userId) {
    console.log('\n❌ Missing required values - please authenticate first')
    return
  }
  
  // Test 2: Check IndexedDB
  console.log('\n2️⃣ IndexedDB Check:')
  try {
    const { getAllStoredPublicKeys } = await import('/lib/storage/browser-keys')
    const keys = await getAllStoredPublicKeys()
    console.log('   Stored keys:', keys.length > 0 ? '✅ ' + keys.length : '❌ None')
    if (keys.length > 0) {
      console.log('   First key publicKey:', keys[0].publicKey.substring(0, 10) + '...')
    }
  } catch (error) {
    console.log('   ❌ Error:', error.message)
  }
  
  // Test 3: Verify Key Derivation
  console.log('\n3️⃣ Key Derivation Test:')
  try {
    const { deriveStellarKeypair } = await import('/lib/webauthn/key-derivation')
    const keypair = await deriveStellarKeypair(credentialId, userId)
    const derivedPublicKey = keypair.publicKey()
    const matches = derivedPublicKey === publicKey
    console.log('   Derived public key:', derivedPublicKey.substring(0, 10) + '...')
    console.log('   Matches stored:', matches ? '✅ Yes' : '❌ No')
  } catch (error) {
    console.log('   ❌ Error:', error.message)
  }
  
  // Test 4: Verify Key Retrieval
  console.log('\n4️⃣ Key Retrieval Test:')
  try {
    const { retrieveKeypair } = await import('/lib/storage/browser-keys')
    const keypair = await retrieveKeypair(credentialId)
    if (keypair) {
      console.log('   ✅ Keypair retrieved successfully')
      console.log('   Public key:', keypair.publicKey().substring(0, 10) + '...')
    } else {
      console.log('   ❌ Keypair not found')
    }
  } catch (error) {
    console.log('   ❌ Error:', error.message)
  }
  
  // Test 5: Test Transaction Signing (Phase 2)
  console.log('\n5️⃣ Transaction Signing Test (Phase 2):')
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
    console.log('   ✅ Transaction signed successfully!')
    console.log('   Signature count:', signed.transaction.signatures.length)
    console.log('   XDR length:', signed.transactionXdr.length)
  } catch (error) {
    console.log('   ❌ Error:', error.message)
  }
  
  console.log('\n✅ Tests complete!')
})()
```

**Expected Output:**
- All checks should show ✅
- Key derivation should match stored public key
- Key retrieval should succeed
- Transaction signing should succeed

---

### Step 5: Test Login Flow

1. **Logout** (or clear sessionStorage: `sessionStorage.clear()`)
2. Navigate to `/auth`
3. **Click fingerprint scan button**
4. **Select the same passkey** you created
5. **Complete authentication**

**Watch Console for:**
```
[Auth] ✅ Extracted userId from passkey userHandle: <userId>
[Auth] Step 6.5: Deriving Stellar keypair from passkey...
[Browser Keys] Key already exists, returning existing keypair
```

**Verify:**
- Same public key as registration (deterministic)
- Keys retrieved from IndexedDB (not re-derived)

---

### Step 6: Test Key Consistency

Run this in console after logging in:

```javascript
const publicKey1 = sessionStorage.getItem('stellar_public_key')
console.log('Public Key:', publicKey1)

// Logout and login again, then:
const publicKey2 = sessionStorage.getItem('stellar_public_key')
console.log('Public Key (after re-login):', publicKey2)
console.log('Keys match:', publicKey1 === publicKey2) // Should be true
```

---

## 🐛 Troubleshooting

### Issue: "credential_id not found"

**Solution:**
- Make sure you completed registration/login
- Check console for key derivation logs
- Try logging out and logging in again

### Issue: "Keypair not found in browser storage"

**Solution:**
- Check IndexedDB: Application → IndexedDB → sozu-wallet-db
- If empty, re-authenticate to trigger key derivation
- Check console for errors during key storage

### Issue: "Transaction signing failed"

**Solution:**
- Verify credential ID exists in sessionStorage
- Check if keypair exists in IndexedDB
- Verify public key matches transaction source

---

## ✅ Success Criteria

After completing all tests:

- [x] Keys derived during registration
- [x] Keys stored encrypted in IndexedDB
- [x] Credential ID in sessionStorage
- [x] Same keys derived on login (deterministic)
- [x] Keys retrieved from IndexedDB (not re-derived)
- [x] Transaction signing works client-side
- [x] No server-side key access

---

## 📝 Test Results

Fill this out as you test:

```
Test 1: Registration
- Key Derivation: ✅ / ❌
- Key Storage: ✅ / ❌
- SessionStorage: ✅ / ❌

Test 2: Login
- Key Retrieval: ✅ / ❌
- UserHandle Extraction: ✅ / ❌
- Deterministic Keys: ✅ / ❌

Test 3: Key Consistency
- Same Keys: ✅ / ❌

Test 4: Transaction Signing
- Client-Side Signing: ✅ / ❌
- No Server Access: ✅ / ❌
```

---

**Ready to test!** Follow the steps above and let me know what you find! 🚀
