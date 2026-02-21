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
const VOTE_FLIP_DELAY_INCREMENT_MS = 100;
const VOTE_FLIP_MAX_DELAY_MS = 600;
const MIN_VOTERS_FOR_CONSENSUS = 2;

// Launch confetti celebration (palette-aware + classic colors)
function triggerConfetti() {
  const style = getComputedStyle(document.documentElement);
  const primaryColor = style.getPropertyValue('--primary-color').trim();
  const successColor = style.getPropertyValue('--success-color').trim();
  const warningColor = style.getPropertyValue('--warning-color').trim();
  const colors = [primaryColor, successColor, warningColor, '#e74c3c', '#f39c12', '#3498db', '#9b59b6', '#e91e63'];

  for (let i = 0; i < CONFETTI_PARTICLE_COUNT; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-particle';
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = Math.random() * 8 + 6;
    const left = Math.random() * 100;
    const duration = Math.random() * 2 + 1.5;
    const delay = Math.random() * 0.6;
    const isCircle = Math.random() > 0.4;
    el.style.cssText = `left:${left}vw;width:${size}px;height:${size}px;background:${color};border-radius:${isCircle ? '50%' : '2px'};animation-duration:${duration}s;animation-delay:${delay}s;`;
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}

// State
let currentRoomId = null;
let currentUserName = null;
let isObserver = false;
let isRevealed = false;
let selectedVote = null;
let currentCardSet = 'standard';
let wasRevealed = false;
const THEME_STORAGE_KEY = 'scrumpoker-theme';
const PALETTE_STORAGE_KEY = 'scrumpoker-palette';

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

// Generate a random room ID
function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
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
    cardSet: cardSetSelect.value
  });

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

// Leave room
leaveRoomBtn.addEventListener('click', () => {
  socket.disconnect();
  socket.connect();
  
  welcomeScreen.classList.remove('hidden');
  votingScreen.classList.add('hidden');
  
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

      // Confetti when all voters agree
      const voters = data.users.filter(u => !u.isObserver && u.vote !== null);
      if (voters.length >= MIN_VOTERS_FOR_CONSENSUS && data.stats.min === data.stats.max) {
        triggerConfetti();
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
  const isCreator = data.creatorId === socket.id;

  // Disable card selection when votes are revealed
  cardsContainer.querySelectorAll('.card-button').forEach(btn => {
    btn.disabled = data.revealed;
  });
  
  // Only the room creator can reveal and reset
  if (!isCreator) {
    revealBtn.disabled = true;
    resetBtn.disabled = true;
    revealBtn.title = 'Only the room creator can reveal cards';
    resetBtn.title = 'Only the room creator can start a new round';
  } else {
    revealBtn.disabled = !hasVotes || data.revealed;
    resetBtn.disabled = !data.revealed;
    revealBtn.title = '';
    resetBtn.title = '';
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
});

// Handle being removed from a room
socket.on('removed-from-room', () => {
  alert('You have been removed from the room by the room creator.');
  // Return to welcome screen
  welcomeScreen.classList.remove('hidden');
  votingScreen.classList.add('hidden');
  currentRoomId = null;
  currentUserName = null;
  selectedVote = null;
});

// Connection status
socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
  alert('Failed to connect to server. Please try again.');
});

// Fetch and update the source code link with commit hash
async function initializeCommitLink() {
  try {
    const response = await fetch('/api/commit');
    if (!response.ok) {
      throw new Error('Failed to fetch commit info');
    }
    const data = await response.json();
    
    const sourceLink = document.getElementById('source-link');
    if (sourceLink && data.repository) {
      if (data.hash) {
        // Update link to point to specific commit when available
        sourceLink.href = `${data.repository}/commit/${data.hash}`;
        sourceLink.title = `View source code at commit ${data.shortHash}`;
      } else {
        // Fall back to repo link when commit hash is not available (e.g., in Docker)
        sourceLink.href = data.repository;
        sourceLink.title = 'View source code on GitHub';
      }
    }
  } catch (error) {
    console.warn('Could not fetch commit info:', error);
    // Link will still work with default href from HTML
  }
}

// Update source link on page load
initializeCommitLink();
