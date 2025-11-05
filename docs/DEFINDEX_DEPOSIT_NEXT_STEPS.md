# DeFindex Blend Strategy Deposit - Next Steps

## Current Status

✅ **Completed:**

- Passkey authentication working and persisting
- Wallet balance display working with loading states
- Profile updates working
- DeFindex vault service structure created (`lib/defindex/vault.ts`)
- DeFindex API endpoints created (`/api/wallet/defindex/deposit`, `/api/wallet/defindex/balance`, `/api/wallet/defindex/apy`)
- Basic contract interaction functions implemented (simulation mode)

## Architecture Overview

**Key Design Principles:**

1. **Auto-Deposit First**: The primary purpose of the wallet is to automatically deposit funds into the DeFindex blend strategy
2. **Withdraw Only for Offramp**: Withdrawals from the strategy only occur when users want to offramp funds to MercadoPago
3. **Peanut Protocol for Offramp**: Use [Peanut Protocol SDK](https://github.com/peanutprotocol/peanut-sdk) for secure offramp withdrawals to MercadoPago accounts

## Next Steps to Enable Real Deposits

### Phase 1: Complete Soroban Contract Integration for Auto-Deposit (Priority: High)

**Goal:** Implement automatic deposit functionality that deposits funds into DeFindex strategy as soon as they arrive in the wallet

#### Key Requirements:

- **Automatic**: Deposits happen automatically when funds are received
- **No User Interaction**: Users don't need to manually trigger deposits
- **Seamless**: Funds flow from wallet → DeFindex strategy automatically

#### Tasks:

1. **Verify Soroban SDK Integration**

   - [ ] Check if `@stellar/stellar-sdk` supports Soroban contract calls
   - [ ] Verify contract address format and encoding
   - [ ] Test connection to Soroban RPC endpoint

2. **Implement Real Contract Invocations**

   - [ ] Replace simulation with actual transaction building
   - [ ] Implement proper transaction signing (using Turnkey wallet)
   - [ ] Add transaction submission to Stellar network
   - [ ] Handle transaction confirmation and error cases

3. **Complete Auto-Deposit Function**

   - [ ] Build actual deposit transaction with proper parameters
   - [ ] Sign transaction with user's wallet (via Turnkey)
   - [ ] Submit transaction to Soroban RPC
   - [ ] Wait for transaction confirmation
   - [ ] Update database with deposit record
   - [ ] **Critical**: Implement automatic triggering when funds are received

4. **Fund Detection & Auto-Deposit Trigger**
   - [ ] Monitor wallet balance changes (polling or webhook)
   - [ ] Detect when USDC balance increases
   - [ ] Automatically trigger deposit to DeFindex strategy
   - [ ] Handle edge cases (minimum deposit amounts, network fees, etc.)
   - [ ] Implement retry logic for failed deposits

**Files to Modify:**

- `lib/defindex/vault.ts` - Complete `depositToStrategy()` function with auto-trigger
- `lib/turnkey/stellar-wallet.ts` - Add transaction signing capability
- `app/api/wallet/defindex/deposit/route.ts` - Add transaction submission logic
- `app/api/wallet/stellar/balance/route.ts` - Add balance change detection and auto-deposit trigger

**Dependencies:**

- Soroban RPC endpoint configured
- DeFindex strategy contract address
- User wallet signing capability (Turnkey)
- Balance monitoring system (polling or webhook)

---

### Phase 2: Database Schema for Strategy Positions (Priority: High)

**Goal:** Track user deposits and shares in the database

#### Tasks:

1. **Create Database Tables**

   ```sql
   -- Strategy positions table
   CREATE TABLE defindex_positions (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
     strategy_address TEXT NOT NULL,
     shares DECIMAL(20, 7) NOT NULL DEFAULT 0,
     total_deposited DECIMAL(20, 7) NOT NULL DEFAULT 0,
     total_withdrawn DECIMAL(20, 7) NOT NULL DEFAULT 0,
     last_deposit_at TIMESTAMP WITH TIME ZONE,
     last_withdrawal_at TIMESTAMP WITH TIME ZONE,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     UNIQUE(user_id, strategy_address)
   );

   -- Strategy transactions table
   CREATE TABLE defindex_transactions (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
     position_id UUID REFERENCES defindex_positions(id) ON DELETE CASCADE,
     transaction_hash TEXT NOT NULL UNIQUE,
     transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deposit', 'withdraw', 'harvest')),
     amount DECIMAL(20, 7) NOT NULL,
     shares DECIMAL(20, 7),
     strategy_address TEXT NOT NULL,
     status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     confirmed_at TIMESTAMP WITH TIME ZONE,
     error_message TEXT
   );

   -- Indexes
   CREATE INDEX idx_defindex_positions_user_id ON defindex_positions(user_id);
   CREATE INDEX idx_defindex_transactions_user_id ON defindex_transactions(user_id);
   CREATE INDEX idx_defindex_transactions_hash ON defindex_transactions(transaction_hash);
   CREATE INDEX idx_defindex_transactions_status ON defindex_transactions(status);
   ```

2. **Create Migration Script**
   - [ ] Create `scripts/007_add_defindex_positions.sql`
   - [ ] Add RLS policies for user data access
   - [ ] Test migration on development database

**Files to Create:**

- `scripts/007_add_defindex_positions.sql`

---

### Phase 3: Peanut Protocol Offramp Integration (Priority: High)

**Goal:** Integrate Peanut Protocol SDK for secure offramp withdrawals to MercadoPago

#### Key Requirements:
- **Offramp Only**: Withdrawals only happen when user requests offramp to MercadoPago
- **Peanut Protocol**: Use [Peanut Protocol SDK](https://github.com/peanutprotocol/peanut-sdk) for secure withdrawal process
- **MercadoPago Integration**: Connect to MercadoPago for fiat conversion and payout

#### Tasks:

1. **Install and Setup Peanut Protocol SDK**
   - [ ] Install `@squirrel-labs/peanut-sdk` package: `npm install @squirrel-labs/peanut-sdk`
   - [ ] Review Peanut Protocol SDK documentation: https://github.com/peanutprotocol/peanut-sdk
   - [ ] Understand SDK API methods and integration patterns
   - [ ] Configure Peanut Protocol API endpoints

2. **Implement Withdrawal via Peanut Protocol**
   - [ ] Create withdrawal function using Peanut Protocol SDK
   - [ ] Integrate with DeFindex strategy withdrawal
   - [ ] Handle withdrawal transaction signing via Turnkey
   - [ ] Process withdrawal to user's MercadoPago account
   - [ ] Generate secure withdrawal links using Peanut Protocol

3. **MercadoPago Integration**
   - [ ] Research MercadoPago API for receiving funds
   - [ ] Implement MercadoPago account linking
   - [ ] Handle fiat conversion (USDC → ARS via MercadoPago)
   - [ ] Process withdrawal requests to MercadoPago
   - [ ] Handle MercadoPago webhooks for payment confirmations

4. **Offramp UI/UX**
   - [ ] Add "Withdraw to MercadoPago" button in wallet
   - [ ] Show withdrawal form (amount, MercadoPago account)
   - [ ] Display withdrawal status and confirmation
   - [ ] Show withdrawal history
   - [ ] Display Peanut Protocol secure link generation

**Files to Create:**
- `lib/peanut/offramp.ts` - Peanut Protocol integration for offramp
- `lib/mercadopago/client.ts` - MercadoPago API integration
- `app/api/wallet/offramp/route.ts` - Offramp API endpoint
- `app/api/wallet/offramp/mercadopago/route.ts` - MercadoPago webhook handler

**Files to Modify:**
- `lib/defindex/vault.ts` - Update `withdrawFromStrategy()` to integrate with Peanut Protocol
- `app/wallet/page.tsx` - Add offramp UI components
- `lib/turnkey/stellar-wallet.ts` - Add withdrawal transaction signing

**Dependencies:**
- Peanut Protocol SDK: `npm install @squirrel-labs/peanut-sdk`
- MercadoPago API credentials
- Soroban RPC endpoint for withdrawals
- Turnkey wallet signing for withdrawals

**Database Changes:**
- Add `mercadopago_account_id` to profiles table (optional, for linking)
- Create `offramp_transactions` table to track withdrawal history

---

### Phase 4: Balance Aggregation (Priority: Medium)

**Goal:** Show combined wallet + strategy balance to users

#### Tasks:

1. **Update Balance Service**

   - [ ] Modify `getVaultBalance()` to query both wallet and strategy
   - [ ] Cache results with TTL (5-10 minutes)
   - [ ] Handle errors gracefully (show wallet balance if strategy query fails)

2. **Update Wallet Page**

   - [ ] Display total balance (wallet + strategy)
   - [ ] Show breakdown: "In Wallet: X USDC" + "In Strategy: Y USDC"
   - [ ] Update balance display component

3. **Real-time Updates**
   - [ ] Poll for balance updates every 30 seconds
   - [ ] Update UI when balance changes
   - [ ] Show loading state during updates

**Files to Modify:**

- `lib/defindex/vault.ts` - Update `getVaultBalance()` function
- `app/wallet/page.tsx` - Update balance display
- `app/api/wallet/defindex/balance/route.ts` - Return aggregated balance

---

### Phase 5: Transaction Signing with Turnkey (Priority: High)

**Goal:** Sign transactions using user's Turnkey wallet

#### Tasks:

1. **Turnkey Transaction Signing**

   - [ ] Research Turnkey transaction signing API
   - [ ] Implement transaction signing via Turnkey
   - [ ] Handle transaction approval workflow
   - [ ] Store signed transactions

2. **Transaction Flow**
   - [ ] Build transaction with deposit parameters
   - [ ] Request signature from Turnkey
   - [ ] Submit signed transaction to Soroban RPC
   - [ ] Monitor transaction status
   - [ ] Update database on confirmation

**Files to Modify:**

- `lib/turnkey/stellar-wallet.ts` - Add transaction signing
- `lib/defindex/vault.ts` - Integrate Turnkey signing
- `app/api/wallet/defindex/deposit/route.ts` - Use Turnkey signing

**Dependencies:**

- Turnkey API for transaction signing
- Turnkey wallet ID for user
- Transaction signing permissions

---

### Phase 6: Testing & Validation (Priority: High)

**Goal:** Ensure deposits work correctly on testnet

#### Tasks:

1. **Test Deposit Flow**

   - [ ] Test with testnet DeFindex strategy
   - [ ] Verify deposit transaction submission
   - [ ] Confirm shares are received
   - [ ] Verify balance updates correctly

2. **Test Withdrawal Flow**

   - [ ] Test withdrawing from strategy
   - [ ] Verify funds are returned to wallet
   - [ ] Confirm shares are reduced correctly

3. **Test Error Cases**

   - [ ] Insufficient balance
   - [ ] Network errors
   - [ ] Contract errors
   - [ ] Transaction failures

4. **Integration Testing**
   - [ ] End-to-end deposit flow
   - [ ] Auto-deposit on funds received
   - [ ] Balance aggregation
   - [ ] UI updates

---

## Environment Variables Needed

```env
# Soroban RPC Configuration
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
# or for mainnet: https://soroban-mainnet.stellar.org

# DeFindex Strategy Contract Address
DEFINDEX_STRATEGY_ADDRESS=<contract_address>
# Example: CDLZFC3SYJYDZT7K67VZRVHPXWS62KQBXEFCM2IBHQKHI4P273XMUAWL

# Asset Contract Address (USDC)
TESTNET_USDC_CONTRACT_ADDRESS=<usdc_contract_address>
MAINNET_USDC_CONTRACT_ADDRESS=<usdc_contract_address>

# Turnkey Configuration (for transaction signing)
TURNKEY_API_KEY=<api_key>
TURNKEY_API_URL=<api_url>

# Peanut Protocol Configuration (for offramp)
PEANUT_PROTOCOL_API_URL=<api_url>
PEANUT_PROTOCOL_API_KEY=<api_key>

# MercadoPago Configuration (for offramp)
MERCADOPAGO_ACCESS_TOKEN=<access_token>
MERCADOPAGO_PUBLIC_KEY=<public_key>
MERCADOPAGO_API_URL=https://api.mercadopago.com
```

---

## Implementation Order (Recommended)

1. **Week 1:**

   - Complete Soroban contract integration (Phase 1)
   - Create database schema (Phase 2)
   - Test basic deposit on testnet

2. **Week 2:**

   - Implement Turnkey transaction signing (Phase 5)
   - Complete deposit flow end-to-end
   - Test deposit/withdrawal flows

3. **Week 3:**

   - Implement auto-deposit logic (Phase 3)
   - Implement balance aggregation (Phase 4)
   - Update UI with balance breakdown

4. **Week 4:**
   - Comprehensive testing (Phase 6)
   - Bug fixes and optimizations
   - Documentation updates

---

## Key Considerations

1. **Security:**

   - All transactions must be signed by user's wallet
   - Never store private keys
   - Validate all amounts before deposit
   - Implement rate limiting for deposits

2. **User Experience:**

   - Show clear loading states
   - Display transaction status
   - Provide error messages
   - Allow users to opt-out of auto-deposit

3. **Performance:**

   - Cache strategy balances (5-10 min TTL)
   - Batch balance queries when possible
   - Optimize Soroban RPC calls

4. **Error Handling:**
   - Handle network failures gracefully
   - Retry failed transactions
   - Log all errors for debugging
   - Inform users of transaction status

---

## References

- [DeFindex Documentation](https://docs.defindex.io)
- [DeFindex Strategy Interface](https://docs.defindex.io/strategy-developers/03-how-to-create-a-strategy)
- [Soroban Documentation](https://soroban.stellar.org/docs)
- [Stellar SDK Documentation](https://stellar.github.io/js-stellar-sdk/)
- [Turnkey Documentation](https://docs.turnkey.com)
- [Peanut Protocol SDK](https://github.com/peanutprotocol/peanut-sdk) - For secure offramp withdrawals
- [MercadoPago API Documentation](https://www.mercadopago.com/developers/en/docs)

---

**Last Updated:** 2025-01-05  
**Status:** Ready for implementation  
**Next Milestone:** Complete Soroban contract integration
