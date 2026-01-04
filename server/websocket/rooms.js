const { v4: uuidv4 } = require('uuid');

// In-memory room storage
const rooms = new Map();

// Generate a random 4-letter room code
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude I and O to avoid confusion
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (rooms.has(code));
  return code;
}

function createRoom(hostNickname, ws) {
  const code = generateRoomCode();
  const playerId = uuidv4();

  const room = {
    code,
    host: playerId,
    players: [{
      id: playerId,
      nickname: hostNickname,
      ws,
      connected: true,
      sessionId: null
    }],
    status: 'waiting', // waiting, playing, finished
    game: null,
    rematch: { proposedBy: null, acceptedBy: [] },
    lastActivity: Date.now(),
    createdAt: Date.now()
  };

  rooms.set(code, room);

  // Attach room info to WebSocket
  ws.playerId = playerId;
  ws.roomCode = code;

  return { room, playerId };
}

function joinRoom(code, nickname, ws) {
  const room = rooms.get(code);
  if (!room) {
    return { error: 'Room not found' };
  }
  if (room.status !== 'waiting') {
    return { error: 'Game already in progress' };
  }
  if (room.players.length >= 6) {
    return { error: 'Room is full' };
  }

  const playerId = uuidv4();
  room.players.push({
    id: playerId,
    nickname,
    ws,
    connected: true,
    sessionId: null
  });
  room.lastActivity = Date.now();

  ws.playerId = playerId;
  ws.roomCode = code;

  return { room, playerId };
}

function reconnectToRoom(code, sessionId, ws) {
  const room = rooms.get(code);
  if (!room) {
    return { error: 'Room not found' };
  }

  const player = room.players.find(p => p.sessionId === sessionId);
  if (!player) {
    return { error: 'Session not found in room' };
  }

  player.ws = ws;
  player.connected = true;
  room.lastActivity = Date.now();

  ws.playerId = player.id;
  ws.roomCode = code;

  return { room, playerId: player.id };
}

function leaveRoom(playerId, roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return null;

  const playerIndex = room.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) return null;

  const player = room.players[playerIndex];

  // If game is in progress, mark as disconnected instead of removing
  if (room.status === 'playing') {
    player.connected = false;
    player.ws = null;
    room.lastActivity = Date.now();
    return { room, disconnected: true, player };
  }

  // In lobby, remove the player
  room.players.splice(playerIndex, 1);
  room.lastActivity = Date.now();

  // If host left, assign new host
  if (room.host === playerId && room.players.length > 0) {
    room.host = room.players[0].id;
  }

  // If room is empty, delete it
  if (room.players.length === 0) {
    rooms.delete(roomCode);
    return { room: null, deleted: true };
  }

  return { room, removed: true, player };
}

function getRoom(code) {
  return rooms.get(code);
}

function updatePlayerSession(playerId, roomCode, sessionId) {
  const room = rooms.get(roomCode);
  if (!room) return;

  const player = room.players.find(p => p.id === playerId);
  if (player) {
    player.sessionId = sessionId;
  }
}

function startGame(roomCode) {
  const room = rooms.get(roomCode);
  if (!room || room.status !== 'waiting' || room.players.length < 1) {
    return null;
  }

  room.status = 'playing';
  room.game = {
    currentPlayerIndex: 0,
    playerStates: room.players.map(() => ({
      activeDice: [],
      keptDice: [],
      rollsLeft: 5,
      score: 0,
      hasRolledThisRound: false,
      hasKeptThisRoll: false
    })),
    startedAt: Date.now()
  };
  room.lastActivity = Date.now();

  return room;
}

function resetForRematch(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return null;

  room.status = 'playing';
  room.game = {
    currentPlayerIndex: 0,
    playerStates: room.players.map(() => ({
      activeDice: [],
      keptDice: [],
      rollsLeft: 5,
      score: 0,
      hasRolledThisRound: false,
      hasKeptThisRoll: false
    })),
    startedAt: Date.now()
  };
  room.rematch = { proposedBy: null, acceptedBy: [] };
  room.lastActivity = Date.now();

  return room;
}

// Cleanup inactive rooms every 5 minutes
setInterval(() => {
  const now = Date.now();
  const INACTIVE_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  for (const [code, room] of rooms) {
    if (now - room.lastActivity > INACTIVE_TIMEOUT) {
      // Notify connected players
      room.players.forEach(p => {
        if (p.ws && p.ws.readyState === 1) {
          p.ws.send(JSON.stringify({
            type: 'room_closed',
            reason: 'inactivity'
          }));
        }
      });
      rooms.delete(code);
      console.log(`Room ${code} deleted due to inactivity`);
    }
  }
}, 5 * 60 * 1000);

module.exports = {
  createRoom,
  joinRoom,
  reconnectToRoom,
  leaveRoom,
  getRoom,
  updatePlayerSession,
  startGame,
  resetForRematch,
  generateRoomCode
};
