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

io.on("connection", (socket) => {
  console.log(`Socket.IO: A user connected with ID: ${socket.id}`);

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

  socket.on("disconnect", () => {
    console.log(`Socket.IO: A user disconnected with ID: ${socket.id}`);

    users = users.filter((user) => user.id !== socket.id);

    io.emit("update", { users });
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
