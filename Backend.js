const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: "https://fyproject-2b48f.firebaseapp.com",
    methods: ["GET", "POST"],
  },
});

app.use(cors());

const PORT = process.env.PORT || 10000;

let users = [];
let messages = {}; // Store messages per room

io.on("connection", (socket) => {
  console.log(`Socket.IO: A user connected with ID: ${socket.id}`);

  // Location tracking
  socket.on("user-location", (data) => {
    if (!data || !data.lat || !data.lng) {
      console.error("Invalid location data received:", data);
      return;
    }

    console.log(`Received user location update: ID ${socket.id} - Lat: ${data.lat}, Lng: ${data.lng}`);

    const existingUser = users.find((user) => user.id === socket.id);
    if (existingUser) {
      existingUser.lat = data.lat;
      existingUser.lng = data.lng;
    } else {
      users.push({ id: socket.id, lat: data.lat, lng: data.lng });
    }

    io.emit("update", { users });
  });

  // Chat system
  socket.on("join-room", (room) => {
    socket.join(room);
    console.log(`User ${socket.id} joined room: ${room}`);

    // Send existing messages to the new user
    if (messages[room]) {
      socket.emit("chat-history", messages[room]);
    } else {
      messages[room] = [];
    }
  });

  socket.on("send-message", ({ room, message, username }) => {
    const newMessage = {
      user: username,
      text: message,
      time: new Date().toLocaleTimeString(),
    };

    // Save message in the room's history
    messages[room].push(newMessage);

    // Broadcast the message to others in the same room
    io.to(room).emit("receive-message", newMessage);
  });

  socket.on("disconnect", () => {
    console.log(`Socket.IO: A user disconnected with ID: ${socket.id}`);

    users = users.filter((user) => user.id !== socket.id);
    io.emit("update", { users });
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
