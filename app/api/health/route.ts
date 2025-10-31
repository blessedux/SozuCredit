import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    const health = {
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        nextVersion: process.env.npm_package_version || "unknown",
      },
      config: {
        supabaseUrl: supabaseUrl ? "✓ Set" : "✗ Missing",
        supabaseAnonKey: supabaseAnonKey ? "✓ Set" : "✗ Missing",
        supabaseServiceKey: supabaseServiceKey ? "✓ Set" : "⚠ Optional",
      },
    }

    // If critical variables are missing, return 500
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        {
          ...health,
          status: "error",
          error: "Missing required environment variables",
          message: "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set",
        },
        { status: 500 }
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
      { status: 500 }
    )
  }
}

