// Console Memory Clear Script
// Clears console memory and reduces excessive logging

(function() {
  console.log('🧹 Clearing console memory...');
  
  // Clear console
  console.clear();
  
  // Override console.log to prevent large object logging during debugging
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  
  console.log = function(...args) {
    // Filter out large object logs that cause memory issues
    const filteredArgs = args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        // Check if it's a large array or object
        if (Array.isArray(arg)) {
          if (arg.length > 10) {
            return `[Array with ${arg.length} items - truncated for memory]`;
          }
        } else if (Object.keys(arg).length > 20) {
          return `[Object with ${Object.keys(arg).length} keys - truncated for memory]`;
        }
        // Limit object depth
        return JSON.stringify(arg, null, 0).substring(0, 200) + 
               (JSON.stringify(arg, null, 0).length > 200 ? '...' : '');
      }
      return arg;
    });
    
    originalLog.apply(console, filteredArgs);
  };
  
  console.warn = function(...args) {
    const filteredArgs = args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        return JSON.stringify(arg, null, 0).substring(0, 100) + 
               (JSON.stringify(arg, null, 0).length > 100 ? '...' : '');
      }
      return arg;
    });
    
    originalWarn.apply(console, filteredArgs);
  };
  
  console.error = function(...args) {
    const filteredArgs = args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        return JSON.stringify(arg, null, 0).substring(0, 100) + 
               (JSON.stringify(arg, null, 0).length > 100 ? '...' : '');
      }
      return arg;
    });
    
    originalError.apply(console, filteredArgs);
  };
  
  console.log('✅ Console memory optimization enabled');
  console.log('📊 Large object logs will be truncated to prevent memory issues');
  console.log('🔄 Refresh the page to see memory usage decrease');
  
  // Make restore function available
  window.restoreConsole = function() {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
    console.log('✅ Console logging restored to normal');
  };
  
  return {
    enabled: true,
    restore: window.restoreConsole
  };
})();
