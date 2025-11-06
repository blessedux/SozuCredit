# Auto-Deposit E2E Test Guide

## Overview

This guide walks you through the final end-to-end test for the auto-deposit feature.

## Test Endpoint

**URL:** `GET /api/test/auto-deposit-e2e`

**Query Parameters:**
- `update=true` - Actually update balance in database
- `trigger=true` - Actually trigger auto-deposit check

## Test Steps

### Step 1: Run Basic E2E Test

```bash
# In browser (while logged in):
http://localhost:3000/api/test/auto-deposit-e2e
```

**This tests:**
1. ✅ Wallet retrieval
2. ✅ Current balance fetch
3. ✅ Previous balance retrieval from database
4. ✅ Balance change calculation
5. ✅ Auto-deposit trigger logic
6. ✅ Database integration
7. ✅ Update function (dry run)
8. ✅ Monitor function (dry run)

### Step 2: Test Balance Update

```bash
# Actually update balance in database
http://localhost:3000/api/test/auto-deposit-e2e?update=true
```

**This will:**
- Update `previous_usdc_balance` in database
- Save balance snapshot
- Verify database persistence

### Step 3: Test Auto-Deposit Trigger

```bash
# Actually trigger auto-deposit check
http://localhost:3000/api/test/auto-deposit-e2e?trigger=true
```

**This will:**
- Run full auto-deposit monitoring
- Check for balance increases
- Trigger deposit if conditions met
- Save all data to database

### Step 4: Verify Database

After running tests, verify data in database:

```sql
-- Check wallet balance
SELECT 
  sw.user_id,
  u.email,
  sw.previous_usdc_balance,
  sw.updated_at
FROM stellar_wallets sw
LEFT JOIN auth.users u ON sw.user_id = u.id
WHERE sw.user_id = '<your_user_id>';

-- Check balance snapshots
SELECT 
  bs.user_id,
  u.email,
  bs.usdc_balance,
  bs.previous_balance,
  bs.balance_change,
  bs.auto_deposit_triggered,
  bs.snapshot_type,
  bs.created_at
FROM balance_snapshots bs
LEFT JOIN auth.users u ON bs.user_id = u.id
WHERE bs.user_id = '<your_user_id>'
ORDER BY bs.created_at DESC
LIMIT 10;
```

## Expected Results

### All Tests Pass
```json
{
  "success": true,
  "message": "✅ All E2E test steps passed! Auto-deposit feature is ready.",
  "results": {
    "testSteps": [
      { "step": 1, "name": "Get Wallet", "status": "passed" },
      { "step": 2, "name": "Get Current Balance", "status": "passed" },
      { "step": 3, "name": "Get Previous Balance", "status": "passed" },
      { "step": 4, "name": "Calculate Balance Change", "status": "passed" },
      { "step": 5, "name": "Auto-Deposit Trigger Logic", "status": "passed" },
      { "step": 6, "name": "Database Integration", "status": "passed" },
      { "step": 7, "name": "Update Previous Balance", "status": "passed" },
      { "step": 8, "name": "Monitor Balance and Auto-Deposit", "status": "passed" }
    ],
    "summary": {
      "allStepsPassed": true,
      "willTriggerAutoDeposit": false,
      "currentBalance": 0,
      "previousBalance": null
    }
  }
}
```

## Test Checklist

- [ ] E2E test endpoint accessible
- [ ] All 8 test steps pass
- [ ] Balance update works (`?update=true`)
- [ ] Auto-deposit trigger works (`?trigger=true`)
- [ ] Database shows updated balances
- [ ] Balance snapshots are saved
- [ ] No errors in console
- [ ] All functions operational

## Ready for Commit

Once all tests pass:
1. ✅ All code working
2. ✅ Database integration verified
3. ✅ E2E tests passing
4. ✅ Ready to commit

