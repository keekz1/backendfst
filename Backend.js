const WebSocket = require('ws');
const http = require('http');

// Create an HTTP server to handle WebSocket connections
const server = http.createServer();
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('A client connected');
  ws.on('message', (message) => {
    console.log('received: %s', message);
  });
});

// Get the port from environment variable or use a default
const port = process.env.PORT || 8080;
server.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
