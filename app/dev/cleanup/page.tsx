"use client"

import { useState } from "react"

export default function CleanupPage() {
  const [status, setStatus] = useState<string>("")
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
  }

  const clearLocalStorage = () => {
    try {
      localStorage.removeItem('sozu_username')
      addLog('✅ Cleared localStorage (sozu_username)')
      setStatus("Local storage cleared")
    } catch (error) {
      addLog(`❌ Error clearing localStorage: ${error}`)
      setStatus("Error clearing local storage")
    }
  }

  const clearSessionStorage = () => {
    try {
      sessionStorage.clear()
      addLog('✅ Cleared sessionStorage')
      setStatus("Session storage cleared")
    } catch (error) {
      addLog(`❌ Error clearing sessionStorage: ${error}`)
      setStatus("Error clearing session storage")
    }
  }

  const clearAllStorage = () => {
    clearLocalStorage()
    clearSessionStorage()
    addLog('✅ All browser storage cleared')
    setStatus("All storage cleared")
  }

  const checkPasskeys = async () => {
    try {
      addLog('🔍 Checking for passkeys in browser...')
      
      const challenge = new Uint8Array(32)
      crypto.getRandomValues(challenge)
      
      try {
        await navigator.credentials.get({
          publicKey: {
            challenge,
            rpId: 'localhost',
            allowCredentials: [],
            userVerification: 'required',
            timeout: 1000
          }
        })
        addLog('⚠️  Passkeys still exist in browser')
        addLog('⚠️  You need to delete them manually via:')
        addLog('   - Chrome: chrome://settings/passkeys')
        addLog('   - macOS Keychain Access: Search for "localhost"')
      } catch (e: any) {
        if (e.name === 'NotAllowedError' || e.name === 'NotFoundError') {
          addLog('✅ No passkeys found in browser')
        } else {
          addLog(`⚠️  Passkey check result: ${e.name} - ${e.message}`)
        }
      }
    } catch (error) {
      addLog(`❌ Error checking passkeys: ${error}`)
    }
  }

  const verifyCleanup = () => {
    addLog('🔍 Verifying cleanup...')
    
    // Check localStorage
    const localStorageKeys = Object.keys(localStorage)
    if (localStorageKeys.length === 0) {
      addLog('✅ localStorage is empty')
    } else {
      addLog(`⚠️  localStorage still has keys: ${localStorageKeys.join(', ')}`)
    }
    
    // Check sessionStorage
    const sessionStorageKeys = Object.keys(sessionStorage)
    if (sessionStorageKeys.length === 0) {
      addLog('✅ sessionStorage is empty')
    } else {
      addLog(`⚠️  sessionStorage still has keys: ${sessionStorageKeys.join(', ')}`)
    }
    
    // Check passkeys
    checkPasskeys()
    
    setStatus("Verification complete - check logs")
  }

  const clearLogs = () => {
    setLogs([])
    setStatus("")
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Passkey Cleanup Utility</h1>
        
        <div className="bg-gray-900 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Browser Storage Cleanup</h2>
          <div className="space-y-2">
            <button
              onClick={clearLocalStorage}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
            >
              Clear Local Storage
            </button>
            <button
              onClick={clearSessionStorage}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded ml-2"
            >
              Clear Session Storage
            </button>
            <button
              onClick={clearAllStorage}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded ml-2"
            >
              Clear All Storage
            </button>
          </div>
        </div>

        <div className="bg-gray-900 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Verification</h2>
          <button
            onClick={verifyCleanup}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded"
          >
            Verify Cleanup
          </button>
          <button
            onClick={checkPasskeys}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded ml-2"
          >
            Check Passkeys
          </button>
        </div>

        {status && (
          <div className="bg-blue-900 rounded-lg p-4 mb-6">
            <p className="font-semibold">{status}</p>
          </div>
        )}

        <div className="bg-gray-900 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Logs</h2>
            <button
              onClick={clearLogs}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
            >
              Clear Logs
            </button>
          </div>
          <div className="bg-black rounded p-4 font-mono text-sm max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-gray-500">No logs yet. Click buttons above to start.</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="mb-1">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-yellow-900 rounded-lg p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">⚠️ Important Notes</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>Browser passkeys must be deleted manually via browser settings or Keychain Access</li>
            <li>Database passkeys must be deleted via Supabase SQL Editor</li>
            <li>After cleanup, you'll need to register a new passkey</li>
            <li>See <code className="bg-gray-800 px-2 py-1 rounded">docs/PASSKEY_RESET_GUIDE.md</code> for complete instructions</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

