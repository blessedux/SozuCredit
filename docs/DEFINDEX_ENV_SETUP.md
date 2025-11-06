# DeFindex Environment Setup

## Required Environment Variables

The DeFindex integration requires the following environment variables to be set:

### Core DeFindex Variables

```env
# DeFindex Contract Addresses (Required)
DEFINDEX_VAULT_ADDRESS=<vault_contract_address>
DEFINDEX_STRATEGY_ADDRESS=<strategy_contract_address>

# USDC Contract Addresses (Required)
TESTNET_USDC_CONTRACT_ADDRESS=<usdc_contract_address>
MAINNET_USDC_CONTRACT_ADDRESS=<usdc_contract_address>
```

### Optional Variables (with defaults)

```env
# Network Configuration
NEXT_PUBLIC_STELLAR_NETWORK=testnet

# Soroban RPC URL (defaults provided)
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
```

## Current Status

**❌ Missing:** `DEFINDEX_VAULT_ADDRESS`, `DEFINDEX_STRATEGY_ADDRESS`, and USDC contract addresses

## Setup Options

### Option 1: Use Test Contracts (Recommended for Development)

For testing without real DeFindex contracts, set placeholder values:

```env
# Add to your .env.local file
DEFINDEX_VAULT_ADDRESS=CCVFV3K4JXYQKXKT5G7L5O5G7L5O5G7L5O5G7L5O5G7L5O5G7L5O5G7L5O5G
DEFINDEX_STRATEGY_ADDRESS=CCVFV3K4JXYQKXKT5G7L5O5G7L5O5G7L5O5G7L5O5G7L5O5G7L5O5G7L5O5G
TESTNET_USDC_CONTRACT_ADDRESS=CCVFV3K4JXYQKXKT5G7L5O5G7L5O5G7L5O5G7L5O5G7L5O5G7L5O5G7L5O5G
```

**Note:** These are placeholder addresses that look like valid Soroban contract addresses but don't exist on the network. The integration will fail gracefully with these, but the configuration validation will pass.

### Option 2: Use Real DeFindex Contracts

If you have access to real DeFindex contracts:

1. **Get DeFindex Contract Addresses:**

   - Check DeFindex documentation or deployment scripts
   - Use testnet contracts for development

2. **Get USDC Contract Addresses:**

   - **Testnet:** Circle's USDC on Stellar testnet
   - **Mainnet:** Circle's USDC on Stellar mainnet

   Common addresses:

   ```env
   # Testnet USDC (Circle)
   TESTNET_USDC_CONTRACT_ADDRESS=CDLZFC3SYJYDZT7K67VZRVHPXWS62KQBXEFCM2IBHQKHI4P273XMUAWL

   # Mainnet USDC (Circle)
   MAINNET_USDC_CONTRACT_ADDRESS=CDLZFC3SYJYDZT7K67VZRVHPXWS62KQBXEFCM2IBHQKHI4P273XMUAWL
   ```

## How to Set Environment Variables

### Method 1: .env.local file

1. Create or edit `.env.local` in your project root
2. Add the required variables:

```env
# DeFindex Configuration
DEFINDEX_VAULT_ADDRESS=CCVFV3K4JXYQKXKT5G7L5O5G7L5O5G7L5O5G7L5O5G7L5O5G7L5O5G7L5O5G
DEFINDEX_STRATEGY_ADDRESS=CCVFV3K4JXYQKXKT5G7L5O5G7L5O5G7L5O5G7L5O5G7L5O5G7L5O5G7L5O5G
TESTNET_USDC_CONTRACT_ADDRESS=CCVFV3K4JXYQKXKT5G7L5O5G7L5O5G7L5O5G7L5O5G7L5O5G7L5O5G7L5O5G

# Existing variables (if not already set)
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
```

### Method 2: Supabase Environment Variables

If using Supabase:

1. Go to Supabase Dashboard → Project Settings → Environment Variables
2. Add the required variables

### Method 3: Vercel Environment Variables

If deploying to Vercel:

1. Go to Vercel Dashboard → Project Settings → Environment Variables
2. Add the required variables

## Verification

### Check Configuration

After setting the variables, verify the configuration is valid:

```bash
# Test Soroban connection and configuration
curl http://localhost:3000/api/test/soroban
```

**Expected Response:**

```json
{
  "success": true,
  "message": "All Soroban integration tests passed!",
  "results": {
    "rpcConnection": true,
    "contractAddressFormat": true,
    "contractInstance": true
  }
}
```

### Test Wallet Balance

```bash
# Test wallet balance (should work without errors)
curl http://localhost:3000/api/wallet/defindex/balance \
  -H "Cookie: <your_auth_cookie>"
```

**Expected Response (with placeholder contracts):**

- Will show balance 0 (normal for non-existent contracts)
- No "configuration invalid" error

## What Happens Without Configuration

**Current Error:**

```
"error": "Failed to get DeFindex balance",
"details": "DeFindex configuration is invalid. Please check environment variables."
```

This error occurs because:

1. `validateDeFindexConfig()` returns `false`
2. The balance endpoint tries to query DeFindex contracts
3. Without valid configuration, it fails before making the query

## Testing Strategy

### Phase 1: Configuration Only

1. Set placeholder environment variables
2. Verify no "configuration invalid" errors
3. Test basic endpoints work

### Phase 2: Real Contracts (Future)

1. Replace placeholders with real contract addresses
2. Test actual deposits and withdrawals
3. Verify balance queries work

## Next Steps

1. **Add placeholder environment variables** to fix the current error
2. **Restart your development server** after adding variables
3. **Test the endpoints** to ensure configuration is valid
4. **Commit the environment setup** when ready

---

**Status:** ⚠️ Environment variables needed  
**Action Required:** Set DeFindex environment variables  
**Last Updated:** 2025-01-06
