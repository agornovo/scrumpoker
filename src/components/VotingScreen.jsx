import React, { useState, useCallback, useRef } from 'react'
import ParticipantList from './ParticipantList.jsx'
import CardSelection from './CardSelection.jsx'
import Statistics from './Statistics.jsx'
import RoundHistory from './RoundHistory.jsx'

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.cssText = 'position:absolute;left:-9999px'
    ta.setAttribute('aria-hidden', 'true')
    document.body.appendChild(ta)
    ta.focus(); ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    return true
  } catch {
    return false
  }
}

export default function VotingScreen({
  roomId,
  userName,
  isObserver,
  socketId,
  roomData,
  selectedVote,
  soundMuted,
  showHostBanner,
  roundHistory,
  voteFlipDelayIncrement,
  voteFlipMaxDelay,
  tadaBounceSettleDelay,
  onVote,
  onReveal,
  onReset,
  onLeave,
  onSetStory,
  onToggleAutoReveal,
  onClaimHost,
  onRemoveParticipant,
  onToggleMute,
}) {
  const [copyRoomIdStatus, setCopyRoomIdStatus] = useState('📋')
  const [copyLinkStatus, setCopyLinkStatus] = useState('🔗')
  const storyTimerRef = useRef(null)

  const users = roomData?.users ?? []
  const revealed = roomData?.revealed ?? false
  const stats = roomData?.stats ?? null
  const creatorId = roomData?.creatorId ?? null
  const cardSet = roomData?.cardSet ?? 'standard'
  const storyTitle = roomData?.storyTitle ?? ''
  const autoReveal = roomData?.autoReveal ?? false
  const specialEffects = roomData?.specialEffects ?? false
  const justRevealed = roomData?.justRevealed ?? false

  const isCreator = creatorId === socketId
  const hasVotes = users.some(u => !u.isObserver && u.vote !== null)

  const handleCopyRoomId = async () => {
    const ok = await copyToClipboard(roomId)
    setCopyRoomIdStatus(ok ? '✓' : '✗')
    setTimeout(() => setCopyRoomIdStatus('📋'), 2000)
  }

  const handleCopyLink = async () => {
    let url
    try {
      const u = new URL(window.location.href)
      u.searchParams.set('room', roomId)
      url = u.toString()
    } catch {
      url = window.location.origin + window.location.pathname + '?room=' + roomId
    }
    const ok = await copyToClipboard(url)
    setCopyLinkStatus(ok ? '✓' : '✗')
    setTimeout(() => setCopyLinkStatus('🔗'), 2000)
  }

  const handleStoryInput = useCallback((e) => {
    clearTimeout(storyTimerRef.current)
    const val = e.target.value
    storyTimerRef.current = setTimeout(() => {
      onSetStory(val)
    }, 300)
  }, [onSetStory])

  return (
    <div id="voting-screen" className="screen">
      <div className="room-info">
        <div className="room-header">
          <div>
            <span className="label">Room ID:</span>
            <span className="room-id-display">{roomId}</span>
            <button className="btn btn-icon" title="Copy room ID to clipboard" onClick={handleCopyRoomId}>
              {copyRoomIdStatus}
            </button>
            <button className="btn btn-icon" title="Copy shareable link" onClick={handleCopyLink}>
              {copyLinkStatus}
            </button>
          </div>
          <button className="btn btn-secondary" onClick={onLeave}>Leave Room</button>
        </div>
      </div>

      {showHostBanner && (
        <div className="become-host-banner">
          <p>The host has left the room. Would you like to take over?</p>
          <button className="btn btn-primary" onClick={onClaimHost}>Become Host</button>
        </div>
      )}

      <div className="story-section">
        <span className="label">Current Story</span>
        {isCreator ? (
          <input
            type="text"
            className="story-title-input"
            placeholder="Enter story title or ticket number..."
            maxLength={200}
            aria-label="Story title"
            defaultValue={storyTitle}
            onInput={handleStoryInput}
          />
        ) : storyTitle ? (
          <div className="story-title-display" aria-live="polite">{storyTitle}</div>
        ) : null}
      </div>

      <ParticipantList
        users={users}
        revealed={revealed}
        justRevealed={justRevealed}
        creatorId={creatorId}
        socketId={socketId}
        specialEffects={specialEffects}
        voteFlipDelayIncrement={voteFlipDelayIncrement}
        voteFlipMaxDelay={voteFlipMaxDelay}
        tadaBounceSettleDelay={tadaBounceSettleDelay}
        onRemove={onRemoveParticipant}
      />

      <CardSelection
        cardSet={cardSet}
        selectedVote={selectedVote}
        revealed={revealed}
        isObserver={isObserver}
        specialEffects={specialEffects}
        onVote={onVote}
      />

      <Statistics stats={stats} revealed={revealed} justRevealed={justRevealed} />

      <div className="action-buttons">
        {isCreator && (
          <label className="auto-reveal-toggle">
            <input
              type="checkbox"
              checked={autoReveal}
              onChange={e => onToggleAutoReveal(e.target.checked)}
            />
            Auto-reveal when all voted
          </label>
        )}
        {isCreator && (
          <button
            className="btn btn-primary"
            disabled={!hasVotes || revealed}
            onClick={onReveal}
          >
            Reveal Cards
          </button>
        )}
        {isCreator && (
          <button
            className="btn btn-secondary"
            disabled={!revealed}
            onClick={onReset}
          >
            New Round
          </button>
        )}
        {specialEffects && (
          <button
            className="btn btn-secondary"
            aria-label={soundMuted ? 'Unmute sound effects' : 'Mute sound effects'}
            title={soundMuted ? 'Unmute sound effects' : 'Mute sound effects'}
            onClick={onToggleMute}
          >
            {soundMuted ? '🔇 Sounds off' : '🔊 Sounds on'}
          </button>
        )}
      </div>

      <RoundHistory rounds={roundHistory} />
    </div>
  )
}
