import { arrayBufferToBase64, base64ToArrayBuffer, stringToUint8Array } from './utils';

/**
 * Generates an RSA-OAEP keypair for message encryption.
 * @returns {Promise<CryptoKeyPair>}
 */
export async function generateRSAKeyPair() {
  return await window.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]), // 65537
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Generates a random 128-bit salt for PBKDF2.
 * @returns {Uint8Array}
 */
export function generateSalt() {
  return window.crypto.getRandomValues(new Uint8Array(16));
}

/**
 * Derives an AES-KW (Key Wrap) key from a password and salt using PBKDF2.
 * @param {string} password 
 * @param {Uint8Array} salt 
 * @returns {Promise<CryptoKey>}
 */
export async function deriveWrappingKey(password, salt) {
  const enc = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-KW', length: 256 },
    false,
    ['wrapKey', 'unwrapKey']
  );
}

/**
 * Wraps an RSA private key using an AES-KW wrapping key.
 * @param {CryptoKey} privateKey 
 * @param {CryptoKey} wrappingKey 
 * @returns {Promise<string>} Base64 encoded wrapped key
 */
export async function wrapPrivateKey(privateKey, wrappingKey) {
  const wrapped = await window.crypto.subtle.wrapKey(
    'pkcs8',
    privateKey,
    wrappingKey,
    { name: 'AES-KW' }
  );
  return arrayBufferToBase64(wrapped);
}

/**
 * Unwraps a Base64-encoded wrapped private key back into a CryptoKey.
 * @param {string} wrappedKeyBase64 
 * @param {CryptoKey} wrappingKey 
 * @returns {Promise<CryptoKey>}
 */
export async function unwrapPrivateKey(wrappedKeyBase64, wrappingKey) {
  const wrappedBuffer = base64ToArrayBuffer(wrappedKeyBase64);
  return await window.crypto.subtle.unwrapKey(
    'pkcs8',
    wrappedBuffer,
    wrappingKey,
    { name: 'AES-KW' },
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    false,
    ['decrypt']
  );
}

/**
 * Exports a public key to a Base64-encoded SPKI string.
 * @param {CryptoKey} publicKey 
 * @returns {Promise<string>}
 */
export async function exportPublicKey(publicKey) {
  const exported = await window.crypto.subtle.exportKey('spki', publicKey);
  return arrayBufferToBase64(exported);
}

/**
 * Imports a Base64-encoded SPKI string into an RSA-OAEP public key.
 * @param {string} base64PublicKey 
 * @returns {Promise<CryptoKey>}
 */
export async function importPublicKey(base64PublicKey) {
  const buffer = base64ToArrayBuffer(base64PublicKey);
  return await window.crypto.subtle.importKey(
    'spki',
    buffer,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['encrypt']
  );
}
