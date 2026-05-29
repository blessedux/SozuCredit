"use client"

import Image from "next/image"
import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import {
  WALLET_ACTIVATION_SLIDE_COUNT,
  WALLET_ACTIVATION_SLIDES_ES,
  WALLET_ACTIVATION_SLIDES_FALLBACK,
} from "@/lib/onboarding/slides"

const CROSSFADE_MS = 520
const BLACK_FADE_MS = 650
const WALLET_REVEAL_MS = 750

type Phase = "slides" | "black" | "done"

type WalletActivationOnboardingProps = {
  open: boolean
  activationSettled: boolean
  onExitComplete: () => void
}

function ActivationSlide({
  esSrc,
  fallbackSrc,
  opacity,
  priority,
}: {
  esSrc: string
  fallbackSrc: string
  opacity: number
  priority?: boolean
}) {
  const [src, setSrc] = useState(esSrc)

  useEffect(() => {
    setSrc(esSrc)
  }, [esSrc])

  return (
    <Image
      src={src}
      alt=""
      fill
      priority={priority}
      sizes="430px"
      className="object-cover object-top"
      style={{
        opacity,
        transition: `opacity ${CROSSFADE_MS}ms ease-in-out`,
      }}
      onError={() => {
        if (src !== fallbackSrc) setSrc(fallbackSrc)
      }}
    />
  )
}

/**
 * Full-screen onboarding overlay while the wallet activates.
 *
 * Layout:
 *   - Outer wrapper is transparent so the /home shader shows through on desktop
 *     (only the black-fade exit overlay covers the whole viewport)
 *   - Portrait container (max 430 × 932 px) is centred on desktop
 *
 * Navigation (manual only — no auto-advance):
 *   - Tap left  half → previous slide
 *   - Tap right half → next slide
 *   - On the last slide, tapping right queues the exit. The wallet opens as
 *     soon as activation has settled. Dots pulse while waiting.
 */
export function WalletActivationOnboarding({
  open,
  activationSettled,
  onExitComplete,
}: WalletActivationOnboardingProps) {
  const [phase, setPhase] = useState<Phase>("slides")
  const [slideIndex, setSlideIndex] = useState(0)
  const [outgoingIndex, setOutgoingIndex] = useState<number | null>(null)
  const [incomingOpacity, setIncomingOpacity] = useState(1)
  const [outgoingOpacity, setOutgoingOpacity] = useState(1)
  // true once the user taps "next" on the last slide
  const [exitPending, setExitPending] = useState(false)

  const exitStartedRef = useRef(false)

  // Pointer tracking (tap only — no swipe needed)
  const pointerRef = useRef({ startX: 0, startY: 0, active: false })

  // ─── Preload ────────────────────────────────────────────────────────────────
  const preloadSlides = useCallback(() => {
    for (let i = 0; i < WALLET_ACTIVATION_SLIDE_COUNT; i++) {
      for (const src of [WALLET_ACTIVATION_SLIDES_ES[i], WALLET_ACTIVATION_SLIDES_FALLBACK[i]]) {
        const img = new window.Image()
        img.src = src
      }
    }
  }, [])

  // ─── Exit ────────────────────────────────────────────────────────────────────
  const startExit = useCallback(() => {
    if (exitStartedRef.current) return
    exitStartedRef.current = true
    setPhase("black")
    window.setTimeout(() => {
      setPhase("done")
      onExitComplete()
    }, BLACK_FADE_MS + WALLET_REVEAL_MS)
  }, [onExitComplete])

  // ─── Slide transition ────────────────────────────────────────────────────────
  const goToSlide = useCallback(
    (next: number) => {
      if (exitStartedRef.current) return
      if (next >= WALLET_ACTIVATION_SLIDE_COUNT) {
        // User tapped "next" on the last slide — queue the exit.
        // The wallet opens as soon as activationSettled becomes true.
        setExitPending(true)
        return
      }
      if (next < 0 || next === slideIndex) return

      setOutgoingIndex(slideIndex)
      setOutgoingOpacity(1)
      setIncomingOpacity(0)
      setSlideIndex(next)

      // Double-rAF: ensures initial opacity=0 is painted before the transition starts
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setOutgoingOpacity(0)
          setIncomingOpacity(1)
        })
      })

      window.setTimeout(() => {
        setOutgoingIndex(null)
        setOutgoingOpacity(1)
      }, CROSSFADE_MS + 50)
    },
    [slideIndex],
  )

  // ─── Tap handlers ────────────────────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    pointerRef.current = { startX: e.clientX, startY: e.clientY, active: true }
  }, [])

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!pointerRef.current.active || phase !== "slides") return
      pointerRef.current.active = false

      const dx = e.clientX - pointerRef.current.startX
      const dy = e.clientY - pointerRef.current.startY

      // Ignore drags/swipes — only respond to taps
      if (Math.abs(dx) > 12 || Math.abs(dy) > 12) return

      if (e.clientX < window.innerWidth * 0.35) {
        goToSlide(slideIndex - 1) // left 35 % → back
      } else {
        goToSlide(slideIndex + 1) // right 65 % (incl. bottom after scroll) → next
      }
    },
    [phase, slideIndex, goToSlide],
  )

  const onPointerCancel = useCallback(() => {
    pointerRef.current.active = false
  }, [])

  // ─── Keyboard ────────────────────────────────────────────────────────────────
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
        e.preventDefault()
        goToSlide(slideIndex + 1)
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        goToSlide(slideIndex - 1)
      }
    },
    [slideIndex, goToSlide],
  )

  // ─── Effects ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    preloadSlides()
    setPhase("slides")
    setSlideIndex(0)
    setOutgoingIndex(null)
    setIncomingOpacity(1)
    setOutgoingOpacity(1)
    setExitPending(false)
    exitStartedRef.current = false
  }, [open, preloadSlides])

  // Open the wallet as soon as activation settles — but ONLY if the user has
  // already tapped past the last slide (exitPending).
  useEffect(() => {
    if (exitPending && activationSettled) startExit()
  }, [exitPending, activationSettled, startExit])

  if (!open || phase === "done") return null

  // Pulse dots while waiting for activation after user tapped past the last slide
  const waitingForActivation = exitPending && !activationSettled

  return (
    <>
      {/*
       * Fixed black overlay for the exit fade.
       * Sits above the scroll layer (z-[210]) so it covers the viewport
       * regardless of scroll position.
       */}
      <div
        className="fixed inset-0 bg-black pointer-events-none transition-opacity ease-in-out"
        style={{
          opacity: phase === "black" ? 1 : 0,
          transitionDuration: `${BLACK_FADE_MS}ms`,
          zIndex: 210,
        }}
      />

      {/*
       * Scroll container — fixed to the viewport, scrollable on the Y axis.
       * On tall devices the portrait card fits without scrolling.
       * On short devices the card overflows below the fold: the user can
       * scroll down to see the rest, then tap to advance.
       *
       * Tap zones (viewport-relative clientX):
       *   left 35 %  → previous slide
       *   right 65 % → next slide / open wallet
       */}
      <div
        className="fixed inset-0 z-[200] overflow-y-auto flex justify-center touch-manipulation select-none"
        role="dialog"
        aria-modal
        aria-label="Activando billetera"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onKeyDown={onKeyDown}
        tabIndex={0}
      >
        {/*
          Portrait container — natural 430 × 932 aspect ratio.
          Uses `max()` so it is at least 100dvh tall on large screens
          (shader visible on the sides on desktop) while remaining fully
          scrollable on compact phones where the aspect-ratio height
          exceeds the viewport height.
        */}
        <div
          className="relative w-full max-w-[430px] bg-black overflow-hidden"
          style={{
            height: "max(100dvh, calc(min(100vw, 430px) * 932 / 430))",
          }}
        >
          {/* Outgoing slide (fades out) */}
          {outgoingIndex !== null ? (
            <div className="absolute inset-0" style={{ zIndex: 0 }}>
              <ActivationSlide
                esSrc={WALLET_ACTIVATION_SLIDES_ES[outgoingIndex]}
                fallbackSrc={WALLET_ACTIVATION_SLIDES_FALLBACK[outgoingIndex]}
                opacity={outgoingOpacity}
              />
            </div>
          ) : null}

          {/* Incoming slide (fades in) */}
          <div className="absolute inset-0" style={{ zIndex: 1 }}>
            <ActivationSlide
              esSrc={WALLET_ACTIVATION_SLIDES_ES[slideIndex]}
              fallbackSrc={WALLET_ACTIVATION_SLIDES_FALLBACK[slideIndex]}
              opacity={incomingOpacity}
              priority={slideIndex === 0}
            />
          </div>

          {/* Slide dot indicators — pulse when waiting for activation */}
          <div
            className="pointer-events-none absolute left-0 right-0 z-10 flex items-center justify-center gap-2"
            style={{ bottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
          >
            {Array.from({ length: WALLET_ACTIVATION_SLIDE_COUNT }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-full transition-all duration-300 ease-out",
                  i === slideIndex
                    ? waitingForActivation
                      ? "w-5 h-[5px] bg-white animate-pulse"
                      : "w-5 h-[5px] bg-white"
                    : "w-[5px] h-[5px] bg-white/35",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
