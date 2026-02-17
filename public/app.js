// Socket.io connection
const socket = io();

// UI Elements
const welcomeScreen = document.getElementById('welcome-screen');
const votingScreen = document.getElementById('voting-screen');
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
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      textArea.style.opacity = '0';
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
  revealBtn.disabled = !hasVotes || data.revealed;
  resetBtn.disabled = !data.revealed;
  
  // Sync local selection state with server state
  const currentUser = data.users.find(u => u.id === socket.id);
  if (currentUser && currentUser.vote === null && selectedVote !== null) {
    // Server confirms we have no vote, clear local selection
    selectedVote = null;
    cardButtons.forEach(btn => btn.classList.remove('selected'));
  }
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
