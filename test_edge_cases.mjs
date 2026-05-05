import { webcrypto } from 'crypto';
global.window = { 
  crypto: webcrypto,
  btoa: (str) => Buffer.from(str, 'binary').toString('base64'),
  atob: (b64) => Buffer.from(b64, 'base64').toString('binary')
};

import { generateMessageKey, encryptMessage, decryptMessage, encryptKeyWithRSA, decryptKeyWithRSA } from './src/crypto/encryption.js';

async function testEdgeCases() {
  console.log("Starting QA Edge Case Tests for Cryptography...");
  let passed = 0;
  let failed = 0;

  // Generate test RSA Keypair
  const rsaKeypair = await window.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );

  const aesKey = await generateMessageKey();

  function report(name, success, err) {
    if (success) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.log(`❌ [FAIL] ${name} - ${err}`);
      failed++;
    }
  }

  // 1. Empty String
  try {
    const enc = await encryptMessage("", aesKey);
    const dec = await decryptMessage(enc.ciphertext, enc.iv, aesKey);
    report("Encrypt/Decrypt Empty String", dec === "");
  } catch(e) { report("Encrypt/Decrypt Empty String", false, e); }

  // 2. Extremely Large Payload (simulated 1MB string)
  try {
    const huge = "A".repeat(1024 * 1024);
    const enc = await encryptMessage(huge, aesKey);
    const dec = await decryptMessage(enc.ciphertext, enc.iv, aesKey);
    report("Encrypt/Decrypt 1MB Payload", dec === huge);
  } catch(e) { report("Encrypt/Decrypt 1MB Payload", false, e); }

  // 3. Tampered Ciphertext
  try {
    const enc = await encryptMessage("Secret Data", aesKey);
    // Corrupt base64 ciphertext
    const corrupted = enc.ciphertext.substring(0, enc.ciphertext.length - 2) + "==";
    await decryptMessage(corrupted, enc.iv, aesKey);
    report("Tampered Ciphertext Detection", false, "Should have thrown an error");
  } catch(e) {
    report("Tampered Ciphertext Detection", true);
  }

  // 4. Decrypting with wrong RSA key (simulating someone else trying to read it)
  try {
    const wrongRsaKeypair = await window.crypto.subtle.generateKey(
      { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true, ['encrypt', 'decrypt']
    );
    const encryptedAes = await encryptKeyWithRSA(aesKey, rsaKeypair.publicKey);
    await decryptKeyWithRSA(encryptedAes, wrongRsaKeypair.privateKey);
    report("Wrong RSA Key Decryption", false, "Should have thrown an error");
  } catch(e) {
    report("Wrong RSA Key Decryption", true);
  }

  // 5. Tampered IV
  try {
    const enc = await encryptMessage("Secret Data", aesKey);
    // Use an IV of all zeros
    const fakeIv = Buffer.from(new Uint8Array(12)).toString('base64');
    await decryptMessage(enc.ciphertext, fakeIv, aesKey);
    report("Tampered IV Detection", false, "Should have thrown an error");
  } catch(e) {
    report("Tampered IV Detection", true);
  }

  console.log(`\nResults: ${passed} Passed, ${failed} Failed`);
}

testEdgeCases().catch(console.error);
