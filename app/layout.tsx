import type React from "react"
import type { Metadata, Viewport } from "next"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { PWARegister } from "@/components/pwa-register"
import { PaperShaderBackgroundShell } from "@/components/paper-shader-background-shell"
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
        {/* Instant preloader — shown before JS hydrates, hidden once app mounts */}
        <div
          id="sozu-preloader"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "#000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "opacity 0.4s ease",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/sozu_icon_192.png"
            alt="Sozu"
            width={64}
            height={64}
            style={{ borderRadius: "22%", opacity: 0.92 }}
          />
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                function hide(){
                  var el=document.getElementById('sozu-preloader');
                  if(!el)return;
                  el.style.opacity='0';
                  setTimeout(function(){if(el.parentNode)el.parentNode.removeChild(el);},420);
                }
                if(document.readyState==='complete'){hide();}
                else{window.addEventListener('load',function(){setTimeout(hide,120);});}
              })();
            `,
          }}
        />
        <PaperShaderBackgroundShell>{children}</PaperShaderBackgroundShell>
        <Analytics />
        <PWARegister />
        <Toaster />
      </body>
    </html>
  )
}
