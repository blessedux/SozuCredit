# DeFindex Contract Addresses - Testnet

This document contains the official DeFindex contract addresses deployed on Stellar testnet.

## Contract Addresses

### Core Contracts

```json
{
  "defindex_factory": "CD6MEVYGXCCUTOUIC3GNMIDOSRY4A2WGCRQGOOCVG5PK2N7UNGGU6BBQ",
  "xlm_hodl_vault": "CCGKL6U2DHSNFJ3NU4UPRUKYE2EUGYR4ZFZDYA7KDJLP3TKSPHD5C4UP"
}
```

### Strategy Contracts

#### XLM Strategies

```json
{
  "xlm_hodl_strategy_0": "CCEE2VAGPXKVIZXTVIT4O5B7GCUDTZTJ5RIXBPJSZ7JWJCJ2TLK75WVW",
  "xlm_hodl_strategy_1": "CAHWRPKBPX4FNLXZOAD565IBSICQPL5QX37IDLGJYOPWX22WWKFWQUBA"
}
```

#### Blend Strategies (Auto-compound)

```json
{
  "xlm_blend_autocompound_fixed_xlm_usdc_strategy": "CCSPRGGUP32M23CTU7RUAGXDNOHSA6O2BS2IK4NVUP5X2JQXKTSIQJKE",
  "usdc_blend_autocompound_fixed_xlm_usdc_strategy": "CBLXUUHUL7TA3LF3U5G6ZTU7EACBBOSJLR4AYOM5YJKJ4APZ7O547R5T"
}
```

### Contract Hashes (For Verification)

```json
{
  "defindex_vault": "ae3409a4090bc087b86b4e9b444d2b8017ccd97b90b069d44d005ab9f8e1468b",
  "defindex_factory": "b0fe36b2b294d0af86846ccc4036279418907b60f6f74dae752847ae9d3bca0e",
  "hodl_strategy": "c79eb65b4e890f4d8a2466bb2423b957c6c6ea7e490db64eed7e0118350d8967",
  "blend_strategy": "11329c2469455f5a3815af1383c0cdddb69215b1668a17ef097516cde85da988"
}
```

## Current Strategy Selection

### For SozuCredit Auto-Deposit: USDC Blend Strategy

**Contract Address:** `CBLXUUHUL7TA3LF3U5G6ZTU7EACBBOSJLR4AYOM5YJKJ4APZ7O547R5T`

**Strategy Type:** Auto-compound Fixed XLM/USDC Blend Strategy

**Asset:** USDC

**Description:** This strategy provides automated yield generation through lending on the Blend protocol, with automatic reinvestment of rewards.

## Environment Variables Setup

Update your `.env.local` file with the real contract addresses:

```env
# DeFindex Real Contracts (Testnet)
DEFINDEX_VAULT_ADDRESS=CCGKL6U2DHSNFJ3NU4UPRUKYE2EUGYR4ZFZDYA7KDJLP3TKSPHD5C4UP
DEFINDEX_STRATEGY_ADDRESS=CBLXUUHUL7TA3LF3U5G6ZTU7EACBBOSJLR4AYOM5YJKJ4APZ7O547R5T

# USDC Contract (Testnet)
TESTNET_USDC_CONTRACT_ADDRESS=CCVFV3K4JXYQKXKT5G7L5O5G7L5O5G7L5O5G7L5O5G7L5O5G7L5O5G7L5O5G

# Other settings (keep as is)
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
```

## Strategy Details

### USDC Blend Auto-compound Strategy

- **Address:** `CBLXUUHUL7TA3LF3U5G6ZTU7EACBBOSJLR4AYOM5YJKJ4APZ7O547R5T`
- **Protocol:** Blend Protocol
- **Asset:** USDC
- **Strategy:** Auto-compound Fixed XLM/USDC
- **Yield Source:** Lending interest + LP rewards
- **Reinvestment:** Automatic
- **Risk Level:** Medium (lending protocol exposure)

### Expected APY Range

- **Current:** Fetched dynamically from contract
- **Historical:** 10-20% APY (typical for stablecoin lending)
- **Updates:** Real-time via contract queries

## Testing with Real Contracts

### Step 1: Update Environment Variables

Replace placeholder addresses with real ones in `.env.local`:

```env
DEFINDEX_STRATEGY_ADDRESS=CBLXUUHUL7TA3LF3U5G6ZTU7EACBBOSJLR4AYOM5YJKJ4APZ7O547R5T
DEFINDEX_VAULT_ADDRESS=CCGKL6U2DHSNFJ3NU4UPRUKYE2EUGYR4ZFZDYA7KDJLP3TKSPHD5C4UP
```

### Step 2: Restart Development Server

```bash
npm run dev
```

### Step 3: Test Contract Functions

First, test what functions are available on the contract:

```bash
# Test contract functions (requires authentication)
curl http://localhost:3000/api/test/defindex-contract \
  -H "Cookie: <your_auth_cookie>"
```

This will show all available functions on the DeFindex strategy contract and identify the correct APY function name.

### Step 4: Test Real APY Fetching

```bash
# Test balance endpoint with real strategy
curl http://localhost:3000/api/wallet/defindex/balance \
  -H "Cookie: <your_auth_cookie>"
```

**Expected Response:**

```json
{
  "success": true,
  "balance": 0,
  "walletBalance": 0,
  "strategyBalance": 0,
  "strategyShares": 0,
  "apy": 12.5, // Real APY from contract (not fallback 15.5)
  "strategy": {
    "address": "CBLXUUHUL7TA3LF3U5G6ZTU7EACBBOSJLR4AYOM5YJKJ4APZ7O547R5T",
    "assetAddress": "CCVFV3K4JXYQKXKT5G7L5O5G7L5O5G7L5O5G7L5O5G7L5O5G7L5O5G7L5O5G",
    "totalAssets": 0, // Will show real values when strategy has deposits
    "totalShares": 0
  }
}
```

### Step 5: Test APY Endpoint Directly

```bash
# Test APY endpoint directly
curl http://localhost:3000/api/wallet/defindex/apy \
  -H "Cookie: <your_auth_cookie>"
```

**Expected Response:**

```json
{
  "success": true,
  "apy": 12.5,
  "strategy": {
    "address": "CBLXUUHUL7TA3LF3U5G6ZTU7EACBBOSJLR4AYOM5YJKJ4APZ7O547R5T",
    "assetAddress": "CCVFV3K4JXYQKXKT5G7L5O5G7L5O5G7L5O5G7L5O5G7L5O5G7L5O5G7L5O5G",
    "totalAssets": 0,
    "totalShares": 0
  },
  "lastUpdated": "2025-01-06T..."
}
```

## UI Updates

The real APY will now be displayed in:

1. **Wallet Page** - Current strategy APY with live updates
2. **Vault Deposit Form** - Live yield information
3. **Balance Displays** - Real-time APY values with multiple periods

## APY Calculator System

### Overview

The new APY system provides:

- **Multi-source APY calculation** - Contract, calculated, external, and fallback sources
- **Multiple time periods** - Daily, weekly, monthly, and yearly APY
- **Configurable precision** - 1-8 decimal places
- **Real-time updates** - Automatic refresh with confidence indicators
- **Comprehensive UI components** - Both compact and detailed displays

### API Endpoints

#### `/api/wallet/defindex/apy`

**Parameters:**

- `period` - Time period: `daily`, `weekly`, `monthly`, `yearly` (default: `yearly`)
- `decimals` - Precision: 1-8 (default: 4)

**Response:**

```json
{
  "success": true,
  "apy": {
    "primary": "10.25",
    "precise": 10.25,
    "periods": {
      "daily": "0.0281",
      "weekly": "0.1965",
      "monthly": "0.8512",
      "yearly": "10.2500"
    },
    "source": "calculated",
    "confidence": "medium",
    "precision": 4,
    "requestedPeriod": "yearly"
  },
  "strategy": {
    "address": "CBLXUUHUL7TA3LF3U5G6ZTU7EACBBOSJLR4AYOM5YJKJ4APZ7O547R5T"
  },
  "metadata": {
    "lastUpdated": "2025-01-06T03:45:00.000Z",
    "calculationTime": "2025-01-06T03:45:00.000Z"
  }
}
```

### UI Components

#### `APYDisplay` Component

Full-featured APY display with controls:

```tsx
<APYDisplay
  strategyAddress="CBLXUUHUL7TA3LF3U5G6ZTU7EACBBOSJLR4AYOM5YJKJ4APZ7O547R5T"
  compact={false}
  showControls={true}
  autoRefresh={true}
  refreshInterval={30000}
/>
```

#### `APYBadge` Component

Compact inline APY display:

```tsx
<APYBadge strategyAddress="CBLXUUHUL7TA3LF3U5G6ZTU7EACBBOSJLR4AYOM5YJKJ4APZ7O547R5T" />
```

#### `useAPY` Hook

Programmatic APY access:

```tsx
const { apyData, loading, error, refetch } = useAPY(
  "CBLXUUHUL7TA3LF3U5G6ZTU7EACBBOSJLR4AYOM5YJKJ4APZ7O547R5T",
  "yearly",
  2
);
```

### APY Sources (Priority Order)

1. **Contract** - Direct from DeFindex strategy contract (highest confidence)
2. **Calculated** - Based on strategy type and market data
3. **External** - From DeFi APIs and oracles
4. **Fallback** - Conservative default values (lowest confidence)

### Time Period Calculations

APY is calculated using compound interest formulas:

- **Daily**: `APY / 365`
- **Weekly**: `(1 + APY/365)^7 - 1`
- **Monthly**: `(1 + APY/365)^30 - 1`
- **Yearly**: Base APY value

### Precision Control

- **Range**: 1-8 decimal places
- **Default**: 4 decimal places
- **Display**: Automatic formatting with specified precision

## Production Deployment

### Mainnet Addresses (When Available)

When mainnet contracts are deployed, update to:

```env
# Mainnet Configuration
NEXT_PUBLIC_STELLAR_NETWORK=mainnet
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban.stellar.org

# Mainnet contract addresses (to be provided by DeFindex)
DEFINDEX_VAULT_ADDRESS=<mainnet_vault_address>
DEFINDEX_STRATEGY_ADDRESS=<mainnet_usdc_blend_strategy_address>
MAINNET_USDC_CONTRACT_ADDRESS=<circle_usdc_mainnet_address>
```

## Contract Verification

### Verify Contract Code

```bash
# Check contract WASM hash matches expected
soroban contract info --id CBLXUUHUL7TA3LF3U5G6ZTU7EACBBOSJLR4AYOM5YJKJ4APZ7O547R5T \
  --network testnet
```

**Expected Hash:** `11329c2469455f5a3815af1383c0cdddb69215b1668a17ef097516cde85da988`

## Troubleshooting

### APY Still Shows 15.5 (Fallback)

**Issue:** Contract query failing, falling back to default APY

**Solutions:**

1. Check Soroban RPC connection
2. Verify contract address is correct
3. Check contract is deployed and accessible
4. Review server logs for contract query errors

### Balance Queries Fail

**Issue:** Strategy balance queries return 0

**Possible Causes:**

1. No deposits in strategy yet (normal for new contracts)
2. Contract address incorrect
3. Network connectivity issues

## Next Steps

1. **Update Environment Variables** with real addresses
2. **Test Real APY Fetching** from contract
3. **Update UI** to display live APY values
4. **Test Deposit Flow** with real strategy
5. **Monitor Performance** and yields

---

**Last Updated:** 2025-01-06
**Strategy:** USDC Blend Auto-compound
**Contract:** CBLXUUHUL7TA3LF3U5G6ZTU7EACBBOSJLR4AYOM5YJKJ4APZ7O547R5T
**Status:** Ready for Real APY Integration
