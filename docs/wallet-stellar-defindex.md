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

# Blend pool USDC (bToken) — required by the public testnet DeFindex vault for *earn deposits*
TESTNET_USDC_CONTRACT_ADDRESS=CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU
# Circle USDC SAC on C — default *receive* token (faucet / SozuPay); see TESTNET_CIRCLE_USDC_SAC_CONTRACT_ADDRESS

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

## Testnet: receive vs earn (two USDC contracts)

| Role | Token | Contract (testnet) |
|------|--------|-------------------|
| **Receive** (Depositar → Stellar) | Circle USDC SAC | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |
| **Earn deposit** (DeFindex vault) | Blend pool USDC | `CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU` |

The public Paltalabs testnet vault (`CBMVK2JK…`) only accepts Blend pool USDC (`get_assets` on-chain).
Circle SAC in the wallet cannot be deposited until a SAC-native vault is deployed; then set `DEFINDEX_FIXED_VAULT_ADDRESS` (and optionally `DEFINDEX_VAULT_DEPOSIT_ASSET_CONTRACT`).

`getResolvedDeFindexConfig()` reads the vault deposit asset from chain so env rotation does not require code changes.

## Testnet yield E2E runbook

This is the step-by-step procedure to produce real Blend pool yield on testnet via DeFindex.

### 0. Verify env

All of these must be set in `.env.local`:

```
STELLAR_FUNDER_SECRET=S...   # testnet G key with a few XLM — required for C Soroban reads
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
DEFINDEX_FIXED_VAULT_ADDRESS=CBMVK2JK6NTOT2O4HNQAIQFJY232BHKGLIMXDVQVHIIZKDACXDFZDWHN
TESTNET_USDC_CONTRACT_ADDRESS=CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU
VAULT_MIN_DEPOSIT=10
VAULT_NETWORK_FEE_BUFFER=0.4
```

### 1. Fund your C account with Blend USDC

The DeFindex vault (`CBMVK2JK…`) requires **Blend pool USDC** (`CAQCFVLO…`) — not Circle SAC.

1. Open [testnet.blend.capital](https://testnet.blend.capital) with Freighter on testnet.
2. Mint or borrow test **Blend USDC** (`CAQCFVLO…`).
3. Soroban-transfer at least **$10.40** of Blend USDC to your Sozu **C…** address (from **Depositar → Stellar**).
4. Confirm on [Stellar Expert](https://stellar.expert/explorer/testnet) → C account → Soroban balances.

> Circle SAC (`CBIELTK6…`) is used for receiving/sending USDC but **is not accepted by the vault**.
> The UI now correctly shows "Necesitas Blend USDC" if you have only SAC.

### 2. CLI read-only check (no passkey)

```bash
pnpm exec tsx scripts/test-defi-e2e.ts fixed CYOUR56CHARADDRESSHERE...
```

All steps should pass. Key things to confirm:

| Step | Expected |
|------|----------|
| Step 0 Config | `depositAsset (on-chain)` = `CAQCFVLO…`; config valid |
| Step 1 APY | `source: blend-sdk`, yearly > 0% (not permanent 15.5% fallback) |
| Step 4 Vault deposit asset balance | `depositBalance ≥ 10`, `status: Ready to deposit ✓` |
| Step 5 Deposit XDR | XDR built without error |

If Step 1 shows `source: fallback`, check `SOROBAN_RPC_URL` and `STELLAR_FUNDER_SECRET`.

### 3. Authenticated API checks (browser / curl with session)

```
GET /api/test/auto-deposit-e2e?strategyId=fixed
GET /api/wallet/defindex/balance
GET /api/wallet/defindex/apy
```

`balance.strategy.assetAddress` should equal `CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU`.
`apy.source` should be `blend-sdk`.

### 4. Live round-trip via UI

1. Open wallet → expand **Desglose y proyección**.
2. Tap **Empezar a ganar** — passkey signature requested.
3. After success: `strategyBalance` > 0, tx hash visible.
4. Verify on [Stellar Expert](https://stellar.expert/explorer/testnet) — vault interaction visible.
5. Tap **Retirar** to recover Blend USDC back to C.

### 5. Acceptance checklist

- [ ] Env vars all set; `STELLAR_FUNDER_SECRET` key has XLM on testnet
- [ ] Blend USDC ≥ $10.40 on C before deposit
- [ ] CLI Step 4 passes; deposit XDR builds
- [ ] APY from `blend-sdk` source (high confidence)
- [ ] Deposit tx confirmed on Stellar Expert
- [ ] `strategyBalance` > 0 / dfTokens > 0 after deposit
- [ ] Withdraw returns Blend USDC to C; send flow still works

## Troubleshooting

- **Fallback APY (15.5%)**: Blend SDK / Soroban RPC failed — check `STELLAR_FUNDER_SECRET`, `SOROBAN_RPC_URL`, and server logs.
- **Zero strategy balance**: expected before first deposit; on-chain vault balance is preferred over DB.
- **"Necesitas Blend USDC" in UI / canDeposit = false**: wallet has Circle SAC but not Blend USDC. Fund from testnet.blend.capital.
- **Deposit fails — Insufficient vault deposit token**: C wallet holds SAC only; send Blend USDC to C first.
- **Balance shows 0 on C**: `STELLAR_FUNDER_SECRET` is missing or the key has no XLM — Soroban simulations need a source account.
