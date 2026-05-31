# Obtain BlendUSDC on Stellar testnet (E2E funding)

Sozu Credit **sends** use **BlendUSDC** on your **C… smart account**, not classic Circle testnet USDC on a **G…** signer. Stellar Expert may show USDC on G while the app correctly shows **0 spendable** until BlendUSDC is on **C**.

## Contract

| Asset | Contract (testnet) |
|-------|-------------------|
| BlendUSDC | `CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU` |

Env: `TESTNET_USDC_CONTRACT_ADDRESS` (same id).

## Steps (manual E2E)

1. **Freighter** (or compatible wallet) on **Testnet**.
2. Open **[testnet.blend.capital](https://testnet.blend.capital)** — mint / borrow test BlendUSDC (faucet).
3. Optional deep link to the Fixed pool USDC reserve: use **Depositar → Pool USDC (Blend)** in the app, or  
   `https://testnet.blend.capital/asset/?poolId=CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF&assetId=CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU`
4. **Transfer BlendUSDC** to your Sozu **C…** address (copy from **Depositar → Stellar** tab).
5. Confirm on [Stellar Expert](https://stellar.expert/explorer/testnet) under the **C** account → Soroban / contract balances (BlendUSDC).
6. Reload Sozu Credit home — balance card should show spendable USDC; run **Enviar** for payment E2E.

## XLM reserve

Smart accounts need a small **XLM** reserve on **C** for Soroban fees. Factory deploy usually funds this; if sends fail with reserve errors, fund **C** with testnet XLM (friendbot on **G** signer does not always cover **C**).

## Automated check

```bash
# From SozuCredit repo — pass your C address as 2nd arg
pnpm exec tsx scripts/test-defi-e2e.ts <userId> <C_ADDRESS>
```

## Balance shows 0 in the app but Stellar Expert shows funds

1. **Address match** — In Sozu Credit open **Depositar → Stellar** and compare the full **C…** address to the account you funded on Blend / Stellar Expert (must be identical).
2. **Asset** — Expert may show **Circle USDC on G**; the app counts **BlendUSDC** (`CAQCFVLO…`) on **C** for sends and the main spendable line.
3. **Server env (production)** — Balance reads simulate against Soroban RPC and need:
   - `SOROBAN_RPC_URL=https://soroban-testnet.stellar.org`
   - `STELLAR_FUNDER_SECRET` (testnet key with a few XLM for simulation source)
   - `TESTNET_USDC_CONTRACT_ADDRESS=CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU` (optional override)

Without `STELLAR_FUNDER_SECRET`, simulations often fail silently and the UI shows **0**.

See also `docs/wallet-stellar-defindex.md`.
