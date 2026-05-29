"use client"

// Shell handles both mobile (touch/swipe) and desktop (mouse drag + click nav).
// Static import removes one chunk-fetch round-trip on cold open — critical for PWA start speed.
import { MobileAppShell } from "@/components/mobile/mobile-app-shell"

export default function HomePage() {
  return <MobileAppShell />
}
