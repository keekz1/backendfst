const WebSocket = require('ws');

// Set port from environment or default to 8080
const port = process.env.PORT || 8080;

// Create a WebSocket server that listens on the specified port
const wss = new WebSocket.Server({ port: port });

let users = [];

// Handle new connections to the WebSocket server
wss.on('connection', ws => {
  console.log('A new user connected.');

  // Handle incoming messages
  ws.on('message', (message) => {
    const data = JSON.parse(message);
    const user = { id: data.id, lat: data.lat, lng: data.lng };
    users = users.filter(u => u.id !== data.id);
    users.push(user);

    // Broadcast the updated user list to all clients
    wss.clients.forEach(client => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(users));
      }
    });
  });

  ws.on('close', () => {
    users = users.filter(user => user.ws !== ws);
    console.log('A user disconnected.');
  });
});

console.log(`WebSocket server is running on port ${port}`);
