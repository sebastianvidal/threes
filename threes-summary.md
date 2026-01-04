# 3s Dice Game - Project Summary

## Overview
A multiplayer web dice game where 3s = 0 points and lowest score wins. Originally a single HTML file, now expanded to a full Node.js app with real-time multiplayer.

## Live URL
Deployed on Railway: https://threes-production-3fcb.up.railway.app/

## Tech Stack
- **Backend**: Node.js, Express, WebSocket (ws), PostgreSQL (pg)
- **Frontend**: Vanilla JS, CSS
- **Deployment**: Railway with Postgres addon

## Game Rules
- 5 dice per player
- 3s = 0 points, all other dice = face value
- Up to 5 rolls per turn
- Must keep at least 1 die after each roll
- Lowest score wins

## Project Structure
```
threes/
├── server/
│   ├── index.js                 # Express + WebSocket entry
│   ├── config/database.js       # PostgreSQL connection
│   ├── routes/
│   │   ├── rooms.js             # Room info API
│   │   └── history.js           # Match history API
│   ├── websocket/
│   │   ├── index.js             # WebSocket setup
│   │   ├── handlers.js          # Game message handlers (CRITICAL)
│   │   └── rooms.js             # In-memory room state
│   ├── game/logic.js            # Server-side validation
│   └── db/
│       ├── migrations/001_initial.sql
│       └── queries.js           # DB queries for history
├── public/
│   ├── index.html               # Landing page (create/join)
│   ├── game.html                # Multiplayer game (CRITICAL)
│   ├── local.html               # Original offline game
│   ├── history.html             # Match history viewer
│   ├── css/styles.css
│   └── js/
│       ├── game-core.js         # Shared game logic
│       └── multiplayer.js       # WebSocket client (CRITICAL)
├── package.json
├── railway.json                 # Railway deployment config
└── .env.example
```

## Key Features Implemented
- [x] Room codes (4-letter, e.g., "ABCD")
- [x] Shareable join links (`/join/ABCD`)
- [x] Player nicknames (saved in localStorage)
- [x] Real-time dice spectating (see other players roll)
- [x] 3-second pause after each turn to show results
- [x] Rematch functionality
- [x] Match history (PostgreSQL)
- [x] Reconnection support
- [x] Original local pass-and-play preserved at `/local.html`

## WebSocket Flow
1. **Create Room**: index.html → `create_room` → stores pending info → redirects to game.html → re-creates room
2. **Join Room**: `/join/CODE` → index.html shows modal → `join_room` → redirects to game.html → joins room
3. **Gameplay**: `roll` → server generates dice → `dice_rolled` broadcast → `keep_dice` → `dice_kept` broadcast
4. **Turn End**: `turn_ended` broadcast → 3s delay → `turn_started` for next player
5. **Game End**: `game_ended` with results → rematch flow available

## Known Issues / TODO
- Database connection requires `NODE_ENV=production` in Railway for SSL
- Run migrations after first deploy: `npm run migrate`

## Environment Variables (Railway)
- `DATABASE_URL` - Auto-set by Postgres addon
- `NODE_ENV=production` - Required for Postgres SSL
- `PORT` - Auto-set by Railway

## Recent Changes (Latest First)
1. Fixed join links (serve index.html not game.html)
2. Added 3s pause after turns for result viewing
3. Added real-time spectating of other players' dice
4. Fixed rematch (was emitting wrong event name)
5. Fixed WebSocket flow (room was deleted on redirect)

## Critical Files for Debugging
- `server/websocket/handlers.js` - All game logic and message handling
- `public/game.html` - Main game UI and client-side state
- `public/js/multiplayer.js` - WebSocket client and event emission
- `server/websocket/rooms.js` - In-memory room state management
