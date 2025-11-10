# Branch Comparison: credit-request vs main

## Overview

This document compares the `feature/credit-request` branch with `main` to identify what UI updates and features should be preserved when merging.

## Key Differences

### 1. **Notifications System** ✅ (credit-request only)
**Status:** Complete and functional

**Features:**
- Notification bell button in wallet page
- Notification dialog with unread count badge
- API endpoint: `/api/wallet/notifications`
- Mark as read functionality
- Unread count tracking

**Files:**
- `app/api/wallet/notifications/route.ts` (135 lines)
- `app/wallet/page.tsx` (notifications UI components)

**Action:** ✅ **KEEP** - This is a valuable UI feature that should be merged into main.

---

### 2. **Referral System** ✅ (main only)
**Status:** Complete and functional

**Features:**
- Referral code generation via API
- Referral statistics tracking
- Automatic point awarding when referrals sign up
- Database migration scripts

**Files:**
- `app/api/wallet/referral/generate/route.ts`
- `app/api/wallet/referral/status/route.ts`
- `scripts/013_referral_system.sql`
- `scripts/014_fix_trigger_zero_points.sql`

**Action:** ✅ **KEEP** - This is the core trust points system from main.

---

### 3. **MaxFlow Integration** ✅ (main only)
**Status:** Complete backend, partial UI

**Features:**
- MaxFlow API client library
- Ego score and trust score calculation
- EVM address linking
- API endpoints for MaxFlow scores

**Files:**
- `lib/maxflow/client.ts`
- `lib/maxflow/config.ts`
- `lib/maxflow/utils.ts`
- `app/api/maxflow/ego/[address]/score/route.ts`
- `app/api/maxflow/ego/[address]/trust-score/route.ts`
- `app/api/wallet/evm-address/route.ts`

**Action:** ✅ **KEEP** - Backend is complete, UI integration can be added later.

---

### 4. **Profile Page** ⚠️ (Different implementations)

**credit-request:**
- Simpler profile page
- No EVM address/MaxFlow integration
- Basic profile editing

**main:**
- Profile page with MaxFlow integration
- EVM address linking UI
- Ego score and trust score display

**Action:** 🔄 **MERGE** - Keep MaxFlow integration from main, but ensure notifications work with it.

---

### 5. **Wallet Page UI** ⚠️ (Different implementations)

**credit-request has:**
- Notifications bell button
- Balance audit modal
- APY display integration
- Simpler invite code generation (substring from user ID)

**main has:**
- Referral system integration (API-based)
- Referral statistics display
- More sophisticated invite code handling

**Action:** 🔄 **MERGE** - Combine both:
- Keep notifications UI from credit-request
- Keep referral system from main
- Merge both UI improvements

---

### 6. **Trust Points System** ⚠️ (Different implementations)

**credit-request:**
- Still uses hardcoded invite code (substring)
- No referral tracking
- Default profile pic: `/capybara_pfp.png`

**main:**
- API-based referral system
- Referral statistics
- Default profile pic: `/default_pfp.png`
- Default trust points: 0 (not 5)

**Action:** ✅ **USE MAIN** - Main has the correct referral-based system.

---

### 7. **Files Only in credit-request**

**Keep:**
- `app/api/wallet/notifications/route.ts` ✅
- `scripts/009_add_notifications.sql` ✅
- Notification UI components in `app/wallet/page.tsx` ✅

**Remove/Update:**
- Test files (can be removed)
- Debug files (can be removed)

---

### 8. **Files Only in main**

**Keep:**
- All MaxFlow integration files ✅
- Referral system files ✅
- EVM address linking ✅
- Trust points initialize endpoint ✅
- Vouches received endpoint ✅
- Credit eligibility endpoint ✅

---

## Merge Strategy

### Step 1: Merge main into credit-request
```bash
git checkout feature/credit-request
git merge main
```

### Step 2: Resolve conflicts
**Priority order:**
1. Keep referral system from main (API-based)
2. Keep notifications system from credit-request
3. Merge UI components (both have valuable features)
4. Keep MaxFlow integration from main
5. Use main's trust points system (0 default, referral-based)

### Step 3: Key files to merge carefully

**`app/wallet/page.tsx`:**
- ✅ Keep notifications state and UI from credit-request
- ✅ Keep referral system from main
- ✅ Merge both invite code sections (use main's API-based approach)
- ✅ Keep balance audit modal from credit-request
- ✅ Keep APY display from credit-request

**`app/wallet/profile/page.tsx`:**
- ✅ Keep MaxFlow integration from main
- ✅ Add notifications support if needed

**`app/api/wallet/trust-points/route.ts`:**
- ✅ Use main's version (has referral stats)

---

## Summary

### What to Keep from credit-request:
1. ✅ Notifications system (API + UI)
2. ✅ Balance audit modal
3. ✅ APY display integration
4. ✅ Notification bell button UI

### What to Keep from main:
1. ✅ Referral system (complete implementation)
2. ✅ MaxFlow integration (backend)
3. ✅ EVM address linking
4. ✅ Trust points system (0 default, referral-based)
5. ✅ All MaxFlow API endpoints

### What to Merge:
1. 🔄 Wallet page UI (combine notifications + referral system)
2. 🔄 Profile page (add MaxFlow to credit-request's simpler version)

---

## Next Steps

1. Merge main into credit-request branch
2. Resolve conflicts with priority on main's referral system
3. Ensure notifications work with referral system
4. Test both features together
5. Commit and push merged branch

