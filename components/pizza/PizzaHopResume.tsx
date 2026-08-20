"use client"

import { useEffect, useState } from "react"
import { PizzaAuthContinuation } from "@/components/pizza/PizzaAuthContinuation"
import { peekPizzaHopReturn } from "@/lib/pizza/hop-return-storage"

/** If the PWA focused /home and dropped return_to, finish the pay hop from the stash. */
export function PizzaHopResume() {
  const [returnTo, setReturnTo] = useState<string | null>(null)

  useEffect(() => {
    setReturnTo(peekPizzaHopReturn())
  }, [])

  if (!returnTo) return null
  return <PizzaAuthContinuation continuation={{ kind: "hop", returnTo }} />
}
