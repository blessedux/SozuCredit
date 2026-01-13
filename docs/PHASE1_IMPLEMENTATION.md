# Phase 1 Implementation: Key Derivation from Passkeys

## ✅ Completed Tasks

### 1. Key Derivation Utility (`lib/webauthn/key-derivation.ts`)

**Created:** HKDF-based key derivation system for deterministic ED25519 keypair generation

**Features:**
- ✅ HKDF implementation using Web Crypto API (RFC 5869 compliant)
- ✅ Deterministic key derivation (same credential ID + userId = same keys)
- ✅ Stellar ED25519 keypair generation from passkey credential IDs
- ✅ Key verification utilities
- ✅ Seed extraction for encrypted storage

**Key Functions:**
- `deriveStellarKeypair(credentialId, userId?)` - Main derivation function
- `verifyKeyDerivation()` - Verify key consistency
- `deriveKeypairWithSeed()` - Derive keypair with seed for storage

**Security:**
- Uses HKDF with SHA-256 for secure key derivation
- Salt: "stellar-wallet-v1" (application context)
- Info: "ed25519-key-derivation" (version identifier)
- 32-byte seed output (ED25519 requirement)

---

### 2. Browser Key Storage (`lib/storage/browser-keys.ts`)

**Created:** Encrypted key storage system using IndexedDB and Web Crypto API

**Features:**
- ✅ AES-GCM encryption for private keys
- ✅ PBKDF2 key derivation for encryption keys (100,000 iterations)
- ✅ IndexedDB persistence
- ✅ Key retrieval and decryption
- ✅ Public key indexing for quick lookup

**Key Functions:**
- `storeEncryptedKey()` - Encrypt and store key
- `retrieveKeypair()` - Decrypt and retrieve keypair
- `deriveAndStoreKey()` - Derive and store in one operation
- `getKeypairByPublicKey()` - Lookup by public key
- `deleteStoredKey()` - Remove stored key

**Security:**
- Private keys encrypted with AES-GCM (256-bit)
- Encryption key derived from credential ID using PBKDF2
- Random IV for each encryption
- Private keys never leave the browser

---

### 3. IndexedDB Wrapper (`lib/storage/indexeddb.ts`)

**Created:** Simple IndexedDB interface for persistent storage

**Features:**
- ✅ Database initialization with schema versioning
- ✅ Object store management (keys, wallets, metadata)
- ✅ Index creation for efficient queries
- ✅ CRUD operations (get, set, remove, getAll)
- ✅ Index-based queries

**Stores:**
- `encrypted-keys` - Encrypted key data (indexed by credentialId, userId, publicKey)
- `wallets` - Wallet metadata (indexed by publicKey, userId)
- `metadata` - General metadata storage

---

### 4. Passkey UserHandle Support (`lib/turnkey/passkeys.ts`)

**Updated:** Passkey creation and authentication to support userHandle

**Changes:**
- ✅ `createPasskey()` now accepts `userId` parameter
- ✅ Stores userId in passkey's `user.id` (becomes userHandle during auth)
- ✅ `getPasskey()` extracts and decodes userHandle from response
- ✅ Returns userHandle as decoded string

**Benefits:**
- Enables decentralized authentication (no database lookup needed)
- User ID embedded in passkey
- Supports future fully decentralized auth

---

### 5. Authentication Flow Updates (`app/auth/page.tsx`)

**Updated:** Registration and login flows to use key derivation

**Registration Flow:**
1. Generate temporary userId (UUID) before passkey creation
2. Create passkey with userId in userHandle
3. Verify registration (creates user on server)
4. Derive and store Stellar keypair from credential ID
5. Store encrypted key in browser

**Login Flow:**
1. Extract userId from passkey userHandle (if available)
2. Verify authentication (fallback to database if needed)
3. Derive and store Stellar keypair from credential ID
4. Store encrypted key in browser

**Key Features:**
- ✅ Automatic key derivation after registration/login
- ✅ Keys stored encrypted in browser (IndexedDB)
- ✅ Public key stored in sessionStorage for quick access
- ✅ Non-blocking (doesn't fail auth if key derivation fails)

---

## 📁 Files Created

1. `lib/webauthn/key-derivation.ts` - Key derivation utilities
2. `lib/storage/indexeddb.ts` - IndexedDB wrapper
3. `lib/storage/browser-keys.ts` - Encrypted key storage

## 📝 Files Modified

1. `lib/turnkey/passkeys.ts` - Added userHandle support
2. `app/auth/page.tsx` - Integrated key derivation into auth flows

---

## 🔐 Security Considerations

### Key Derivation
- ✅ Deterministic (same inputs = same keys)
- ✅ Secure (HKDF with SHA-256)
- ✅ No key material stored in plaintext

### Key Storage
- ✅ Private keys encrypted with AES-GCM
- ✅ Encryption keys derived with PBKDF2 (100k iterations)
- ✅ Random IV for each encryption
- ✅ Keys never sent to server

### Authentication
- ✅ UserHandle stored in passkey (decentralized)
- ✅ Credential ID used for key derivation
- ✅ Fallback to database lookup if userHandle unavailable

---

## 🧪 Testing Checklist

### Key Derivation
- [ ] Test deterministic key derivation (same credential = same keys)
- [ ] Test key derivation with different userIds
- [ ] Test key verification
- [ ] Test seed extraction

### Key Storage
- [ ] Test key encryption/decryption
- [ ] Test key persistence across sessions
- [ ] Test key retrieval by credential ID
- [ ] Test key retrieval by public key
- [ ] Test key deletion

### Authentication
- [ ] Test registration with userId in userHandle
- [ ] Test login with userHandle extraction
- [ ] Test fallback to database lookup
- [ ] Test key derivation after registration
- [ ] Test key derivation after login

### Edge Cases
- [ ] Test with missing userId
- [ ] Test with invalid credential ID
- [ ] Test with corrupted stored keys
- [ ] Test IndexedDB unavailable (fallback)

---

## 🚀 Next Steps (Phase 2)

1. **Client-Side Transaction Signing**
   - Replace Turnkey signing with browser-based signing
   - Use derived keys for transaction signing
   - Submit transactions directly to Horizon

2. **Client-Side Wallet Creation**
   - Move wallet creation to browser
   - Create Stellar account directly
   - Remove Turnkey dependency

3. **Automatic Trustline Creation**
   - Create USDC trustline during wallet creation
   - Handle account funding requirements
   - Test on mainnet

---

## 📊 Current Status

**Phase 1:** ✅ **COMPLETED**

- Key derivation: ✅ Implemented
- Browser storage: ✅ Implemented
- UserHandle support: ✅ Implemented
- Auth flow integration: ✅ Implemented

**Ready for:** Phase 2 (Client-Side Transaction Signing)

---

## 🔍 Known Limitations

1. **Temporary userId in Registration**
   - Currently generates UUID client-side before passkey creation
   - Server creates actual user during verification
   - Future: Server should return userId before passkey creation

2. **Database Fallback**
   - Still uses database lookup for authentication
   - UserHandle extraction is primary, database is fallback
   - Future: Fully remove database dependency

3. **Key Recovery**
   - Keys can be re-derived from passkey (deterministic)
   - But requires passkey to be available
   - Future: Add backup/recovery mechanism

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-06  
**Status:** Phase 1 Complete ✅
