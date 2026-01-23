/**
 * Error boundary for wallet components
 * Catches errors in wallet components and displays a fallback UI
 */

"use client"

import { Component, ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { getWalletTexts } from "@/lib/wallet-texts"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class WalletErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[Wallet Error Boundary] Caught error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      const t = getWalletTexts("es")

      return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
          <div className="text-center space-y-4 max-w-md">
            <h2 className="text-2xl font-bold text-red-400">{t.somethingWentWrong}</h2>
            <p className="text-white/60">
              {this.state.error?.message || t.unexpectedError}
            </p>
            <Button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.reload()
              }}
              className="bg-white text-black hover:bg-white/90"
            >
              {t.reloadPage}
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
