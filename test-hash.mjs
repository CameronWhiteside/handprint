import sodium from 'libsodium-wrappers';

await sodium.ready;

const testBytes = new Uint8Array([1, 2, 3]);

// Try different function names
const functions = [
  'crypto_hash',
  'crypto_hash_sha256',
  'crypto_hash_sha512',
  'crypto_generichash'
];

for (const fn of functions) {
  if (typeof sodium[fn] === 'function') {
    console.log(`✓ ${fn} exists`);
    try {
      if (fn === 'crypto_generichash') {
        const result = sodium[fn](32, testBytes);
        console.log(`  Result: ${result.byteLength} bytes`);
      } else {
        const result = sodium[fn](testBytes);
        console.log(`  Result: ${result.byteLength} bytes`);
      }
    } catch (e) {
      console.log(`  Error calling: ${e.message}`);
    }
  } else {
    console.log(`✗ ${fn} not found`);
  }
}
