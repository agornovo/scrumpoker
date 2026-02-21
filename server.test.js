const request = require('supertest');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { io: Client } = require('socket.io-client');

// Test timing constants
const VERIFICATION_DELAY_MS = 1000; // Time to wait for all clients to receive final updates
const BATCH_JOIN_DELAY_MS = 500; // Time between batches of users joining

// Create a test server for each test
function createTestServer() {
  const app = express();
  const server = http.createServer(app);
  const io = socketIo(server);
  
  const rooms = new Map();
  
  // Health check endpoints
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });
  
  app.get('/ready', (req, res) => {
    res.status(200).json({ status: 'ready' });
  });
  
  // Socket.IO logic
  io.on('connection', (socket) => {
  // Join a room
  socket.on('join-room', ({ roomId, userName, isObserver, cardSet }) => {
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        id: roomId,
        users: new Map(),
        revealed: false,
        createdAt: new Date(),
        creatorId: socket.id,
        cardSet: cardSet || 'standard',
        storyTitle: '',
        autoReveal: false
      });
    }
      
      const room = rooms.get(roomId);
      room.users.set(socket.id, {
        name: userName || `User ${room.users.size + 1}`,
        vote: null,
        isObserver: isObserver || false
      });
      
      socket.join(roomId);
      socket.roomId = roomId;
      
      emitRoomUpdate(roomId);
    });
    
    socket.on('vote', ({ roomId, vote }) => {
      const room = rooms.get(roomId);
      if (!room) return;

      // Prevent vote changes after cards are revealed
      if (room.revealed) return;
      
      const user = room.users.get(socket.id);
      if (!user) return;
      
      user.vote = vote;

      // Auto-reveal: if enabled and all non-observer voters have voted, reveal cards
      if (room.autoReveal && !room.revealed) {
        const voters = Array.from(room.users.values()).filter(u => !u.isObserver);
        const allVoted = voters.length > 0 && voters.every(u => u.vote !== null);
        if (allVoted) {
          room.revealed = true;
        }
      }

      emitRoomUpdate(roomId);
    });
    
    socket.on('reveal', ({ roomId }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      
      // Only the room creator can reveal cards
      if (socket.id !== room.creatorId) {
        console.log(`Unauthorized reveal attempt by ${socket.id} in room ${roomId}`);
        return;
      }
      
      room.revealed = true;
      emitRoomUpdate(roomId);
    });
    
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
      emitRoomUpdate(roomId);
    });

    socket.on('set-story', ({ roomId, storyTitle }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      if (socket.id !== room.creatorId) return;
      room.storyTitle = typeof storyTitle === 'string' ? storyTitle.substring(0, 200) : '';
      emitRoomUpdate(roomId);
    });

    socket.on('toggle-auto-reveal', ({ roomId, autoReveal }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      if (socket.id !== room.creatorId) return;
      room.autoReveal = !!autoReveal;
      emitRoomUpdate(roomId);
    });

    socket.on('remove-participant', ({ roomId, participantId }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      
      if (socket.id !== room.creatorId) return;
      if (participantId === socket.id) return;
      
      if (room.users.has(participantId)) {
        room.users.delete(participantId);
        
        const targetSocket = io.sockets.sockets.get(participantId);
        if (targetSocket) {
          targetSocket.emit('removed-from-room', { roomId });
          targetSocket.leave(roomId);
          targetSocket.roomId = null;
        }
        
        emitRoomUpdate(roomId);
      }
    });
    
    socket.on('disconnect', () => {
      const roomId = socket.roomId;
      if (roomId) {
        const room = rooms.get(roomId);
        if (room) {
          room.users.delete(socket.id);
          
          if (room.users.size === 0) {
            rooms.delete(roomId);
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
        autoReveal: room.autoReveal
      });
    }
  });
  
  return { app, server, io, rooms };
}

describe('Server Health Checks', () => {
  let testServer;
  let server;
  let io;
  
  beforeEach((done) => {
    testServer = createTestServer();
    server = testServer.server;
    io = testServer.io;
    server.listen(() => {
      done();
    });
  });
  
  afterEach((done) => {
    io.close();
    server.close(done);
  });
  
  test('GET /health returns ok status', async () => {
    const response = await request(server).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
  
  test('GET /ready returns ready status', async () => {
    const response = await request(server).get('/ready');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ready' });
  });
});

describe('Socket.IO Room Management', () => {
  let testServer;
  let server;
  let io;
  let clientSocket;
  let serverUrl;
  
  beforeEach((done) => {
    testServer = createTestServer();
    server = testServer.server;
    io = testServer.io;
    
    server.listen(() => {
      const port = server.address().port;
      serverUrl = `http://localhost:${port}`;
      done();
    });
  });
  
  afterEach((done) => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
    io.close();
    server.close(done);
  });
  
  test('should allow a user to join a room', (done) => {
    clientSocket = Client(serverUrl);
    
    clientSocket.on('room-update', (data) => {
      expect(data.roomId).toBe('TEST123');
      expect(data.users).toHaveLength(1);
      expect(data.users[0].name).toBe('Alice');
      expect(data.revealed).toBe(false);
      done();
    });
    
    clientSocket.emit('join-room', {
      roomId: 'TEST123',
      userName: 'Alice',
      isObserver: false
    });
  });
  
  test('should create room automatically if it does not exist', (done) => {
    clientSocket = Client(serverUrl);
    
    clientSocket.on('room-update', (data) => {
      expect(data.roomId).toBe('NEWROOM');
      expect(data.users).toHaveLength(1);
      done();
    });
    
    clientSocket.emit('join-room', {
      roomId: 'NEWROOM',
      userName: 'Bob',
      isObserver: false
    });
  });
  
  test('should support multiple users in the same room', (done) => {
    const client1 = Client(serverUrl);
    const client2 = Client(serverUrl);
    
    let updates = 0;
    
    const checkComplete = (data) => {
      updates++;
      if (updates >= 2) {
        expect(data.users).toHaveLength(2);
        expect(data.users.map(u => u.name).sort()).toEqual(['Alice', 'Bob']);
        client1.disconnect();
        client2.disconnect();
        done();
      }
    };
    
    client1.on('room-update', checkComplete);
    client2.on('room-update', checkComplete);
    
    client1.emit('join-room', {
      roomId: 'MULTI',
      userName: 'Alice',
      isObserver: false
    });
    
    setTimeout(() => {
      client2.emit('join-room', {
        roomId: 'MULTI',
        userName: 'Bob',
        isObserver: false
      });
    }, 100);
  });
  
  test('should mark observer users correctly', (done) => {
    clientSocket = Client(serverUrl);
    
    clientSocket.on('room-update', (data) => {
      expect(data.users[0].isObserver).toBe(true);
      done();
    });
    
    clientSocket.emit('join-room', {
      roomId: 'OBS123',
      userName: 'Observer',
      isObserver: true
    });
  });
});

describe('Socket.IO Voting', () => {
  let testServer;
  let server;
  let io;
  let clientSocket;
  let serverUrl;
  
  beforeEach((done) => {
    testServer = createTestServer();
    server = testServer.server;
    io = testServer.io;
    
    server.listen(() => {
      const port = server.address().port;
      serverUrl = `http://localhost:${port}`;
      clientSocket = Client(serverUrl);
      
      clientSocket.on('connect', () => {
        done();
      });
    });
  });
  
  afterEach((done) => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
    io.close();
    server.close(done);
  });
  
  test('should record a vote', (done) => {
    let updateCount = 0;
    
    clientSocket.on('room-update', (data) => {
      updateCount++;
      if (updateCount === 2) {
        // Second update is after voting
        expect(data.users[0].vote).toBe('voted'); // Hidden until revealed
        clientSocket.disconnect();
        done();
      }
    });
    
    clientSocket.emit('join-room', {
      roomId: 'VOTE123',
      userName: 'Voter',
      isObserver: false
    });
    
    // Give time for initial room-update
    setTimeout(() => {
      clientSocket.emit('vote', {
        roomId: 'VOTE123',
        vote: 5
      });
    }, 100);
  });
  
  test('should hide votes until revealed', (done) => {
    let updateCount = 0;
    
    clientSocket.on('room-update', (data) => {
      updateCount++;
      if (updateCount === 2) {
        expect(data.users[0].vote).toBe('voted');
        expect(data.revealed).toBe(false);
        clientSocket.disconnect();
        done();
      }
    });
    
    clientSocket.emit('join-room', {
      roomId: 'VOTE456',
      userName: 'Voter',
      isObserver: false
    });
    
    // Give time for initial room-update
    setTimeout(() => {
      clientSocket.emit('vote', {
        roomId: 'VOTE456',
        vote: 8
      });
    }, 100);
  });

  test('should not allow vote changes after cards are revealed', (done) => {
    let updateCount = 0;
    let revealDone = false;

    clientSocket.on('room-update', (data) => {
      updateCount++;
      if (updateCount === 1) {
        // Initial join, cast a vote
        clientSocket.emit('vote', { roomId: 'VOTE_LOCK', vote: 5 });
      } else if (updateCount === 2) {
        // Vote recorded, now reveal
        expect(data.users[0].vote).toBe('voted');
        clientSocket.emit('reveal', { roomId: 'VOTE_LOCK' });
      } else if (updateCount === 3 && !revealDone) {
        // Votes revealed
        revealDone = true;
        expect(data.revealed).toBe(true);
        expect(data.users[0].vote).toBe(5);
        // Try to change vote after reveal
        clientSocket.emit('vote', { roomId: 'VOTE_LOCK', vote: 13 });
        // Wait to confirm no update arrives (vote should be ignored)
        setTimeout(() => {
          clientSocket.disconnect();
          done();
        }, 300);
      } else if (updateCount > 3) {
        // Should not receive another update triggered by the vote-after-reveal
        done(new Error('Received unexpected room-update after vote was rejected post-reveal'));
      }
    });

    clientSocket.emit('join-room', {
      roomId: 'VOTE_LOCK',
      userName: 'Voter',
      isObserver: false
    });
  });
});

describe('Socket.IO Reveal and Statistics', () => {
  let testServer;
  let server;
  let io;
  let serverUrl;
  
  beforeEach((done) => {
    testServer = createTestServer();
    server = testServer.server;
    io = testServer.io;
    
    server.listen(() => {
      const port = server.address().port;
      serverUrl = `http://localhost:${port}`;
      done();
    });
  });
  
  afterEach((done) => {
    io.close();
    server.close(done);
  });
  
  test('should reveal votes and calculate statistics', (done) => {
    const client1 = Client(serverUrl);
    const client2 = Client(serverUrl);
    const client3 = Client(serverUrl);
    const clients = [client1, client2, client3];
    
    let votingStarted = false;
    let revealReceived = false;
    
    const onRoomUpdate = (data) => {
      if (!revealReceived && data.revealed && data.stats) {
        revealReceived = true;
        expect(data.revealed).toBe(true);
        expect(data.stats.min).toBe(3);
        expect(data.stats.max).toBe(8);
        expect(data.stats.median).toBe(5);
        expect(data.stats.average).toBeCloseTo(5.3, 1);
        
        // Find each user's vote
        const votes = data.users.map(u => u.vote).sort((a, b) => a - b);
        expect(votes).toEqual([3, 5, 8]);
        
        clients.forEach(c => c.disconnect());
        done();
      } else if (!votingStarted && data.users.length === 3) {
        // All three users joined - start voting using the actual room creator to reveal
        votingStarted = true;
        client1.emit('vote', { roomId: 'STATS', vote: 3 });
        client2.emit('vote', { roomId: 'STATS', vote: 5 });
        client3.emit('vote', { roomId: 'STATS', vote: 8 });
        
        setTimeout(() => {
          const creator = clients.find(c => c.id === data.creatorId);
          if (creator) creator.emit('reveal', { roomId: 'STATS' });
        }, 200);
      }
    };
    
    client1.on('room-update', onRoomUpdate);
    client2.on('room-update', onRoomUpdate);
    client3.on('room-update', onRoomUpdate);
    
    client1.emit('join-room', { roomId: 'STATS', userName: 'User1', isObserver: false });
    client2.emit('join-room', { roomId: 'STATS', userName: 'User2', isObserver: false });
    client3.emit('join-room', { roomId: 'STATS', userName: 'User3', isObserver: false });
  });
  
  test('should exclude observer votes from statistics', (done) => {
    const client1 = Client(serverUrl);
    const client2 = Client(serverUrl);
    
    let joinCount = 0;
    let revealReceived = false;
    
    const handleJoin = () => {
      joinCount++;
      if (joinCount === 2) {
        client1.emit('vote', { roomId: 'OBSSTAT', vote: 5 });
        client2.emit('vote', { roomId: 'OBSSTAT', vote: 100 }); // Observer vote should be ignored
        
        setTimeout(() => {
          client1.emit('reveal', { roomId: 'OBSSTAT' });
        }, 100);
      }
    };
    
    client1.on('room-update', (data) => {
      if (!revealReceived && data.revealed) {
        revealReceived = true;
        expect(data.stats.average).toBe(5);
        expect(data.stats.min).toBe(5);
        expect(data.stats.max).toBe(5);
        
        client1.disconnect();
        client2.disconnect();
        done();
      } else if (joinCount < 2) {
        handleJoin();
      }
    });
    
    client2.on('room-update', handleJoin);
    
    client1.emit('join-room', { roomId: 'OBSSTAT', userName: 'Voter', isObserver: false });
    client2.emit('join-room', { roomId: 'OBSSTAT', userName: 'Observer', isObserver: true });
  });
  
  test('should calculate median correctly for even number of votes', (done) => {
    const client1 = Client(serverUrl);
    const client2 = Client(serverUrl);
    
    let joinCount = 0;
    let revealReceived = false;
    
    const handleJoin = () => {
      joinCount++;
      if (joinCount === 2) {
        client1.emit('vote', { roomId: 'MEDIAN', vote: 2 });
        client2.emit('vote', { roomId: 'MEDIAN', vote: 8 });
        
        setTimeout(() => {
          client1.emit('reveal', { roomId: 'MEDIAN' });
        }, 100);
      }
    };
    
    client1.on('room-update', (data) => {
      if (!revealReceived && data.revealed && data.stats) {
        revealReceived = true;
        expect(data.stats.median).toBe(5); // (2 + 8) / 2 = 5
        
        client1.disconnect();
        client2.disconnect();
        done();
      } else if (joinCount < 2) {
        handleJoin();
      }
    });
    
    client2.on('room-update', handleJoin);
    
    client1.emit('join-room', { roomId: 'MEDIAN', userName: 'User1', isObserver: false });
    client2.emit('join-room', { roomId: 'MEDIAN', userName: 'User2', isObserver: false });
  });
});

describe('Socket.IO Reset', () => {
  let testServer;
  let server;
  let io;
  let clientSocket;
  let serverUrl;
  
  beforeEach((done) => {
    testServer = createTestServer();
    server = testServer.server;
    io = testServer.io;
    
    server.listen(() => {
      const port = server.address().port;
      serverUrl = `http://localhost:${port}`;
      clientSocket = Client(serverUrl);
      
      clientSocket.on('connect', () => {
        done();
      });
    });
  });
  
  afterEach((done) => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
    io.close();
    server.close(done);
  });
  
  test('should reset votes and revealed state', (done) => {
    let updateCount = 0;
    
    clientSocket.on('room-update', (data) => {
      updateCount++;
      
      if (updateCount === 1) {
        // Initial join - vote now
        setTimeout(() => {
          clientSocket.emit('vote', {
            roomId: 'RESET123',
            vote: 13
          });
        }, 50);
      } else if (updateCount === 2) {
        // After vote - reveal now
        setTimeout(() => {
          clientSocket.emit('reveal', { roomId: 'RESET123' });
        }, 50);
      } else if (updateCount === 3) {
        // After reveal
        expect(data.revealed).toBe(true);
        setTimeout(() => {
          clientSocket.emit('reset', { roomId: 'RESET123' });
        }, 50);
      } else if (updateCount === 4) {
        // After reset
        expect(data.revealed).toBe(false);
        expect(data.users[0].vote).toBe(null);
        clientSocket.disconnect();
        done();
      }
    });
    
    clientSocket.emit('join-room', {
      roomId: 'RESET123',
      userName: 'Voter',
      isObserver: false
    });
  });
});

describe('Room Cleanup', () => {
  let testServer;
  let server;
  let io;
  let rooms;
  let serverUrl;
  
  beforeEach((done) => {
    testServer = createTestServer();
    server = testServer.server;
    io = testServer.io;
    rooms = testServer.rooms;
    
    server.listen(() => {
      const port = server.address().port;
      serverUrl = `http://localhost:${port}`;
      done();
    });
  });
  
  afterEach((done) => {
    io.close();
    server.close(done);
  });
  
  test('should delete room when last user disconnects', (done) => {
    const clientSocket = Client(serverUrl);
    
    clientSocket.on('room-update', () => {
      expect(rooms.has('CLEANUP')).toBe(true);
      
      clientSocket.disconnect();
      
      setTimeout(() => {
        expect(rooms.has('CLEANUP')).toBe(false);
        done();
      }, 100);
    });
    
    clientSocket.emit('join-room', {
      roomId: 'CLEANUP',
      userName: 'LastUser',
      isObserver: false
    });
  });
  
  test('should keep room when other users remain', (done) => {
    const client1 = Client(serverUrl);
    const client2 = Client(serverUrl);
    
    let joinCount = 0;
    
    const handleJoin = () => {
      joinCount++;
      if (joinCount === 2) {
        expect(rooms.has('KEEPROOM')).toBe(true);
        
        client1.disconnect();
        
        setTimeout(() => {
          expect(rooms.has('KEEPROOM')).toBe(true);
          client2.disconnect();
          
          setTimeout(() => {
            expect(rooms.has('KEEPROOM')).toBe(false);
            done();
          }, 100);
        }, 100);
      }
    };
    
    client1.on('room-update', handleJoin);
    client2.on('room-update', handleJoin);
    
    client1.emit('join-room', { roomId: 'KEEPROOM', userName: 'User1', isObserver: false });
    client2.emit('join-room', { roomId: 'KEEPROOM', userName: 'User2', isObserver: false });
  });
});

describe('Remove Participant', () => {
  let testServer;
  let server;
  let io;
  let rooms;
  let serverUrl;
  
  beforeEach((done) => {
    testServer = createTestServer();
    server = testServer.server;
    io = testServer.io;
    rooms = testServer.rooms;
    
    server.listen(() => {
      const port = server.address().port;
      serverUrl = `http://localhost:${port}`;
      done();
    });
  });
  
  afterEach((done) => {
    io.close();
    server.close(done);
  });
  
  test('room creator should be tracked correctly', (done) => {
    const creator = Client(serverUrl);
    
    creator.on('room-update', (data) => {
      expect(data.creatorId).toBeDefined();
      expect(data.creatorId).toBe(creator.id);
      creator.disconnect();
      done();
    });
    
    creator.emit('join-room', {
      roomId: 'CREATOR_TEST',
      userName: 'Creator',
      isObserver: false
    });
  });
  
  test('room creator should be able to remove other participants', (done) => {
    const creator = Client(serverUrl);
    const participant = Client(serverUrl);
    
    let creatorUpdateCount = 0;
    let participantRemoved = false;
    
    creator.on('room-update', (data) => {
      creatorUpdateCount++;
      
      if (creatorUpdateCount === 2) {
        // Both users have joined
        expect(data.users).toHaveLength(2);
        
        // Creator removes the participant
        const participantId = data.users.find(u => u.name === 'Participant').id;
        creator.emit('remove-participant', {
          roomId: 'REMOVE_TEST',
          participantId: participantId
        });
      } else if (creatorUpdateCount === 3) {
        // Participant should be removed
        expect(data.users).toHaveLength(1);
        expect(data.users[0].name).toBe('Creator');
        expect(participantRemoved).toBe(true);
        creator.disconnect();
        done();
      }
    });
    
    participant.on('removed-from-room', (data) => {
      expect(data.roomId).toBe('REMOVE_TEST');
      participantRemoved = true;
      participant.disconnect();
    });
    
    creator.emit('join-room', {
      roomId: 'REMOVE_TEST',
      userName: 'Creator',
      isObserver: false
    });
    
    setTimeout(() => {
      participant.emit('join-room', {
        roomId: 'REMOVE_TEST',
        userName: 'Participant',
        isObserver: false
      });
    }, 100);
  });
  
  test('non-creator should not be able to remove participants', (done) => {
    const creator = Client(serverUrl);
    const participant1 = Client(serverUrl);
    const participant2 = Client(serverUrl);
    
    let creatorJoinCount = 0;
    
    creator.on('room-update', (data) => {
      creatorJoinCount++;
      
      if (data.users.length === 3 && creatorJoinCount === 3) {
        // All three have joined, now participant1 tries to remove participant2 (should fail)
        const participant2Id = data.users.find(u => u.name === 'Participant2').id;
        participant1.emit('remove-participant', {
          roomId: 'AUTH_TEST',
          participantId: participant2Id
        });
        
        // Wait and verify participant2 is still in the room
        setTimeout(() => {
          const room = rooms.get('AUTH_TEST');
          expect(room.users.size).toBe(3);
          creator.disconnect();
          participant1.disconnect();
          participant2.disconnect();
          done();
        }, 200);
      }
    });
    
    creator.emit('join-room', { roomId: 'AUTH_TEST', userName: 'Creator', isObserver: false });
    
    setTimeout(() => {
      participant1.emit('join-room', { roomId: 'AUTH_TEST', userName: 'Participant1', isObserver: false });
    }, 50);
    
    setTimeout(() => {
      participant2.emit('join-room', { roomId: 'AUTH_TEST', userName: 'Participant2', isObserver: false });
    }, 100);
  });
  
  test('room creator should not be able to remove themselves', (done) => {
    const creator = Client(serverUrl);
    
    creator.on('room-update', (data) => {
      expect(data.users).toHaveLength(1);
      
      // Try to remove self (should fail)
      creator.emit('remove-participant', {
        roomId: 'SELF_REMOVE_TEST',
        participantId: creator.id
      });
      
      // Wait and verify creator is still in the room
      setTimeout(() => {
        const room = rooms.get('SELF_REMOVE_TEST');
        expect(room.users.size).toBe(1);
        creator.disconnect();
        done();
      }, 200);
    });
    
    creator.emit('join-room', {
      roomId: 'SELF_REMOVE_TEST',
      userName: 'Creator',
      isObserver: false
    });
  });
});

describe('Reveal and Reset Authorization', () => {
  let testServer;
  let server;
  let io;
  let rooms;
  let serverUrl;
  
  beforeEach((done) => {
    testServer = createTestServer();
    server = testServer.server;
    io = testServer.io;
    rooms = testServer.rooms;
    
    server.listen(() => {
      const port = server.address().port;
      serverUrl = `http://localhost:${port}`;
      done();
    });
  });
  
  afterEach((done) => {
    io.close();
    server.close(done);
  });
  
  test('only room creator should be able to reveal cards', (done) => {
    const creator = Client(serverUrl);
    const participant = Client(serverUrl);
    const localRooms = rooms;
    
    let joinCount = 0;
    let revealReceived = false;
    
    const handleJoin = () => {
      joinCount++;
      if (joinCount === 2) {
        // Both users have joined, now vote
        creator.emit('vote', { roomId: 'REVEAL_AUTH', vote: 5 });
        participant.emit('vote', { roomId: 'REVEAL_AUTH', vote: 8 });
        
        setTimeout(() => {
          // Participant tries to reveal (should fail)
          participant.emit('reveal', { roomId: 'REVEAL_AUTH' });
          
          // Wait and verify cards are NOT revealed
          setTimeout(() => {
            const room = localRooms.get('REVEAL_AUTH');
            expect(room.revealed).toBe(false);
            
            // Now creator reveals (should succeed)
            creator.emit('reveal', { roomId: 'REVEAL_AUTH' });
          }, 200);
        }, 100);
      }
    };
    
    creator.on('room-update', (data) => {
      if (!revealReceived && data.revealed) {
        // Cards should now be revealed by creator
        revealReceived = true;
        expect(data.revealed).toBe(true);
        creator.disconnect();
        participant.disconnect();
        done();
      } else if (joinCount < 2) {
        handleJoin();
      }
    });
    
    participant.on('room-update', handleJoin);
    
    creator.emit('join-room', { roomId: 'REVEAL_AUTH', userName: 'Creator', isObserver: false });
    participant.emit('join-room', { roomId: 'REVEAL_AUTH', userName: 'Participant', isObserver: false });
  });
  
  test('only room creator should be able to reset votes', (done) => {
    const creator = Client(serverUrl);
    const participant = Client(serverUrl);
    
    let joinCount = 0;
    let votesDone = false;
    let revealDone = false;
    let unauthorizedResetAttempted = false;
    
    const handleJoin = () => {
      joinCount++;
      if (joinCount === 2 && !votesDone) {
        // Both users have joined, vote and reveal
        votesDone = true;
        creator.emit('vote', { roomId: 'RESET_AUTH', vote: 5 });
        participant.emit('vote', { roomId: 'RESET_AUTH', vote: 8 });
        
        setTimeout(() => {
          creator.emit('reveal', { roomId: 'RESET_AUTH' });
        }, 100);
      }
    };
    
    creator.on('room-update', (data) => {
      if (joinCount < 2) {
        handleJoin();
      } else if (data.revealed && !revealDone) {
        // Cards are revealed, participant tries to reset (should fail)
        revealDone = true;
        participant.emit('reset', { roomId: 'RESET_AUTH' });
        
        // Wait and verify votes are NOT reset
        setTimeout(() => {
          const room = rooms.get('RESET_AUTH');
          expect(room.revealed).toBe(true);
          unauthorizedResetAttempted = true;
          
          // Now creator resets (should succeed)
          creator.emit('reset', { roomId: 'RESET_AUTH' });
        }, 200);
      } else if (!data.revealed && unauthorizedResetAttempted) {
        // Votes should now be reset by creator
        expect(data.revealed).toBe(false);
        expect(data.users.every(u => u.vote === null)).toBe(true);
        creator.disconnect();
        participant.disconnect();
        done();
      }
    });
    
    participant.on('room-update', handleJoin);
    
    creator.emit('join-room', { roomId: 'RESET_AUTH', userName: 'Creator', isObserver: false });
    // Delay participant join to ensure creator is established as room creator first
    setTimeout(() => {
      participant.emit('join-room', { roomId: 'RESET_AUTH', userName: 'Participant', isObserver: false });
    }, 100);
  });
  
  test('room creator who is an observer should be able to reveal cards', (done) => {
    const creatorObserver = Client(serverUrl);
    const participant = Client(serverUrl);
    
    let joinCount = 0;
    let revealReceived = false;
    
    const handleJoin = () => {
      joinCount++;
      if (joinCount === 2) {
        // Both users have joined, participant votes
        participant.emit('vote', { roomId: 'OBSERVER_CREATOR', vote: 5 });
        
        setTimeout(() => {
          // Creator observer reveals (should succeed)
          creatorObserver.emit('reveal', { roomId: 'OBSERVER_CREATOR' });
        }, 100);
      }
    };
    
    creatorObserver.on('room-update', (data) => {
      if (!revealReceived && data.revealed) {
        // Cards should be revealed by creator observer
        revealReceived = true;
        expect(data.revealed).toBe(true);
        creatorObserver.disconnect();
        participant.disconnect();
        done();
      } else if (joinCount < 2) {
        handleJoin();
      }
    });
    
    participant.on('room-update', handleJoin);
    
    creatorObserver.emit('join-room', { roomId: 'OBSERVER_CREATOR', userName: 'CreatorObserver', isObserver: true });
    participant.emit('join-room', { roomId: 'OBSERVER_CREATOR', userName: 'Participant', isObserver: false });
  });
  
  test('room creator who is an observer should be able to reset votes', (done) => {
    const creatorObserver = Client(serverUrl);
    const participant = Client(serverUrl);
    
    let joinCount = 0;
    let votesDone = false;
    let revealDone = false;
    
    const handleJoin = () => {
      joinCount++;
      if (joinCount === 2 && !votesDone) {
        // Both users have joined, participant votes
        votesDone = true;
        participant.emit('vote', { roomId: 'OBSERVER_RESET', vote: 5 });
        
        setTimeout(() => {
          // Creator observer reveals
          creatorObserver.emit('reveal', { roomId: 'OBSERVER_RESET' });
        }, 100);
      }
    };
    
    creatorObserver.on('room-update', (data) => {
      if (joinCount < 2) {
        handleJoin();
      } else if (data.revealed && !revealDone) {
        // Cards revealed, creator observer resets
        revealDone = true;
        creatorObserver.emit('reset', { roomId: 'OBSERVER_RESET' });
      } else if (!data.revealed && revealDone) {
        // Votes should be reset by creator observer
        expect(data.revealed).toBe(false);
        expect(data.users.every(u => u.vote === null)).toBe(true);
        creatorObserver.disconnect();
        participant.disconnect();
        done();
      }
    });
    
    participant.on('room-update', handleJoin);
    
    creatorObserver.emit('join-room', { roomId: 'OBSERVER_RESET', userName: 'CreatorObserver', isObserver: true });
    participant.emit('join-room', { roomId: 'OBSERVER_RESET', userName: 'Participant', isObserver: false });
  });
});

describe('Multi-User Room Capacity', () => {
  let testServer;
  let server;
  let io;
  let rooms;
  let serverUrl;
  
  beforeEach((done) => {
    testServer = createTestServer();
    server = testServer.server;
    io = testServer.io;
    rooms = testServer.rooms;
    
    server.listen(() => {
      const port = server.address().port;
      serverUrl = `http://localhost:${port}`;
      done();
    });
  });
  
  afterEach((done) => {
    io.close();
    server.close(done);
  });
  
  test('should support 20 users in the same room', (done) => {
    const roomId = 'CAPACITY20';
    const clients = [];
    const receivedUpdates = new Map();
    let joinedCount = 0;
    
    const checkComplete = () => {
      joinedCount++;
      
      if (joinedCount === 20) {
        // All users joined, wait a bit and verify
        setTimeout(() => {
          const room = rooms.get(roomId);
          expect(room.users.size).toBe(20);
          
          // Check that all clients received final update
          let allClientsHave20 = true;
          clients.forEach((client, index) => {
            const updates = receivedUpdates.get(index);
            if (updates && updates.length > 0) {
              const lastUpdate = updates[updates.length - 1];
              if (lastUpdate.users.length !== 20) {
                allClientsHave20 = false;
              }
            } else {
              allClientsHave20 = false;
            }
          });
          
          expect(allClientsHave20).toBe(true);
          
          // Cleanup
          clients.forEach(c => c.disconnect());
          done();
        }, VERIFICATION_DELAY_MS);
      }
    };
    
    // Create 20 clients
    for (let i = 0; i < 20; i++) {
      const client = Client(serverUrl);
      clients.push(client);
      receivedUpdates.set(i, []);
      
      client.on('room-update', (data) => {
        receivedUpdates.get(i).push(data);
      });
      
      client.on('connect', () => {
        client.emit('join-room', {
          roomId: roomId,
          userName: `User${i + 1}`,
          isObserver: false
        });
        checkComplete();
      });
    }
  }, 30000);
  
  test('should not disconnect existing users when new users join', (done) => {
    const roomId = 'NODISCONNECT';
    const clients = [];
    let disconnectionOccurred = false;
    
    // Create first 5 clients
    const createClients = (count, startIndex, callback) => {
      let connected = 0;
      for (let i = startIndex; i < startIndex + count; i++) {
        const client = Client(serverUrl);
        clients.push(client);
        
        // Monitor disconnections
        client.on('disconnect', (reason) => {
          if (reason !== 'io client disconnect') {
            // Unexpected disconnection
            disconnectionOccurred = true;
          }
        });
        
        client.on('connect', () => {
          client.emit('join-room', {
            roomId: roomId,
            userName: `User${i + 1}`,
            isObserver: false
          });
          connected++;
          if (connected === count) {
            callback();
          }
        });
      }
    };
    
    // First batch: 5 users
    createClients(5, 0, () => {
      setTimeout(() => {
        // Second batch: 10 more users (total 15)
        createClients(10, 5, () => {
          setTimeout(() => {
            // Third batch: 5 more users (total 20)
            createClients(5, 15, () => {
              setTimeout(() => {
                // Verify no disconnections occurred
                expect(disconnectionOccurred).toBe(false);
                
                // Verify all clients are still connected
                let connectedCount = 0;
                clients.forEach(c => {
                  if (c.connected) connectedCount++;
                });
                expect(connectedCount).toBe(20);
                
                // Verify room has all users
                const room = rooms.get(roomId);
                expect(room.users.size).toBe(20);
                
                // Cleanup
                clients.forEach(c => c.disconnect());
                done();
              }, BATCH_JOIN_DELAY_MS);
            });
          }, BATCH_JOIN_DELAY_MS);
        });
      }, BATCH_JOIN_DELAY_MS);
    });
  }, 30000);
});

describe('Card Set', () => {
  let testServer;
  let server;
  let io;
  let rooms;
  let serverUrl;

  beforeEach((done) => {
    testServer = createTestServer();
    server = testServer.server;
    io = testServer.io;
    rooms = testServer.rooms;

    server.listen(() => {
      const port = server.address().port;
      serverUrl = `http://localhost:${port}`;
      done();
    });
  });

  afterEach((done) => {
    io.close();
    server.close(done);
  });

  test('should default to standard card set when none specified', (done) => {
    const client = Client(serverUrl);

    client.on('room-update', (data) => {
      expect(data.cardSet).toBe('standard');
      client.disconnect();
      done();
    });

    client.emit('join-room', { roomId: 'CARDSET_DEFAULT', userName: 'Alice', isObserver: false });
  });

  test('should use specified card set when creating a room', (done) => {
    const client = Client(serverUrl);

    client.on('room-update', (data) => {
      expect(data.cardSet).toBe('fibonacci');
      client.disconnect();
      done();
    });

    client.emit('join-room', { roomId: 'CARDSET_FIB', userName: 'Alice', isObserver: false, cardSet: 'fibonacci' });
  });

  test('should use room creator card set for subsequent joiners', (done) => {
    const creator = Client(serverUrl);
    const joiner = Client(serverUrl);

    let joinCount = 0;

    const handleUpdate = (data) => {
      joinCount++;
      if (joinCount === 2) {
        expect(data.cardSet).toBe('tshirt');
        creator.disconnect();
        joiner.disconnect();
        done();
      }
    };

    creator.on('room-update', handleUpdate);
    joiner.on('room-update', handleUpdate);

    creator.emit('join-room', { roomId: 'CARDSET_ROOM', userName: 'Creator', isObserver: false, cardSet: 'tshirt' });

    setTimeout(() => {
      // Joiner specifies a different card set, but should get the room's card set
      joiner.emit('join-room', { roomId: 'CARDSET_ROOM', userName: 'Joiner', isObserver: false, cardSet: 'powers2' });
    }, 100);
  });

  test('should persist card set through reveal and reset', (done) => {
    const client = Client(serverUrl);
    let updateCount = 0;

    client.on('room-update', (data) => {
      updateCount++;
      expect(data.cardSet).toBe('powers2');

      if (updateCount === 1) {
        client.emit('vote', { roomId: 'CARDSET_PERSIST', vote: 4 });
      } else if (updateCount === 2) {
        client.emit('reveal', { roomId: 'CARDSET_PERSIST' });
      } else if (updateCount === 3) {
        expect(data.revealed).toBe(true);
        client.emit('reset', { roomId: 'CARDSET_PERSIST' });
      } else if (updateCount === 4) {
        expect(data.revealed).toBe(false);
        client.disconnect();
        done();
      }
    });

    client.emit('join-room', { roomId: 'CARDSET_PERSIST', userName: 'Alice', isObserver: false, cardSet: 'powers2' });
  });
});

describe('Story Title', () => {
  let testServer;
  let server;
  let io;
  let rooms;
  let serverUrl;

  beforeEach((done) => {
    testServer = createTestServer();
    server = testServer.server;
    io = testServer.io;
    rooms = testServer.rooms;

    server.listen(() => {
      const port = server.address().port;
      serverUrl = `http://localhost:${port}`;
      done();
    });
  });

  afterEach((done) => {
    io.close();
    server.close(done);
  });

  test('should include empty storyTitle in room-update by default', (done) => {
    const client = Client(serverUrl);

    client.on('room-update', (data) => {
      expect(data.storyTitle).toBe('');
      client.disconnect();
      done();
    });

    client.emit('join-room', { roomId: 'STORY_DEFAULT', userName: 'Alice', isObserver: false });
  });

  test('should allow host to set story title', (done) => {
    const client = Client(serverUrl);
    let updateCount = 0;

    client.on('room-update', (data) => {
      updateCount++;
      if (updateCount === 1) {
        client.emit('set-story', { roomId: 'STORY_SET', storyTitle: 'User Login Feature' });
      } else if (updateCount === 2) {
        expect(data.storyTitle).toBe('User Login Feature');
        client.disconnect();
        done();
      }
    });

    client.emit('join-room', { roomId: 'STORY_SET', userName: 'Host', isObserver: false });
  });

  test('should not allow non-host to set story title', (done) => {
    const host = Client(serverUrl);
    const participant = Client(serverUrl);
    let joinCount = 0;

    host.on('room-update', (data) => {
      joinCount++;
      if (joinCount === 2) {
        // Participant tries to set story (should be ignored)
        participant.emit('set-story', { roomId: 'STORY_AUTH', storyTitle: 'Unauthorized Story' });

        setTimeout(() => {
          const room = rooms.get('STORY_AUTH');
          expect(room.storyTitle).toBe('');
          host.disconnect();
          participant.disconnect();
          done();
        }, 200);
      }
    });

    host.emit('join-room', { roomId: 'STORY_AUTH', userName: 'Host', isObserver: false });
    setTimeout(() => {
      participant.emit('join-room', { roomId: 'STORY_AUTH', userName: 'Participant', isObserver: false });
    }, 50);
  });

  test('should truncate story title to 200 characters', (done) => {
    const client = Client(serverUrl);
    let updateCount = 0;
    const longTitle = 'A'.repeat(250);

    client.on('room-update', (data) => {
      updateCount++;
      if (updateCount === 1) {
        client.emit('set-story', { roomId: 'STORY_TRUNC', storyTitle: longTitle });
      } else if (updateCount === 2) {
        expect(data.storyTitle).toHaveLength(200);
        client.disconnect();
        done();
      }
    });

    client.emit('join-room', { roomId: 'STORY_TRUNC', userName: 'Host', isObserver: false });
  });

  test('should broadcast story title to all room participants', (done) => {
    const host = Client(serverUrl);
    const participant = Client(serverUrl);
    let joinCount = 0;
    let receivedByParticipant = false;

    const handleJoin = () => {
      joinCount++;
      if (joinCount === 2) {
        host.emit('set-story', { roomId: 'STORY_BROADCAST', storyTitle: 'Shared Story' });
      }
    };

    host.on('room-update', handleJoin);
    participant.on('room-update', (data) => {
      handleJoin();
      if (data.storyTitle === 'Shared Story') {
        receivedByParticipant = true;
        expect(receivedByParticipant).toBe(true);
        host.disconnect();
        participant.disconnect();
        done();
      }
    });

    host.emit('join-room', { roomId: 'STORY_BROADCAST', userName: 'Host', isObserver: false });
    setTimeout(() => {
      participant.emit('join-room', { roomId: 'STORY_BROADCAST', userName: 'Participant', isObserver: false });
    }, 50);
  });
});

describe('Auto-Reveal', () => {
  let testServer;
  let server;
  let io;
  let rooms;
  let serverUrl;

  beforeEach((done) => {
    testServer = createTestServer();
    server = testServer.server;
    io = testServer.io;
    rooms = testServer.rooms;

    server.listen(() => {
      const port = server.address().port;
      serverUrl = `http://localhost:${port}`;
      done();
    });
  });

  afterEach((done) => {
    io.close();
    server.close(done);
  });

  test('should include autoReveal false in room-update by default', (done) => {
    const client = Client(serverUrl);

    client.on('room-update', (data) => {
      expect(data.autoReveal).toBe(false);
      client.disconnect();
      done();
    });

    client.emit('join-room', { roomId: 'AR_DEFAULT', userName: 'Alice', isObserver: false });
  });

  test('should allow host to toggle auto-reveal', (done) => {
    const client = Client(serverUrl);
    let updateCount = 0;

    client.on('room-update', (data) => {
      updateCount++;
      if (updateCount === 1) {
        client.emit('toggle-auto-reveal', { roomId: 'AR_TOGGLE', autoReveal: true });
      } else if (updateCount === 2) {
        expect(data.autoReveal).toBe(true);
        client.disconnect();
        done();
      }
    });

    client.emit('join-room', { roomId: 'AR_TOGGLE', userName: 'Host', isObserver: false });
  });

  test('should not allow non-host to toggle auto-reveal', (done) => {
    const host = Client(serverUrl);
    const participant = Client(serverUrl);
    let joinCount = 0;

    host.on('room-update', (data) => {
      joinCount++;
      if (joinCount === 2) {
        participant.emit('toggle-auto-reveal', { roomId: 'AR_AUTH', autoReveal: true });

        setTimeout(() => {
          const room = rooms.get('AR_AUTH');
          expect(room.autoReveal).toBe(false);
          host.disconnect();
          participant.disconnect();
          done();
        }, 200);
      }
    });

    host.emit('join-room', { roomId: 'AR_AUTH', userName: 'Host', isObserver: false });
    setTimeout(() => {
      participant.emit('join-room', { roomId: 'AR_AUTH', userName: 'Participant', isObserver: false });
    }, 50);
  });

  test('should auto-reveal when all voters have voted and auto-reveal is enabled', (done) => {
    const host = Client(serverUrl);
    const participant = Client(serverUrl);
    let joinCount = 0;
    let autoRevealEnabled = false;
    let revealReceived = false;

    const handleJoin = () => {
      joinCount++;
      if (joinCount === 2 && !autoRevealEnabled) {
        autoRevealEnabled = true;
        host.emit('toggle-auto-reveal', { roomId: 'AR_ALL_VOTED', autoReveal: true });
      }
    };

    host.on('room-update', (data) => {
      handleJoin();
      if (!revealReceived && data.revealed) {
        revealReceived = true;
        expect(data.revealed).toBe(true);
        expect(data.stats).not.toBeNull();
        host.disconnect();
        participant.disconnect();
        done();
      } else if (autoRevealEnabled && data.autoReveal && !revealReceived) {
        // Auto-reveal is set; now both users vote
        host.emit('vote', { roomId: 'AR_ALL_VOTED', vote: 5 });
        participant.emit('vote', { roomId: 'AR_ALL_VOTED', vote: 8 });
      }
    });

    participant.on('room-update', handleJoin);

    host.emit('join-room', { roomId: 'AR_ALL_VOTED', userName: 'Host', isObserver: false });
    setTimeout(() => {
      participant.emit('join-room', { roomId: 'AR_ALL_VOTED', userName: 'Participant', isObserver: false });
    }, 50);
  });

  test('should not auto-reveal when auto-reveal is disabled', (done) => {
    const client = Client(serverUrl);
    let updateCount = 0;

    client.on('room-update', (data) => {
      updateCount++;
      if (updateCount === 1) {
        // Auto-reveal is off (default); vote immediately
        client.emit('vote', { roomId: 'AR_DISABLED', vote: 5 });
      } else if (updateCount === 2) {
        // Vote recorded, should NOT be auto-revealed
        expect(data.revealed).toBe(false);
        expect(data.autoReveal).toBe(false);
        setTimeout(() => {
          client.disconnect();
          done();
        }, 200);
      }
    });

    client.emit('join-room', { roomId: 'AR_DISABLED', userName: 'Voter', isObserver: false });
  });

  test('should not auto-reveal when only observers are in the room', (done) => {
    const host = Client(serverUrl);
    let autoRevealEnabled = false;

    host.on('room-update', (data) => {
      if (!autoRevealEnabled) {
        autoRevealEnabled = true;
        host.emit('toggle-auto-reveal', { roomId: 'AR_OBSERVERS', autoReveal: true });
      } else if (data.autoReveal) {
        // Auto-reveal enabled with only an observer, should not trigger reveal
        setTimeout(() => {
          const room = rooms.get('AR_OBSERVERS');
          expect(room.revealed).toBe(false);
          host.disconnect();
          done();
        }, 200);
      }
    });

    host.emit('join-room', { roomId: 'AR_OBSERVERS', userName: 'HostObserver', isObserver: true });
  });
});
