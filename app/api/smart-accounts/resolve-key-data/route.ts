import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { xdr } from "@stellar/stellar-sdk"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { resolveOnChainSignerKeyData } from "@/lib/stellar/smartAccounts/resolveOnChainPublicKey"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

export async function GET(request: NextRequest) {
  const headers = corsHeaders(request)
  const contractId = request.nextUrl.searchParams.get("contractId")?.trim() ?? ""
  const credentialId = request.nextUrl.searchParams.get("credentialId")?.trim() ?? ""
  const authEntryXdr = request.nextUrl.searchParams.get("authEntryXdr")?.trim() ?? ""

  if (!contractId.startsWith("C") || !credentialId) {
    return NextResponse.json(
      { error: "contractId and credentialId are required." },
      { status: 400, headers },
    )
  }

  let authEntry: xdr.SorobanAuthorizationEntry | undefined
  if (authEntryXdr) {
    try {
      authEntry = xdr.SorobanAuthorizationEntry.fromXDR(authEntryXdr, "base64")
    } catch {
      return NextResponse.json({ error: "Invalid authEntryXdr." }, { status: 400, headers })
    }
  }

  const keyData = await resolveOnChainSignerKeyData({
    contractId,
    credentialId,
    authEntry,
  })

  if (!keyData) {
    return NextResponse.json(
      { error: "Signer keyData not found on this smart account." },
      { status: 404, headers },
    )
  }

  return NextResponse.json(
    { keyDataBase64: keyData.toString("base64") },
    { headers },
  )
}
