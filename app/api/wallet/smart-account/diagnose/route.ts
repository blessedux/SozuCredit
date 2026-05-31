import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { probeSmartAccountContract } from "@/lib/stellar/smartAccounts/probeContract"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

/**
 * Read-only probe for support / repair flows (no state changes).
 */
export async function GET(request: NextRequest) {
  const headers = corsHeaders(request)
  const contractId = request.nextUrl.searchParams.get("contractId")?.trim() ?? ""
  const signerG = request.nextUrl.searchParams.get("signerG")?.trim() ?? ""

  if (!contractId.startsWith("C")) {
    return NextResponse.json({ error: "contractId (C…) required." }, { status: 400, headers })
  }

  const probe = await probeSmartAccountContract(
    contractId,
    signerG.startsWith("G") ? signerG : null,
  )

  return NextResponse.json(probe, { headers })
}
