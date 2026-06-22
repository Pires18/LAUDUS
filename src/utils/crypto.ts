const APP_SALT_PREFIX = 'laudus-dicom-v1-';
const ITERATIONS = 100_000;
const ENC_PREFIX = 'enc:v1:';

async function deriveKey(uid: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(uid),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(APP_SALT_PREFIX + uid),
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptPassword(plaintext: string, uid: string): Promise<string> {
  if (!plaintext) return '';
  if (plaintext.startsWith(ENC_PREFIX)) return plaintext;
  const key = await deriveKey(uid);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  const combined = new Uint8Array(iv.byteLength + cipherBuf.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuf), iv.byteLength);
  return ENC_PREFIX + btoa(String.fromCharCode(...combined));
}

export async function decryptPassword(ciphertext: string, uid: string): Promise<string> {
  if (!ciphertext || !ciphertext.startsWith(ENC_PREFIX)) return ciphertext;
  try {
    const key = await deriveKey(uid);
    const raw = Uint8Array.from(atob(ciphertext.slice(ENC_PREFIX.length)), c => c.charCodeAt(0));
    const plain = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: raw.slice(0, 12) },
      key,
      raw.slice(12)
    );
    return new TextDecoder().decode(plain);
  } catch {
    return '';
  }
}

export function isEncrypted(value: string): boolean {
  return value?.startsWith(ENC_PREFIX) ?? false;
}
