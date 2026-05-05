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
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
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
