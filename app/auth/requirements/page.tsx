import { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Shield, Smartphone, Monitor, CheckCircle2, XCircle, ArrowLeft } from "lucide-react"

export const metadata: Metadata = {
  title: "Device Requirements | Sozu Wallet",
  description: "Learn which devices support secure self-custodial accounts with Sozu Wallet"
}

export default function DeviceRequirementsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container max-w-3xl mx-auto px-4 py-12 space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <Link href="/auth">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Login
            </Button>
          </Link>
          
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">Device Requirements</h1>
            </div>
            <p className="text-lg text-muted-foreground">
              Sozu Wallet requires biometric authentication for self-custodial security
            </p>
          </div>
        </div>

        {/* Why Biometrics Required */}
        <div className="bg-card border rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold">Why We Require Biometrics</h2>
          <div className="space-y-3 text-muted-foreground">
            <p>
              Sozu Wallet is <strong className="text-foreground">completely self-custodial</strong>. 
              Your private keys are stored securely on your device, protected by your device's 
              secure enclave (the same hardware that protects your banking apps).
            </p>
            <p>
              We never have access to your keys. Ever. This means:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Your funds are always under your control</li>
              <li>No one (including us) can access your wallet without your biometric authentication</li>
              <li>You're protected from hacks, data breaches, and third-party failures</li>
            </ul>
            <p>
              To enable this level of security while keeping the experience simple, 
              we require devices with modern biometric authentication.
            </p>
          </div>
        </div>

        {/* Supported Devices */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Supported Devices</h2>
          
          {/* Mobile */}
          <div className="bg-card border rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Smartphone className="h-6 w-6 text-primary" />
              <h3 className="text-lg font-semibold">Mobile Devices</h3>
            </div>
            
            <div className="space-y-4">
              <div className="flex gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium">iOS (iPhone/iPad)</p>
                  <p className="text-sm text-muted-foreground">
                    iOS 16+ with Face ID or Touch ID
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium">Android</p>
                  <p className="text-sm text-muted-foreground">
                    Android 9+ with fingerprint sensor or face unlock
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <XCircle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-muted-foreground">Older Devices</p>
                  <p className="text-sm text-muted-foreground">
                    Devices without biometric sensors cannot create self-custodial wallets
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop */}
          <div className="bg-card border rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Monitor className="h-6 w-6 text-primary" />
              <h3 className="text-lg font-semibold">Desktop Computers</h3>
            </div>
            
            <div className="space-y-4">
              <div className="flex gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium">macOS</p>
                  <p className="text-sm text-muted-foreground">
                    macOS Ventura+ with Touch ID (MacBook Pro, MacBook Air)
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium">Windows</p>
                  <p className="text-sm text-muted-foreground">
                    Windows 10+ with Windows Hello (fingerprint or facial recognition)
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium">Desktop Without Biometrics</p>
                  <p className="text-sm text-muted-foreground">
                    You can complete registration by scanning a QR code with your phone
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <XCircle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-muted-foreground">Linux / ChromeOS</p>
                  <p className="text-sm text-muted-foreground">
                    Currently not supported for direct registration. Use QR code with your phone.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cross-Device Registration */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold">Don't Have Biometrics?</h2>
          <p className="text-muted-foreground">
            If you're on a desktop computer without a fingerprint sensor or facial recognition, 
            you can still create a wallet by scanning a QR code with your phone during registration.
          </p>
          <p className="text-sm text-muted-foreground">
            Your phone must have biometric authentication (Face ID, Touch ID, or fingerprint sensor).
          </p>
        </div>

        {/* Why Not Passwords */}
        <div className="bg-card border rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold">Why Not Just Use Passwords?</h2>
          <p className="text-muted-foreground">
            Passwords can be phished, stolen, or forgotten. Biometric authentication with 
            hardware-backed security provides:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4 text-muted-foreground">
            <li>Protection against phishing attacks</li>
            <li>Hardware-level encryption in your device's secure enclave</li>
            <li>No password to remember or recover</li>
            <li>Instant, frictionless access with your fingerprint or face</li>
          </ul>
        </div>

        {/* CTA */}
        <div className="flex justify-center pt-4">
          <Link href="/auth">
            <Button size="lg" className="gap-2">
              <Shield className="h-5 w-5" />
              Get Started
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
