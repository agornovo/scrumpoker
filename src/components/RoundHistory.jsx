import React from 'react'

export default function RoundHistory({ rounds }) {
  if (!rounds || rounds.length === 0) return null

  return (
    <div className="round-history">
      <h3>📜 Round History</h3>
      <div className="round-history-list">
        {[...rounds].reverse().map(entry => (
          <div key={entry.round} className="round-history-item">
            <div className="round-number">Round {entry.round}</div>
            <div className="round-title" title={entry.title || ''}>{entry.title || '(no title)'}</div>
            <div className="round-stats">
              <span><strong>{entry.stats.average}</strong>avg</span>
              <span><strong>{entry.stats.min}</strong>min</span>
              <span><strong>{entry.stats.max}</strong>max</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
