import { describe, it, expect, vi, beforeEach } from 'vitest'

beforeEach(() => {
  vi.resetModules()
  // reset sessionStorage
  sessionStorage.clear()
})

describe('getOrCreateClientId', () => {
  it('creates a new id when none exists', async () => {
    const { getOrCreateClientId } = await import('../utils/clientId.js')
    const id = getOrCreateClientId()
    expect(typeof id).toBe('string')
    expect(id.length).toBe(32)
  })
  it('returns the same id on subsequent calls', async () => {
    const { getOrCreateClientId } = await import('../utils/clientId.js')
    const a = getOrCreateClientId()
    const b = getOrCreateClientId()
    expect(a).toBe(b)
  })
})

describe('generateRoomId', () => {
  it('generates a 6-character uppercase room id', async () => {
    const { generateRoomId } = await import('../utils/clientId.js')
    const id = generateRoomId()
    expect(id).toMatch(/^[0-9A-Z]{6}$/)
  })
})
