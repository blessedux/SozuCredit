import { Suspense } from "react"
import { AppBootstrapGate } from "@/components/app-bootstrap-gate"
import { MobileAppShell } from "@/components/mobile/mobile-app-shell"
import { PizzaHopResume } from "@/components/pizza/PizzaHopResume"

export default function HomePage() {
  return (
    <AppBootstrapGate>
      <PizzaHopResume />
      <Suspense>
        <MobileAppShell />
      </Suspense>
    </AppBootstrapGate>
  )
}
