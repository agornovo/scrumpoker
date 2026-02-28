const CLIENT_ID_KEY = 'scrumpoker-client-id'

export function getOrCreateClientId() {
  try {
    let id = sessionStorage.getItem(CLIENT_ID_KEY)
    if (!id) {
      const bytes = new Uint8Array(16)
      ;(window.crypto || window.msCrypto).getRandomValues(bytes)
      id = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
      sessionStorage.setItem(CLIENT_ID_KEY, id)
    }
    return id
  } catch {
    const bytes = new Uint8Array(16)
    ;(window.crypto || window.msCrypto).getRandomValues(bytes)
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  }
}

export function generateRoomId() {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const bytes = new Uint8Array(6)
  ;(window.crypto || window.msCrypto).getRandomValues(bytes)
  return Array.from(bytes).map(b => alphabet[b % alphabet.length]).join('')
}
