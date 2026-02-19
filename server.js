const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { execSync } = require('child_process');

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

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint for OpenShift
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/ready', (req, res) => {
  res.status(200).json({ status: 'ready' });
});

// Get commit info endpoint
app.get('/api/commit', (req, res) => {
  try {
    // Try to get commit hash from environment variable (set during build)
    let commitHash = process.env.GIT_COMMIT || process.env.COMMIT_SHA;
    
    // If not available, try to get it from git
    if (!commitHash) {
      try {
        commitHash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
      } catch (error) {
        // Git not available or not in a git repository
        commitHash = null;
      }
    }
    
    res.json({
      hash: commitHash,
      shortHash: commitHash ? commitHash.substring(0, 7) : null,
      repository: 'https://github.com/agornovo/scrumpoker'
    });
  } catch (error) {
    res.status(500).json({ error: 'Unable to retrieve commit info' });
  }
});

// Store rooms and their state
const rooms = new Map();

// Room structure:
// {
//   id: string,
//   users: Map({ socketId: { name: string, vote: number|null, isObserver: boolean } }),
//   revealed: boolean,
//   createdAt: Date,
//   creatorId: string (socket ID of room creator)
// }

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Join a room
  socket.on('join-room', ({ roomId, userName, isObserver }) => {
    // Create room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        id: roomId,
        users: new Map(),
        revealed: false,
        createdAt: new Date(),
        creatorId: socket.id // Track the room creator
      });
      console.log('Created room:', roomId);
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

    console.log(`User ${userName} joined room ${roomId}`);

    // Send current room state to all users in the room
    emitRoomUpdate(roomId);
  });

  // Vote
  socket.on('vote', ({ roomId, vote }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const user = room.users.get(socket.id);
    if (!user) return;

    user.vote = vote;
    console.log(`User ${user.name} voted ${vote} in room ${roomId}`);

    emitRoomUpdate(roomId);
  });

  // Reveal cards (only room creator can do this)
  socket.on('reveal', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    // Only the room creator can reveal cards
    if (socket.id !== room.creatorId) {
      console.log(`Unauthorized reveal attempt by ${socket.id} in room ${roomId}`);
      return;
    }

    room.revealed = true;
    console.log(`Cards revealed in room ${roomId}`);

    emitRoomUpdate(roomId);
  });

  // Reset votes (only room creator can do this)
  socket.on('reset', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    // Only the room creator can reset votes
    if (socket.id !== room.creatorId) {
      console.log(`Unauthorized reset attempt by ${socket.id} in room ${roomId}`);
      return;
    }

    room.revealed = false;
    room.users.forEach(user => {
      user.vote = null;
    });
    console.log(`Votes reset in room ${roomId}`);

    emitRoomUpdate(roomId);
  });

  // Remove participant (only room creator can do this)
  socket.on('remove-participant', ({ roomId, participantId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    // Only the room creator can remove participants
    if (socket.id !== room.creatorId) {
      console.log(`Unauthorized remove attempt by ${socket.id} in room ${roomId}`);
      return;
    }

    // Cannot remove yourself
    if (participantId === socket.id) {
      console.log(`Room creator cannot remove themselves`);
      return;
    }

    // Remove the participant
    if (room.users.has(participantId)) {
      const removedUser = room.users.get(participantId);
      room.users.delete(participantId);
      console.log(`User ${removedUser.name} removed from room ${roomId} by creator`);

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
    console.log('Client disconnected:', socket.id);

    const roomId = socket.roomId;
    if (roomId) {
      const room = rooms.get(roomId);
      if (room) {
        room.users.delete(socket.id);
        
        // Clean up empty rooms
        if (room.users.size === 0) {
          rooms.delete(roomId);
          console.log('Deleted empty room:', roomId);
        } else {
          emitRoomUpdate(roomId);
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
      creatorId: room.creatorId
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
      console.log('Cleaned up old room:', roomId);
    }
  });
}, 60 * 60 * 1000); // Run every hour

server.listen(PORT, () => {
  console.log(`Scrum Poker server running on port ${PORT}`);
});
