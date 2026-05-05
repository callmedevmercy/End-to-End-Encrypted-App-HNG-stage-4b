import { arrayBufferToBase64, base64ToArrayBuffer } from './utils';

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
    true, // extractable so we can export and wrap it
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
 * Derives an AES-GCM (256-bit) key from a password and salt using PBKDF2.
 * We use AES-GCM instead of AES-KW to avoid the AES-KW 8-byte alignment
 * requirement on the PKCS8 export of the RSA private key.
 *
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
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts an RSA private key with an AES-GCM wrapping key.
 * The output is: base64( 12-byte-IV || AES-GCM-ciphertext-of-PKCS8 )
 *
 * @param {CryptoKey} privateKey   RSA-OAEP private key (extractable)
 * @param {CryptoKey} wrappingKey  AES-GCM-256 key derived from password
 * @returns {Promise<string>}      Base64 encoded wrapped key blob
 */
export async function wrapPrivateKey(privateKey, wrappingKey) {
  // 1. Export the private key to raw PKCS8 bytes
  const pkcs8Buffer = await window.crypto.subtle.exportKey('pkcs8', privateKey);

  // 2. Generate a random 12-byte IV for AES-GCM
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // 3. Encrypt the PKCS8 bytes (no alignment restriction with AES-GCM)
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    wrappingKey,
    pkcs8Buffer
  );

  // 4. Concatenate IV || ciphertext so we can recover IV on unwrap
  const combined = new Uint8Array(iv.byteLength + encryptedBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedBuffer), iv.byteLength);

  return arrayBufferToBase64(combined.buffer);
}

/**
 * Decrypts a base64 wrapped private key back into a CryptoKey.
 * Expects input in the format: base64( 12-byte-IV || AES-GCM-ciphertext )
 *
 * @param {string}    wrappedKeyBase64  Base64 blob from wrapPrivateKey
 * @param {CryptoKey} wrappingKey       AES-GCM-256 key re-derived from password
 * @returns {Promise<CryptoKey>}        RSA-OAEP private key in memory
 */
export async function unwrapPrivateKey(wrappedKeyBase64, wrappingKey) {
  const combined = new Uint8Array(base64ToArrayBuffer(wrappedKeyBase64));

  // 1. Split out the 12-byte IV and the ciphertext
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  // 2. Decrypt back to raw PKCS8 bytes
  const pkcs8Buffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    wrappingKey,
    ciphertext
  );

  // 3. Re-import as an RSA-OAEP private key (non-extractable for security)
  return await window.crypto.subtle.importKey(
    'pkcs8',
    pkcs8Buffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false, // non-extractable once restored in memory
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
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['encrypt']
  );
}
