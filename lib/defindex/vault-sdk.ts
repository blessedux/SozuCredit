/**
 * DeFindex Vault SDK wrapper.
 *
 * Wraps @defindex/sdk to build unsigned transaction XDRs for deposit and
 * withdraw operations, then delegates signing/submission to the existing
 * Turnkey/passkey pipeline in lib/turnkey/soroban-signing.ts.
 */

import { DefindexSDK, SupportedNetworks } from "@defindex/sdk"
import type { StrategyId } from "./strategy-catalog"
import { getDeFindexConfig } from "./config"

/** Singleton SDK instance — no API key required for open vault operations. */
const sdk = new DefindexSDK({})

function toSupportedNetwork(networkStr: string): SupportedNetworks {
  return networkStr === "mainnet" ? SupportedNetworks.MAINNET : SupportedNetworks.TESTNET
}

/** Convert a decimal USDC amount to stroops (7 decimal places). */
export function usdcToStroops(amount: number): number {
  return Math.floor(amount * 10_000_000)
}

/** Convert stroops to decimal USDC. */
export function stroopsToUsdc(stroops: bigint | number): number {
  return Number(stroops) / 10_000_000
}

export interface BuildDepositResult {
  /** Unsigned transaction XDR ready to be signed + submitted. */
  xdr: string
  /** Raw simulation response from DeFindex SDK (for debugging). */
  simulationResponse: unknown
}

/**
 * Build an unsigned deposit transaction XDR.
 *
 * @param userPublicKey - Caller's Stellar public key.
 * @param amountUsdc    - Amount to deposit (decimal USDC, e.g. 50.0).
 * @param strategyId    - "fixed" | "yieldblox".
 * @param networkStr    - "testnet" | "mainnet".
 */
export async function buildDepositXdr(
  userPublicKey: string,
  amountUsdc: number,
  strategyId: StrategyId = "fixed",
  networkStr?: string | null
): Promise<BuildDepositResult> {
  const config = getDeFindexConfig(strategyId, networkStr)
  const network = toSupportedNetwork(config.network)
  const amountStroops = usdcToStroops(amountUsdc)

  console.log("[VaultSDK] Building deposit XDR:", {
    strategyId,
    network: config.network,
    vault: config.defindexVaultAddress,
    amountUsdc,
    amountStroops,
  })

  const response = await sdk.depositToVault(
    config.defindexVaultAddress,
    {
      amounts: [amountStroops],
      caller: userPublicKey,
      invest: true,
      slippageBps: 100,
    },
    network
  )

  const xdr = (response as any).xdr as string | null
  if (!xdr) throw new Error("DeFindex SDK deposit returned no XDR")

  return {
    xdr,
    simulationResponse: (response as any).simulationResponse,
  }
}

export interface BuildWithdrawResult {
  xdr: string
  simulationResponse: unknown
}

/**
 * Build an unsigned withdraw-by-shares transaction XDR.
 *
 * @param userPublicKey  - Caller's Stellar public key.
 * @param amountUsdc     - Approximate USDC to withdraw (used for slippage guard).
 * @param strategyId     - "fixed" | "yieldblox".
 * @param networkStr     - "testnet" | "mainnet".
 */
export async function buildWithdrawXdr(
  userPublicKey: string,
  amountUsdc: number,
  strategyId: StrategyId = "fixed",
  networkStr?: string | null
): Promise<BuildWithdrawResult> {
  const config = getDeFindexConfig(strategyId, networkStr)
  const network = toSupportedNetwork(config.network)
  const amountStroops = usdcToStroops(amountUsdc)

  console.log("[VaultSDK] Building withdraw XDR:", {
    strategyId,
    network: config.network,
    vault: config.defindexVaultAddress,
    amountUsdc,
    amountStroops,
  })

  const response = await sdk.withdrawFromVault(
    config.defindexVaultAddress,
    {
      amounts: [amountStroops],
      caller: userPublicKey,
      slippageBps: 100,
    },
    network
  )

  const xdr = (response as any).xdr as string | null
  if (!xdr) throw new Error("DeFindex SDK withdraw returned no XDR")

  return {
    xdr,
    simulationResponse: (response as any).simulationResponse,
  }
}

export interface VaultUserBalance {
  /** dfTokens (shares) held by the user. */
  dfTokens: number
  /** Approximate underlying USDC value. */
  underlyingUsdc: number
}

/**
 * Read a user's vault balance (dfTokens + underlying value) from chain.
 *
 * Returns zeroes rather than throwing on RPC failure.
 */
export async function getVaultUserBalance(
  userPublicKey: string,
  strategyId: StrategyId = "fixed",
  networkStr?: string | null
): Promise<VaultUserBalance> {
  const config = getDeFindexConfig(strategyId, networkStr)
  const network = toSupportedNetwork(config.network)

  try {
    const response = await sdk.getVaultBalance(
      config.defindexVaultAddress,
      userPublicKey,
      network
    )

    const raw = response as any
    const dfTokens = typeof raw?.dfTokens === "bigint"
      ? stroopsToUsdc(raw.dfTokens)
      : typeof raw?.dfTokens === "number"
        ? stroopsToUsdc(raw.dfTokens)
        : 0

    // underlyingBalance may be a bigint or number in stroops
    const underlyingRaw = raw?.underlyingBalance ?? raw?.underlying ?? 0
    const underlyingUsdc =
      typeof underlyingRaw === "bigint" || typeof underlyingRaw === "number"
        ? stroopsToUsdc(underlyingRaw)
        : 0

    return { dfTokens, underlyingUsdc }
  } catch (err) {
    console.warn(
      "[VaultSDK] getVaultBalance failed:",
      err instanceof Error ? err.message : err
    )
    return { dfTokens: 0, underlyingUsdc: 0 }
  }
}

/**
 * Parse minted dfTokens from a completed deposit's return value.
 *
 * DeFindex deposit returns a tuple: [Vec<i128> amounts, i128 dfTokensMinted, Option allocs].
 * The SDK simulation response may include the return value natively.
 */
export function parseDfTokensMinted(returnValue: unknown): number {
  try {
    if (Array.isArray(returnValue) && returnValue[1] != null) {
      return stroopsToUsdc(BigInt(returnValue[1] as string | number | bigint))
    }
  } catch {
    // ignore
  }
  return 0
}
