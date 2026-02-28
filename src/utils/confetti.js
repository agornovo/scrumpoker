const CONFETTI_PARTICLE_COUNT = 80
const CONFETTI_SUPER_MULTIPLIER = 3
const CONFETTI_DELAY_MAX_S = 1.2
const CONFETTI_SUPER_DELAY_MAX_S = 2.4
const FIREWORK_BURST_COUNT = 5
const FIREWORK_SPARKS_PER_BURST = 20
const FIREWORK_BURST_DELAY_MS = 380

export function triggerFireworks() {
  const style = getComputedStyle(document.documentElement)
  const allColors = [
    style.getPropertyValue('--primary-color').trim(),
    '#e74c3c', '#f39c12', '#3498db', '#9b59b6', '#e91e63', '#00bcd4', '#8bc34a', '#ff6f00',
  ]
  for (let b = 0; b < FIREWORK_BURST_COUNT; b++) {
    setTimeout(() => {
      const x = 15 + Math.random() * 70
      const y = 10 + Math.random() * 55
      const color = allColors[Math.floor(Math.random() * allColors.length)]
      for (let s = 0; s < FIREWORK_SPARKS_PER_BURST; s++) {
        const spark = document.createElement('div')
        spark.className = 'firework-spark'
        const angle = (360 / FIREWORK_SPARKS_PER_BURST) * s
        const distance = Math.random() * 60 + 40
        const size = Math.random() * 5 + 3
        const dur = Math.random() * 0.3 + 0.45
        spark.style.cssText = `left:${x}vw;top:${y}vh;width:${size}px;height:${size}px;background:${color};--angle:${angle}deg;--distance:${distance}px;animation-duration:${dur}s;`
        document.body.appendChild(spark)
        spark.addEventListener('animationend', () => spark.remove())
      }
    }, b * FIREWORK_BURST_DELAY_MS)
  }
}

export function triggerConfetti(superMode = false, { applause } = {}) {
  const style = getComputedStyle(document.documentElement)
  const primaryColor = style.getPropertyValue('--primary-color').trim()
  const successColor = style.getPropertyValue('--success-color').trim()
  const warningColor = style.getPropertyValue('--warning-color').trim()
  const colors = [primaryColor, successColor, warningColor, '#e74c3c', '#f39c12', '#3498db', '#9b59b6', '#e91e63']
  const count = superMode ? CONFETTI_PARTICLE_COUNT * CONFETTI_SUPER_MULTIPLIER : CONFETTI_PARTICLE_COUNT
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div')
    el.className = 'confetti-particle'
    const color = colors[Math.floor(Math.random() * colors.length)]
    const size = Math.random() * 8 + 6
    const left = Math.random() * 100
    const duration = Math.random() * 2 + 2.5
    const delay = Math.random() * (superMode ? CONFETTI_SUPER_DELAY_MAX_S : CONFETTI_DELAY_MAX_S)
    const isCircle = Math.random() > 0.4
    el.style.cssText = `left:${left}vw;width:${size}px;height:${size}px;background:${color};border-radius:${isCircle ? '50%' : '2px'};animation-duration:${duration}s;animation-delay:${delay}s;`
    document.body.appendChild(el)
    el.addEventListener('animationend', () => el.remove())
  }
  if (superMode) {
    triggerFireworks()
    if (applause) applause()
  }
}
