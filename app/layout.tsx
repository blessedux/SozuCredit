import type React from "react"
import type { Metadata, Viewport } from "next"
import "./globals.css"
import { AppReadyFallback } from "@/components/app-ready-fallback"
import { DeferredAnalytics } from "@/components/deferred-analytics"
import { PWARegister } from "@/components/pwa-register"
import { PaperShaderBackgroundShell } from "@/components/paper-shader-background-shell"
import { ViewportHeightSync } from "@/components/viewport-height-sync"
import { Preloader } from "@/components/preloader-remover"
import { Toaster } from "@/components/ui/sonner"
import { authRoutingInlineScript } from "@/lib/client-auth-gate"

const VIEWPORT_SYNC_INLINE = `(function(){function isStandalone(){return window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone}function sync(){try{var inner=window.innerHeight;var gap=isStandalone()?Math.max(0,window.screen.height-inner):0;var total=inner+gap;var vv=window.visualViewport?Math.round(window.visualViewport.height):inner;var css=":root{--sozu-layout-height:"+inner+"px;--sozu-viewport-gap:"+gap+"px;--sozu-app-height:"+total+"px;--sozu-visual-viewport-height:"+vv+"px}";var el=document.getElementById("sozu-viewport-vars");if(!el){el=document.createElement("style");el.id="sozu-viewport-vars";document.head.appendChild(el)}el.textContent=css}catch(e){}}sync();if(window.visualViewport)window.visualViewport.addEventListener("resize",sync);window.addEventListener("resize",sync);window.addEventListener("orientationchange",sync);if(isStandalone()){document.documentElement.classList.add("sozu-standalone")}})();`

const BEFORE_PAINT_INLINE = `${VIEWPORT_SYNC_INLINE}${authRoutingInlineScript()}`

export const metadata: Metadata = {
  title: "Sozu Wallet",
  description: "Self-custodial Stellar wallet",
  generator: "v0.app",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sozu Wallet",
    startupImage: [
      // Universal splash — iOS uses the closest match by screen size
      { url: "/icons/sozu_splash.png" },
    ],
  },
  icons: {
    apple: [
      { url: "/icons/sozu_icon_152.png", sizes: "152x152", type: "image/png" },
      { url: "/icons/sozu_icon_180.png", sizes: "180x180", type: "image/png" },
      { url: "/icons/sozu_icon_192.png", sizes: "192x192", type: "image/png" },
    ],
    icon: [
      { url: "/icons/sozu_icon_192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/sozu_icon_512.png", sizes: "512x512", type: "image/png" },
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
    <html
      lang="en"
      className="bg-black"
      style={{ backgroundColor: "#000000" }}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased bg-black" style={{ backgroundColor: "#000000" }}>
        {/*
          Before-paint: viewport CSS vars (via <style>, not html.style — avoids hydration mismatch)
          + sync auth routing. Preloader is React-owned.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: BEFORE_PAINT_INLINE,
          }}
        />
        <Preloader />
        <ViewportHeightSync />
        <PaperShaderBackgroundShell>{children}</PaperShaderBackgroundShell>
        <AppReadyFallback />
        <DeferredAnalytics />
        <PWARegister />
        <Toaster />
      </body>
    </html>
  )
}
