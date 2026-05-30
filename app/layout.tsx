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

export const metadata: Metadata = {
  title: "Sozu",
  description: "Self-custodial Stellar wallet",
  generator: "v0.app",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sozu",
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
    <html lang="en" className="bg-black" style={{ backgroundColor: '#000000' }}>
      <body className="font-sans antialiased bg-black" style={{ backgroundColor: '#000000' }}>
        {/* Injected outside React's tree so PWA shows logo before JS without hydration conflicts.
            Also registers the sozu:shell-ready listener here so the fade starts before React
            even mounts, giving the fastest possible preloader dismissal. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){function isStandalone(){return window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone}function sync(){try{var inner=window.innerHeight;var gap=isStandalone()?Math.max(0,window.screen.height-inner):0;var total=inner+gap;document.documentElement.style.setProperty("--sozu-layout-height",inner+"px");document.documentElement.style.setProperty("--sozu-viewport-gap",gap+"px");document.documentElement.style.setProperty("--sozu-app-height",total+"px");if(window.visualViewport){document.documentElement.style.setProperty("--sozu-visual-viewport-height",Math.round(window.visualViewport.height)+"px")}}catch(e){}}sync();if(window.visualViewport)window.visualViewport.addEventListener("resize",sync);window.addEventListener("resize",sync);window.addEventListener("orientationchange",sync);if(isStandalone()){document.documentElement.classList.add("sozu-standalone")}})();(function(){try{if(document.getElementById("sozu-preloader"))return;var d=document.createElement("div");d.id="sozu-preloader";d.style.cssText="position:fixed;inset:0;z-index:9999;background:#000;display:flex;align-items:center;justify-content:center";var i=document.createElement("img");i.src="/icons/sozu_icon_192.png";i.alt="";i.width=64;i.height=64;i.style.cssText="border-radius:22%;opacity:0.92";d.appendChild(i);document.body.insertBefore(d,document.body.firstChild)}catch(e){}})();(function(){function fade(){try{var el=document.getElementById("sozu-preloader");if(!el)return;el.style.transition="opacity 180ms ease";el.style.opacity="0";el.style.pointerEvents="none";setTimeout(function(){if(el.parentNode)el.parentNode.removeChild(el)},180)}catch(e){}}window.addEventListener("sozu:shell-ready",fade,{once:true})})();`,
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
