// Socket.io connection
const socket = io();

// UI Elements
const welcomeScreen = document.getElementById('welcome-screen');
const votingScreen = document.getElementById('voting-screen');
const themeToggleBtn = document.getElementById('theme-toggle');
const userNameInput = document.getElementById('user-name');
const roomIdInput = document.getElementById('room-id');
const isObserverCheckbox = document.getElementById('is-observer');
const joinBtn = document.getElementById('join-btn');
const currentRoomIdDisplay = document.getElementById('current-room-id');
const copyRoomIdBtn = document.getElementById('copy-room-id');
const leaveRoomBtn = document.getElementById('leave-room');
const participantsList = document.getElementById('participants-list');
const participantCount = document.getElementById('participant-count');
const cardSelection = document.getElementById('card-selection');
const cardButtons = document.querySelectorAll('.card-button');
const revealBtn = document.getElementById('reveal-btn');
const resetBtn = document.getElementById('reset-btn');
const statistics = document.getElementById('statistics');
const statAvg = document.getElementById('stat-avg');
const statMedian = document.getElementById('stat-median');
const statMin = document.getElementById('stat-min');
const statMax = document.getElementById('stat-max');

// State
let currentRoomId = null;
let currentUserName = null;
let isObserver = false;
let selectedVote = null;
const THEME_STORAGE_KEY = 'scrumpoker-theme';

function setTheme(theme) {
  const isDark = theme === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  themeToggleBtn.textContent = isDark ? 'Light theme' : 'Dark theme';
  themeToggleBtn.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
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
    isObserver: isObserver
  });

  // Show voting screen
  welcomeScreen.classList.add('hidden');
  votingScreen.classList.remove('hidden');
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
  
  // Clear selected cards
  cardButtons.forEach(btn => btn.classList.remove('selected'));
});

// Card selection
cardButtons.forEach(button => {
  button.addEventListener('click', () => {
    if (isObserver) return;

    const value = button.dataset.value;
    
    // Toggle selection
    if (selectedVote === value) {
      selectedVote = null;
      button.classList.remove('selected');
    } else {
      // Remove previous selection
      cardButtons.forEach(btn => btn.classList.remove('selected'));
      
      // Set new selection
      selectedVote = value;
      button.classList.add('selected');
    }

    // Send vote to server
    let voteValue = null;
    if (selectedVote !== null) {
      voteValue = selectedVote === '?' || selectedVote === '☕' ? selectedVote : parseFloat(selectedVote);
    }
    socket.emit('vote', {
      roomId: currentRoomId,
      vote: voteValue
    });
  });
});

// Reveal cards
revealBtn.addEventListener('click', () => {
  socket.emit('reveal', { roomId: currentRoomId });
});

// Reset votes
resetBtn.addEventListener('click', () => {
  socket.emit('reset', { roomId: currentRoomId });
  
  // Clear local selection immediately for responsiveness
  selectedVote = null;
  cardButtons.forEach(btn => btn.classList.remove('selected'));
});

// Handle room updates
socket.on('room-update', (data) => {
  // Update participants
  participantsList.innerHTML = '';
  participantCount.textContent = data.users.length;

  data.users.forEach(user => {
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
  } else {
    statistics.classList.add('hidden');
  }

  // Update button states
  const hasVotes = data.users.some(u => !u.isObserver && u.vote !== null);
  const isCreator = data.creatorId === socket.id;
  
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
    cardButtons.forEach(btn => btn.classList.remove('selected'));
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
async function updateSourceLink() {
  try {
    const response = await fetch('/api/commit');
    if (!response.ok) {
      throw new Error('Failed to fetch commit info');
    }
    const data = await response.json();
    
    if (data.hash) {
      const sourceLink = document.getElementById('source-link');
      if (sourceLink) {
        sourceLink.href = `${data.repository}/commit/${data.hash}`;
        sourceLink.title = `View source code at commit ${data.shortHash}`;
      }
    }
  } catch (error) {
    console.warn('Could not fetch commit info:', error);
    // Link will still work, just points to the repo instead of specific commit
  }
}

// Update source link on page load
updateSourceLink();
