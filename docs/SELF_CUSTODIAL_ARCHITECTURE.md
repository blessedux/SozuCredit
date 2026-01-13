# Self-Custodial Wallet Architecture

## ✅ Current Architecture: Fully Self-Custodial

Sozu Credit implements a **fully self-custodial, permissionless wallet architecture**. Users have complete control over their private keys, which never leave their browser.

---

## 🔐 Key Management

### Private Key Storage
- **Location**: Browser IndexedDB (encrypted)
- **Derivation**: Keys are derived from WebAuthn passkeys client-side
- **Access**: Only accessible by the user's browser
- **Server Access**: ❌ **NEVER** - Private keys never touch the server

### Key Derivation Flow
```
User Passkey → Browser Key Derivation → Private Key (IndexedDB)
                                    ↓
                            Public Key (derived)
                                    ↓
                        Stored in Database (public only)
```

**Files:**
- `lib/storage/browser-keys.ts` - Key derivation and storage
- `lib/storage/indexeddb.ts` - IndexedDB storage implementation
- `lib/webauthn/key-derivation.ts` - Passkey-based key derivation

---

## 💼 Wallet Creation

### Client-Side Wallet Creation
- **Method**: `createRealStellarAccount()` in `lib/stellar/wallet-creator.ts`
- **Process**: 
  1. Derive keypair from passkey (client-side)
  2. Generate Stellar public key
  3. Store public key in database (server only stores public key)
  4. Private key remains in browser IndexedDB

### Server-Side Wallet Creation (Legacy)
- **File**: `lib/stellar/wallet-server.ts`
- **Status**: ⚠️ Legacy code - not used in production
- **Note**: Even this legacy code only stores public keys, never private keys

**Files:**
- `lib/stellar/wallet-creator.ts` - Client-side wallet creation
- `lib/stellar/client-wallet.ts` - Client-side wallet utilities

---

## ✍️ Transaction Signing

### Client-Side Signing
- **Method**: `signTransactionClientSide()` in `lib/stellar/client-signing.ts`
- **Process**:
  1. Retrieve keypair from browser IndexedDB
  2. Sign transaction in browser using Stellar SDK
  3. Return signed transaction XDR
  4. Server submits signed transaction (never sees private key)

### Payment Flow
```
1. User initiates payment
2. Server builds unsigned transaction
3. Client retrieves keypair from IndexedDB
4. Client signs transaction (browser)
5. Client sends signed transaction to server
6. Server submits to Stellar network
```

**Files:**
- `lib/stellar/client-signing.ts` - Client-side transaction signing
- `app/api/wallet/stellar/payment/route.ts` - Payment API (builds unsigned tx)

---

## 🗄️ Database Storage

### What's Stored
- ✅ **Public keys only** - Stellar wallet addresses
- ✅ **User metadata** - Username, profile info
- ✅ **Transaction history** - Public transaction data
- ❌ **Private keys** - NEVER stored

### Database Schema
```sql
stellar_wallets (
  user_id UUID,
  public_key TEXT,  -- Only public key, never private
  network TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

**Files:**
- `lib/turnkey/stellar-wallet.ts` - Database wallet operations
- `scripts/006_add_stellar_wallets.sql` - Database schema

---

## 🔒 Security Guarantees

### Self-Custody Guarantees
1. ✅ **Private keys never leave browser** - All key operations are client-side
2. ✅ **No server-side key access** - Server cannot sign transactions
3. ✅ **User controls keys** - Keys derived from user's passkey
4. ✅ **Permissionless** - No KYC, no account approval needed
5. ✅ **Recoverable** - Keys can be recovered from passkey

### Attack Surface
- **Server compromise**: ✅ Safe - Server has no access to private keys
- **Database breach**: ✅ Safe - Only public keys stored
- **Browser compromise**: ⚠️ Risk - User must protect their device/passkey

---

## 🚀 Permissionless Features

### No Central Authority
- ✅ Users create wallets without approval
- ✅ No KYC requirements
- ✅ No account restrictions
- ✅ Direct Stellar network access

### Decentralized Operations
- ✅ Wallet creation: Client-side
- ✅ Transaction signing: Client-side
- ✅ Network interaction: Direct to Stellar Horizon API
- ✅ No intermediary services for key management

---

## 📋 Architecture Checklist

### ✅ Self-Custodial Requirements
- [x] Private keys stored client-side only
- [x] Keys derived from user passkey
- [x] No server-side key access
- [x] Client-side transaction signing
- [x] Public keys only in database
- [x] Permissionless wallet creation
- [x] Direct Stellar network access

### ✅ Security Requirements
- [x] Encrypted key storage (IndexedDB)
- [x] WebAuthn passkey authentication
- [x] No private key transmission
- [x] Transaction source verification
- [x] Keypair validation before signing

---

## 🔄 Migration from Server-Side (Completed)

### Previous Architecture (Removed)
- ❌ Server-side key generation (Turnkey)
- ❌ Server-side transaction signing
- ❌ Centralized key management

### Current Architecture (Implemented)
- ✅ Client-side key derivation
- ✅ Client-side transaction signing
- ✅ Browser-based key storage
- ✅ Fully self-custodial

---

## 📝 Notes

### Wallet Address Updates
If a user's wallet address needs to be updated in the database (e.g., fixing a mismatch):
- Use `/api/wallet/update-address` endpoint
- Only updates the public key in database
- Does NOT affect private keys (which are in browser)

### Key Recovery
- Keys can be recovered by re-deriving from passkey
- Passkey is stored on user's device
- No server-side recovery needed

### Network Independence
- Works on both testnet and mainnet
- Network selection is user-controlled
- No network restrictions

---

## 🎯 Conclusion

**Sozu Credit is fully self-custodial and permissionless.**

Users have complete control over their private keys, which are:
- Derived client-side from passkeys
- Stored only in the browser
- Never transmitted to servers
- Used only for client-side transaction signing

The server's role is limited to:
- Building unsigned transactions
- Submitting signed transactions
- Storing public keys for recipient resolution
- Managing user profiles and metadata

**No private keys ever touch the server.**
