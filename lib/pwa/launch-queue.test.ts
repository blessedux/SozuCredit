import { describe, expect, it } from "vitest"
import {
  consumePwaLaunchQueue,
  sameOriginPathFromLaunchUrl,
} from "@/lib/pwa/launch-queue"

const ORIGIN = "https://app.sozu.capital"
const QR4_AUTH =
  "/auth?return_to=" + encodeURIComponent("https://pay.sozu.capital/pay/qr/qr4?hopped=1")

describe("sameOriginPathFromLaunchUrl", () => {
  it("keeps the qr4 hop path and drops other origins", () => {
    expect(sameOriginPathFromLaunchUrl(`${ORIGIN}${QR4_AUTH}`, ORIGIN)).toBe(QR4_AUTH)
    expect(sameOriginPathFromLaunchUrl("https://evil.example/auth?return_to=x", ORIGIN)).toBeNull()
  })
})

describe("consumePwaLaunchQueue", () => {
  it("navigates an existing PWA from /home to the qr4 /auth hop", () => {
    let consumer: ((params: { targetURL?: string }) => void) | null = null
    let navigated: string | null = null
    consumePwaLaunchQueue({
      launchQueue: {
        setConsumer(cb) {
          consumer = cb
        },
      },
      currentOrigin: ORIGIN,
      currentHref: `${ORIGIN}/home`,
      navigate: (path) => {
        navigated = path
      },
    })
    consumer?.({ targetURL: `${ORIGIN}${QR4_AUTH}` })
    expect(navigated).toBe(QR4_AUTH)
  })

  it("does not reload when the launch URL is already open", () => {
    let consumer: ((params: { targetURL?: string }) => void) | null = null
    let navigated: string | null = null
    consumePwaLaunchQueue({
      launchQueue: {
        setConsumer(cb) {
          consumer = cb
        },
      },
      currentOrigin: ORIGIN,
      currentHref: `${ORIGIN}${QR4_AUTH}`,
      navigate: (path) => {
        navigated = path
      },
    })
    consumer?.({ targetURL: `${ORIGIN}${QR4_AUTH}` })
    expect(navigated).toBeNull()
  })
})
