/**
 * Cross-Device Registration Status Check
 * 
 * Desktop device polls this endpoint to check if phone has completed registration.
 * Returns completion status and auth data when ready.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')
  
  if (!sessionId) {
    return NextResponse.json(
      { error: 'Missing sessionId' },
      { status: 400 }
    )
  }
  
  try {
    const supabase = await createClient()
    
    // Check cross_device_sessions table for completion
    const { data: session, error } = await supabase
      .from('cross_device_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single()
    
    if (error || !session) {
      return NextResponse.json(
        { completed: false },
        { status: 200 }
      )
    }
    
    // Check if session expired
    if (new Date(session.expires_at) < new Date()) {
      return NextResponse.json(
        { completed: false, expired: true },
        { status: 200 }
      )
    }
    
    // Check if completed
    if (session.completed && session.user_id) {
      return NextResponse.json({
        completed: true,
        userId: session.user_id,
        username: session.username,
        credentialId: session.credential_id
      })
    }
    
    // Not yet completed
    return NextResponse.json({ completed: false })
    
  } catch (error) {
    console.error('[Cross-Device Status] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
