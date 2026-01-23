"use client"

import { useState } from "react"
import { Shield, TrendingUp, AlertTriangle, Lock, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function DeFiInfoPage() {
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-6 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Link href="/wallet">
            <Button variant="ghost" className="mb-4 text-white/70 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a Sozu Wallet
            </Button>
          </Link>
          <h1 className="text-3xl font-bold mb-4">DeFi en Stellar: Tu Dinero, Tus Reglas</h1>
          <p className="text-white/70 text-lg">
            Entiende cómo funciona la finanzas descentralizadas en Stellar y por qué tienes control total sobre tu dinero.
          </p>
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          {/* What is DeFi on Stellar */}
          <div className="border border-white/20 rounded-lg p-6">
            <button
              onClick={() => toggleSection('what-is-defi')}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <TrendingUp className="w-6 h-6 text-green-400" />
                <h2 className="text-xl font-semibold">¿Qué es DeFi en Stellar?</h2>
              </div>
              <span className="text-white/50">{expandedSection === 'what-is-defi' ? '−' : '+'}</span>
            </button>
            {expandedSection === 'what-is-defi' && (
              <div className="mt-4 space-y-3 text-white/70">
                <p>
                  DeFi (Finanzas Descentralizadas) en Stellar es un sistema financiero que opera sin intermediarios tradicionales como bancos. 
                  En su lugar, utiliza tecnología blockchain y contratos inteligentes para facilitar transacciones financieras directamente entre usuarios.
                </p>
                <p>
                  Stellar es una red blockchain diseñada específicamente para pagos rápidos y de bajo costo. En Sozu, utilizamos protocolos 
                  como defindex y blend protocol para ofrecerte rendimientos de hasta 15% APY.
                </p>
                <div className="bg-white/5 rounded p-4 mt-4">
                  <h3 className="font-semibold text-white mb-2">Ventajas de DeFi en Stellar:</h3>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Transacciones rápidas (3-5 segundos)</li>
                    <li>Comisiones extremadamente bajas</li>
                    <li>Acceso global sin fronteras</li>
                    <li>Transparencia total en la blockchain</li>
                    <li>Control total sobre tus fondos</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* How Your Money Stays Safe */}
          <div className="border border-white/20 rounded-lg p-6">
            <button
              onClick={() => toggleSection('safety')}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <Shield className="w-6 h-6 text-blue-400" />
                <h2 className="text-xl font-semibold">¿Cómo se Mantiene Tu Dinero Seguro?</h2>
              </div>
              <span className="text-white/50">{expandedSection === 'safety' ? '−' : '+'}</span>
            </button>
            {expandedSection === 'safety' && (
              <div className="mt-4 space-y-3 text-white/70">
                <p>
                  Tu seguridad en DeFi se basa en varios principios fundamentales:
                </p>
                <div className="space-y-4">
                  <div className="bg-white/5 rounded p-4">
                    <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      Custodia Propia
                    </h3>
                    <p>
                      Solo tú tienes acceso a tu billetera. Tus claves privadas nunca son almacenadas en nuestros servidores. 
                      Esto significa que nadie, ni siquiera Sozu, puede acceder a tus fondos sin tu permiso.
                    </p>
                  </div>
                  <div className="bg-white/5 rounded p-4">
                    <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Protocolos Auditados
                    </h3>
                    <p>
                      defindex y blend protocol son protocolos DeFi establecidos y auditados que han demostrado su seguridad 
                      y fiabilidad en la red Stellar. Tus fondos están protegidos por código verificado y matemáticas criptográficas.
                    </p>
                  </div>
                  <div className="bg-white/5 rounded p-4">
                    <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Transparencia Total
                    </h3>
                    <p>
                      Todas las transacciones están registradas en la blockchain de Stellar, lo que significa que puedes verificar 
                      cada movimiento de fondos en cualquier momento. No hay transacciones ocultas ni manipulación posible.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Risks and Responsibilities */}
          <div className="border border-white/20 rounded-lg p-6">
            <button
              onClick={() => toggleSection('risks')}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-yellow-400" />
                <h2 className="text-xl font-semibold">Riesgos y Tu Responsabilidad</h2>
              </div>
              <span className="text-white/50">{expandedSection === 'risks' ? '−' : '+'}</span>
            </button>
            {expandedSection === 'risks' && (
              <div className="mt-4 space-y-3 text-white/70">
                <p className="font-semibold text-white">
                  Con la gran libertad de DeFi viene una gran responsabilidad:
                </p>
                <div className="space-y-3">
                  <div className="bg-yellow-900/20 border border-yellow-400/30 rounded p-4">
                    <h3 className="font-semibold text-yellow-400 mb-2">⚠️ Pérdida de Claves = Pérdida de Fondos</h3>
                    <p>
                      Si pierdes tu passkey o clave secreta, nadie podrá recuperar tus fondos. No hay "olvidé mi contraseña" en DeFi. 
                      Guarda tus claves de forma segura y haz copias de respaldo.
                    </p>
                  </div>
                  <div className="bg-white/5 rounded p-4">
                    <h3 className="font-semibold text-white mb-2">Volatilidad del Mercado</h3>
                    <p>
                      Los rendimientos de DeFi pueden variar según las condiciones del mercado. El 15% APY es un rendimiento histórico 
                      que puede fluctuar. Entiende los riesgos antes de invertir.
                    </p>
                  </div>
                  <div className="bg-white/5 rounded p-4">
                    <h3 className="font-semibold text-white mb-2">Riesgo Tecnológico</h3>
                    <p>
                      Aunque los protocolos son auditados, siempre existe un riesgo mínimo de bugs o vulnerabilidades. 
                      Investiga y entiende dónde estás poniendo tu dinero.
                    </p>
                  </div>
                </div>
                <div className="mt-4 p-4 bg-blue-900/20 border border-blue-400/30 rounded">
                  <h3 className="font-semibold text-blue-400 mb-2">🔒 Tú Eres el Banco</h3>
                  <p>
                    En DeFi, tú eres tu propio banco. Esto significa control total, pero también responsabilidad total. 
                    Educa continuamente, mantente seguro y toma decisiones informadas.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Your Freedom */}
          <div className="border border-white/20 rounded-lg p-6">
            <button
              onClick={() => toggleSection('freedom')}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <Shield className="w-6 h-6 text-purple-400" />
                <h2 className="text-xl font-semibold">Tu Libertad Financiera</h2>
              </div>
              <span className="text-white/50">{expandedSection === 'freedom' ? '−' : '+'}</span>
            </button>
            {expandedSection === 'freedom' && (
              <div className="mt-4 space-y-3 text-white/70">
                <p>
                  DeFi te ofrece una libertad financiera sin precedentes:
                </p>
                <ul className="list-disc list-inside space-y-2">
                  <li><strong>Acceso sin permisos:</strong> No necesitas aprobación de nadie para usar tus fondos</li>
                  <li><strong>Disponibilidad 24/7:</strong> Tu dinero trabaja para ti todo el tiempo, sin horarios bancarios</li>
                  <li><strong>Control total:</strong> Tú decides qué hacer con tu dinero en cada momento</li>
                  <li><strong>Transparencia:</strong> Todas las reglas están en código abierto, verificables por cualquiera</li>
                  <li><strong>Inclusión:</strong> Sin importar dónde estés, tienes acceso a servicios financieros mundiales</li>
                </ul>
                <div className="mt-4 p-4 bg-purple-900/20 border border-purple-400/30 rounded">
                  <h3 className="font-semibold text-purple-400 mb-2">🚀 El Futuro de las Finanzas</h3>
                  <p>
                    Estás participando en la revolución financiera más grande de nuestra generación. 
                    Con DeFi, el poder vuelve a las personas, donde siempre debió estar.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-8 p-6 bg-red-900/20 border border-red-400/30 rounded-lg">
          <h2 className="text-xl font-semibold text-red-400 mb-3">Descargo de Responsabilidad</h2>
          <div className="space-y-2 text-white/70">
            <p>
              <strong>Sozu Credit no es un banco ni una institución financiera regulada.</strong> Somos una plataforma tecnológica 
              que te da acceso a protocolos DeFi.
            </p>
            <p>
              <strong>No somos responsables de las pérdidas</strong> que puedan ocurrir por el uso de estos protocolos, 
              errores del usuario, vulnerabilidades tecnológicas, o fluctuaciones del mercado.
            </p>
            <p>
              <strong>Tú eres el único responsable</strong> de la seguridad de tus claves, tus decisiones de inversión, 
              y la comprensión de los riesgos involucrados.
            </p>
            <p className="font-semibold text-white">
              Al usar Sozu Wallet, aceptas que entiendes estos riesgos y asumes toda la responsabilidad por tus acciones y decisiones financieras.
            </p>
          </div>
        </div>

        {/* Call to Action */}
        <div className="mt-8 text-center">
          <Link href="/wallet">
            <Button className="bg-white text-black hover:bg-white/90 font-semibold px-8 py-3">
              Entendido - Volver a Sozu Wallet
            </Button>
          </Link>
          <p className="mt-4 text-white/50 text-sm">
            Tu libertad, tu responsabilidad, tu futuro financiero.
          </p>
        </div>
      </div>
    </div>
  )
}
