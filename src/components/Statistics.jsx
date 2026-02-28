import React, { useEffect, useRef } from 'react'

export default function Statistics({ stats, revealed, justRevealed }) {
  const ref = useRef(null)

  useEffect(() => {
    if (justRevealed && ref.current) {
      ref.current.classList.add('animate-in')
      const el = ref.current
      el.addEventListener('animationend', () => el.classList.remove('animate-in'), { once: true })
    }
  }, [justRevealed])

  if (!revealed || !stats) return null

  return (
    <div ref={ref} className="statistics">
      <h3><span aria-label="Statistics">📊</span> Results</h3>
      <div className="stats-grid">
        <div className="stat-item">
          <div className="stat-label">Average</div>
          <div className="stat-value">{stats.average}</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Median</div>
          <div className="stat-value">{stats.median}</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Min</div>
          <div className="stat-value">{stats.min}</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Max</div>
          <div className="stat-value">{stats.max}</div>
        </div>
      </div>
    </div>
  )
}
