/**
 * IndexedDB Wrapper
 * 
 * Provides a simple interface for storing and retrieving data from IndexedDB.
 * Used for persistent storage of encrypted keys and wallet data.
 */

const DB_NAME = "sozu-wallet-db"
/** v2: `publicKey` index is non-unique so two passkeys can share one Stellar address. */
const DB_VERSION = 2

// Store names
export const STORES = {
  KEYS: "encrypted-keys",
  WALLETS: "wallets",
  METADATA: "metadata",
} as const

/**
 * Initialize IndexedDB database
 */
export async function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      reject(new Error(`Failed to open database: ${request.error}`))
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      const oldVersion = event.oldVersion

      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains(STORES.KEYS)) {
          const keysStore = db.createObjectStore(STORES.KEYS, {
            keyPath: "credentialId",
          })
          keysStore.createIndex("userId", "userId", { unique: false })
          keysStore.createIndex("publicKey", "publicKey", { unique: false })
        }

        if (!db.objectStoreNames.contains(STORES.WALLETS)) {
          const walletsStore = db.createObjectStore(STORES.WALLETS, {
            keyPath: "publicKey",
          })
          walletsStore.createIndex("userId", "userId", { unique: false })
        }

        if (!db.objectStoreNames.contains(STORES.METADATA)) {
          db.createObjectStore(STORES.METADATA, {
            keyPath: "key",
          })
        }
      }

      if (oldVersion === 1) {
        const tx = (event.target as IDBOpenDBRequest).transaction
        if (!tx || !db.objectStoreNames.contains(STORES.KEYS)) return
        const store = tx.objectStore(STORES.KEYS)
        if (store.indexNames.contains("publicKey")) {
          store.deleteIndex("publicKey")
        }
        store.createIndex("publicKey", "publicKey", { unique: false })
      }
    }
  })
}

/**
 * Get a value from IndexedDB
 */
export async function get<T>(
  storeName: string,
  key: string
): Promise<T | null> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readonly")
    const store = transaction.objectStore(storeName)
    const request = store.get(key)

    request.onsuccess = () => {
      resolve(request.result ? (request.result as T) : null)
    }

    request.onerror = () => {
      reject(new Error(`Failed to get value: ${request.error}`))
    }
  })
}

/**
 * Set a value in IndexedDB
 */
export async function set<T>(
  storeName: string,
  key: string,
  value: T
): Promise<void> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readwrite")
    const store = transaction.objectStore(storeName)
    
    // If the store uses keyPath, include the key in the value
    const storeValue = store.keyPath === key
      ? value
      : { [store.keyPath as string]: key, ...(value as object) }

    const request = store.put(storeValue)

    request.onsuccess = () => {
      resolve()
    }

    request.onerror = () => {
      reject(new Error(`Failed to set value: ${request.error}`))
    }
  })
}

/**
 * Delete a value from IndexedDB
 */
export async function remove(storeName: string, key: string): Promise<void> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readwrite")
    const store = transaction.objectStore(storeName)
    const request = store.delete(key)

    request.onsuccess = () => {
      resolve()
    }

    request.onerror = () => {
      reject(new Error(`Failed to delete value: ${request.error}`))
    }
  })
}

/**
 * Get all values from an IndexedDB store
 */
export async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readonly")
    const store = transaction.objectStore(storeName)
    const request = store.getAll()

    request.onsuccess = () => {
      resolve(request.result as T[])
    }

    request.onerror = () => {
      reject(new Error(`Failed to get all values: ${request.error}`))
    }
  })
}

/**
 * Query IndexedDB using an index
 */
export async function getByIndex<T>(
  storeName: string,
  indexName: string,
  value: string
): Promise<T | null> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readonly")
    const store = transaction.objectStore(storeName)
    const index = store.index(indexName)
    const request = index.get(value)

    request.onsuccess = () => {
      resolve(request.result ? (request.result as T) : null)
    }

    request.onerror = () => {
      reject(new Error(`Failed to query index: ${request.error}`))
    }
  })
}

/**
 * All records matching an index value (non-unique indexes).
 */
export async function getAllByIndex<T>(
  storeName: string,
  indexName: string,
  value: string
): Promise<T[]> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readonly")
    const store = transaction.objectStore(storeName)
    const index = store.index(indexName)
    const request = index.getAll(value)

    request.onsuccess = () => {
      resolve((request.result as T[]) || [])
    }

    request.onerror = () => {
      reject(new Error(`Failed to query index (getAll): ${request.error}`))
    }
  })
}

/**
 * Clear all data from a store
 */
export async function clear(storeName: string): Promise<void> {
  const db = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readwrite")
    const store = transaction.objectStore(storeName)
    const request = store.clear()

    request.onsuccess = () => {
      resolve()
    }

    request.onerror = () => {
      reject(new Error(`Failed to clear store: ${request.error}`))
    }
  })
}

/**
 * Check if IndexedDB is available
 */
export function isAvailable(): boolean {
  return typeof indexedDB !== "undefined"
}
