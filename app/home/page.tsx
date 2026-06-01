import { Suspense } from "react"
import { AppBootstrapGate } from "@/components/app-bootstrap-gate"
import { MobileAppShell } from "@/components/mobile/mobile-app-shell"

export default function HomePage() {
  return (
    <AppBootstrapGate>
      <Suspense>
        <MobileAppShell />
      </Suspense>
    </AppBootstrapGate>
  )
}
