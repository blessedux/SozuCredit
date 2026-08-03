import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"

/** Backup PIN setup retired — Passkey-only (ADR-0002). */
export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      error: "pin_auth_retired",
      message: "Backup PIN is no longer available. Use your passkey.",
    },
    { status: 410, headers: corsHeaders(request) },
  )
}
