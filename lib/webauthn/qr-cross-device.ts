/**
 * QR Code Cross-Device Registration Flow
 * 
 * For desktop devices without biometrics, users can scan a QR code
 * with their phone to complete registration on a compatible device.
 * 
 * Flow:
 * 1. Desktop generates QR with registration challenge + session ID
 * 2. User scans QR with phone
 * 3. Phone completes passkey registration
 * 4. Desktop polls for completion
 * 5. Both devices get auth'd session
 */

import QRCode from 'qrcode'

export interface CrossDeviceSession {
  /** Unique session ID for this cross-device flow */
  sessionId: string
  /** Registration challenge for passkey creation */
  challenge: string
  /** Username/SozuTag being registered */
  username: string
  /** Timestamp when session was created */
  createdAt: number
  /** When this session expires (60s) */
  expiresAt: number
}

export interface CrossDeviceRegistrationPayload {
  /** Session ID to poll for completion */
  sid: string
  /** Username to register */
  u: string
  /** App URL for mobile */
  url: string
}

const SESSION_TIMEOUT_MS = 60000 // 60 seconds
const POLL_INTERVAL_MS = 2000 // Poll every 2 seconds

/**
 * Generate a QR code for cross-device registration.
 * Desktop device calls this to create QR for phone to scan.
 */
export async function generateCrossDeviceQR(
  username: string,
  appUrl: string = process.env.NEXT_PUBLIC_APP_URL || 'https://app.sozu.capital'
): Promise<{
  qrCodeDataURL: string
  sessionId: string
  expiresAt: number
}> {
  // Generate unique session ID
  const sessionId = crypto.randomUUID()
  const expiresAt = Date.now() + SESSION_TIMEOUT_MS
  
  // Build mobile registration URL with session params
  const payload: CrossDeviceRegistrationPayload = {
    sid: sessionId,
    u: username,
    url: appUrl
  }
  
  // Encode as URL - phone will open this
  const mobileUrl = `${appUrl}/auth/cross-device?${new URLSearchParams({
    sid: payload.sid,
    u: payload.u
  }).toString()}`
  
  // Generate QR code as data URL
  const qrCodeDataURL = await QRCode.toDataURL(mobileUrl, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 300,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  })
  
  return {
    qrCodeDataURL,
    sessionId,
    expiresAt
  }
}

/**
 * Poll for cross-device registration completion.
 * Desktop calls this repeatedly until phone completes or timeout.
 */
export async function pollCrossDeviceCompletion(
  sessionId: string,
  onProgress?: (remainingMs: number) => void
): Promise<{
  completed: boolean
  timedOut: boolean
  userId?: string
  username?: string
  credentialId?: string
}> {
  const startTime = Date.now()
  const maxWaitMs = SESSION_TIMEOUT_MS
  
  while (Date.now() - startTime < maxWaitMs) {
    try {
      // Check if registration completed
      const response = await fetch(`/api/auth/cross-device/status?sessionId=${sessionId}`)
      
      if (!response.ok) {
        // Session not found or error - continue polling
        await sleep(POLL_INTERVAL_MS)
        continue
      }
      
      const data = await response.json()
      
      if (data.completed) {
        // Success! Phone completed registration
        return {
          completed: true,
          timedOut: false,
          userId: data.userId,
          username: data.username,
          credentialId: data.credentialId
        }
      }
      
      // Update progress callback
      const remainingMs = maxWaitMs - (Date.now() - startTime)
      if (onProgress) {
        onProgress(Math.max(0, remainingMs))
      }
      
      // Wait before next poll
      await sleep(POLL_INTERVAL_MS)
      
    } catch (error) {
      console.error('[Cross-Device] Poll error:', error)
      await sleep(POLL_INTERVAL_MS)
    }
  }
  
  // Timeout - registration not completed in 60s
  return {
    completed: false,
    timedOut: true
  }
}

/**
 * Start cross-device registration on mobile device (phone).
 * Called when user scans QR code and opens the mobile URL.
 */
export async function completeCrossDeviceRegistration(
  sessionId: string,
  username: string,
  credential: any // PublicKeyCredential from passkey creation
): Promise<{
  success: boolean
  error?: string
}> {
  try {
    // Send completion to server
    const response = await fetch('/api/auth/cross-device/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId,
        username,
        credential: {
          id: credential.id,
          rawId: credential.rawId,
          response: {
            clientDataJSON: credential.response.clientDataJSON,
            attestationObject: credential.response.attestationObject
          },
          type: credential.type
        }
      })
    })
    
    if (!response.ok) {
      const error = await response.json()
      return {
        success: false,
        error: error.message || 'Registration failed'
      }
    }
    
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    }
  }
}

/**
 * Check if cross-device session is still valid.
 */
export function isSessionValid(expiresAt: number): boolean {
  return Date.now() < expiresAt
}

/**
 * Get remaining time for a cross-device session.
 */
export function getRemainingTime(expiresAt: number): number {
  return Math.max(0, expiresAt - Date.now())
}

/**
 * Format remaining time as human-readable string.
 */
export function formatRemainingTime(ms: number): string {
  const seconds = Math.ceil(ms / 1000)
  if (seconds <= 0) return '0s'
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
