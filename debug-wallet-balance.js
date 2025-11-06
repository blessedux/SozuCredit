/**
 * Debug script to check wallet balance directly
 */

const fetch = require('node-fetch');

async function debugWalletBalance() {
  console.log('🔍 Debugging wallet balance...');

  try {
    // First, get the wallet address
    console.log('📤 Getting wallet address...');
    const walletResponse = await fetch('http://localhost:3000/api/wallet/stellar/address', {
      headers: {
        'Content-Type': 'application/json',
        // Add your session cookie here
        // 'Cookie': 'your_session_cookie_here'
      }
    });

    if (!walletResponse.ok) {
      console.log('❌ Could not get wallet address:', walletResponse.status);
      return;
    }

    const walletData = await walletResponse.json();
    console.log('📥 Wallet data:', walletData);

    if (walletData.publicKey) {
      const publicKey = walletData.publicKey;
      console.log('🔑 Wallet address:', publicKey);

      // Check XLM balance
      console.log('💰 Checking XLM balance...');
      const xlmResponse = await fetch('http://localhost:3000/api/wallet/stellar/balance', {
        headers: {
          'x-user-id': 'your_user_id_here', // Replace with actual user ID
        }
      });

      const xlmData = await xlmResponse.json();
      console.log('💰 XLM balance:', xlmData);

      // Check DeFindex balance
      console.log('🏦 Checking DeFindex balance...');
      const defindexResponse = await fetch('http://localhost:3000/api/wallet/defindex/balance', {
        headers: {
          // Add your session cookie here
          // 'Cookie': 'your_session_cookie_here'
        }
      });

      const defindexData = await defindexResponse.json();
      console.log('🏦 DeFindex balance:', JSON.stringify(defindexData, null, 2));

      // Check auto-deposit status
      console.log('🤖 Checking auto-deposit status...');
      const autoDepositResponse = await fetch('http://localhost:3000/api/wallet/defindex/auto-deposit', {
        headers: {
          // Add your session cookie here
          // 'Cookie': 'your_session_cookie_here'
        }
      });

      const autoDepositData = await autoDepositResponse.json();
      console.log('🤖 Auto-deposit status:', JSON.stringify(autoDepositData, null, 2));

    } else {
      console.log('❌ No public key found in wallet data');
    }

  } catch (error) {
    console.error('💥 Debug failed:', error.message);
    console.log('\n🔧 Setup instructions:');
    console.log('1. Start your dev server: npm run dev');
    console.log('2. Log in to the app in your browser');
    console.log('3. Copy your session cookie from browser dev tools');
    console.log('4. Replace "your_session_cookie_here" with your actual cookie');
    console.log('5. Find your user ID from the browser console or database');
    console.log('6. Replace "your_user_id_here" with your actual user ID');
    console.log('7. Run: node debug-wallet-balance.js');
  }
}

if (require.main === module) {
  debugWalletBalance();
}
