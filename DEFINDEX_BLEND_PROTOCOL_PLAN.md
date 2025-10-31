# Defindex/Blend Protocol Integration Plan

## Stellar Smart Wallet + USDC Yield Vault Strategy

## Overview

Implement a DeFi integration strategy that enables users to:

- Receive funds in Stellar smart wallets
- Display USDC balance in their Sozu Credit wallet
- Automatically deposit USDC into a yield-generating vault (defivault)
- Earn 10-20% APY on USDC holdings by default

## Architecture Components

### 1. Stellar Smart Wallet Layer

- **Purpose**: Receive and manage funds on Stellar blockchain
- **Technology**: Stellar SDK + Soroban smart contracts (if needed)
- **Features**:
  - Automated wallet creation per user
  - USDC asset management
  - Transaction signing and submission
  - Balance queries

### 2. DeFi Vault Integration (Defivault)

- **Purpose**: Generate yield on deposited USDC
- **Protocol Options**:
  - **Stellar AMM**: Stellar's native Automated Market Maker
  - **Blend Protocol**: Stellar-based DeFi lending protocol
  - **Other Stellar DeFi**: Existing liquidity pools/yield farms
- **Yield Target**: 10-20% APY on USDC

### 3. Balance Display System

- **Purpose**: Show users their USDC balance (even when in vault)
- **Data Flow**:
  - Query Stellar wallet → Get USDC balance
  - Query vault → Get deposited amount
  - Display total = wallet balance + vault balance

## Technology Stack

### Blockchain & Wallet

- **Stellar SDK**: `stellar-sdk` or `@stellar/stellar-sdk`
- **Soroban SDK**: For smart contract interactions (if using Soroban)
- **Horizon API**: Stellar's network API for queries
- **Freighter Wallet**: For user wallet management (optional browser extension)

### DeFi Integration

- **Protocol SDK**: Blend protocol SDK or Stellar AMM SDK
- **Liquidity Pool Contracts**: Interact with Stellar AMM pools
- **Yield Calculation**: Real-time APY from protocol

### Backend Services

- **Wallet Manager Service**: Create and manage Stellar wallets per user
- **Vault Service**: Handle deposits/withdrawals to/from yield vault
- **Balance Aggregator**: Combine wallet + vault balances
- **Yield Calculator**: Calculate and display APY

## Database Schema Updates

### New Tables

```sql
-- Stellar Wallets Table
CREATE TABLE stellar_wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL UNIQUE,
  secret_key_encrypted TEXT NOT NULL, -- Encrypted with user's master key
  network TEXT DEFAULT 'testnet', -- 'testnet' or 'mainnet'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- USDC Holdings Table
CREATE TABLE usdc_holdings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_balance NUMERIC(20, 7) DEFAULT 0, -- USDC in wallet
  vault_balance NUMERIC(20, 7) DEFAULT 0, -- USDC in defivault
  total_balance NUMERIC(20, 7) GENERATED ALWAYS AS (wallet_balance + vault_balance) STORED,
  last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Vault Deposits Table
CREATE TABLE vault_deposits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_hash TEXT NOT NULL UNIQUE, -- Stellar transaction hash
  amount NUMERIC(20, 7) NOT NULL,
  vault_protocol TEXT NOT NULL, -- 'blend', 'stellar_amm', etc.
  apy NUMERIC(5, 2), -- Current APY at time of deposit
  deposit_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  withdrawal_date TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'active', -- 'active', 'withdrawn', 'pending'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Yield Earnings Table
CREATE TABLE yield_earnings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vault_deposit_id UUID REFERENCES vault_deposits(id),
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  earnings NUMERIC(20, 7) NOT NULL,
  apy NUMERIC(5, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Implementation Phases

### Phase 1: Stellar Wallet Infrastructure (Week 1-2)

**Goals**: Create and manage Stellar wallets for users

#### Tasks:

1. **Install Stellar SDK**

   ```bash
   npm install @stellar/stellar-sdk
   ```

2. **Create Wallet Service** (`lib/stellar/wallet.ts`)

   - Generate Stellar keypairs
   - Create funded accounts (via friendbot on testnet)
   - Store encrypted keys securely
   - Implement wallet creation API

3. **Wallet Management API** (`app/api/wallet/stellar/create/route.ts`)

   - Endpoint: `POST /api/wallet/stellar/create`
   - Creates wallet for authenticated user
   - Stores encrypted keys in database
   - Returns public key

4. **Integration with User Registration**
   - Auto-create Stellar wallet when user signs up
   - Link wallet to user account

**Deliverables**:

- ✅ Stellar wallet creation working
- ✅ Encrypted key storage
- ✅ Wallet retrieval by user

### Phase 2: USDC Asset Setup (Week 2-3)

**Goals**: Configure USDC on Stellar network

#### Tasks:

1. **USDC Asset Configuration**

   - USDC issuer on Stellar (Circle's USDC)
   - Asset code: `USDC`
   - Add trustline for USDC to user wallets

2. **USDC Balance Query** (`app/api/wallet/stellar/balance/route.ts`)

   - Endpoint: `GET /api/wallet/stellar/balance`
   - Queries Stellar wallet for USDC balance
   - Returns balance in USDC format

3. **Transaction Monitoring**
   - Webhook or polling for incoming USDC
   - Update `usdc_holdings` table when funds arrive

**Deliverables**:

- ✅ USDC trustlines set up
- ✅ Balance queries working
- ✅ Real-time balance updates

### Phase 3: DeFi Vault Integration (Week 3-5)

**Goals**: Integrate with yield-generating protocol

#### Tasks:

1. **Research & Select Protocol**

   - Evaluate Stellar AMM vs Blend Protocol vs others
   - Choose based on:
     - APY (target: 10-20%)
     - Security
     - Liquidity
     - Integration complexity

2. **Protocol SDK Integration**

   - Install protocol SDK
   - Create vault service (`lib/stellar/vault.ts`)
   - Implement deposit function
   - Implement withdrawal function
   - Implement balance query

3. **Auto-Deposit Logic**

   - Default behavior: Auto-deposit incoming USDC to vault
   - Configurable: User can opt-out of auto-deposit
   - Minimum deposit amount: e.g., $10 USDC

4. **Vault API Endpoints**
   - `POST /api/wallet/vault/deposit` - Deposit USDC to vault
   - `POST /api/wallet/vault/withdraw` - Withdraw from vault
   - `GET /api/wallet/vault/balance` - Get vault balance
   - `GET /api/wallet/vault/apy` - Get current APY

**Deliverables**:

- ✅ Vault deposits working
- ✅ Vault withdrawals working
- ✅ APY display
- ✅ Auto-deposit on receipt

### Phase 4: Balance Aggregation & Display (Week 4-5)

**Goals**: Show combined wallet + vault balance to users

#### Tasks:

1. **Balance Aggregator Service** (`lib/stellar/balance.ts`)

   - Query Stellar wallet balance
   - Query vault balance
   - Combine totals
   - Cache results (5-10 minute TTL)

2. **Update Vault API** (`app/api/wallet/vault/route.ts`)

   - Include vault balance in response
   - Calculate total balance
   - Include yield information

3. **Frontend Updates** (`app/wallet/page.tsx`)
   - Display USDC balance (wallet + vault)
   - Show breakdown: "In Wallet: X USDC" + "In Vault: Y USDC"
   - Display current APY
   - Show estimated daily/monthly earnings

**Deliverables**:

- ✅ Combined balance display
- ✅ Balance breakdown
- ✅ APY display
- ✅ Earnings calculator

### Phase 5: Yield Tracking & Reporting (Week 5-6)

**Goals**: Track and display yield earnings

#### Tasks:

1. **Yield Calculation Service**

   - Calculate daily yield based on APY
   - Track historical earnings
   - Update `yield_earnings` table

2. **Yield Cron Job** (`app/api/cron/yield/route.ts`)

   - Run daily to calculate and record yield
   - Update `usdc_holdings.vault_balance`
   - Record in `yield_earnings` table

3. **Yield Display**
   - Total earnings over time
   - Daily earnings
   - Historical APY chart (optional)

**Deliverables**:

- ✅ Daily yield tracking
- ✅ Earnings history
- ✅ Yield reporting UI

### Phase 6: Security & Optimization (Week 6-7)

**Goals**: Secure implementation and optimize performance

#### Tasks:

1. **Key Management Security**

   - Review encryption of secret keys
   - Implement key rotation (if needed)
   - Multi-signature support (optional, for large amounts)

2. **Transaction Security**

   - Require user confirmation for withdrawals
   - Rate limiting on transactions
   - Maximum withdrawal limits

3. **Performance Optimization**
   - Balance caching
   - Batch queries
   - WebSocket for real-time updates (optional)

**Deliverables**:

- ✅ Security audit
- ✅ Performance benchmarks
- ✅ Rate limiting
- ✅ Error handling

## API Endpoints Summary

### Wallet Management

- `POST /api/wallet/stellar/create` - Create Stellar wallet
- `GET /api/wallet/stellar/balance` - Get wallet USDC balance
- `GET /api/wallet/stellar/address` - Get wallet public key

### Vault Management

- `POST /api/wallet/vault/deposit` - Deposit USDC to vault
- `POST /api/wallet/vault/withdraw` - Withdraw from vault
- `GET /api/wallet/vault/balance` - Get vault balance + total
- `GET /api/wallet/vault/apy` - Get current APY
- `GET /api/wallet/vault/earnings` - Get yield earnings history

### Combined Balance

- `GET /api/wallet/balance` - Get total USDC balance (wallet + vault)

## Frontend Components

### New Components Needed

1. **USDCBalanceDisplay** - Shows total USDC (wallet + vault)
2. **VaultStatusCard** - Shows vault balance and APY
3. **YieldEarningsChart** - Historical earnings visualization
4. **VaultDepositForm** - Manual deposit interface
5. **VaultWithdrawForm** - Withdrawal interface

### Updated Components

1. **WalletPage** - Add USDC balance section
2. **VaultPage** - Show defivault-specific info

## Configuration

### Environment Variables

```env
# Stellar Network
STELLAR_NETWORK=testnet  # or 'mainnet'
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org

# USDC Asset
USDC_ASSET_CODE=USDC
USDC_ISSUER=GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN

# Vault Protocol
VAULT_PROTOCOL=blend  # or 'stellar_amm'
VAULT_POOL_ID=...
VAULT_MIN_DEPOSIT=10  # Minimum USDC to deposit

# Security
ENCRYPTION_KEY=...  # For encrypting Stellar secret keys
```

## Testing Strategy

### Unit Tests

- Wallet creation
- Balance queries
- Vault deposit/withdraw
- Yield calculations

### Integration Tests

- End-to-end flow: receive USDC → auto-deposit → earn yield
- Withdrawal flow
- Balance aggregation

### Testnet Testing

- Use Stellar testnet for all development
- Test with testnet USDC (mock or test asset)
- Verify all flows before mainnet deployment

## Security Considerations

1. **Key Storage**: Never store unencrypted secret keys
2. **Transaction Signing**: Server-side signing only (never expose keys to frontend)
3. **Withdrawal Limits**: Implement daily/monthly limits
4. **Multi-Sig**: Consider multi-signature for large holdings
5. **Audit**: Regular security audits of wallet operations

## Future Enhancements

1. **Multiple Assets**: Support other Stellar assets (XLM, other stablecoins)
2. **Vault Options**: Multiple vault options with different APYs
3. **Liquidity Staking**: Additional yield strategies
4. **Mobile App**: Native mobile wallet support
5. **DeFi Aggregator**: Best yield finder across protocols

## Resources & Documentation

- **Stellar Documentation**: https://developers.stellar.org/
- **Stellar SDK**: https://github.com/stellar/js-stellar-sdk
- **Soroban Docs**: https://soroban.stellar.org/docs
- **Stellar AMM**: https://developers.stellar.org/docs/defi/amm
- **Blend Protocol**: (If using - get docs)

## Timeline Estimate

- **Phase 1**: 2 weeks
- **Phase 2**: 1-2 weeks
- **Phase 3**: 2-3 weeks
- **Phase 4**: 1-2 weeks
- **Phase 5**: 1-2 weeks
- **Phase 6**: 1-2 weeks

**Total**: 8-12 weeks for full implementation

## Success Metrics

- ✅ Users can receive USDC in Stellar wallet
- ✅ USDC automatically deposited to yield vault (10-20% APY)
- ✅ Combined balance displayed correctly
- ✅ Users can withdraw from vault
- ✅ Yield earnings tracked and displayed
- ✅ Secure key management
- ✅ < 5 second response time for balance queries
