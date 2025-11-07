# MaxFlow Ego Score Integration - Branch Summary

## Branch: `maxflow-trust-tokens-integration`

This branch implements integration with the MaxFlow API for ego scoring based on network flow analysis. MaxFlow provides reputation/trust scores for Ethereum addresses based on their relationships in the network.

## What's Been Implemented

### 1. MaxFlow API Client Library

- **Location**: `lib/maxflow/`
- **Files**:
  - `config.ts` - Configuration and TypeScript interfaces for ego scores
  - `client.ts` - MaxFlow API client for ego scoring
  - `utils.ts` - Helper functions for integration with Supabase

### 2. API Routes

- **Location**: `app/api/maxflow/ego/`
- **Endpoints Created**:
  - `GET /api/maxflow/ego/[address]/score` - Get ego score for an address
  - `GET /api/maxflow/ego/[address]/trust-score` - Get calculated trust score
  - `GET /api/maxflow/ego/[address]/can-vouch` - Check vouching eligibility
  - `POST /api/maxflow/ego/scores` - Batch ego scores for multiple addresses

### 3. Features

#### Ego Scoring

- Get ego scores for Ethereum addresses
- Calculate trust scores from ego metrics
- Batch operations for multiple addresses
- Network flow analysis metrics

#### Vouching Integration

- Check if addresses can vouch based on ego scores
- Minimum trust score requirements
- Integration with existing vouching system

#### Voting Power

- Calculate voting power from ego scores
- Trust score-based voting weights
- Integration with voting mechanisms

### 4. Integration Utilities

- Get ego scores for users by wallet address
- Check vouching eligibility based on ego scores
- Calculate voting power from ego scores
- Batch operations for multiple addresses

## Next Steps

1. **Environment Setup**: Add MaxFlow API URL to `.env` (optional, defaults to https://maxflow.one)

   ```env
   MAXFLOW_API_URL=https://maxflow.one
   ```

   **Note**: No API key required - MaxFlow API is publicly accessible

2. **UI Integration**: Update existing trust points UI to use MaxFlow ego scores

   - Display ego scores on user profiles
   - Show trust scores for vouching eligibility
   - Integrate ego scores into voting power calculations

3. **Wallet Address Integration**: Connect wallet addresses to user profiles

   - Store Ethereum addresses in user profiles
   - Map user IDs to wallet addresses
   - Update utils to fetch wallet addresses from Supabase

4. **Testing**: Test all endpoints with MaxFlow API
   - Test ego score fetching
   - Verify trust score calculations
   - Test vouching eligibility checks
   - Validate batch operations

## Files Created

```
lib/maxflow/
├── config.ts
├── client.ts
└── utils.ts

app/api/maxflow/
└── ego/
    ├── [address]/
    │   ├── score/
    │   │   └── route.ts
    │   ├── trust-score/
    │   │   └── route.ts
    │   └── can-vouch/
    │       └── route.ts
    └── scores/
        └── route.ts

docs/
├── MAXFLOW_INTEGRATION.md
└── MAXFLOW_BRANCH_SUMMARY.md
```

## API Documentation

See `docs/MAXFLOW_INTEGRATION.md` for complete API documentation and usage examples.

## Status

✅ Core infrastructure complete
✅ API routes implemented (ego scoring)
✅ Integration utilities ready
✅ Documentation updated
⏳ UI integration pending
⏳ Wallet address mapping pending
⏳ Testing pending
