const {
  createRoom,
  joinRoom,
  reconnectToRoom,
  leaveRoom,
  getRoom,
  updatePlayerSession,
  startGame,
  resetForRematch
} = require('./rooms');
const { validateRoll, validateKeep, generateDiceRoll } = require('../game/logic');
const { saveGame } = require('../db/queries');

function send(ws, message) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(message));
  }
}

function broadcast(room, message, excludePlayerId = null) {
  room.players.forEach(p => {
    if (p.id !== excludePlayerId && p.ws && p.ws.readyState === 1) {
      p.ws.send(JSON.stringify(message));
    }
  });
}

function broadcastAll(room, message) {
  broadcast(room, message, null);
}

function getPublicPlayerInfo(players) {
  return players.map(p => ({
    id: p.id,
    nickname: p.nickname,
    connected: p.connected
  }));
}

function handleMessage(ws, message) {
  const { type } = message;

  switch (type) {
    case 'create_room':
      handleCreateRoom(ws, message);
      break;
    case 'join_room':
      handleJoinRoom(ws, message);
      break;
    case 'reconnect':
      handleReconnect(ws, message);
      break;
    case 'set_session':
      handleSetSession(ws, message);
      break;
    case 'start_game':
      handleStartGame(ws, message);
      break;
    case 'roll':
      handleRoll(ws, message);
      break;
    case 'keep_dice':
      handleKeepDice(ws, message);
      break;
    case 'request_rematch':
      handleRequestRematch(ws, message);
      break;
    case 'accept_rematch':
      handleAcceptRematch(ws, message);
      break;
    case 'leave_room':
      handleLeaveRoom(ws);
      break;
    default:
      send(ws, { type: 'error', message: 'Unknown message type' });
  }
}

function handleCreateRoom(ws, { nickname }) {
  if (!nickname || nickname.length < 1 || nickname.length > 30) {
    return send(ws, { type: 'error', message: 'Invalid nickname' });
  }

  const { room, playerId } = createRoom(nickname.trim(), ws);

  send(ws, {
    type: 'room_created',
    roomCode: room.code,
    playerId,
    players: getPublicPlayerInfo(room.players),
    isHost: true
  });
}

function handleJoinRoom(ws, { roomCode, nickname }) {
  if (!nickname || nickname.length < 1 || nickname.length > 30) {
    return send(ws, { type: 'error', message: 'Invalid nickname' });
  }
  if (!roomCode) {
    return send(ws, { type: 'error', message: 'Room code required' });
  }

  const result = joinRoom(roomCode.toUpperCase(), nickname.trim(), ws);

  if (result.error) {
    return send(ws, { type: 'error', message: result.error });
  }

  const { room, playerId } = result;
  const player = room.players.find(p => p.id === playerId);

  // Notify the new player
  send(ws, {
    type: 'room_joined',
    roomCode: room.code,
    playerId,
    players: getPublicPlayerInfo(room.players),
    isHost: room.host === playerId
  });

  // Notify others in the room
  broadcast(room, {
    type: 'player_joined',
    player: { id: playerId, nickname: player.nickname, connected: true }
  }, playerId);
}

function handleReconnect(ws, { roomCode, sessionId }) {
  if (!roomCode || !sessionId) {
    return send(ws, { type: 'error', message: 'Missing roomCode or sessionId' });
  }

  const result = reconnectToRoom(roomCode.toUpperCase(), sessionId, ws);

  if (result.error) {
    return send(ws, { type: 'error', message: result.error });
  }

  const { room, playerId } = result;
  const player = room.players.find(p => p.id === playerId);

  // Send full state sync
  send(ws, {
    type: 'state_sync',
    roomCode: room.code,
    playerId,
    players: getPublicPlayerInfo(room.players),
    isHost: room.host === playerId,
    status: room.status,
    game: room.game ? {
      currentPlayerIndex: room.game.currentPlayerIndex,
      playerStates: room.game.playerStates
    } : null
  });

  // Notify others
  broadcast(room, {
    type: 'player_reconnected',
    playerId,
    nickname: player.nickname
  }, playerId);
}

function handleSetSession(ws, { sessionId }) {
  if (ws.roomCode && ws.playerId && sessionId) {
    updatePlayerSession(ws.playerId, ws.roomCode, sessionId);
  }
}

function handleStartGame(ws, { roomCode }) {
  const room = getRoom(roomCode);
  if (!room) {
    return send(ws, { type: 'error', message: 'Room not found' });
  }
  if (room.host !== ws.playerId) {
    return send(ws, { type: 'error', message: 'Only host can start the game' });
  }
  if (room.players.length < 1) {
    return send(ws, { type: 'error', message: 'Need at least 1 player' });
  }

  const started = startGame(roomCode);
  if (!started) {
    return send(ws, { type: 'error', message: 'Could not start game' });
  }

  const currentPlayer = room.players[0];

  broadcastAll(room, {
    type: 'game_started',
    players: getPublicPlayerInfo(room.players),
    currentPlayerIndex: 0,
    currentPlayerId: currentPlayer.id,
    currentPlayerNickname: currentPlayer.nickname
  });
}

function handleRoll(ws, { roomCode }) {
  const room = getRoom(roomCode);
  if (!room || room.status !== 'playing') {
    return send(ws, { type: 'error', message: 'Game not in progress' });
  }

  const playerIndex = room.players.findIndex(p => p.id === ws.playerId);
  if (playerIndex !== room.game.currentPlayerIndex) {
    return send(ws, { type: 'error', message: 'Not your turn' });
  }

  const state = room.game.playerStates[playerIndex];
  const validation = validateRoll(state);
  if (!validation.valid) {
    return send(ws, { type: 'error', message: validation.error });
  }

  // Generate dice server-side
  const diceCount = state.activeDice.length === 0 && state.keptDice.length === 0
    ? 5
    : state.activeDice.length;

  state.activeDice = generateDiceRoll(diceCount);
  state.rollsLeft--;
  state.hasRolledThisRound = true;
  state.hasKeptThisRoll = false;

  room.lastActivity = Date.now();

  // Check if out of rolls - auto-keep remaining dice
  if (state.rollsLeft === 0 && state.activeDice.length > 0) {
    state.keptDice = state.keptDice.concat(state.activeDice);
    state.activeDice = [];

    // End turn
    endTurn(room, playerIndex);
    return;
  }

  broadcastAll(room, {
    type: 'dice_rolled',
    playerId: ws.playerId,
    activeDice: state.activeDice,
    keptDice: state.keptDice,
    rollsLeft: state.rollsLeft
  });
}

function handleKeepDice(ws, { roomCode, indices }) {
  const room = getRoom(roomCode);
  if (!room || room.status !== 'playing') {
    return send(ws, { type: 'error', message: 'Game not in progress' });
  }

  const playerIndex = room.players.findIndex(p => p.id === ws.playerId);
  if (playerIndex !== room.game.currentPlayerIndex) {
    return send(ws, { type: 'error', message: 'Not your turn' });
  }

  const state = room.game.playerStates[playerIndex];
  const validation = validateKeep(state, indices);
  if (!validation.valid) {
    return send(ws, { type: 'error', message: validation.error });
  }

  // Keep selected dice
  const toKeep = [];
  const toStay = [];
  state.activeDice.forEach((d, i) => {
    if (indices.includes(i)) {
      toKeep.push(d);
    } else {
      toStay.push(d);
    }
  });

  state.keptDice = state.keptDice.concat(toKeep);
  state.activeDice = toStay;
  state.hasKeptThisRoll = true;

  room.lastActivity = Date.now();

  // Check if all dice kept
  if (state.activeDice.length === 0) {
    endTurn(room, playerIndex);
    return;
  }

  broadcastAll(room, {
    type: 'dice_kept',
    playerId: ws.playerId,
    activeDice: state.activeDice,
    keptDice: state.keptDice,
    rollsLeft: state.rollsLeft
  });
}

function endTurn(room, playerIndex) {
  const state = room.game.playerStates[playerIndex];
  const player = room.players[playerIndex];

  // Calculate score (3s = 0, others = face value)
  state.score = state.keptDice.reduce((sum, d) => sum + (d === 3 ? 0 : d), 0);

  broadcastAll(room, {
    type: 'turn_ended',
    playerId: player.id,
    nickname: player.nickname,
    finalScore: state.score,
    finalDice: state.keptDice
  });

  // Check if game is over
  if (playerIndex === room.players.length - 1) {
    // Delay before showing final results
    setTimeout(() => endGame(room), 3000);
  } else {
    // Next player's turn - delay so everyone can see the results
    setTimeout(() => {
      room.game.currentPlayerIndex++;
      const nextPlayer = room.players[room.game.currentPlayerIndex];

      broadcastAll(room, {
        type: 'turn_started',
        currentPlayerIndex: room.game.currentPlayerIndex,
        currentPlayerId: nextPlayer.id,
        currentPlayerNickname: nextPlayer.nickname
      });
    }, 3000);
  }
}

async function endGame(room) {
  room.status = 'finished';

  // Find winner (lowest score)
  const scores = room.game.playerStates.map(s => s.score);
  const minScore = Math.min(...scores);
  const winners = room.players
    .filter((_, i) => room.game.playerStates[i].score === minScore)
    .map(p => ({ id: p.id, nickname: p.nickname }));

  const results = room.players.map((p, i) => ({
    playerId: p.id,
    nickname: p.nickname,
    score: room.game.playerStates[i].score,
    dice: room.game.playerStates[i].keptDice,
    isWinner: room.game.playerStates[i].score === minScore
  }));

  broadcastAll(room, {
    type: 'game_ended',
    results,
    winners,
    winningScore: minScore
  });

  // Save to database
  try {
    await saveGame(room, results, winners[0]?.nickname, minScore);
  } catch (err) {
    console.error('Failed to save game:', err);
  }
}

function handleRequestRematch(ws, { roomCode }) {
  const room = getRoom(roomCode);
  if (!room || room.status !== 'finished') {
    return send(ws, { type: 'error', message: 'Game not finished' });
  }

  const player = room.players.find(p => p.id === ws.playerId);
  if (!player) {
    return send(ws, { type: 'error', message: 'Player not in room' });
  }

  if (!room.rematch.proposedBy) {
    room.rematch.proposedBy = ws.playerId;
    room.rematch.acceptedBy = [ws.playerId];
  } else if (!room.rematch.acceptedBy.includes(ws.playerId)) {
    room.rematch.acceptedBy.push(ws.playerId);
  }

  room.lastActivity = Date.now();

  broadcastAll(room, {
    type: 'rematch_proposed',
    proposedBy: room.rematch.proposedBy,
    acceptedBy: room.rematch.acceptedBy,
    acceptedCount: room.rematch.acceptedBy.length,
    totalPlayers: room.players.filter(p => p.connected).length
  });

  // Check if all connected players accepted
  const connectedPlayers = room.players.filter(p => p.connected);
  if (room.rematch.acceptedBy.length === connectedPlayers.length && connectedPlayers.length > 0) {
    const rematchRoom = resetForRematch(roomCode);
    if (rematchRoom) {
      const currentPlayer = rematchRoom.players[0];
      broadcastAll(rematchRoom, {
        type: 'rematch_started',
        players: getPublicPlayerInfo(rematchRoom.players),
        currentPlayerIndex: 0,
        currentPlayerId: currentPlayer.id,
        currentPlayerNickname: currentPlayer.nickname
      });
    }
  }
}

function handleAcceptRematch(ws, { roomCode }) {
  // Same as request - just adds to accepted list
  handleRequestRematch(ws, { roomCode });
}

function handleLeaveRoom(ws) {
  if (!ws.roomCode || !ws.playerId) return;

  const result = leaveRoom(ws.playerId, ws.roomCode);
  if (!result) return;

  if (result.deleted) {
    // Room was deleted, nothing to broadcast
    return;
  }

  if (result.disconnected) {
    broadcast(result.room, {
      type: 'player_disconnected',
      playerId: ws.playerId,
      nickname: result.player.nickname
    });
  } else if (result.removed) {
    broadcast(result.room, {
      type: 'player_left',
      playerId: ws.playerId,
      nickname: result.player.nickname,
      newHost: result.room.host
    });
  }
}

function handleClose(ws) {
  handleLeaveRoom(ws);
}

module.exports = { handleMessage, handleClose };
