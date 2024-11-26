const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const cors = require('cors');

// Create an Express app and enable CORS
const app = express();
app.use(cors());

// HTTP server to handle both HTTP and WebSocket connections
const server = http.createServer(app);

// WebSocket server attached to the HTTP server
const wss = new WebSocket.Server({ server });

// WebSocket functionality
wss.on('connection', (ws) => {
  console.log('WebSocket: A client connected');

  ws.on('message', (message) => {
    try {
      console.log('WebSocket received:', message);
      // Example: Echo the message back to the WebSocket client
      ws.send(`Echo: ${message}`);
    } catch (error) {
      console.error('Error processing message:', error.message);
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
  });

  ws.on('close', () => {
    console.log('WebSocket: A client disconnected');
  });
});

// Socket.IO functionality
const socketIo = require('socket.io');
const io = socketIo(server, {
  cors: {
    origin: '*', // Allow all origins for testing (update for production)
    methods: ['GET', 'POST'],
  },
});

let users = []; // Store all users' locations

io.on('connection', (socket) => {
  console.log('Socket.IO: A user connected:', socket.id);

  socket.on('user-location', (data) => {
    const userIndex = users.findIndex((user) => user.id === data.id);
    if (userIndex > -1) {
      users[userIndex] = data; // Update user's location
    } else {
      users.push(data); // Add new user
    }

    console.log('User Locations (Socket.IO):', users);

    io.emit('user-location-update', users); // Broadcast updated locations
  });

  socket.on('disconnect', () => {
    console.log('Socket.IO: A user disconnected:', socket.id);
    users = users.filter((user) => user.id !== socket.id); // Remove user
    io.emit('user-location-update', users);
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
