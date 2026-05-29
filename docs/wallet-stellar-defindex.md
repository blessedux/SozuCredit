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

### Soroban / DeFindex (testnet)

```env
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org

# DeFindex vault + strategy per pool (testnet)
# Source: https://github.com/paltalabs/defindex/blob/main/public/testnet.contracts.json
DEFINDEX_FIXED_VAULT_ADDRESS=CBMVK2JK6NTOT2O4HNQAIQFJY232BHKGLIMXDVQVHIIZKDACXDFZDWHN
DEFINDEX_FIXED_STRATEGY_ADDRESS=CALLOM5I7XLQPPOPQMYAHUWW4N7O3JKT42KQ4ASEEVBXDJQNJOALFSUY
DEFINDEX_YIELDBLOX_VAULT_ADDRESS=<confirm from DeFindex testnet deployments>
DEFINDEX_YIELDBLOX_STRATEGY_ADDRESS=<confirm from DeFindex testnet deployments>

# ⚠ BlendUSDC — NOT Circle USDC and NOT the native XLM SAC
# Obtain test tokens from https://testnet.blend.capital
TESTNET_USDC_CONTRACT_ADDRESS=CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU

# Blend pool IDs (testnet)
NEXT_PUBLIC_BLEND_TESTNET_POOL_ID=CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF
NEXT_PUBLIC_BLEND_TESTNET_USDC_RESERVE=CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU

# Deposit config
VAULT_MIN_DEPOSIT=10
VAULT_NETWORK_FEE_BUFFER=0.4
```

## Contract reference (testnet snapshot — paltalabs/defindex testnet.contracts.json)

| Role | Contract id |
|------|-------------|
| DeFindex factory | `CDSCWE4GLNBYYTES2OCYDFQA2LLY4RBIAX6ZI32VSUXD7GO6HRPO4A32` |
| USDC Blend strategy | `CALLOM5I7XLQPPOPQMYAHUWW4N7O3JKT42KQ4ASEEVBXDJQNJOALFSUY` |
| USDC Paltalabs vault | `CBMVK2JK6NTOT2O4HNQAIQFJY232BHKGLIMXDVQVHIIZKDACXDFZDWHN` |
| BlendUSDC (testnet) | `CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU` |

## Mainnet rotation checklist (Phase 2 — implement after testnet green)

> **Do not deploy to mainnet until all testnet acceptance criteria pass.**

1. Confirm DeFindex mainnet vault + strategy IDs from https://docs.defindex.io/contract-deployments/mainnet-deployment
2. Set env vars:
   ```
   NEXT_PUBLIC_STELLAR_NETWORK=mainnet
   NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban.stellar.org
   DEFINDEX_FIXED_VAULT_ADDRESS=CDB2WMKQQNVZMEBY7Q7GZ5C7E7IAFSNMZ7GGVD6WKTCEWK7XOIAVZSAP
   DEFINDEX_FIXED_STRATEGY_ADDRESS=<mainnet strategy from DeFindex>
   DEFINDEX_YIELDBLOX_VAULT_ADDRESS=CCSRX5E4337QMCMC3KO3RDFYI57T5NZV5XB3W3TWE4USCASKGL5URKJL
   DEFINDEX_YIELDBLOX_STRATEGY_ADDRESS=<mainnet YieldBlox strategy>
   TESTNET_USDC_CONTRACT_ADDRESS= (unused on mainnet)
   MAINNET_USDC_CONTRACT_ADDRESS=CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75
   NEXT_PUBLIC_BLEND_MAINNET_POOL_ID=CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD
   NEXT_PUBLIC_BLEND_MAINNET_USDC_RESERVE=CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75
   ```
3. Keep YieldBlox as user opt-in only; default strategy stays `fixed` given historical pool risk.
4. Run config validation via `GET /api/test/auto-deposit-e2e?strategyId=fixed` on mainnet.
5. Security review before enabling auto-earn on mainnet.

## Debugging endpoints

Local/dev only (require auth cookies):

- `GET /api/test/auto-deposit-e2e?strategyId=fixed` — full config + APY + balance E2E check.
- `GET/POST /api/wallet/defindex/balance` — wallet vs strategy breakdown.
- `GET /api/wallet/defindex/apy` — APY probe (`period`, `decimals` query params).

## Automation

- **`pnpm run auto-deposit`** — runs `scripts/auto-deposit-cron.ts` for batch processing.
- To trigger an idle-balance deposit manually: `POST /api/wallet/defindex/auto-deposit` with `{ "depositIdleBalance": true }`.

## Trustline note

On testnet, users need a BlendUSDC balance (`CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU`).
The app returns `{ needsTrustline: true }` from the deposit API when the balance is insufficient.
Direct users to https://testnet.blend.capital to obtain test tokens.

## Troubleshooting

- **Fallback APY (15.5%)**: indicates Blend RPC or pool load failure — check server logs and RPC quota.
- **Zero strategy balance**: expected before first deposit; on-chain vault balance is preferred over DB.
- **"needsTrustline: true"**: user lacks BlendUSDC on testnet; prompt to obtain tokens at testnet.blend.capital.
