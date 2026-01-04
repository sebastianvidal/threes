const express = require('express');
const router = express.Router();
const { getRecentGames, getGamesBySession, getGameDetails } = require('../db/queries');

// Get recent games
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const games = await getRecentGames(limit);
    res.json(games);
  } catch (err) {
    console.error('Error fetching history:', err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Get games by session (player's games)
router.get('/mine/:sessionId', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const games = await getGamesBySession(req.params.sessionId, limit);
    res.json(games);
  } catch (err) {
    console.error('Error fetching player history:', err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Get single game details
router.get('/:gameId', async (req, res) => {
  try {
    const game = await getGameDetails(parseInt(req.params.gameId));
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    res.json(game);
  } catch (err) {
    console.error('Error fetching game:', err);
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});

module.exports = router;
