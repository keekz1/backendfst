const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: ["https://synchro-kappa.vercel.app", "http://localhost:3000"],
    methods: ["GET", "POST"],
  },
  pingTimeout: 60000, // 60 seconds without heartbeat
  pingInterval: 25000, // Send ping every 25 seconds
});

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

// Enhanced user tracking
let users = new Map();
let tickets = [];

// Cleanup old data every 5 minutes
setInterval(() => {
  const now = Date.now();
  
  // Cleanup old users (30 seconds since last heartbeat)
  users.forEach((user, id) => {
    if (now - user.lastSeen > 30000) {
      users.delete(id);
      console.log(`Removed inactive user: ${id}`);
    }
  });

  // Cleanup old tickets (1 hour)
  tickets = tickets.filter(t => now - t.createdAt < 3600000);
}, 300000);

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Initialize user with presence tracking
  users.set(socket.id, {
    id: socket.id,
    lat: null,
    lng: null,
    isVisible: true,
    name: "Anonymous",
    role: "user",
    image: "",
    status: "online",
    lastSeen: Date.now()
  });

  // Presence tracking handlers
  socket.on("presence", (status) => {
    const user = users.get(socket.id);
    if (user) {
      user.status = status;
      user.lastSeen = Date.now();
      broadcastUsers();
    }
  });

  socket.on("heartbeat", () => {
    const user = users.get(socket.id);
    if (user) {
      user.lastSeen = Date.now();
    }
  });

  socket.on("user-location", (data) => {
    const user = users.get(socket.id);
    if (user && data?.lat && data?.lng) {
      Object.assign(user, {
        lat: data.lat,
        lng: data.lng,
        role: data.role || "user",
        name: data.name || "Anonymous",
        image: data.image || "",
        lastSeen: Date.now()
      });
      broadcastUsers();
    }
  });

  socket.on("visibility-change", (isVisible) => {
    const user = users.get(socket.id);
    if (user) {
      user.isVisible = isVisible;
      user.lastSeen = Date.now();
      broadcastUsers();
    }
  });

  socket.on("create-ticket", (ticket) => {
    if (validateTicket(ticket)) {
      tickets.push({
        ...ticket,
        createdAt: Date.now()
      });
      io.emit("new-ticket", ticket);
      broadcastTickets();
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`User disconnected (${reason}): ${socket.id}`);
    const user = users.get(socket.id);
    if (user) {
      // Give 30 seconds to reconnect
      user.status = "offline";
      user.lastSeen = Date.now();
      broadcastUsers();
    }
  });

  function validateTicket(ticket) {
    return ticket?.id && ticket.lat && ticket.lng && 
           ticket.message && ticket.creatorId && ticket.creatorName;
  }

  function broadcastUsers() {
    const validUsers = Array.from(users.values()).filter(user => 
      user.status !== "offline" &&
      user.isVisible &&
      user.lat !== null &&
      user.lng !== null
    );
    io.emit("nearby-users", validUsers);
  }

  function broadcastTickets() {
    io.emit("all-tickets", tickets);
  }

  // Send initial data
  socket.emit("all-tickets", tickets);
  broadcastUsers();
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});