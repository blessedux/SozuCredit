// Authentication Memory Analysis Script
// Run this BEFORE authenticating, then run it again AFTER to see what changes

(function() {
  console.log('🔍 AUTHENTICATION MEMORY ANALYSIS\n');
  
  function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  function getStorageSnapshot(label) {
    console.log('\n=== ' + label + ' ===');
    
    let totalSize = 0;
    const snapshot = {
      localStorage: {},
      sessionStorage: {},
      totalSize: 0
    };
    
    // localStorage
    console.log('📦 localStorage:');
    let localStorageSize = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key) || '';
        const size = new Blob([key + value]).size;
        localStorageSize += size;
        snapshot.localStorage[key] = { value, size };
        
        console.log(`  "${key}": ${formatBytes(size)}`);
        if (size > 1000) {
          console.log(`    ⚠️  Large! Preview: ${value.substring(0, 100)}...`);
        }
      }
    }
    console.log(`  Total: ${formatBytes(localStorageSize)}`);
    
    // sessionStorage
    console.log('\n📦 sessionStorage:');
    let sessionStorageSize = 0;
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key) {
        const value = sessionStorage.getItem(key) || '';
        const size = new Blob([key + value]).size;
        sessionStorageSize += size;
        snapshot.sessionStorage[key] = { value, size };
        
        console.log(`  "${key}": ${formatBytes(size)}`);
        if (size > 1000) {
          console.log(`    ⚠️  Large! Preview: ${value.substring(0, 100)}...`);
        }
      }
    }
    console.log(`  Total: ${formatBytes(sessionStorageSize)}`);
    
    snapshot.totalSize = localStorageSize + sessionStorageSize;
    console.log(`\n📊 Combined Total: ${formatBytes(snapshot.totalSize)}`);
    
    return snapshot;
  }
  
  function compareSnapshots(before, after) {
    console.log('\n🔍 STORAGE CHANGES ANALYSIS:');
    
    console.log('\n📈 localStorage Changes:');
    const beforeLocalKeys = Object.keys(before.localStorage);
    const afterLocalKeys = Object.keys(after.localStorage);
    
    // Added keys
    const addedLocal = afterLocalKeys.filter(key => !beforeLocalKeys.includes(key));
    if (addedLocal.length > 0) {
      console.log('  ✅ Added:');
      addedLocal.forEach(key => {
        const size = after.localStorage[key].size;
        console.log(`    "${key}": ${formatBytes(size)}`);
        if (size > 1000) {
          console.log(`      ⚠️  Large item! Preview: ${after.localStorage[key].value.substring(0, 100)}...`);
        }
      });
    }
    
    // Modified keys
    const modifiedLocal = afterLocalKeys.filter(key => 
      beforeLocalKeys.includes(key) && 
      before.localStorage[key].value !== after.localStorage[key].value
    );
    if (modifiedLocal.length > 0) {
      console.log('  🔄 Modified:');
      modifiedLocal.forEach(key => {
        const beforeSize = before.localStorage[key].size;
        const afterSize = after.localStorage[key].size;
        const change = afterSize - beforeSize;
        console.log(`    "${key}": ${formatBytes(beforeSize)} → ${formatBytes(afterSize)} (${change > 0 ? '+' : ''}${formatBytes(change)})`);
      });
    }
    
    // Removed keys
    const removedLocal = beforeLocalKeys.filter(key => !afterLocalKeys.includes(key));
    if (removedLocal.length > 0) {
      console.log('  ❌ Removed:');
      removedLocal.forEach(key => {
        console.log(`    "${key}": ${formatBytes(before.localStorage[key].size)}`);
      });
    }
    
    console.log('\n📈 sessionStorage Changes:');
    const beforeSessionKeys = Object.keys(before.sessionStorage);
    const afterSessionKeys = Object.keys(after.sessionStorage);
    
    // Added keys
    const addedSession = afterSessionKeys.filter(key => !beforeSessionKeys.includes(key));
    if (addedSession.length > 0) {
      console.log('  ✅ Added:');
      addedSession.forEach(key => {
        const size = after.sessionStorage[key].size;
        console.log(`    "${key}": ${formatBytes(size)}`);
        if (size > 1000) {
          console.log(`      ⚠️  Large item! Preview: ${after.sessionStorage[key].value.substring(0, 100)}...`);
        }
      });
    }
    
    // Modified keys
    const modifiedSession = afterSessionKeys.filter(key => 
      beforeSessionKeys.includes(key) && 
      before.sessionStorage[key].value !== after.sessionStorage[key].value
    );
    if (modifiedSession.length > 0) {
      console.log('  🔄 Modified:');
      modifiedSession.forEach(key => {
        const beforeSize = before.sessionStorage[key].size;
        const afterSize = after.sessionStorage[key].size;
        const change = afterSize - beforeSize;
        console.log(`    "${key}": ${formatBytes(beforeSize)} → ${formatBytes(afterSize)} (${change > 0 ? '+' : ''}${formatBytes(change)})`);
      });
    }
    
    // Summary
    const sizeChange = after.totalSize - before.totalSize;
    console.log('\n📊 SUMMARY:');
    console.log(`  Before: ${formatBytes(before.totalSize)}`);
    console.log(`  After: ${formatBytes(after.totalSize)}`);
    console.log(`  Change: ${sizeChange > 0 ? '+' : ''}${formatBytes(sizeChange)}`);
    
    if (sizeChange > 1024 * 1024) { // > 1MB
      console.log('  ⚠️  WARNING: Large memory increase detected!');
      console.log('  This indicates a potential memory leak in authentication.');
    }
    
    // Check for specific problematic patterns
    console.log('\n🔍 Problematic Patterns:');
    const allAfterKeys = [...afterLocalKeys, ...afterSessionKeys];
    const largeKeys = allAfterKeys.filter(key => {
      const storage = key in after.localStorage ? after.localStorage : after.sessionStorage;
      return storage[key].size > 10000; // > 10KB
    });
    
    if (largeKeys.length > 0) {
      console.log('  ⚠️  Large keys detected:');
      largeKeys.forEach(key => {
        const storage = key in after.localStorage ? after.localStorage : after.sessionStorage;
        console.log(`    "${key}": ${formatBytes(storage[key].size)}`);
      });
    }
    
    // Check for base64 strings (likely encrypted data)
    const base64Keys = allAfterKeys.filter(key => {
      const storage = key in after.localStorage ? after.localStorage : after.sessionStorage;
      const value = storage[key].value;
      return value.length > 100 && /^[A-Za-z0-9+/=]+$/.test(value);
    });
    
    if (base64Keys.length > 0) {
      console.log('  🔐 Potential encrypted data (base64):');
      base64Keys.forEach(key => {
        const storage = key in after.localStorage ? after.localStorage : after.sessionStorage;
        console.log(`    "${key}": ${formatBytes(storage[key].size)} (base64 encoded)`);
      });
    }
  }
  
  // Initialize
  console.log('🚀 Authentication Memory Analysis Ready!');
  console.log('\n📋 INSTRUCTIONS:');
  console.log('1. This snapshot shows CURRENT storage state');
  console.log('2. Authenticate now (click the button)');
  console.log('3. Run: authMemoryAnalysis.after() to see changes');
  console.log('4. Run: authMemoryAnalysis.compare() to analyze differences');
  
  // Take initial snapshot
  const initialSnapshot = getStorageSnapshot('BEFORE AUTHENTICATION');
  
  // Make functions available globally
  window.authMemoryAnalysis = {
    before: () => getStorageSnapshot('BEFORE AUTHENTICATION'),
    after: () => getStorageSnapshot('AFTER AUTHENTICATION'),
    compare: () => {
      const after = getStorageSnapshot('AFTER AUTHENTICATION');
      compareSnapshots(initialSnapshot, after);
      return after;
    },
    clear: () => {
      console.log('\n🧹 Clearing authentication-related storage...');
      const keysToRemove = [
        'sozu_username',
        'stellar_public_key',
        'credential_id',
        'dev_username',
        'dev_authenticated'
      ];
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
        console.log(`✅ Removed: ${key}`);
      });
      
      // Clear IndexedDB
      if (typeof indexedDB !== 'undefined') {
        indexedDB.databases().then(databases => {
          databases.forEach(db => {
            if (db.name.includes('sozu')) {
              indexedDB.deleteDatabase(db.name);
              console.log(`✅ Deleted IndexedDB: ${db.name}`);
            }
          });
        });
      }
      
      console.log('🎉 Authentication storage cleared!');
    },
    format: formatBytes
  };
  
  console.log('\n🛠️  Commands available:');
  console.log('authMemoryAnalysis.before() - Take new "before" snapshot');
  console.log('authMemoryAnalysis.after() - Take "after" snapshot');
  console.log('authMemoryAnalysis.compare() - Compare before/after');
  console.log('authMemoryAnalysis.clear() - Clear auth-related storage');
  
  return initialSnapshot;
})();
