import { arrayBufferToBase64, base64ToArrayBuffer, stringToUint8Array, uint8ArrayToString } from './utils';

/**
 * Generates a random 256-bit AES-GCM key for encrypting a message.
 * @returns {Promise<CryptoKey>}
 */
export async function generateMessageKey() {
  return await window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true, // Extractable so we can encrypt it with RSA
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a plaintext message using AES-GCM.
 * @param {string} plaintext 
 * @param {CryptoKey} aesKey 
 * @returns {Promise<{ciphertext: string, iv: string}>} base64 encoded
 */
export async function encryptMessage(plaintext, aesKey) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
  const encodedMessage = stringToUint8Array(plaintext);

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    aesKey,
    encodedMessage
  );

  return {
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
    iv: arrayBufferToBase64(iv.buffer),
  };
}

/**
 * Encrypts an AES-GCM key with an RSA-OAEP public key.
 * @param {CryptoKey} aesKey 
 * @param {CryptoKey} rsaPublicKey 
 * @returns {Promise<string>} base64 encoded encrypted key
 */
export async function encryptKeyWithRSA(aesKey, rsaPublicKey) {
  // Export the AES key to raw format
  const rawKey = await window.crypto.subtle.exportKey('raw', aesKey);
  
  // Encrypt the raw key with RSA
  const encryptedKeyBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'RSA-OAEP',
    },
    rsaPublicKey,
    rawKey
  );

  return arrayBufferToBase64(encryptedKeyBuffer);
}

/**
 * Decrypts an encrypted AES-GCM key using an RSA-OAEP private key.
 * @param {string} encryptedKeyBase64 
 * @param {CryptoKey} rsaPrivateKey 
 * @returns {Promise<CryptoKey>}
 */
export async function decryptKeyWithRSA(encryptedKeyBase64, rsaPrivateKey) {
  const encryptedBuffer = base64ToArrayBuffer(encryptedKeyBase64);
  
  const decryptedRawKey = await window.crypto.subtle.decrypt(
    {
      name: 'RSA-OAEP',
    },
    rsaPrivateKey,
    encryptedBuffer
  );

  // Import the raw decrypted material back as an AES-GCM key
  return await window.crypto.subtle.importKey(
    'raw',
    decryptedRawKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Decrypts a ciphertext message using AES-GCM.
 * @param {string} ciphertextBase64 
 * @param {string} ivBase64 
 * @param {CryptoKey} aesKey 
 * @returns {Promise<string>} plaintext string
 */
export async function decryptMessage(ciphertextBase64, ivBase64, aesKey) {
  const ciphertextBuffer = base64ToArrayBuffer(ciphertextBase64);
  const ivBuffer = base64ToArrayBuffer(ivBase64);

  const plaintextBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(ivBuffer),
    },
    aesKey,
    ciphertextBuffer
  );

  return uint8ArrayToString(plaintextBuffer);
}
