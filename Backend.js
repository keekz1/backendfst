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
  console.log(`Socket.IO: A user connected with ID: ${socket.id}`);

  // Handle user location updates
  socket.on("user-location", (data) => {
    if (!data || !data.lat || !data.lng) {
      console.error("Invalid location data received:", data);
      return;
    }

    console.log(`Received user location update: ID ${socket.id} - Lat: ${data.lat}, Lng: ${data.lng}`);

    // Check if the user already exists and update their location
    const existingUser = users.find((user) => user.id === socket.id);
    if (existingUser) {
      existingUser.lat = data.lat;
      existingUser.lng = data.lng;
    } else {
      // If the user does not exist, add them to the list
      users.push({ id: socket.id, lat: data.lat, lng: data.lng });
    }

    // Emit updated user list to all clients
    io.emit("update", { users });
  });

  // Handle user disconnection
  socket.on("disconnect", () => {
    console.log(`Socket.IO: A user disconnected with ID: ${socket.id}`);

    // Remove the user from the list
    users = users.filter((user) => user.id !== socket.id);

    // Notify remaining clients about the updated user list
    io.emit("update", { users });
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
