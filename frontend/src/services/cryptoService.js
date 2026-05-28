/**
 * cryptoService.js
 * End-to-end encryption using Web Crypto API.
 * - Key pairs: ECDH P-256
 * - Message encryption: AES-GCM 256-bit
 * - Private key storage: IndexedDB (never sent to server)
 */

const DB_NAME = 'ichat_e2ee';
const DB_VERSION = 1;
const STORE_NAME = 'keys';

// ─── IndexedDB helpers ────────────────────────────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Key generation ───────────────────────────────────────────────────────────

/**
 * Generate a new ECDH P-256 key pair for a user.
 * Returns { publicKey, privateKey } as CryptoKey objects.
 */
export async function generateKeyPair() {
  return crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true, // extractable
    ['deriveKey']
  );
}

// ─── Key export / import ──────────────────────────────────────────────────────

/**
 * Export a public CryptoKey to base64 string (to store on server).
 */
export async function exportPublicKey(publicKey) {
  const buf = await crypto.subtle.exportKey('spki', publicKey);
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

/**
 * Import a base64 public key string back into a CryptoKey.
 */
export async function importPublicKey(base64) {
  const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'spki',
    binary.buffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    [] // public key: no usages needed
  );
}

// ─── Private key storage in IndexedDB ────────────────────────────────────────

/**
 * Save a user's private CryptoKey into IndexedDB.
 */
export async function savePrivateKey(uid, privateKey) {
  const exported = await crypto.subtle.exportKey('pkcs8', privateKey);
  await idbSet(`privateKey_${uid}`, exported);
}

/**
 * Load a user's private CryptoKey from IndexedDB.
 * Returns null if not found.
 */
export async function loadPrivateKey(uid) {
  const exported = await idbGet(`privateKey_${uid}`);
  if (!exported) return null;
  return crypto.subtle.importKey(
    'pkcs8',
    exported,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey']
  );
}

/**
 * Delete a user's private key from IndexedDB (on logout / key reset).
 */
export async function deletePrivateKey(uid) {
  await idbDelete(`privateKey_${uid}`);
}

// ─── Shared key derivation ────────────────────────────────────────────────────

/**
 * Derive a shared AES-GCM key from our private key and the other party's public key.
 * Both sides derive the identical key — no exchange needed.
 */
export async function deriveSharedKey(myPrivateKey, theirPublicKey) {
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: theirPublicKey },
    myPrivateKey,
    { name: 'AES-GCM', length: 256 },
    false, // not extractable
    ['encrypt', 'decrypt']
  );
}

// ─── Encrypt / Decrypt ────────────────────────────────────────────────────────

/**
 * Encrypt a plaintext string with the shared AES-GCM key.
 * Returns base64-encoded "iv:ciphertext" string.
 */
export async function encryptMessage(sharedKey, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, sharedKey, encoded);
  const ivB64 = btoa(String.fromCharCode(...iv));
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(cipher)));
  return `${ivB64}:${ctB64}`;
}

/**
 * Decrypt a base64 "iv:ciphertext" string back to plaintext.
 * Returns null if decryption fails (e.g. wrong key or corrupted data).
 */
export async function decryptMessage(sharedKey, encryptedPayload) {
  try {
    const [ivB64, ctB64] = encryptedPayload.split(':');
    if (!ivB64 || !ctB64) return null;
    const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
    const ct = Uint8Array.from(atob(ctB64), (c) => c.charCodeAt(0));
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, sharedKey, ct);
    return new TextDecoder().decode(plain);
  } catch {
    return null; // undecryptable (old message, wrong key, etc.)
  }
}

/**
 * Check if a string looks like an encrypted payload (iv:ciphertext in base64).
 */
export function isEncrypted(text) {
  if (!text || typeof text !== 'string') return false;
  const parts = text.split(':');
  if (parts.length !== 2) return false;
  try {
    atob(parts[0]);
    atob(parts[1]);
    return true;
  } catch {
    return false;
  }
}
