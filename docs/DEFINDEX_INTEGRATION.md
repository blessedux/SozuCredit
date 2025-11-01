# DeFindex Integration Documentation

## Overview

This document describes the integration of [DeFindex](https://docs.defindex.io) into SozuCredit to provide real DeFi yield strategies for user wallets.

## Architecture

### Components

1. **DeFindex Configuration** (`lib/defindex/config.ts`)
   - Manages connection to DeFindex protocol
   - Configures Soroban RPC endpoints
   - Handles testnet/mainnet environment setup

2. **DeFindex Vault Service** (`lib/defindex/vault.ts`)
   - Provides functions for interacting with DeFindex strategies
   - Handles deposits, withdrawals, and harvest operations
   - Queries strategy balances and APY

3. **API Endpoints**
   - `/api/wallet/defindex/balance` - Get user's strategy balance
   - `/api/wallet/defindex/deposit` - Deposit assets into strategy
   - `/api/wallet/defindex/apy` - Get current strategy APY

## Current Implementation Status

### ✅ Completed

- DeFindex service library structure
- API endpoints for balance, deposit, and APY queries
- Wallet page integration for real APY display
- Configuration management for Soroban/DeFindex connection

### 🔄 In Progress / TODO

1. **Soroban Contract Integration**
   - Implement actual Soroban SDK calls to interact with DeFindex contracts
   - Complete the placeholder functions in `lib/defindex/vault.ts`
   - Add proper contract invocation for deposit/withdraw/harvest

2. **Database Schema**
   - Create tables for storing DeFindex strategy positions
   - Track user shares in strategies
   - Store transaction history

3. **Auto-Deposit Logic**
   - Implement automatic deposit to DeFindex when funds are received
   - Add configuration for minimum deposit amounts
   - Handle reinvestment of harvested rewards

4. **Real Balance Integration**
   - Connect wallet balance queries to DeFindex strategy positions
   - Aggregate wallet balance + strategy balance
   - Update balance display in real-time

## Environment Variables Required

```env
# Soroban RPC Configuration
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org

# DeFindex Contract Addresses
DEFINDEX_VAULT_ADDRESS=<contract_address>
DEFINDEX_STRATEGY_ADDRESS=<contract_address>

# Asset Contract Addresses
TESTNET_USDC_CONTRACT_ADDRESS=<contract_address>
MAINNET_USDC_CONTRACT_ADDRESS=<contract_address>
```

## Usage

### Getting Strategy APY

```typescript
import { getStrategyInfo } from "@/lib/defindex/vault"

const strategyInfo = await getStrategyInfo()
console.log("Current APY:", strategyInfo.apy)
```

### Depositing to Strategy

```typescript
import { depositToStrategy } from "@/lib/defindex/vault"

const result = await depositToStrategy(userWalletAddress, amount)
```

### Getting Vault Balance

```typescript
import { getVaultBalance } from "@/lib/defindex/vault"

const balance = await getVaultBalance(userWalletAddress)
console.log("Total Balance:", balance.totalBalance)
```

## Next Steps

1. **Install Soroban SDK**
   - Determine if JavaScript/TypeScript bindings exist for Soroban
   - If not, implement HTTP-based contract calls using Soroban RPC
   - Create contract client wrappers for DeFindex interface

2. **Complete Contract Integration**
   - Implement actual contract calls for:
     - `deposit(amount)` - Deposit assets into strategy
     - `withdraw(amount)` - Withdraw assets from strategy
     - `harvest()` - Harvest and reinvest rewards
     - `balanceOf(address)` - Query user's strategy balance
     - `getAPY()` - Query current strategy APY

3. **Database Integration**
   - Create migration scripts for strategy position tables
   - Implement position tracking logic
   - Add transaction history logging

4. **Testing**
   - Test with DeFindex testnet contracts
   - Verify deposit/withdraw flows
   - Validate APY calculations
   - Test error handling and edge cases

## References

- [DeFindex Documentation](https://docs.defindex.io)
- [DeFindex Strategy Development Guide](https://docs.defindex.io/strategy-developers/03-how-to-create-a-strategy)
- [Soroban Documentation](https://soroban.stellar.org/docs)

## Notes

- Current implementation uses placeholder values for contract interactions
- Actual Soroban contract calls need to be implemented based on available SDK or RPC methods
- The integration follows the DeFindex strategy pattern as documented in their guides

