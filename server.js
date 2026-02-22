const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { execSync } = require('child_process');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  // Configure for supporting up to 20+ users per room
  maxHttpBufferSize: 1e6, // 1MB (default, but being explicit)
  pingTimeout: 60000, // 60 seconds (increased from default 20s for reliability)
  pingInterval: 25000, // 25 seconds (default, but being explicit)
  connectTimeout: 45000, // 45 seconds (default)
  cors: {
    // In production, this should be restricted to specific allowed origins
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"]
  }
});

// Increase max listeners to support rooms with many users
// This applies to the Socket.IO server instance and prevents EventEmitter warnings
// when broadcasting to rooms with 20+ concurrent users
io.setMaxListeners(50); // Support up to 50 listeners (well above 20 users)

const PORT = process.env.PORT || 8080;

// Structured logger that prefixes every entry with an ISO-8601 timestamp
function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint for OpenShift
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/ready', (req, res) => {
  res.status(200).json({ status: 'ready' });
});

// Cache commit info to avoid repeated git command execution
let cachedCommitInfo = null;

// Rate limiter for commit info endpoint to prevent abuse of system command execution
const commitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // limit each IP to 60 requests per windowMs for this endpoint
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false,  // Disable the `X-RateLimit-*` headers
});

// Get commit info endpoint
app.get('/api/commit', commitLimiter, (req, res) => {
  try {
    // Return cached result if available
    if (cachedCommitInfo) {
      return res.json(cachedCommitInfo);
    }

    // Try to get commit hash from environment variable (set during build)
    let commitHash = process.env.GIT_COMMIT || process.env.COMMIT_SHA;
    
    // If not available, try to get it from git (only once, then cached)
    // Note: This will fail in Docker containers where .git directory is not present
    if (!commitHash) {
      try {
        commitHash = execSync('git rev-parse HEAD', { encoding: 'utf8', timeout: 5000 }).trim();
      } catch (error) {
        // Git not available or not in a git repository (e.g., Docker container)
        // Fall back to null - client will use repo link without specific commit
        commitHash = null;
      }
    }
    
    // Cache the result
    // When commitHash is null (Docker/production), link will point to repo root
    cachedCommitInfo = {
      hash: commitHash,
      shortHash: commitHash ? commitHash.substring(0, 7) : null,
      repository: 'https://github.com/agornovo/scrumpoker'
    };

    res.json(cachedCommitInfo);
  } catch (error) {
    res.status(500).json({ error: 'Unable to retrieve commit info' });
  }
});

// Store rooms and their state
const rooms = new Map();

// Grace period (ms) before removing a disconnected user, to allow page-refresh reconnections
const RECONNECT_GRACE_PERIOD_MS = parseInt(process.env.RECONNECT_GRACE_PERIOD_MS) || 8000;

// Time (ms) after the host has been removed from the room before participants are offered host takeover
const HOST_TAKEOVER_TIMEOUT_MS = parseInt(process.env.HOST_TAKEOVER_TIMEOUT_MS) || 60000;

// Tracks users in their grace-period window after disconnect (keyed by clientId)
// Pending removals: clientId -> { timer, roomId, oldSocketId, userData }
const pendingRemovals = new Map();

// Room structure:
// {
//   id: string,
//   users: Map({ socketId: { name: string, vote: number|null, isObserver: boolean } }),
//   revealed: boolean,
//   createdAt: Date,
//   creatorId: string (socket ID of room creator)
// }

io.on('connection', (socket) => {
  log('New client connected:', socket.id);

  // Join a room
  socket.on('join-room', ({ roomId, userName, isObserver, cardSet, specialEffects, clientId }) => {
    // Store clientId on the socket for use during disconnect
    if (clientId) socket.clientId = clientId;

    // Check if this is a reconnecting user within the grace period
    if (clientId && pendingRemovals.has(clientId)) {
      const pending = pendingRemovals.get(clientId);
      if (pending.roomId === roomId) {
        clearTimeout(pending.timer);
        pendingRemovals.delete(clientId);

        const room = rooms.get(roomId);
        if (room) {
          // Replace old socket entry with new one, preserving vote and observer status
          room.users.delete(pending.oldSocketId);
          room.users.set(socket.id, {
            name: pending.userData.name,
            vote: pending.userData.vote,
            isObserver: pending.userData.isObserver
          });

          // Update creatorId if the reconnecting user was the room creator
          if (room.creatorId === pending.oldSocketId) {
            room.creatorId = socket.id;
            if (room.hostAbsentTimer) {
              clearTimeout(room.hostAbsentTimer);
              room.hostAbsentTimer = null;
            }
          }

          socket.join(roomId);
          socket.roomId = roomId;
          log(`User ${pending.userData.name} reconnected to room ${roomId}`);
          emitRoomUpdate(roomId);
          return;
        }
      } else {
        // Reconnecting to a different room – finalise the old pending removal now
        clearTimeout(pending.timer);
        const oldRoom = rooms.get(pending.roomId);
        if (oldRoom) {
          oldRoom.users.delete(pending.oldSocketId);
          if (oldRoom.users.size === 0) {
            rooms.delete(pending.roomId);
            log('Deleted empty room:', pending.roomId);
          } else {
            emitRoomUpdate(pending.roomId);
          }
        }
        pendingRemovals.delete(clientId);
      }
    }

    // Create room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        id: roomId,
        users: new Map(),
        revealed: false,
        createdAt: new Date(),
        creatorId: socket.id, // Track the room creator
        cardSet: cardSet || 'standard',
        storyTitle: '',
        autoReveal: false,
        specialEffects: !!specialEffects,
        hostAbsentTimer: null
      });
      log('Created room:', roomId);
    }

    const room = rooms.get(roomId);
    
    // Add user to room
    room.users.set(socket.id, {
      name: userName || `User ${room.users.size + 1}`,
      vote: null,
      isObserver: isObserver || false
    });

    // Join the socket.io room
    socket.join(roomId);
    
    // Store room ID in socket for cleanup
    socket.roomId = roomId;

    log(`User ${userName} joined room ${roomId}`);

    // Send current room state to all users in the room
    emitRoomUpdate(roomId);
  });

  // Vote
  socket.on('vote', ({ roomId, vote }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    // Prevent vote changes after cards are revealed
    if (room.revealed) return;

    const user = room.users.get(socket.id);
    if (!user) return;

    user.vote = vote;
    log(`User ${user.name} voted in room ${roomId}`);

    // Auto-reveal: if enabled and all non-observer voters have voted, reveal cards
    if (room.autoReveal && !room.revealed) {
      const voters = Array.from(room.users.values()).filter(u => !u.isObserver);
      const allVoted = voters.length > 0 && voters.every(u => u.vote !== null);
      if (allVoted) {
        room.revealed = true;
        log(`Auto-revealed cards in room ${roomId}`);
      }
    }

    emitRoomUpdate(roomId);
  });

  // Reveal cards (only room creator can do this)
  socket.on('reveal', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    // Only the room creator can reveal cards
    if (socket.id !== room.creatorId) {
      log(`Unauthorized reveal attempt by ${socket.id} in room ${roomId}`);
      return;
    }

    room.revealed = true;
    log(`Cards revealed in room ${roomId}`);

    emitRoomUpdate(roomId);
  });

  // Reset votes (only room creator can do this)
  socket.on('reset', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    // Only the room creator can reset votes
    if (socket.id !== room.creatorId) {
      log(`Unauthorized reset attempt by ${socket.id} in room ${roomId}`);
      return;
    }

    room.revealed = false;
    room.users.forEach(user => {
      user.vote = null;
    });
    log(`Votes reset in room ${roomId}`);

    emitRoomUpdate(roomId);
  });

  // Set story title (only room creator can do this)
  socket.on('set-story', ({ roomId, storyTitle }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    if (socket.id !== room.creatorId) return;

    room.storyTitle = typeof storyTitle === 'string' ? storyTitle.substring(0, 200) : '';
    emitRoomUpdate(roomId);
  });

  // Toggle auto-reveal (only room creator can do this)
  socket.on('toggle-auto-reveal', ({ roomId, autoReveal }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    if (socket.id !== room.creatorId) return;

    room.autoReveal = !!autoReveal;
    emitRoomUpdate(roomId);
  });

  // Claim host role when current host is absent
  socket.on('claim-host', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    // Claiming user must be in the room
    if (!room.users.has(socket.id)) return;

    // Only allowed when the current host is absent from the room
    if (room.users.has(room.creatorId)) return;

    // Cancel any pending host-absent timer
    if (room.hostAbsentTimer) {
      clearTimeout(room.hostAbsentTimer);
      room.hostAbsentTimer = null;
    }

    room.creatorId = socket.id;
    log(`User ${room.users.get(socket.id)?.name} claimed host in room ${roomId}`);
    emitRoomUpdate(roomId);
  });

  // Remove participant (only room creator can do this)
  socket.on('remove-participant', ({ roomId, participantId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    // Only the room creator can remove participants
    if (socket.id !== room.creatorId) {
      log(`Unauthorized remove attempt by ${socket.id} in room ${roomId}`);
      return;
    }

    // Cannot remove yourself
    if (participantId === socket.id) {
      log(`Room creator cannot remove themselves`);
      return;
    }

    // Remove the participant
    if (room.users.has(participantId)) {
      const removedUser = room.users.get(participantId);
      room.users.delete(participantId);
      log(`User ${removedUser.name} removed from room ${roomId} by creator`);

      // Cancel any pending reconnect grace period for the removed user
      for (const [cid, pending] of pendingRemovals.entries()) {
        if (pending.oldSocketId === participantId) {
          clearTimeout(pending.timer);
          pendingRemovals.delete(cid);
          break;
        }
      }

      // Disconnect the removed user's socket
      const targetSocket = io.sockets.sockets.get(participantId);
      if (targetSocket) {
        targetSocket.emit('removed-from-room', { roomId });
        targetSocket.leave(roomId);
        targetSocket.roomId = null;
      }

      emitRoomUpdate(roomId);
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    log('Client disconnected:', socket.id);

    const roomId = socket.roomId;
    if (roomId) {
      const room = rooms.get(roomId);
      if (room && room.users.has(socket.id)) {
        const clientId = socket.clientId;
        if (clientId) {
          // Start a grace period to allow reconnection (e.g. page refresh)
          const userData = { ...room.users.get(socket.id) };
          const oldSocketId = socket.id;
          const timer = setTimeout(() => {
            pendingRemovals.delete(clientId);
            const r = rooms.get(roomId);
            if (r) {
              const wasHost = r.creatorId === oldSocketId;
              r.users.delete(oldSocketId);
              if (r.users.size === 0) {
                rooms.delete(roomId);
                log('Deleted empty room:', roomId);
              } else {
                if (wasHost) {
                  r.hostAbsentTimer = setTimeout(() => {
                    r.hostAbsentTimer = null;
                    log(`Host absent in room ${roomId}, notifying participants`);
                    io.to(roomId).emit('host-absent', { roomId });
                  }, HOST_TAKEOVER_TIMEOUT_MS);
                }
                emitRoomUpdate(roomId);
              }
            }
          }, RECONNECT_GRACE_PERIOD_MS);
          pendingRemovals.set(clientId, { timer, roomId, oldSocketId, userData });
          log(`User ${userData.name} disconnected from room ${roomId}, grace period started`);
        } else {
          // No clientId – remove the user immediately (legacy / non-browser clients)
          const wasHost = room.creatorId === socket.id;
          room.users.delete(socket.id);
          if (room.users.size === 0) {
            rooms.delete(roomId);
            log('Deleted empty room:', roomId);
          } else {
            if (wasHost) {
              room.hostAbsentTimer = setTimeout(() => {
                room.hostAbsentTimer = null;
                log(`Host absent in room ${roomId}, notifying participants`);
                io.to(roomId).emit('host-absent', { roomId });
              }, HOST_TAKEOVER_TIMEOUT_MS);
            }
            emitRoomUpdate(roomId);
          }
        }
      }
    }
  });

  function emitRoomUpdate(roomId) {
    const room = rooms.get(roomId);
    if (!room) return;

    const users = Array.from(room.users.entries()).map(([socketId, user]) => ({
      id: socketId,
      name: user.name,
      vote: room.revealed ? user.vote : (user.vote !== null ? 'voted' : null),
      isObserver: user.isObserver
    }));

    // Calculate statistics if revealed
    let stats = null;
    if (room.revealed) {
      const votes = Array.from(room.users.values())
        .filter(u => !u.isObserver && u.vote !== null && typeof u.vote === 'number')
        .map(u => u.vote);

      if (votes.length > 0) {
        const sum = votes.reduce((a, b) => a + b, 0);
        const avg = sum / votes.length;
        const sorted = [...votes].sort((a, b) => a - b);
        const median = votes.length % 2 === 0
          ? (sorted[votes.length / 2 - 1] + sorted[votes.length / 2]) / 2
          : sorted[Math.floor(votes.length / 2)];

        stats = {
          average: Math.round(avg * 10) / 10,
          median: median,
          min: Math.min(...votes),
          max: Math.max(...votes)
        };
      }
    }

    io.to(roomId).emit('room-update', {
      roomId,
      users,
      revealed: room.revealed,
      stats,
      creatorId: room.creatorId,
      cardSet: room.cardSet,
      storyTitle: room.storyTitle,
      autoReveal: room.autoReveal,
      specialEffects: room.specialEffects
    });
  }
});

// Cleanup empty rooms older than 24 hours periodically
setInterval(() => {
  const now = new Date();
  const dayInMs = 24 * 60 * 60 * 1000;
  
  rooms.forEach((room, roomId) => {
    if (now - room.createdAt > dayInMs && room.users.size === 0) {
      rooms.delete(roomId);
      log('Cleaned up old room:', roomId);
    }
  });
}, 60 * 60 * 1000); // Run every hour

if (require.main === module) {
  server.listen(PORT, () => {
    log(`Scrum Poker server running on port ${PORT}`);
  });
}

module.exports = { log };
