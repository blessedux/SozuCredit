"use client"

import dynamic from "next/dynamic"

// Shell handles both mobile (touch/swipe) and desktop (mouse drag + click nav).
// Renders on all screen sizes so Pay, Deposit, and panel navigation work everywhere.
const AppShell = dynamic(
  () => import("@/components/mobile/mobile-app-shell").then(mod => ({ default: mod.MobileAppShell })),
  { ssr: false },
)

export default function HomePage() {
  return <AppShell />
}
