// Multiplayer WebSocket client

const Multiplayer = {
  ws: null,
  roomCode: null,
  playerId: null,
  sessionId: null,
  isHost: false,
  players: [],
  gameState: null,
  currentPlayerIndex: 0,
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,
  handlers: {},

  // Initialize session ID
  init() {
    this.sessionId = localStorage.getItem('threes_session_id');
    if (!this.sessionId) {
      this.sessionId = 'sess_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
      localStorage.setItem('threes_session_id', this.sessionId);
    }

    // Check for saved nickname
    this.savedNickname = localStorage.getItem('threes_nickname') || '';
  },

  // Connect to WebSocket server
  connect() {
    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        resolve();
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        if (this.roomCode && this.reconnectAttempts < this.maxReconnectAttempts) {
          setTimeout(() => this.attemptReconnect(), 1000 * Math.pow(2, this.reconnectAttempts));
        }
      };

      this.ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        reject(err);
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (err) {
          console.error('Failed to parse message:', err);
        }
      };
    });
  },

  // Send message to server
  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  },

  // Handle incoming messages
  handleMessage(message) {
    console.log('Received:', message.type, message);

    switch (message.type) {
      case 'room_created':
      case 'room_joined':
        this.roomCode = message.roomCode;
        this.playerId = message.playerId;
        this.isHost = message.isHost;
        this.players = message.players;
        // Send session ID for reconnection support
        this.send({ type: 'set_session', sessionId: this.sessionId });
        this.emit('room_joined', message);
        break;

      case 'player_joined':
        this.players.push(message.player);
        this.emit('player_joined', message);
        break;

      case 'player_left':
        this.players = this.players.filter(p => p.id !== message.playerId);
        if (message.newHost === this.playerId) {
          this.isHost = true;
        }
        this.emit('player_left', message);
        break;

      case 'player_disconnected':
        const disconnected = this.players.find(p => p.id === message.playerId);
        if (disconnected) disconnected.connected = false;
        this.emit('player_disconnected', message);
        break;

      case 'player_reconnected':
        const reconnected = this.players.find(p => p.id === message.playerId);
        if (reconnected) reconnected.connected = true;
        this.emit('player_reconnected', message);
        break;

      case 'game_started':
        this.players = message.players;
        this.currentPlayerIndex = message.currentPlayerIndex;
        this.gameState = {
          status: 'playing',
          currentPlayerIndex: message.currentPlayerIndex,
          currentPlayerId: message.currentPlayerId
        };
        this.emit('game_started', message);
        break;

      case 'rematch_started':
        this.players = message.players;
        this.currentPlayerIndex = message.currentPlayerIndex;
        this.gameState = {
          status: 'playing',
          currentPlayerIndex: message.currentPlayerIndex,
          currentPlayerId: message.currentPlayerId
        };
        this.emit('rematch_started', message);
        break;

      case 'turn_started':
        this.currentPlayerIndex = message.currentPlayerIndex;
        this.gameState.currentPlayerIndex = message.currentPlayerIndex;
        this.gameState.currentPlayerId = message.currentPlayerId;
        this.emit('turn_started', message);
        break;

      case 'dice_rolled':
        this.emit('dice_rolled', message);
        break;

      case 'dice_kept':
        this.emit('dice_kept', message);
        break;

      case 'turn_ended':
        this.emit('turn_ended', message);
        break;

      case 'game_ended':
        this.gameState = { status: 'finished' };
        this.emit('game_ended', message);
        break;

      case 'rematch_proposed':
        this.emit('rematch_proposed', message);
        break;

      case 'chat':
        this.emit('chat', message);
        break;

      case 'state_sync':
        // Full state sync after reconnect
        this.roomCode = message.roomCode;
        this.playerId = message.playerId;
        this.isHost = message.isHost;
        this.players = message.players;
        if (message.game) {
          this.gameState = {
            status: message.status,
            currentPlayerIndex: message.game.currentPlayerIndex,
            playerStates: message.game.playerStates
          };
        }
        this.emit('state_sync', message);
        break;

      case 'room_closed':
        this.roomCode = null;
        this.emit('room_closed', message);
        break;

      case 'error':
        this.emit('error', message);
        break;
    }
  },

  // Event handling
  on(event, handler) {
    if (!this.handlers[event]) {
      this.handlers[event] = [];
    }
    this.handlers[event].push(handler);
  },

  off(event, handler) {
    if (this.handlers[event]) {
      this.handlers[event] = this.handlers[event].filter(h => h !== handler);
    }
  },

  emit(event, data) {
    if (this.handlers[event]) {
      this.handlers[event].forEach(handler => handler(data));
    }
  },

  // Reconnection
  attemptReconnect() {
    this.reconnectAttempts++;
    console.log(`Attempting reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.connect().then(() => {
      // Try to rejoin room
      this.send({
        type: 'reconnect',
        roomCode: this.roomCode,
        sessionId: this.sessionId
      });
    }).catch(() => {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        setTimeout(() => this.attemptReconnect(), 1000 * Math.pow(2, this.reconnectAttempts));
      } else {
        this.emit('connection_failed', {});
      }
    });
  },

  // Actions
  createRoom(nickname) {
    localStorage.setItem('threes_nickname', nickname);
    this.send({ type: 'create_room', nickname });
  },

  joinRoom(roomCode, nickname) {
    localStorage.setItem('threes_nickname', nickname);
    this.send({ type: 'join_room', roomCode: roomCode.toUpperCase(), nickname });
  },

  startGame() {
    this.send({ type: 'start_game', roomCode: this.roomCode });
  },

  roll() {
    this.send({ type: 'roll', roomCode: this.roomCode });
  },

  keepDice(indices) {
    this.send({ type: 'keep_dice', roomCode: this.roomCode, indices });
  },

  requestRematch() {
    this.send({ type: 'request_rematch', roomCode: this.roomCode });
  },

  leaveRoom() {
    this.send({ type: 'leave_room', roomCode: this.roomCode });
    this.roomCode = null;
    this.playerId = null;
    this.isHost = false;
    this.players = [];
    this.gameState = null;
  },

  sendChat(text) {
    this.send({ type: 'chat', roomCode: this.roomCode, text });
  },

  // Helpers
  isMyTurn() {
    if (!this.gameState || this.gameState.status !== 'playing') return false;
    const currentPlayer = this.players[this.gameState.currentPlayerIndex];
    return currentPlayer && currentPlayer.id === this.playerId;
  },

  getMyIndex() {
    return this.players.findIndex(p => p.id === this.playerId);
  },

  getCurrentPlayer() {
    if (!this.gameState) return null;
    return this.players[this.gameState.currentPlayerIndex];
  }
};

// Initialize on load
Multiplayer.init();
