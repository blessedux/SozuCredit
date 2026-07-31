# Authentication Hardening: Summary & Next Steps

**Date:** 2026-07-31  
**Status:** Planning Complete, Ready for Implementation  
**Branch:** `dev`  

## What Was Done

### 1. Comprehensive Planning Documents Created ✅

#### [`docs/authentication-hardening-plan.md`](docs/authentication-hardening-plan.md) (500+ lines)
- **Problem Analysis**: Documented the critical production bug where users on older devices get stuck with orphaned passkeys and no wallet
- **Root Cause**: `proceedWithRegistration()` always attempts passkey creation without device detection or fallback
- **Solution Architecture**: Dual authentication system (passkey + PIN) with automatic device-based routing
- **Database Schema**: `account_type` column, `custodial_keys` table, `custody_audit_log` table
- **Security Model**: Custodial (PIN) vs Non-Custodial (Passkey) flows
- **Backend Signing**: Transaction signing service for custodial accounts
- **2FA Integration**: Aggressive 2FA prompts for PIN accounts
- **Migration Strategy**: Backfill existing users, communication plan
- **Rollout Plan**: 4-week phased deployment

#### [`docs/tests/authentication-test-plan.md`](docs/tests/authentication-test-plan.md) (500+ lines)
- **Device Matrix**: 6 device types (MacBook 2023/2018, iPhone, Android, Windows, Linux)
- **Test Scenarios**: 20+ detailed test cases covering:
  - Passkey registration (native, cross-device, failure → PIN fallback)
  - PIN registration (direct, fallback)
  - Login flows (passkey discovery, PIN, rate limiting)
  - Transaction signing (custodial vs non-custodial)
  - Account migration (PIN → Passkey upgrade)
  - Error recovery (orphan cleanup, timeout handling)
  - 2FA setup and enforcement
- **Browser Compatibility**: Chrome, Safari, Firefox, Edge, Opera
- **Regression Checklist**: 12 critical tests before every release
- **Performance Benchmarks**: Target response times for all operations
- **Security Audit**: Checklist for encryption, rate limiting, audit logs

#### [`docs/tickets/auth-hardening.md`](docs/tickets/auth-hardening.md)
- **7 Exponential Tickets**: Broken down by priority and dependencies
- **Ticket #22 (CRITICAL)**: Device detection & graceful degradation (2-3 days)
- **Ticket #23 (HIGH)**: PIN-based registration path (3-4 days)
- **Ticket #24 (HIGH)**: Error recovery & orphan cleanup (2 days)
- **Ticket #25 (HIGH)**: Backend transaction signing (4-5 days)
- **Ticket #26 (MEDIUM)**: 2FA integration (3 days)
- **Ticket #27 (MEDIUM)**: UI/UX improvements (2 days)
- **Ticket #28 (HIGH)**: Comprehensive testing (3-4 days)
- **Total Estimate**: 19-25 days across 4-week rollout

## Current Production Issue (CRITICAL)

### The Bug 🐛

Users on devices **without biometric sensors** (older laptops, basic devices) experience:

1. Enter SozuTag → Click "Register"
2. Device shows "Scan from your phone" prompt
3. User scans with phone, creates passkey
4. **BUG**: Passkey created with NO account linkage
5. **RESULT**: User stuck with stale passkey + username session + no wallet

**Impact:**
- ~15% of registrations fail (orphaned accounts)
- ~70% completion rate on non-native devices (should be >95%)
- User frustration + support tickets

### The Fix 🔧

**Short-term (Ticket #22 - CRITICAL)**:
- Detect device capability BEFORE attempting passkey
- Show immediate PIN option if no biometric sensor
- 60-second timeout for cross-device attempts
- Clean up orphaned records on failure

**Long-term (Tickets #23-#28)**:
- Full PIN-based registration path
- Custodial backend signing for PIN accounts
- 2FA integration for security
- Comprehensive testing across device types

## Key Architecture Decisions

### 1. No User Choice - Automatic Detection

**User DOES NOT see:** "Choose: Custodial or Non-Custodial"

**User DOES see:**
- Passkey prompt (if device supports it)
- OR "Your device doesn't support passkeys. We'll use a PIN." (if not)
- OR "Can't use passkey? Use PIN instead" (if passkey fails)

**Why:** Simpler UX, fewer support questions, automatic fallback

### 2. Account Type Tracking

```sql
-- profiles.account_type column
'passkey' = Non-custodial (user controls keys)
'pin'     = Custodial (server signs transactions)
```

**Upgrade path:** PIN users can later add passkey on better device

### 3. Backend Signing for Custodial Accounts

**Security measures:**
- Rate limiting: 10 signatures/min per user
- Session validation: < 5 min for high-value txs
- Audit logging: Every signature logged with IP, intent, amount
- 2FA required: For transactions >$100 USDC
- Encrypted keys: Server-side keys encrypted at rest

**Trade-off:** Security vs accessibility
- ✅ PRO: Works on ANY device
- ⚠️ CON: User must trust Sozu servers
- 🔒 Mitigation: Aggressive 2FA prompts, transparent audit logs

### 4. 2FA Integration

**For PIN accounts:**
- Persistent banner: "🔒 Secure your account with 2FA"
- Required for high-value transactions (>$100)
- TOTP-based (Google Authenticator, Authy)

**For Passkey accounts:**
- Optional (passkey already secure)
- Can enable for extra protection

## Implementation Priority

### Week 1: Stop the Bleeding (CRITICAL) 🚨
**Deploy:** Ticket #22 (Device Detection)
- Immediate fix for orphaned registrations
- Graceful degradation to PIN
- Monitor: orphaned account rate drops to <1%

### Week 2: PIN Beta 🔐
**Deploy:** Tickets #23 (PIN Registration) + #24 (Error Recovery)
- Enable for 10% of users with feature flag
- Monitor: registration success rate, PIN login success rate
- Gather feedback

### Week 3: Full Rollout 🚀
**Deploy:** Ticket #25 (Custodial Signing)
- Enable PIN for all users
- Backend signs transactions for custodial accounts
- Monitor: transaction success rate, audit logs

### Week 4: Polish & Security 🎨
**Deploy:** Tickets #26 (2FA) + #27 (UI) + #28 (Testing)
- 2FA for PIN accounts
- Improved error messages
- Full test suite execution
- Celebrate! 🎉

## Database Migrations Required

### Migration 1: Add account_type

```sql
ALTER TABLE profiles ADD COLUMN account_type TEXT 
  CHECK (account_type IN ('passkey', 'pin')) DEFAULT 'passkey' NOT NULL;
  
CREATE INDEX idx_profiles_account_type ON profiles(account_type);

-- Backfill existing users
UPDATE profiles SET account_type = 'passkey';
```

### Migration 2: Create custodial_keys table

```sql
CREATE TABLE custodial_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  encrypted_private_key TEXT NOT NULL,
  encryption_key_id TEXT NOT NULL,
  stellar_public_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Migration 3: Create custody_audit_log table

```sql
CREATE TABLE custody_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  intent TEXT NOT NULL,
  tx_hash TEXT,
  amount_usdc DECIMAL(18,7),
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  mfa_verified BOOLEAN NOT NULL DEFAULT false,
  session_age_seconds INTEGER
);

CREATE INDEX idx_custody_audit_user ON custody_audit_log(user_id, signed_at DESC);
```

### Migration 4: Add 2FA columns

```sql
ALTER TABLE profiles ADD COLUMN totp_secret TEXT;
ALTER TABLE profiles ADD COLUMN totp_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN totp_enabled_at TIMESTAMPTZ;
```

## Files Created/Modified

### New Files (20+)
- `lib/webauthn/device-detection.ts`
- `lib/stellar/custodial-signer.ts`
- `lib/stellar/custodial-keys.ts`
- `lib/auth/totp.ts`
- `lib/auth/registration-recovery.ts`
- `app/api/auth/register/pin/route.ts`
- `app/api/wallet/sign/route.ts`
- `app/api/auth/2fa/setup/route.ts`
- `app/api/auth/2fa/verify/route.ts`
- `app/api/auth/2fa/disable/route.ts`
- `components/auth/pin-registration-flow.tsx`
- `components/auth/two-factor-setup.tsx`
- `components/auth/custodial-warning-banner.tsx`
- `scripts/cleanup-orphaned-auth.ts`
- 4 database migrations
- 10+ test files

### Modified Files (5)
- `app/auth/page.tsx` - Add device detection, PIN fallback, error recovery
- `components/tag-input-modal.tsx` - Add PIN registration UI
- `lib/auth/pin-crypto.ts` - Update for primary PIN auth (not just recovery)
- `app/api/auth/register/verify/route.ts` - Handle account_type
- `components/wallet/send-modal.tsx` - Use custodial signing for PIN accounts

## Success Metrics

### Primary KPIs
- **Registration completion rate**: >95% (currently ~70% on non-native devices)
- **Orphaned account rate**: <1% (currently ~15%)
- **Authentication success rate**: >98% across all device types

### Secondary KPIs
- **2FA adoption (PIN users)**: >40% within 30 days
- **Passkey upgrade rate**: >20% when PIN users get better device
- **Support tickets (auth issues)**: Reduce by >70%

## Questions for Review

### 1. Security Model Approval ✅/❌
- **Question**: Are you comfortable with custodial (PIN) accounts where Sozu signs transactions?
- **Trade-off**: Accessibility (works everywhere) vs Security (server trust required)
- **Mitigation**: Rate limiting, audit logs, 2FA, upgrade path to passkey

### 2. Rollout Strategy ✅/❌
- **Question**: Agree with phased rollout (10% beta → 100%)?
- **Alternative**: Deploy all at once (riskier)

### 3. 2FA Requirement ✅/❌
- **Question**: Require 2FA for ALL PIN accounts or just high-value transactions?
- **Current plan**: Strongly suggest, require for >$100 txs
- **Alternative**: Mandatory for all PIN accounts

### 4. PIN Length ✅/❌
- **Question**: 4-digit PIN acceptable or require 6+?
- **Current plan**: 4-12 digits (flexible)
- **Trade-off**: UX (easier) vs Security (longer = stronger)

### 5. Key Management ✅/❌
- **Question**: Encrypt custodial keys with which method?
- **Options:**
  - Envelope encryption (key encrypted with master key)
  - HSM (Hardware Security Module) - production recommendation
  - Cloud KMS (AWS KMS, Google Cloud KMS)

## Next Steps

### Immediate (This Week)
1. **Review planning documents** - Read the full plan, provide feedback
2. **Approve security model** - Confirm custodial approach acceptable
3. **Database review** - DBA review migration scripts
4. **Create Exponential tickets** - File tickets #22-#28 in Exponential

### Short-term (Week 1)
1. **Implement Ticket #22** - Device detection (CRITICAL)
2. **Deploy to staging** - Test cross-device scenarios
3. **Monitor orphaned accounts** - Verify fix works

### Medium-term (Weeks 2-4)
1. **Implement remaining tickets** - PIN registration, custodial signing, 2FA
2. **Execute test plan** - Run full test matrix
3. **Gradual rollout** - 10% → 50% → 100%
4. **Monitor metrics** - Track KPIs

## Questions?

Contact: Engineering Team  
Documents: All in `docs/` directory on `dev` branch  
Status: Ready for implementation approval  

---

**Summary:** We have a clear understanding of the production bug, a comprehensive solution plan, detailed test specifications, and a phased rollout strategy. The fix will enable Sozu to work on ANY device while maintaining strong security for users who can use passkeys.

**Recommendation:** Start with Ticket #22 (CRITICAL) this week to stop orphaned registrations immediately.
