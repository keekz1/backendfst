const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3001", // Your frontend URL
    methods: ["GET", "POST"],
  },
});

app.use(cors());

const PORT = process.env.PORT || 10000;

let users = []; // Array to hold all users with their location (id, lat, lng)
let messages = []; // Optional: Store messages if you plan to add a chat feature

io.on("connection", (socket) => {
  console.log(`Socket.IO: A user connected with ID: ${socket.id}`);

  // Listen for user location updates
  socket.on("user-location", (data) => {
    if (!data || !data.lat || !data.lng) {
      console.error("Invalid location data received:", data);
      return;
    }

    console.log(`Received user location update: ID ${socket.id} - Lat: ${data.lat}, Lng: ${data.lng}`);

    // Check if the user already exists, if so update their location
    const existingUser = users.find((user) => user.id === socket.id);
    if (existingUser) {
      existingUser.lat = data.lat;
      existingUser.lng = data.lng;
    } else {
      // Add new user if they don't exist in the users array
      users.push({ id: socket.id, lat: data.lat, lng: data.lng });
    }

    // Emit the updated users list to all clients
    io.emit("update", { users });
  });

  // Handle user disconnection
  socket.on("disconnect", () => {
    console.log(`Socket.IO: A user disconnected with ID: ${socket.id}`);

    // Remove the user from the list when disconnected
    users = users.filter((user) => user.id !== socket.id);

    // Emit the updated users list to all remaining clients
    io.emit("update", { users });
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
