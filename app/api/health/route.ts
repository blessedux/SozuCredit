import { NextResponse } from "next/server"
import { appUrl, betaTier, depositsEnabled, rpId, vercelEnv } from "@/lib/app-config"

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    const health = {
      status: "ok" as const,
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        nextVersion: process.env.npm_package_version || "unknown",
        vercelEnv,
      },
      deployment: {
        /** closed = Sozu Wallet closed beta; open = legacy credit posture */
        betaTier,
        depositsEnabled,
        appUrl: appUrl || null,
        rpId,
      },
      config: {
        supabaseUrl: supabaseUrl ? "✓ Set" : "✗ Missing",
        supabaseAnonKey: supabaseAnonKey ? "✓ Set" : "✗ Missing",
        supabaseServiceKey: supabaseServiceKey ? "✓ Set" : "⚠ Optional",
      },
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        {
          ...health,
          status: "error",
          error: "Missing required environment variables",
          message: "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set",
        },
        { status: 500 },
      )
    }

    return NextResponse.json(health, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
