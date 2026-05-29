import { Suspense } from "react"
import { MobileAppShell } from "@/components/mobile/mobile-app-shell"

export default function HomePage() {
  return (
    <Suspense>
      <MobileAppShell />
    </Suspense>
  )
}
