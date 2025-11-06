# Balance Tracking Testing Guide

## Overview

This guide explains how to test the database-based balance tracking functionality that was implemented for auto-deposit.

---

## Test Endpoint

### GET `/api/test/balance-tracking`

**Purpose:** Tests all balance tracking functionality

**Authentication:** Required (must be logged in)

**Query Parameters:**

- `update=true` - Actually update the previous balance in database (dry run by default)
- `trigger=true` - Actually trigger auto-deposit check (dry run by default)

**Example:**

```bash
# Basic test (dry run)
curl http://localhost:3000/api/test/balance-tracking \
  -H "Authorization: Bearer <token>"

# Actually update balance
curl "http://localhost:3000/api/test/balance-tracking?update=true" \
  -H "Authorization: Bearer <token>"

# Actually trigger auto-deposit check
curl "http://localhost:3000/api/test/balance-tracking?trigger=true" \
  -H "Authorization: Bearer <token>"
```

---

## Test Coverage

### Test 1: Wallet with Previous Balance

- ✅ Verifies wallet exists
- ✅ Checks that `previousUsdcBalance` is returned
- ✅ Validates wallet data structure

### Test 2: Current USDC Balance

- ✅ Fetches current USDC balance from Stellar network
- ✅ Validates balance is a number

### Test 3: Database Schema

- ✅ Checks `previous_usdc_balance` column exists in `stellar_wallets`
- ✅ Checks `balance_snapshots` table exists
- ✅ Verifies RLS policies are working

### Test 4: Update Previous Balance Function

- ✅ Tests `updatePreviousUsdcBalance()` is callable
- ✅ Shows current vs previous balance
- ✅ Can actually update if `update=true` param is set

### Test 5: Monitor Balance Function

- ✅ Tests `monitorBalanceAndAutoDeposit()` is callable
- ✅ Shows balance change calculation
- ✅ Can actually trigger if `trigger=true` param is set

---

## Manual Testing Steps

### Step 1: Verify Database Schema

```sql
-- Check previous_usdc_balance column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'stellar_wallets'
AND column_name = 'previous_usdc_balance';

-- Check balance_snapshots table exists
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'balance_snapshots';

-- First, get your user_id (replace email with your actual email)
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- Or list all wallets to see yours
SELECT
  sw.user_id,
  sw.public_key,
  sw.previous_usdc_balance,
  sw.updated_at,
  p.email
FROM stellar_wallets sw
LEFT JOIN profiles p ON sw.user_id = p.id
ORDER BY sw.updated_at DESC;

-- Then check current balance (replace <UUID> with actual user_id from above)
SELECT
  user_id,
  public_key,
  previous_usdc_balance,
  updated_at
FROM stellar_wallets
WHERE user_id = '<UUID>';  -- Replace <UUID> with actual user_id
```

### Step 2: Run Test Endpoint

```bash
# Basic test
curl http://localhost:3000/api/test/balance-tracking \
  -H "Cookie: <your_auth_cookie>"
```

**Expected Response:**

```json
{
  "success": true,
  "message": "All balance tracking tests passed! ✅",
  "results": {
    "userId": "...",
    "timestamp": "2025-01-05T...",
    "tests": {
      "walletExists": true,
      "walletData": {
        "id": "...",
        "publicKey": "G...",
        "network": "testnet",
        "previousUsdcBalance": null
      },
      "currentBalance": 0,
      "databaseSchema": true,
      "databasePreviousBalance": null,
      "snapshotsTableExists": true,
      "snapshotsCount": 0,
      "updateFunction": {
        "canCall": true,
        "currentBalance": 0,
        "previousBalanceBefore": null
      },
      "monitorFunction": {
        "canCall": true,
        "currentBalance": 0,
        "previousBalance": null,
        "balanceChange": null
      }
    },
    "errors": [],
    "summary": {
      "allTestsPassed": true,
      "testsRun": 5,
      "errorsCount": 0
    }
  }
}
```

### Step 3: Update Previous Balance (Test)

```bash
# Update previous balance
curl "http://localhost:3000/api/test/balance-tracking?update=true" \
  -H "Cookie: <your_auth_cookie>"
```

**What This Does:**

1. Gets current USDC balance from Stellar network
2. Updates `previous_usdc_balance` in `stellar_wallets` table
3. Saves a balance snapshot to `balance_snapshots` table

**Verify Update:**

```sql
-- Check updated balance (replace <UUID> with actual user_id)
SELECT
  user_id,
  previous_usdc_balance,
  updated_at
FROM stellar_wallets
WHERE user_id = '<UUID>';  -- Replace <UUID> with actual user_id

-- Or easier: check all wallets (no user_id needed)
-- Note: email is in auth.users, not profiles
SELECT
  sw.user_id,
  u.email,
  p.username,
  sw.previous_usdc_balance,
  sw.updated_at
FROM stellar_wallets sw
LEFT JOIN auth.users u ON sw.user_id = u.id
LEFT JOIN profiles p ON sw.user_id = p.id
ORDER BY sw.updated_at DESC;

-- Check all recent snapshots (no user_id needed)
-- Note: email is in auth.users, not profiles
SELECT
  bs.user_id,
  u.email,
  p.username,
  bs.usdc_balance,
  bs.previous_balance,
  bs.auto_deposit_triggered,
  bs.created_at
FROM balance_snapshots bs
LEFT JOIN auth.users u ON bs.user_id = u.id
LEFT JOIN profiles p ON bs.user_id = p.id
ORDER BY bs.created_at DESC
LIMIT 5;
```

### Step 4: Test Auto-Deposit Monitoring

```bash
# Trigger auto-deposit check
curl "http://localhost:3000/api/test/balance-tracking?trigger=true" \
  -H "Cookie: <your_auth_cookie>"
```

**What This Does:**

1. Gets current balance from network
2. Gets previous balance from database
3. Compares balances to detect increase
4. Triggers auto-deposit if balance increased above threshold
5. Updates previous balance in database
6. Saves balance snapshot with auto-deposit details

---

## Integration Testing Scenarios

### Scenario 1: First Balance Check (No Previous Balance)

**Setup:**

- User has no previous balance recorded
- Current balance: 100 USDC

**Expected Behavior:**

- ✅ Previous balance: `null`
- ✅ Current balance: 100
- ✅ No auto-deposit triggered (no previous balance to compare)
- ✅ Previous balance updated to 100 in database
- ✅ Balance snapshot saved

**Test:**

```bash
curl "http://localhost:3000/api/test/balance-tracking?update=true" \
  -H "Cookie: <your_auth_cookie>"
```

---

### Scenario 2: Balance Increase (Auto-Deposit Trigger)

**Setup:**

- Previous balance: 100 USDC
- Current balance: 250 USDC
- Increase: 150 USDC (> $10 threshold)

**Expected Behavior:**

- ✅ Previous balance: 100
- ✅ Current balance: 250
- ✅ Balance increase detected: 150
- ✅ Auto-deposit triggered (150 > 10)
- ✅ Deposit amount calculated: 249 (250 - 1 fee buffer)
- ✅ Transaction hash returned
- ✅ Previous balance updated to 250
- ✅ Balance snapshot saved with auto-deposit details

**Test:**

```bash
# First, set previous balance to 100
# Then, send 250 USDC to wallet
# Then trigger check
curl "http://localhost:3000/api/test/balance-tracking?trigger=true" \
  -H "Cookie: <your_auth_cookie>"
```

---

### Scenario 3: Balance Decrease (No Auto-Deposit)

**Setup:**

- Previous balance: 250 USDC
- Current balance: 200 USDC
- Change: -50 USDC

**Expected Behavior:**

- ✅ Previous balance: 250
- ✅ Current balance: 200
- ✅ Balance decreased (no increase)
- ✅ No auto-deposit triggered
- ✅ Previous balance updated to 200
- ✅ Balance snapshot saved

**Test:**

```bash
curl "http://localhost:3000/api/test/balance-tracking?trigger=true" \
  -H "Cookie: <your_auth_cookie>"
```

---

### Scenario 4: Small Balance Increase (Below Threshold)

**Setup:**

- Previous balance: 100 USDC
- Current balance: 105 USDC
- Increase: 5 USDC (< $10 threshold)

**Expected Behavior:**

- ✅ Previous balance: 100
- ✅ Current balance: 105
- ✅ Balance increase detected: 5
- ✅ No auto-deposit triggered (5 < 10 threshold)
- ✅ Previous balance updated to 105
- ✅ Balance snapshot saved

---

## Verification Queries

### Check Balance Tracking Status

```sql
-- First, get your user_id from auth.users or profiles table
-- Option 1: Get from auth.users (if you know your email)
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- Option 2: Get from profiles table (if you know your email)
SELECT id, email FROM profiles WHERE email = 'your-email@example.com';

-- Option 3: List all users (for testing)
SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 10;

-- Then use the actual UUID to query:

-- Get wallet with previous balance (replace <UUID> with actual user_id)
SELECT
  id,
  user_id,
  public_key,
  previous_usdc_balance,
  updated_at
FROM stellar_wallets
WHERE user_id = '<UUID>';  -- Replace <UUID> with actual user_id from above

-- Get recent balance snapshots (replace <UUID> with actual user_id)
SELECT
  id,
  user_id,
  usdc_balance,
  previous_balance,
  balance_change,
  auto_deposit_triggered,
  deposit_amount,
  transaction_hash,
  snapshot_type,
  created_at
FROM balance_snapshots
WHERE user_id = '<UUID>'  -- Replace <UUID> with actual user_id
ORDER BY created_at DESC
LIMIT 10;

-- Get auto-deposit events (replace <UUID> with actual user_id)
SELECT
  created_at,
  usdc_balance,
  previous_balance,
  balance_change,
  deposit_amount,
  transaction_hash
FROM balance_snapshots
WHERE user_id = '<UUID>'  -- Replace <UUID> with actual user_id
AND auto_deposit_triggered = true
ORDER BY created_at DESC;

-- Get balance change history (replace <UUID> with actual user_id)
SELECT
  created_at,
  usdc_balance,
  previous_balance,
  balance_change,
  snapshot_type
FROM balance_snapshots
WHERE user_id = '<UUID>'  -- Replace <UUID> with actual user_id
ORDER BY created_at DESC
LIMIT 50;

-- Or query all wallets (easier for testing)
-- Note: email is in auth.users, not profiles
SELECT
  sw.user_id,
  u.email,
  p.username,
  p.display_name,
  sw.public_key,
  sw.previous_usdc_balance,
  sw.updated_at
FROM stellar_wallets sw
LEFT JOIN auth.users u ON sw.user_id = u.id
LEFT JOIN profiles p ON sw.user_id = p.id
ORDER BY sw.updated_at DESC;

-- Or query all balance snapshots (easier for testing)
-- Note: email is in auth.users, not profiles
SELECT
  bs.user_id,
  u.email,
  p.username,
  p.display_name,
  bs.usdc_balance,
  bs.previous_balance,
  bs.balance_change,
  bs.auto_deposit_triggered,
  bs.snapshot_type,
  bs.created_at
FROM balance_snapshots bs
LEFT JOIN auth.users u ON bs.user_id = u.id
LEFT JOIN profiles p ON bs.user_id = p.id
ORDER BY bs.created_at DESC
LIMIT 20;
```

---

## Troubleshooting

### Issue: "Wallet not found"

**Solution:**

1. Create a wallet first via `/api/wallet/stellar/create`
2. Or check if user has a wallet in database

### Issue: "Database schema check failed"

**Solution:**

1. Verify migration script was run: `scripts/007_add_balance_tracking.sql`
2. Check if `previous_usdc_balance` column exists
3. Check if `balance_snapshots` table exists

### Issue: "Service role key not configured"

**Solution:**

1. Set `SUPABASE_SERVICE_ROLE_KEY` environment variable
2. Required for database schema checks

### Issue: Previous balance not updating

**Solution:**

1. Check if `update=true` query param is set
2. Verify database permissions
3. Check RLS policies allow updates

### Issue: Balance snapshots not saving

**Solution:**

1. Verify RLS policies allow service role to insert
2. Check `balance_snapshots` table exists
3. Verify wallet_id is valid

---

## Testing Checklist

- [ ] Database migration script ran successfully
- [ ] `previous_usdc_balance` column exists
- [ ] `balance_snapshots` table exists
- [ ] Test endpoint returns success
- [ ] Wallet retrieval includes previous balance
- [ ] Current balance fetch works
- [ ] Update previous balance works
- [ ] Balance snapshots are saved
- [ ] Auto-deposit monitoring works
- [ ] Balance tracking persists across server restarts

---

## Next Steps

After verifying balance tracking works:

1. **Test Auto-Deposit Flow:**

   - Send USDC to wallet
   - Trigger auto-deposit check
   - Verify deposit transaction is created

2. **Monitor Production:**

   - Set up periodic job to call auto-deposit endpoint
   - Monitor balance snapshots table
   - Track auto-deposit success rate

3. **Analytics:**
   - Query balance snapshots for insights
   - Track balance changes over time
   - Monitor auto-deposit frequency

---

**Last Updated:** 2025-01-05  
**Status:** Ready for Testing
