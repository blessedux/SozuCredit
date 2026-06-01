import { NextRequest, NextResponse } from "next/server"
import { getAssetRegistry } from "@/lib/stellar/asset-registry"
import { getHolderTokenBalances } from "@/lib/stellar/token-balances"
import { getStellarConfig } from "@/lib/turnkey/config"
import { isStellarHolderAddress } from "@/lib/stellar/stellar-holder"

const corsHeaders = () => ({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id",
})

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() })
}

/**
 * Contract-native asset catalog + optional per-holder balances.
 * GET /api/wallet/stellar/assets?holder=C…
 */
export async function GET(request: NextRequest) {
  try {
    const cfg = getStellarConfig()
    const network = cfg.network
    const registry = getAssetRegistry(network).map((a) => ({
      id: a.id,
      contractId: a.contractId,
      symbol: a.symbol,
      name: a.name,
      displayName: a.displayName,
      decimals: a.decimals,
      network: a.network,
      issuer: a.issuer,
      category: a.category,
      sendPriority: a.sendPriority,
    }))

    const holder = request.nextUrl.searchParams.get("holder")?.trim()
    let balances: { assetId: string; contractId: string; displayName: string; balance: number }[] | undefined

    if (holder && isStellarHolderAddress(holder)) {
      const rows = await getHolderTokenBalances(holder, network)
      balances = rows.map((row) => ({
        assetId: row.asset.id,
        contractId: row.asset.contractId,
        displayName: row.asset.displayName,
        balance: row.balance,
      }))
    }

    return NextResponse.json(
      { network, registry, balances },
      { headers: corsHeaders() },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders() })
  }
}
