const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer();
const io = new Server(server, { cors: { origin: '*' } });

let players = {};

function broadcastGameState() {
  io.emit('gameState', { players });
}

io.on('connection', (socket) => {
  players[socket.id] = { x: 100, y: 100, nickname: `플레이어${socket.id.slice(-4)}` };
  broadcastGameState();

  socket.on('playerMove', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      broadcastGameState();
    }
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    broadcastGameState();
  });
});

server.listen(3001, () => {
  console.log('Socket.io server running on port 3001');
}); 