import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useTheme } from './hooks/useTheme.js'
import { useSocket, saveSession, loadSession, clearSession, getSoundMuted, setSoundMuted } from './hooks/useSocket.js'
import { getOrCreateClientId, generateRoomId } from './utils/clientId.js'
import { SoundEffects } from './utils/soundEffects.js'
import { triggerConfetti } from './utils/confetti.js'
import Header from './components/Header.jsx'
import WelcomeScreen from './components/WelcomeScreen.jsx'
import VotingScreen from './components/VotingScreen.jsx'

const VOTE_FLIP_DELAY_INCREMENT_MS = 200
const VOTE_FLIP_MAX_DELAY_MS = 1200
const MIN_VOTERS_FOR_CONSENSUS = 2
const TADA_BOUNCE_SETTLE_DELAY_MS = 900

const clientId = getOrCreateClientId()

export default function App() {
  const { theme, palette, toggleTheme, setPalette } = useTheme()

  // Session state
  const [screen, setScreen] = useState('welcome') // 'welcome' | 'voting'
  const [currentRoomId, setCurrentRoomId] = useState(null)
  const [currentUserName, setCurrentUserName] = useState(null)
  const [isObserver, setIsObserver] = useState(false)

  // Room state from server
  const [roomData, setRoomData] = useState(null)

  // Local UI state
  const [selectedVote, setSelectedVote] = useState(null)
  const [soundMuted, setSoundMutedState] = useState(() => getSoundMuted())
  const [showHostBanner, setShowHostBanner] = useState(false)
  const [roundHistory, setRoundHistory] = useState([])
  const roundNumberRef = useRef(0)
  const wasRevealedRef = useRef(false)

  useEffect(() => {
    SoundEffects.setMuted(soundMuted)
    setSoundMuted(soundMuted)
  }, [soundMuted])

  const handleRoomUpdate = useCallback((data) => {
    const justRevealed = data.revealed && !wasRevealedRef.current
    wasRevealedRef.current = data.revealed

    setRoomData(() => ({ ...data, justRevealed }))

    if (justRevealed && data.stats) {
      roundNumberRef.current += 1
      setRoundHistory(prev => [...prev, {
        round: roundNumberRef.current,
        title: data.storyTitle || '',
        stats: { ...data.stats },
      }])
    }

    if (justRevealed && data.specialEffects) {
      SoundEffects.reveal()
      const voters = data.users.filter(u => !u.isObserver && u.vote !== null)
      const isConsensus = voters.length >= MIN_VOTERS_FOR_CONSENSUS && data.stats?.min === data.stats?.max
      if (isConsensus) {
        triggerConfetti(true, { applause: () => SoundEffects.applause() })
      }
    }

    if (data.users.some(u => u.id === data.creatorId)) {
      setShowHostBanner(false)
    }
  }, [])

  const handleRemovedFromRoom = useCallback(() => {
    clearSession()
    alert('You have been removed from the room by the room creator.')
    setScreen('welcome')
    setCurrentRoomId(null)
    setCurrentUserName(null)
    setSelectedVote(null)
    setRoomData(null)
    setRoundHistory([])
    roundNumberRef.current = 0
    wasRevealedRef.current = false
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('room')
      window.history.replaceState(null, '', url.toString())
    } catch { /**/ }
  }, [])

  const handleHostAbsent = useCallback(() => {
    setShowHostBanner(true)
  }, [])

  const { emit, getSocketId, reconnect } = useSocket({
    clientId,
    onRoomUpdate: handleRoomUpdate,
    onRemovedFromRoom: handleRemovedFromRoom,
    onHostAbsent: handleHostAbsent,
  })

  // Auto-rejoin on connect (page refresh)
  useEffect(() => {
    const session = loadSession()
    if (session?.roomId && session?.userName) {
      setCurrentRoomId(session.roomId)
      setCurrentUserName(session.userName)
      setIsObserver(session.isObserver || false)
      emit('join-room', {
        roomId: session.roomId,
        userName: session.userName,
        isObserver: session.isObserver || false,
        cardSet: session.cardSet || 'standard',
        clientId,
      })
      setScreen('voting')
      try {
        const url = new URL(window.location.href)
        url.searchParams.set('room', session.roomId)
        window.history.replaceState(null, '', url.toString())
      } catch { /**/ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleJoin = useCallback(({ userName, roomId, isObserver: obs, cardSet, specialEffects }) => {
    const rid = roomId || generateRoomId()
    setCurrentRoomId(rid)
    setCurrentUserName(userName)
    setIsObserver(obs)
    emit('join-room', { roomId: rid, userName, isObserver: obs, cardSet, specialEffects, clientId })
    saveSession({ roomId: rid, userName, isObserver: obs, cardSet })
    try {
      const url = new URL(window.location.href)
      url.searchParams.set('room', rid)
      window.history.replaceState(null, '', url.toString())
    } catch { /**/ }
    setScreen('voting')
  }, [emit])

  const handleLeave = useCallback(() => {
    clearSession()
    reconnect()
    setScreen('welcome')
    setCurrentRoomId(null)
    setCurrentUserName(null)
    setSelectedVote(null)
    setRoomData(null)
    setRoundHistory([])
    roundNumberRef.current = 0
    wasRevealedRef.current = false
    setShowHostBanner(false)
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('room')
      window.history.replaceState(null, '', url.toString())
    } catch { /**/ }
  }, [reconnect])

  const handleVote = useCallback((vote) => {
    setSelectedVote(vote)
    emit('vote', { roomId: currentRoomId, vote })
  }, [currentRoomId, emit])

  const handleReveal = useCallback(() => {
    emit('reveal', { roomId: currentRoomId })
  }, [currentRoomId, emit])

  const handleReset = useCallback(() => {
    emit('reset', { roomId: currentRoomId })
    setSelectedVote(null)
  }, [currentRoomId, emit])

  const handleSetStory = useCallback((storyTitle) => {
    emit('set-story', { roomId: currentRoomId, storyTitle })
  }, [currentRoomId, emit])

  const handleToggleAutoReveal = useCallback((autoReveal) => {
    emit('toggle-auto-reveal', { roomId: currentRoomId, autoReveal })
  }, [currentRoomId, emit])

  const handleClaimHost = useCallback(() => {
    emit('claim-host', { roomId: currentRoomId })
    setShowHostBanner(false)
  }, [currentRoomId, emit])

  const handleRemoveParticipant = useCallback((participantId) => {
    emit('remove-participant', { roomId: currentRoomId, participantId })
  }, [currentRoomId, emit])

  const handleToggleMute = useCallback(() => {
    setSoundMutedState(m => !m)
  }, [])

  return (
    <div className="container">
      <Header
        theme={theme}
        palette={palette}
        onToggleTheme={toggleTheme}
        onSetPalette={setPalette}
      />
      {screen === 'welcome' && (
        <WelcomeScreen onJoin={handleJoin} />
      )}
      {screen === 'voting' && (
        <VotingScreen
          roomId={currentRoomId}
          userName={currentUserName}
          isObserver={isObserver}
          socketId={getSocketId()}
          roomData={roomData}
          selectedVote={selectedVote}
          soundMuted={soundMuted}
          showHostBanner={showHostBanner}
          roundHistory={roundHistory}
          voteFlipDelayIncrement={VOTE_FLIP_DELAY_INCREMENT_MS}
          voteFlipMaxDelay={VOTE_FLIP_MAX_DELAY_MS}
          tadaBounceSettleDelay={TADA_BOUNCE_SETTLE_DELAY_MS}
          onVote={handleVote}
          onReveal={handleReveal}
          onReset={handleReset}
          onLeave={handleLeave}
          onSetStory={handleSetStory}
          onToggleAutoReveal={handleToggleAutoReveal}
          onClaimHost={handleClaimHost}
          onRemoveParticipant={handleRemoveParticipant}
          onToggleMute={handleToggleMute}
        />
      )}
      <footer>
        <p>
          Made with ❤️ for Agile Teams
          <span className="footer-separator">•</span>
          <a
            href="https://github.com/agornovo/scrumpoker"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            Source Code
          </a>
        </p>
      </footer>
    </div>
  )
}
