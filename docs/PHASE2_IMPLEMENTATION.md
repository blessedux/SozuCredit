# Phase 2 Implementation Summary - Database Schema for Strategy Positions

## Overview

Phase 2 implements database tracking for user positions in DeFindex strategies and all transactions (deposits, withdrawals, harvests). This provides a complete audit trail and enables position management features.

---

## Database Schema

### Tables Created

#### 1. `defindex_positions` Table

Tracks user's position (shares) in each DeFindex strategy.

**Columns:**

- `id` - UUID primary key
- `user_id` - References auth.users
- `strategy_address` - Strategy contract address
- `shares` - Number of shares user owns
- `total_deposited` - Total amount deposited over time
- `total_withdrawn` - Total amount withdrawn over time
- `last_deposit_at` - Timestamp of last deposit
- `last_withdrawal_at` - Timestamp of last withdrawal
- `created_at` - Position creation timestamp
- `updated_at` - Last update timestamp

**Unique Constraint:** `(user_id, strategy_address)` - One position per user per strategy

#### 2. `defindex_transactions` Table

Tracks all transactions (deposits, withdrawals, harvests) for audit and history.

**Columns:**

- `id` - UUID primary key
- `user_id` - References auth.users
- `position_id` - References defindex_positions (optional)
- `transaction_hash` - Unique Stellar transaction hash
- `transaction_type` - Type: 'deposit', 'withdraw', or 'harvest'
- `amount` - Transaction amount
- `shares` - Shares received/spent (for deposits/withdrawals)
- `strategy_address` - Strategy contract address
- `status` - Status: 'pending', 'confirmed', or 'failed'
- `created_at` - Transaction creation timestamp
- `confirmed_at` - Transaction confirmation timestamp
- `error_message` - Error message if failed

**Unique Constraint:** `transaction_hash` - One transaction per hash

---

## Database Functions

### `update_position_on_deposit()`

Updates or creates position after a deposit.

**Parameters:**

- `p_user_id` - User ID
- `p_strategy_address` - Strategy address
- `p_amount` - Deposit amount
- `p_shares` - Shares received

**Returns:** Position ID

**Functionality:**

- Creates position if it doesn't exist
- Updates existing position with new shares and amount
- Updates `last_deposit_at` timestamp

### `update_position_on_withdrawal()`

Updates position after a withdrawal.

**Parameters:**

- `p_user_id` - User ID
- `p_strategy_address` - Strategy address
- `p_amount` - Withdrawal amount
- `p_shares` - Shares spent

**Returns:** Position ID

**Functionality:**

- Decrements shares
- Increments total_withdrawn
- Updates `last_withdrawal_at` timestamp

---

## Code Implementation

### New Module: `lib/defindex/positions.ts`

**Functions:**

1. **`getOrCreatePosition()`** - Get or create position for user/strategy
2. **`updatePositionOnDeposit()`** - Update position after deposit
3. **`saveTransaction()`** - Save transaction record
4. **`updateTransactionStatus()`** - Update transaction status
5. **`getUserPosition()`** - Get user's position for a strategy
6. **`getUserTransactions()`** - Get user's transaction history

### Updated: `lib/defindex/vault.ts`

**Changes to `depositToStrategy()`:**

- ✅ Saves transaction record after submission (even if failed)
- ✅ Updates position after successful deposit
- ✅ Links transaction to position
- ✅ Handles errors gracefully (doesn't fail deposit if DB save fails)
- ✅ Updates transaction status when confirmed

**Flow:**

```
1. Submit transaction to network
   ↓
2. If failed → Save failed transaction record
   ↓
3. If succeeded → Update position
   ↓
4. Save transaction record (confirmed)
   ↓
5. Link transaction to position
```

---

## Integration Points

### 1. Deposit Flow

**File:** `lib/defindex/vault.ts`

When `depositToStrategy()` succeeds:

1. Transaction submitted to network
2. Transaction record saved (status: pending/failed/confirmed)
3. Position updated (shares + amount)
4. Transaction linked to position

### 2. Auto-Deposit Flow

**File:** `lib/defindex/auto-deposit.ts`

When auto-deposit triggers:

1. Calls `depositToStrategy()`
2. Position and transaction automatically saved by `depositToStrategy()`
3. No additional changes needed

---

## Security Features

### Row Level Security (RLS)

**`defindex_positions` policies:**

- Users can view/insert/update their own positions
- Service role can manage all positions (for background jobs)

**`defindex_transactions` policies:**

- Users can view/insert their own transactions
- Service role can manage all transactions (for background jobs)

### Indexes

**Performance indexes created:**

- `idx_defindex_positions_user_id` - Fast user lookups
- `idx_defindex_positions_strategy` - Fast strategy lookups
- `idx_defindex_positions_user_strategy` - Fast user+strategy lookups
- `idx_defindex_transactions_user_id` - Fast user transaction lookups
- `idx_defindex_transactions_hash` - Fast transaction hash lookups
- `idx_defindex_transactions_status` - Fast status filtering
- `idx_defindex_transactions_type` - Fast type filtering
- `idx_defindex_transactions_created_at` - Fast date sorting

---

## Migration Script

**File:** `scripts/008_add_defindex_positions.sql`

**To Run:**

```sql
-- In Supabase SQL Editor:
-- Copy and paste contents of scripts/008_add_defindex_positions.sql
```

**What It Does:**

1. Creates `defindex_positions` table
2. Creates `defindex_transactions` table
3. Adds RLS policies
4. Creates indexes
5. Creates database functions
6. Grants permissions

---

## Testing

### Test Endpoints

**Position Management:**

- Functions in `lib/defindex/positions.ts` can be tested via API calls
- Deposit endpoint automatically tests position tracking

**Verify in Database:**

```sql
-- Check positions
SELECT * FROM defindex_positions
WHERE user_id = '<user_id>';

-- Check transactions
SELECT * FROM defindex_transactions
WHERE user_id = '<user_id>'
ORDER BY created_at DESC;
```

### Test Flow

1. **Make a deposit:**

   ```bash
   POST /api/wallet/defindex/deposit
   Body: { "amount": 10.0 }
   ```

2. **Verify position created:**

   ```sql
   SELECT * FROM defindex_positions
   WHERE user_id = '<user_id>';
   ```

3. **Verify transaction saved:**
   ```sql
   SELECT * FROM defindex_transactions
   WHERE user_id = '<user_id>'
   AND transaction_type = 'deposit';
   ```

---

## Benefits

### ✅ Complete Audit Trail

- All transactions recorded with full details
- Transaction status tracking
- Error message logging

### ✅ Position Tracking

- User shares tracked per strategy
- Total deposited/withdrawn tracked
- Historical position data

### ✅ Performance

- Indexed queries for fast lookups
- Optimized for common queries
- Efficient position updates

### ✅ Production Ready

- RLS policies for security
- Error handling for database failures
- Non-blocking database saves (doesn't fail deposits)

---

## Next Steps

### Completed

- ✅ Database schema created
- ✅ Position management functions
- ✅ Transaction tracking
- ✅ Integration with deposit flow
- ✅ Error handling

### Future Enhancements

- [ ] Withdrawal position tracking
- [ ] Harvest transaction tracking
- [ ] Position history/analytics
- [ ] Transaction retry logic
- [ ] Webhook for transaction confirmations

---

## Files Summary

### New Files

- `scripts/008_add_defindex_positions.sql` - Migration script
- `lib/defindex/positions.ts` - Position management module

### Modified Files

- `lib/defindex/vault.ts` - Added position/transaction tracking

### Total Changes

- **2 new files** created
- **1 file** modified
- **~500 lines** of new code

---

**Status:** ✅ Phase 2 Complete - Ready for Testing  
**Last Updated:** 2025-01-06
