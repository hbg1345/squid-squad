const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer();
const io = new Server(server, { cors: { origin: '*' } });

let players = {};
let tokens = [];
const TOKEN_KEYS = ['token1', 'token2'];
const MAX_TOKENS = 20;
let nextTokenId = 1;

function randomToken() {
  return {
    id: nextTokenId++,
    key: TOKEN_KEYS[Math.floor(Math.random() * TOKEN_KEYS.length)],
    x: Math.floor(Math.random() * 600) + 50,
    y: Math.floor(Math.random() * 400) + 100,
  };
}

function spawnTokensIfNeeded() {
  while (tokens.length < MAX_TOKENS) {
    tokens.push(randomToken());
  }
}

function broadcastTokens() {
  io.emit('tokensUpdate', tokens);
}

function broadcastGameState() {
  io.emit('gameState', { players });
  broadcastTokens();
}

io.on('connection', (socket) => {
  players[socket.id] = { x: 100, y: 100, nickname: `플레이어${socket.id.slice(-4)}` };
  spawnTokensIfNeeded();
  broadcastGameState();

  // 클라이언트에 현재 토큰 정보 전송
  socket.emit('tokensUpdate', tokens);

  socket.on('playerMove', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      broadcastGameState();
    }
  });

  // 토큰 먹기 이벤트
  socket.on('collectToken', (tokenId) => {
    // 해당 토큰 제거
    const idx = tokens.findIndex(t => t.id === tokenId);
    if (idx !== -1) {
      tokens.splice(idx, 1);
      // 새 토큰 보충
      spawnTokensIfNeeded();
      broadcastTokens();
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