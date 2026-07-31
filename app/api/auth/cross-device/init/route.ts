/**
 * Initialize Cross-Device Registration Session
 * 
 * Desktop device calls this to create a session before showing QR code.
 * Returns sessionId and challenge for QR code generation.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateRegistrationChallenge } from '@/lib/turnkey/passkeys'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username } = body
    
    if (!username) {
      return NextResponse.json(
        { error: 'Missing username' },
        { status: 400 }
      )
    }
    
    // Generate registration challenge
    const challenge = await generateRegistrationChallenge(username)
    
    if (!challenge || !challenge.challenge) {
      return NextResponse.json(
        { error: 'Failed to generate challenge' },
        { status: 500 }
      )
    }
    
    const supabase = await createClient()
    
    // Create cross-device session
    const sessionId = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 60000) // 60 seconds
    
    const { error: insertError } = await supabase
      .from('cross_device_sessions')
      .insert({
        session_id: sessionId,
        username,
        challenge: challenge.challenge,
        expires_at: expiresAt.toISOString(),
        completed: false
      })
    
    if (insertError) {
      console.error('[Cross-Device Init] Error creating session:', insertError)
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      sessionId,
      challenge: challenge.challenge,
      expiresAt: expiresAt.getTime()
    })
    
  } catch (error) {
    console.error('[Cross-Device Init] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
