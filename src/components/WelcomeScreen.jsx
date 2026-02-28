import React, { useState, useEffect } from 'react'

export default function WelcomeScreen({ onJoin }) {
  const [userName, setUserName] = useState('')
  const [roomId, setRoomId] = useState('')
  const [isObserver, setIsObserver] = useState(false)
  const [cardSet, setCardSet] = useState('standard')
  const [specialEffects, setSpecialEffects] = useState(false)

  // Pre-fill room ID from URL query param
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const urlRoom = params.get('room')
      if (urlRoom) setRoomId(urlRoom.toUpperCase())
    } catch { /**/ }
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    const name = userName.trim()
    if (!name) { alert('Please enter your name'); return }
    onJoin({ userName: name, roomId: roomId.trim(), isObserver, cardSet, specialEffects })
  }

  return (
    <div id="welcome-screen" className="screen">
      <div className="card welcome-card">
        <h2>Welcome to Scrum Poker</h2>
        <p>Plan and estimate your stories together in real-time</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="user-name">Your Name</label>
            <input
              type="text"
              id="user-name"
              placeholder="Enter your name"
              value={userName}
              onChange={e => setUserName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="room-id">Room ID</label>
            <input
              type="text"
              id="room-id"
              placeholder="Enter room ID or leave blank to create"
              value={roomId}
              onChange={e => setRoomId(e.target.value)}
            />
          </div>
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                id="is-observer"
                checked={isObserver}
                onChange={e => setIsObserver(e.target.checked)}
              />
              Join as Observer (won't vote)
            </label>
          </div>
          <div className="form-group">
            <label htmlFor="card-set">
              Card Set <span className="form-hint">(applies when creating a new room)</span>
            </label>
            <select id="card-set" value={cardSet} onChange={e => setCardSet(e.target.value)}>
              <option value="standard">Standard [1, 2, 3, 5, 8, 13, 20, 40, 100, ?]</option>
              <option value="fibonacci">Fibonacci [0, ½, 1, 2, 3, 5, 8, 13, 21, 34, 55, ?, ☕]</option>
              <option value="tshirt">T-Shirt Sizes [XS, S, M, L, XL, XXL, ?]</option>
              <option value="powers2">Powers of 2 [1, 2, 4, 8, 16, 32, 64, ?]</option>
            </select>
          </div>
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                id="special-effects"
                checked={specialEffects}
                onChange={e => setSpecialEffects(e.target.checked)}
              />
              🎉 Enable special effects <span className="form-hint">(applies when creating a new room)</span>
            </label>
          </div>
          <button type="submit" className="btn btn-primary btn-large">Join Room</button>
        </form>
        <div className="help-text">
          <p>💡 <strong>Tip:</strong> Share the Room ID with your team to collaborate</p>
        </div>
        <section className="help-section" aria-labelledby="help-title">
          <h3 id="help-title">How Scrum Poker helps your team</h3>
          <details>
            <summary>How to use the app</summary>
            <p>Join with your name, share the room ID, pick a card, then reveal together to discuss differences and align.</p>
          </details>
          <details>
            <summary>Purpose of Scrum Poker</summary>
            <p>It gives everyone an equal voice in effort discussions and helps teams find shared understanding before building.</p>
          </details>
          <details>
            <summary>Why Fibonacci numbers</summary>
            <p>Uncertainty grows with size. Fibonacci spacing (1, 2, 3, 5, 8, 13...) reflects that larger work is harder to estimate precisely.</p>
          </details>
          <details>
            <summary>Why estimate with story points</summary>
            <p>Story points measure relative complexity and risk instead of hours, making planning more consistent across different team members.</p>
          </details>
        </section>
      </div>
    </div>
  )
}
