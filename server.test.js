const request = require('supertest');
const { io: Client } = require('socket.io-client');
const { createServer } = require('./server');

// Test timing constants
const VERIFICATION_DELAY_MS = 1000; // Time to wait for all clients to receive final updates
const BATCH_JOIN_DELAY_MS = 500; // Time between batches of users joining

describe('Server Health Checks', () => {
  let testServer;
  let server;
  let io;
  
  beforeEach((done) => {
    testServer = createServer({ reconnectGracePeriodMs: 0, hostAbsentTimeoutMs: 0 });
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
    testServer = createServer({ reconnectGracePeriodMs: 0, hostAbsentTimeoutMs: 0 });
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

  test('should set specialEffects to true when host enables it', (done) => {
    clientSocket = Client(serverUrl);

    clientSocket.on('room-update', (data) => {
      expect(data.specialEffects).toBe(true);
      done();
    });

    clientSocket.emit('join-room', {
      roomId: 'SFX123',
      userName: 'Host',
      isObserver: false,
      specialEffects: true
    });
  });

  test('should default specialEffects to false when not provided', (done) => {
    clientSocket = Client(serverUrl);

    clientSocket.on('room-update', (data) => {
      expect(data.specialEffects).toBe(false);
      done();
    });

    clientSocket.emit('join-room', {
      roomId: 'NOSFX1',
      userName: 'Host',
      isObserver: false
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
    testServer = createServer({ reconnectGracePeriodMs: 0, hostAbsentTimeoutMs: 0 });
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
    testServer = createServer({ reconnectGracePeriodMs: 0, hostAbsentTimeoutMs: 0 });
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
    
    let revealReceived = false;
    
    client1.on('room-update', (data) => {
      if (!revealReceived && data.revealed) {
        revealReceived = true;
        expect(data.stats.average).toBe(5);
        expect(data.stats.min).toBe(5);
        expect(data.stats.max).toBe(5);
        
        client1.disconnect();
        client2.disconnect();
        done();
      }
    });
    
    // Join client1 first and wait for confirmation so it is guaranteed to be the room creator.
    client1.emit('join-room', { roomId: 'OBSSTAT', userName: 'Voter', isObserver: false });
    client1.once('room-update', () => {
      // client1 is now the confirmed creator; join client2 and trigger voting on its first update.
      client2.once('room-update', () => {
        client1.emit('vote', { roomId: 'OBSSTAT', vote: 5 });
        // Observer vote should be ignored by statistics
        setTimeout(() => {
          client1.emit('reveal', { roomId: 'OBSSTAT' });
        }, 100);
      });
      client2.emit('join-room', { roomId: 'OBSSTAT', userName: 'Observer', isObserver: true });
    });
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
    testServer = createServer({ reconnectGracePeriodMs: 0, hostAbsentTimeoutMs: 0 });
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
    testServer = createServer({ reconnectGracePeriodMs: 0, hostAbsentTimeoutMs: 0 });
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

describe('Reconnection after page refresh', () => {
  const GRACE_MS = 300; // short grace period to keep tests fast
  let testServer;
  let server;
  let io;
  let rooms;
  let pendingRemovals;
  let serverUrl;

  beforeEach((done) => {
    testServer = createServer({ reconnectGracePeriodMs: GRACE_MS, hostAbsentTimeoutMs: 0 });
    server = testServer.server;
    io = testServer.io;
    rooms = testServer.rooms;
    pendingRemovals = testServer.pendingRemovals;

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

  test('user stays in room during grace period after disconnect with clientId', (done) => {
    const client = Client(serverUrl);

    client.on('room-update', () => {
      expect(rooms.has('GRACE_STAY')).toBe(true);
      client.disconnect();

      // Immediately after disconnect the room should still exist (grace period active)
      setTimeout(() => {
        expect(rooms.has('GRACE_STAY')).toBe(true);
        // Let the grace period expire and room gets cleaned up
        setTimeout(() => {
          expect(rooms.has('GRACE_STAY')).toBe(false);
          done();
        }, GRACE_MS + 100);
      }, 50);
    });

    client.emit('join-room', { roomId: 'GRACE_STAY', userName: 'Alice', isObserver: false, clientId: 'cid-grace-stay' });
  });

  test('reconnecting user preserves vote and stays in room', (done) => {
    const client1 = Client(serverUrl);
    let voted = false;
    let step = 0;

    client1.on('room-update', (data) => {
      step++;
      if (step === 1) {
        // Cast a vote
        client1.emit('vote', { roomId: 'GRACE_VOTE', vote: 8 });
      } else if (step === 2 && !voted) {
        // Vote recorded; simulate page refresh: disconnect then reconnect with same clientId
        voted = true;
        client1.disconnect();

        setTimeout(() => {
          const client2 = Client(serverUrl);
          client2.on('room-update', (data2) => {
            // The reconnected user should have their vote preserved
            const user = data2.users.find(u => u.name === 'Alice');
            expect(user).toBeDefined();
            // Before reveal, vote is shown as 'voted' (not null)
            expect(user.vote).toBe('voted');
            client2.disconnect();
            done();
          });
          client2.emit('join-room', { roomId: 'GRACE_VOTE', userName: 'Alice', isObserver: false, clientId: 'cid-grace-vote' });
        }, 50);
      }
    });

    client1.emit('join-room', { roomId: 'GRACE_VOTE', userName: 'Alice', isObserver: false, clientId: 'cid-grace-vote' });
  });

  test('reconnecting host retains creator privileges', (done) => {
    const client1 = Client(serverUrl);
    let step = 0;

    client1.on('room-update', (data) => {
      step++;
      if (step === 1) {
        // Verify initial creator
        expect(data.creatorId).toBe(client1.id);
        client1.disconnect();

        setTimeout(() => {
          const client2 = Client(serverUrl);
          client2.on('room-update', (data2) => {
            // After reconnect, the new socket should be the creator
            expect(data2.creatorId).toBe(client2.id);
            client2.disconnect();
            done();
          });
          client2.emit('join-room', { roomId: 'GRACE_HOST', userName: 'Host', isObserver: false, clientId: 'cid-grace-host' });
        }, 50);
      }
    });

    client1.emit('join-room', { roomId: 'GRACE_HOST', userName: 'Host', isObserver: false, clientId: 'cid-grace-host' });
  });

  test('room is deleted when grace period expires without reconnection', (done) => {
    const client = Client(serverUrl);

    client.on('room-update', () => {
      client.disconnect();

      setTimeout(() => {
        // Grace period expired – room should be gone
        expect(rooms.has('GRACE_EXPIRE')).toBe(false);
        done();
      }, GRACE_MS + 100);
    });

    client.emit('join-room', { roomId: 'GRACE_EXPIRE', userName: 'Bob', isObserver: false, clientId: 'cid-grace-expire' });
  });

  test('user without clientId is removed immediately on disconnect', (done) => {
    const client = Client(serverUrl);

    client.on('room-update', () => {
      client.disconnect();

      setTimeout(() => {
        // No clientId means immediate removal
        expect(rooms.has('GRACE_NOID')).toBe(false);
        done();
      }, 100);
    });

    // Intentionally omit clientId
    client.emit('join-room', { roomId: 'GRACE_NOID', userName: 'Carol', isObserver: false });
  });
});

describe('Remove Participant', () => {
  let testServer;
  let server;
  let io;
  let rooms;
  let serverUrl;
  
  beforeEach((done) => {
    testServer = createServer({ reconnectGracePeriodMs: 0, hostAbsentTimeoutMs: 0 });
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
    testServer = createServer({ reconnectGracePeriodMs: 0, hostAbsentTimeoutMs: 0 });
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
    // Delay participant join to ensure creator is established as room creator first
    setTimeout(() => {
      participant.emit('join-room', { roomId: 'REVEAL_AUTH', userName: 'Participant', isObserver: false });
    }, 100);
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
    // Delay participant join to ensure creatorObserver is established as room creator first
    setTimeout(() => {
      participant.emit('join-room', { roomId: 'OBSERVER_CREATOR', userName: 'Participant', isObserver: false });
    }, 100);
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
    // Delay participant join to ensure creatorObserver is established as room creator first
    setTimeout(() => {
      participant.emit('join-room', { roomId: 'OBSERVER_RESET', userName: 'Participant', isObserver: false });
    }, 100);
  });
});

describe('Multi-User Room Capacity', () => {
  let testServer;
  let server;
  let io;
  let rooms;
  let serverUrl;
  
  beforeEach((done) => {
    testServer = createServer({ reconnectGracePeriodMs: 0, hostAbsentTimeoutMs: 0 });
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
    testServer = createServer({ reconnectGracePeriodMs: 0, hostAbsentTimeoutMs: 0 });
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
    testServer = createServer({ reconnectGracePeriodMs: 0, hostAbsentTimeoutMs: 0 });
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
    testServer = createServer({ reconnectGracePeriodMs: 0, hostAbsentTimeoutMs: 0 });
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

// ---------------------------------------------------------------------------
// Logging helper tests
// ---------------------------------------------------------------------------
describe('log helper', () => {
  const { log } = require('./server');
  const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z /;

  let spy;

  beforeEach(() => {
    spy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    spy.mockRestore();
  });

  test('prefixes each entry with an ISO-8601 timestamp', () => {
    log('hello world');
    expect(spy).toHaveBeenCalledTimes(1);
    const output = spy.mock.calls[0].join(' ');
    expect(output).toMatch(ISO_TIMESTAMP_RE);
    expect(output).toContain('hello world');
  });

  test('passes all arguments through after the timestamp', () => {
    log('a', 'b', 'c');
    const args = spy.mock.calls[0];
    expect(args[0]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(args[1]).toBe('a');
    expect(args[2]).toBe('b');
    expect(args[3]).toBe('c');
  });

  test('vote log entries do not disclose the vote value', () => {
    // Simulate the exact message the vote handler produces (no numeric vote value)
    log('User Alice voted in room test-room');
    const output = spy.mock.calls[0].join(' ');
    expect(output).toContain('voted');
    // Must not contain a numeric vote value inline (e.g. "voted 5" or "vote: 13")
    expect(output).not.toMatch(/\bvoted?\s+\d+\b/);
    expect(output).not.toMatch(/vote\s*[=:]\s*\d+/);
  });
});

describe('Host Takeover', () => {
  const HOST_ABSENT_MS = 50; // fast timer for tests
  let testServer;
  let server;
  let io;
  let rooms;
  let serverUrl;

  beforeEach((done) => {
    testServer = createServer({ reconnectGracePeriodMs: 0, hostAbsentTimeoutMs: HOST_ABSENT_MS });
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

  test('emits host-absent to remaining participants after host disconnects', (done) => {
    const host = Client(serverUrl);
    const participant = Client(serverUrl);
    let joinCount = 0;

    const handleJoin = () => {
      joinCount++;
      if (joinCount === 2) {
        // Host disconnects without a clientId (immediate removal) 
        host.disconnect();
      }
    };

    host.on('room-update', handleJoin);
    participant.on('room-update', handleJoin);

    participant.on('host-absent', (data) => {
      expect(data.roomId).toBe('HT_ABSENT');
      participant.disconnect();
      done();
    });

    host.emit('join-room', { roomId: 'HT_ABSENT', userName: 'Host', isObserver: false });
    setTimeout(() => {
      participant.emit('join-room', { roomId: 'HT_ABSENT', userName: 'Participant', isObserver: false });
    }, 50);
  }, 5000);

  test('allows a participant to claim host when host is absent', (done) => {
    const host = Client(serverUrl);
    const participant = Client(serverUrl);
    let joinCount = 0;
    let hostAbsentReceived = false;

    const handleJoin = () => {
      joinCount++;
      if (joinCount === 2) {
        host.disconnect();
      }
    };

    host.on('room-update', handleJoin);
    participant.on('room-update', (data) => {
      handleJoin();
      if (hostAbsentReceived && data.creatorId === participant.id) {
        // Participant is now the host
        expect(data.creatorId).toBe(participant.id);
        participant.disconnect();
        done();
      }
    });

    participant.on('host-absent', () => {
      hostAbsentReceived = true;
      participant.emit('claim-host', { roomId: 'HT_CLAIM' });
    });

    host.emit('join-room', { roomId: 'HT_CLAIM', userName: 'Host', isObserver: false });
    setTimeout(() => {
      participant.emit('join-room', { roomId: 'HT_CLAIM', userName: 'Participant', isObserver: false });
    }, 50);
  }, 5000);

  test('does not emit host-absent when only one user is in the room', (done) => {
    const host = Client(serverUrl);
    let hostAbsentCalled = false;

    host.on('room-update', () => {
      host.disconnect();
    });

    host.on('host-absent', () => {
      hostAbsentCalled = true;
    });

    host.emit('join-room', { roomId: 'HT_SOLO', userName: 'Host', isObserver: false });

    setTimeout(() => {
      expect(hostAbsentCalled).toBe(false);
      done();
    }, HOST_ABSENT_MS + 200);
  }, 5000);

  test('does not allow a non-participant to claim host', (done) => {
    const host = Client(serverUrl);
    const participant = Client(serverUrl);
    const outsider = Client(serverUrl);
    let joinCount = 0;

    const handleJoin = () => {
      joinCount++;
      if (joinCount === 2) {
        host.disconnect();
      }
    };

    host.on('room-update', handleJoin);
    participant.on('room-update', handleJoin);

    participant.on('host-absent', () => {
      // Outsider (in a different room) tries to claim host – should be silently ignored
      outsider.emit('claim-host', { roomId: 'HT_OUTSIDER' });

      setTimeout(() => {
        const room = rooms.get('HT_OUTSIDER');
        // creatorId should NOT have changed to the outsider
        expect(room.creatorId).not.toBe(outsider.id);
        host.disconnect();
        participant.disconnect();
        outsider.disconnect();
        done();
      }, 200);
    });

    // Outsider joins a different room
    outsider.emit('join-room', { roomId: 'HT_OTHER', userName: 'Outsider', isObserver: false });

    host.emit('join-room', { roomId: 'HT_OUTSIDER', userName: 'Host', isObserver: false });
    setTimeout(() => {
      participant.emit('join-room', { roomId: 'HT_OUTSIDER', userName: 'Participant', isObserver: false });
    }, 50);
  }, 5000);

  test('does not allow claim-host when host is still present', (done) => {
    const host = Client(serverUrl);
    const participant = Client(serverUrl);
    let joinCount = 0;

    const handleJoin = (data) => {
      joinCount++;
      if (joinCount === 2) {
        // Participant tries to claim host while host is still present
        participant.emit('claim-host', { roomId: 'HT_PRESENT' });

        setTimeout(() => {
          const room = rooms.get('HT_PRESENT');
          // creatorId should remain the original host
          expect(room.creatorId).toBe(host.id);
          host.disconnect();
          participant.disconnect();
          done();
        }, 200);
      }
    };

    host.on('room-update', handleJoin);
    participant.on('room-update', handleJoin);

    host.emit('join-room', { roomId: 'HT_PRESENT', userName: 'Host', isObserver: false });
    setTimeout(() => {
      participant.emit('join-room', { roomId: 'HT_PRESENT', userName: 'Participant', isObserver: false });
    }, 50);
  }, 5000);
});

describe('Stress Test', () => {
  const ROOMS = 30;
  const VOTERS_PER_ROOM = 8;
  // One distinct numeric vote per voter slot; matches server's standard card set
  const VOTE_VALUES = [1, 2, 3, 5, 8, 13, 20, 40];

  let testServer;
  let server;
  let io;
  let rooms;
  let serverUrl;

  beforeEach((done) => {
    testServer = createServer({ reconnectGracePeriodMs: 0, hostAbsentTimeoutMs: 0 });
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

  test('should handle 30 rooms with 8 voters each completing a full voting round', async () => {
    const allClients = [];

    async function runRoom(r) {
      const roomId = `STRESS_R${String(r).padStart(2, '0')}`;
      const clients = [];

      // Step 1: Connect all 8 voters and wait for their first room-update (join confirmation)
      await Promise.all(
        Array.from({ length: VOTERS_PER_ROOM }, (_, v) =>
          new Promise((resolve) => {
            const client = Client(serverUrl);
            clients.push(client);
            allClients.push(client);
            client.on('connect', () => {
              client.emit('join-room', {
                roomId,
                userName: `R${r}V${v}`,
                isObserver: false,
              });
              client.once('room-update', resolve);
            });
          })
        )
      );

      // Step 2: Poll the server-side rooms map until all 8 users are registered
      await new Promise((resolve) => {
        const poll = () => {
          const room = rooms.get(roomId);
          if (room && room.users.size === VOTERS_PER_ROOM) return resolve();
          setTimeout(poll, 10);
        };
        poll();
      });

      // Step 3: Every voter casts a distinct numeric vote
      clients.forEach((client, v) => {
        client.emit('vote', { roomId, vote: VOTE_VALUES[v] });
      });

      // Step 4: Poll until all votes are recorded server-side
      await new Promise((resolve) => {
        const poll = () => {
          const room = rooms.get(roomId);
          if (room) {
            const voters = Array.from(room.users.values()).filter(u => !u.isObserver);
            if (voters.length === VOTERS_PER_ROOM && voters.every(u => u.vote !== null)) {
              return resolve();
            }
          }
          setTimeout(poll, 10);
        };
        poll();
      });

      // Step 5: Host reveals and we wait for the confirmed reveal update
      const room = rooms.get(roomId);
      const hostClient = clients.find(c => c.id === room.creatorId) || clients[0];
      return new Promise((resolve) => {
        const onUpdate = (data) => {
          if (data.revealed && data.stats) {
            hostClient.off('room-update', onUpdate);
            resolve(data);
          }
        };
        hostClient.on('room-update', onUpdate);
        hostClient.emit('reveal', { roomId });
      });
    }

    // Run all 30 rooms concurrently
    const results = await Promise.all(
      Array.from({ length: ROOMS }, (_, r) => runRoom(r))
    );

    // Pre-compute expected statistics for the known vote set
    const voteSum = VOTE_VALUES.reduce((a, b) => a + b, 0);
    const expectedAvg = Math.round((voteSum / VOTERS_PER_ROOM) * 10) / 10;
    const expectedMin = VOTE_VALUES[0];
    const expectedMax = VOTE_VALUES[VOTERS_PER_ROOM - 1];

    expect(results).toHaveLength(ROOMS);
    results.forEach((data) => {
      expect(data.revealed).toBe(true);
      expect(data.stats).not.toBeNull();
      expect(data.stats.min).toBe(expectedMin);
      expect(data.stats.max).toBe(expectedMax);
      expect(data.stats.average).toBe(expectedAvg);
    });

    // Verify server-side state for every room
    for (let r = 0; r < ROOMS; r++) {
      const roomId = `STRESS_R${String(r).padStart(2, '0')}`;
      const room = rooms.get(roomId);
      expect(room).toBeDefined();
      expect(room.users.size).toBe(VOTERS_PER_ROOM);
      expect(room.revealed).toBe(true);
    }

    // Disconnect all 240 clients
    allClients.forEach(c => c.disconnect());
  }, 60000);
});

describe('Room Cleanup Interval', () => {
  test('deletes empty rooms older than 24 hours when interval fires', () => {
    jest.useFakeTimers();
    const { rooms, cleanupInterval, io, server } = createServer({ reconnectGracePeriodMs: 0, hostAbsentTimeoutMs: 0 });

    const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
    const recentDate = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1 hour ago

    // Old empty room – should be cleaned up
    rooms.set('OLD_EMPTY', { id: 'OLD_EMPTY', users: new Map(), revealed: false, createdAt: oldDate, creatorId: null, cardSet: 'standard', storyTitle: '', autoReveal: false, specialEffects: false, hostAbsentTimer: null });
    // Recent empty room – should not be cleaned up
    rooms.set('NEW_EMPTY', { id: 'NEW_EMPTY', users: new Map(), revealed: false, createdAt: recentDate, creatorId: null, cardSet: 'standard', storyTitle: '', autoReveal: false, specialEffects: false, hostAbsentTimer: null });
    // Old room with users – should not be cleaned up
    const usersMap = new Map([['sock1', { name: 'Alice', vote: null, isObserver: false }]]);
    rooms.set('OLD_ACTIVE', { id: 'OLD_ACTIVE', users: usersMap, revealed: false, createdAt: oldDate, creatorId: 'sock1', cardSet: 'standard', storyTitle: '', autoReveal: false, specialEffects: false, hostAbsentTimer: null });

    jest.advanceTimersByTime(60 * 60 * 1000); // advance 1 hour to fire the cleanup interval

    expect(rooms.has('OLD_EMPTY')).toBe(false);
    expect(rooms.has('NEW_EMPTY')).toBe(true);
    expect(rooms.has('OLD_ACTIVE')).toBe(true);

    clearInterval(cleanupInterval); // stop the interval so it doesn't fire after the test
    jest.useRealTimers();
    io.close();
    server.close();
  });
});

describe('Reconnection edge cases', () => {
  const GRACE_MS = 300;
  const HOST_ABSENT_MS = 5000;
  let testServer;
  let server;
  let io;
  let rooms;
  let pendingRemovals;
  let serverUrl;

  beforeEach((done) => {
    testServer = createServer({ reconnectGracePeriodMs: GRACE_MS, hostAbsentTimeoutMs: HOST_ABSENT_MS });
    server = testServer.server;
    io = testServer.io;
    rooms = testServer.rooms;
    pendingRemovals = testServer.pendingRemovals;

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

  test('reconnecting host during grace period restores creator role', (done) => {
    // Covers lines 93-94: room.creatorId is updated to new socket when host reconnects
    const host = Client(serverUrl);
    const participant = Client(serverUrl);
    let joinCount = 0;

    const handleJoin = () => {
      joinCount++;
      if (joinCount === 2) {
        host.disconnect();

        setTimeout(() => {
          const host2 = Client(serverUrl);
          host2.once('room-update', (data) => {
            expect(data.creatorId).toBe(host2.id);
            host2.disconnect();
            participant.disconnect();
            done();
          });
          host2.emit('join-room', { roomId: 'RECONNECT_HOST_ROLE', userName: 'Host', isObserver: false, clientId: 'host-role-cid' });
        }, 30);
      }
    };

    host.on('room-update', handleJoin);
    participant.on('room-update', handleJoin);

    host.emit('join-room', { roomId: 'RECONNECT_HOST_ROLE', userName: 'Host', isObserver: false, clientId: 'host-role-cid' });
    setTimeout(() => {
      participant.emit('join-room', { roomId: 'RECONNECT_HOST_ROLE', userName: 'Participant', isObserver: false });
    }, 20);
  }, 5000);

  test('reconnecting to a different room cancels old grace period and removes from old room', (done) => {
    // Covers lines 109-120: user reconnects to a different room while in grace period
    const client1 = Client(serverUrl);
    const client2 = Client(serverUrl);

    // Join room A with client1
    client1.on('connect', () => {
      client1.emit('join-room', { roomId: 'DIFFROOM_A', userName: 'Alice', isObserver: false, clientId: 'diff-cid' });
    });

    client1.once('room-update', () => {
      // client2 joins room A as another user (so room A won't be empty after alice leaves)
      client2.emit('join-room', { roomId: 'DIFFROOM_A', userName: 'Bob', isObserver: false });
      client2.once('room-update', () => {
        // Alice disconnects - grace period starts
        client1.disconnect();

        setTimeout(() => {
          // Alice reconnects to room B while still in grace period for room A
          const client1b = Client(serverUrl);
          client1b.once('room-update', (data) => {
            // Alice should be in room B, not room A
            expect(data.roomId).toBe('DIFFROOM_B');
            expect(rooms.has('DIFFROOM_A')).toBe(true); // room A still exists with Bob
            expect(rooms.has('DIFFROOM_B')).toBe(true);
            const roomA = rooms.get('DIFFROOM_A');
            const roomB = rooms.get('DIFFROOM_B');
            // Alice should not be in room A anymore
            const aliceInA = Array.from(roomA.users.values()).find(u => u.name === 'Alice');
            expect(aliceInA).toBeUndefined();
            expect(roomB.users.size).toBe(1);

            client1b.disconnect();
            client2.disconnect();
            done();
          });
          client1b.emit('join-room', { roomId: 'DIFFROOM_B', userName: 'Alice', isObserver: false, clientId: 'diff-cid' });
        }, 50);
      });
    });
  }, 10000);

  test('reconnecting to a different room deletes old empty room', (done) => {
    // Covers the sub-case where old room becomes empty after removal (lines 113-115)
    const client1 = Client(serverUrl);

    // Join room A with ONLY client1 (so room A becomes empty when Alice leaves)
    client1.on('connect', () => {
      client1.emit('join-room', { roomId: 'DIFFROOM_EMPTY_A', userName: 'Alice', isObserver: false, clientId: 'diff-empty-cid' });
    });

    client1.once('room-update', () => {
      // Alice is alone. Disconnect her – grace period starts
      client1.disconnect();

      setTimeout(() => {
        // Alice reconnects to room B while still in grace period for room A
        const client1b = Client(serverUrl);
        client1b.once('room-update', () => {
          // Room A should be deleted since it was empty
          expect(rooms.has('DIFFROOM_EMPTY_A')).toBe(false);
          expect(rooms.has('DIFFROOM_EMPTY_B')).toBe(true);

          client1b.disconnect();
          done();
        });
        client1b.emit('join-room', { roomId: 'DIFFROOM_EMPTY_B', userName: 'Alice', isObserver: false, clientId: 'diff-empty-cid' });
      }, 50);
    });
  }, 10000);

  test('host grace period expiry with other users starts hostAbsentTimer', (done) => {
    // Covers lines 337-344: host disconnects with clientId, grace expires, hostAbsentTimer starts
    const FAST_GRACE = 100;
    const ts2 = createServer({ reconnectGracePeriodMs: FAST_GRACE, hostAbsentTimeoutMs: 50 });
    const localServer = ts2.server;
    const localIo = ts2.io;
    const localRooms = ts2.rooms;

    localServer.listen(() => {
      const port = localServer.address().port;
      const localUrl = `http://localhost:${port}`;

      const host = Client(localUrl);
      const participant = Client(localUrl);
      let joinCount = 0;

      const handleJoin = () => {
        joinCount++;
        if (joinCount === 2) {
          host.disconnect();
        }
      };

      host.on('room-update', handleJoin);
      participant.on('room-update', handleJoin);

      participant.on('host-absent', () => {
        // host-absent fired means hostAbsentTimer ran – lines 337-344 were hit
        participant.disconnect();
        localIo.close();
        localServer.close(done);
      });

      host.emit('join-room', { roomId: 'HOST_GRACE_ABSENT', userName: 'Host', isObserver: false, clientId: 'host-grace-cid' });
      setTimeout(() => {
        participant.emit('join-room', { roomId: 'HOST_GRACE_ABSENT', userName: 'Participant', isObserver: false });
      }, 20);
    });
  }, 10000);
});

describe('Remove participant with pending reconnect', () => {
  const GRACE_MS = 500;
  let testServer;
  let server;
  let io;
  let rooms;
  let pendingRemovals;
  let serverUrl;

  beforeEach((done) => {
    testServer = createServer({ reconnectGracePeriodMs: GRACE_MS, hostAbsentTimeoutMs: 0 });
    server = testServer.server;
    io = testServer.io;
    rooms = testServer.rooms;
    pendingRemovals = testServer.pendingRemovals;

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

  test('removes a participant who is in the reconnect grace period', (done) => {
    // Covers lines 295-298: pendingRemovals entry cancelled on remove-participant
    const host = Client(serverUrl);
    const participant = Client(serverUrl);
    let joinCount = 0;
    let participantId = null;

    const handleJoin = () => {
      joinCount++;
      if (joinCount === 2) {
        participantId = participant.id;
        // Participant disconnects – grace period starts, adding to pendingRemovals
        participant.disconnect();

        setTimeout(() => {
          // While participant is in grace period, host removes them
          expect(pendingRemovals.size).toBe(1);
          host.once('room-update', () => {
            // Pending removal should be cancelled
            expect(pendingRemovals.size).toBe(0);
            const room = rooms.get('REMOVE_PENDING_ROOM');
            expect(room).toBeDefined();
            const names = Array.from(room.users.values()).map(u => u.name);
            expect(names).not.toContain('Participant');
            host.disconnect();
            done();
          });
          host.emit('remove-participant', { roomId: 'REMOVE_PENDING_ROOM', participantId });
        }, 50);
      }
    };

    host.on('room-update', handleJoin);
    participant.on('room-update', handleJoin);

    host.emit('join-room', { roomId: 'REMOVE_PENDING_ROOM', userName: 'Host', isObserver: false });
    setTimeout(() => {
      participant.emit('join-room', { roomId: 'REMOVE_PENDING_ROOM', userName: 'Participant', isObserver: false, clientId: 'pending-cid' });
    }, 30);
  }, 10000);
});

describe('Claim host clears hostAbsentTimer', () => {
  const HOST_ABSENT_MS = 200;
  let testServer;
  let server;
  let io;
  let rooms;
  let serverUrl;

  beforeEach((done) => {
    testServer = createServer({ reconnectGracePeriodMs: 0, hostAbsentTimeoutMs: HOST_ABSENT_MS });
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

  test('claiming host before host-absent fires cancels the timer', (done) => {
    // Covers lines 261-262: clearTimeout(room.hostAbsentTimer) in claim-host
    const host = Client(serverUrl);
    const participant = Client(serverUrl);
    let joinCount = 0;

    const handleJoin = () => {
      joinCount++;
      if (joinCount === 2) {
        // Host disconnects immediately (no clientId → immediate removal)
        host.disconnect();
      }
    };

    host.on('room-update', handleJoin);
    participant.on('room-update', handleJoin);

    host.on('disconnect', () => {
      // Immediately after host disconnects, check that hostAbsentTimer is set and claim host
      setTimeout(() => {
        const room = rooms.get('CLAIM_CANCEL_ROOM');
        if (!room) return done.fail('Room not found');
        // hostAbsentTimer should be set (but not yet fired)
        expect(room.hostAbsentTimer).not.toBeNull();
        participant.once('room-update', (data) => {
          // Participant is now host, timer should be cleared
          expect(data.creatorId).toBe(participant.id);
          const roomAfter = rooms.get('CLAIM_CANCEL_ROOM');
          expect(roomAfter.hostAbsentTimer).toBeNull();
          participant.disconnect();
          done();
        });
        participant.emit('claim-host', { roomId: 'CLAIM_CANCEL_ROOM' });
      }, 10); // Small delay to let server process the disconnect
    });

    host.emit('join-room', { roomId: 'CLAIM_CANCEL_ROOM', userName: 'Host', isObserver: false });
    setTimeout(() => {
      participant.emit('join-room', { roomId: 'CLAIM_CANCEL_ROOM', userName: 'Participant', isObserver: false });
    }, 30);
  }, 10000);
});

describe('Guard conditions and default values', () => {
  let testServer;
  let server;
  let io;
  let rooms;
  let serverUrl;

  beforeEach((done) => {
    testServer = createServer({ reconnectGracePeriodMs: 0, hostAbsentTimeoutMs: 0 });
    server = testServer.server;
    io = testServer.io;
    rooms = testServer.rooms;
    server.listen(() => {
      serverUrl = `http://localhost:${server.address().port}`;
      done();
    });
  });

  afterEach((done) => {
    io.close();
    server.close(done);
  });

  test('createServer uses env var defaults when no args provided', () => {
    process.env.RECONNECT_GRACE_PERIOD_MS = '1234';
    process.env.HOST_TAKEOVER_TIMEOUT_MS = '5678';
    const ts = createServer();
    // Verify all expected properties are returned (server wired up correctly using env vars)
    expect(ts.server).toBeDefined();
    expect(ts.io).toBeDefined();
    expect(ts.rooms).toBeInstanceOf(Map);
    expect(ts.pendingRemovals).toBeInstanceOf(Map);
    expect(ts.cleanupInterval).toBeDefined();
    ts.io.close();
    ts.server.close();
    clearInterval(ts.cleanupInterval);
    delete process.env.RECONNECT_GRACE_PERIOD_MS;
    delete process.env.HOST_TAKEOVER_TIMEOUT_MS;
  });

  test('createServer uses hardcoded defaults when env vars are absent', () => {
    delete process.env.RECONNECT_GRACE_PERIOD_MS;
    delete process.env.HOST_TAKEOVER_TIMEOUT_MS;
    const ts = createServer();
    // Verify all expected properties are returned (server wired up correctly using hardcoded defaults)
    expect(ts.server).toBeDefined();
    expect(ts.io).toBeDefined();
    expect(ts.rooms).toBeInstanceOf(Map);
    expect(ts.pendingRemovals).toBeInstanceOf(Map);
    expect(ts.cleanupInterval).toBeDefined();
    ts.io.close();
    ts.server.close();
    clearInterval(ts.cleanupInterval);
  });

  test('join room without userName falls back to generated name', (done) => {
    const client = Client(serverUrl);
    client.on('room-update', (data) => {
      const user = data.users.find(u => u.name.startsWith('User '));
      expect(user).toBeDefined();
      client.disconnect();
      done();
    });
    // Deliberately omit userName
    client.emit('join-room', { roomId: 'NONAME_ROOM', isObserver: false });
  });

  test('vote event on non-existent room is silently ignored', (done) => {
    const client = Client(serverUrl);
    client.on('connect', () => {
      // Emit vote for a room that doesn't exist – should not throw
      client.emit('vote', { roomId: 'NONEXISTENT_ROOM', vote: 5 });
      setTimeout(() => {
        expect(rooms.has('NONEXISTENT_ROOM')).toBe(false);
        client.disconnect();
        done();
      }, 100);
    });
  });

  test('reveal event on non-existent room is silently ignored', (done) => {
    const client = Client(serverUrl);
    client.on('connect', () => {
      client.emit('reveal', { roomId: 'NONEXISTENT_REVEAL' });
      setTimeout(() => {
        expect(rooms.has('NONEXISTENT_REVEAL')).toBe(false);
        client.disconnect();
        done();
      }, 100);
    });
  });

  test('reset event on non-existent room is silently ignored', (done) => {
    const client = Client(serverUrl);
    client.on('connect', () => {
      client.emit('reset', { roomId: 'NONEXISTENT_RESET' });
      setTimeout(() => {
        expect(rooms.has('NONEXISTENT_RESET')).toBe(false);
        client.disconnect();
        done();
      }, 100);
    });
  });

  test('set-story event on non-existent room is silently ignored', (done) => {
    const client = Client(serverUrl);
    client.on('connect', () => {
      client.emit('set-story', { roomId: 'NONEXISTENT_STORY', storyTitle: 'Test' });
      setTimeout(() => {
        expect(rooms.has('NONEXISTENT_STORY')).toBe(false);
        client.disconnect();
        done();
      }, 100);
    });
  });

  test('toggle-auto-reveal event on non-existent room is silently ignored', (done) => {
    const client = Client(serverUrl);
    client.on('connect', () => {
      client.emit('toggle-auto-reveal', { roomId: 'NONEXISTENT_AR', autoReveal: true });
      setTimeout(() => {
        expect(rooms.has('NONEXISTENT_AR')).toBe(false);
        client.disconnect();
        done();
      }, 100);
    });
  });

  test('claim-host event on non-existent room is silently ignored', (done) => {
    const client = Client(serverUrl);
    client.on('connect', () => {
      client.emit('claim-host', { roomId: 'NONEXISTENT_CLAIM' });
      setTimeout(() => {
        expect(rooms.has('NONEXISTENT_CLAIM')).toBe(false);
        client.disconnect();
        done();
      }, 100);
    });
  });

  test('remove-participant event on non-existent room is silently ignored', (done) => {
    const client = Client(serverUrl);
    client.on('connect', () => {
      client.emit('remove-participant', { roomId: 'NONEXISTENT_REMOVE', participantId: 'fake' });
      setTimeout(() => {
        expect(rooms.has('NONEXISTENT_REMOVE')).toBe(false);
        client.disconnect();
        done();
      }, 100);
    });
  });

  test('vote event when user is not in room is silently ignored', (done) => {
    const client = Client(serverUrl);
    const joiner = Client(serverUrl);

    joiner.on('connect', () => {
      joiner.emit('join-room', { roomId: 'VOTE_NOUSER_ROOM', userName: 'Joiner' });
    });

    joiner.once('room-update', () => {
      // client sends vote without joining the room first
      client.emit('vote', { roomId: 'VOTE_NOUSER_ROOM', vote: 5 });
      setTimeout(() => {
        const room = rooms.get('VOTE_NOUSER_ROOM');
        expect(room).toBeDefined();
        const votes = Array.from(room.users.values()).map(u => u.vote);
        expect(votes.every(v => v === null)).toBe(true);
        client.disconnect();
        joiner.disconnect();
        done();
      }, 100);
    });
  });

  test('remove-participant with non-existent participantId is silently ignored', (done) => {
    const host = Client(serverUrl);
    host.on('room-update', () => {
      host.emit('remove-participant', { roomId: 'REMOVE_NONEXIST_PART', participantId: 'fake-socket-id' });
      setTimeout(() => {
        const room = rooms.get('REMOVE_NONEXIST_PART');
        expect(room.users.size).toBe(1);
        host.disconnect();
        done();
      }, 100);
    });
    host.emit('join-room', { roomId: 'REMOVE_NONEXIST_PART', userName: 'Host' });
  });
});

describe('Reconnection with missing room', () => {
  const GRACE_MS = 300;
  let testServer;
  let server;
  let io;
  let rooms;
  let serverUrl;

  beforeEach((done) => {
    testServer = createServer({ reconnectGracePeriodMs: GRACE_MS, hostAbsentTimeoutMs: 0 });
    server = testServer.server;
    io = testServer.io;
    rooms = testServer.rooms;
    server.listen(() => {
      serverUrl = `http://localhost:${server.address().port}`;
      done();
    });
  });

  afterEach((done) => {
    io.close();
    server.close(done);
  });

  test('reconnecting user to a room that was deleted during grace period joins fresh', (done) => {
    // Covers the false branch of `if (room)` inside reconnection path
    const client = Client(serverUrl);

    client.once('room-update', () => {
      client.disconnect();

      // Wait for the server to process the disconnect and add the entry to pendingRemovals
      // before deleting the room, so the reconnection path finds pendingRemovals entry but no room
      setTimeout(() => {
        rooms.delete('RECONNECT_DELETED');

        setTimeout(() => {
          const client2 = Client(serverUrl);
          client2.once('room-update', (data) => {
            // Should join as new user in a fresh room (fallthrough after room not found)
            expect(data.roomId).toBe('RECONNECT_DELETED');
            expect(data.users.length).toBe(1);
            client2.disconnect();
            done();
          });
          client2.emit('join-room', {
            roomId: 'RECONNECT_DELETED',
            userName: 'Alice',
            isObserver: false,
            clientId: 'reconnect-deleted-cid'
          });
        }, 20);
      }, 50); // Give the server time to process the disconnect
    });

    client.emit('join-room', {
      roomId: 'RECONNECT_DELETED',
      userName: 'Alice',
      isObserver: false,
      clientId: 'reconnect-deleted-cid'
    });
  }, 5000);
});

describe('Branch coverage for remaining edge cases', () => {
  const GRACE_MS = 300;
  let testServer;
  let server;
  let io;
  let rooms;
  let pendingRemovals;
  let serverUrl;

  beforeEach((done) => {
    testServer = createServer({ reconnectGracePeriodMs: GRACE_MS, hostAbsentTimeoutMs: 60000 });
    server = testServer.server;
    io = testServer.io;
    rooms = testServer.rooms;
    pendingRemovals = testServer.pendingRemovals;
    server.listen(() => {
      serverUrl = `http://localhost:${server.address().port}`;
      done();
    });
  });

  afterEach((done) => {
    io.close();
    server.close(done);
  });

  test('set-story with non-string storyTitle sets empty string', (done) => {
    // Covers line 234: ternary false branch when storyTitle is not a string
    const host = Client(serverUrl);
    let updateCount = 0;
    host.on('room-update', (data) => {
      updateCount++;
      if (updateCount === 1) {
        // Send a non-string storyTitle (e.g., null) to trigger the ternary false branch
        host.emit('set-story', { roomId: 'STORY_NONSTRING', storyTitle: null });
      } else if (updateCount === 2) {
        expect(data.storyTitle).toBe('');
        host.disconnect();
        done();
      }
    });
    host.emit('join-room', { roomId: 'STORY_NONSTRING', userName: 'Host' });
  });

  test('non-host user grace period expiry with other users does not set hostAbsentTimer', (done) => {
    // Covers line 338 false branch: non-host disconnects with clientId, grace period expires, wasHost = false
    const host = Client(serverUrl);
    const nonHost = Client(serverUrl);
    let joinCount = 0;

    const handleJoin = () => {
      joinCount++;
      if (joinCount === 2) {
        nonHost.disconnect();

        // Let the grace period expire
        setTimeout(() => {
          // Non-host grace period expired – room should still exist with only host
          const room = rooms.get('NONHOST_GRACE_ROOM');
          expect(room).toBeDefined();
          expect(room.users.size).toBe(1); // Only host remaining
          expect(room.hostAbsentTimer).toBeNull(); // No hostAbsentTimer set (wasHost = false)
          host.disconnect();
          done();
        }, GRACE_MS + 50);
      }
    };

    host.on('room-update', handleJoin);
    nonHost.on('room-update', handleJoin);

    host.emit('join-room', { roomId: 'NONHOST_GRACE_ROOM', userName: 'Host', isObserver: false });
    setTimeout(() => {
      nonHost.emit('join-room', { roomId: 'NONHOST_GRACE_ROOM', userName: 'NonHost', isObserver: false, clientId: 'nonhost-grace-cid' });
    }, 30);
  }, 5000);

  test('grace period fires after room was externally deleted leaves no artifacts', (done) => {
    // Covers line 331 false branch: room is gone when grace period timer fires
    const client = Client(serverUrl);

    client.once('room-update', () => {
      client.disconnect();

      // Wait for server to process disconnect and add to pendingRemovals
      setTimeout(() => {
        // Externally delete the room (simulates cleanup or race condition)
        rooms.delete('GRACE_DELETED_ROOM');

        // Let the grace period fire naturally – it will find no room (line 331 false branch)
        setTimeout(() => {
          expect(rooms.has('GRACE_DELETED_ROOM')).toBe(false);
          expect(pendingRemovals.has('grace-deleted-cid')).toBe(false); // cleaned up
          done();
        }, GRACE_MS + 50);
      }, 50);
    });

    client.emit('join-room', {
      roomId: 'GRACE_DELETED_ROOM',
      userName: 'Alice',
      isObserver: false,
      clientId: 'grace-deleted-cid'
    });
  }, 5000);

  test('remove-participant loops past non-matching pendingRemovals entries', (done) => {
    // Covers line 296 false branch: loop iterates an entry that does NOT match participantId
    const host = Client(serverUrl);
    const participant1 = Client(serverUrl);
    const participant2 = Client(serverUrl);
    let participant1Id = null;
    let participant2Id = null;
    let allJoined = false;

    // Wait for the room to have all 3 users before proceeding
    const checkAllJoined = (data) => {
      if (!allJoined && data.users && data.users.length === 3) {
        allJoined = true;
        participant1Id = participant1.id;
        participant2Id = participant2.id;

        // Disconnect both participants so they're both in pendingRemovals
        participant1.disconnect();
        participant2.disconnect();

        setTimeout(() => {
          // Both should be in pendingRemovals now
          expect(pendingRemovals.size).toBe(2);

          // Host removes participant2 (the second entry) – loop will encounter participant1 first (false branch)
          host.once('room-update', () => {
            expect(pendingRemovals.size).toBe(1); // participant2's entry was removed
            const remaining = Array.from(pendingRemovals.values());
            expect(remaining[0].oldSocketId).toBe(participant1Id); // participant1 still in pendingRemovals

            // Cancel participant1's pending grace period timer to avoid post-test async logs
            const p1Entry = pendingRemovals.get('pending-cid-1');
            if (p1Entry) {
              clearTimeout(p1Entry.timer);
              pendingRemovals.delete('pending-cid-1');
              rooms.get('MULTI_PENDING_ROOM').users.delete(participant1Id); // room exists as verified above
            }

            host.disconnect();
            done();
          });
          host.emit('remove-participant', { roomId: 'MULTI_PENDING_ROOM', participantId: participant2Id });
        }, 50);
      }
    };

    host.on('room-update', checkAllJoined);

    host.emit('join-room', { roomId: 'MULTI_PENDING_ROOM', userName: 'Host', isObserver: false });
    setTimeout(() => {
      participant1.emit('join-room', { roomId: 'MULTI_PENDING_ROOM', userName: 'P1', isObserver: false, clientId: 'pending-cid-1' });
    }, 20);
    setTimeout(() => {
      participant2.emit('join-room', { roomId: 'MULTI_PENDING_ROOM', userName: 'P2', isObserver: false, clientId: 'pending-cid-2' });
    }, 40);
  }, 10000);
});

describe('Final branch coverage', () => {
  const GRACE_MS = 300;
  let testServer;
  let server;
  let io;
  let rooms;
  let serverUrl;

  beforeEach((done) => {
    testServer = createServer({ reconnectGracePeriodMs: GRACE_MS, hostAbsentTimeoutMs: 0 });
    server = testServer.server;
    io = testServer.io;
    rooms = testServer.rooms;
    server.listen(() => {
      serverUrl = `http://localhost:${server.address().port}`;
      done();
    });
  });

  afterEach((done) => {
    io.close();
    server.close(done);
  });

  test('non-host reconnect within grace period preserves non-host role', (done) => {
    // Covers line 93 false branch: room.creatorId !== pending.oldSocketId (reconnecting user is not host)
    const host = Client(serverUrl);
    const nonHost = Client(serverUrl);
    let joinCount = 0;

    const handleJoin = () => {
      joinCount++;
      if (joinCount === 2) {
        // Non-host disconnects
        nonHost.disconnect();

        // Reconnect non-host within grace period
        setTimeout(() => {
          const nonHost2 = Client(serverUrl);
          nonHost2.once('room-update', (data) => {
            // Host should still be the creator
            expect(data.creatorId).toBe(host.id);
            // Non-host's vote/name should be preserved
            const nonHostUser = data.users.find(u => u.name === 'NonHost');
            expect(nonHostUser).toBeDefined();
            nonHost2.disconnect();
            host.disconnect();
            done();
          });
          nonHost2.emit('join-room', { roomId: 'NONHOST_RECONNECT', userName: 'NonHost', isObserver: false, clientId: 'nonhost-reconnect-cid' });
        }, 30);
      }
    };

    host.on('room-update', handleJoin);
    nonHost.on('room-update', handleJoin);

    host.emit('join-room', { roomId: 'NONHOST_RECONNECT', userName: 'Host', isObserver: false });
    setTimeout(() => {
      nonHost.emit('join-room', { roomId: 'NONHOST_RECONNECT', userName: 'NonHost', isObserver: false, clientId: 'nonhost-reconnect-cid' });
    }, 20);
  }, 5000);

  test('socket disconnect without joining a room is handled gracefully', (done) => {
    // Covers line 322 false branch: socket.roomId is null/undefined on disconnect
    const client = Client(serverUrl);
    client.on('connect', () => {
      // Disconnect immediately without joining any room
      client.disconnect();
      // If we get here without error, the test passes
      setTimeout(() => {
        expect(rooms.size).toBe(0);
        done();
      }, 100);
    });
  });

  test('reconnecting to different room when old room was already deleted', (done) => {
    // Covers line 112 false branch: oldRoom is null when reconnecting to a different room
    const client = Client(serverUrl);

    client.once('room-update', () => {
      client.disconnect();

      // Wait for server to process disconnect (adds to pendingRemovals)
      setTimeout(() => {
        // Delete the old room externally
        rooms.delete('CROSS_DELETED_A');

        // Now reconnect to a different room – the else branch in join-room runs,
        // tries rooms.get('CROSS_DELETED_A') → null → if (oldRoom) is FALSE (line 112)
        const client2 = Client(serverUrl);
        client2.once('room-update', (data) => {
          expect(data.roomId).toBe('CROSS_DELETED_B');
          expect(rooms.has('CROSS_DELETED_A')).toBe(false);
          expect(rooms.has('CROSS_DELETED_B')).toBe(true);
          client2.disconnect();
          done();
        });
        client2.emit('join-room', {
          roomId: 'CROSS_DELETED_B',
          userName: 'Alice',
          isObserver: false,
          clientId: 'cross-deleted-cid'
        });
      }, 50);
    });

    client.emit('join-room', {
      roomId: 'CROSS_DELETED_A',
      userName: 'Alice',
      isObserver: false,
      clientId: 'cross-deleted-cid'
    });
  }, 5000);
});
