/**
 * DeFindex APY Display Component
 * Advanced APY display with multiple time periods and precision control
 */

"use client"

import React, { useState, useEffect } from 'react'
import { TrendingUp, Clock, Settings, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

interface APYData {
  primary: string
  precise: number
  periods: {
    daily: string
    weekly: string
    monthly: string
    yearly: string
  }
  source: 'contract' | 'calculated' | 'external' | 'fallback'
  confidence: 'high' | 'medium' | 'low'
  precision: number
  requestedPeriod: string
}

interface APYDisplayProps {
  strategyAddress: string
  compact?: boolean
  showControls?: boolean
  autoRefresh?: boolean
  refreshInterval?: number
  className?: string
}

export function APYDisplay({
  strategyAddress,
  compact = false,
  showControls = true,
  autoRefresh = true,
  refreshInterval = 30000, // 30 seconds
  className = ""
}: APYDisplayProps) {
  const [apyData, setApyData] = useState<APYData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // Display settings
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('yearly')
  const [precision, setPrecision] = useState<number>(2)
  const [showAllPeriods, setShowAllPeriods] = useState(false)

  const fetchAPY = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        period: selectedPeriod,
        decimals: precision.toString(),
      })

      const response = await fetch(`/api/wallet/defindex/apy?${params}`)
      const data = await response.json()

      if (data.success && data.apy) {
        setApyData(data.apy)
        setLastUpdate(new Date())
      } else {
        throw new Error(data.error || 'Failed to fetch APY data')
      }
    } catch (err) {
      console.error('[APYDisplay] Error fetching APY:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAPY()
  }, [selectedPeriod, precision])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(fetchAPY, refreshInterval)
    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, selectedPeriod, precision])

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'bg-green-100 text-green-800 border-green-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'contract': return 'bg-blue-100 text-blue-800'
      case 'calculated': return 'bg-purple-100 text-purple-800'
      case 'external': return 'bg-green-100 text-green-800'
      case 'fallback': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <TrendingUp className="w-4 h-4 text-green-600" />
        <span className="font-semibold text-green-600">
          {apyData ? `${apyData.primary}%` : loading ? '...' : 'N/A'}
        </span>
        <Badge variant="outline" className={`text-xs ${getSourceColor(apyData?.source || 'fallback')}`}>
          {apyData?.source || 'unknown'}
        </Badge>
        {loading && <RefreshCw className="w-3 h-3 animate-spin" />}
      </div>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <CardTitle className="text-lg">Strategy APY</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {apyData && (
              <Badge variant="outline" className={getConfidenceColor(apyData.confidence)}>
                {apyData.confidence} confidence
              </Badge>
            )}
            {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchAPY}
              disabled={loading}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Main APY Display */}
        <div className="text-center">
          <div className="text-3xl font-bold text-green-600 mb-1">
            {apyData ? `${apyData.primary}%` : loading ? '...' : 'N/A'}
          </div>
          <div className="text-sm text-gray-500 capitalize">
            {selectedPeriod} APY
          </div>
          {lastUpdate && (
            <div className="text-xs text-gray-400 mt-1">
              Updated {lastUpdate.toLocaleTimeString()}
            </div>
          )}
        </div>

        {/* Period Selector */}
        {showControls && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Time Period</Label>
              <Select value={selectedPeriod} onValueChange={(value: any) => setSelectedPeriod(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Precision Control */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Decimal Precision</Label>
                <span className="text-sm text-gray-500">{precision} decimals</span>
              </div>
              <Slider
                value={[precision]}
                onValueChange={(value) => setPrecision(value[0])}
                min={1}
                max={6}
                step={1}
                className="w-full"
              />
            </div>

            {/* Show All Periods Toggle */}
            <div className="flex items-center space-x-2">
              <Switch
                id="show-all-periods"
                checked={showAllPeriods}
                onCheckedChange={setShowAllPeriods}
              />
              <Label htmlFor="show-all-periods" className="text-sm">
                Show all time periods
              </Label>
            </div>
          </div>
        )}

        {/* All Periods Display */}
        {showAllPeriods && apyData && (
          <div className="grid grid-cols-2 gap-3 pt-3 border-t">
            {Object.entries(apyData.periods).map(([period, value]) => (
              <div key={period} className="text-center p-2 bg-gray-50 rounded">
                <div className="text-lg font-semibold text-green-600">{value}%</div>
                <div className="text-xs text-gray-500 capitalize">{period}</div>
              </div>
            ))}
          </div>
        )}

        {/* Source Information */}
        {apyData && (
          <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={getSourceColor(apyData.source)}>
                {apyData.source}
              </Badge>
              <span>Precision: {apyData.precision}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Real-time</span>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="text-center text-red-600 text-sm bg-red-50 p-2 rounded">
            Error: {error}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Compact version for inline display
export function APYBadge({ strategyAddress, className = "" }: { strategyAddress: string, className?: string }) {
  return (
    <APYDisplay
      strategyAddress={strategyAddress}
      compact={true}
      showControls={false}
      autoRefresh={false}
      className={className}
    />
  )
}

// Hook for programmatic APY access
export function useAPY(strategyAddress: string, period: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'yearly', precision: number = 2) {
  const [apyData, setApyData] = useState<APYData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAPY = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        period,
        decimals: precision.toString(),
      })

      const response = await fetch(`/api/wallet/defindex/apy?${params}`)
      const data = await response.json()

      if (data.success && data.apy) {
        setApyData(data.apy)
      } else {
        throw new Error(data.error || 'Failed to fetch APY data')
      }
    } catch (err) {
      console.error('[useAPY] Error:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAPY()
  }, [period, precision])

  return { apyData, loading, error, refetch: fetchAPY }
}
