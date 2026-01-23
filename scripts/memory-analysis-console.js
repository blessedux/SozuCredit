// Memory Analysis Script - Run this in browser console
// Copy and paste this entire script into your browser's developer console

(function() {
  console.log('🔍 Starting Memory Analysis...\n');
  
  function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  function analyzeStorage() {
    console.log('=== STORAGE ANALYSIS ===\n');
    
    // Analyze localStorage
    console.log('📦 localStorage Analysis:');
    let localStorageSize = 0;
    const localStorageKeys = [];
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key) || '';
          const size = new Blob([key + value]).size;
          localStorageSize += size;
          localStorageKeys.push({
            key: key,
            size: size,
            valuePreview: value.length > 100 ? value.substring(0, 100) + '...' : value,
            fullValue: value
          });
        }
      }
      
      console.log(`Total Size: ${formatBytes(localStorageSize)}`);
      console.log(`Keys: ${localStorageKeys.length}`);
      
      if (localStorageKeys.length > 0) {
        console.log('\n🔑 localStorage Keys:');
        localStorageKeys.forEach((item, index) => {
          console.log(`${index + 1}. "${item.key}" - ${formatBytes(item.size)}`);
          console.log(`   Value: ${item.valuePreview}`);
          if (item.size > 1000) {
            console.log(`   ⚠️  Large key detected!`);
          }
        });
      } else {
        console.log('✅ localStorage is empty');
      }
    } catch (e) {
      console.error('❌ Error analyzing localStorage:', e);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Analyze sessionStorage
    console.log('📦 sessionStorage Analysis:');
    let sessionStorageSize = 0;
    const sessionStorageKeys = [];
    
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) {
          const value = sessionStorage.getItem(key) || '';
          const size = new Blob([key + value]).size;
          sessionStorageSize += size;
          sessionStorageKeys.push({
            key: key,
            size: size,
            valuePreview: value.length > 100 ? value.substring(0, 100) + '...' : value,
            fullValue: value
          });
        }
      }
      
      console.log(`Total Size: ${formatBytes(sessionStorageSize)}`);
      console.log(`Keys: ${sessionStorageKeys.length}`);
      
      if (sessionStorageKeys.length > 0) {
        console.log('\n🔑 sessionStorage Keys:');
        sessionStorageKeys.forEach((item, index) => {
          console.log(`${index + 1}. "${item.key}" - ${formatBytes(item.size)}`);
          console.log(`   Value: ${item.valuePreview}`);
        });
      } else {
        console.log('✅ sessionStorage is empty');
      }
    } catch (e) {
      console.error('❌ Error analyzing sessionStorage:', e);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Analyze IndexedDB
    console.log('📦 IndexedDB Analysis:');
    try {
      if (typeof indexedDB !== 'undefined') {
        indexedDB.databases().then(databases => {
          console.log(`Available: ✅`);
          console.log(`Databases: ${databases.length}`);
          
          if (databases.length > 0) {
            databases.forEach((db, index) => {
              console.log(`${index + 1}. "${db.name}" (v${db.version})`);
            });
          } else {
            console.log('No IndexedDB databases found');
          }
        }).catch(e => {
          console.error('❌ Error checking IndexedDB databases:', e);
        });
      } else {
        console.log('Available: ❌ IndexedDB not supported');
      }
    } catch (e) {
      console.error('❌ Error analyzing IndexedDB:', e);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Summary
    const totalSize = localStorageSize + sessionStorageSize;
    console.log('📊 SUMMARY:');
    console.log(`localStorage: ${formatBytes(localStorageSize)}`);
    console.log(`sessionStorage: ${formatBytes(sessionStorageSize)}`);
    console.log(`Total Browser Storage: ${formatBytes(totalSize)}`);
    
    if (totalSize > 1024 * 1024) { // > 1MB
      console.log('\n⚠️  WARNING: High storage usage detected!');
      console.log('Consider clearing large items or investigating the source.');
    }
    
    return {
      localStorage: { size: localStorageSize, keys: localStorageKeys },
      sessionStorage: { size: sessionStorageSize, keys: sessionStorageKeys },
      totalSize: totalSize
    };
  }
  
  function clearProblematicStorage() {
    console.log('\n🧹 Clearing Storage...\n');
    
    try {
      // Clear localStorage (except essential keys)
      const essentialKeys = ['sozu_username'];
      const keysToRemove = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !essentialKeys.includes(key)) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log(`✅ Removed: "${key}"`);
      });
      
      // Clear all sessionStorage
      sessionStorage.clear();
      console.log('✅ Cleared all sessionStorage');
      
      console.log('\n🎉 Storage cleanup completed!');
      console.log('Run analyzeStorage() again to verify.');
      
    } catch (e) {
      console.error('❌ Error during cleanup:', e);
    }
  }
  
  function findLargeItems() {
    console.log('\n🔍 Searching for Large Storage Items...\n');
    
    const largeItems = [];
    
    // Check localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key) || '';
        const size = new Blob([key + value]).size;
        if (size > 1024) { // > 1KB
          largeItems.push({
            type: 'localStorage',
            key: key,
            size: size,
            value: value
          });
        }
      }
    }
    
    // Check sessionStorage
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key) {
        const value = sessionStorage.getItem(key) || '';
        const size = new Blob([key + value]).size;
        if (size > 1024) { // > 1KB
          largeItems.push({
            type: 'sessionStorage',
            key: key,
            size: size,
            value: value
          });
        }
      }
    }
    
    if (largeItems.length === 0) {
      console.log('✅ No large items found (> 1KB)');
    } else {
      console.log(`Found ${largeItems.length} large items:`);
      largeItems.forEach((item, index) => {
        console.log(`\n${index + 1}. ${item.type}: "${item.key}"`);
        console.log(`   Size: ${formatBytes(item.size)}`);
        console.log(`   Value preview: ${item.value.substring(0, 200)}${item.value.length > 200 ? '...' : ''}`);
      });
    }
    
    return largeItems;
  }
  
  // Run analysis immediately
  const analysis = analyzeStorage();
  
  // Make functions available for further investigation
  window.memoryAnalysis = {
    analyze: analyzeStorage,
    clear: clearProblematicStorage,
    findLarge: findLargeItems,
    format: formatBytes
  };
  
  console.log('\n🛠️  Additional commands available:');
  console.log('memoryAnalysis.analyze() - Run analysis again');
  console.log('memoryAnalysis.clear() - Clear problematic storage');
  console.log('memoryAnalysis.findLarge() - Find items > 1KB');
  console.log('memoryAnalysis.format(bytes) - Format bytes to readable string');
  
  return analysis;
})();
