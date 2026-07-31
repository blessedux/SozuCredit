# Authentication Hardening Tickets

Based on: [docs/authentication-hardening-plan.md](../../docs/authentication-hardening-plan.md)

## Summary

**Critical Production Bug**: Users on devices without biometric sensors get stuck in broken passkey registration flow, resulting in orphaned passkey credentials with no wallet linkage.

**Solution**: Implement dual authentication system with automatic device detection and graceful fallback from passkey to PIN-based registration.

## Ticket Breakdown

### 🔴 #22: Device Detection & Graceful Degradation (CRITICAL)
- **Priority**: CRITICAL
- **Estimate**: 2-3 days
- **Blocks**: #23, #24, #28

Implement passkey capability detection before attempting registration. Prevent orphaned credentials.

**Key deliverables:**
- `lib/webauthn/device-detection.ts` with capability checking
- Update `proceedWithRegistration()` to detect before creating passkey
- 60s timeout for cross-device passkey attempts
- Clean up partial registration state on failures
- Clear error messages for each scenario

---

### 🟠 #23: PIN-Based Registration Path
- **Priority**: HIGH
- **Depends on**: #22
- **Blocks**: #25, #26
- **Estimate**: 3-4 days

Allow 4-digit PIN as primary registration method for custodial accounts.

**Key deliverables:**
- Database migration: Add `account_type` column (`passkey` | `pin`)
- `app/api/auth/register/pin/route.ts` endpoint
- `custodial_keys` table for encrypted server-side keys
- Update `tag-input-modal.tsx` with PIN registration UI
- Warning: "PIN accounts are less secure"

---

### 🟠 #24: Error Recovery & Orphan Cleanup
- **Priority**: HIGH
- **Depends on**: #22
- **Blocks**: #25
- **Estimate**: 2 days

Handle partial registration failures and clean orphaned records.

**Key deliverables:**
- Detect passkey-created-but-verification-failed scenarios
- Clean up orphaned `passkey_credentials` records
- Transaction rollback for failed registrations
- Admin cleanup script
- Test all error recovery paths

---

### 🟡 #25: Backend Transaction Signing for Custodial Accounts
- **Priority**: HIGH
- **Depends on**: #23, #24
- **Blocks**: #26
- **Estimate**: 4-5 days

Implement secure backend signing for PIN-based custodial accounts.

**Key deliverables:**
- `lib/stellar/custodial-signer.ts` with signing logic
- `app/api/wallet/sign/route.ts` endpoint
- Verify `account_type='pin'` before signing
- Rate limiting: 10 signatures/min per user
- `custody_audit_log` table
- Optional 2FA check for high-value (>$100)

---

### 🟡 #26: 2FA Integration for PIN Accounts
- **Priority**: MEDIUM
- **Depends on**: #23, #25
- **Estimate**: 3 days

TOTP-based 2FA with aggressive prompting for PIN accounts.

**Key deliverables:**
- `lib/auth/totp.ts` with TOTP generation/verification
- `app/api/auth/2fa/{setup,verify,disable}/route.ts` endpoints
- Database columns: `totp_secret`, `totp_enabled`
- QR code setup UI
- Persistent banner for PIN users without 2FA
- Require 2FA for transactions >$100

---

### 🟢 #27: UI/UX Improvements
- **Priority**: MEDIUM
- **Depends on**: #22, #23
- **Estimate**: 2 days

Improve user-facing messaging and cross-device flows.

**Key deliverables:**
- Progress indicator: "Waiting for your phone..."
- Timeout countdown
- Cancel button → PIN fallback
- Updated error messages (user-friendly)
- Help documentation page
- Success animations

---

### 🟢 #28: Comprehensive Testing Suite
- **Priority**: HIGH
- **Depends on**: #22, #24
- **Estimate**: 3-4 days

Automated and manual tests across device matrix.

**Key deliverables:**
- Unit tests for all new modules
- API tests for auth endpoints
- Integration tests for both flows
- Manual test plan execution (6 device types)
- Regression test suite
- >80% code coverage

---

## Rollout Plan

| Week | Tickets | Goal |
|------|---------|------|
| 1 | #22 | Critical bug fix - stop orphaned registrations |
| 2 | #23, #24 | PIN beta (10% of users) |
| 3 | #25 | Full PIN rollout + custodial signing |
| 4 | #26, #27, #28 | 2FA + polish + full testing |

## Success Metrics

- Registration completion rate: >95% (currently ~70% on non-native devices)
- Orphaned account rate: <1% (currently ~15%)
- Authentication success rate: >98% across all device types

---

**Created**: 2026-07-31  
**Status**: Ready for implementation  
**Related**: [docs/authentication-hardening-plan.md](../../docs/authentication-hardening-plan.md), [docs/tests/authentication-test-plan.md](../../docs/tests/authentication-test-plan.md)
