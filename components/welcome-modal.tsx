/**
 * Welcome Modal Component
 * 
 * Shows a welcome message to first-time visitors before authentication
 */

"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Shield, TrendingUp, Key, ArrowLeft, AlertTriangle, Lock, Sparkles, Zap, ShieldCheck, Fingerprint, TrendingUp as GrowthIcon } from "lucide-react"
import Image from "next/image"

const WELCOME_MODAL_KEY = "sozu_welcome_seen"

export function WelcomeModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [showDeFiInfo, setShowDeFiInfo] = useState(false)

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
          {showDeFiInfo ? (
            // DeFi Info View
            <div className="space-y-4">
              {/* Back Button */}
              <button
                onClick={() => setShowDeFiInfo(false)}
                className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver
              </button>
              
              {/* Title */}
              <DialogTitle className="text-2xl font-bold text-center text-white">
                DeFi en Stellar: Tu Dinero, Tus Reglas
              </DialogTitle>
              
              {/* Content */}
              <DialogDescription className="text-white/80 text-left space-y-4 max-h-96 overflow-y-auto">
                <div className="space-y-4">
                  {/* What is DeFi */}
                  <div className="border border-white/20 rounded-lg p-4">
                    <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-400" />
                      ¿Qué es DeFi en Stellar?
                    </h3>
                    <p className="text-sm text-white/70">
                      DeFi (Finanzas Descentralizadas) en Stellar es un sistema financiero que opera sin intermediarios tradicionales como bancos. 
                      En su lugar, utiliza tecnología blockchain para facilitar transacciones directamente entre usuarios.
                    </p>
                    <p className="text-sm text-white/70 mt-2">
                      Stellar es una red blockchain diseñada para pagos rápidos y de bajo costo. En Sozu, utilizamos protocolos 
                      como defindex y blend protocol para ofrecerte rendimientos de hasta 15% APY.
                    </p>
                  </div>

                  {/* How Your Money Stays Safe */}
                  <div className="border border-white/20 rounded-lg p-4">
                    <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-400" />
                      ¿Cómo se Mantiene Tu Dinero Seguro?
                    </h3>
                    <div className="space-y-3 text-sm text-white/70">
                      <div className="flex items-start gap-2">
                        <Lock className="w-3 h-3 mt-1 flex-shrink-0" />
                        <div>
                          <strong>Custodia Propia:</strong> Solo tú tienes acceso a tu billetera. 
                          Tus claves privadas nunca son almacenadas en nuestros servidores.
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Shield className="w-3 h-3 mt-1 flex-shrink-0" />
                        <div>
                          <strong>Protocolos Auditados:</strong> defindex y blend protocol son protocolos 
                          establecidos y auditados que han demostrado su seguridad en la red Stellar.
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <TrendingUp className="w-3 h-3 mt-1 flex-shrink-0" />
                        <div>
                          <strong>Transparencia Total:</strong> Todas las transacciones están registradas 
                          en la blockchain de Stellar, verificables en cualquier momento.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Risks and Responsibilities */}
                  <div className="border border-white/20 rounded-lg p-4">
                    <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-400" />
                      Riesgos y Tu Responsabilidad
                    </h3>
                    <div className="space-y-3 text-sm text-white/70">
                      <div className="bg-yellow-900/20 border border-yellow-400/30 rounded p-3">
                        <p className="font-semibold text-yellow-400">⚠️ Pérdida de Claves = Pérdida de Fondos</p>
                        <p className="text-xs mt-1">
                          Si pierdes tu passkey o clave secreta, nadie podrá recuperar tus fondos. 
                          No hay "olvidé mi contraseña" en DeFi.
                        </p>
                      </div>
                      <div className="bg-white/5 rounded p-3">
                        <p className="font-semibold text-white">Volatilidad del Mercado</p>
                        <p className="text-xs mt-1">
                          Los rendimientos de DeFi pueden variar según las condiciones del mercado. 
                          El 15% APY es un rendimiento histórico que puede fluctuar.
                        </p>
                      </div>
                      <div className="bg-blue-900/20 border border-blue-400/30 rounded p-3">
                        <p className="font-semibold text-blue-400">🔒 Tú Eres el Banco</p>
                        <p className="text-xs mt-1">
                          En DeFi, tú eres tu propio banco. Esto significa control total, 
                          pero también responsabilidad total.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Disclaimer */}
                  <div className="bg-red-900/20 border border-red-400/30 rounded-lg p-4">
                    <h3 className="font-semibold text-red-400 mb-2">Descargo de Responsabilidad</h3>
                    <div className="space-y-2 text-xs text-white/70">
                      <p>
                        <strong>Sozu Credit no es un banco ni una institución financiera regulada.</strong> 
                        Somos una plataforma tecnológica que te da acceso a protocolos DeFi.
                      </p>
                      <p>
                        <strong>No somos responsables de las pérdidas</strong> que puedan ocurrir por el uso 
                        de estos protocolos, errores del usuario, o fluctuaciones del mercado.
                      </p>
                      <p className="font-semibold text-white">
                        Al usar Sozu Wallet, aceptas que entiendes estos riesgos y asumes toda la responsabilidad.
                      </p>
                    </div>
                  </div>
                </div>
              </DialogDescription>
            </div>
          ) : (
            // Welcome View
            <>
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
                  Posee y custodia USD en internet.
                </p>
                
                <div className="space-y-3 pt-2">
                  <div className="flex items-start gap-3">
                    <GrowthIcon className="w-5 h-5 text-white/60 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-white/70">
                      Usa dinero digital para ganar hasta <span className="font-semibold text-white">15% APY</span>.
                    </p>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 text-white/60 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-white/70">
                      Tu dinero está en tu bóveda personal, <span className="font-semibold text-white">solo tú tienes las llaves</span>.
                    </p>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <Fingerprint className="w-5 h-5 text-white/60 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-white/70">
                      Asegúrate de <span className="font-semibold text-white">guardar tu passkey</span> cuando se te solicite después de crear una nueva billetera desechable, o en configuración.
                    </p>
                  </div>
                </div>
                
                {/* DeFi Info Section */}
                <div className="pt-4 border-t border-white/20">
                  <div className="text-center">
                    <button
                      onClick={() => setShowDeFiInfo(true)}
                      className="text-xs text-blue-400 hover:text-blue-300 underline transition-colors"
                    >
                      ¿Cómo funciona DeFi en Stellar y por qué tu dinero está seguro?
                    </button>
                    <p className="text-xs text-white/50 mt-2">
                      Tú eres responsable de tus decisiones y tu libertad financiera.
                    </p>
                  </div>
                </div>
              </DialogDescription>
            </>
          )}
        </DialogHeader>
        
        <div className="flex justify-center pt-4">
          <Button
            onClick={handleClose}
            className="bg-white text-black hover:bg-white/90 font-semibold px-8 py-2"
          >
            Comenzar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
