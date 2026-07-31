/**
 * Cross-Device Registration Completion
 * 
 * Phone (mobile device with biometrics) calls this after completing
 * passkey registration to notify desktop device.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyRegistration } from '@/lib/turnkey/passkeys'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, username, credential } = body
    
    if (!sessionId || !username || !credential) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    const supabase = await createClient()
    
    // Get session
    const { data: session, error: sessionError } = await supabase
      .from('cross_device_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single()
    
    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }
    
    // Check if expired
    if (new Date(session.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Session expired' },
        { status: 400 }
      )
    }
    
    // Check if already completed
    if (session.completed) {
      return NextResponse.json(
        { error: 'Session already completed' },
        { status: 400 }
      )
    }
    
    // Verify the passkey registration
    const regResult = await verifyRegistration(
      username,
      credential,
      session.challenge,
      null // No referral code in cross-device flow
    )
    
    if (!regResult || !regResult.success || !regResult.userId) {
      return NextResponse.json(
        { error: 'Registration verification failed' },
        { status: 400 }
      )
    }
    
    // Mark session as completed
    const { error: updateError } = await supabase
      .from('cross_device_sessions')
      .update({
        completed: true,
        user_id: regResult.userId,
        credential_id: credential.id,
        completed_at: new Date().toISOString()
      })
      .eq('session_id', sessionId)
    
    if (updateError) {
      console.error('[Cross-Device Complete] Error updating session:', updateError)
      return NextResponse.json(
        { error: 'Failed to update session' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      userId: regResult.userId,
      username
    })
    
  } catch (error) {
    console.error('[Cross-Device Complete] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
