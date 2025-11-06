/**
 * Simple test script to trigger auto-deposit
 * This will help test if deposits are working and creating database records
 */

const fetch = require('node-fetch');

async function testAutoDeposit() {
  console.log('🧪 Testing auto-deposit functionality...');

  try {
    // This assumes you have the dev server running on localhost:3000
    // and you're logged in with a session cookie

    console.log('📤 Triggering auto-deposit...');
    const response = await fetch('http://localhost:3000/api/wallet/defindex/auto-deposit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // You'll need to add your session cookie here
        // 'Cookie': 'your_session_cookie_here'
      }
    });

    const result = await response.json();
    console.log('📥 Auto-deposit response:', JSON.stringify(result, null, 2));

    if (result.success) {
      if (result.triggered) {
        console.log('✅ Auto-deposit triggered successfully!');
        console.log(`💰 Deposited: $${result.depositAmount} USDC`);
        console.log(`🔗 Transaction: ${result.transactionHash}`);
      } else {
        console.log('ℹ️ Auto-deposit not triggered (no eligible balance increase)');
      }
    } else {
      console.log('❌ Auto-deposit failed:', result.error);
    }

  } catch (error) {
    console.error('💥 Test failed:', error.message);
    console.log('\n🔧 To run this test:');
    console.log('1. Start your dev server: npm run dev');
    console.log('2. Log in to the app in your browser');
    console.log('3. Copy your session cookie from browser dev tools');
    console.log('4. Uncomment and update the Cookie header above');
    console.log('5. Run: node test-auto-deposit.js');
  }
}

if (require.main === module) {
  testAutoDeposit();
}
