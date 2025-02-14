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
let friends = {}; // Store friendships

// Function to calculate distance between two lat/lng points (in km)
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

// Handle user connection
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

    // Find nearby users
    const nearbyUsers = users.filter((user) => {
      if (user.id !== socket.id) {
        const distance = getDistance(data.lat, data.lng, user.lat, user.lng);
        return distance <= 10; // 10 km radius (adjust as needed)
      }
      return false;
    });

    // Send the nearby users to the frontend
    io.to(socket.id).emit("nearby-users", nearbyUsers);
  });

  // Handle user joining with username
  socket.on("join", (username) => {
    users.push({ id: socket.id, username });
    io.emit("live-users", users);
  });

  // Handle adding a friend
  socket.on("add-friend", (data) => {
    const { senderId, receiverId } = data;
    if (!friends[senderId]) {
      friends[senderId] = [];
    }
    friends[senderId].push(receiverId);

    if (!friends[receiverId]) {
      friends[receiverId] = [];
    }
    friends[receiverId].push(senderId);

    io.to(receiverId).emit("friend-added", senderId);
    io.to(senderId).emit("friend-added", receiverId);
  });

  // Handle sending a message to a friend
  socket.on("send-message", (data) => {
    const { senderId, receiverId, message } = data;
    io.to(receiverId).emit("receive-message", { senderId, message });
  });

  // Chat system: Join a room
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

  // Send a message within a room
  socket.on("send-message-room", ({ room, message, username }) => {
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

  // Disconnect user
  socket.on("disconnect", () => {
    console.log(`Socket.IO: A user disconnected with ID: ${socket.id}`);
    
    // Remove user from the users list
    users = users.filter((user) => user.id !== socket.id);
    io.emit("live-users", users);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
