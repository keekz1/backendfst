const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

// Use a static folder to serve images directly
app.use("/images", express.static("images"));

const corsOptions = {
  origin: [
    "https://synchro-kappa.vercel.app",
    "https://localhost:3000"
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// Socket.IO configuration
const io = socketIo(server, {
  cors: corsOptions,
  transports: ["websocket"],
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6,
  connectTimeout: 10000,
  path: "/socket.io",
  serveClient: false,
  cookie: false,
  allowEIO3: false,
  allowEIO4: true
});

// Global state
const connections = new Map();
let users = [];
let tickets = [];

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    connections: connections.size,
    users: users.length,
    tickets: tickets.length,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

io.on("connection", (socket) => {
  const clientId = socket.id;
  const clientIp = socket.handshake.address;

  // Add to connections tracking
  connections.set(clientId, {
    id: clientId,
    ip: clientIp,
    connectedAt: new Date(),
    lastActivity: new Date()
  });

  // New user initialization
  users.push({
    id: clientId,
    lat: null,
    lng: null,
    isVisible: true,
    name: "Anonymous",
    role: "user",
    image: ""
  });

  console.log(`🔗 New connection: ${clientId} from ${clientIp}`);

// location update handler
socket.on("user-location", (data) => {
    if (!validateLocationData(data)) {
        return socket.emit("error", { message: "Invalid location data" });
    }

    const user = users.find((u) => u.id === clientId);
    if (user) {
        user.lat = data.lat;
        user.lng = data.lng;
        user.role = data.role;
        user.name = data.name || "Anonymous";
        user.isVisible = true;

        // Corrected logic to construct the image URL
        // We'll use a hardcoded base URL for simplicity
        const baseUrl = "https://backendfst-ozrh.onrender.com";
        const imageUrl = data.image ? `${baseUrl}/images/${data.image}` : "";
        user.image = imageUrl;

        connections.get(clientId).lastActivity = new Date();

        broadcastUsers();
    }
});

  // Visibility toggle handler
  socket.on("visibility-change", (isVisible) => {
    const user = users.find((u) => u.id === clientId);
    if (user) {
      user.isVisible = isVisible;
      broadcastUsers();
    }
  });

  // Ticket creation handler
  socket.on("create-ticket", (ticket) => {
    if (
      ticket &&
      ticket.id &&
      ticket.lat &&
      ticket.lng &&
      ticket.message &&
      ticket.creatorId &&
      ticket.creatorName
    ) {
      tickets.push(ticket);
      io.emit("new-ticket", ticket);
      io.emit("all-tickets", tickets);
    } else {
      console.error("Invalid ticket data received:", ticket);
    }
  });

  // Request all users
  socket.on("request-users", () => {
    socket.emit("nearby-users", getValidUsers());
  });

  // Disconnection handler
  socket.on("disconnect", (reason) => {
    users = users.filter((u) => u.id !== clientId);
    connections.delete(clientId);
    broadcastUsers();
    console.log(`❌ Disconnected: ${clientId} (Reason: ${reason})`);
  });

  // Error handler
  socket.on("error", (err) => {
    console.error(`🚨 Socket error (${clientId}):`, err);
    socket.emit("fatal-error", {
      code: "WS_ERROR",
      message: "Connection error"
    });
  });

  // Send initial data to new connection
  socket.emit("nearby-users", getValidUsers());
  socket.emit("all-tickets", tickets);
});

// Helper function to get valid users
function getValidUsers() {
  return users.filter(
    (user) =>
      user.isVisible &&
      user.lat !== null &&
      user.lng !== null &&
      user.name !== null &&
      user.role !== null &&
      user.image !== null
  );
}

// Broadcast users to all clients
function broadcastUsers() {
  io.emit("nearby-users", getValidUsers());
}

// Inactivity connection monitoring
setInterval(() => {
  const now = new Date();
  connections.forEach((conn, id) => {
    if (now - conn.lastActivity > 7200000) { // 2 hours inactivity
      io.to(id).disconnect(true);
      connections.delete(id);
      users = users.filter((u) => u.id !== id);
      console.log(`⏳ Disconnected inactive connection: ${id}`);
      broadcastUsers();
    }
  });
}, 60000);

const PORT = process.env.PORT || 10000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`
    Server running on port ${PORT}
    Active connections: ${connections.size}
    Tracked users: ${users.length}
    Active tickets: ${tickets.length}
  `);
});

// Process-level error handling
process.on("uncaughtException", (err) => {
  console.error("  Uncaught Exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("  Unhandled Rejection at:", promise, "reason:", reason);
});

// Validation function
function validateLocationData(data) {
  return (
    data &&
    typeof data.lat === "number" &&
    typeof data.lng === "number" &&
    typeof data.role === "string" &&
    data.lat >= -90 && data.lat <= 90 &&
    data.lng >= -180 && data.lng <= 180
  );
}