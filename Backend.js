const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: [
      "https://fyproject-2b48f.web.app",
      "http://localhost:3000"
    ],
    methods: ["GET", "POST"],
  },
});

app.use(cors());

const PORT = process.env.PORT || 10000;

let users = []; // Now stores { id, lat, lng, isVisible }

io.on("connection", (socket) => {
  console.log(`Socket.IO: A user connected with ID: ${socket.id}`);

  // Initialize new user with default visibility
  users.push({
    id: socket.id,
    lat: null,
    lng: null,
    isVisible: true
  });

  // Listen for user location updates
  socket.on("user-location", (data) => {
    if (!data || !data.lat || !data.lng) {
      console.error("Invalid location data received:", data);
      return;
    }

    const user = users.find(u => u.id === socket.id);
    if (user) {
      user.lat = data.lat;
      user.lng = data.lng;
      user.isVisible = true; // Automatically make visible when updating location
      broadcastValidUsers();
    }
  });

  // New handler for visibility changes
  socket.on("visibility-change", (isVisible) => {
    const user = users.find(u => u.id === socket.id);
    if (user) {
      user.isVisible = isVisible;
      broadcastValidUsers();
    }
  });

  // New handler for direct removal requests
  socket.on("remove-user", () => {
    users = users.filter(u => u.id !== socket.id);
    broadcastValidUsers();
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`Socket.IO: A user disconnected with ID: ${socket.id}`);
    users = users.filter(u => u.id !== socket.id);
    broadcastValidUsers();
  });

  // Helper function to broadcast valid users
  function broadcastValidUsers() {
    const validUsers = users.filter(user => 
      user.isVisible && 
      user.lat !== null && 
      user.lng !== null
    );
    
    io.emit("nearby-users", validUsers);
  }
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});