const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");

// Create app and server
const app = express();
const server = http.createServer(app);

// Socket.IO setup
const io = socketIo(server, {
  cors: {
    origin: "https://fyproject-2b48f.firebaseapp.com", // Allow requests from your deployed client
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(cors());

// Port configuration
const PORT = process.env.PORT || 10000;

// Store user locations in-memory (this could be replaced with a database for persistence)
let users = [];

// Socket.IO event handlers
io.on("connection", (socket) => {
  console.log("Socket.IO: A user connected:", socket.id);

  // Send the current users list to the newly connected user
  socket.emit("current-users", users);

  // Handle user location updates
  socket.on("user-location", (data) => {
    if (!data || !data.lat || !data.lng) {
      console.error("Invalid location data received:", data);
      return;
    }

    console.log("Received user location:", data);

    // Check if the user already exists and update their location, or add a new user if it's their first time
    const existingUser = users.find((user) => user.id === socket.id);
    if (existingUser) {
      // Update the user's location
      existingUser.lat = data.lat;
      existingUser.lng = data.lng;
    } else {
      // Add new user with location
      users.push({ id: socket.id, lat: data.lat, lng: data.lng });
    }

    // Emit updated user list to all clients
    io.emit("update", { users });
  });

  // Handle user disconnection
  socket.on("disconnect", () => {
    console.log("Socket.IO: A user disconnected:", socket.id);

    // Remove user from the list
    users = users.filter((user) => user.id !== socket.id);

    // Notify remaining clients
    io.emit("update", { users });
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
