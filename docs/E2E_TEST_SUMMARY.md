# Auto-Deposit E2E Test Summary

## Test Endpoint

**URL:** `GET /api/test/auto-deposit-e2e`

**Query Parameters:**
- `update=true` - Actually update balance in database
- `trigger=true` - Actually trigger auto-deposit check

## Quick Test Commands

```bash
# 1. Basic E2E test (dry run)
http://localhost:3000/api/test/auto-deposit-e2e

# 2. Test balance update
http://localhost:3000/api/test/auto-deposit-e2e?update=true

# 3. Test auto-deposit trigger
http://localhost:3000/api/test/auto-deposit-e2e?trigger=true
```

## Test Coverage

The E2E test verifies:

1. ✅ **Wallet Retrieval** - Gets wallet from database
2. ✅ **Current Balance** - Fetches USDC balance from Stellar network
3. ✅ **Previous Balance** - Retrieves previous balance from database
4. ✅ **Balance Change** - Calculates balance difference
5. ✅ **Auto-Deposit Logic** - Determines if deposit should trigger
6. ✅ **Database Integration** - Verifies database schema and access
7. ✅ **Update Function** - Tests balance update in database
8. ✅ **Monitor Function** - Tests full auto-deposit monitoring

## Expected Flow

```
1. Get Wallet → Database
   ↓
2. Get Current Balance → Stellar Network
   ↓
3. Get Previous Balance → Database
   ↓
4. Calculate Balance Change
   ↓
5. Check Auto-Deposit Conditions
   - Balance increased?
   - Increase > minimum threshold?
   - Deposit amount > minimum?
   ↓
6. Trigger Auto-Deposit (if conditions met)
   ↓
7. Update Previous Balance → Database
   ↓
8. Save Balance Snapshot → Database
```

## Verification

After running tests, verify:

```sql
-- Check wallet balance updated
SELECT previous_usdc_balance, updated_at 
FROM stellar_wallets 
WHERE user_id = '<your_user_id>';

-- Check balance snapshots created
SELECT * FROM balance_snapshots 
WHERE user_id = '<your_user_id>'
ORDER BY created_at DESC 
LIMIT 5;
```

