let audioCtx = null
let muted = false

function getCtx() {
  if (typeof window === 'undefined') return null
  if (!window.AudioContext && !window.webkitAudioContext) return null
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

function tone(freq, duration, type, gain, startOffset = 0) {
  const ctx = getCtx()
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gainNode = ctx.createGain()
  osc.connect(gainNode)
  gainNode.connect(ctx.destination)
  osc.type = type
  osc.frequency.setValueAtTime(freq, ctx.currentTime + startOffset)
  gainNode.gain.setValueAtTime(gain, ctx.currentTime + startOffset)
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startOffset + duration)
  osc.start(ctx.currentTime + startOffset)
  osc.stop(ctx.currentTime + startOffset + duration)
  osc.onended = () => { osc.disconnect(); gainNode.disconnect() }
}

export const SoundEffects = {
  isMuted() { return muted },
  setMuted(val) { muted = val },

  cardSelect() {
    if (muted) return
    tone(880, 0.09, 'sine', 0.12)
  },

  reveal() {
    if (muted) return
    const ctx = getCtx()
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gainNode = ctx.createGain()
    osc.connect(gainNode)
    gainNode.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(220, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(550, ctx.currentTime + 0.28)
    gainNode.gain.setValueAtTime(0.14, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.3)
    osc.onended = () => { osc.disconnect(); gainNode.disconnect() }
  },

  applause() {
    if (muted) return
    const ctx = getCtx()
    if (!ctx) return
    const duration = 3.0
    const buildupEnd = 0.7
    const fadeStart = 2.3
    const t0 = ctx.currentTime
    const clapProgress = t =>
      t < buildupEnd ? t / buildupEnd : t > fadeStart ? (duration - t) / (duration - fadeStart) : 1.0
    ;[
      { center: 400, q: 1.2, peak: 0.12 },
      { center: 1200, q: 1.8, peak: 0.20 },
      { center: 2800, q: 2.2, peak: 0.10 },
    ].forEach(({ center, q, peak }) => {
      const bufSize = Math.ceil(ctx.sampleRate * duration)
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1
      const src = ctx.createBufferSource()
      src.buffer = buf
      const filt = ctx.createBiquadFilter()
      filt.type = 'bandpass'
      filt.frequency.value = center
      filt.Q.value = q
      const ampGain = ctx.createGain()
      ampGain.gain.setValueAtTime(0.001, t0)
      ampGain.gain.linearRampToValueAtTime(peak, t0 + buildupEnd)
      ampGain.gain.setValueAtTime(peak, t0 + fadeStart)
      ampGain.gain.exponentialRampToValueAtTime(0.001, t0 + duration)
      src.connect(filt)
      filt.connect(ampGain)
      ampGain.connect(ctx.destination)
      src.start(t0)
      src.stop(t0 + duration)
      src.onended = () => { src.disconnect(); filt.disconnect(); ampGain.disconnect() }
    })
    const claps = []
    let ct = 0.05
    while (ct < duration) {
      claps.push(ct)
      ct += 0.04 + (1 - clapProgress(ct)) * 0.14 + Math.random() * 0.06
    }
    claps.forEach(offset => {
      const clapDur = 0.02 + Math.random() * 0.025
      const bufSize = Math.ceil(ctx.sampleRate * clapDur)
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1
      const src = ctx.createBufferSource()
      src.buffer = buf
      const filt = ctx.createBiquadFilter()
      filt.type = 'bandpass'
      filt.frequency.value = 1000 + Math.random() * 2000
      filt.Q.value = 0.7 + Math.random() * 0.6
      const peak = (0.06 + Math.random() * 0.08) * Math.max(clapProgress(offset), 0.1)
      const g = ctx.createGain()
      g.gain.setValueAtTime(peak, t0 + offset)
      g.gain.exponentialRampToValueAtTime(0.001, t0 + offset + clapDur)
      src.connect(filt)
      filt.connect(g)
      g.connect(ctx.destination)
      src.start(t0 + offset)
      src.stop(t0 + offset + clapDur)
      src.onended = () => { src.disconnect(); filt.disconnect(); g.disconnect() }
    })
  },
}
