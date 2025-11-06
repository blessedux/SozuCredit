/**
 * Test the new ARS formatting with examples
 */

console.log('🧪 ARS Formatting Examples');
console.log('===========================');
console.log('');

// Simulate the new formatting
const formatARS = (amount) => {
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(amount);
};

const examples = [
  100,      // Small amount
  1000,     // Medium amount
  10000,    // Larger amount
  100000,   // Even larger
  1000000,  // Million
];

console.log('📊 Formatting Examples:');
console.log('');

examples.forEach(amount => {
  const formatted = formatARS(amount);
  const [integerPart, decimalPart] = formatted.split(',');
  console.log(`💰 $${amount} USD → ${formatted} ARS`);
  console.log(`   📈 Integer: "${integerPart}" (6xl font, baseline)`);
  console.log(`   📉 Decimal: ",${decimalPart}" (2xl font, 3x smaller, bottom-aligned)`);
  console.log('');
});

console.log('🎨 Visual Result:');
console.log('   Large numbers will show like: 90.000,1234');
console.log('   Where "90.000" is 6xl (baseline) and ",1234" is 2xl (bottom-aligned)');
console.log('   Decimals appear lower, like subscript numbers');
console.log('');

console.log('✅ Ready to test! Run: npm run dev');
