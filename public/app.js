// Socket.io connection
const socket = io();

// UI Elements
const welcomeScreen = document.getElementById('welcome-screen');
const votingScreen = document.getElementById('voting-screen');
const themeToggleBtn = document.getElementById('theme-toggle');
const userNameInput = document.getElementById('user-name');
const roomIdInput = document.getElementById('room-id');
const isObserverCheckbox = document.getElementById('is-observer');
const cardSetSelect = document.getElementById('card-set');
const joinBtn = document.getElementById('join-btn');
const currentRoomIdDisplay = document.getElementById('current-room-id');
const copyRoomIdBtn = document.getElementById('copy-room-id');
const copyShareLinkBtn = document.getElementById('copy-share-link');
const leaveRoomBtn = document.getElementById('leave-room');
const participantsList = document.getElementById('participants-list');
const participantCount = document.getElementById('participant-count');
const cardSelection = document.getElementById('card-selection');
const cardsContainer = document.getElementById('cards-container');
const revealBtn = document.getElementById('reveal-btn');
const resetBtn = document.getElementById('reset-btn');
const statistics = document.getElementById('statistics');
const statAvg = document.getElementById('stat-avg');
const statMedian = document.getElementById('stat-median');
const statMin = document.getElementById('stat-min');
const statMax = document.getElementById('stat-max');
const storySection = document.getElementById('story-section');
const storyTitleInput = document.getElementById('story-title-input');
const storyTitleDisplay = document.getElementById('story-title-display');
const autoRevealToggle = document.getElementById('auto-reveal-toggle');
const autoRevealCheckbox = document.getElementById('auto-reveal-checkbox');
const specialEffectsCheckbox = document.getElementById('special-effects');
const muteSoundBtn = document.getElementById('mute-sound-btn');
const roundHistorySection = document.getElementById('round-history');
const roundHistoryList = document.getElementById('round-history-list');
const becomeHostBanner = document.getElementById('become-host-banner');
const becomeHostBtn = document.getElementById('become-host-btn');

// Card deck definitions
const CARD_DECKS = {
  standard: {
    label: 'Standard [1-100]',
    cards: [
      { value: 1, label: '1' },
      { value: 2, label: '2' },
      { value: 3, label: '3' },
      { value: 5, label: '5' },
      { value: 8, label: '8' },
      { value: 13, label: '13' },
      { value: 20, label: '20' },
      { value: 40, label: '40' },
      { value: 100, label: '100' },
      { value: '?', label: '?', special: true }
    ]
  },
  fibonacci: {
    label: 'Fibonacci',
    cards: [
      { value: 0, label: '0' },
      { value: 0.5, label: '½' },
      { value: 1, label: '1' },
      { value: 2, label: '2' },
      { value: 3, label: '3' },
      { value: 5, label: '5' },
      { value: 8, label: '8' },
      { value: 13, label: '13' },
      { value: 21, label: '21' },
      { value: 34, label: '34' },
      { value: 55, label: '55' },
      { value: '?', label: '?', special: true },
      { value: '☕', label: '☕', special: true }
    ]
  },
  tshirt: {
    label: 'T-Shirt Sizes',
    cards: [
      { value: 'XS', label: 'XS' },
      { value: 'S', label: 'S' },
      { value: 'M', label: 'M' },
      { value: 'L', label: 'L' },
      { value: 'XL', label: 'XL' },
      { value: 'XXL', label: 'XXL' },
      { value: '?', label: '?', special: true }
    ]
  },
  powers2: {
    label: 'Powers of 2',
    cards: [
      { value: 1, label: '1' },
      { value: 2, label: '2' },
      { value: 4, label: '4' },
      { value: 8, label: '8' },
      { value: 16, label: '16' },
      { value: 32, label: '32' },
      { value: 64, label: '64' },
      { value: '?', label: '?', special: true }
    ]
  }
};

// Render the card buttons for a given deck key
function renderCards(deckKey) {
  const deck = CARD_DECKS[deckKey] || CARD_DECKS.standard;
  cardsContainer.innerHTML = '';
  deck.cards.forEach(card => {
    const btn = document.createElement('button');
    btn.className = 'card-button' + (card.special ? ' card-special' : '');
    btn.dataset.value = card.value;
    btn.textContent = card.label;
    cardsContainer.appendChild(btn);
  });
}

// Clear all card selections
function clearCardSelection() {
  cardsContainer.querySelectorAll('.card-button').forEach(btn => btn.classList.remove('selected'));
}

// Animation constants
const CONFETTI_PARTICLE_COUNT = 80;
const CONFETTI_SUPER_MULTIPLIER = 3;
const CONFETTI_DELAY_MAX_S = 1.2;
const CONFETTI_SUPER_DELAY_MAX_S = 2.4;
const VOTE_FLIP_DELAY_INCREMENT_MS = 200;
const VOTE_FLIP_MAX_DELAY_MS = 1200;
const MIN_VOTERS_FOR_CONSENSUS = 2;
const FIREWORK_BURST_COUNT = 5;
const FIREWORK_SPARKS_PER_BURST = 20;
const FIREWORK_BURST_DELAY_MS = 380;
const TADA_BOUNCE_SETTLE_DELAY_MS = 900;

// Sound effects synthesised via Web Audio API – no audio files required
const SoundEffects = (() => {
  let audioCtx = null;
  let muted = false;

  function getCtx() {
    if (!window.AudioContext && !window.webkitAudioContext) return null;
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function tone(freq, duration, type, gain, startOffset = 0) {
    const ctx = getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + startOffset);
    gainNode.gain.setValueAtTime(gain, ctx.currentTime + startOffset);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startOffset + duration);
    osc.start(ctx.currentTime + startOffset);
    osc.stop(ctx.currentTime + startOffset + duration);
    osc.onended = () => { osc.disconnect(); gainNode.disconnect(); };
  }

  return {
    isMuted() { return muted; },
    setMuted(val) { muted = val; },

    // Soft "pip" when picking a card
    cardSelect() {
      if (muted) return;
      tone(880, 0.09, 'sine', 0.12);
    },

    // Quick ascending whoosh when votes are revealed
    reveal() {
      if (muted) return;
      const ctx = getCtx();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(550, ctx.currentTime + 0.28);
      gainNode.gain.setValueAtTime(0.14, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
      osc.onended = () => { osc.disconnect(); gainNode.disconnect(); };
    },

    // Applause for fireworks/confetti consensus celebration – 3 s, natural buildup and fade
    applause() {
      if (muted) return;
      const ctx = getCtx();
      if (!ctx) return;
      const duration = 3.0;
      const buildupEnd = 0.7;   // seconds until full volume
      const fadeStart  = 2.3;   // seconds when fade begins
      const t0 = ctx.currentTime;
      const clapProgress = t => t < buildupEnd ? t / buildupEnd : (t > fadeStart ? (duration - t) / (duration - fadeStart) : 1.0);
      // Crowd noise base: three bandpass-filtered white-noise bands
      [
        { center: 400,  q: 1.2, peak: 0.12 },
        { center: 1200, q: 1.8, peak: 0.20 },
        { center: 2800, q: 2.2, peak: 0.10 },
      ].forEach(({ center, q, peak }) => {
        const bufSize = Math.ceil(ctx.sampleRate * duration);
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const filt = ctx.createBiquadFilter();
        filt.type = 'bandpass';
        filt.frequency.value = center;
        filt.Q.value = q;
        const ampGain = ctx.createGain();
        ampGain.gain.setValueAtTime(0.001, t0);
        ampGain.gain.linearRampToValueAtTime(peak, t0 + buildupEnd);
        ampGain.gain.setValueAtTime(peak, t0 + fadeStart);
        ampGain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
        src.connect(filt);
        filt.connect(ampGain);
        ampGain.connect(ctx.destination);
        src.start(t0);
        src.stop(t0 + duration);
        src.onended = () => { src.disconnect(); filt.disconnect(); ampGain.disconnect(); };
      });
      // Stochastic clap impulses: sparse at start, dense at peak, thinning at end
      const claps = [];
      let ct = 0.05;
      while (ct < duration) {
        claps.push(ct);
        ct += 0.04 + (1 - clapProgress(ct)) * 0.14 + Math.random() * 0.06;
      }
      claps.forEach(offset => {
        const clapDur = 0.02 + Math.random() * 0.025;
        const bufSize = Math.ceil(ctx.sampleRate * clapDur);
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const filt = ctx.createBiquadFilter();
        filt.type = 'bandpass';
        filt.frequency.value = 1000 + Math.random() * 2000;
        filt.Q.value = 0.7 + Math.random() * 0.6;
        const peak = (0.06 + Math.random() * 0.08) * Math.max(clapProgress(offset), 0.1);
        const g = ctx.createGain();
        g.gain.setValueAtTime(peak, t0 + offset);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + offset + clapDur);
        src.connect(filt);
        filt.connect(g);
        g.connect(ctx.destination);
        src.start(t0 + offset);
        src.stop(t0 + offset + clapDur);
        src.onended = () => { src.disconnect(); filt.disconnect(); g.disconnect(); };
      });
    }
  };
})();

// Launch confetti celebration (palette-aware + classic colors)
function triggerConfetti(superMode = false) {
  const style = getComputedStyle(document.documentElement);
  const primaryColor = style.getPropertyValue('--primary-color').trim();
  const successColor = style.getPropertyValue('--success-color').trim();
  const warningColor = style.getPropertyValue('--warning-color').trim();
  const colors = [primaryColor, successColor, warningColor, '#e74c3c', '#f39c12', '#3498db', '#9b59b6', '#e91e63'];

  const count = superMode ? CONFETTI_PARTICLE_COUNT * CONFETTI_SUPER_MULTIPLIER : CONFETTI_PARTICLE_COUNT;
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-particle';
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = Math.random() * 8 + 6;
    const left = Math.random() * 100;
    const duration = Math.random() * 2 + 2.5;
    const delay = Math.random() * (superMode ? CONFETTI_SUPER_DELAY_MAX_S : CONFETTI_DELAY_MAX_S);
    const isCircle = Math.random() > 0.4;
    el.style.cssText = `left:${left}vw;width:${size}px;height:${size}px;background:${color};border-radius:${isCircle ? '50%' : '2px'};animation-duration:${duration}s;animation-delay:${delay}s;`;
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }

  if (superMode) {
    triggerFireworks();
    SoundEffects.applause();
  }
}

// Firework burst explosions at random screen positions
function triggerFireworks() {
  const style = getComputedStyle(document.documentElement);
  const allColors = [
    style.getPropertyValue('--primary-color').trim(),
    '#e74c3c', '#f39c12', '#3498db', '#9b59b6', '#e91e63', '#00bcd4', '#8bc34a', '#ff6f00'
  ];

  for (let b = 0; b < FIREWORK_BURST_COUNT; b++) {
    setTimeout(() => {
      const x = 15 + Math.random() * 70;
      const y = 10 + Math.random() * 55;
      const color = allColors[Math.floor(Math.random() * allColors.length)];
      for (let s = 0; s < FIREWORK_SPARKS_PER_BURST; s++) {
        const spark = document.createElement('div');
        spark.className = 'firework-spark';
        const angle = (360 / FIREWORK_SPARKS_PER_BURST) * s;
        const distance = Math.random() * 60 + 40;
        const size = Math.random() * 5 + 3;
        const dur = Math.random() * 0.3 + 0.45;
        spark.style.cssText = `left:${x}vw;top:${y}vh;width:${size}px;height:${size}px;background:${color};--angle:${angle}deg;--distance:${distance}px;animation-duration:${dur}s;`;
        document.body.appendChild(spark);
        spark.addEventListener('animationend', () => spark.remove());
      }
    }, b * FIREWORK_BURST_DELAY_MS);
  }
}

// Brief sparkle glow on the selected card button
function triggerCardSparkle(buttonEl) {
  buttonEl.classList.add('card-sparkle');
  buttonEl.addEventListener('animationend', () => buttonEl.classList.remove('card-sparkle'), { once: true });
  SoundEffects.cardSelect();
}

// State
let currentRoomId = null;
let currentUserName = null;
let isObserver = false;
let isRevealed = false;
let selectedVote = null;
let currentCardSet = 'standard';
let wasRevealed = false;
let specialEffectsEnabled = false;
let isCreator = false;
let roundHistory = [];
let roundNumber = 0;
const THEME_STORAGE_KEY = 'scrumpoker-theme';
const PALETTE_STORAGE_KEY = 'scrumpoker-palette';
const SOUND_MUTED_STORAGE_KEY = 'scrumpoker-sound-muted';
const SESSION_STORAGE_KEY = 'scrumpoker-session';
const CLIENT_ID_STORAGE_KEY = 'scrumpoker-client-id';

// Per-tab client ID used by the server to restore sessions after a page refresh
let clientId;
try {
  clientId = sessionStorage.getItem(CLIENT_ID_STORAGE_KEY);
  if (!clientId) {
    const bytes = new Uint8Array(16);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    clientId = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem(CLIENT_ID_STORAGE_KEY, clientId);
  }
} catch (e) {
  const bytes = new Uint8Array(16);
  (window.crypto || window.msCrypto).getRandomValues(bytes);
  clientId = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Persist the current room session so it can be restored after a page refresh
function saveSession() {
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
      roomId: currentRoomId,
      userName: currentUserName,
      isObserver
    }));
  } catch (e) { /* ignore */ }
}

// Remove the saved session (called on intentional leave or when removed from room)
function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (e) { /* ignore */ }
}

// Initialize cards with the default deck
renderCards(currentCardSet);

function setTheme(theme) {
  const isDark = theme === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  themeToggleBtn.textContent = isDark ? 'Light theme' : 'Dark theme';
  themeToggleBtn.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
}

const paletteSwatches = document.querySelectorAll('.palette-swatch');

function setPalette(palette) {
  document.documentElement.setAttribute('data-palette', palette);
  paletteSwatches.forEach(btn => {
    btn.setAttribute('aria-pressed', btn.dataset.palette === palette ? 'true' : 'false');
  });
}

const prefersDarkTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
let savedTheme = null;
try {
  savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
} catch (error) {
  console.warn('Theme preference could not be read:', error);
  savedTheme = null;
}
setTheme(savedTheme || (prefersDarkTheme ? 'dark' : 'light'));

let savedPalette = null;
try {
  savedPalette = localStorage.getItem(PALETTE_STORAGE_KEY);
} catch (error) {
  console.warn('Palette preference could not be read:', error);
}
setPalette(savedPalette || 'ocean');

themeToggleBtn.addEventListener('click', () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const nextTheme = isDark ? 'light' : 'dark';
  setTheme(nextTheme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  } catch (error) {
    console.warn('Theme preference could not be saved:', error);
  }
});

paletteSwatches.forEach(btn => {
  btn.addEventListener('click', () => {
    const palette = btn.dataset.palette;
    setPalette(palette);
    try {
      localStorage.setItem(PALETTE_STORAGE_KEY, palette);
    } catch (error) {
      console.warn('Palette preference could not be saved:', error);
    }
  });
});

// Mute sound button initialization
function updateMuteButton() {
  const muted = SoundEffects.isMuted();
  muteSoundBtn.textContent = muted ? '🔇 Sounds off' : '🔊 Sounds on';
  const label = muted ? 'Unmute sound effects' : 'Mute sound effects';
  muteSoundBtn.setAttribute('aria-label', label);
  muteSoundBtn.setAttribute('title', label);
}

let savedSoundMuted = false;
try {
  savedSoundMuted = localStorage.getItem(SOUND_MUTED_STORAGE_KEY) === 'true';
} catch (error) {
  console.warn('Sound mute preference could not be read:', error);
}
SoundEffects.setMuted(savedSoundMuted);
updateMuteButton();

muteSoundBtn.addEventListener('click', () => {
  SoundEffects.setMuted(!SoundEffects.isMuted());
  updateMuteButton();
  try {
    localStorage.setItem(SOUND_MUTED_STORAGE_KEY, SoundEffects.isMuted());
  } catch (error) {
    console.warn('Sound mute preference could not be saved:', error);
  }
});

// Pre-fill room ID from URL query param (?room=XXXXX) for link sharing
try {
  const urlParams = new URLSearchParams(window.location.search);
  const urlRoomId = urlParams.get('room');
  if (urlRoomId) {
    roomIdInput.value = urlRoomId.toUpperCase();
  }
} catch (e) {
  // URL parsing not supported or not applicable
}

// Generate a random room ID
function generateRoomId() {
  // Use cryptographically secure randomness for room IDs
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const idLength = 6;
  const bytes = new Uint8Array(idLength);
  (window.crypto || window.msCrypto).getRandomValues(bytes);

  let result = '';
  for (let i = 0; i < idLength; i++) {
    // Map byte (0-255) uniformly into 0-35 using modulo
    const index = bytes[i] % alphabet.length;
    result += alphabet.charAt(index);
  }
  return result;
}

// Join room
joinBtn.addEventListener('click', () => {
  const userName = userNameInput.value.trim();
  if (!userName) {
    alert('Please enter your name');
    return;
  }

  currentUserName = userName;
  isObserver = isObserverCheckbox.checked;
  currentRoomId = roomIdInput.value.trim() || generateRoomId();

  socket.emit('join-room', {
    roomId: currentRoomId,
    userName: currentUserName,
    isObserver: isObserver,
    cardSet: cardSetSelect.value,
    specialEffects: specialEffectsCheckbox.checked,
    clientId
  });

  // Update URL with room ID for easy link sharing
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('room', currentRoomId);
    window.history.replaceState(null, '', url.toString());
  } catch (e) {
    // URL API not available
  }

  // Show voting screen
  welcomeScreen.classList.add('hidden');
  votingScreen.classList.remove('hidden');
  votingScreen.classList.add('screen-enter');
  votingScreen.addEventListener('animationend', () => votingScreen.classList.remove('screen-enter'), { once: true });
  currentRoomIdDisplay.textContent = currentRoomId;

  // Hide card selection for observers
  if (isObserver) {
    cardSelection.style.display = 'none';
  }

  saveSession();
});

// Copy room ID to clipboard
copyRoomIdBtn.addEventListener('click', async () => {
  try {
    // Try modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(currentRoomId);
    } else {
      // Fallback for browsers that don't support clipboard API (Safari/older browsers)
      const textArea = document.createElement('textarea');
      textArea.value = currentRoomId;
      textArea.style.position = 'absolute';
      textArea.style.left = '-9999px';
      textArea.setAttribute('aria-hidden', 'true');
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        const successful = document.execCommand('copy');
        if (!successful) {
          throw new Error('Failed to copy room ID using execCommand');
        }
      } finally {
        document.body.removeChild(textArea);
      }
    }
    copyRoomIdBtn.textContent = '✓';
    setTimeout(() => {
      copyRoomIdBtn.textContent = '📋';
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
    // Show error to user
    copyRoomIdBtn.textContent = '✗';
    setTimeout(() => {
      copyRoomIdBtn.textContent = '📋';
    }, 2000);
  }
});

// Copy shareable room link to clipboard
copyShareLinkBtn.addEventListener('click', async () => {
  try {
    let shareUrl;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('room', currentRoomId);
      shareUrl = url.toString();
    } catch (e) {
      shareUrl = window.location.origin + window.location.pathname + '?room=' + currentRoomId;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(shareUrl);
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      textArea.style.position = 'absolute';
      textArea.style.left = '-9999px';
      textArea.setAttribute('aria-hidden', 'true');
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
      } finally {
        document.body.removeChild(textArea);
      }
    }
    copyShareLinkBtn.textContent = '✓';
    setTimeout(() => { copyShareLinkBtn.textContent = '🔗'; }, 2000);
  } catch (err) {
    console.error('Failed to copy link:', err);
    copyShareLinkBtn.textContent = '✗';
    setTimeout(() => { copyShareLinkBtn.textContent = '🔗'; }, 2000);
  }
});

// Leave room
leaveRoomBtn.addEventListener('click', () => {
  clearSession();
  socket.disconnect();
  socket.connect();
  
  // Remove room ID from URL
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState(null, '', url.toString());
  } catch (e) {
    // URL API not available
  }

  welcomeScreen.classList.remove('hidden');
  votingScreen.classList.add('hidden');
  becomeHostBanner.classList.add('hidden');
  
  // Reset form
  roomIdInput.value = '';
  selectedVote = null;
  
  // Clear story title
  storyTitleInput.value = '';
  storyTitleInput.classList.add('hidden');
  storyTitleDisplay.textContent = '';
  storyTitleDisplay.classList.add('hidden');
  autoRevealToggle.classList.add('hidden');
  autoRevealCheckbox.checked = false;

  // Clear round history
  roundHistory = [];
  roundNumber = 0;
  roundHistorySection.classList.add('hidden');
  roundHistoryList.innerHTML = '';
  
  // Clear selected cards
  clearCardSelection();
});

// Story title input (debounced to avoid excessive server calls while typing)
let storyTitleTimer = null;
storyTitleInput.addEventListener('input', () => {
  clearTimeout(storyTitleTimer);
  storyTitleTimer = setTimeout(() => {
    socket.emit('set-story', {
      roomId: currentRoomId,
      storyTitle: storyTitleInput.value
    });
  }, 300);
});

// Auto-reveal toggle
autoRevealCheckbox.addEventListener('change', () => {
  socket.emit('toggle-auto-reveal', {
    roomId: currentRoomId,
    autoReveal: autoRevealCheckbox.checked
  });
});

// Render the round history list (most recent round first)
function renderRoundHistory() {
  if (roundHistory.length === 0) {
    roundHistorySection.classList.add('hidden');
    return;
  }
  roundHistorySection.classList.remove('hidden');
  roundHistoryList.innerHTML = '';
  [...roundHistory].reverse().forEach(entry => {
    const item = document.createElement('div');
    item.className = 'round-history-item';

    const numberEl = document.createElement('div');
    numberEl.className = 'round-number';
    numberEl.textContent = `Round ${entry.round}`;

    const titleEl = document.createElement('div');
    titleEl.className = 'round-title';
    titleEl.textContent = entry.title || '(no title)';
    titleEl.title = entry.title || '';

    const statsEl = document.createElement('div');
    statsEl.className = 'round-stats';
    statsEl.innerHTML =
      `<span><strong>${entry.stats.average}</strong>avg</span>` +
      `<span><strong>${entry.stats.min}</strong>min</span>` +
      `<span><strong>${entry.stats.max}</strong>max</span>`;

    item.appendChild(numberEl);
    item.appendChild(titleEl);
    item.appendChild(statsEl);
    roundHistoryList.appendChild(item);
  });
}

// Card selection (event delegation on the container)
cardsContainer.addEventListener('click', (e) => {
  const button = e.target.closest('.card-button');
  if (!button || isObserver || isRevealed) return;

  const value = button.dataset.value;
  
  // Toggle selection
  if (selectedVote === value) {
    selectedVote = null;
    button.classList.remove('selected');
  } else {
    // Remove previous selection
    clearCardSelection();
    
    // Set new selection
    selectedVote = value;
    button.classList.add('selected');
    if (specialEffectsEnabled) {
      triggerCardSparkle(button);
    }
  }

  // Send vote to server
  let voteValue = null;
  if (selectedVote !== null) {
    const numericVal = parseFloat(selectedVote);
    voteValue = isNaN(numericVal) ? selectedVote : numericVal;
  }
  socket.emit('vote', {
    roomId: currentRoomId,
    vote: voteValue
  });
});

// Reveal cards
revealBtn.addEventListener('click', () => {
  socket.emit('reveal', { roomId: currentRoomId });
});

// Reset votes
resetBtn.addEventListener('click', () => {
  socket.emit('reset', { roomId: currentRoomId });
  
  // Clear local selection and results immediately for responsiveness
  selectedVote = null;
  clearCardSelection();
  statistics.classList.add('hidden');
  statAvg.textContent = '-';
  statMedian.textContent = '-';
  statMin.textContent = '-';
  statMax.textContent = '-';

  // Immediately clear participant vote values so the previous round's
  // results are not visible while we wait for the server's room-update
  participantsList.querySelectorAll('.participant-card:not(.observer) .participant-vote').forEach(voteEl => {
    voteEl.textContent = '...';
    voteEl.style.color = '#dee2e6';
    voteEl.classList.remove('hidden-vote');
  });
});

// Handle room updates
socket.on('room-update', (data) => {
  // Track revealed state
  const justRevealed = data.revealed && !wasRevealed;
  wasRevealed = data.revealed;
  isRevealed = data.revealed;

  // Track special effects
  specialEffectsEnabled = !!data.specialEffects;

  // Show mute button when special effects are enabled
  if (specialEffectsEnabled) {
    muteSoundBtn.classList.remove('hidden');
  } else {
    muteSoundBtn.classList.add('hidden');
  }

  // Update card deck if it changed
  if (data.cardSet && data.cardSet !== currentCardSet) {
    currentCardSet = data.cardSet;
    selectedVote = null;
    renderCards(currentCardSet);
  }

  // Update participants
  participantsList.innerHTML = '';
  participantCount.textContent = data.users.length;

  data.users.forEach((user, index) => {
    const card = document.createElement('div');
    card.className = 'participant-card';
    
    if (user.isObserver) {
      card.classList.add('observer');
    } else if (user.vote === 'voted') {
      card.classList.add('voted');
    }

    // Add remove button if current user is the room creator and this is not their own card
    if (data.creatorId === socket.id && user.id !== socket.id) {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-participant-btn';
      removeBtn.innerHTML = '×';
      removeBtn.title = 'Remove participant';
      removeBtn.onclick = () => {
        if (confirm(`Remove ${user.name} from the room?`)) {
          socket.emit('remove-participant', {
            roomId: currentRoomId,
            participantId: user.id
          });
        }
      };
      card.appendChild(removeBtn);
    }

    const nameDiv = document.createElement('div');
    nameDiv.className = 'participant-name';
    nameDiv.textContent = user.name;

    const voteDiv = document.createElement('div');
    voteDiv.className = 'participant-vote';

    if (user.isObserver) {
      voteDiv.textContent = '👁️';
      voteDiv.style.color = '#6c757d';
    } else if (data.revealed) {
      voteDiv.textContent = user.vote !== null ? user.vote : '-';
      if (justRevealed && user.vote !== null) {
        voteDiv.style.animationDelay = `${Math.min(index * VOTE_FLIP_DELAY_INCREMENT_MS, VOTE_FLIP_MAX_DELAY_MS)}ms`;
        voteDiv.classList.add('flip-reveal');
      }
    } else if (user.vote === 'voted') {
      voteDiv.textContent = '✓';
      voteDiv.classList.add('hidden-vote');
    } else {
      voteDiv.textContent = '...';
      voteDiv.style.color = '#dee2e6';
    }

    card.appendChild(nameDiv);
    card.appendChild(voteDiv);

    if (user.isObserver) {
      const badge = document.createElement('div');
      badge.className = 'participant-badge';
      badge.textContent = 'Observer';
      card.appendChild(badge);
    }

    // Add host badge for the room creator
    if (user.id === data.creatorId) {
      const hostBadge = document.createElement('div');
      hostBadge.className = 'participant-badge host';
      hostBadge.textContent = 'Host';
      card.appendChild(hostBadge);
    }

    participantsList.appendChild(card);
  });

  // Update statistics
  if (data.revealed && data.stats) {
    statistics.classList.remove('hidden');
    statAvg.textContent = data.stats.average;
    statMedian.textContent = data.stats.median;
    statMin.textContent = data.stats.min;
    statMax.textContent = data.stats.max;

    if (justRevealed) {
      statistics.classList.add('animate-in');
      statistics.addEventListener('animationend', () => statistics.classList.remove('animate-in'), { once: true });

      if (specialEffectsEnabled) {
        SoundEffects.reveal();
      }

      // Confetti when all voters agree (special effects only)
      const voters = data.users.filter(u => !u.isObserver && u.vote !== null);
      const isConsensus = voters.length >= MIN_VOTERS_FOR_CONSENSUS && data.stats.min === data.stats.max;
      if (isConsensus && specialEffectsEnabled) {
        triggerConfetti(true);
      }

      // Animate participant cards after the flip animations settle (special effects only).
      const cardAnimClass = specialEffectsEnabled ? (isConsensus ? 'card-dance' : 'tada-bounce') : null;
      if (cardAnimClass) {
        participantsList.querySelectorAll('.participant-card').forEach((card, idx) => {
          const delay = Math.min(idx * VOTE_FLIP_DELAY_INCREMENT_MS, VOTE_FLIP_MAX_DELAY_MS) + TADA_BOUNCE_SETTLE_DELAY_MS;
          setTimeout(() => {
            card.classList.add(cardAnimClass);
            card.addEventListener('animationend', () => card.classList.remove(cardAnimClass), { once: true });
          }, delay);
        });
      }
    }
  } else {
    statistics.classList.add('hidden');
    statAvg.textContent = '-';
    statMedian.textContent = '-';
    statMin.textContent = '-';
    statMax.textContent = '-';
  }

  // Update button states
  const hasVotes = data.users.some(u => !u.isObserver && u.vote !== null);
  isCreator = data.creatorId === socket.id;

  // Hide the become-host banner once a host is present in the room
  if (data.users.some(u => u.id === data.creatorId)) {
    becomeHostBanner.classList.add('hidden');
  }

  // Disable card selection when votes are revealed
  cardsContainer.querySelectorAll('.card-button').forEach(btn => {
    btn.disabled = data.revealed;
  });
  
  // Only the room creator can see and use reveal and reset
  if (!isCreator) {
    revealBtn.classList.add('hidden');
    resetBtn.classList.add('hidden');
  } else {
    revealBtn.classList.remove('hidden');
    resetBtn.classList.remove('hidden');
    revealBtn.disabled = !hasVotes || data.revealed;
    resetBtn.disabled = !data.revealed;
  }
  
  // Sync local selection state with server state
  const currentUser = data.users.find(u => u.id === socket.id);
  if (currentUser && currentUser.vote === null && selectedVote !== null) {
    // Server confirms we have no vote, clear local selection
    selectedVote = null;
    clearCardSelection();
  }

  // Update story title
  if (isCreator) {
    storyTitleInput.classList.remove('hidden');
    storyTitleDisplay.classList.add('hidden');
    // Only update when not focused to avoid interrupting typing
    if (document.activeElement !== storyTitleInput) {
      storyTitleInput.value = data.storyTitle || '';
    }
    autoRevealToggle.classList.remove('hidden');
    autoRevealCheckbox.checked = data.autoReveal || false;
  } else {
    storyTitleInput.classList.add('hidden');
    autoRevealToggle.classList.add('hidden');
    if (data.storyTitle) {
      storyTitleDisplay.textContent = data.storyTitle;
      storyTitleDisplay.classList.remove('hidden');
    } else {
      storyTitleDisplay.classList.add('hidden');
    }
  }

  // Save round history when cards are revealed for the first time in a round
  if (justRevealed && data.stats) {
    roundNumber++;
    roundHistory.push({
      round: roundNumber,
      title: data.storyTitle || '',
      stats: Object.assign({}, data.stats)
    });
    renderRoundHistory();
  }
});

// Handle being removed from a room
socket.on('removed-from-room', () => {
  clearSession();
  alert('You have been removed from the room by the room creator.');
  // Return to welcome screen
  welcomeScreen.classList.remove('hidden');
  votingScreen.classList.add('hidden');
  becomeHostBanner.classList.add('hidden');
  currentRoomId = null;
  currentUserName = null;
  selectedVote = null;
  roundHistory = [];
  roundNumber = 0;
  roundHistorySection.classList.add('hidden');
  roundHistoryList.innerHTML = '';
  // Remove room from URL
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState(null, '', url.toString());
  } catch (e) {
    // URL API not available
  }
});

// Handle host absence: show the become-host option to all remaining participants
socket.on('host-absent', () => {
  becomeHostBanner.classList.remove('hidden');
});

// Become host button
becomeHostBtn.addEventListener('click', () => {
  socket.emit('claim-host', { roomId: currentRoomId });
  becomeHostBanner.classList.add('hidden');
});

// Connection status
socket.on('connect', () => {
  console.log('Connected to server');

  // Auto-rejoin if a session was saved (handles page refresh)
  if (!currentRoomId) {
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        const session = JSON.parse(stored);
        if (session.roomId && session.userName) {
          currentRoomId = session.roomId;
          currentUserName = session.userName;
          isObserver = session.isObserver || false;

          socket.emit('join-room', {
            roomId: currentRoomId,
            userName: currentUserName,
            isObserver,
            cardSet: currentCardSet,
            specialEffects: specialEffectsCheckbox.checked,
            clientId
          });

          welcomeScreen.classList.add('hidden');
          votingScreen.classList.remove('hidden');
          currentRoomIdDisplay.textContent = currentRoomId;

          if (isObserver) {
            cardSelection.style.display = 'none';
          }
        }
      }
    } catch (e) { /* ignore */ }
  }
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
  alert('Failed to connect to server. Please try again.');
});

