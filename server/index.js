require('dotenv').config();
const express = require('express');
const path = require('path');
const { createServer } = require('http');
const { setupWebSocket } = require('./websocket');
const roomsRouter = require('./routes/rooms');
const historyRouter = require('./routes/history');

const app = express();
const server = createServer(app);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Health check for Railway
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// API routes
app.use('/api/rooms', roomsRouter);
app.use('/api/history', historyRouter);

// Join room via shareable link - serve index.html which has join modal
app.get('/join/:code', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Fallback to index for SPA-like behavior
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Set up WebSocket
setupWebSocket(server);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
