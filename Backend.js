const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*', // Allow all origins for testing (update for production)
    methods: ['GET', 'POST'],
  },
});

app.use(cors()); // Enable CORS for frontend

let users = []; // Store all users' locations

// Serve static files (if any)
app.use(express.static('public'));

// Socket.IO functionality
io.on('connection', (socket) => {
  console.log('Socket.IO: A user connected:', socket.id);

  // Listen for user's location and update users list
  socket.on('user-location', (data) => {
    const userIndex = users.findIndex((user) => user.id === data.id);
    if (userIndex > -1) {
      users[userIndex] = data; // Update existing user's location
    } else {
      users.push(data); // Add new user to the list
    }

    console.log('User Locations (Socket.IO):', users);

    // Emit updated users' locations to all connected clients
    io.emit('user-location-update', users);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Socket.IO: A user disconnected:', socket.id);
    users = users.filter((user) => user.id !== socket.id); // Remove user from the list
    io.emit('user-location-update', users); // Broadcast updated user list
  });
});

// WebSocket functionality
const wss = new WebSocket.Server({ server }); // Attach WebSocket server to the same HTTP server
wss.on('connection', (ws) => {
  console.log('WebSocket: A client connected');

  ws.on('message', (message) => {
    console.log('WebSocket received:', message);
    // Example: Echo the message back to the WebSocket client
    ws.send(`Echo: ${message}`);
  });

  ws.on('close', () => {
    console.log('WebSocket: A client disconnected');
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
