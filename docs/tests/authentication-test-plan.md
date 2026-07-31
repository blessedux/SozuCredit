# Authentication Test Plan: Dual-Path Onboarding

**Related:** [Authentication Hardening Plan](../authentication-hardening-plan.md)  
**Status:** Draft  
**Last Updated:** 2026-07-31  

## Test Environment Setup

### Device Matrix

| Device ID | Type | OS | Passkey Support | Notes |
|-----------|------|----|-----------------|----|
| D1 | MacBook Pro 2023 | macOS 14 | ✅ Native TouchID | Primary test device |
| D2 | MacBook Air 2018 | macOS 12 | ❌ No TouchID | Simulates older laptops |
| D3 | iPhone 14 | iOS 17 | ✅ FaceID | Cross-device testing |
| D4 | Android Phone | Android 13 | ✅ Fingerprint | Cross-platform testing |
| D5 | Windows Laptop | Windows 11 | ⚠️ Windows Hello | Windows-specific flows |
| D6 | Linux Desktop | Ubuntu 22.04 | ❌ No native | CLI/server testing |

### Test Accounts

| Account Type | Username | Purpose |
|--------------|----------|---------|
| Fresh | `test_fresh_*` | New registration tests |
| Passkey | `test_passkey_*` | Existing passkey users |
| PIN | `test_pin_*` | Existing PIN users |
| Hybrid | `test_hybrid_*` | Users with both methods |

## Test Scenarios

### 1. Registration Flows

#### 1.1 Passkey Registration (Native Device)

**Device:** D1 (MacBook Pro 2023)  
**Preconditions:** None  

**Steps:**
1. Navigate to `/auth`
2. Click "Enter" button
3. Observe: No stored username, discovery mode attempts
4. Click to show tag modal
5. Enter username: `test_fresh_pk_001`
6. Verify: Availability check shows "available"
7. Click "Register"
8. Observe: System detects TouchID available
9. Confirm TouchID prompt
10. Wait for registration verification
11. Observe: Redirect to `/home`

**Expected:**
- ✅ TouchID prompt appears immediately
- ✅ Passkey created successfully
- ✅ Account created with `account_type='passkey'`
- ✅ Wallet address generated (C...)
- ✅ User redirected to Home
- ✅ No orphaned records in database

**Actual:**
- [ ] PASS / FAIL
- Notes:

---

#### 1.2 Passkey Registration (Cross-Device Success)

**Device:** D2 (MacBook Air 2018) + D3 (iPhone 14)  
**Preconditions:** iPhone nearby with Bluetooth enabled  

**Steps:**
1. On D2: Navigate to `/auth`
2. Enter username: `test_fresh_cross_001`
3. Click "Register"
4. Observe: "Scan from your phone" prompt
5. Scan QR code with D3
6. On D3: Confirm FaceID
7. On D2: Wait for verification
8. Observe: Redirect to `/home`

**Expected:**
- ✅ QR code displayed on D2
- ✅ iPhone recognizes QR and prompts FaceID
- ✅ Passkey stored on iPhone
- ✅ Account created successfully
- ✅ Wallet linked to passkey
- ⚠️ Warning: "Your passkey is on your iPhone. Use iPhone to sign in."

**Actual:**
- [ ] PASS / FAIL
- Notes:

---

#### 1.3 Passkey Registration Failure → PIN Fallback

**Device:** D2 (MacBook Air 2018)  
**Preconditions:** No phone nearby  

**Steps:**
1. Navigate to `/auth`
2. Enter username: `test_pin_fallback_001`
3. Click "Register"
4. Observe: "Scan from your phone" prompt
5. Wait 10 seconds (user doesn't scan)
6. Click "Cancel" or let timeout occur
7. Observe: PIN fallback option appears
8. Click "Use PIN instead"
9. Enter 4-digit PIN: `1234`
10. Confirm PIN
11. Observe: Success message + custodial warning
12. Click "Continue"
13. Observe: Redirect to `/home`

**Expected:**
- ✅ Passkey prompt can be cancelled
- ✅ Clear message: "Can't use passkey? Set up a PIN instead"
- ✅ PIN input accepts 4-12 digits
- ✅ Warning shown: "PIN accounts are less secure"
- ✅ Account created with `account_type='pin'`
- ✅ Server-side keys generated
- ✅ User redirected successfully

**Actual:**
- [ ] PASS / FAIL
- Notes:

---

#### 1.4 Direct PIN Registration (No Passkey Support)

**Device:** D6 (Linux Desktop)  
**Preconditions:** Simulated environment without `PublicKeyCredential` API  

**Steps:**
1. Navigate to `/auth`
2. Observe: System detects no passkey support
3. Enter username: `test_pin_direct_001`
4. Click "Register"
5. Observe: PIN input shown immediately (no passkey attempt)
6. Enter PIN: `5678`
7. Confirm PIN
8. Observe: Custodial account warning
9. Click "Continue"
10. Verify: Account created successfully

**Expected:**
- ✅ No passkey prompt attempted
- ✅ PIN shown as primary option
- ✅ Clear messaging: "Your device doesn't support passkeys. We'll use a PIN instead."
- ✅ Account created with `account_type='pin'`
- ✅ Redirect to `/home`

**Actual:**
- [ ] PASS / FAIL
- Notes:

---

#### 1.5 Username Already Taken → Login

**Device:** D1  
**Preconditions:** Account `test_existing_001` already exists  

**Steps:**
1. Navigate to `/auth`
2. Enter username: `test_existing_001`
3. Observe: Availability check shows "taken"
4. Click "Sign In"
5. Observe: Passkey prompt appears
6. Confirm biometric
7. Observe: Redirect to `/home`

**Expected:**
- ✅ Clear message: "This name is taken. Sign in instead?"
- ✅ Button changes to "Sign In"
- ✅ Login succeeds with existing passkey
- ✅ No new account created

**Actual:**
- [ ] PASS / FAIL
- Notes:

---

### 2. Login Flows

#### 2.1 Passkey Login (Stored Username)

**Device:** D1  
**Preconditions:** User `test_passkey_001` registered previously, username stored in localStorage  

**Steps:**
1. Navigate to `/auth`
2. Click "Enter" (no modal shown)
3. Observe: Passkey prompt appears immediately
4. Confirm TouchID
5. Observe: Redirect to `/home`

**Expected:**
- ✅ No tag modal shown
- ✅ Passkey prompt appears immediately
- ✅ Login succeeds
- ✅ Session persisted

**Actual:**
- [ ] PASS / FAIL
- Notes:

---

#### 2.2 Passkey Login (Discovery Mode)

**Device:** D1  
**Preconditions:** User registered but localStorage cleared (simulates incognito)  

**Steps:**
1. Clear localStorage
2. Navigate to `/auth`
3. Click "Enter"
4. Observe: Discovery mode passkey picker
5. Select passkey for `test_passkey_001`
6. Confirm TouchID
7. Observe: Login succeeds, redirect to `/home`

**Expected:**
- ✅ Passkey picker shows available passkeys
- ✅ User can select from list
- ✅ Login succeeds with selected passkey
- ✅ Username stored in localStorage for next time

**Actual:**
- [ ] PASS / FAIL
- Notes:

---

#### 2.3 PIN Login

**Device:** D2  
**Preconditions:** User `test_pin_001` registered with PIN  

**Steps:**
1. Navigate to `/auth`
2. Enter username: `test_pin_001`
3. Click "Sign In"
4. Observe: PIN input shown
5. Enter PIN: `1234`
6. Click "Continue"
7. Observe: Login succeeds, redirect to `/home`

**Expected:**
- ✅ PIN input shown for PIN accounts
- ✅ Passkey button hidden or disabled
- ✅ Login succeeds with correct PIN
- ✅ Session created

**Actual:**
- [ ] PASS / FAIL
- Notes:

---

#### 2.4 Wrong PIN (Rate Limiting)

**Device:** D2  
**Preconditions:** User `test_pin_002` exists  

**Steps:**
1. Navigate to `/auth`
2. Enter username: `test_pin_002`
3. Enter wrong PIN: `0000` (Attempt 1)
4. Observe: Error message
5. Enter wrong PIN: `0000` (Attempt 2)
6. Observe: Error message
7. Enter wrong PIN: `0000` (Attempt 3)
8. Observe: Rate limit error
9. Wait 15 minutes or check database

**Expected:**
- ✅ After 3 failed attempts: "Too many attempts. Try again in 15 minutes."
- ✅ Subsequent attempts blocked
- ✅ Timer shown: "Try again in X:XX"
- ✅ Rate limit record in database

**Actual:**
- [ ] PASS / FAIL
- Notes:

---

### 3. Transaction Signing (Custodial Accounts)

#### 3.1 PIN Account Sends Payment

**Device:** D2  
**Preconditions:** PIN account `test_pin_003` with funded wallet  

**Steps:**
1. Login with PIN account
2. Navigate to `/wallet?send=1`
3. Enter recipient address
4. Enter amount: `5 USDC`
5. Click "Send"
6. Observe: Transaction confirmation
7. Confirm transaction
8. Observe: Backend signing indicator
9. Wait for transaction to complete

**Expected:**
- ✅ No passkey prompt
- ✅ Loading indicator: "Signing transaction..."
- ✅ Transaction signed by backend
- ✅ Transaction broadcasts successfully
- ✅ Audit log entry created
- ✅ User sees success message

**Actual:**
- [ ] PASS / FAIL
- Notes:

---

#### 3.2 Passkey Account Sends Payment

**Device:** D1  
**Preconditions:** Passkey account `test_passkey_002` with funded wallet  

**Steps:**
1. Login with passkey account
2. Navigate to `/wallet?send=1`
3. Enter recipient address
4. Enter amount: `5 USDC`
5. Click "Send"
6. Observe: Passkey signing prompt
7. Confirm TouchID
8. Wait for transaction to complete

**Expected:**
- ✅ TouchID prompt for transaction signing
- ✅ Client-side signing (no backend involved)
- ✅ Transaction broadcasts successfully
- ❌ No audit log entry (not custodial)

**Actual:**
- [ ] PASS / FAIL
- Notes:

---

#### 3.3 Custodial Signing Rate Limit

**Device:** D2  
**Preconditions:** PIN account `test_pin_004`  

**Steps:**
1. Login with PIN account
2. Send transaction (1)
3. Immediately send transaction (2)
4. Continue sending until rate limit hit (up to 10)
5. Observe: Rate limit error

**Expected:**
- ✅ First 10 transactions succeed
- ✅ 11th transaction: "Too many signature requests. Wait 1 minute."
- ✅ Rate limit resets after 1 minute

**Actual:**
- [ ] PASS / FAIL
- Notes:

---

### 4. Account Type Migration

#### 4.1 PIN User Adds Passkey

**Device:** D2 → D1  
**Preconditions:** PIN account `test_pin_005`, access to D1 (passkey-capable)  

**Steps:**
1. On D1: Login with PIN
2. Navigate to Settings → Security
3. Click "Add Passkey"
4. Observe: Explanation of benefits
5. Click "Continue"
6. Confirm TouchID
7. Observe: Success message
8. Sign out
9. Sign in with passkey (no PIN needed)

**Expected:**
- ✅ Passkey added successfully
- ✅ Account_type remains 'pin' (original method)
- ✅ User can now choose either PIN or passkey at login
- ✅ Future transactions use passkey (client-side signing)
- ✅ Banner: "You're now using passkey! More secure."

**Actual:**
- [ ] PASS / FAIL
- Notes:

---

### 5. Error Recovery

#### 5.1 Orphaned Passkey Cleanup

**Device:** D2  
**Preconditions:** Simulated failed registration  

**Steps:**
1. Start registration for `test_orphan_001`
2. Complete passkey creation
3. Simulate network error before verification
4. Observe: Error message
5. Check database for orphaned records
6. Retry registration with same username
7. Verify: Cleanup successful, no duplicates

**Expected:**
- ✅ Clear error message
- ✅ No orphaned `passkey_credentials` record
- ✅ User can retry immediately
- ✅ Second attempt succeeds

**Actual:**
- [ ] PASS / FAIL
- Notes:

---

#### 5.2 Cross-Device Passkey Timeout

**Device:** D2  
**Preconditions:** None  

**Steps:**
1. Start registration
2. Enter username
3. Observe: "Scan from your phone" prompt
4. Wait 60 seconds without scanning
5. Observe: Timeout message
6. Observe: PIN fallback offered

**Expected:**
- ✅ After 60s: "Timed out waiting for your phone."
- ✅ Clear button: "Use PIN instead"
- ✅ Can retry passkey or switch to PIN

**Actual:**
- [ ] PASS / FAIL
- Notes:

---

### 6. 2FA Integration

#### 6.1 PIN User Enables 2FA

**Device:** D2  
**Preconditions:** PIN account `test_pin_006` without 2FA  

**Steps:**
1. Login with PIN
2. Observe: Banner "Secure your account with 2FA"
3. Click "Enable 2FA"
4. Scan QR code with authenticator app
5. Enter 6-digit code
6. Observe: Success message
7. Verify: Banner no longer appears

**Expected:**
- ✅ Persistent banner until 2FA enabled
- ✅ QR code shown with secret
- ✅ 6-digit code verification works
- ✅ `totp_enabled=true` in database
- ✅ Future logins require 2FA code

**Actual:**
- [ ] PASS / FAIL
- Notes:

---

#### 6.2 High-Value Transaction Requires 2FA

**Device:** D2  
**Preconditions:** PIN account with 2FA enabled, wallet funded  

**Steps:**
1. Login with PIN + 2FA code
2. Navigate to Send
3. Enter amount: `150 USDC` (> $100 threshold)
4. Click "Send"
5. Observe: 2FA prompt before signing
6. Enter 2FA code
7. Confirm
8. Observe: Transaction proceeds

**Expected:**
- ✅ 2FA prompt before high-value transaction
- ✅ Transaction blocks until 2FA verified
- ✅ Audit log includes `mfa_verified=true`

**Actual:**
- [ ] PASS / FAIL
- Notes:

---

## Browser Compatibility Matrix

| Browser | Version | Passkey Support | PIN Support | Notes |
|---------|---------|-----------------|-------------|-------|
| Chrome | 120+ | ✅ Full | ✅ Full | Recommended |
| Safari | 16+ | ✅ Full | ✅ Full | iOS/macOS |
| Firefox | 122+ | ⚠️ Partial | ✅ Full | Desktop only |
| Edge | 120+ | ✅ Full | ✅ Full | Windows |
| Opera | 105+ | ✅ Full | ✅ Full | Chromium-based |
| Samsung Internet | 22+ | ⚠️ Limited | ✅ Full | Android |

## Regression Test Checklist

Run before every release involving auth changes:

- [ ] Can register with passkey on native device
- [ ] Can register with PIN as fallback
- [ ] Can login with stored username (passkey)
- [ ] Can login with discovery mode (passkey)
- [ ] Can login with PIN
- [ ] Wrong PIN triggers rate limit
- [ ] Passkey account signs transactions client-side
- [ ] PIN account signs transactions server-side
- [ ] Can add passkey to PIN account
- [ ] 2FA works for PIN users
- [ ] High-value transactions require 2FA
- [ ] No orphaned database records after failures

## Performance Benchmarks

| Operation | Target | Measured | Status |
|-----------|--------|----------|--------|
| Passkey registration | < 3s | - | - |
| PIN registration | < 2s | - | - |
| Passkey login | < 2s | - | - |
| PIN login | < 1s | - | - |
| Custodial tx signing | < 3s | - | - |
| Client tx signing | < 2s | - | - |

## Security Audit Checklist

- [ ] PIN hashes use scrypt with appropriate N parameter
- [ ] Custodial keys encrypted at rest
- [ ] Rate limiting enforced on PIN attempts
- [ ] Rate limiting enforced on signature requests
- [ ] Audit logs capture all custodial operations
- [ ] 2FA secrets stored securely
- [ ] Session tokens have appropriate expiry
- [ ] CORS configured correctly for auth endpoints
- [ ] No sensitive data in client-side logs
- [ ] Passkey credentials properly isolated per user

## Test Data Cleanup

After test suite completion:

```sql
-- Clean up test accounts
DELETE FROM profiles WHERE username LIKE 'test_%';
DELETE FROM passkey_credentials WHERE user_id NOT IN (SELECT id FROM profiles);
DELETE FROM custody_audit_log WHERE user_id NOT IN (SELECT id FROM profiles);
```

## CI/CD Integration

### Automated Tests (Run on every PR)

- Unit tests for device detection
- Unit tests for PIN crypto
- API tests for registration/login endpoints
- Integration tests for tx signing

### Manual Tests (Run before release)

- Device matrix testing
- Browser compatibility
- Cross-device flows
- Error recovery scenarios

### Staging Environment Tests

- End-to-end registration flows
- Transaction signing with real testnet
- Rate limiting verification
- Audit log verification

---

**Test Owner:** QA Team  
**Review Frequency:** Before every auth-related release  
**Last Full Test Run:** TBD  
