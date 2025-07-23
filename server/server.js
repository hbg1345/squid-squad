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
// setInterval(() => {
//   Object.keys(rooms).forEach(roomId => {
//     randomizeYoungheePosition(roomId);
//     broadcastYounghee(roomId);
//   });
// }, 5000);

// 1~5초 랜덤으로 Younghee 위치 변경 및 브로드캐스트 (방별 타이머)
function scheduleYoungheeMoveForRoom(roomId) {
  const delay = Math.random() * 4000 + 1000; // 1000~5000ms
  const room = rooms[roomId];
  if (!room) return;
  if (room.youngheeTimer) clearTimeout(room.youngheeTimer);
  room.youngheeTimer = setTimeout(() => {
    randomizeYoungheePosition(roomId);
    io.to(roomId).emit('youngheeUpdate', {
      x: room.younghee.x,
      y: room.younghee.y,
      nextDelay: delay
    });
    scheduleYoungheeMoveForRoom(roomId);
  }, delay);
}

function broadcastGameState(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  // tokenCount도 포함해서 브로드캐스트
  io.to(roomId).emit('gameState', { players: room.players });
  io.to(roomId).emit('tokensUpdate', room.tokens);
}

let playerInputs = {};
const PLAYER_SPEED = 500 / 60; // 500px/sec, 60fps 기준 프레임당 이동량

let waitingPlayers = [];
let rooms = {};
let roomSeq = 1;

io.on('connection', (socket) => {
  socket.on('joinGame', ({ roomId, nickname, character }) => {
    console.log(`[joinGame] socket.id=${socket.id}, roomId=${roomId}, nickname=${nickname}, character=${character}`);
    if (!rooms[roomId]) return;
    rooms[roomId].players[socket.id] = { x: 100, y: 100, nickname, character, tokenCount: 0 };
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
      // 토큰 먹은 플레이어의 tokenCount 증가
      if (rooms[roomId].players[socket.id]) {
        rooms[roomId].players[socket.id].tokenCount = (rooms[roomId].players[socket.id].tokenCount || 0) + 1;
      }
      broadcastGameState(roomId);
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
        rooms[roomId] = { players: {}, tokens: [], created: Date.now(), younghee: { x: 360, y: 180 }, gameType: 'redlight', readyPlayers: new Set(), youngheeTimer: null };
        scheduleYoungheeMoveForRoom(roomId);
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

        // 밀쳐진 플레이어가 토큰을 갖고 있으면 1/x(조화분포)로 절반 이하 랜덤 개수만큼 떨어뜨림
        const tokenCount = room.players[id].tokenCount || 0;
        const maxDrop = Math.floor(tokenCount / 2);
        if (maxDrop > 0) {
          // 1/x 분포로 x를 뽑기
          let sum = 0;
          for (let i = 1; i <= maxDrop; i++) sum += 1 / i;
          let r = Math.random() * sum;
          let x = 1;
          for (let i = 1; i <= maxDrop; i++) {
            r -= 1 / i;
            if (r <= 0) {
              x = i;
              break;
            }
          }
          room.players[id].tokenCount -= x;
          for (let i = 0; i < x; i++) {
            const droppedToken = randomToken();
            // 랜덤 각도, 거리, 속도
            const angle = Math.random() * 2 * Math.PI;
            const dist = 30 + Math.random() * 20;
            const speed = 200 + Math.random() * 100; // px/sec
            droppedToken.x = room.players[id].x + Math.cos(angle) * dist;
            droppedToken.y = room.players[id].y + Math.sin(angle) * dist;
            droppedToken.vx = Math.cos(angle) * speed;
            droppedToken.vy = Math.sin(angle) * speed;
            droppedToken.droppedAt = Date.now();
            room.tokens.push(droppedToken);
          }
          io.to(roomId).emit('tokensUpdate', room.tokens);
        }

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
    // --- 로그 추가: 현재 players와 survived 여부 ---
    console.log(`[survived] roomId=${roomId}`);
    Object.entries(room.players).forEach(([id, player]) => {
      console.log(`  playerId=${id}, nickname=${player.nickname}, survived=${!!player.survived}`);
    });
    // 모든 남은 플레이어가 survived를 보냈는지 체크
    const allSurvived = Object.values(room.players).every(p => p.survived);
    console.log(`[survived] allSurvived=${allSurvived}`);
    if (allSurvived) {
      const playerList = Object.entries(room.players).map(([id, info]) => ({ id, nickname: info.nickname }));
      console.log(`[phaseChange] roomId=${roomId}, players:`, Object.keys(room.players), 'playerList:', playerList);
      
      const playerCount = Object.keys(room.players).length;
      
      // --- Generate door quotas ---
      const DOOR_COUNT = 10;
      const totalQuotaSum = playerCount > 0 ? Math.max(1, playerCount - 2) : 0;
      const quotas = new Array(DOOR_COUNT).fill(0);

      for (let i = 0; i < totalQuotaSum; i++) {
          const doorIndex = Math.floor(Math.random() * DOOR_COUNT);
          quotas[doorIndex]++;
      }
      
      room.doorQuotas = quotas;
      // --- End of quota generation ---

      // --- Rotation Sync Properties ---
      // 타이머 관련 값들은 이제 'gameStart' 이벤트에서 설정되므로 여기서 제거.
      room.doorRotation = 0;
      room.rotationSpeed = 0.5; // Initial speed
      room.rotationDirection = 1; // Initial direction
      room.isGame2Finished = false;
      room.readyPlayers.clear(); // Use clear() for Sets

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

  socket.on('clientReady', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || !room.players[socket.id]) return;

    room.readyPlayers.add(socket.id);

    const playerCount = Object.keys(room.players).length;
    if (playerCount > 0 && room.readyPlayers.size === playerCount) {
        // All players are ready, start the game for this room.
        io.to(roomId).emit('gameStart');

        // Start server-side timers for Game 2
        if (room.gameType === 'pair') {
            const now = Date.now();
            room.pairGameStartTime = now + 3000;
            room.gameEndTime = room.pairGameStartTime + 20000;
            room.nextRotationChangeTime = room.pairGameStartTime;
            room.lastUpdateTime = room.pairGameStartTime;
        }
    }
  });

  // 방 내부 채팅(roomIndex별)
  socket.on('roomChat', ({ roomId, roomIndex, nickname, message, time }) => {
    const room = rooms[roomId];
    if (!room) return;
    Object.entries(room.players).forEach(([id, player]) => {
      if (player.roomIndex === roomIndex) {
        io.to(id).emit('roomChat', { nickname, message, time });
      }
    });
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
      const now = Date.now();

      // Check for game end condition first
      if (!room.isGame2Finished && room.gameEndTime && now >= room.gameEndTime) {
          room.isGame2Finished = true; // Mark as finished

          const successfulRooms = new Set();
          const playersByRoom = {};

          // Group players by room index
          Object.values(room.players).forEach(p => {
              if (p.roomIndex !== null) {
                  if (!playersByRoom[p.roomIndex]) playersByRoom[p.roomIndex] = [];
                  playersByRoom[p.roomIndex].push(p);
              }
          });

          // Determine which rooms were successful
          room.doorQuotas.forEach((quota, index) => {
              const playersInRoom = playersByRoom[index] ? playersByRoom[index].length : 0;
              if (playersInRoom > 0 && playersInRoom === quota) {
                  successfulRooms.add(index);
              }
          });

          // Build the list of survivor details ONCE.
          const survivorDetails = Object.entries(room.players)
              .filter(([id, player]) => successfulRooms.has(player.roomIndex))
              .map(([id, player]) => ({ id, nickname: player.nickname, character: player.character }));

          // Emit results to all players
          Object.entries(room.players).forEach(([id, player]) => {
              const isSurvivor = successfulRooms.has(player.roomIndex);
              io.to(id).emit('game2End', {
                  result: isSurvivor ? 'survived' : 'died',
                  survivors: survivorDetails,
              });
          });
          return; // Stop further processing for this finished room
      }

      // Only start logic after waiting period
      if (room.pairGameStartTime && now >= room.pairGameStartTime) {
          // Check if it's time to change rotation variables
          if (now >= room.nextRotationChangeTime) {
              const baseSpeed = 0.5;
              room.rotationSpeed = baseSpeed * (0.5 + Math.random() * 1.5); // 0.25 to 1.0
              room.rotationDirection = Math.random() < 0.5 ? 1 : -1;
              
              const randomInterval = Math.random() * 5000 + 5000; // 5-10 seconds
              room.nextRotationChangeTime = now + randomInterval;
          }

          // Update rotation based on current speed and direction
          const delta = now - room.lastUpdateTime;
          room.doorRotation += room.rotationSpeed * room.rotationDirection * (delta / 1000);
          room.lastUpdateTime = now;
      }
      
      const remainingTime = room.gameEndTime ? Math.max(0, (room.gameEndTime - now) / 1000) : 0;

      // 게임2용 실시간 동기화
      io.to(roomId).emit('game2State', { 
        players: room.players, 
        doorQuotas: room.doorQuotas,
        doorRotation: room.doorRotation || 0,
        remainingTime
      });
    }
  });
}, 1000/60);

server.listen(process.env.PORT || 3001); 