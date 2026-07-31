/**
 * Device Detection for WebAuthn/Passkey Support
 * 
 * Sozu Wallet requires biometric authentication for self-custody security.
 * This module detects device capabilities BEFORE attempting passkey creation
 * to prevent orphaned credentials and provide clear user guidance.
 */

export interface DeviceCapabilities {
  /** Device has platform authenticator (Face ID, Touch ID, Windows Hello) */
  hasPlatformAuthenticator: boolean
  /** WebAuthn API is available */
  hasWebAuthn: boolean
  /** Overall passkey capability assessment */
  canUsePasskeys: boolean
  /** Device type classification */
  deviceType: 'mobile' | 'desktop' | 'unknown'
  /** Operating system detection */
  os: 'ios' | 'android' | 'macos' | 'windows' | 'linux' | 'unknown'
  /** Recommended action for this device */
  recommendation: 'use-passkey' | 'use-qr-code' | 'use-different-device'
}

/**
 * Check if device supports passkey creation with platform authenticator.
 * This is the primary check - must pass before attempting registration.
 */
export async function isPasskeyCapable(): Promise<boolean> {
  // Check 1: WebAuthn API exists
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return false
  }

  try {
    // Check 2: Platform authenticator available (biometrics)
    const available = await window.PublicKeyCredential
      .isUserVerifyingPlatformAuthenticatorAvailable()
    
    return available
  } catch (error) {
    console.error('[Device Detection] Error checking platform authenticator:', error)
    return false
  }
}

/**
 * Detect full device capabilities for smart routing.
 * Call this early in the auth flow to determine UX path.
 */
export async function detectDeviceCapabilities(): Promise<DeviceCapabilities> {
  const hasWebAuthn = typeof window !== 'undefined' && !!window.PublicKeyCredential
  const hasPlatformAuthenticator = hasWebAuthn ? await isPasskeyCapable() : false
  
  // Detect device type and OS
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : ''
  
  // OS detection
  let os: DeviceCapabilities['os'] = 'unknown'
  if (ua.includes('iphone') || ua.includes('ipad')) os = 'ios'
  else if (ua.includes('android')) os = 'android'
  else if (ua.includes('mac')) os = 'macos'
  else if (ua.includes('win')) os = 'windows'
  else if (ua.includes('linux')) os = 'linux'
  
  // Device type detection
  const isMobile = /iphone|ipad|android|mobile/i.test(ua)
  const deviceType: DeviceCapabilities['deviceType'] = isMobile ? 'mobile' : 'desktop'
  
  // Determine recommendation
  let recommendation: DeviceCapabilities['recommendation']
  
  if (hasPlatformAuthenticator) {
    // Device has biometrics - use passkey directly
    recommendation = 'use-passkey'
  } else if (deviceType === 'desktop') {
    // Desktop without biometrics - show QR code for phone registration
    recommendation = 'use-qr-code'
  } else {
    // Mobile without biometrics (old device) - suggest different device
    recommendation = 'use-different-device'
  }
  
  return {
    hasPlatformAuthenticator,
    hasWebAuthn,
    canUsePasskeys: hasPlatformAuthenticator,
    deviceType,
    os,
    recommendation
  }
}

/**
 * Get user-friendly error message based on device capabilities.
 * Use this to show clear guidance instead of technical errors.
 */
export function getDeviceGuidanceMessage(capabilities: DeviceCapabilities): {
  title: string
  message: string
  action: string
} {
  const { recommendation, deviceType, os } = capabilities
  
  switch (recommendation) {
    case 'use-passkey':
      return {
        title: 'Ready to Go',
        message: 'Your device supports secure self-custody.',
        action: 'Continue with biometric authentication'
      }
      
    case 'use-qr-code':
      return {
        title: 'Complete Setup on Your Phone',
        message: `This ${os === 'windows' ? 'Windows' : os === 'linux' ? 'Linux' : 'desktop'} device doesn't have biometric authentication. Sozu Wallet requires Face ID, Touch ID, or Windows Hello for self-custody security.`,
        action: 'Scan QR code with your phone'
      }
      
    case 'use-different-device':
      return {
        title: 'Biometric Authentication Required',
        message: `Sozu Wallet requires ${deviceType === 'mobile' && os === 'ios' ? 'Face ID or Touch ID' : deviceType === 'mobile' && os === 'android' ? 'fingerprint or face unlock' : 'biometric authentication'} for self-custody security. Your device doesn't support this feature.`,
        action: 'Use a device with biometric authentication'
      }
      
    default:
      return {
        title: 'Device Not Supported',
        message: 'Sozu Wallet requires biometric authentication for self-custody security.',
        action: 'Use a compatible device'
      }
  }
}

/**
 * Check if device is likely to support cross-device passkey flow.
 * Desktop devices without biometrics can use QR code to register on phone.
 */
export function supportsQRCodeFlow(capabilities: DeviceCapabilities): boolean {
  return capabilities.deviceType === 'desktop' && !capabilities.hasPlatformAuthenticator
}

/**
 * Generate a compatibility report for debugging/support.
 * Include this in error reports to help diagnose device issues.
 */
export function getCompatibilityReport(): {
  userAgent: string
  platform: string
  hasWebAuthn: boolean
  timestamp: string
} {
  return {
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
    hasWebAuthn: typeof window !== 'undefined' && !!window.PublicKeyCredential,
    timestamp: new Date().toISOString()
  }
}
