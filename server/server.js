const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const server = http.createServer();
const io = new Server(server, { cors: { origin: '*' } });

let players = {};
let tokens = [];
const TOKEN_KEYS = ['token1', 'token2'];
const MAX_TOKENS = 20;
let nextTokenId = 1;

// Younghee(영희) 위치만 동기화
let younghee = {
  x: 360, // 중앙
  y: 180
};

function randomToken() {
  return {
    id: nextTokenId++,
    key: TOKEN_KEYS[Math.floor(Math.random() * TOKEN_KEYS.length)],
    x: Math.floor(Math.random() * 1920),
    y: Math.floor(Math.random() * 1080),
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

function randomizeYoungheePosition() {
  younghee.x = Math.floor(Math.random() * 1920);
  younghee.y = Math.floor(Math.random() * 1080);
}

function broadcastYounghee() {
  io.emit('youngheeUpdate', younghee);
}

// 5초마다 Younghee 위치 랜덤 변경 및 전체 브로드캐스트
setInterval(() => {
  randomizeYoungheePosition();
  broadcastYounghee();
}, 5000);

function broadcastGameState() {
  io.emit('gameState', { players });
  broadcastTokens();
  // youngheeUpdate emit 제거 (setInterval과 on connect에서만 emit)
}

let playerInputs = {};
const PLAYER_SPEED = 500 / 60; // 500px/sec, 60fps 기준 프레임당 이동량

let waitingPlayers = [];
const MATCH_SIZE = 2;

io.on('connection', (socket) => {
  players[socket.id] = { x: 100, y: 100, nickname: `플레이어${socket.id.slice(-4)}` };
  playerInputs[socket.id] = { left: false, right: false, up: false, down: false };
  spawnTokensIfNeeded();
  broadcastGameState();

  // 클라이언트에 현재 토큰 정보 전송
  socket.emit('tokensUpdate', tokens);

  // 클라이언트에 현재 Younghee 위치 전송
  socket.emit('youngheeUpdate', younghee);

  socket.on('playerInput', (input) => {
    playerInputs[socket.id] = input;
    // console.log(`[INPUT] ${socket.id}:`, input); // 로그 제거
  });

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

  socket.on('joinMatch', () => {
    if (!waitingPlayers.includes(socket)) {
      waitingPlayers.push(socket);
      io.emit('matchingCount', waitingPlayers.length);
      if (waitingPlayers.length >= MATCH_SIZE) {
        const matched = waitingPlayers.splice(0, MATCH_SIZE);
        matched.forEach(s => s.emit('matchFound'));
      }
    }
  });
  socket.on('leaveMatch', () => {
    waitingPlayers = waitingPlayers.filter(s => s !== socket);
    io.emit('matchingCount', waitingPlayers.length);
  });
  socket.on('disconnect', () => {
    waitingPlayers = waitingPlayers.filter(s => s !== socket);
    delete players[socket.id];
    delete playerInputs[socket.id];
    broadcastGameState();
  });
});

// 60fps 기준으로 위치 계산 및 broadcast
setInterval(() => {
  for (const id in players) {
    const input = playerInputs[id] || {};
    let dx = 0, dy = 0;
    if (input.left) dx -= PLAYER_SPEED;
    if (input.right) dx += PLAYER_SPEED;
    if (input.up) dy -= PLAYER_SPEED;
    if (input.down) dy += PLAYER_SPEED;
    const oldX = players[id].x;
    const oldY = players[id].y;
    players[id].x = Math.max(20, Math.min(1920 - 20, players[id].x + dx));
    players[id].y = Math.max(20, Math.min(1080 - 20, players[id].y + dy));
    if (dx !== 0 || dy !== 0) {
      // console.log(`[MOVE] ${id}: (${oldX}, ${oldY}) -> (${players[id].x}, ${players[id].y})`); // 로그 제거
    }
  }
  broadcastGameState();
}, 1000/60);

server.listen(process.env.PORT || 3001, () => {
  console.log(`Socket.io server running on port ${process.env.PORT || 3001}`);
}); 