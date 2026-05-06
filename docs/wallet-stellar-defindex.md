# Wallet, Stellar, and DeFindex

Environment variables, contract references, and debugging APIs for yield strategies and balances.

## Environment variables

Set in `.env.local` (local) or your host (e.g. Vercel).

### Stellar / Horizon (classic)

```env
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
USDC_ASSET_CODE=USDC
USDC_ISSUER=<issuer_public_key>
```

### Soroban / DeFindex (example testnet)

```env
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org

DEFINDEX_VAULT_ADDRESS=CCGKL6U2DHSNFJ3NU4UPRUKYE2EUGYR4ZFZDYA7KDJLP3TKSPHD5C4UP
DEFINDEX_STRATEGY_ADDRESS=CBLXUUHUL7TA3LF3U5G6ZTU7EACBBOSJLR4AYOM5YJKJ4APZ7O547R5T

# Circle USDC on Stellar testnet (verify against current Circle docs)
TESTNET_USDC_CONTRACT_ADDRESS=CDLZFC3SYJYDZT7K67VZRVHPXWS62KQBXEFCM2IBHQKHI4P273XMUAWL
```

Mainnet: rotate addresses when strategies are deployed; never reuse test placeholders in production.

## Contract reference (testnet snapshot)

| Role | Contract id |
|------|-------------|
| DeFindex factory | `CD6MEVYGXCCUTOUIC3GNMIDOSRY4A2WGCRQGOOCVG5PK2N7UNGGU6BBQ` |
| XLM hodl vault | `CCGKL6U2DHSNFJ3NU4UPRUKYE2EUGYR4ZFZDYA7KDJLP3TKSPHD5C4UP` |
| USDC Blend auto-compound strategy (auto-deposit target) | `CBLXUUHUL7TA3LF3U5G6ZTU7EACBBOSJLR4AYOM5YJKJ4APZ7O547R5T` |

Additional strategy ids (XLM hodl, Blend variants) change when pools are redeployed — confirm against DeFindex release notes before relying on them in automation.

## Debugging endpoints

Local/dev only (often require auth cookies):

- `GET/POST /api/wallet/defindex/balance` — wallet vs strategy breakdown.
- `GET /api/wallet/defindex/apy` — APY probe (`period`, `decimals` query params).
- `/api/test/defindex-contract` — introspection helper when enabled.

## Automation

- **`pnpm run auto-deposit`** — runs `scripts/auto-deposit-cron.ts` for batch processing (configure env + cron externally).

## Troubleshooting

- **Fallback APY**: usually Soroban RPC, wrong strategy address, or contract interface mismatch — check server logs and RPC quota.
- **Zero strategy balance**: expected when no deposits yet; confirm user pubkey and network.
