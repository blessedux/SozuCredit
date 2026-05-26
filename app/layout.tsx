import type React from "react"
import type { Metadata, Viewport } from "next"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { PWARegister } from "@/components/pwa-register"
import { PaperShaderBackgroundShell } from "@/components/paper-shader-background-shell"
import { Toaster } from "@/components/ui/sonner"

export const metadata: Metadata = {
  title: "Sozu Wallet",
  description: "Self-custodial Stellar wallet with DeFindex integration",
  generator: "v0.app",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sozu Wallet",
  },
  icons: {
    apple: [
      { url: "/sozucapital_logo_tb.png", sizes: "152x152", type: "image/png" },
      { url: "/sozucapital_logo_tb.png", sizes: "192x192", type: "image/png" },
    ],
    icon: [
      { url: "/sozucapital_logo_tb.png", sizes: "192x192", type: "image/png" },
      { url: "/sozucapital_logo_tb.png", sizes: "512x512", type: "image/png" },
    ],
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "mobile-web-app-capable": "yes",
    "format-detection": "telephone=no",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-black" style={{ backgroundColor: '#000000' }}>
      <body className="font-sans antialiased bg-black" style={{ backgroundColor: '#000000' }}>
        <PaperShaderBackgroundShell>{children}</PaperShaderBackgroundShell>
        <Analytics />
        <PWARegister />
        <Toaster />
      </body>
    </html>
  )
}
