"use client"

import { useState, useEffect } from "react"

interface StorageAnalysis {
  localStorage: {
    totalSize: number
    keys: Array<{
      key: string
      size: number
      value: string
      truncated?: boolean
    }>
  }
  sessionStorage: {
    totalSize: number
    keys: Array<{
      key: string
      size: number
      value: string
      truncated?: boolean
    }>
  }
  indexedDB: {
    available: boolean
    databases?: Array<{
      name: string
      version: number
    }>
    error?: string
  }
}

export default function PublicMemoryAnalysisPage() {
  const [analysis, setAnalysis] = useState<StorageAnalysis | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const analyzeStorage = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result: StorageAnalysis = {
        localStorage: {
          totalSize: 0,
          keys: []
        },
        sessionStorage: {
          totalSize: 0,
          keys: []
        },
        indexedDB: {
          available: false
        }
      }

      // Analyze localStorage
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key) {
            const value = localStorage.getItem(key) || ""
            const size = new Blob([key + value]).size
            result.localStorage.totalSize += size
            result.localStorage.keys.push({
              key,
              size,
              value: value.length > 200 ? value.substring(0, 200) + "..." : value,
              truncated: value.length > 200
            })
          }
        }
      } catch (e) {
        console.error("Error analyzing localStorage:", e)
      }

      // Analyze sessionStorage
      try {
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i)
          if (key) {
            const value = sessionStorage.getItem(key) || ""
            const size = new Blob([key + value]).size
            result.sessionStorage.totalSize += size
            result.sessionStorage.keys.push({
              key,
              size,
              value: value.length > 200 ? value.substring(0, 200) + "..." : value,
              truncated: value.length > 200
            })
          }
        }
      } catch (e) {
        console.error("Error analyzing sessionStorage:", e)
      }

      // Analyze IndexedDB
      try {
        if (typeof indexedDB !== "undefined") {
          result.indexedDB.available = true
          const databases = await indexedDB.databases()
          result.indexedDB.databases = databases.map(db => ({
            name: db.name || "unknown",
            version: db.version || 0
          }))
        }
      } catch (e) {
        result.indexedDB.available = false
        result.indexedDB.error = e instanceof Error ? e.message : "Unknown error"
      }

      setAnalysis(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const clearProblematicStorage = () => {
    try {
      // Clear localStorage (except essential keys)
      const essentialKeys = ['sozu_username']
      const keysToRemove = []
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && !essentialKeys.includes(key)) {
          keysToRemove.push(key)
        }
      }
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key)
      })
      
      // Clear all sessionStorage
      sessionStorage.clear()
      
      alert("Storage cleared! Refresh to see updated analysis.")
      analyzeStorage()
    } catch (e) {
      alert("Error clearing storage: " + e)
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  useEffect(() => {
    analyzeStorage()
  }, [])

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Public Memory Analysis</h1>
        <p className="text-gray-400 mb-8">No authentication required - analyze your browser storage directly</p>
        
        <div className="mb-6">
          <button
            onClick={analyzeStorage}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50 mr-4"
          >
            {isLoading ? "Analyzing..." : "Refresh Analysis"}
          </button>
          <button
            onClick={clearProblematicStorage}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
          >
            Clear Problematic Storage
          </button>
        </div>

        {error && (
          <div className="bg-red-900 rounded-lg p-4 mb-6">
            <p className="font-semibold">Error: {error}</p>
          </div>
        )}

        {analysis && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-gray-900 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Summary</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-2xl font-bold text-blue-400">
                    {formatBytes(analysis.localStorage.totalSize)}
                  </div>
                  <div className="text-sm text-gray-400">localStorage</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-400">
                    {formatBytes(analysis.sessionStorage.totalSize)}
                  </div>
                  <div className="text-sm text-gray-400">sessionStorage</div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-700">
                <div className="text-2xl font-bold text-white">
                  {formatBytes(analysis.localStorage.totalSize + analysis.sessionStorage.totalSize)}
                </div>
                <div className="text-sm text-gray-400">Total Browser Storage</div>
                {(analysis.localStorage.totalSize + analysis.sessionStorage.totalSize) > 1024 * 1024 && (
                  <div className="mt-2 text-yellow-400 text-sm">
                    ⚠️ High storage usage detected!
                  </div>
                )}
              </div>
            </div>

            {/* localStorage Analysis */}
            <div className="bg-gray-900 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">
                localStorage ({formatBytes(analysis.localStorage.totalSize)})
              </h2>
              {analysis.localStorage.keys.length === 0 ? (
                <p className="text-gray-500">localStorage is empty</p>
              ) : (
                <div className="space-y-2">
                  {analysis.localStorage.keys.map((item, index) => (
                    <div key={index} className="bg-black rounded p-3">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-mono text-sm text-blue-400">{item.key}</span>
                        <span className="text-xs text-gray-400">{formatBytes(item.size)}</span>
                      </div>
                      <div className="text-xs text-gray-300 font-mono break-all">
                        {item.value}
                        {item.truncated && <span className="text-yellow-400 ml-2">(truncated)</span>}
                      </div>
                      {item.size > 1024 && (
                        <div className="mt-1 text-xs text-red-400">⚠️ Large item detected</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* sessionStorage Analysis */}
            <div className="bg-gray-900 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">
                sessionStorage ({formatBytes(analysis.sessionStorage.totalSize)})
              </h2>
              {analysis.sessionStorage.keys.length === 0 ? (
                <p className="text-gray-500">sessionStorage is empty</p>
              ) : (
                <div className="space-y-2">
                  {analysis.sessionStorage.keys.map((item, index) => (
                    <div key={index} className="bg-black rounded p-3">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-mono text-sm text-green-400">{item.key}</span>
                        <span className="text-xs text-gray-400">{formatBytes(item.size)}</span>
                      </div>
                      <div className="text-xs text-gray-300 font-mono break-all">
                        {item.value}
                        {item.truncated && <span className="text-yellow-400 ml-2">(truncated)</span>}
                      </div>
                      {item.size > 1024 && (
                        <div className="mt-1 text-xs text-red-400">⚠️ Large item detected</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* IndexedDB Analysis */}
            <div className="bg-gray-900 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">IndexedDB</h2>
              {!analysis.indexedDB.available ? (
                <p className="text-red-400">
                  IndexedDB not available: {analysis.indexedDB.error || "Unknown reason"}
                </p>
              ) : (
                <div className="space-y-2">
                  {analysis.indexedDB.databases?.map((db, index) => (
                    <div key={index} className="bg-black rounded p-3">
                      <div className="font-mono text-sm text-purple-400">{db.name}</div>
                      <div className="text-xs text-gray-400">Version: {db.version}</div>
                    </div>
                  )) || <p className="text-gray-500">No databases found</p>}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
