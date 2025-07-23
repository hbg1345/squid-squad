import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import Phaser from 'phaser';
import { useLocation } from 'react-router-dom';
import { getSocket } from '../socket';
import ChatBox from './ChatBox';
import GameDescriptionModal from './GameDescriptionModal';
import useAudio from '../hooks/useAudio';
import RoomChatBox from './RoomChatBox';

const PLAYER_RADIUS = 16;
const PLAYER_MOVE_SPEED = 216;
const CIRCLE_RADIUS = 200;
const DOOR_COUNT = 10;
const DOOR_WIDTH = 32;
const DOOR_HEIGHT = 48;
const DOOR_RADIUS = CIRCLE_RADIUS + 150;
const ROTATION_SPEED = 0.5; // radians per second
const DOOR_INTERACT_DIST = 40;

type PlayerState = {
  x: number;
  y: number;
  nickname: string;
  roomIndex: number | null;
  character?: string;
};

type RoomScreenProps = {
  onExit: () => void;
  myId: string | null;
  roomId: string;
  allPlayers: { [id: string]: PlayerState };
  roomIndex: number;
  isChattingRef: React.RefObject<boolean>;
  doorQuotas: number[];
};

const RoomScreen = forwardRef<any, RoomScreenProps>(({ onExit, myId, roomId, allPlayers, roomIndex, isChattingRef, doorQuotas }, ref) => {
  console.log('[RoomScreen] 렌더링됨, doorQuotas:', doorQuotas, 'roomIndex:', roomIndex);
  const phaserRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const allPlayersRef = useRef(allPlayers);
  allPlayersRef.current = allPlayers;

  useEffect(() => {
    const socket = getSocket();
    class RoomScene extends Phaser.Scene {
      playerSprites: { [id: string]: Phaser.GameObjects.Sprite } = {};
      nameTexts: { [id: string]: Phaser.GameObjects.Text } = {};
      cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
      interactKey!: Phaser.Input.Keyboard.Key;
      graphics!: Phaser.GameObjects.Graphics;
      pushKey!: Phaser.Input.Keyboard.Key;
      portalImg!: Phaser.GameObjects.Image;
      particle1!: Phaser.GameObjects.Image;
      particle2!: Phaser.GameObjects.Image;
      particle3!: Phaser.GameObjects.Image;
      quotaText!: Phaser.GameObjects.Text;

      preload() {
        this.load.image('player', '/player.png');
        this.load.image('player2', '/player2.png');
        this.load.image('player3', '/player3.png');
        this.load.image('player4', '/player4.png');
        this.load.image('player5', '/player5.png');
        this.load.image('background2', '/background2.png');
        this.load.image('roomBg', '/room.png');
        this.load.image('portal', '/Portal.png');
        this.load.image('particle1', '/Particle Effect 1.png');
        this.load.image('particle2', '/Particle Effect 2.png');
        this.load.image('particle3', '/Particle Effect 3.png');
      }

      create() {
        console.log('[RoomScene] create 호출됨');
        // Add room background image, stretched to fill
        this.add.image(this.cameras.main.width / 2, this.cameras.main.height / 2, 'roomBg')
          .setOrigin(0.5)
          .setDisplaySize(this.cameras.main.width, this.cameras.main.height)
          .setDepth(-100);
        this.cameras.main.setBackgroundColor('#333333');
        this.cursors = this.input.keyboard!.createCursorKeys();
        this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
        this.graphics = this.add.graphics();
        this.pushKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        const socket = getSocket();
        socket.on('playerPushed', ({ id, x, y }) => {
          const sprite = this.playerSprites[id];
          if (sprite) {
            sprite.x = x;
            sprite.y = y;
          }
        });
        
        this.add.text(this.cameras.main.width / 2, 50, `Room ${roomIndex + 1}`, { fontSize: '32px', color: '#111' }).setOrigin(0.5);
        this.add.text(this.cameras.main.width / 2, this.cameras.main.height - 50, `Press 'E' near the door to exit`, { fontSize: '24px' }).setOrigin(0.5);

        // --- 포탈 이미지 및 파티클 추가 ---
        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;
        this.portalImg = this.add.image(centerX, centerY, 'portal').setOrigin(0.5).setScale(2);
        this.particle1 = this.add.image(centerX, centerY, 'particle1').setOrigin(0.5).setScale(2.1);
        this.particle2 = this.add.image(centerX, centerY, 'particle2').setOrigin(0.5).setScale(2.1);
        this.particle3 = this.add.image(centerX, centerY, 'particle3').setOrigin(0.5).setScale(2.1);
        this.quotaText = this.add.text(centerX, centerY - 70, '', { fontSize: '18px', color: '#fff', align: 'center' }).setOrigin(0.5);
      }
      
      update(time: number, delta: number) {
        console.log('[RoomScene] update 호출됨');
        const dt = delta / 1000;
        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;
        const myRoomPlayer = allPlayersRef.current[myId!];
        
        // Push logic
        if (this.pushKey && Phaser.Input.Keyboard.JustDown(this.pushKey) && myRoomPlayer && myRoomPlayer.roomIndex === roomIndex) {
          let collisionDetected = false;
          Object.entries(allPlayersRef.current).forEach(([id, info]) => {
            if (id === myId) return;
            if (info.roomIndex !== roomIndex) return;
            const mySprite = this.playerSprites[myId!];
            const otherSprite = this.playerSprites[id];
            if (!mySprite || !otherSprite) return;
            const dist = Phaser.Math.Distance.Between(mySprite.x, mySprite.y, otherSprite.x, otherSprite.y);
            const myRadius = mySprite.displayWidth * 0.5;
            const otherRadius = otherSprite.displayWidth * 0.5;
            const requiredDist = myRadius + otherRadius + 30;
            if (dist <= requiredDist) {
              collisionDetected = true;
              const dirs = [
                { dx: 0, dy: -1 },
                { dx: 0, dy: 1 },
                { dx: -1, dy: 0 },
                { dx: 1, dy: 0 },
              ];
              const dir = Phaser.Math.RND.pick(dirs);
              getSocket().emit('playerPush', { id, dx: dir.dx, dy: dir.dy });
            }
          });
        }

        // Input handling
        if (myRoomPlayer && myRoomPlayer.roomIndex === roomIndex) {
          // Exit interaction
          if (Phaser.Input.Keyboard.JustDown(this.interactKey) && !isChattingRef.current) {
            const dist = Phaser.Math.Distance.Between(myRoomPlayer.x, myRoomPlayer.y, 0, 0); // Door is at center
            if (dist < DOOR_INTERACT_DIST) {
              onExit();
              return; // Exit to avoid movement on the same frame
            }
          }

          // Movement
          if (!isChattingRef.current) {
            let dx = 0, dy = 0;
            if (this.cursors.left.isDown) dx -= 1;
            if (this.cursors.right.isDown) dx += 1;
            if (this.cursors.up.isDown) dy -= 1;
            if (this.cursors.down.isDown) dy += 1;

            if (dx !== 0 || dy !== 0) {
              const len = Math.sqrt(dx * dx + dy * dy);
              const newX = myRoomPlayer.x + (dx/len) * PLAYER_MOVE_SPEED * dt;
              const newY = myRoomPlayer.y + (dy/len) * PLAYER_MOVE_SPEED * dt;
              getSocket().emit('game2Input', { roomId, input: { x: newX, y: newY } });
            }
          }
        }
        
        // Rendering
        this.graphics.clear();
        // --- 포탈 파티클 반짝임 애니메이션 ---
        if (this.particle1 && this.particle2 && this.particle3) {
          const t = time / 1000;
          this.particle1.setAlpha(0.5 + 0.5 * Math.sin(t * 2));
          this.particle2.setAlpha(0.5 + 0.5 * Math.sin(t * 2.5 + 1));
          this.particle3.setAlpha(0.5 + 0.5 * Math.sin(t * 3 + 2));
        }
        // --- 인원/쿼터 텍스트 ---
        const roomPlayers = Object.entries(allPlayersRef.current).filter(([_, p]) => p.roomIndex === roomIndex);
        const requiredQuota = doorQuotas[roomIndex] ?? '?';
        const text = `${roomPlayers.length}/${requiredQuota}`;
        if (this.quotaText) {
          this.quotaText.setText(text);
        }

        roomPlayers.forEach(([id, info]) => {
          if (!this.playerSprites[id]) {
            let spriteKey = (info.character || 'player').replace('.png', '');
            this.playerSprites[id] = this.add.sprite(0, 0, spriteKey).setScale(0.5).setOrigin(0.5);
            this.nameTexts[id] = this.add.text(0, 0, info.nickname, { fontSize: '16px', color: '#fff' }).setOrigin(0.5);
          }
          this.playerSprites[id].setPosition(centerX + info.x, centerY + info.y);
          this.nameTexts[id].setPosition(centerX + info.x, centerY + info.y - 40);
        });

        Object.keys(this.playerSprites).forEach(id => {
          if (!roomPlayers.some(([pId]) => pId === id)) {
            this.playerSprites[id].destroy();
            this.nameTexts[id].destroy();
            delete this.playerSprites[id];
            delete this.nameTexts[id];
          }
        });
      }
    }
    const config = {
      type: Phaser.AUTO,
      width: window.innerWidth,
      height: window.innerHeight,
      parent: phaserRef.current!,
      scene: RoomScene
    };
    gameRef.current = new Phaser.Game(config);
    return () => gameRef.current?.destroy(true);
  }, [roomIndex, onExit, myId, roomId, isChattingRef]);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <div ref={phaserRef} />
    </div>
  );
});


const GameScreen = () => {
  const location = useLocation();
  const { roomId, playerNickname } = location.state || {};
  const [allPlayers, setAllPlayers] = useState<{ [id: string]: PlayerState }>({});
  const allPlayersRef = useRef(allPlayers);
  const { play, pause } = useAudio('/pairSong.mp3');

  useEffect(() => {
    play();
    return () => {
      pause();
    };
  }, [play, pause]);

  useEffect(() => {
    allPlayersRef.current = allPlayers;
  }, [allPlayers]);
  const myIdRef = useRef<string | null>(null);

  const [isDescribing, setIsDescribing] = useState(true);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [phase, setPhase] = useState('waiting');
  const [timer, setTimer] = useState(3);
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  
  const [mainTimer, setMainTimer] = useState(20);
  const [gameResult, setGameResult] = useState<'survived' | 'died' | null>(null);
  const [survivors, setSurvivors] = useState<{ id: string, nickname: string, character?: string }[]>([]);
  const [isChatting, setIsChatting] = useState(false);
  const isChattingRef = useRef(isChatting);
  useEffect(() => {
    isChattingRef.current = isChatting;
  }, [isChatting]);

  const [doorQuotas, setDoorQuotas] = useState<number[]>([]);
  const doorQuotasRef = useRef(doorQuotas);
  useEffect(() => {
    doorQuotasRef.current = doorQuotas;
  }, [doorQuotas]);

  const [doorRotation, setDoorRotation] = useState(0);
  const doorRotationRef = useRef(doorRotation);
  useEffect(() => {
    doorRotationRef.current = doorRotation;
  }, [doorRotation]);

  const [roomIndex, setRoomIndex] = useState<number | null>(null);

  const handleEnterRoom = useCallback((index: number) => {
    const socket = getSocket();
    socket.emit('enterRoom', { roomId, roomIndex: index });
    setRoomIndex(index);
  }, [roomId]);

  const handleExitRoom = useCallback(() => {
    const socket = getSocket();
    socket.emit('exitRoom', { roomId });
    setRoomIndex(null);
  }, [roomId]);
  
  const phaserRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    if (!myIdRef.current && socket.id) myIdRef.current = socket.id;

    const onGame2State = (data: { players: { [id: string]: PlayerState }, doorQuotas?: number[], doorRotation?: number, remainingTime?: number }) => {
      setAllPlayers(data.players);
      if (data.doorQuotas) {
        setDoorQuotas(data.doorQuotas);
      }
      if (data.doorRotation !== undefined) {
        setDoorRotation(data.doorRotation);
      }
      if (data.remainingTime !== undefined) {
        setMainTimer(data.remainingTime);
      }
      const myState = data.players[myIdRef.current!];
      if (myState && myState.roomIndex !== roomIndex) {
        setRoomIndex(myState.roomIndex);
      }
    };
    const onGameEnd = ({ result, survivors: newSurvivors }: { result: 'survived' | 'died', survivors: { id: string, nickname: string }[] }) => {
      setGameResult(result);
      setSurvivors(newSurvivors || []);
      if (result === 'died') {
        getSocket().disconnect();
        window.location.href = '/';
      }
    };

    socket.on('game2State', onGame2State);
    socket.on('game2End', onGameEnd);
    return () => {
      socket.off('game2State', onGame2State);
      socket.off('game2End', onGameEnd);
    };
  }, [roomId, roomIndex]);

  // 모달 표시 및 준비 완료 신호 전송
  useEffect(() => {
    const timer = setTimeout(() => {
        setIsDescribing(false);
        if (roomId) {
            getSocket().emit('clientReady', { roomId });
        }
    }, 5000);
    return () => clearTimeout(timer);
  }, [roomId]);

  // 게임 시작 신호 수신
  useEffect(() => {
      const onGameStart = () => setIsGameStarted(true);
      const socket = getSocket();
      socket.on('gameStart', onGameStart);
      return () => {
          socket.off('gameStart', onGameStart);
      };
  }, []);

  useEffect(() => {
    if (phase === 'waiting' && isGameStarted) {
      const countdown = setTimeout(() => setPhase('playing'), 3000);
      const timerInterval = setInterval(() => setTimer(t => Math.max(0, t - 1)), 1000);
      return () => {
        clearTimeout(countdown);
        clearInterval(timerInterval);
      };
    }
  }, [phase, isGameStarted]);
  
  const enterRoomRef = useRef(handleEnterRoom);
  useEffect(() => { enterRoomRef.current = handleEnterRoom; }, [handleEnterRoom]);

  useEffect(() => {
    if (roomIndex !== null) {
      if(gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
      return;
    }
    if (!phaserRef.current || gameRef.current) return;

    let playerSprites: { [id: string]: Phaser.GameObjects.Sprite } = {};
    let nameTexts: { [id: string]: Phaser.GameObjects.Text } = {};

    class PairScene extends Phaser.Scene {
      cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
      graphics!: Phaser.GameObjects.Graphics;
      doorPositions: { x: number; y: number; angle: number }[] = [];
      interactKey!: Phaser.Input.Keyboard.Key;
      quotaTexts: Phaser.GameObjects.Text[] = [];
      isChattingRef!: React.RefObject<boolean>;
      pushKey!: Phaser.Input.Keyboard.Key;
      portalImgs: (Phaser.GameObjects.Image | null)[] = [];
      portalParticles: ([Phaser.GameObjects.Image, Phaser.GameObjects.Image, Phaser.GameObjects.Image] | null)[] = [];
      portalBurstTimers: number[] = [];
      prevPlayersInRoom: number[] = [];

      preload() {
        this.load.image('player', '/player.png');
        this.load.image('player2', '/player2.png');
        this.load.image('player3', '/player3.png');
        this.load.image('player4', '/player4.png');
        this.load.image('player5', '/player5.png');
        this.load.image('portal', '/Portal.png');
        this.load.image('particle1', '/Particle Effect 1.png');
        this.load.image('particle2', '/Particle Effect 2.png');
        this.load.image('particle3', '/Particle Effect 3.png');
        this.load.image('background2', '/background2.png');
      }

      init(data: { isChattingRef: React.RefObject<boolean> }) {
        this.isChattingRef = data.isChattingRef;
      }

      create() {
        console.log('[PairScene] create 호출됨');
        // Add background2 image, stretched to fill
        this.add.image(this.cameras.main.width / 2, this.cameras.main.height / 2, 'background2')
          .setOrigin(0.5)
          .setDisplaySize(this.cameras.main.width, this.cameras.main.height)
          .setDepth(-100);
        this.cameras.main.setBackgroundColor('#333333');
        this.cursors = this.input.keyboard!.createCursorKeys();
        this.graphics = this.add.graphics();
        this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
        this.pushKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        const socket = getSocket();
        socket.on('playerPushed', ({ id, x, y }) => {
          const sprite = playerSprites[id];
          if (sprite) {
            sprite.x = x;
            sprite.y = y;
          }
        });
        for (let i = 0; i < DOOR_COUNT; i++) {
          const angle = (i / DOOR_COUNT) * Math.PI * 2;
          this.doorPositions.push({ x: 0, y: 0, angle });
          this.quotaTexts.push(
            this.add.text(0, 0, '', { fontSize: '18px', color: '#fff', align: 'center' }).setOrigin(0.5)
          );
        }
      }

      update(time: number, delta: number) {
        console.log('[PairScene] update 호출됨');
        const dt = delta / 1000;
        const mainCam = this.cameras.main;
        const centerX = mainCam.width / 2;
        const centerY = mainCam.height / 2;
        const myPlayer = allPlayersRef.current[myIdRef.current!];
        // Push logic
        if (this.pushKey && Phaser.Input.Keyboard.JustDown(this.pushKey) && myPlayer && myPlayer.roomIndex === null) {
          let collisionDetected = false;
          Object.entries(allPlayersRef.current).forEach(([id, info]) => {
            if (id === myIdRef.current) return;
            if (info.roomIndex !== null) return;
            const mySprite = playerSprites[myIdRef.current!];
            const otherSprite = playerSprites[id];
            if (!mySprite || !otherSprite) return;
            const dist = Phaser.Math.Distance.Between(mySprite.x, mySprite.y, otherSprite.x, otherSprite.y);
            const myRadius = mySprite.displayWidth * 0.5;
            const otherRadius = otherSprite.displayWidth * 0.5;
            const requiredDist = myRadius + otherRadius + 30;
            if (dist <= requiredDist) {
              collisionDetected = true;
              const dirs = [
                { dx: 0, dy: -1 },
                { dx: 0, dy: 1 },
                { dx: -1, dy: 0 },
                { dx: 1, dy: 0 },
              ];
              const dir = Phaser.Math.RND.pick(dirs);
              getSocket().emit('playerPush', { id, dx: dir.dx, dy: dir.dy });
            }
          });
        }
        
        if (myPlayer && myPlayer.roomIndex === null) {
          if (!this.isChattingRef.current) {
              let dx = 0, dy = 0;
              if (this.cursors.left.isDown) dx -= 1;
              if (this.cursors.right.isDown) dx += 1;
              if (this.cursors.up.isDown) dy -= 1;
              if (this.cursors.down.isDown) dy += 1;

              if (dx !== 0 || dy !== 0) {
                const len = Math.sqrt(dx * dx + dy * dy);
                let newX = myPlayer.x + (dx / len) * PLAYER_MOVE_SPEED * dt;
                let newY = myPlayer.y + (dy / len) * PLAYER_MOVE_SPEED * dt;

                if (phaseRef.current === 'waiting') {
                  const dist = Math.sqrt(newX * newX + newY * newY);
                  const radiusLimit = CIRCLE_RADIUS - PLAYER_RADIUS;
                  if (dist > radiusLimit) {
                    const angle = Math.atan2(newY, newX);
                    newX = Math.cos(angle) * radiusLimit;
                    newY = Math.sin(angle) * radiusLimit;
                  }
                }
                getSocket().emit('game2Input', { roomId, input: { x: newX, y: newY } });
              }
          }
          
          if (Phaser.Input.Keyboard.JustDown(this.interactKey) && !this.isChattingRef.current) {
            this.doorPositions.forEach((pos, index) => {
              const requiredQuota = doorQuotasRef.current[index] ?? 0;
              if (requiredQuota > 0) {
                const currentAngle = pos.angle + doorRotationRef.current;
                const doorX = Math.cos(currentAngle) * DOOR_RADIUS;
                const doorY = Math.sin(currentAngle) * DOOR_RADIUS;
                const dist = Phaser.Math.Distance.Between(myPlayer.x, myPlayer.y, doorX, doorY);
                if (dist < DOOR_INTERACT_DIST) {
                  enterRoomRef.current(index);
                }
              }
            });
          }
        }
        
        this.graphics.clear();
        this.doorPositions.forEach((pos, index) => {
          const requiredQuota = doorQuotasRef.current[index] ?? 0;
          // Track previous player count for burst effect
          if (!this.prevPlayersInRoom) this.prevPlayersInRoom = [];
          const currentPlayersInRoom = Object.values(allPlayersRef.current).filter(p => p.roomIndex === index).length;
          if (this.prevPlayersInRoom[index] === undefined) this.prevPlayersInRoom[index] = currentPlayersInRoom;
          if (currentPlayersInRoom > this.prevPlayersInRoom[index]) {
            // Player entered: start burst
            this.portalBurstTimers[index] = time + 500; // 0.5s burst
          }
          this.prevPlayersInRoom[index] = currentPlayersInRoom;
          if (requiredQuota > 0) {
            const currentAngle = pos.angle + doorRotationRef.current;
            const x = Math.cos(currentAngle) * DOOR_RADIUS;
            const y = Math.sin(currentAngle) * DOOR_RADIUS;
            // Draw portal image
            if (!this.portalImgs[index]) {
              this.portalImgs[index] = this.add.image(centerX + x, centerY + y, 'portal').setOrigin(0.5).setScale(2);
              // Add 3 particle images, overlayed
              const p1 = this.add.image(centerX + x, centerY + y, 'particle1').setOrigin(0.5).setScale(2.1);
              const p2 = this.add.image(centerX + x, centerY + y, 'particle2').setOrigin(0.5).setScale(2.1);
              const p3 = this.add.image(centerX + x, centerY + y, 'particle3').setOrigin(0.5).setScale(2.1);
              this.portalParticles[index] = [p1, p2, p3];
            } else {
              this.portalImgs[index]!.setPosition(centerX + x, centerY + y);
              this.portalImgs[index]!.setVisible(true);
              if (this.portalParticles[index]) {
                this.portalParticles[index]![0].setPosition(centerX + x, centerY + y).setVisible(true);
                this.portalParticles[index]![1].setPosition(centerX + x, centerY + y).setVisible(true);
                this.portalParticles[index]![2].setPosition(centerX + x, centerY + y).setVisible(true);
              }
            }
            // Animate particle alpha for sparkling effect or burst
            if (this.portalParticles[index]) {
              if (this.portalBurstTimers[index] && time < this.portalBurstTimers[index]) {
                // Burst: rapidly alternate visibility
                const burstFrame = Math.floor((this.portalBurstTimers[index] - time) / 80) % 3;
                for (let i = 0; i < 3; ++i) {
                  this.portalParticles[index]![i].setAlpha(i === burstFrame ? 1 : 0);
                }
              } else {
                const t = time / 1000;
                this.portalParticles[index]![0].setAlpha(0.5 + 0.5 * Math.sin(t * 2 + index));
                this.portalParticles[index]![1].setAlpha(0.5 + 0.5 * Math.sin(t * 2.5 + index + 1));
                this.portalParticles[index]![2].setAlpha(0.5 + 0.5 * Math.sin(t * 3 + index + 2));
                this.portalBurstTimers[index] = 0;
              }
            }
            // Quota text
            const text = `${currentPlayersInRoom}/${requiredQuota}`;
            this.quotaTexts[index].setText(text).setPosition(centerX + x, centerY + y - 70).setVisible(true);
          } else {
            this.quotaTexts[index].setVisible(false);
            if (this.portalImgs[index]) { this.portalImgs[index]!.setVisible(false); }
            if (this.portalParticles[index]) {
              this.portalParticles[index]![0].setVisible(false);
              this.portalParticles[index]![1].setVisible(false);
              this.portalParticles[index]![2].setVisible(false);
            }
            this.portalBurstTimers[index] = 0;
            if (this.prevPlayersInRoom) this.prevPlayersInRoom[index] = 0;
          }
        });

        if (phaseRef.current === 'waiting') {
          this.graphics.lineStyle(6, 0xffffff, 1);
          this.graphics.strokeCircle(centerX, centerY, CIRCLE_RADIUS);
        }
        
        const mainPlayers = Object.entries(allPlayersRef.current).filter(([_,p]) => p.roomIndex === null);

        mainPlayers.forEach(([id, info]) => {
          if (!playerSprites[id]) {
            let spriteKey = (info.character || 'player').replace('.png', '');
            playerSprites[id] = this.add.sprite(0, 0, spriteKey).setScale(0.5).setOrigin(0.5);
            nameTexts[id] = this.add.text(0, 0, info.nickname, { fontSize: '16px', color: '#fff' }).setOrigin(0.5);
          }
          playerSprites[id].setPosition(centerX + info.x, centerY + info.y);
          nameTexts[id].setPosition(centerX + info.x, centerY + info.y - 40);
        });

        Object.keys(playerSprites).forEach(id => {
          if (!mainPlayers.some(([pId]) => pId === id)) {
            playerSprites[id].destroy();
            nameTexts[id].destroy();
            delete playerSprites[id];
            delete nameTexts[id];
          }
        });
      }
    }

    const config = { 
        type: Phaser.AUTO, 
        width: window.innerWidth, 
        height: window.innerHeight, 
        parent: phaserRef.current!, 
        backgroundColor: '#000', 
        scene: PairScene,
        callbacks: {
            postBoot: function (game: Phaser.Game) {
                const scene = game.scene.scenes[0] as PairScene;
                scene.init({ isChattingRef });
            }
        }
    };
    gameRef.current = new Phaser.Game(config);

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [roomIndex, isChattingRef]);

  useEffect(() => {
    if (gameRef.current && gameRef.current.input && gameRef.current.input.keyboard) {
        gameRef.current.input.keyboard.enabled = !isChatting;
    }
  }, [isChatting]);

  if (gameResult) {
    return (
      <div style={{
        width: '100vw', height: '100vh', background: '#1a1a1a', color: '#fff',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        boxSizing: 'border-box', padding: '50px'
      }}>
        <h1 style={{ fontSize: '48px', marginBottom: '40px', color: gameResult === 'survived' ? '#ff2a7f' : '#249f9c' }}>
          {gameResult === 'survived' ? '생존' : '사망'}
        </h1>
        {survivors.length > 0 && (
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '28px', marginBottom: '20px', borderBottom: '2px solid #555', paddingBottom: '10px' }}>
              생존자 목록
            </h2>
            <div style={{
              display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '40px', marginTop: 32
            }}>
              {survivors.map((survivor, idx) => (
                <div key={survivor.id} style={{
                  width: 100, height: 100,
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  position: 'relative'
                }}>
                  {/* 마름모꼴 타일 */}
                  <div style={{
                    width: 70, height: 70,
                    background: 'linear-gradient(135deg, #ffe0f0 60%, #ffb6e6 100%)',
                    transform: 'rotate(45deg)',
                    position: 'absolute', top: 15, left: 15, zIndex: 1
                  }} />
                  {/* 캐릭터 이미지 */}
                  <img
                    src={`/${(survivor.character || 'player.png').replace('.png', '')}.png`}
                    alt={survivor.nickname}
                    style={{
                      width: 60, height: 60,
                      objectFit: 'contain',
                      position: 'relative', zIndex: 2, marginTop: 20
                    }}
                  />
                  {/* 닉네임 */}
                  <div style={{
                    marginTop: 10, fontSize: 18, color: '#fff', fontWeight: 'bold', zIndex: 3
                  }}>
                    {survivor.nickname}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <button
          onClick={() => {
            getSocket().disconnect();
            window.location.href = '/';
          }}
          style={{
            marginTop: '50px',
            padding: '15px 35px',
            fontSize: '20px',
            cursor: 'pointer',
            backgroundColor: '#ff2a7f',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 'bold',
          }}
        >
          타이틀로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', cursor: 'default' }}>
       <GameDescriptionModal
        isOpen={isDescribing}
        title="단짝을 찾아라"
        description={[
            "20초 안에, 문 위에 표시된 숫자만큼 인원을 맞춰 들어가세요.",
            "성공한 방의 플레이어만 생존합니다.",
        ]}
      />
       {!isDescribing && !isGameStarted && (
            <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'white', fontSize: '24px', zIndex: 4000, pointerEvents: 'none' }}>
                다른 플레이어를 기다리는 중...
            </div>
      )}
      {/* Timer */}
      {(phase === 'waiting' || phase === 'playing') && isGameStarted && (
        <div style={{
            position: 'fixed',
            top: roomIndex !== null ? 70 : 32,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: phase === 'waiting' && timer > 0 ? 100 : 48,
            color: roomIndex !== null ? '#111' : '#fff',
            fontWeight: 'bold',
            zIndex: 1000,
            transition: 'font-size 0.3s ease-out'
        }}>
            {phase === 'waiting' && timer > 0 ? timer : mainTimer.toFixed(2)}
        </div>
      )}
      
      {/* ChatBox */}
      {roomId && (
        <ChatBox 
          roomId={roomId} 
          playerNickname={playerNickname || '익명'}
          roomIndex={roomIndex}
          onFocus={() => setIsChatting(true)}
          onBlur={() => setIsChatting(false)}
        />
      )}

      {/* Game Canvas */}
      {roomIndex === null ? 
        <div ref={phaserRef} /> : 
        <RoomScreen 
          roomIndex={roomIndex} 
          onExit={handleExitRoom} 
          myId={myIdRef.current} 
          roomId={roomId}
          allPlayers={allPlayers}
          isChattingRef={isChattingRef}
          doorQuotas={doorQuotas}
        />
      }
    </div>
  );
};

export default GameScreen; 