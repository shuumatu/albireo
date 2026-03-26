const STORAGE_KEY = 'remembered_credential'
const SALT = 'albireo-remember-me-v1'

function encode(str: string): Uint8Array {
  return new TextEncoder().encode(str)
}

function toBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

function fromBase64(str: string): Uint8Array {
  return Uint8Array.from(atob(str), c => c.charCodeAt(0))
}

async function deriveKey(username: string): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encode(username + SALT),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: encode(SALT), iterations: 10000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 128 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function saveCredential(username: string, password: string): Promise<void> {
  const key = await deriveKey(username)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encode(password))
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    username,
    iv: toBase64(iv),
    ciphertext: toBase64(ciphertext)
  }))
}

export async function loadCredential(): Promise<{ username: string; password: string } | null> {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const { username, iv, ciphertext } = JSON.parse(raw)
    const key = await deriveKey(username)
    const buf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(iv) },
      key,
      fromBase64(ciphertext)
    )
    return { username, password: new TextDecoder().decode(buf) }
  } catch {
    clearCredential()
    return null
  }
}

export function clearCredential(): void {
  localStorage.removeItem(STORAGE_KEY)
}
