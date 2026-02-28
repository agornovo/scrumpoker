import { useEffect, useRef, useState, useCallback } from 'react'
import { io } from 'socket.io-client'

const SESSION_KEY = 'scrumpoker-session'
const SOUND_MUTED_KEY = 'scrumpoker-sound-muted'

export function useSocket({ clientId, onRoomUpdate, onRemovedFromRoom, onHostAbsent }) {
  const socketRef = useRef(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const socket = io()
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      console.log('Connected to server')
    })
    socket.on('disconnect', () => {
      setConnected(false)
      console.log('Disconnected from server')
    })
    socket.on('connect_error', err => {
      console.error('Connection error:', err)
    })
    socket.on('room-update', data => onRoomUpdate?.(data))
    socket.on('removed-from-room', data => onRemovedFromRoom?.(data))
    socket.on('host-absent', data => onHostAbsent?.(data))

    return () => { socket.disconnect() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const emit = useCallback((event, data) => {
    socketRef.current?.emit(event, data)
  }, [])

  const getSocketId = useCallback(() => socketRef.current?.id, [])

  const reconnect = useCallback(() => {
    socketRef.current?.disconnect()
    socketRef.current?.connect()
  }, [])

  return { connected, emit, getSocketId, reconnect }
}

export function saveSession(data) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(data)) } catch { /**/ }
}
export function loadSession() {
  try {
    const s = sessionStorage.getItem(SESSION_KEY)
    return s ? JSON.parse(s) : null
  } catch { return null }
}
export function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY) } catch { /**/ }
}

export function getSoundMuted() {
  try { return localStorage.getItem(SOUND_MUTED_KEY) === 'true' } catch { return false }
}
export function setSoundMuted(val) {
  try { localStorage.setItem(SOUND_MUTED_KEY, String(val)) } catch { /**/ }
}
