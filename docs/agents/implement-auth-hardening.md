# Agent Implementation Guide: Authentication Hardening

**Status**: Ready for implementation  
**Branch**: Feature branches off `dev`  
**Target**: Staging (`dev.sozu.capital`) → Production (`app.sozu.capital`)

---

## Quick Start

Use this prompt to start implementing any ticket:

```
Implement Exponential ticket SOZU-{NUMBER} from .exponential/tickets/

Follow these guidelines:
- Branch from dev: git checkout -b cursor/sozu-{number}-{short-name}-3d62
- Read the full ticket YAML for requirements
- Reference the detailed plans in docs/authentication-hardening-plan.md
- Follow the test plan in docs/tests/authentication-test-plan.md
- Commit incrementally with clear messages
- Run `bun run build` to verify before pushing
- Push to origin and create PR to dev when complete

Ticket details: .exponential/tickets/SOZU-{NUMBER}-*.yaml
```

---

## Ticket Implementation Order

### Critical Path (Must be sequential)

1. **SOZU-22**: Device Detection & Graceful Degradation (CRITICAL - 2-3 days)
2. **SOZU-23**: PIN-Based Registration Path (HIGH - 3-4 days)
3. **SOZU-24**: Error Recovery & Orphan Cleanup (HIGH - 2 days)
4. **SOZU-25**: Backend Transaction Signing (HIGH - 4-5 days)

### Enhancement Path (Can be parallel after #23)

5. **SOZU-26**: 2FA Integration (MEDIUM - 3 days)
6. **SOZU-27**: UI/UX Improvements (MEDIUM - 2 days)
7. **SOZU-28**: Comprehensive Testing Suite (HIGH - 3-4 days)

---

## Implementation Resources

### Core Documentation

| Document | Purpose | When to Use |
|----------|---------|-------------|
| [authentication-hardening-plan.md](../authentication-hardening-plan.md) | Complete technical specification | Start of each ticket |
| [authentication-test-plan.md](../tests/authentication-test-plan.md) | Test scenarios & device matrix | During testing phase |
| [AUTH_HARDENING_SUMMARY.md](../../AUTH_HARDENING_SUMMARY.md) | Executive overview | Context/decisions |
| [git-flow.md](./git-flow.md) | Branch & deployment model | Before creating branches |

### Ticket Definitions

All tickets in `.exponential/tickets/SOZU-*.yaml` contain:
- Detailed description
- Key deliverables
- Acceptance criteria
- Dependencies & blockers
- Related documentation links

### Existing Code References

| File | Purpose | Relevant For |
|------|---------|--------------|
| `app/auth/page.tsx` | Current auth flow (has the bug) | SOZU-22 |
| `components/tag-input-modal.tsx` | User input UI | SOZU-22, SOZU-23, SOZU-27 |
| `lib/auth/pin-crypto.ts` | PIN hashing (already exists) | SOZU-23 |
| `app/api/auth/pin/login/route.ts` | PIN login (partial) | SOZU-23 |
| `app/api/auth/pin/set/route.ts` | PIN setting (exists) | SOZU-23 |

---

## Per-Ticket Agent Prompts

### SOZU-22: Device Detection & Graceful Degradation

```
Implement SOZU-22: Device Detection & Graceful Degradation

CRITICAL BUG FIX: Users on devices without biometric sensors get stuck in broken 
passkey registration flow, creating orphaned passkey credentials with no wallet linkage.

Branch: cursor/sozu-22-device-detection-3d62

Key Tasks:
1. Create lib/webauthn/device-detection.ts with:
   - isPasskeyCapable(): Promise<boolean>
   - detectDeviceCapabilities(): DeviceCapabilities
   - hasUserVerifyingPlatformAuthenticator() wrapper

2. Update app/auth/page.tsx proceedWithRegistration():
   - Call device detection BEFORE createPasskey()
   - Show clear message for cross-device flows
   - Implement 60s timeout for cross-device attempts
   - Clean up partial state on timeout/failure

3. Error handling:
   - Clear error messages for each scenario
   - Retry mechanism
   - Fallback to PIN registration option

4. Testing:
   - Test on modern desktop with biometrics (should use passkey)
   - Test on old laptop without biometrics (should offer PIN)
   - Test cross-device timeout (should clean up)

Acceptance Criteria (all must pass):
- [ ] Device capability detection runs before passkey creation
- [ ] Cross-device flow times out after 60s with clear message
- [ ] No orphaned passkey records created on failure
- [ ] User can retry or fall back to PIN after timeout/failure
- [ ] All error scenarios have user-friendly messages

References:
- Full spec: docs/authentication-hardening-plan.md (Phase 1)
- Test plan: docs/tests/authentication-test-plan.md (Scenarios 1-4)
- Ticket: .exponential/tickets/SOZU-22-device-detection.yaml
- Current buggy code: app/auth/page.tsx (proceedWithRegistration function)
```

### SOZU-23: PIN-Based Registration Path

```
Implement SOZU-23: PIN-Based Registration Path

Enable 4-digit PIN as primary registration method for custodial accounts.

Branch: cursor/sozu-23-pin-registration-3d62
Depends on: SOZU-22 must be complete

Key Tasks:
1. Database migration:
   - Add account_type ENUM ('passkey', 'pin') to user_profiles
   - Create custodial_keys table with encrypted server keys
   - Migration script in db/migrations/

2. Create app/api/auth/register/pin/route.ts:
   - Accept sozuTag + PIN (4-12 digits)
   - Hash PIN using lib/auth/pin-crypto.ts (already exists)
   - Generate server-side Stellar keypair
   - Encrypt private key before storage
   - Set account_type = 'pin'

3. Update components/tag-input-modal.tsx:
   - Add PIN registration flow (4-12 digit input)
   - Show warning: "PIN accounts are custodial (less secure)"
   - Suggest 2FA setup after registration

4. Security:
   - Validate PIN format (digits only, 4-12 length)
   - Rate limit registration endpoint
   - Encrypt keys with proper KMS/vault

Acceptance Criteria:
- [ ] Database schema updated with account_type column
- [ ] custodial_keys table created with proper encryption
- [ ] PIN registration endpoint accepts 4-12 digit PINs
- [ ] UI clearly warns about custodial nature of PIN accounts
- [ ] PIN accounts marked as account_type='pin' in database
- [ ] Server-side key generation and secure storage working

References:
- Full spec: docs/authentication-hardening-plan.md (Phase 2)
- Test plan: docs/tests/authentication-test-plan.md (Scenarios 5-7)
- Ticket: .exponential/tickets/SOZU-23-pin-registration.yaml
- Existing PIN crypto: lib/auth/pin-crypto.ts
- Existing PIN login: app/api/auth/pin/login/route.ts
```

### SOZU-24: Error Recovery & Orphan Cleanup

```
Implement SOZU-24: Error Recovery & Orphan Cleanup

Handle partial registration failures and clean orphaned records.

Branch: cursor/sozu-24-error-recovery-3d62
Depends on: SOZU-22 must be complete

Key Tasks:
1. Detection logic:
   - Identify passkey-created-but-verification-failed scenarios
   - Find orphaned passkey_credentials records (no linked wallet)
   - Detect partial user_profiles (no wallet_id)

2. Cleanup mechanisms:
   - Transaction rollback for failed registrations
   - Automatic cleanup on next auth attempt
   - Manual admin cleanup script

3. Error recovery:
   - Allow retry after cleanup
   - Show clear "Let's try again" messaging
   - Log all cleanup events for audit

4. Admin tools:
   - Script to identify orphans: scripts/cleanup-orphaned-auth.ts
   - Dry-run mode for safety
   - Report generation

Acceptance Criteria:
- [ ] Failed passkey registrations properly rolled back
- [ ] Orphaned records automatically cleaned up
- [ ] Admin script can identify and remove existing orphans
- [ ] All error paths tested (network, timeout, user cancel, etc.)
- [ ] Idempotent registration endpoints

References:
- Full spec: docs/authentication-hardening-plan.md (Phase 1, error handling)
- Test plan: docs/tests/authentication-test-plan.md (Scenarios 14-16)
- Ticket: .exponential/tickets/SOZU-24-error-recovery.yaml
```

### SOZU-25: Backend Transaction Signing

```
Implement SOZU-25: Backend Transaction Signing for Custodial Accounts

Secure backend signing for PIN-based custodial accounts.

Branch: cursor/sozu-25-custodial-signing-3d62
Depends on: SOZU-23 and SOZU-24 must be complete

Key Tasks:
1. Create lib/stellar/custodial-signer.ts:
   - signTransaction(userId, transaction)
   - Verify account_type = 'pin'
   - Decrypt private key
   - Sign Stellar transaction
   - Log to audit trail

2. Create app/api/wallet/sign/route.ts:
   - Verify user session (PIN + x-user-id)
   - Check account_type = 'pin'
   - Rate limiting: 10 signatures/min per user
   - Optional 2FA check for >$100

3. Database:
   - custody_audit_log table
   - Log all signing events (timestamp, userId, txHash, amount)

4. Security:
   - Rate limiting
   - Audit logging
   - Key encryption at rest
   - Consider HSM for production (future)

Acceptance Criteria:
- [ ] Only custodial accounts can use backend signing endpoint
- [ ] Signing endpoint properly verifies user identity (PIN + session)
- [ ] Rate limiting prevents abuse (10 signatures/min/user)
- [ ] All signing events logged to audit table
- [ ] High-value transactions (>$100) require 2FA if enabled
- [ ] Keys encrypted at rest with proper key management

References:
- Full spec: docs/authentication-hardening-plan.md (Phase 3)
- Test plan: docs/tests/authentication-test-plan.md (Scenarios 8-10)
- Ticket: .exponential/tickets/SOZU-25-custodial-signing.yaml
```

### SOZU-26: 2FA Integration

```
Implement SOZU-26: 2FA Integration for PIN Accounts

TOTP-based 2FA with aggressive prompting for PIN accounts.

Branch: cursor/sozu-26-2fa-integration-3d62
Depends on: SOZU-23 and SOZU-25 must be complete

Key Tasks:
1. Create lib/auth/totp.ts:
   - generateSecret()
   - generateQRCode()
   - verifyTOTP(secret, token)
   - generateRecoveryCodes()

2. API endpoints:
   - app/api/auth/2fa/setup/route.ts
   - app/api/auth/2fa/verify/route.ts
   - app/api/auth/2fa/disable/route.ts

3. Database:
   - Add totp_secret, totp_enabled to user_profiles
   - Store recovery codes (encrypted)

4. UI/UX:
   - QR code setup flow
   - Persistent banner for PIN users without 2FA
   - Require 2FA for high-value transactions (>$100)

Acceptance Criteria:
- [ ] TOTP secret generation and QR code display working
- [ ] Users can enable/disable 2FA
- [ ] 2FA verification integrated into login flow
- [ ] High-value transactions require 2FA for PIN accounts
- [ ] Persistent UI prompt for PIN users to enable 2FA
- [ ] Recovery codes generated and stored securely

References:
- Full spec: docs/authentication-hardening-plan.md (Phase 4)
- Test plan: docs/tests/authentication-test-plan.md (Scenarios 17-19)
- Ticket: .exponential/tickets/SOZU-26-2fa-integration.yaml
```

### SOZU-27: UI/UX Improvements

```
Implement SOZU-27: UI/UX Improvements for Authentication Flows

Polish user-facing messaging and cross-device flows.

Branch: cursor/sozu-27-ux-improvements-3d62
Depends on: SOZU-22 and SOZU-23 must be complete

Key Tasks:
1. Cross-device flow improvements:
   - Progress indicator: "Waiting for your phone..."
   - Countdown timer (60s → 0)
   - Cancel button → PIN fallback
   - Clear instructions

2. Error messages:
   - Rewrite all technical errors in user-friendly language
   - Add "What to try next" suggestions
   - Remove jargon (e.g., "WebAuthn failed" → "Couldn't connect to your device")

3. Help documentation:
   - Create help page explaining both auth methods
   - Device-specific guidance
   - Troubleshooting section

4. Polish:
   - Success animations
   - Loading states
   - Smooth transitions

Acceptance Criteria:
- [ ] Cross-device flow shows clear waiting state with countdown
- [ ] Users can cancel and switch to PIN at any time
- [ ] All error messages are user-friendly (no technical jargon)
- [ ] Help page explains both authentication methods
- [ ] Success states have smooth animations
- [ ] Loading states are clear and informative

References:
- Full spec: docs/authentication-hardening-plan.md (Phase 5)
- Test plan: docs/tests/authentication-test-plan.md (UX scenarios)
- Ticket: .exponential/tickets/SOZU-27-ux-improvements.yaml
```

### SOZU-28: Comprehensive Testing Suite

```
Implement SOZU-28: Comprehensive Testing Suite for Authentication

Automated and manual tests across device matrix.

Branch: cursor/sozu-28-testing-suite-3d62
Depends on: SOZU-22 and SOZU-24 must be complete

Key Tasks:
1. Unit tests:
   - lib/webauthn/device-detection.test.ts
   - lib/auth/totp.test.ts
   - lib/stellar/custodial-signer.test.ts
   - lib/auth/pin-crypto.test.ts (verify existing)

2. API tests:
   - app/api/auth/register/pin/route.test.ts
   - app/api/auth/2fa/*/route.test.ts
   - app/api/wallet/sign/route.test.ts

3. Integration tests:
   - Full passkey registration flow
   - Full PIN registration flow
   - Error recovery scenarios
   - Cross-device timeout

4. Manual testing:
   - Execute test plan on 6 device types
   - Document results
   - Screenshot edge cases

Acceptance Criteria:
- [ ] Unit tests for device detection, PIN crypto, TOTP, etc.
- [ ] API tests for all new endpoints
- [ ] Integration tests for passkey and PIN flows
- [ ] Manual testing completed on 6 device types (see test plan)
- [ ] Regression suite prevents known issues
- [ ] Code coverage >80%

Test Matrix (from test plan):
1. Modern desktop with biometrics (MacBook Pro M1+)
2. Modern desktop without biometrics (Windows laptop)
3. Modern mobile with biometrics (iPhone 15, Pixel 8)
4. Older mobile without biometrics (iPhone X, Pixel 3)
5. Linux desktop (Ubuntu 22.04+)
6. Browser variations (Chrome, Safari, Firefox)

References:
- Test plan: docs/tests/authentication-test-plan.md (ALL scenarios)
- Full spec: docs/authentication-hardening-plan.md (Testing section)
- Ticket: .exponential/tickets/SOZU-28-testing-suite.yaml
```

---

## Standard Workflow

For every ticket:

1. **Setup**
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b cursor/sozu-{NUMBER}-{short-name}-3d62
   ```

2. **Read Requirements**
   - Ticket YAML: `.exponential/tickets/SOZU-{NUMBER}-*.yaml`
   - Full spec: `docs/authentication-hardening-plan.md`
   - Test plan: `docs/tests/authentication-test-plan.md`

3. **Implement**
   - Follow key deliverables
   - Write tests as you go
   - Commit incrementally

4. **Test Locally**
   ```bash
   bun run dev          # Manual testing
   bun run test         # Run test suite
   bun run build        # Verify production build
   ```

5. **Pre-push Checklist**
   - [ ] All acceptance criteria met
   - [ ] Tests passing
   - [ ] Production build succeeds
   - [ ] Code follows React/Next.js best practices
   - [ ] No console errors

6. **Push & PR**
   ```bash
   git add -A
   git commit -m "feat(auth): implement SOZU-{NUMBER} - {title}"
   git push -u origin cursor/sozu-{NUMBER}-{short-name}-3d62
   ```
   - Create PR to `dev` (not `main`)
   - Link ticket in PR description
   - Add testing notes

---

## Emergency Contacts & Decisions

If blocked or need clarification:
- Tag user in PR comments
- Reference ticket number and specific blocker
- Continue with best judgment, mark with `// TODO: Clarify with user` comments

## Success Metrics

After full implementation:
- Registration completion rate: >95% (currently ~70% on non-native devices)
- Orphaned account rate: <1% (currently ~15%)
- Authentication success rate: >98% across all device types
