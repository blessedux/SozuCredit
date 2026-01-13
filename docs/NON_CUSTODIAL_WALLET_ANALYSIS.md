# Non-Custodial Wallet Infrastructure Analysis

## Executive Summary

This document analyzes the current wallet infrastructure and outlines the requirements to achieve a **truly non-custodial, decentralized wallet** with:
- ✅ Non-custodial key management (users control their keys)
- ✅ No server-side key storage
- ✅ Decentralized passkey authentication
- ✅ Mainnet wallet creation
- ✅ Automatic USDC trustline creation

---

## 🔍 Current Infrastructure Analysis

### 1. **Key Management (Current: Custodial)**

**Current State:**
- ✅ Uses **Turnkey** for key generation and storage
- ✅ Private keys stored in Turnkey's infrastructure (custodial)
- ✅ Only public keys stored in Supabase database
- ✅ Transaction signing requires Turnkey API calls

**Architecture:**
```
User → Passkey Auth → Supabase User ID → Turnkey Wallet ID → Private Key (in Turnkey)
                                                              ↓
                                                         Public Key (in Supabase)
```

**Files:**
- `lib/turnkey/stellar-wallet.ts` - Wallet creation via Turnkey
- `lib/turnkey/soroban-signing.ts` - Transaction signing via Turnkey
- `lib/turnkey/config.ts` - Turnkey configuration

**Issues:**
- ❌ Keys are custodial (stored in Turnkey)
- ❌ Requires Turnkey API for every transaction
- ❌ Single point of failure (Turnkey infrastructure)
- ❌ Not truly decentralized

---

### 2. **Authentication (Current: Centralized)**

**Current State:**
- ✅ Uses **WebAuthn/Passkeys** for authentication
- ✅ Passkey credentials stored in **Supabase database**
- ✅ Credential IDs stored server-side for lookup
- ✅ Requires database query to authenticate

**Architecture:**
```
Browser → Passkey → Credential ID → Supabase Database Lookup → User ID
```

**Files:**
- `app/api/auth/login/verify/route.ts` - Login verification
- `app/api/auth/register/verify/route.ts` - Registration
- `lib/turnkey/passkeys.ts` - Passkey utilities
- `scripts/004_add_passkeys.sql` - Database schema

**Issues:**
- ❌ Centralized credential storage
- ❌ Requires database for authentication
- ❌ Not truly decentralized

---

### 3. **Wallet Creation (Current: Server-Side)**

**Current State:**
- ✅ Wallet created server-side via Turnkey API
- ✅ Public key derived from Turnkey private key
- ✅ Wallet stored in Supabase after creation
- ✅ Supports testnet/mainnet (configurable)

**Flow:**
```
1. User registers passkey
2. Server creates Turnkey wallet
3. Server derives Stellar public key
4. Server stores public key in Supabase
5. User receives public key
```

**Files:**
- `app/api/wallet/stellar/create/route.ts` - Wallet creation API
- `lib/turnkey/stellar-wallet.ts` - `createStellarWallet()` function

**Issues:**
- ❌ Server-side key generation
- ❌ Requires Turnkey API
- ❌ Not user-controlled

---

### 4. **USDC Trustline (Current: Manual)**

**Current State:**
- ✅ Trustline creation function exists
- ✅ Requires account to be funded first
- ✅ Manual trigger via API call
- ✅ Uses Turnkey for signing

**Flow:**
```
1. User funds account with XLM
2. User calls trustline API
3. Server builds transaction
4. Turnkey signs transaction
5. Transaction submitted to Stellar
```

**Files:**
- `lib/turnkey/stellar-wallet.ts` - `createUSDCTrustline()` function
- `app/api/wallet/stellar/trustline/route.ts` - Trustline API

**Issues:**
- ❌ Not automatic during wallet creation
- ❌ Requires account funding first
- ❌ Requires Turnkey for signing

---

## 🎯 Target Architecture: Non-Custodial & Decentralized

### 1. **Key Management (Target: Non-Custodial)**

**Target State:**
- ✅ Keys derived from passkey client-side
- ✅ Private keys stored only in browser (IndexedDB/Web Crypto API)
- ✅ No server-side key storage
- ✅ Direct transaction signing in browser

**Architecture:**
```
User → Passkey → Browser Key Derivation → Private Key (browser only)
                                          ↓
                                     Public Key (derived)
```

**Requirements:**
1. **Key Derivation from Passkey**
   - Use WebAuthn credential ID as seed
   - Derive ED25519 key pair using HKDF or similar
   - Store encrypted private key in browser only

2. **Browser Storage**
   - Use IndexedDB for encrypted key storage
   - Use Web Crypto API for encryption/decryption
   - Never send private keys to server

3. **Transaction Signing**
   - Sign transactions client-side
   - Use Stellar SDK directly in browser
   - Submit signed transactions to Horizon

---

### 2. **Authentication (Target: Decentralized)**

**Target State:**
- ✅ Passkey authentication without database lookup
- ✅ UserHandle (user ID) embedded in passkey
- ✅ Credential ID used for key derivation
- ✅ No server-side credential storage needed

**Architecture:**
```
Browser → Passkey → Extract UserHandle → User ID (no DB lookup)
                  → Extract Credential ID → Derive Keys
```

**Requirements:**
1. **UserHandle in Passkey**
   - Store user ID in passkey's `userHandle` during registration
   - Extract user ID from passkey during authentication
   - No database lookup needed

2. **Credential ID for Key Derivation**
   - Use credential ID as seed for key derivation
   - Same credential ID = same keys
   - Deterministic key generation

3. **Optional: On-Chain Credential Registry**
   - Store credential metadata on Stellar (optional)
   - Use Soroban smart contract for credential registry
   - Fully decentralized credential verification

---

### 3. **Wallet Creation (Target: Client-Side)**

**Target State:**
- ✅ Wallet created client-side from passkey
- ✅ No server-side key generation
- ✅ Automatic public key derivation
- ✅ Mainnet support enabled

**Flow:**
```
1. User registers passkey
2. Browser derives keys from passkey
3. Browser derives Stellar public key
4. Browser creates account on Stellar (if needed)
5. Browser creates USDC trustline automatically
6. Optional: Store public key on-chain (Soroban)
```

**Requirements:**
1. **Client-Side Key Derivation**
   - Derive ED25519 key from passkey credential ID
   - Use deterministic key derivation (HKDF)
   - Same passkey = same keys (deterministic)

2. **Account Creation**
   - Use Stellar SDK in browser
   - Create account transaction
   - Fund with minimum XLM (user provides or faucet)

3. **Automatic Trustline**
   - Create trustline immediately after account creation
   - Include in same transaction batch if possible
   - No manual trigger needed

---

### 4. **USDC Trustline (Target: Automatic)**

**Target State:**
- ✅ Created automatically during wallet creation
- ✅ Part of initial account setup
- ✅ No manual trigger needed
- ✅ Works on mainnet

**Flow:**
```
Wallet Creation → Account Creation → USDC Trustline Creation → Done
```

**Requirements:**
1. **Automatic Creation**
   - Include trustline in wallet creation flow
   - Create as part of account initialization
   - Handle errors gracefully

2. **Mainnet Support**
   - Use mainnet USDC issuer
   - Support mainnet Horizon endpoint
   - Test thoroughly before deployment

---

## 📋 Implementation Roadmap

### Phase 1: Key Derivation from Passkeys (Week 1-2)

**Goal:** Derive Stellar keys from passkey credential IDs client-side

**Tasks:**
1. ✅ Create key derivation utility (`lib/webauthn/key-derivation.ts`)
   - Use HKDF to derive ED25519 keys from credential ID
   - Ensure deterministic derivation (same credential = same keys)
   - Test key derivation consistency

2. ✅ Implement browser key storage (`lib/storage/browser-keys.ts`)
   - Use IndexedDB for encrypted key storage
   - Use Web Crypto API for encryption
   - Implement key retrieval and decryption

3. ✅ Update passkey registration to store userHandle
   - Store user ID in passkey's userHandle during registration
   - Extract user ID from passkey during authentication
   - Remove database credential lookup dependency

**Files to Create:**
- `lib/webauthn/key-derivation.ts`
- `lib/storage/browser-keys.ts`
- `lib/storage/indexeddb.ts`

**Files to Modify:**
- `lib/turnkey/passkeys.ts` - Add userHandle support
- `app/api/auth/register/verify/route.ts` - Store userHandle in passkey
- `app/api/auth/login/verify/route.ts` - Extract userHandle from passkey

---

### Phase 2: Client-Side Transaction Signing (Week 2-3)

**Goal:** Sign transactions client-side without Turnkey

**Tasks:**
1. ✅ Create client-side signing utility (`lib/stellar/client-signing.ts`)
   - Use Stellar SDK in browser
   - Sign transactions with derived keys
   - Submit signed transactions to Horizon

2. ✅ Replace Turnkey signing with client-side signing
   - Update `signSorobanTransaction()` to use browser keys
   - Remove Turnkey dependency for signing
   - Test transaction signing and submission

3. ✅ Update wallet creation to be client-side
   - Move wallet creation to browser
   - Derive keys from passkey
   - Create account on Stellar directly

**Files to Create:**
- `lib/stellar/client-signing.ts`
- `lib/stellar/wallet-creation.ts`

**Files to Modify:**
- `lib/turnkey/soroban-signing.ts` - Replace with client-side signing
- `app/api/wallet/stellar/create/route.ts` - Move to client-side
- `lib/turnkey/stellar-wallet.ts` - Update to use browser keys

---

### Phase 3: Automatic Trustline Creation (Week 3-4)

**Goal:** Automatically create USDC trustline during wallet creation

**Tasks:**
1. ✅ Integrate trustline creation into wallet creation flow
   - Create trustline immediately after account creation
   - Handle account funding requirements
   - Test on testnet first

2. ✅ Add mainnet support
   - Update USDC issuer addresses for mainnet
   - Test mainnet wallet creation
   - Ensure proper network configuration

3. ✅ Handle edge cases
   - Account already exists
   - Trustline already exists
   - Insufficient XLM for fees

**Files to Modify:**
- `lib/stellar/wallet-creation.ts` - Add trustline creation
- `lib/turnkey/stellar-wallet.ts` - Update USDC issuer config
- `lib/turnkey/config.ts` - Add mainnet configuration

---

### Phase 4: Decentralized Authentication (Week 4-5)

**Goal:** Remove database dependency for authentication

**Tasks:**
1. ✅ Update passkey registration to use userHandle
   - Store user ID in passkey userHandle
   - Remove credential storage in database
   - Test passkey persistence

2. ✅ Update authentication to extract userHandle
   - Extract user ID from passkey userHandle
   - Remove database credential lookup
   - Test authentication flow

3. ✅ Optional: On-chain credential registry
   - Create Soroban contract for credential registry
   - Store credential metadata on-chain
   - Verify credentials on-chain

**Files to Modify:**
- `app/api/auth/register/verify/route.ts` - Remove credential storage
- `app/api/auth/login/verify/route.ts` - Extract userHandle
- `lib/turnkey/passkeys.ts` - Update passkey creation/verification

**Files to Create (Optional):**
- `contracts/credential-registry.soroban` - On-chain credential registry

---

### Phase 5: Migration & Testing (Week 5-6)

**Goal:** Migrate existing users and test thoroughly

**Tasks:**
1. ✅ Create migration script
   - Migrate existing Turnkey wallets to browser keys
   - Preserve user data and balances
   - Test migration process

2. ✅ Comprehensive testing
   - Test wallet creation on testnet
   - Test wallet creation on mainnet
   - Test transaction signing
   - Test trustline creation
   - Test authentication flow

3. ✅ Documentation
   - Update user documentation
   - Create developer guide
   - Document migration process

**Files to Create:**
- `scripts/migrate-to-non-custodial.ts`
- `docs/MIGRATION_GUIDE.md`
- `docs/NON_CUSTODIAL_USER_GUIDE.md`

---

## 🔧 Technical Requirements

### 1. **Key Derivation Algorithm**

```typescript
// Pseudo-code for key derivation
function deriveStellarKey(credentialId: string, userId: string): Keypair {
  // Use HKDF to derive deterministic key
  const seed = HKDF(
    credentialId + userId,  // Input key material
    "stellar-wallet-v1",     // Salt/context
    32                       // Output length (ED25519)
  )
  
  // Create Stellar keypair from seed
  return Keypair.fromRawEd25519Seed(seed)
}
```

**Requirements:**
- Deterministic (same inputs = same keys)
- Secure (use HKDF or similar)
- Compatible with Stellar ED25519

---

### 2. **Browser Storage**

```typescript
// Encrypted key storage
interface EncryptedKey {
  encryptedPrivateKey: string  // Encrypted with Web Crypto API
  publicKey: string           // Stored in plaintext
  credentialId: string        // For key derivation verification
  userId: string              // User identifier
}
```

**Requirements:**
- Use IndexedDB for persistence
- Encrypt private keys with Web Crypto API
- Never send private keys to server
- Support key recovery from passkey

---

### 3. **Transaction Signing**

```typescript
// Client-side transaction signing
async function signTransaction(
  transaction: Transaction,
  keypair: Keypair
): Promise<Transaction> {
  // Sign transaction with keypair
  transaction.sign(keypair)
  return transaction
}
```

**Requirements:**
- Use Stellar SDK in browser
- Sign transactions client-side
- Submit to Horizon directly
- Handle network errors gracefully

---

### 4. **Passkey UserHandle**

```typescript
// Store user ID in passkey userHandle
const userHandle = new TextEncoder().encode(userId)

// During registration
const credential = await navigator.credentials.create({
  publicKey: {
    user: {
      id: userHandle,
      name: username,
      displayName: username
    },
    // ... other options
  }
})

// During authentication
const credential = await navigator.credentials.get({
  publicKey: {
    // ... options
  }
})
const userId = new TextDecoder().decode(credential.response.userHandle)
```

**Requirements:**
- Store user ID in userHandle during registration
- Extract user ID from userHandle during authentication
- No database lookup needed

---

## 🚨 Migration Considerations

### 1. **Existing Users**

**Challenge:** Existing users have Turnkey wallets

**Solution:**
- Provide migration path to export keys (if Turnkey supports)
- Or create new browser-based wallet and transfer funds
- Preserve user data and balances

### 2. **Key Recovery**

**Challenge:** Users lose access to browser storage

**Solution:**
- Keys can be re-derived from passkey (deterministic)
- As long as user has passkey, keys can be recovered
- No need for backup/recovery phrases

### 3. **Backward Compatibility**

**Challenge:** Support both old and new wallet systems

**Solution:**
- Detect wallet type (Turnkey vs browser)
- Support both during transition period
- Migrate users gradually

---

## ✅ Success Criteria

### Non-Custodial
- [ ] Private keys never leave user's browser
- [ ] No server-side key storage
- [ ] Users control their keys completely

### Decentralized Authentication
- [ ] No database lookup for authentication
- [ ] UserHandle contains user ID
- [ ] Credential ID used for key derivation

### Mainnet Support
- [ ] Wallet creation works on mainnet
- [ ] USDC trustline created automatically
- [ ] All features work on mainnet

### Automatic Trustline
- [ ] Trustline created during wallet creation
- [ ] No manual trigger needed
- [ ] Handles edge cases gracefully

---

## 📚 References

- [Stellar SDK Documentation](https://developers.stellar.org/docs)
- [WebAuthn Specification](https://www.w3.org/TR/webauthn-2/)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [HKDF Algorithm](https://datatracker.ietf.org/doc/html/rfc5869)
- [Stellar Account Creation](https://developers.stellar.org/docs/encyclopedia/account-lifecycle)

---

## 🎯 Next Steps

1. **Review this analysis** with the team
2. **Prioritize phases** based on business needs
3. **Start Phase 1** (Key Derivation)
4. **Test thoroughly** before mainnet deployment
5. **Plan migration** for existing users

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-06  
**Author:** Infrastructure Analysis
