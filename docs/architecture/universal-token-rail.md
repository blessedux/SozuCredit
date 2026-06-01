# Sozu Universal Token Rail

## Principle

Assets are identified by **contractId**, not ticker symbol. Multiple tokens may share `USDC` while representing different Soroban contracts (Blend, Circle SAC, Sozu internal, future RWAs).

## Core modules (SozuCredit)

| Module | Role |
|--------|------|
| `lib/stellar/asset-types.ts` | `SozuAsset`, `HolderTokenBalance` |
| `lib/stellar/asset-registry-core.ts` | Client-safe default contract IDs |
| `lib/stellar/asset-registry.ts` | Server registry (env overrides) |
| `lib/stellar/send-token.ts` | `sendToken({ contractId, from, to, amount, relayerPublicKey })` |
| `lib/stellar/token-balances.ts` | Per-contract balances for a G or C holder |
| `lib/stellar/pick-send-token.ts` | Auto-pick or honor `contractId` for sends |
| `lib/stellar/stellar-holder.ts` | `Address.fromString` validation for G and C |
| `lib/stellar/blend-pool-reserves.ts` | Read `reserve.assetId` from Blend `PoolV2` |

## Payment API

`POST /api/wallet/stellar/payment` accepts optional `contractId`. When omitted, the server picks the first registered asset with sufficient balance (by `sendPriority`).

Response includes `contractId`, `assetId`, `assetDisplayName`.

## Balance API

`GET /api/wallet/stellar/balance` returns `tokenBalances[]` with separate rows per contract.

## Asset catalog

`GET /api/wallet/stellar/assets?holder=C…` lists the registry and optional balances.

## Env (testnet)

- `TESTNET_USDC_CONTRACT_ADDRESS` — Blend USDC
- `TESTNET_CIRCLE_USDC_SAC_CONTRACT_ADDRESS` — optional SAC override
- `TESTNET_SOZU_INTERNAL_USDC_CONTRACT_ID` — Sozu test token

## Relayer model

- **Holder:** C smart account (funds)
- **Relayer:** G signer (fee payer / tx source)
- **Auth:** passkey on C via `__check_auth`

## Blend / DeFindex

Strategy config uses `assetAddress` from the registry defaults. Pool integrations should use `getBlendPoolReserveAssets(poolId)` rather than assuming USDC.
