// Enhanced Memory Analysis Script - Run this in browser console
// This script checks ALL possible storage sources that could be causing 6.6MB

(function() {
  console.log('🔍 ENHANCED MEMORY ANALYSIS - Checking all storage sources...\n');
  
  function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  async function analyzeAllStorage() {
    console.log('=== COMPREHENSIVE STORAGE ANALYSIS ===\n');
    
    // 1. Check localStorage/sessionStorage
    console.log('1️⃣ Browser Storage:');
    let localStorageSize = 0;
    let sessionStorageSize = 0;
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key) || '';
          localStorageSize += new Blob([key + value]).size;
        }
      }
      
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) {
          const value = sessionStorage.getItem(key) || '';
          sessionStorageSize += new Blob([key + value]).size;
        }
      }
      
      console.log('   localStorage: ' + formatBytes(localStorageSize));
      console.log('   sessionStorage: ' + formatBytes(sessionStorageSize));
    } catch (e) {
      console.error('   Error:', e);
    }
    
    console.log('\n2️⃣ IndexedDB:');
    try {
      if (typeof indexedDB !== 'undefined') {
        const databases = await indexedDB.databases();
        console.log('   Databases: ' + databases.length);
        
        for (const db of databases) {
          try {
            const request = indexedDB.open(db.name);
            await new Promise((resolve, reject) => {
              request.onsuccess = resolve;
              request.onerror = reject;
            });
            const dbInstance = request.result;
            
            for (const storeName of dbInstance.objectStoreNames) {
              try {
                const transaction = dbInstance.transaction(storeName, 'readonly');
                const store = transaction.objectStore(storeName);
                const countRequest = store.count();
                const count = await new Promise(resolve => {
                  countRequest.onsuccess = () => resolve(countRequest.result);
                  countRequest.onerror = () => resolve(0);
                });
                console.log('   ' + db.name + '.' + storeName + ': ~' + count + ' records');
              } catch (e) {
                // Skip if can't access
              }
            }
            dbInstance.close();
          } catch (e) {
            console.log('   ' + db.name + ': (access denied)');
          }
        }
      } else {
        console.log('   IndexedDB not available');
      }
    } catch (e) {
      console.error('   Error:', e);
    }
    
    console.log('\n3️⃣ Cache Storage:');
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        console.log('   Cache names: ' + cacheNames.length);
        
        let totalCacheSize = 0;
        for (const cacheName of cacheNames) {
          try {
            const cache = await caches.open(cacheName);
            const requests = await cache.keys();
            let cacheSize = 0;
            
            for (const request of requests) {
              try {
                const response = await cache.match(request);
                if (response) {
                  const blob = await response.blob();
                  cacheSize += blob.size;
                }
              } catch (e) {
                // Skip if can't read
              }
            }
            
            totalCacheSize += cacheSize;
            console.log('   ' + cacheName + ': ' + formatBytes(cacheSize) + ' (' + requests.length + ' entries)');
          } catch (e) {
            console.log('   ' + cacheName + ': (error reading)');
          }
        }
        console.log('   Total cache: ' + formatBytes(totalCacheSize));
      } else {
        console.log('   Cache API not available');
      }
    } catch (e) {
      console.error('   Error:', e);
    }
    
    console.log('\n4️⃣ Quota Management:');
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        console.log('   Usage: ' + formatBytes(estimate.usage || 0));
        console.log('   Quota: ' + formatBytes(estimate.quota || 0));
        console.log('   Usage breakdown:', estimate.usageDetails || 'N/A');
        
        if (estimate.usage && estimate.usage > 1024 * 1024) {
          console.log('   ⚠️  High usage detected in quota estimate!');
        }
      } else {
        console.log('   Storage quota API not available');
      }
    } catch (e) {
      console.error('   Error:', e);
    }
    
    console.log('\n5️⃣ Memory Usage:');
    try {
      if ('memory' in performance) {
        const memory = performance.memory;
        console.log('   JS Heap Size: ' + formatBytes(memory.usedJSHeapSize));
        console.log('   JS Heap Limit: ' + formatBytes(memory.jsHeapSizeLimit));
        console.log('   Total JS Heap: ' + formatBytes(memory.totalJSHeapSize));
      } else {
        console.log('   Memory API not available (Chrome only)');
      }
    } catch (e) {
      console.error('   Error:', e);
    }
    
    console.log('\n6️⃣ Service Worker Registration:');
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        console.log('   Service Workers: ' + registrations.length);
        
        for (const registration of registrations) {
          console.log('   ' + registration.scope + ': active=' + !!registration.active);
        }
      } else {
        console.log('   Service Workers not available');
      }
    } catch (e) {
      console.error('   Error:', e);
    }
    
    console.log('\n=== RECOMMENDATIONS ===');
    console.log('If you still see 6.6MB in DevTools, it might be:');
    console.log('1. Service Worker cache (check Cache Storage section)');
    console.log('2. IndexedDB (check IndexedDB section in DevTools)');
    console.log('3. Extension storage (not visible to page scripts)');
    console.log('4. Memory cache (not storage)');
    console.log('5. Quota usage (check Application > Storage > Quota)');
    
    return {
      localStorageSize,
      sessionStorageSize,
      timestamp: new Date().toISOString()
    };
  }
  
  // Clear caches function
  async function clearAllCaches() {
    console.log('\n🧹 Clearing all caches...');
    
    try {
      // Clear Cache API
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('✅ Cleared ' + cacheNames.length + ' cache(s)');
      }
      
      // Clear service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.unregister()));
        console.log('✅ Unregistered ' + registrations.length + ' service worker(s)');
      }
      
      console.log('🎉 Cache clearing completed! Refresh the page and check DevTools again.');
    } catch (e) {
      console.error('❌ Error clearing caches:', e);
    }
  }
  
  // Run enhanced analysis
  const result = await analyzeAllStorage();
  
  // Make functions available
  window.enhancedMemoryAnalysis = {
    analyze: analyzeAllStorage,
    clearCaches: clearAllCaches,
    format: formatBytes
  };
  
  console.log('\n🛠️  Enhanced commands available:');
  console.log('enhancedMemoryAnalysis.analyze() - Run full analysis again');
  console.log('enhancedMemoryAnalysis.clearCaches() - Clear all caches and service workers');
  
  return result;
})();
