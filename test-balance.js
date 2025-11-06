/**
 * Simple test script to check balance API
 * This will show if the balance tracking is working with database positions
 */

const fetch = require('node-fetch');

async function testBalance() {
  console.log('🧪 Testing balance API...');

  try {
    console.log('📤 Fetching balance...');
    const response = await fetch('http://localhost:3000/api/wallet/defindex/balance', {
      headers: {
        'Content-Type': 'application/json',
        // You'll need to add your session cookie here
        // 'Cookie': 'your_session_cookie_here'
      }
    });

    const result = await response.json();
    console.log('📥 Balance response:', JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('✅ Balance API working!');
      console.log(`💰 Wallet Balance: $${result.walletBalance}`);
      console.log(`🏦 Strategy Balance: $${result.strategyBalance}`);
      console.log(`📊 Total Balance: $${result.balance}`);
      console.log(`🎫 Strategy Shares: ${result.strategyShares}`);

      if (result.strategyBalance > 0) {
        console.log('🎉 Funds detected in DeFi strategy!');
      } else {
        console.log('ℹ️ No funds currently in DeFi strategy');
        console.log('💡 Try depositing some USDC first via auto-deposit');
      }
    } else {
      console.log('❌ Balance API failed:', result.error);
    }

  } catch (error) {
    console.error('💥 Test failed:', error.message);
    console.log('\n🔧 To run this test:');
    console.log('1. Start your dev server: npm run dev');
    console.log('2. Log in to the app in your browser');
    console.log('3. Copy your session cookie from browser dev tools');
    console.log('4. Uncomment and update the Cookie header above');
    console.log('5. Run: node test-balance.js');
  }
}

if (require.main === module) {
  testBalance();
}
