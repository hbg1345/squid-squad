const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();
const { MATCH_SIZE, MAX_TOKENS } = require('../shared/constants');

const server = http.createServer();
const io = new Server(server, { cors: { origin: '*' } });

let players = {};
let tokens = [];
const TOKEN_KEYS = ['token1', 'token2'];
let nextTokenId = 1;

// 각 방별 Younghee(영희) 상태는 rooms[roomId].younghee로 관리

function randomToken() {
  const token = {
    id: nextTokenId++,
    key: TOKEN_KEYS[Math.floor(Math.random() * TOKEN_KEYS.length)],
    x: Math.floor(Math.random() * 1920),
    y: Math.floor(Math.random() * 1080),
  };
  return token;
}

function spawnTokensIfNeeded(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  while (room.tokens.length < MAX_TOKENS_PER_ROOM) {
      room.tokens.push(randomToken());
  }
}

function broadcastYounghee(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  io.to(roomId).emit('youngheeUpdate', room.younghee);
}

function randomizeYoungheePosition(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  room.younghee.x = Math.floor(Math.random() * 1920);
  room.younghee.y = Math.floor(Math.random() * 1080);
}

function broadcastYounghee(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  io.to(roomId).emit('youngheeUpdate', room.younghee);
}

// 5초마다 각 방 Younghee 위치 랜덤 변경 및 브로드캐스트
setInterval(() => {
  Object.keys(rooms).forEach(roomId => {
    randomizeYoungheePosition(roomId);
    broadcastYounghee(roomId);
  });
}, 5000);

function broadcastGameState(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  io.to(roomId).emit('gameState', { players: room.players });
  io.to(roomId).emit('tokensUpdate', room.tokens);
}

let playerInputs = {};
const PLAYER_SPEED = 500 / 60; // 500px/sec, 60fps 기준 프레임당 이동량

let waitingPlayers = [];
let rooms = {};
let roomSeq = 1;

io.on('connection', (socket) => {
  socket.on('joinGame', ({ roomId, nickname }) => {
    console.log(`[joinGame] socket.id=${socket.id}, roomId=${roomId}, nickname=${nickname}`);
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
      }
    }
    console.log(`[joinGame] players in room ${roomId}:`, Object.keys(rooms[roomId].players));
    broadcastGameState(roomId);
  });

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
      }
      io.to(roomId).emit('tokensUpdate', rooms[roomId].tokens);
    }
  });

  socket.on('playerDead', ({ roomId }) => {
    if (!rooms[roomId]) return;
    delete rooms[roomId].players[socket.id];
    delete rooms[roomId].playerInputs[socket.id];
    broadcastGameState(roomId);
  });

  socket.on('joinMatch', () => {
    if (!waitingPlayers.includes(socket)) {
      waitingPlayers.push(socket);
      io.emit('matchingCount', waitingPlayers.length);
      if (waitingPlayers.length >= MATCH_SIZE) {
        const matched = waitingPlayers.splice(0, MATCH_SIZE);
        const roomId = `room${roomSeq++}`;
        rooms[roomId] = { players: {}, tokens: [], created: Date.now(), younghee: { x: 360, y: 180 }, gameType: 'redlight' };
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
  socket.on('chat', ({ roomId, nickname, message, time }) => {
    // 같은 roomId에 join된 모든 유저에게 메시지 전송
    io.to(roomId).emit('chat', { roomId, nickname, message, time });
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

  socket.on('playerPush', ({ id, dx, dy }) => {
    // 1. 현재 소켓이 속한 방 ID를 찾습니다.
    // (socket.rooms는 Set이라서, 자기 자신의 ID를 제외한 첫 번째 방을 찾습니다.)
    const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
    if (!roomId) {
        console.log(`[ERROR] playerPush: room not found for socket ${socket.id}`);
        return;
    }

    const room = rooms[roomId];
    if (!room) {
        console.log(`[ERROR] playerPush: room object not found for room ID ${roomId}`);
        return;
    }

    // 2. 해당 방에서 밀쳐질 플레이어를 찾습니다.
    if (room.players[id]) {
        const PUSH_DIST = 100;
        room.players[id].x += dx * PUSH_DIST;
        room.players[id].y += dy * PUSH_DIST;

        // 3. 해당 방의 모든 클라이언트에게 브로드캐스트합니다.
        console.log(`[SUCCESS] Pushing player ${id} in room ${roomId}`);
        io.to(roomId).emit('playerPushed', {
            id: id,
            x: room.players[id].x,
            y: room.players[id].y
        });
    } else {
        console.log(`[ERROR] playerPush: player ${id} not found in room ${roomId}`);
    }
});

  // survived 이벤트 처리
  socket.on('survived', ({ roomId, nickname }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (!room.players[socket.id]) return;
    room.players[socket.id].survived = true;
    // 모든 남은 플레이어가 survived를 보냈는지 체크
    const allSurvived = Object.values(room.players).every(p => p.survived);
    if (allSurvived) {
      const playerList = Object.entries(room.players).map(([id, info]) => ({ id, nickname: info.nickname }));
      console.log(`[phaseChange] roomId=${roomId}, players:`, Object.keys(room.players), 'playerList:', playerList);
      
      // 게임 2를 위해 플레이어 위치 및 상태 초기화
      Object.values(room.players).forEach(player => {
        player.x = 0;
        player.y = 0;
        player.roomIndex = null; // 방 상태 초기화
        delete player.survived; // 상태 플래그 정리
      });

      // 게임 타입을 'pair'로 변경
      room.gameType = 'pair';
      console.log(`[gameTypeChange] roomId=${roomId} changed to 'pair'`);
      Object.keys(room.players).forEach(id => {
        io.to(id).emit('phaseChange', { phase: 'pair', players: playerList, roomId: roomId });
      });
    }
  });

  // 게임2 입력 처리
  socket.on('game2Input', ({ roomId, input }) => {
    const room = rooms[roomId];
    if (!room || !room.players[socket.id]) return;
    // input: { x, y }
    room.players[socket.id].x = input.x;
    room.players[socket.id].y = input.y;
  });

  // 게임2 방 입장
  socket.on('enterRoom', ({ roomId, roomIndex }) => {
    const room = rooms[roomId];
    if (!room || !room.players[socket.id]) return;
    room.players[socket.id].roomIndex = roomIndex;
    room.players[socket.id].x = 0;
    room.players[socket.id].y = 0;
  });

  // 게임2 방 퇴장
  socket.on('exitRoom', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || !room.players[socket.id]) return;
    room.players[socket.id].roomIndex = null;
    // x, y는 메인 씬에서 다시 동기화되므로 여기서 바꿀 필요 없음
  });
});

// 60fps 기준으로 위치 계산 및 broadcast (방별로)
setInterval(() => {
  Object.entries(rooms).forEach(([roomId, room]) => {
    if (room.gameType === 'redlight') {
      // 기존 게임1 위치 계산 및 broadcast
      for (const id in room.players) {
        const input = room.playerInputs ? (room.playerInputs[id] || {}) : {};
        let dx = 0, dy = 0;
        const PLAYER_SPEED = 500 / 60;
        if (input.left) dx -= PLAYER_SPEED;
        if (input.right) dx += PLAYER_SPEED;
        if (input.up) dy -= PLAYER_SPEED;
        if (input.down) dy += PLAYER_SPEED;
        if (room.players[id] && (dx !== 0 || dy !== 0)) { // 입력이 있을 때만 위치 변경
          room.players[id].x = Math.max(20, Math.min(1920 - 20, room.players[id].x + dx));
          room.players[id].y = Math.max(20, Math.min(1080 - 20, room.players[id].y + dy));
        }
      }
      broadcastGameState(roomId);
    } else if (room.gameType === 'pair') {
      // 게임2용 실시간 동기화만 (위치 계산 제거)
      io.to(roomId).emit('game2State', { players: room.players });
    }
  });
}, 1000/60);

server.listen(process.env.PORT || 3001); 