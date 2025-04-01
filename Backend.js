const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: ["https://synchro-kappa.vercel.app", "https://localhost:3000"],
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;
let users = [];
let tickets = [];

// Track active connections
const activeConnections = new Set();

// Cleanup inactive users periodically
setInterval(() => {
  const now = Date.now();
  users = users.filter(user => {
    // Keep users who:
    // 1. Are still connected OR
    // 2. Disconnected recently (within last 5 minutes)
    return activeConnections.has(user.id) || 
           (user.lastSeen && now - user.lastSeen < 300000); // 5 minutes
  });
  broadcastUsers();
}, 60000); // Check every minute

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);
  activeConnections.add(socket.id);

  // Check if this is a reconnection of an existing user
  const existingUser = users.find(u => u.id === socket.id);
  if (!existingUser) {
    users.push({
      id: socket.id,
      lat: null,
      lng: null,
      isVisible: true,
      isConnected: true,
      name: "Anonymous",
      role: "user",
      image: "",
      lastSeen: Date.now()
    });
  } else {
    existingUser.isConnected = true;
    existingUser.lastSeen = Date.now();
  }

  socket.on("user-location", (data) => {
    if (!data?.lat || !data?.lng || !data?.role) return;

    const user = users.find((u) => u.id === socket.id);
    if (user) {
      user.lat = data.lat;
      user.lng = data.lng;
      user.role = data.role;
      user.name = data.name;
      user.isVisible = true;
      user.image = data.image;
      user.lastSeen = Date.now();

      broadcastUsers();
    }
  });

  socket.on("visibility-change", (isVisible) => {
    const user = users.find((u) => u.id === socket.id);
    if (user) {
      user.isVisible = isVisible;
      user.lastSeen = Date.now();
      broadcastUsers();
    }
  });

  socket.on("create-ticket", (ticket) => {
    if (ticket && ticket.id && ticket.lat && ticket.lng && 
        ticket.message && ticket.creatorId && ticket.creatorName) {
      tickets.push(ticket);
      io.emit("new-ticket", ticket);
      io.emit("all-tickets", tickets);
    } else {
      console.error("Invalid ticket data received:", ticket);
    }
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    activeConnections.delete(socket.id);
    
    const user = users.find(u => u.id === socket.id);
    if (user) {
      user.isConnected = false;
      user.lastSeen = Date.now();
    }
    
    broadcastUsers();
  });

  function broadcastUsers() {
    const validUsers = users.filter(
      (user) =>
        user.isVisible &&
        user.lat !== null &&
        user.lng !== null &&
        user.name !== null &&
        user.role !== null &&
        user.image !== null &&
        (user.isConnected || Date.now() - user.lastSeen < 300000) // Show recently active users
    );

    io.emit("nearby-users", validUsers);
    io.emit("all-tickets", tickets);
  }

  // Send initial data
  socket.emit("all-tickets", tickets);
  broadcastUsers();
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});