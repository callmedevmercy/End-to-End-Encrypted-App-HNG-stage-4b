/**
 * Converts an ArrayBuffer to a Base64 string.
 * @param {ArrayBuffer} buffer
 * @returns {string} base64 encoded string
 */
export function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Converts a Base64 string to an ArrayBuffer.
 * @param {string} base64
 * @returns {ArrayBuffer}
 */
export function base64ToArrayBuffer(base64) {
  if (!base64 || typeof base64 !== 'string') {
    throw new Error(`Invalid base64 string provided to base64ToArrayBuffer: ${typeof base64}`);
  }
  
  // Remove PEM headers and all whitespace/newlines
  let normalized = base64
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/[\s\r\n]+/g, '');
    
  // Normalize base64url to standard base64
  normalized = normalized.replace(/-/g, '+').replace(/_/g, '/');
  
  // Strip ALL non-base64 characters
  normalized = normalized.replace(/[^A-Za-z0-9+/]/g, '');

  if (normalized.length % 4 === 1) {
    throw new Error(`Invalid base64 string (length 1 mod 4). Original string: "${base64.substring(0, 50)}..."`);
  }
  
  // Add padding if missing
  while (normalized.length % 4 !== 0) {
    normalized += '=';
  }
  
  try {
    const binary_string = window.atob(normalized);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (err) {
    throw new Error(`atob failed! Original string: "${base64.substring(0, 50)}...". Error: ${err.message}`);
  }
}

/**
 * Encodes a string to a Uint8Array.
 * @param {string} str 
 * @returns {Uint8Array}
 */
export function stringToUint8Array(str) {
  return new TextEncoder().encode(str);
}

/**
 * Decodes a Uint8Array to a string.
 * @param {Uint8Array|ArrayBuffer} buffer 
 * @returns {string}
 */
export function uint8ArrayToString(buffer) {
  return new TextDecoder().decode(buffer);
}
