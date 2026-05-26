"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { UniversalCommandBar } from "@/components/home/universal-command-bar"
import { DepositModal } from "@/components/home/deposit-modal"
import { createClient } from "@/lib/supabase/client"

type HomePanelProps = {
  onPayClick: () => void
}

const SWIPE_Y_THRESHOLD = 22   // px vertical to commit gesture
const AXIS_RATIO       = 1.2   // vertical must dominate horizontal by this ratio

export function HomePanel({ onPayClick }: HomePanelProps) {
  const [isDepositOpen, setIsDepositOpen]     = useState(false)
  const [signOutRevealed, setSignOutRevealed] = useState(false)
  const [isSigningOut, setIsSigningOut]       = useState(false)
  const router   = useRouter()
  const cardRef  = useRef<HTMLDivElement>(null)

  // ─── Wheel (2-finger trackpad, desktop) ───────────────────────────────────
  // Must use direct DOM listener with { passive: false } so we can preventDefault
  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    let accumulated = 0

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()        // block browser scroll / back-gesture
      e.stopPropagation()
      accumulated += e.deltaY
      if (accumulated < -40) { setSignOutRevealed(true);  accumulated = 0 }
      if (accumulated >  40) { setSignOutRevealed(false); accumulated = 0 }
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [])

  // ─── Touch (mobile swipe — works even over child buttons) ─────────────────
  const touchStartY  = useRef<number | null>(null)
  const touchStartX  = useRef<number | null>(null)
  const touchMovedY  = useRef(0)
  const isSwiping    = useRef(false)   // true once gesture is confirmed vertical

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
    touchStartX.current = e.touches[0].clientX
    touchMovedY.current = 0
    isSwiping.current   = false
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === null) return
    const dy = e.touches[0].clientY - touchStartY.current
    const dx = e.touches[0].clientX - touchStartX.current!
    touchMovedY.current = dy

    // Lock to vertical axis once clearly swiping
    if (!isSwiping.current && Math.abs(dy) > 8) {
      isSwiping.current = Math.abs(dy) > Math.abs(dx) * AXIS_RATIO
    }
  }, [])

  const onTouchEnd = useCallback(() => {
    if (!isSwiping.current || touchStartY.current === null) {
      touchStartY.current = null
      return
    }

    const dy = touchMovedY.current

    if (dy < -SWIPE_Y_THRESHOLD) {
      setSignOutRevealed(true)
      // Swallow the next click so the button under the finger doesn't fire
      const eatClick = (ev: MouseEvent) => { ev.stopPropagation(); ev.preventDefault() }
      document.addEventListener("click", eatClick, { capture: true, once: true })
    } else if (dy > SWIPE_Y_THRESHOLD) {
      setSignOutRevealed(false)
      const eatClick = (ev: MouseEvent) => { ev.stopPropagation(); ev.preventDefault() }
      document.addEventListener("click", eatClick, { capture: true, once: true })
    }

    touchStartY.current = null
    isSwiping.current   = false
  }, [])

  // ─── Mouse drag (desktop simulation) ──────────────────────────────────────
  const mouseStartY = useRef<number | null>(null)
  const mouseMoveY  = useRef(0)
  const mouseDown   = useRef(false)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    mouseStartY.current = e.clientY
    mouseMoveY.current  = 0
    mouseDown.current   = true
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!mouseDown.current || mouseStartY.current === null) return
    mouseMoveY.current = e.clientY - mouseStartY.current
  }, [])

  const onMouseUp = useCallback(() => {
    if (!mouseDown.current) return
    const dy = mouseMoveY.current
    if (dy < -SWIPE_Y_THRESHOLD) setSignOutRevealed(true)
    else if (dy > SWIPE_Y_THRESHOLD) setSignOutRevealed(false)
    mouseStartY.current = null
    mouseDown.current   = false
  }, [])

  // ─── Sign out ─────────────────────────────────────────────────────────────
  const handleSignOut = useCallback(async () => {
    if (isSigningOut) return
    setIsSigningOut(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch { /* continue regardless */ }
    sessionStorage.clear()
    router.push("/auth")
  }, [isSigningOut, router])

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <header className="flex flex-col items-center gap-2 pt-[max(2rem,env(safe-area-inset-top))]">
        <img
          src="/sozucapital_logo_tb.png"
          alt="Sozu Wallet"
          className="h-11 w-11 object-contain opacity-90"
        />
        <p className="text-[10px] font-light uppercase tracking-[0.22em] text-white/45">
          Home
        </p>
      </header>

      <main className="flex flex-1 flex-col items-center justify-end px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        {/* Swipe hint */}
        <p
          className="mb-2 text-center text-[8px] font-light uppercase tracking-[0.2em] text-white/30 transition-opacity duration-300 select-none"
          style={{ opacity: signOutRevealed ? 0 : 1 }}
        >
          ↑ swipe up
        </p>

        {/* Card — all gesture handlers live here */}
        <div
          ref={cardRef}
          className="relative w-full max-w-[17rem] overflow-hidden rounded-[2rem] border border-white/10 bg-black/20 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md select-none"
          style={{ minHeight: "9rem" }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          {/* ── Commands ─────────────────────────────────────────── */}
          <div
            className="p-3 transition-all duration-300"
            style={{
              opacity: signOutRevealed ? 0 : 1,
              transform: signOutRevealed ? "translateY(8px) scale(0.95)" : "translateY(0) scale(1)",
              pointerEvents: signOutRevealed ? "none" : "auto",
            }}
          >
            <div className="mb-2 text-center text-[8px] font-light uppercase tracking-[0.28em] text-white/40">
              Command
            </div>
            <UniversalCommandBar
              bare
              onPayClick={onPayClick}
              onDepositClick={() => setIsDepositOpen(true)}
            />
          </div>

          {/* ── Sign out ─────────────────────────────────────────── */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 transition-all duration-300"
            style={{
              opacity: signOutRevealed ? 1 : 0,
              transform: signOutRevealed ? "translateY(0)" : "translateY(-10px)",
              pointerEvents: signOutRevealed ? "auto" : "none",
            }}
          >
            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="group flex flex-col items-center gap-2"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] transition-colors group-hover:bg-white/[0.12] group-active:scale-95">
                <LogOut className="h-5 w-5 text-white/70 transition-colors group-hover:text-white" />
              </span>
              <span className="text-[9px] font-light uppercase tracking-[0.2em] text-white/50 transition-colors group-hover:text-white/80">
                {isSigningOut ? "Signing out…" : "Sign out"}
              </span>
            </button>

            <button
              onClick={() => setSignOutRevealed(false)}
              className="text-[8px] text-white/25 hover:text-white/50 transition-colors"
            >
              ↓ cancel
            </button>
          </div>
        </div>
      </main>

      <DepositModal isOpen={isDepositOpen} onClose={() => setIsDepositOpen(false)} />
    </div>
  )
}
