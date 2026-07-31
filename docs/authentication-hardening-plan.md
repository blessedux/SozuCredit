# Authentication Hardening Plan: Dual-Path Onboarding

**Status:** Planning  
**Priority:** CRITICAL  
**Date:** 2026-07-31  

## Problem Statement

### Current Bug (Production Issue)

Users on devices without biometric sensors (older laptops, basic devices) experience a **broken onboarding flow**:

1. User enters SozuTag
2. System attempts passkey creation via `createPasskey()`
3. Device prompts "scan from your phone"
4. User scans with phone and creates passkey
5. **BUG**: Passkey is created with NO account linkage
6. **RESULT**: User has stale passkey + username session with no wallet linked

This leaves users unable to complete onboarding and creates orphaned database records.

### Root Cause

**Code Location:** `app/auth/page.tsx` → `proceedWithRegistration()` (lines 424-726)

The registration flow **always attempts passkey creation** without:
- Detecting device capability first
- Providing graceful fallback when passkey creation fails
- Handling cross-device passkey creation properly
- Offering PIN-based registration as alternative

```typescript
// Current flow (broken):
async function proceedWithRegistration(tag: string) {
  const challenge = await generateRegistrationChallenge(tag)
  const credential = await createPasskey(challenge) // ❌ Fails silently on non-native devices
  const regResult = await verifyRegistration(tag, credential, challenge)
  // ... rest of flow assumes credential exists
}
```

## Solution Architecture

### Dual Authentication Paths

Users don't choose "custodial" vs "non-custodial" explicitly. Instead, the system automatically determines the path based on their device capability and onboarding success:

| Path | Trigger | Security | Wallet | Transaction Signing |
|------|---------|----------|--------|---------------------|
| **Passkey** (non-custodial) | Device supports passkeys OR user successfully creates cross-device passkey | High - biometric/hardware | User-controlled keys in browser | Client-side via passkey |
| **PIN** (custodial) | Device doesn't support passkeys OR passkey creation fails | Medium - 4-digit PIN + server trust | Server-controlled keys | Backend signs after user intent |

### Key Design Principles

1. **No explicit choice**: User doesn't see "Choose custodial or non-custodial"
2. **Automatic fallback**: If passkey fails → offer PIN registration
3. **Device detection**: Check `PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()` before attempting passkey
4. **Clear messaging**: User understands what authentication method they're using
5. **Upgrade path**: PIN users can later add passkey when on better device
6. **2FA nudging**: PIN accounts get persistent prompts to enable 2FA

## Database Schema Changes

### Add account_type to profiles

```sql
-- Migration: add account_type column
ALTER TABLE profiles ADD COLUMN account_type TEXT CHECK (account_type IN ('passkey', 'pin')) DEFAULT NULL;

-- Backfill existing accounts
UPDATE profiles SET account_type = 'passkey' WHERE recovery_pin_hash IS NULL;
UPDATE profiles SET account_type = 'pin' WHERE recovery_pin_hash IS NOT NULL;

-- Make NOT NULL after backfill
ALTER TABLE profiles ALTER COLUMN account_type SET NOT NULL;
ALTER TABLE profiles ALTER COLUMN account_type SET DEFAULT 'passkey';

-- Index for queries
CREATE INDEX idx_profiles_account_type ON profiles(account_type);
```

### Add passkey_credentials tracking (if not exists)

```sql
-- Ensure we can track which passkeys belong to which account
CREATE TABLE IF NOT EXISTS passkey_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key_cose BYTEA NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  transports TEXT[],
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  device_name TEXT
);

CREATE INDEX idx_passkey_credentials_user_id ON passkey_credentials(user_id);
CREATE INDEX idx_passkey_credentials_is_primary ON passkey_credentials(user_id, is_primary) WHERE is_primary = true;
```

## Implementation Phases

### Phase 1: Device Detection & Graceful Degradation (CRITICAL)

**Goal:** Prevent the current bug from happening

**Tasks:**
1. Add `lib/webauthn/device-detection.ts`:
   ```typescript
   export async function detectPasskeySupport(): Promise<{
     available: boolean
     platformAuthenticator: boolean
     crossPlatform: boolean
   }> {
     if (!window.PublicKeyCredential) {
       return { available: false, platformAuthenticator: false, crossPlatform: false }
     }
     
     try {
       const platformAvailable = await PublicKeyCredential
         .isUserVerifyingPlatformAuthenticatorAvailable()
       
       return {
         available: true,
         platformAuthenticator: platformAvailable,
         crossPlatform: true, // Assume cross-platform available if API exists
       }
     } catch {
       return { available: false, platformAuthenticator: false, crossPlatform: false }
     }
   }
   ```

2. Update `app/auth/page.tsx` → `proceedWithRegistration()`:
   - Detect device capability BEFORE attempting passkey creation
   - If no platform authenticator AND passkey creation fails → immediate PIN fallback
   - Better error messages for cross-device failures
   - Stash partial registration state to prevent orphaned records

3. Add error recovery:
   - Detect when passkey was created but registration failed
   - Clean up orphaned passkey_credentials records
   - Show clear user message: "Passkey created but account setup incomplete. Try PIN instead?"

### Phase 2: PIN-Based Registration (HIGH)

**Goal:** Allow PIN as primary registration path

**Tasks:**
1. Add `app/api/auth/register/pin/route.ts`:
   ```typescript
   // POST /api/auth/register/pin
   // Body: { username, pin, referralCode? }
   // Returns: { success, userId, username }
   ```

2. Update `components/tag-input-modal.tsx`:
   - Add "Use PIN instead" option on registration step
   - Show when: device has no passkey support OR after passkey creation fails
   - UI: "Can't use passkey? Set up a 4-digit PIN instead"
   - Warning: "PIN accounts are less secure. We'll help you add a passkey later."

3. Update `app/auth/page.tsx`:
   - Add `handlePinRegistration(tag, pin)` callback
   - Create account with `account_type='pin'`
   - Generate server-side wallet keys
   - Store PIN hash in `recovery_pin_hash`

### Phase 3: Backend Transaction Signing (HIGH)

**Goal:** Sign transactions for custodial (PIN) accounts

**Tasks:**
1. Add `lib/stellar/custodial-signer.ts`:
   ```typescript
   /**
    * Sign transaction for custodial account after verifying user intent.
    * Only callable by authenticated users with account_type='pin'.
    */
   export async function signCustodialTransaction(params: {
     userId: string
     txXDR: string
     intent: 'payment' | 'swap' | 'deposit' | 'withdraw'
     sessionToken: string // Recent authentication proof
   }): Promise<{
     signedXDR: string
     requiresMFA?: boolean // If true, user must complete 2FA first
   }>
   ```

2. Add `app/api/wallet/sign/route.ts`:
   ```typescript
   // POST /api/wallet/sign
   // Headers: x-user-id, x-session-token
   // Body: { txXDR, intent, pin? }
   // Returns: { signedXDR } or { error: 'mfa_required' }
   ```

3. Security measures:
   - Verify account_type='pin' (reject passkey accounts)
   - Rate limiting: max 10 signature requests per minute
   - Intent verification: log all signature requests
   - Session validation: require recent authentication (< 5 min)
   - Optional 2FA check before signing
   - Audit log: store all custodial signatures in `custody_audit_log` table

4. Create audit table:
   ```sql
   CREATE TABLE custody_audit_log (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID NOT NULL REFERENCES profiles(id),
     intent TEXT NOT NULL,
     tx_hash TEXT,
     signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     ip_address INET,
     user_agent TEXT,
     mfa_verified BOOLEAN NOT NULL DEFAULT false
   );
   ```

### Phase 4: 2FA Integration (MEDIUM)

**Goal:** Aggressive 2FA prompts for PIN accounts

**Tasks:**
1. Add `lib/auth/totp.ts` - TOTP 2FA implementation
2. Add `app/api/auth/2fa/` routes:
   - `POST /setup` - Generate TOTP secret, return QR code
   - `POST /verify` - Verify TOTP code
   - `POST /disable` - Disable 2FA (requires PIN + current code)
3. Update UI:
   - Persistent banner for PIN users: "Secure your account with 2FA"
   - Show on every login until enabled
   - Require 2FA for high-value transactions (> $100 USDC)
4. Database:
   ```sql
   ALTER TABLE profiles ADD COLUMN totp_secret TEXT;
   ALTER TABLE profiles ADD COLUMN totp_enabled BOOLEAN NOT NULL DEFAULT false;
   ALTER TABLE profiles ADD COLUMN totp_enabled_at TIMESTAMPTZ;
   ```

### Phase 5: Cross-Device Passkey Improvements (MEDIUM)

**Goal:** Better UX for cross-device passkey creation

**Tasks:**
1. Update passkey creation flow:
   - Show progress indicator: "Waiting for passkey from your phone..."
   - Add cancel button: "Having trouble? Use PIN instead"
   - Timeout after 60 seconds → show PIN option
   - Better error messages for specific failures

2. Add device pairing UI:
   - After PIN registration, show: "Want to add a passkey from your phone?"
   - QR code flow for easy pairing
   - Test passkey after adding to verify it works

### Phase 6: Testing & Validation (HIGH)

**Goal:** Ensure both flows work across all device types

**Test Matrix:**

| Device Type | Passkey Support | Test Scenarios |
|-------------|-----------------|----------------|
| Modern laptop (2022+) | ✅ Native | 1. Passkey registration<br>2. Passkey login<br>3. Add second passkey |
| Older laptop (2018-2021) | ❌ No native | 1. Cross-device passkey (success)<br>2. Cross-device passkey (failure) → PIN fallback<br>3. Direct PIN registration<br>4. PIN login |
| Modern phone | ✅ Native | 1. Passkey registration<br>2. Passkey login<br>3. Cross-device QR pairing |
| Basic phone | ⚠️ Limited | 1. PIN registration<br>2. PIN login<br>3. 2FA setup |
| Incognito/Private | ⚠️ Session-only | 1. Passkey (session-scoped)<br>2. PIN login<br>3. Recovery scenarios |

**Critical Test Cases:**

1. **Passkey creation fails midway**:
   - Scenario: User cancels biometric prompt
   - Expected: Show clear message + PIN option
   - Verify: No orphaned database records

2. **Cross-device passkey success but verification fails**:
   - Scenario: Phone creates passkey but network error on verification
   - Expected: Retry mechanism or clean failure
   - Verify: User can retry or switch to PIN

3. **PIN account tries to sign transaction**:
   - Scenario: PIN user sends USDC payment
   - Expected: Backend signs after intent verification
   - Verify: Transaction succeeds, audit log created

4. **Passkey account tries to use PIN signin**:
   - Scenario: Passkey user enters PIN on login
   - Expected: Error or "no backup PIN set"
   - Verify: Can't bypass passkey requirement

5. **Account type migration**:
   - Scenario: PIN user adds passkey on better device
   - Expected: Account_type stays 'pin', both auth methods work
   - Verify: User can choose either method

## Security Considerations

### PIN Account Risks

| Risk | Mitigation |
|------|------------|
| PIN brute force | Rate limiting: 3 attempts / 15 min |
| Server key compromise | Encrypt keys at rest, HSM for production |
| Malicious backend | Open-source backend code, audit logs |
| Social engineering | Require email/SMS verification for key changes |
| Lost PIN | Email recovery flow (adds friction) |

### Passkey Account Security

| Feature | Benefit |
|---------|---------|
| Biometric proof | Prevents unauthorized access |
| Hardware-backed | Keys never leave device |
| Phishing resistant | Domain-bound authentication |
| No backend trust | User controls keys |

## Migration Strategy

### Existing Users (All currently passkey-based)

```sql
-- Mark all existing users as passkey accounts
UPDATE profiles SET account_type = 'passkey' WHERE account_type IS NULL;

-- Users with recovery_pin_hash are backup-enabled, not custodial
-- (They still sign client-side with passkey)
```

### Communication Plan

**For PIN users:**
- On registration: "You're using PIN authentication. Your wallet is secured by Sozu servers. We recommend adding a passkey when possible."
- Persistent banner: "Upgrade to passkey for better security"
- Email: "How to add a passkey to your Sozu account"

**For all users:**
- Blog post: "Sozu now works on any device"
- Support doc: "Understanding Sozu authentication methods"

## Rollout Plan

### Stage 1: Silent Deploy (Week 1)
- Deploy Phase 1 (device detection + graceful degradation)
- Monitor error logs for registration failures
- Verify orphaned records stop appearing

### Stage 2: PIN Beta (Week 2)
- Deploy Phase 2 (PIN registration)
- Enable for 10% of users with `feature_flag: pin_auth_beta`
- Monitor: registration success rate, PIN login success rate
- Gather feedback

### Stage 3: Full Rollout (Week 3)
- Deploy Phase 3 (custodial signing)
- Enable PIN registration for all users
- Deploy aggressive 2FA prompts

### Stage 4: Optimization (Week 4)
- Deploy Phase 5 (cross-device improvements)
- A/B test: passkey-first vs device-detection-first
- Monitor conversion rates

## Success Metrics

### Primary KPIs
- **Registration completion rate**: Target >95% (currently ~70% on non-native devices)
- **Authentication success rate**: Target >98% across all device types
- **Orphaned account rate**: Target <1% (currently ~15%)

### Secondary KPIs
- **2FA adoption (PIN users)**: Target >40% within 30 days
- **Passkey upgrade (PIN → Passkey)**: Target >20% when on better device
- **Support tickets (auth issues)**: Reduce by >70%

## Future Enhancements

1. **Passkey-only mode**: Let users force passkey-only (disable PIN auth entirely)
2. **Hardware keys**: Support FIDO2 USB security keys
3. **Multi-device sync**: Sync passkeys across user's devices
4. **Biometric + PIN**: Require both for high-value transactions
5. **Account recovery**: Social recovery, backup codes, email recovery

## Files to Create/Modify

### New Files
- `lib/webauthn/device-detection.ts`
- `lib/stellar/custodial-signer.ts`
- `lib/auth/totp.ts`
- `app/api/auth/register/pin/route.ts`
- `app/api/wallet/sign/route.ts`
- `app/api/auth/2fa/setup/route.ts`
- `app/api/auth/2fa/verify/route.ts`
- `app/api/auth/2fa/disable/route.ts`
- `components/auth/pin-registration-flow.tsx`
- `components/auth/two-factor-setup.tsx`
- `components/auth/custodial-warning-banner.tsx`

### Modified Files
- `app/auth/page.tsx` - Add device detection, PIN fallback, better error handling
- `components/tag-input-modal.tsx` - Add PIN registration option
- `lib/auth/pin-crypto.ts` - Update for primary PIN auth (not just recovery)
- `app/api/auth/register/verify/route.ts` - Handle account_type
- Database migrations - Add account_type, custody_audit_log, totp fields

## Next Steps

1. **Create tickets** - Break down into Exponential tickets
2. **Database migration** - Write and test account_type migration
3. **Prototype device detection** - Test across device matrix
4. **Security review** - Review custodial signing architecture
5. **Design review** - Review PIN registration UX flows

---

**Owner:** Engineering Team  
**Reviewers:** Security, Product, Design  
**Target Completion:** 2026-08-31  
