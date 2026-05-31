import { NextResponse } from "next/server"
import { Networks } from "@stellar/stellar-sdk"
import { getOzSmartAccountConfig } from "@/lib/stellar/smartAccounts/ozConfig"

export async function GET() {
  try {
    const cfg = getOzSmartAccountConfig()
    const networkPassphrase =
      process.env.STELLAR_NETWORK === "public" ? Networks.PUBLIC : Networks.TESTNET
    const rpcUrl =
      process.env.SOROBAN_RPC_URL?.trim() ||
      process.env.NEXT_PUBLIC_SOROBAN_RPC_URL?.trim() ||
      (process.env.STELLAR_NETWORK === "public"
        ? "https://soroban-mainnet.stellar.org"
        : "https://soroban-testnet.stellar.org")

    return NextResponse.json({
      rpcUrl,
      networkPassphrase,
      accountWasmHash: cfg.accountWasmHash,
      webauthnVerifierAddress: cfg.webauthnVerifierContractId,
      thresholdPolicyAddress: cfg.thresholdPolicyContractId,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 503 })
  }
}
