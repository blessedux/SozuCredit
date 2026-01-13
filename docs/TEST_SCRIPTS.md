# Test Scripts for Browser Console

Copy and paste these scripts into your browser console to test Phase 1 & Phase 2.

---

## Test 1: Check Key Storage

```javascript
// Check if keys are stored in IndexedDB
(async () => {
  const { getAllStoredPublicKeys } = await import('/lib/storage/browser-keys')
  const keys = await getAllStoredPublicKeys()
  console.log('📦 Stored Keys:', keys)
  console.log('✅ Key count:', keys.length)
  return keys
})()
```

**Expected:** Array with at least one key object containing credentialId, publicKey, and userId

---

## Test 2: Verify Credential ID

```javascript
// Check credential ID in sessionStorage
const credentialId = sessionStorage.getItem('credential_id')
const publicKey = sessionStorage.getItem('stellar_public_key')
const userId = sessionStorage.getItem('dev_username')

console.log('🔑 Credential ID:', credentialId ? credentialId.substring(0, 20) + '...' : 'NOT FOUND')
console.log('🌐 Public Key:', publicKey ? publicKey.substring(0, 10) + '...' : 'NOT FOUND')
console.log('👤 User ID:', userId || 'NOT FOUND')

if (credentialId && publicKey && userId) {
  console.log('✅ All required values found!')
} else {
  console.log('❌ Missing values - please authenticate first')
}
```

---

## Test 3: Verify Key Derivation

```javascript
// Verify keys can be derived from credential ID
(async () => {
  const credentialId = sessionStorage.getItem('credential_id')
  const userId = sessionStorage.getItem('dev_username')
  const storedPublicKey = sessionStorage.getItem('stellar_public_key')
  
  if (!credentialId) {
    console.log('❌ No credential ID found - please authenticate first')
    return
  }
  
  try {
    const { deriveStellarKeypair } = await import('/lib/webauthn/key-derivation')
    const keypair = await deriveStellarKeypair(credentialId, userId)
    const derivedPublicKey = keypair.publicKey()
    
    console.log('🔑 Derived Public Key:', derivedPublicKey.substring(0, 10) + '...')
    console.log('📦 Stored Public Key:', storedPublicKey ? storedPublicKey.substring(0, 10) + '...' : 'NOT FOUND')
    
    if (storedPublicKey && derivedPublicKey === storedPublicKey) {
      console.log('✅ Keys match! Deterministic derivation confirmed')
    } else {
      console.log('⚠️ Keys do not match - this might be expected if stored key is from different credential')
    }
    
    return { derivedPublicKey, matches: derivedPublicKey === storedPublicKey }
  } catch (error) {
    console.error('❌ Key derivation failed:', error)
    return null
  }
})()
```

---

## Test 4: Verify Key Retrieval

```javascript
// Test retrieving keys from IndexedDB
(async () => {
  const credentialId = sessionStorage.getItem('credential_id')
  
  if (!credentialId) {
    console.log('❌ No credential ID found - please authenticate first')
    return
  }
  
  try {
    const { retrieveKeypair } = await import('/lib/storage/browser-keys')
    const keypair = await retrieveKeypair(credentialId)
    
    if (keypair) {
      const publicKey = keypair.publicKey()
      console.log('✅ Keypair retrieved successfully')
      console.log('🔑 Public Key:', publicKey.substring(0, 10) + '...')
      console.log('📦 Matches sessionStorage:', publicKey === sessionStorage.getItem('stellar_public_key'))
      return { success: true, publicKey }
    } else {
      console.log('❌ Keypair not found in IndexedDB')
      return { success: false }
    }
  } catch (error) {
    console.error('❌ Key retrieval failed:', error)
    return { success: false, error }
  }
})()
```

---

## Test 5: Test Transaction Signing

```javascript
// Test signing a transaction client-side
(async () => {
  const credentialId = sessionStorage.getItem('credential_id')
  const publicKey = sessionStorage.getItem('stellar_public_key')
  
  if (!credentialId || !publicKey) {
    console.log('❌ Missing credential ID or public key - please authenticate first')
    return
  }
  
  try {
    const { TransactionBuilder, Networks, Keypair, BASE_FEE, Operation, Account } = await import('@stellar/stellar-sdk')
    const { signTransactionClientSide } = await import('/lib/stellar/client-signing')
    const { retrieveKeypair } = await import('/lib/storage/browser-keys')
    
    // Get keypair
    const keypair = await retrieveKeypair(credentialId)
    if (!keypair) {
      throw new Error('Keypair not found')
    }
    
    // Create a simple test transaction (account merge with self - safe operation)
    const account = new Account(publicKey, "0")
    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET
    })
      .addOperation(Operation.accountMerge({ destination: publicKey }))
      .setTimeout(30)
      .build()
    
    console.log('📝 Transaction created')
    console.log('🔑 Source:', transaction.source)
    
    // Sign transaction
    const signed = await signTransactionClientSide(transaction, credentialId, publicKey)
    
    console.log('✅ Transaction signed successfully!')
    console.log('📄 Signed XDR length:', signed.transactionXdr.length)
    console.log('🔐 Signature count:', signed.transaction.signatures.length)
    
    return { success: true, signedXdr: signed.transactionXdr.substring(0, 100) + '...' }
  } catch (error) {
    console.error('❌ Transaction signing failed:', error)
    return { success: false, error: error.message }
  }
})()
```

---

## Test 6: Verify UserHandle Extraction

```javascript
// Check if userHandle is stored in passkey
(async () => {
  // This test requires you to be on the auth page or have just authenticated
  console.log('📋 SessionStorage Check:')
  console.log('  credential_id:', sessionStorage.getItem('credential_id') ? '✅ Found' : '❌ Missing')
  console.log('  stellar_public_key:', sessionStorage.getItem('stellar_public_key') ? '✅ Found' : '❌ Missing')
  console.log('  dev_username:', sessionStorage.getItem('dev_username') ? '✅ Found' : '❌ Missing')
  console.log('  dev_authenticated:', sessionStorage.getItem('dev_authenticated'))
  
  // Check IndexedDB
  try {
    const { getAllStoredPublicKeys } = await import('/lib/storage/browser-keys')
    const keys = await getAllStoredPublicKeys()
    console.log('\n📦 IndexedDB Check:')
    console.log('  Stored keys:', keys.length)
    if (keys.length > 0) {
      console.log('  First key userId:', keys[0].userId)
      console.log('  First key publicKey:', keys[0].publicKey.substring(0, 10) + '...')
    }
  } catch (error) {
    console.error('❌ IndexedDB check failed:', error)
  }
})()
```

---

## Test 7: Complete System Check

```javascript
// Run all checks at once
(async () => {
  console.log('🧪 Phase 1 & Phase 2 System Check\n')
  
  const results = {
    sessionStorage: {},
    indexedDB: {},
    keyDerivation: {},
    keyRetrieval: {},
    transactionSigning: {}
  }
  
  // 1. Check SessionStorage
  console.log('1️⃣ Checking SessionStorage...')
  results.sessionStorage.credentialId = !!sessionStorage.getItem('credential_id')
  results.sessionStorage.publicKey = !!sessionStorage.getItem('stellar_public_key')
  results.sessionStorage.userId = !!sessionStorage.getItem('dev_username')
  results.sessionStorage.authenticated = sessionStorage.getItem('dev_authenticated') === 'true'
  console.log('   ✅ Credential ID:', results.sessionStorage.credentialId ? 'Found' : 'Missing')
  console.log('   ✅ Public Key:', results.sessionStorage.publicKey ? 'Found' : 'Missing')
  console.log('   ✅ User ID:', results.sessionStorage.userId ? 'Found' : 'Missing')
  console.log('   ✅ Authenticated:', results.sessionStorage.authenticated ? 'Yes' : 'No')
  
  // 2. Check IndexedDB
  console.log('\n2️⃣ Checking IndexedDB...')
  try {
    const { getAllStoredPublicKeys } = await import('/lib/storage/browser-keys')
    const keys = await getAllStoredPublicKeys()
    results.indexedDB.keyCount = keys.length
    results.indexedDB.hasKeys = keys.length > 0
    console.log('   ✅ Stored keys:', keys.length)
    if (keys.length > 0) {
      console.log('   ✅ First key credentialId:', keys[0].credentialId.substring(0, 20) + '...')
      console.log('   ✅ First key publicKey:', keys[0].publicKey.substring(0, 10) + '...')
    }
  } catch (error) {
    results.indexedDB.error = error.message
    console.log('   ❌ Error:', error.message)
  }
  
  // 3. Test Key Derivation
  console.log('\n3️⃣ Testing Key Derivation...')
  const credentialId = sessionStorage.getItem('credential_id')
  const userId = sessionStorage.getItem('dev_username')
  if (credentialId) {
    try {
      const { deriveStellarKeypair } = await import('/lib/webauthn/key-derivation')
      const keypair = await deriveStellarKeypair(credentialId, userId)
      results.keyDerivation.success = true
      results.keyDerivation.publicKey = keypair.publicKey()
      console.log('   ✅ Key derivation successful')
      console.log('   ✅ Derived public key:', keypair.publicKey().substring(0, 10) + '...')
    } catch (error) {
      results.keyDerivation.error = error.message
      console.log('   ❌ Key derivation failed:', error.message)
    }
  } else {
    console.log('   ⚠️ Skipped - no credential ID')
  }
  
  // 4. Test Key Retrieval
  console.log('\n4️⃣ Testing Key Retrieval...')
  if (credentialId) {
    try {
      const { retrieveKeypair } = await import('/lib/storage/browser-keys')
      const keypair = await retrieveKeypair(credentialId)
      results.keyRetrieval.success = !!keypair
      if (keypair) {
        results.keyRetrieval.publicKey = keypair.publicKey()
        console.log('   ✅ Key retrieval successful')
        console.log('   ✅ Retrieved public key:', keypair.publicKey().substring(0, 10) + '...')
      } else {
        console.log('   ❌ Keypair not found')
      }
    } catch (error) {
      results.keyRetrieval.error = error.message
      console.log('   ❌ Key retrieval failed:', error.message)
    }
  } else {
    console.log('   ⚠️ Skipped - no credential ID')
  }
  
  // 5. Test Transaction Signing
  console.log('\n5️⃣ Testing Transaction Signing...')
  const publicKey = sessionStorage.getItem('stellar_public_key')
  if (credentialId && publicKey) {
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
      results.transactionSigning.success = true
      results.transactionSigning.signatureCount = signed.transaction.signatures.length
      console.log('   ✅ Transaction signing successful')
      console.log('   ✅ Signature count:', signed.transaction.signatures.length)
    } catch (error) {
      results.transactionSigning.error = error.message
      console.log('   ❌ Transaction signing failed:', error.message)
    }
  } else {
    console.log('   ⚠️ Skipped - missing credential ID or public key')
  }
  
  // Summary
  console.log('\n📊 Test Summary:')
  console.log('   SessionStorage:', results.sessionStorage.authenticated ? '✅' : '❌')
  console.log('   IndexedDB:', results.indexedDB.hasKeys ? '✅' : '❌')
  console.log('   Key Derivation:', results.keyDerivation.success ? '✅' : '❌')
  console.log('   Key Retrieval:', results.keyRetrieval.success ? '✅' : '❌')
  console.log('   Transaction Signing:', results.transactionSigning.success ? '✅' : '❌')
  
  return results
})()
```

---

## Quick Verification

Run this single command to check everything:

```javascript
(async () => {
  const checks = {
    credentialId: !!sessionStorage.getItem('credential_id'),
    publicKey: !!sessionStorage.getItem('stellar_public_key'),
    userId: !!sessionStorage.getItem('dev_username'),
    authenticated: sessionStorage.getItem('dev_authenticated') === 'true'
  }
  
  try {
    const { getAllStoredPublicKeys } = await import('/lib/storage/browser-keys')
    const keys = await getAllStoredPublicKeys()
    checks.indexedDBKeys = keys.length > 0
    
    if (keys.length > 0 && checks.credentialId) {
      const { retrieveKeypair } = await import('/lib/storage/browser-keys')
      const keypair = await retrieveKeypair(sessionStorage.getItem('credential_id'))
      checks.keyRetrieval = !!keypair
    }
  } catch (e) {
    checks.indexedDBKeys = false
  }
  
  const allPassed = Object.values(checks).every(v => v === true)
  console.log('🧪 Quick Check Results:', checks)
  console.log(allPassed ? '✅ All checks passed!' : '❌ Some checks failed')
  return checks
})()
```
