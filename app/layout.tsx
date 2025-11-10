import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { PWARegister } from "@/components/pwa-register"
import { SharedBackground } from "@/components/shared-background"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "SozuCredit",
  description: "Community-powered micro-credit for entrepreneurs",
  generator: "v0.app",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SozuCredit",
  },
  icons: {
    apple: [
      { url: "/sozucredit_logo.png", sizes: "152x152", type: "image/png" },
      { url: "/sozucredit_logo.png", sizes: "192x192", type: "image/png" },
    ],
    icon: [
      { url: "/sozucredit_logo.png", sizes: "192x192", type: "image/png" },
      { url: "/sozucredit_logo.png", sizes: "512x512", type: "image/png" },
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
      <body className={`${inter.className} antialiased bg-black`} style={{ backgroundColor: '#000000' }}>
        <SharedBackground />
        {children}
        <Analytics />
        <PWARegister />
      </body>
    </html>
  )
}
