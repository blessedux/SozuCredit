/**
 * DeFi E2E Test Script
 * Tests core DeFi modules directly (no auth required)
 * Run: pnpm exec tsx scripts/test-defi-e2e.ts [strategyId] [walletAddress]
 */

import { readFileSync } from "fs"
import { resolve } from "path"

// Load .env.local before any imports that read env vars
function loadEnvLocal() {
  try {
    const envPath = resolve(process.cwd(), ".env.local")
    const content = readFileSync(envPath, "utf-8")
    for (const line of content.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const idx = trimmed.indexOf("=")
      if (idx === -1) continue
      const key = trimmed.slice(0, idx).trim()
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "")
      if (key && !(key in process.env)) process.env[key] = val
    }
  } catch {
    console.warn("⚠ Could not load .env.local")
  }
}
loadEnvLocal()

const STRATEGY_ID = (process.argv[2] as "fixed" | "yieldblox") ?? "fixed"
const WALLET_ADDRESS = process.argv[3] ?? null

// ─── ANSI helpers ─────────────────────────────────────────────────────────────
const c = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
}

type StepResult = {
  name: string
  status: "passed" | "failed" | "skipped" | "warn"
  data?: Record<string, unknown>
  error?: string
}

const steps: StepResult[] = []

function pass(name: string, data?: Record<string, unknown>) {
  steps.push({ name, status: "passed", data })
  console.log(c.green("  ✓"), c.bold(name))
  if (data) {
    for (const [k, v] of Object.entries(data)) {
      console.log(c.dim(`      ${k}:`), String(v))
    }
  }
}

function fail(name: string, error: unknown, data?: Record<string, unknown>) {
  const msg = error instanceof Error ? error.message : String(error)
  steps.push({ name, status: "failed", error: msg, data })
  console.log(c.red("  ✗"), c.bold(name))
  console.log(c.red(`      ${msg}`))
  if (data) {
    for (const [k, v] of Object.entries(data)) {
      console.log(c.dim(`      ${k}:`), String(v))
    }
  }
}

function skip(name: string, note: string) {
  steps.push({ name, status: "skipped" })
  console.log(c.yellow("  ⊘"), c.bold(name), c.dim(`(${note})`))
}

function warn(name: string, note: string, data?: Record<string, unknown>) {
  steps.push({ name, status: "warn", data })
  console.log(c.yellow("  ⚠"), c.bold(name), c.dim(`— ${note}`))
  if (data) {
    for (const [k, v] of Object.entries(data)) {
      console.log(c.dim(`      ${k}:`), String(v))
    }
  }
}

async function header(title: string) {
  console.log("\n" + c.cyan(c.bold(`── ${title} ─`.padEnd(60, "─"))))
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function testConfigValidation() {
  await header("Step 0 · Config Validation + On-Chain Deposit Asset")
  try {
    const { getResolvedDeFindexConfig, validateDeFindexConfig } = await import("../lib/defindex/config")
    const { getStrategyConfig } = await import("../lib/defindex/strategy-catalog")

    // getResolvedDeFindexConfig reads vault.get_assets on-chain and overrides assetAddress.
    const config = await getResolvedDeFindexConfig(STRATEGY_ID)
    const strategy = getStrategyConfig(STRATEGY_ID)
    const valid = validateDeFindexConfig(config)

    if (valid) {
      pass("Config valid", {
        network: config.network,
        strategyId: STRATEGY_ID,
        vaultAddress: strategy.vaultAddress,
        "depositAsset (on-chain)": config.assetAddress,
        "catalogAsset (fallback)": strategy.assetAddress,
        assetMatch: config.assetAddress === strategy.assetAddress ? "✓ same" : "⚠ on-chain override active",
        blendPoolId: strategy.blendPoolId,
        minDeposit: config.minDepositAmount,
        feeBuffer: config.networkFeeBuffer,
      })
    } else {
      fail("Config valid", "validateDeFindexConfig returned false", {
        vaultAddress: config.defindexVaultAddress,
        assetAddress: config.assetAddress,
      })
    }
  } catch (err) {
    fail("Config valid", err)
  }
}

async function testLiveAPY() {
  await header("Step 1 · Live APY (Blend SDK)")
  try {
    const { getRealTimeAPY } = await import("../lib/defindex/apy-calculator")
    const result = await getRealTimeAPY(STRATEGY_ID)

    if (result.success && result.data) {
      pass("APY fetched", {
        source: result.data.source ?? "unknown",
        yearly: `${result.data.yearly.toFixed(2)}%`,
        confidence: result.data.confidence ?? "n/a",
      })
    } else {
      warn("APY fetched", "returned success=false or no data", {
        success: String(result.success),
        error: result.error ?? "none",
      })
    }
  } catch (err) {
    fail("APY fetched", err)
  }
}

async function testProjection() {
  await header("Step 2 · Treasury Projection (APY × $100)")
  try {
    const { getRealTimeAPY } = await import("../lib/defindex/apy-calculator")
    const result = await getRealTimeAPY(STRATEGY_ID)

    if (result.data?.yearly) {
      const testPrincipal = 100
      const apy = result.data.yearly // already percent, e.g. 8.79
      const yearly = testPrincipal * (apy / 100)
      const monthly = yearly / 12
      const daily = yearly / 365
      pass("Projection computed", {
        principal: `$${testPrincipal}`,
        apyUsed: `${apy.toFixed(2)}%`,
        daily: `$${daily.toFixed(4)}`,
        monthly: `$${monthly.toFixed(2)}`,
        yearly: `$${yearly.toFixed(2)}`,
      })
    } else {
      skip("Projection computed", "No APY available to project")
    }
  } catch (err) {
    fail("Projection computed", err)
  }
}

async function testStrategyLink() {
  await header("Step 3 · Strategy Deep Link")
  try {
    const { getBlendStrategyLink } = await import("../lib/defindex/blend-strategy-link")
    // signature: getBlendStrategyLink(network?, strategyId?)
    const result = getBlendStrategyLink(null, STRATEGY_ID)
    if (result?.url?.startsWith("http")) {
      pass("Blend strategy link", {
        label: result.poolLabel,
        url: result.url,
        poolId: result.poolId,
      })
    } else {
      warn("Blend strategy link", "URL is empty or invalid", { url: result?.url ?? "(empty)" })
    }
  } catch (err) {
    fail("Blend strategy link", err)
  }
}

async function testSorobanBalanceRead(walletAddress: string) {
  await header("Step 4 · Vault Deposit Asset Balance")
  try {
    const { getResolvedDeFindexConfig } = await import("../lib/defindex/config")
    const { getDepositableUsdcBalance, getSorobanUsdcOnContractWallet } = await import(
      "../lib/stellar/soroban-token"
    )

    // Use on-chain deposit asset — not just the catalog default.
    const config = await getResolvedDeFindexConfig(STRATEGY_ID)
    const depositBalance = await getDepositableUsdcBalance(
      walletAddress,
      config.network,
      config.assetAddress,
    )
    const canDeposit = depositBalance >= config.minDepositAmount

    // Also show Circle SAC so it's clear both tokens are visible but only one is vault-eligible.
    let circleSac = 0
    if (config.network === "testnet" && walletAddress.startsWith("C")) {
      const breakdown = await getSorobanUsdcOnContractWallet(walletAddress, config.network)
      circleSac = breakdown.circleSac
    }

    const detail = {
      address: walletAddress.slice(0, 12) + "...",
      depositAsset: config.assetAddress.slice(0, 12) + "...",
      depositBalance: `${depositBalance.toFixed(4)} USDC`,
      circleSacOnC: circleSac > 0 ? `${circleSac.toFixed(4)} (not accepted by vault)` : "0",
      minDeposit: config.minDepositAmount,
    }

    if (canDeposit) {
      pass("Vault deposit asset balance", { ...detail, status: "Ready to deposit ✓" })
    } else {
      warn(
        "Vault deposit asset balance",
        `Balance ${depositBalance.toFixed(4)} < min ${config.minDepositAmount} — fund from testnet.blend.capital`,
        detail,
      )
    }
    return depositBalance
  } catch (err) {
    fail("Vault deposit asset balance", err)
    return 0
  }
}

async function testSDKSimulation(walletAddress: string) {
  await header("Step 5 · DeFindex SDK — Build Deposit XDR (no signing)")
  try {
    const { buildDepositXdr, getVaultUserBalance } = await import("../lib/defindex/vault-sdk")
    const { getResolvedDeFindexConfig } = await import("../lib/defindex/config")
    const { getDepositableUsdcBalance } = await import("../lib/stellar/soroban-token")

    const config = await getResolvedDeFindexConfig(STRATEGY_ID)
    const balance = await getDepositableUsdcBalance(walletAddress, config.network, config.assetAddress)

    // On-chain vault balance
    const vaultBalance = await getVaultUserBalance(walletAddress, STRATEGY_ID, config.network)
    pass("Vault balance read (on-chain)", {
      dfTokens: vaultBalance.dfTokens,
      underlyingUsdc: `${vaultBalance.underlyingUsdc} USDC`,
    })

    // XDR simulation
    if (balance >= config.minDepositAmount) {
      const testAmount = Math.min(balance - config.networkFeeBuffer, balance)
      const { xdr } = await buildDepositXdr(walletAddress, testAmount, STRATEGY_ID, config.network)
      pass("Deposit XDR built", {
        amount: `${testAmount} USDC`,
        xdrPreview: xdr.slice(0, 80) + "...",
        note: "XDR built successfully — not submitted",
      })
    } else {
      skip("Deposit XDR built", `balance ${balance} < min ${config.minDepositAmount}`)
    }
  } catch (err) {
    fail("SDK simulation", err)
  }
}

async function testWithdrawXDR(walletAddress: string) {
  await header("Step 6 · DeFindex SDK — Build Withdraw XDR (no signing)")
  try {
    const { buildWithdrawXdr, getVaultUserBalance } = await import("../lib/defindex/vault-sdk")
    const { getResolvedDeFindexConfig } = await import("../lib/defindex/config")

    const config = await getResolvedDeFindexConfig(STRATEGY_ID)
    const vaultBalance = await getVaultUserBalance(walletAddress, STRATEGY_ID, config.network)

    if (vaultBalance.underlyingUsdc > 0) {
      const { xdr } = await buildWithdrawXdr(
        walletAddress,
        vaultBalance.underlyingUsdc,
        STRATEGY_ID,
        config.network
      )
      pass("Withdraw XDR built", {
        amount: `${vaultBalance.underlyingUsdc} USDC`,
        xdrPreview: xdr.slice(0, 80) + "...",
        note: "XDR built successfully — not submitted",
      })
    } else {
      skip("Withdraw XDR built", "No vault position to withdraw from")
    }
  } catch (err) {
    fail("Withdraw XDR built", err)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(c.bold(c.cyan("\n╔══════════════════════════════════════════╗")))
  console.log(c.bold(c.cyan("║   SozuCredit · DeFi E2E Test Suite      ║")))
  console.log(c.bold(c.cyan("╚══════════════════════════════════════════╝")))
  console.log(c.dim(`  strategy: ${STRATEGY_ID}`))
  console.log(c.dim(`  wallet:   ${WALLET_ADDRESS ?? "(none — wallet-dependent steps skipped)"}`))
  console.log(c.dim(`  time:     ${new Date().toISOString()}`))

  await testConfigValidation()
  await testLiveAPY()
  await testProjection()
  await testStrategyLink()

  if (WALLET_ADDRESS) {
    const balance = await testSorobanBalanceRead(WALLET_ADDRESS)
    await testSDKSimulation(WALLET_ADDRESS)
    await testWithdrawXDR(WALLET_ADDRESS)
  } else {
    skip("BlendUSDC balance", "pass wallet address as 2nd arg to enable")
    skip("Deposit XDR build", "pass wallet address as 2nd arg to enable")
    skip("Withdraw XDR build", "pass wallet address as 2nd arg to enable")
  }

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log("\n" + c.cyan(c.bold("── Summary ".padEnd(60, "─"))))
  const passed = steps.filter(s => s.status === "passed").length
  const failed = steps.filter(s => s.status === "failed").length
  const warned = steps.filter(s => s.status === "warn").length
  const skipped = steps.filter(s => s.status === "skipped").length

  console.log(c.green(`  ✓ ${passed} passed`))
  if (warned)  console.log(c.yellow(`  ⚠ ${warned} warnings`))
  if (skipped) console.log(c.dim(`  ⊘ ${skipped} skipped`))
  if (failed)  console.log(c.red(`  ✗ ${failed} failed`))

  const allOk = failed === 0
  console.log(
    "\n " +
    (allOk
      ? c.green(c.bold("✅ All critical checks passed — safe to commit."))
      : c.red(c.bold(`❌ ${failed} check(s) failed — review errors above.`)))
  )

  if (!WALLET_ADDRESS) {
    console.log(
      c.dim("\n  Tip: run with a testnet wallet to also test balance reads + XDR builds:")
    )
    console.log(c.dim("  pnpm exec tsx scripts/test-defi-e2e.ts fixed G<ADDRESS>\n"))
  } else {
    console.log()
  }

  process.exit(allOk ? 0 : 1)
}

main().catch(err => {
  console.error(c.red("\nFatal error:"), err)
  process.exit(1)
})
