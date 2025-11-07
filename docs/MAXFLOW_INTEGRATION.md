# MaxFlow API Integration

This document describes the integration of MaxFlow API for ego scoring based on network flow analysis.

## Overview

MaxFlow provides a reputation/trust system based on address relationships:

- **Ego Scoring**: Network flow analysis of address relationships to determine trust/reputation
- **Trust Scores**: Calculated metrics based on ego scores for vouching and voting
- **Address-Based**: Uses Ethereum addresses (0x format) for scoring

API Reference: https://maxflow.one/api-docs

## Architecture

### Components

1. **MaxFlow Client** (`lib/maxflow/client.ts`)

   - Handles all API interactions with MaxFlow
   - Provides methods for communities, trust tokens, vouching, and voting

2. **API Routes** (`app/api/maxflow/`)

   - RESTful endpoints for MaxFlow operations
   - Integrated with Supabase authentication

3. **Utilities** (`lib/maxflow/utils.ts`)
   - Helper functions for syncing with Supabase
   - Migration utilities
   - Validation functions

## Configuration

Add the following environment variable (optional, defaults to https://maxflow.one):

```env
MAXFLOW_API_URL=https://maxflow.one
```

**Note**: MaxFlow API does not require an API key. All endpoints are publicly accessible.

## API Endpoints

### Ego Scores

- `GET /api/maxflow/ego/[address]/score` - Get ego score for an Ethereum address
- `GET /api/maxflow/ego/[address]/trust-score` - Get calculated trust score for an address
- `GET /api/maxflow/ego/[address]/can-vouch` - Check if address can vouch (with optional minTrustScore query param)
- `POST /api/maxflow/ego/scores` - Get ego scores for multiple addresses (batch request)

## Usage Examples

### Getting Ego Score

```typescript
const address = "0x216844eF94D95279c6d1631875F2dd93FbBdfB61";
const response = await fetch(`/api/maxflow/ego/${address}/score`);
const { egoScore } = await response.json();

console.log("Local Health:", egoScore.localHealth);
console.log("Total Nodes:", egoScore.metrics.totalNodes);
console.log("Accepted Users:", egoScore.metrics.acceptedUsers);
```

### Getting Trust Score

```typescript
const address = "0x216844eF94D95279c6d1631875F2dd93FbBdfB61";
const response = await fetch(`/api/maxflow/ego/${address}/trust-score`);
const { trustScore, egoScore } = await response.json();

console.log("Trust Score:", trustScore);
```

### Checking Vouching Eligibility

```typescript
const address = "0x216844eF94D95279c6d1631875F2dd93FbBdfB61";
const minTrustScore = 1.5;
const response = await fetch(
  `/api/maxflow/ego/${address}/can-vouch?minTrustScore=${minTrustScore}`
);
const { canVouch, trustScore } = await response.json();

if (canVouch) {
  console.log(`User can vouch with trust score: ${trustScore}`);
}
```

### Batch Ego Scores

```typescript
const addresses = [
  "0x216844eF94D95279c6d1631875F2dd93FbBdfB61",
  "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
];
const response = await fetch("/api/maxflow/ego/scores", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ addresses }),
});
const { scores } = await response.json();

Object.entries(scores).forEach(([address, egoScore]) => {
  console.log(`${address}: ${egoScore.localHealth}`);
});
```

## Integration with Existing System

The MaxFlow integration is designed to work alongside the existing Supabase-based trust points system. You can:

1. **Use ego scores** to determine vouching eligibility
2. **Calculate voting power** based on ego scores
3. **Display trust metrics** from MaxFlow alongside Supabase trust points

## Ego Score Metrics

The ego score provides several metrics:

- **localHealth**: Local health score of the address
- **totalNodes**: Total nodes in the network
- **acceptedUsers**: Number of accepted users
- **avgResidualFlow**: Average residual flow
- **medianMinCut**: Median minimum cut
- **maxPossibleFlow**: Maximum possible flow

## Trust Score Calculation

The trust score is calculated from ego metrics using a weighted formula:

```
trustScore = localHealth * 0.4 + avgResidualFlow * 0.3 + medianMinCut * 0.2 + (acceptedUsers / totalNodes) * 0.1
```

You can adjust this formula in `lib/maxflow/client.ts` based on your needs.

## Voting Power

Voting power is calculated based on trust score:

- Trust score is scaled to 0-100 range
- Formula: `votingPower = min(100, max(0, trustScore * 10))`
- You can adjust this in `lib/maxflow/utils.ts`

## Security Considerations

- All endpoints require authentication via Supabase
- Address validation ensures only valid Ethereum addresses (0x format) are accepted
- MaxFlow API is publicly accessible (no API key required)
- Rate limiting should be considered for batch operations

## Error Handling

All API endpoints return standardized error responses:

```json
{
  "error": "Error message",
  "details": "Detailed error information"
}
```

## Future Enhancements

- [ ] Cache ego scores to reduce API calls
- [ ] Real-time updates when ego scores change
- [ ] Integration with wallet address storage
- [ ] Advanced trust score formulas
- [ ] Historical ego score tracking
- [ ] Network visualization based on ego scores
