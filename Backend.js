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
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

let users = new Map();
let tickets = [];

// Updated cleanup intervals
setInterval(() => {
  const now = Date.now();
  users.forEach((user, id) => {
    if (now - user.lastSeen > 300000) { // 5 minutes
      users.delete(id);
      console.log(`Removed inactive user: ${id}`);
    }
  });
  tickets = tickets.filter(t => now - t.createdAt < 3600000);
}, 60000); // Check every minute

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

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
      user.status = 'away';
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
      user.status !== 'away' &&
      user.isVisible &&
      user.lat !== null &&
      user.lng !== null
    );
    io.emit("nearby-users", validUsers);
  }

  function broadcastTickets() {
    io.emit("all-tickets", tickets);
  }

  socket.emit("all-tickets", tickets);
  broadcastUsers();
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});