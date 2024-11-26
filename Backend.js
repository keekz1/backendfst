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

// Helper function to randomize location within a 0.1-mile radius
const randomizeLocation = (lat, lng, radiusInMiles = 0.1) => {
  const degreeOffset = radiusInMiles / 69; // Approximation: 1 degree of latitude ~ 69 miles
  const randomLat = lat + (Math.random() * 2 - 1) * degreeOffset; // Randomize latitude
  const randomLng = lng + (Math.random() * 2 - 1) * degreeOffset; // Randomize longitude
  return { lat: randomLat, lng: randomLng };
};

// Socket.IO event handlers
io.on("connection", (socket) => {
  console.log("Socket.IO: A user connected:", socket.id);

  // Handle user location updates
  socket.on("user-location", (data) => {
    if (!data || !data.lat || !data.lng) {
      console.error("Invalid location data received:", data);
      return;
    }
    
    console.log("Received user location:", data);

    // Randomize the user's location
    const randomizedLocation = randomizeLocation(data.lat, data.lng, 0.1);

    // Update the user's location in the list
    const existingUser = users.find((user) => user.id === socket.id);
    if (existingUser) {
      existingUser.lat = randomizedLocation.lat;
      existingUser.lng = randomizedLocation.lng;
    } else {
      users.push({ id: socket.id, lat: randomizedLocation.lat, lng: randomizedLocation.lng, visible: true });
    }

    // Emit updated user list to all clients
    io.emit("update", { users });
  });

  // Handle invisible mode updates
  socket.on("user-invisible", (data) => {
    const user = users.find((user) => user.id === data.id);
    if (user) {
      user.visible = !data.invisible; // Toggle visibility
    }
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
