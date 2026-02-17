const request = require('supertest');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { io: Client } = require('socket.io-client');

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
    socket.on('join-room', ({ roomId, userName, isObserver }) => {
      if (!rooms.has(roomId)) {
        rooms.set(roomId, {
          id: roomId,
          users: new Map(),
          revealed: false,
          createdAt: new Date()
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
      
      const user = room.users.get(socket.id);
      if (!user) return;
      
      user.vote = vote;
      emitRoomUpdate(roomId);
    });
    
    socket.on('reveal', ({ roomId }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      
      room.revealed = true;
      emitRoomUpdate(roomId);
    });
    
    socket.on('reset', ({ roomId }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      
      room.revealed = false;
      room.users.forEach(user => {
        user.vote = null;
      });
      emitRoomUpdate(roomId);
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
        stats
      });
    }
  });
  
  return { app, server, io, rooms };
}

describe('Server Health Checks', () => {
  let testServer;
  let server;
  
  beforeEach((done) => {
    testServer = createTestServer();
    server = testServer.server;
    server.listen(() => {
      done();
    });
  });
  
  afterEach((done) => {
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
    
    let joinCount = 0;
    let revealReceived = false;
    
    const handleJoin = () => {
      joinCount++;
      if (joinCount === 3) {
        // All joined, now vote
        client1.emit('vote', { roomId: 'STATS', vote: 3 });
        client2.emit('vote', { roomId: 'STATS', vote: 5 });
        client3.emit('vote', { roomId: 'STATS', vote: 8 });
        
        setTimeout(() => {
          client1.emit('reveal', { roomId: 'STATS' });
        }, 200);
      }
    };
    
    client1.on('room-update', (data) => {
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
        
        client1.disconnect();
        client2.disconnect();
        client3.disconnect();
        done();
      } else if (joinCount < 3) {
        handleJoin();
      }
    });
    
    client2.on('room-update', handleJoin);
    client3.on('room-update', handleJoin);
    
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
      console.log(`User ${joinedCount} joined`);
      
      if (joinedCount === 20) {
        // All users joined, wait a bit and verify
        setTimeout(() => {
          const room = rooms.get(roomId);
          console.log(`Room has ${room.users.size} users`);
          expect(room.users.size).toBe(20);
          
          // Check that all clients received final update
          let allClientsHave20 = true;
          clients.forEach((client, index) => {
            const updates = receivedUpdates.get(index);
            if (updates && updates.length > 0) {
              const lastUpdate = updates[updates.length - 1];
              console.log(`Client ${index} last update has ${lastUpdate.users.length} users`);
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
        }, 1000);
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
});
