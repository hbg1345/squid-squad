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
  const token = {
    id: nextTokenId++,
    key: TOKEN_KEYS[Math.floor(Math.random() * TOKEN_KEYS.length)],
    x: Math.floor(Math.random() * 1920),
    y: Math.floor(Math.random() * 1080),
  };
  console.log('[SERVER] randomToken created:', token);
  return token;
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

function broadcastGameState(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  // console.log(`[SERVER] broadcastGameState to ${roomId}, players:`, Object.keys(room.players));
  io.to(roomId).emit('gameState', { players: room.players });
  io.to(roomId).emit('tokensUpdate', room.tokens);
  console.log(`[SERVER] broadcastGameState: tokensUpdate for room ${roomId}:`, room.tokens);
}

let playerInputs = {};
const PLAYER_SPEED = 500 / 60; // 500px/sec, 60fps 기준 프레임당 이동량

let waitingPlayers = [];
const MATCH_SIZE = 2;
let rooms = {};
let roomSeq = 1;

io.on('connection', (socket) => {
  socket.on('joinGame', ({ roomId, nickname }) => {
    if (!rooms[roomId]) return;
    rooms[roomId].players[socket.id] = { x: 100, y: 100, nickname };
    rooms[roomId].playerInputs = rooms[roomId].playerInputs || {};
    rooms[roomId].playerInputs[socket.id] = { left: false, right: false, up: false, down: false };
    // 토큰 초기화(없거나 비어 있으면 생성)
    if (!rooms[roomId].tokens || rooms[roomId].tokens.length === 0) {
      rooms[roomId].tokens = [];
      while (rooms[roomId].tokens.length < MAX_TOKENS) {
        const newToken = randomToken();
        rooms[roomId].tokens.push(newToken);
        console.log(`[SERVER] Token added to room ${roomId}:`, newToken);
      }
      console.log(`[SERVER] Room ${roomId} tokens after creation:`, rooms[roomId].tokens);
    }
    console.log(`[SERVER] joinGame: roomId=${roomId}, nickname=${nickname}, socketId=${socket.id}`);
    broadcastGameState(roomId);
  });

  // 클라이언트에 현재 토큰 정보 전송
  socket.emit('tokensUpdate', tokens);

  // 클라이언트에 현재 Younghee 위치 전송
  socket.emit('youngheeUpdate', younghee);

  socket.on('playerInput', ({ roomId, input }) => {
    if (!rooms[roomId] || !rooms[roomId].playerInputs[socket.id]) return;
    rooms[roomId].playerInputs[socket.id] = input;
  });

  socket.on('playerMove', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      broadcastGameState();
    }
  });

  // 토큰 먹기 이벤트
  socket.on('collectToken', ({ roomId, tokenId }) => {
    if (!rooms[roomId]) return;
    const idx = rooms[roomId].tokens.findIndex(t => t.id === tokenId);
    if (idx !== -1) {
      rooms[roomId].tokens.splice(idx, 1);
      // 새 토큰 보충
      while (rooms[roomId].tokens.length < MAX_TOKENS) {
        const newToken = randomToken();
        rooms[roomId].tokens.push(newToken);
        console.log(`[SERVER] Token replenished in room ${roomId}:`, newToken);
      }
      console.log(`[SERVER] Room ${roomId} tokens after replenish:`, rooms[roomId].tokens);
      io.to(roomId).emit('tokensUpdate', rooms[roomId].tokens);
      console.log(`[SERVER] tokensUpdate emitted for room ${roomId}:`, rooms[roomId].tokens);
    }
  });

  socket.on('joinMatch', () => {
    if (!waitingPlayers.includes(socket)) {
      waitingPlayers.push(socket);
      io.emit('matchingCount', waitingPlayers.length);
      if (waitingPlayers.length >= MATCH_SIZE) {
        const matched = waitingPlayers.splice(0, MATCH_SIZE);
        const roomId = `room${roomSeq++}`;
        rooms[roomId] = { players: {}, tokens: [], created: Date.now() };
        matched.forEach(s => {
          s.join(roomId);
          s.emit('matchFound', { roomId });
        });
      }
    }
  });
  socket.on('leaveMatch', () => {
    waitingPlayers = waitingPlayers.filter(s => s !== socket);
    io.emit('matchingCount', waitingPlayers.length);
  });
  socket.on('disconnect', () => {
    // 모든 방에서 플레이어 제거
    Object.entries(rooms).forEach(([roomId, room]) => {
      if (room.players[socket.id]) {
        delete room.players[socket.id];
        delete room.playerInputs[socket.id];
        broadcastGameState(roomId);
      }
    });
    waitingPlayers = waitingPlayers.filter(s => s !== socket);
    delete players[socket.id];
    delete playerInputs[socket.id];
    broadcastGameState();
  });
});

// 60fps 기준으로 위치 계산 및 broadcast (방별로)
setInterval(() => {
  Object.entries(rooms).forEach(([roomId, room]) => {
    for (const id in room.players) {
      const input = room.playerInputs[id] || {};
      let dx = 0, dy = 0;
      if (input.left) dx -= PLAYER_SPEED;
      if (input.right) dx += PLAYER_SPEED;
      if (input.up) dy -= PLAYER_SPEED;
      if (input.down) dy += PLAYER_SPEED;
      room.players[id].x = Math.max(20, Math.min(1920 - 20, room.players[id].x + dx));
      room.players[id].y = Math.max(20, Math.min(1080 - 20, room.players[id].y + dy));
    }
    broadcastGameState(roomId);
  });
}, 1000/60);

server.listen(process.env.PORT || 3001, () => {
  console.log(`Socket.io server running on port ${process.env.PORT || 3001}`);
}); 