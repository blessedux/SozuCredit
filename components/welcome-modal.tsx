/**
 * Welcome Modal Component
 * 
 * Shows a welcome message to first-time visitors before authentication
 */

"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Shield, TrendingUp, Key } from "lucide-react"
import Image from "next/image"

const WELCOME_MODAL_KEY = "sozu_welcome_seen"

export function WelcomeModal() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    // Check if user has seen the welcome modal before
    if (typeof window !== "undefined") {
      const hasSeenWelcome = localStorage.getItem(WELCOME_MODAL_KEY) === "true"
      if (!hasSeenWelcome) {
        // Show modal after a brief delay for better UX
        setTimeout(() => {
          setIsOpen(true)
        }, 500)
      }
    }
  }, [])

  const handleClose = () => {
    setIsOpen(false)
    // Mark as seen so it doesn't show again
    if (typeof window !== "undefined") {
      localStorage.setItem(WELCOME_MODAL_KEY, "true")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent 
        className="bg-black/95 border-white/20 text-white max-w-md"
        showCloseButton={false}
        onInteractOutside={(e) => {
          // Prevent closing by clicking outside on first visit
          e.preventDefault()
        }}
        onEscapeKeyDown={(e) => {
          // Allow closing with Escape key
          handleClose()
        }}
      >
        <DialogHeader className="space-y-6">
          {/* Logo - Centered */}
          <div className="flex justify-center">
            <Image
              src="/sozucapital_logo_tb.png"
              alt="Sozu Logo"
              width={120}
              height={120}
              className="object-contain"
            />
          </div>
          
          {/* Title - Sozu Wallet */}
          <DialogTitle className="text-3xl font-bold text-center text-white">
            Sozu Wallet
          </DialogTitle>
          
          {/* Version */}
          <div className="text-center">
            <p className="text-xs text-white/50">
              v 0.0.1
            </p>
          </div>
          
          <DialogDescription className="text-white/80 text-center space-y-4 pt-4">
            <p className="text-base leading-relaxed">
              Own and custody USD on the internet.
            </p>
            
            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3">
                <TrendingUp className="w-5 h-5 text-white/60 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-white/70">
                  Use internet money to earn up to <span className="font-semibold text-white">15% APY</span> by default.
                </p>
              </div>
              
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-white/60 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-white/70">
                  Your cash sits in your personal vault, <span className="font-semibold text-white">only you have the keys</span>.
                </p>
              </div>
              
              <div className="flex items-start gap-3">
                <Key className="w-5 h-5 text-white/60 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-white/70">
                  Make sure you <span className="font-semibold text-white">save your passkey</span> when prompted after creating a new disposable wallet, or on settings.
                </p>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex justify-center pt-4">
          <Button
            onClick={handleClose}
            className="bg-white text-black hover:bg-white/90 font-semibold px-8 py-2"
          >
            Get Started
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
