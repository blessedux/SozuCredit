/**
 * Cross-Device Registration Status Check
 *
 * Desktop polls for completion. Phone may also read pending challenge/username.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"

function serviceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) return null
  return createServiceClient(supabaseUrl, supabaseServiceKey)
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get("sessionId")

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 })
  }

  try {
    const supabase = serviceClient()
    if (!supabase) {
      return NextResponse.json({ error: "Service not available" }, { status: 500 })
    }

    const { data: session, error } = await supabase
      .from("cross_device_sessions")
      .select("*")
      .eq("session_id", sessionId)
      .maybeSingle()

    if (error || !session) {
      return NextResponse.json({ completed: false }, { status: 200 })
    }

    if (new Date(session.expires_at) < new Date()) {
      return NextResponse.json(
        { completed: false, expired: true },
        { status: 200 }
      )
    }

    if (session.completed && session.user_id) {
      return NextResponse.json({
        completed: true,
        userId: session.user_id,
        username: session.username,
        credentialId: session.credential_id,
      })
    }

    return NextResponse.json({
      completed: false,
      username: session.username,
      challenge: session.challenge,
      expiresAt: new Date(session.expires_at).getTime(),
    })
  } catch (error) {
    console.error("[Cross-Device Status] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
