const { pool } = require('../config/database');

async function saveGame(room, results, winnerNickname, winningScore) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert game
    const gameResult = await client.query(
      `INSERT INTO games (room_code, started_at, finished_at, player_count, winner_nickname, winning_score)
       VALUES ($1, $2, NOW(), $3, $4, $5)
       RETURNING id`,
      [room.code, new Date(room.game.startedAt), room.players.length, winnerNickname, winningScore]
    );
    const gameId = gameResult.rows[0].id;

    // Insert participants
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const player = room.players[i];
      await client.query(
        `INSERT INTO game_participants (game_id, player_session_id, nickname, final_score, final_dice, turn_order, is_winner)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [gameId, player.sessionId, r.nickname, r.score, r.dice, i + 1, r.isWinner]
      );
    }

    await client.query('COMMIT');
    return gameId;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getRecentGames(limit = 20) {
  const result = await pool.query(
    `SELECT g.*,
            json_agg(json_build_object(
              'nickname', gp.nickname,
              'score', gp.final_score,
              'dice', gp.final_dice,
              'isWinner', gp.is_winner
            ) ORDER BY gp.turn_order) as participants
     FROM games g
     LEFT JOIN game_participants gp ON g.id = gp.game_id
     GROUP BY g.id
     ORDER BY g.finished_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

async function getGamesBySession(sessionId, limit = 20) {
  const result = await pool.query(
    `SELECT DISTINCT g.*,
            json_agg(json_build_object(
              'nickname', gp2.nickname,
              'score', gp2.final_score,
              'dice', gp2.final_dice,
              'isWinner', gp2.is_winner
            ) ORDER BY gp2.turn_order) as participants
     FROM games g
     INNER JOIN game_participants gp ON g.id = gp.game_id AND gp.player_session_id = $1
     LEFT JOIN game_participants gp2 ON g.id = gp2.game_id
     GROUP BY g.id
     ORDER BY g.finished_at DESC
     LIMIT $2`,
    [sessionId, limit]
  );
  return result.rows;
}

async function getGameDetails(gameId) {
  const result = await pool.query(
    `SELECT g.*,
            json_agg(json_build_object(
              'nickname', gp.nickname,
              'score', gp.final_score,
              'dice', gp.final_dice,
              'isWinner', gp.is_winner,
              'turnOrder', gp.turn_order
            ) ORDER BY gp.turn_order) as participants
     FROM games g
     LEFT JOIN game_participants gp ON g.id = gp.game_id
     WHERE g.id = $1
     GROUP BY g.id`,
    [gameId]
  );
  return result.rows[0] || null;
}

async function saveOrUpdatePlayer(sessionId, nickname) {
  await pool.query(
    `INSERT INTO players (session_id, nickname, last_seen)
     VALUES ($1, $2, NOW())
     ON CONFLICT (session_id)
     DO UPDATE SET nickname = $2, last_seen = NOW()`,
    [sessionId, nickname]
  );
}

async function getPlayerBySession(sessionId) {
  const result = await pool.query(
    'SELECT * FROM players WHERE session_id = $1',
    [sessionId]
  );
  return result.rows[0] || null;
}

module.exports = {
  saveGame,
  getRecentGames,
  getGamesBySession,
  getGameDetails,
  saveOrUpdatePlayer,
  getPlayerBySession
};
