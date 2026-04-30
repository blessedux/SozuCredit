# Passkey and Wallet Security: Is This Custodial?

## Short Answer: **NO, this is fully non-custodial** ✅

Even though you can see the `passkeys` and `users` tables in your database, you **cannot** access user accounts or sign transactions on their behalf. Here's why:

---

## 🔐 Passkey Security (WebAuthn)

### What's Stored in the Database

The `passkeys` table stores:
- ✅ **`credential_id`** - Public identifier (like a username for the passkey)
- ✅ **`public_key`** - The public key (this is PUBLIC by design - meant to be shared)
- ✅ **`counter`** - For replay attack prevention
- ✅ **`user_id`** - Links to the user account
- ❌ **`private_key`** - **NEVER stored** - stays on user's device

### What's NOT Stored (Critical!)

- ❌ **Private key** - Never leaves the user's device
- ❌ **Secret seed** - Never stored on server
- ❌ **Any cryptographic material that can sign transactions**

### How Authentication Works

1. **Server generates a challenge** (random number)
2. **User's device signs the challenge** with the PRIVATE KEY (never leaves device)
3. **Server verifies the signature** using the stored PUBLIC KEY
4. **If signature is valid** → user is authenticated

### Can You Access User Accounts?

**NO** - Even with full database access, you cannot:
- ❌ Sign in as another user (need their private key)
- ❌ Authenticate on their behalf (need their device/passkey)
- ❌ Access their account (need their passkey to sign challenges)

**What you CAN see:**
- ✅ Which users have accounts (metadata)
- ✅ Which passkeys belong to which users (public info)
- ✅ Public keys (by design, these are meant to be public)

---

## 💼 Wallet Security (Stellar Keys)

### What's Stored in the Database

The `stellar_wallets` table stores:
- ✅ **`public_key`** - Stellar wallet address (public)
- ✅ **`user_id`** - Links to user account
- ✅ **`network`** - testnet/mainnet
- ❌ **`private_key`** - **NEVER stored**
- ❌ **`secret_key`** - **NEVER stored**

### Where Private Keys Are Stored

**Browser IndexedDB (encrypted, client-side only):**
- Private keys are encrypted with AES-GCM
- Encryption key derived from passkey credential ID
- Stored locally in user's browser
- **Never sent to server**
- **Never stored in database**

### Key Derivation Flow (fully client-side)

- **Wallet creation**: Keys are **only** derived in the browser from the user's passkey. The server **never** generates or sees secret keys.
- The server only stores the **public key** after the client sends it (e.g. after login or "Create wallet"). There is no server-side key generation.

```
User Passkey (device)
    ↓
Browser derives Stellar keypair (client-side only)
    ↓
Private Key → Encrypted → IndexedDB (browser only)
Public Key → Client sends to server → Database (server stores public key only)
```

### Who Can See the Secret Key?

- **Only the signed-in user, in their browser.** The secret key is never sent to the server. It is decrypted from IndexedDB only when the user clicks "Show secret key" in the wallet profile, and only if the same device has the passkey credential and session (credential ID in sessionStorage). No API can return the secret key; it exists only in the client.

### Can You Sign Transactions?

**NO** - Even with full database access, you cannot:
- ❌ Sign Stellar transactions (need private key from user's browser)
- ❌ Access user funds (need their encrypted key from IndexedDB)
- ❌ Move user assets (need their passkey to decrypt keys)

**What you CAN see:**
- ✅ Public wallet addresses (meant to be public)
- ✅ Transaction history (public blockchain data)
- ✅ Which wallets belong to which users (metadata)

---

## 🛡️ Security Guarantees

### Non-Custodial Guarantees

1. ✅ **Private keys never leave browser** - All key operations are client-side
2. ✅ **No server-side key access** - Server cannot sign transactions
3. ✅ **User controls keys** - Keys derived from user's passkey
4. ✅ **Database breach safe** - Only public keys stored
5. ✅ **Server compromise safe** - Server has no access to private keys

### Attack Scenarios

| Attack Vector | Risk Level | Can Attacker... |
|--------------|------------|-----------------|
| **Database breach** | ✅ Safe | See public keys only, cannot sign |
| **Server compromise** | ✅ Safe | No private keys on server |
| **Browser compromise** | ⚠️ Risk | User must protect their device |
| **Passkey theft** | ⚠️ Risk | User must protect their passkey |

---

## 🔍 What Database Admins Can See

### Metadata (Not Sensitive)
- User IDs and usernames
- Public wallet addresses
- Transaction history (public blockchain data)
- Which passkeys belong to which users

### What They CANNOT Do
- ❌ Sign in as users
- ❌ Sign transactions
- ❌ Access funds
- ❌ Decrypt private keys
- ❌ Authenticate on behalf of users

---

## 📊 Comparison: Custodial vs Non-Custodial

### Custodial (What You're NOT Doing)
- ❌ Server stores private keys
- ❌ Server can sign transactions
- ❌ Server controls user funds
- ❌ User depends on server for access

### Non-Custodial (What You're Doing) ✅
- ✅ Private keys stay in browser
- ✅ Server cannot sign transactions
- ✅ User controls their funds
- ✅ User can recover keys from passkey

---

## 🔐 Encryption Details

### Passkey Storage
- **Public key**: Stored in plaintext (by design, public keys are meant to be public)
- **Private key**: Never stored on server

### Wallet Key Storage
- **Encryption**: AES-GCM (256-bit)
- **Key derivation**: PBKDF2 with 100,000 iterations
- **Location**: Browser IndexedDB only
- **Access**: Requires user's passkey to decrypt

---

## ✅ Conclusion

**This is fully non-custodial.** Even though you can see the database tables, you cannot:
- Access user accounts
- Sign transactions
- Control user funds
- Authenticate as users

The private keys never leave the user's browser, and the server only stores public information (public keys, metadata). This is the correct architecture for a non-custodial wallet system.

---

## 📚 Related Documentation

- `docs/SELF_CUSTODIAL_ARCHITECTURE.md` - Full architecture details
- `lib/storage/browser-keys.ts` - Key storage implementation
- `lib/webauthn/key-derivation.ts` - Key derivation from passkeys
- `scripts/004_add_passkeys.sql` - Database schema
