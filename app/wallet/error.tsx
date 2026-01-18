'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, RefreshCw, Wallet } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function WalletError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error('Wallet error boundary caught:', error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black p-4">
      <Card className="w-full max-w-md border-gray-800 bg-gray-900 text-white">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
            <Wallet className="h-6 w-6 text-red-500" />
          </div>
          <CardTitle className="text-2xl">Wallet Error</CardTitle>
          <CardDescription className="text-gray-400">
            Unable to load wallet. Please try again.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error.message && (
            <div className="rounded-lg bg-gray-800 p-3">
              <p className="text-sm font-medium text-gray-400">Error details:</p>
              <p className="mt-1 text-sm text-white">{error.message}</p>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Button onClick={reset} className="w-full bg-white text-black hover:bg-gray-200">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
            <Button 
              variant="outline" 
              onClick={() => router.push('/dashboard')} 
              className="w-full border-gray-700 text-white hover:bg-gray-800"
            >
              <Wallet className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
