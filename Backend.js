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
let users = [];

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Initialize user with visible: true
  users.push({
    id: socket.id,
    lat: null,
    lng: null,
    isVisible: true
  });

  socket.on("user-location", (data) => {
    if (!data?.lat || !data?.lng) return;

    const user = users.find(u => u.id === socket.id);
    if (user) {
      user.lat = data.lat;
      user.lng = data.lng;
      user.isVisible = true; // Force visible when location updates
      broadcastUsers();
    }
  });

  socket.on("visibility-change", (isVisible) => {
    const user = users.find(u => u.id === socket.id);
    if (user) {
      user.isVisible = isVisible;
      broadcastUsers();
    }
  });

  socket.on("disconnect", () => {
    users = users.filter(u => u.id !== socket.id);
    broadcastUsers();
    console.log(`User disconnected: ${socket.id}`);
  });

  function broadcastUsers() {
    // Filter valid visible users
    const validUsers = users.filter(user => 
      user.isVisible && 
      user.lat !== null && 
      user.lng !== null
    );
    
    io.emit("nearby-users", validUsers);
  }
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});