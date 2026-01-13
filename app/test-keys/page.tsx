"use client"

import { useEffect, useState } from "react"

export default function TestKeysPage() {
  const [results, setResults] = useState<{
    credentialId: string | null
    publicKey: string | null
    userId: string | null
    authenticated: string | null
    indexedDBKeys: number
    keyDerivation: { success: boolean; publicKey?: string; error?: string }
    keyRetrieval: { success: boolean; publicKey?: string; error?: string }
    transactionSigning: { success: boolean; error?: string }
  } | null>(null)

  useEffect(() => {
    const runTests = async () => {
      const testResults = {
        credentialId: sessionStorage.getItem("credential_id"),
        publicKey: sessionStorage.getItem("stellar_public_key"),
        userId: sessionStorage.getItem("dev_username"),
        authenticated: sessionStorage.getItem("dev_authenticated"),
        indexedDBKeys: 0,
        keyDerivation: { success: false } as any,
        keyRetrieval: { success: false } as any,
        transactionSigning: { success: false } as any,
      }

      // Test IndexedDB
      try {
        const { getAllStoredPublicKeys } = await import("@/lib/storage/browser-keys")
        const keys = await getAllStoredPublicKeys()
        testResults.indexedDBKeys = keys.length
      } catch (error) {
        console.error("IndexedDB test failed:", error)
      }

      // Test Key Derivation
      if (testResults.credentialId && testResults.userId) {
        try {
          const { deriveStellarKeypair } = await import("@/lib/webauthn/key-derivation")
          const keypair = await deriveStellarKeypair(testResults.credentialId, testResults.userId)
          testResults.keyDerivation = {
            success: true,
            publicKey: keypair.publicKey(),
          }
        } catch (error) {
          testResults.keyDerivation = {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }
        }
      }

      // Test Key Retrieval
      if (testResults.credentialId) {
        try {
          const { retrieveKeypair } = await import("@/lib/storage/browser-keys")
          const keypair = await retrieveKeypair(testResults.credentialId)
          if (keypair) {
            testResults.keyRetrieval = {
              success: true,
              publicKey: keypair.publicKey(),
            }
          } else {
            testResults.keyRetrieval = {
              success: false,
              error: "Keypair not found",
            }
          }
        } catch (error) {
          testResults.keyRetrieval = {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }
        }
      }

      // Test Transaction Signing
      if (testResults.credentialId && testResults.publicKey && testResults.userId) {
        try {
          const { TransactionBuilder, Networks, BASE_FEE, Operation, Account } = await import(
            "@stellar/stellar-sdk"
          )
          const { signTransactionClientSide } = await import("@/lib/stellar/client-signing")

          const account = new Account(testResults.publicKey, "0")
          const transaction = new TransactionBuilder(account, {
            fee: BASE_FEE,
            networkPassphrase: Networks.TESTNET,
          })
            .addOperation(Operation.accountMerge({ destination: testResults.publicKey }))
            .setTimeout(30)
            .build()

          // signTransactionClientSide takes (transaction, credentialId, publicKey, userId)
          // publicKey is optional - it will extract from transaction if not provided
          // userId is optional but recommended for key verification
          const signed = await signTransactionClientSide(
            transaction,
            testResults.credentialId,
            testResults.publicKey,
            testResults.userId
          )
          testResults.transactionSigning = {
            success: true,
          }
        } catch (error) {
          testResults.transactionSigning = {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }
        }
      } else {
        testResults.transactionSigning = {
          success: false,
          error: `Missing prerequisites: credentialId=${!!testResults.credentialId}, publicKey=${!!testResults.publicKey}, userId=${!!testResults.userId}`,
        }
      }

      setResults(testResults)
    }

    runTests()
  }, [])

  if (!results) {
    return (
      <div className="min-h-screen bg-black text-white p-8">
        <h1 className="text-2xl font-bold mb-4">Testing Phase 1 & Phase 2...</h1>
        <p>Running tests...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-3xl font-bold mb-6">Phase 1 & Phase 2 Test Results</h1>

      <div className="space-y-6">
        {/* SessionStorage Tests */}
        <div className="bg-gray-900 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">1. SessionStorage</h2>
          <div className="space-y-2">
            <div>
              <span className="font-mono text-sm">credential_id:</span>{" "}
              {results.credentialId ? (
                <span className="text-green-400">
                  ✅ {results.credentialId.substring(0, 20)}...
                </span>
              ) : (
                <span className="text-red-400">❌ Missing</span>
              )}
            </div>
            <div>
              <span className="font-mono text-sm">stellar_public_key:</span>{" "}
              {results.publicKey ? (
                <span className="text-green-400">
                  ✅ {results.publicKey.substring(0, 10)}...
                </span>
              ) : (
                <span className="text-red-400">❌ Missing</span>
              )}
            </div>
            <div>
              <span className="font-mono text-sm">dev_username:</span>{" "}
              {results.userId ? (
                <span className="text-green-400">✅ {results.userId}</span>
              ) : (
                <span className="text-red-400">❌ Missing</span>
              )}
            </div>
            <div>
              <span className="font-mono text-sm">dev_authenticated:</span>{" "}
              {results.authenticated === "true" ? (
                <span className="text-green-400">✅ Yes</span>
              ) : (
                <span className="text-red-400">❌ No</span>
              )}
            </div>
          </div>
        </div>

        {/* IndexedDB Tests */}
        <div className="bg-gray-900 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">2. IndexedDB</h2>
          <div>
            <span className="font-mono text-sm">Stored keys:</span>{" "}
            {results.indexedDBKeys > 0 ? (
              <span className="text-green-400">✅ {results.indexedDBKeys}</span>
            ) : (
              <span className="text-red-400">❌ None</span>
            )}
          </div>
        </div>

        {/* Key Derivation Tests */}
        <div className="bg-gray-900 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">3. Key Derivation (Phase 1)</h2>
          {results.keyDerivation.success ? (
            <div>
              <span className="text-green-400">✅ Success</span>
              <div className="mt-2 text-sm">
                <span className="font-mono">Public Key:</span>{" "}
                {results.keyDerivation.publicKey?.substring(0, 10)}...
                {results.publicKey &&
                results.keyDerivation.publicKey === results.publicKey ? (
                  <span className="text-green-400 ml-2">(Matches stored)</span>
                ) : (
                  <span className="text-yellow-400 ml-2">(Does not match stored)</span>
                )}
              </div>
            </div>
          ) : (
            <div>
              <span className="text-red-400">❌ Failed</span>
              {results.keyDerivation.error && (
                <div className="mt-2 text-sm text-red-400">
                  Error: {results.keyDerivation.error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Key Retrieval Tests */}
        <div className="bg-gray-900 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">4. Key Retrieval (Phase 1)</h2>
          {results.keyRetrieval.success ? (
            <div>
              <span className="text-green-400">✅ Success</span>
              <div className="mt-2 text-sm">
                <span className="font-mono">Public Key:</span>{" "}
                {results.keyRetrieval.publicKey?.substring(0, 10)}...
              </div>
            </div>
          ) : (
            <div>
              <span className="text-red-400">❌ Failed</span>
              {results.keyRetrieval.error && (
                <div className="mt-2 text-sm text-red-400">
                  Error: {results.keyRetrieval.error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Transaction Signing Tests */}
        <div className="bg-gray-900 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">5. Transaction Signing (Phase 2)</h2>
          {results.transactionSigning.success ? (
            <div>
              <span className="text-green-400">✅ Success</span>
              <div className="mt-2 text-sm">Transaction signed client-side successfully!</div>
            </div>
          ) : (
            <div>
              <span className="text-red-400">❌ Failed</span>
              {results.transactionSigning.error && (
                <div className="mt-2 text-sm text-red-400">
                  Error: {results.transactionSigning.error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="bg-gray-900 p-6 rounded-lg border-2 border-gray-700">
          <h2 className="text-xl font-semibold mb-4">Summary</h2>
          <div className="space-y-2">
            <div>
              Phase 1 (Key Derivation):{" "}
              {results.credentialId &&
              results.publicKey &&
              results.indexedDBKeys > 0 &&
              results.keyDerivation.success &&
              results.keyRetrieval.success ? (
                <span className="text-green-400">✅ PASS</span>
              ) : (
                <span className="text-red-400">❌ FAIL</span>
              )}
            </div>
            <div>
              Phase 2 (Client-Side Signing):{" "}
              {results.transactionSigning.success ? (
                <span className="text-green-400">✅ PASS</span>
              ) : (
                <span className="text-red-400">❌ FAIL</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <button
          onClick={() => window.location.reload()}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
        >
          Refresh Tests
        </button>
      </div>
    </div>
  )
}
