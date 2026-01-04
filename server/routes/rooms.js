const express = require('express');
const router = express.Router();
const { getRoom, getRoomList } = require('../websocket/rooms');

// Get room info (for checking if room exists before WebSocket connect)
router.get('/:code', (req, res) => {
  const room = getRoom(req.params.code.toUpperCase());
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  res.json({
    code: room.code,
    playerCount: room.players.length,
    maxPlayers: 6,
    status: room.status
  });
});

module.exports = router;
