-- Games table (completed games for history)
CREATE TABLE IF NOT EXISTS games (
    id SERIAL PRIMARY KEY,
    room_code VARCHAR(6) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    finished_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    player_count INTEGER NOT NULL,
    winner_nickname VARCHAR(30),
    winning_score INTEGER
);

-- Game participants (each player's result in a game)
CREATE TABLE IF NOT EXISTS game_participants (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
    player_session_id VARCHAR(64),
    nickname VARCHAR(30) NOT NULL,
    final_score INTEGER NOT NULL,
    final_dice INTEGER[] NOT NULL,
    turn_order INTEGER NOT NULL,
    is_winner BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Players table (for nickname persistence)
CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(64) UNIQUE NOT NULL,
    nickname VARCHAR(30) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_games_finished_at ON games(finished_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_participants_game_id ON game_participants(game_id);
CREATE INDEX IF NOT EXISTS idx_game_participants_session ON game_participants(player_session_id);
CREATE INDEX IF NOT EXISTS idx_players_session ON players(session_id);
