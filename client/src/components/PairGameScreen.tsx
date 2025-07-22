import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import Phaser from 'phaser';
import { useLocation } from 'react-router-dom';
import { getSocket } from '../socket';

const PLAYER_RADIUS = 16;
const PLAYER_MOVE_SPEED = 180;
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
};

const RoomScreen = forwardRef(({ onExit, myId, roomId, allPlayers, roomIndex }: { 
  onExit: () => void, 
  myId: string | null, 
  roomId: string,
  allPlayers: { [id: string]: PlayerState },
  roomIndex: number
}, ref) => {
  const phaserRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const allPlayersRef = useRef(allPlayers);
  allPlayersRef.current = allPlayers;

  useEffect(() => {
    const socket = getSocket();
    class RoomScene extends Phaser.Scene {
      playerSprites: { [id: string]: Phaser.GameObjects.Arc } = {};
      nameTexts: { [id: string]: Phaser.GameObjects.Text } = {};
      cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
      interactKey!: Phaser.Input.Keyboard.Key;
      graphics!: Phaser.GameObjects.Graphics;

      create() {
        this.cameras.main.setBackgroundColor('#333333');
        this.cursors = this.input.keyboard!.createCursorKeys();
        this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
        this.graphics = this.add.graphics();
        
        this.add.text(this.cameras.main.width / 2, 50, `Room ${roomIndex + 1}`, { fontSize: '32px' }).setOrigin(0.5);
        this.add.text(this.cameras.main.width / 2, this.cameras.main.height - 50, `Press 'E' near the door to exit`, { fontSize: '24px' }).setOrigin(0.5);
      }
      
      update(time: number, delta: number) {
        const dt = delta / 1000;
        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;
        
        const myRoomPlayer = allPlayersRef.current[myId!];
        
        // Input handling
        if (myRoomPlayer && myRoomPlayer.roomIndex === roomIndex) {
          // Exit interaction
          if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
            const dist = Phaser.Math.Distance.Between(myRoomPlayer.x, myRoomPlayer.y, 0, 0); // Door is at center
            if (dist < DOOR_INTERACT_DIST) {
              onExit();
              return; // Exit to avoid movement on the same frame
            }
          }

          // Movement
          let dx = 0, dy = 0;
          if (this.cursors.left.isDown) dx -= 1;
          if (this.cursors.right.isDown) dx += 1;
          if (this.cursors.up.isDown) dy -= 1;
          if (this.cursors.down.isDown) dy += 1;

          if (dx !== 0 || dy !== 0) {
            const len = Math.sqrt(dx * dx + dy * dy);
            const newX = myRoomPlayer.x + (dx/len) * PLAYER_MOVE_SPEED * dt;
            const newY = myRoomPlayer.y + (dy/len) * PLAYER_MOVE_SPEED * dt;
            socket.emit('game2Input', { roomId, input: { x: newX, y: newY } });
          }
        }
        
        // Rendering
        this.graphics.clear();
        
        // Draw center door
        this.graphics.fillStyle(0x0000ff, 1);
        this.graphics.fillRect(centerX - DOOR_WIDTH / 2, centerY - DOOR_HEIGHT / 2, DOOR_WIDTH, DOOR_HEIGHT);

        const roomPlayers = Object.entries(allPlayersRef.current).filter(([_, p]) => p.roomIndex === roomIndex);

        roomPlayers.forEach(([id, info]) => {
          if (!this.playerSprites[id]) {
            this.playerSprites[id] = this.add.circle(0, 0, PLAYER_RADIUS, id === myId ? 0xff2a7f : 0x00bfff);
            this.nameTexts[id] = this.add.text(0, 0, info.nickname, { fontSize: '16px', color: '#fff' }).setOrigin(0.5);
          }
          this.playerSprites[id].setPosition(centerX + info.x, centerY + info.y);
          this.nameTexts[id].setPosition(centerX + info.x, centerY + info.y - PLAYER_RADIUS - 10);
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
  }, [roomIndex, onExit, myId, roomId]);

  return <div ref={phaserRef} />;
});


const GameScreen = () => {
  const location = useLocation();
  const { roomId } = location.state || {};
  const [allPlayers, setAllPlayers] = useState<{ [id: string]: PlayerState }>({});
  const allPlayersRef = useRef(allPlayers);
  useEffect(() => {
    allPlayersRef.current = allPlayers;
  }, [allPlayers]);
  const myIdRef = useRef<string | null>(null);

  const [phase, setPhase] = useState('waiting');
  const [timer, setTimer] = useState(3);
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  
  const [mainTimer, setMainTimer] = useState(20);
  const [gameResult, setGameResult] = useState<'survived' | 'died' | null>(null);

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
    const onGameEnd = ({ result }: { result: 'survived' | 'died' }) => {
      setGameResult(result);
      if (result === 'died') {
        setTimeout(() => {
          getSocket().disconnect();
          window.location.href = '/';
        }, 1500);
      }
    };

    socket.on('game2State', onGame2State);
    socket.on('game2End', onGameEnd);
    return () => {
      socket.off('game2State', onGame2State);
      socket.off('game2End', onGameEnd);
    };
  }, [roomId, roomIndex]);

  useEffect(() => {
    if (phase === 'waiting') {
      const countdown = setTimeout(() => setPhase('playing'), 3000);
      const timerInterval = setInterval(() => setTimer(t => Math.max(0, t - 1)), 1000);
      return () => {
        clearTimeout(countdown);
        clearInterval(timerInterval);
      };
    }
  }, [phase]);
  
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

    let playerSprites: { [id: string]: Phaser.GameObjects.Arc } = {};
    let nameTexts: { [id: string]: Phaser.GameObjects.Text } = {};

    class PairScene extends Phaser.Scene {
      cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
      graphics!: Phaser.GameObjects.Graphics;
      doorPositions: { x: number; y: number; angle: number }[] = [];
      interactKey!: Phaser.Input.Keyboard.Key;
      quotaTexts: Phaser.GameObjects.Text[] = [];

      create() {
        this.cursors = this.input.keyboard!.createCursorKeys();
        this.graphics = this.add.graphics();
        this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

        for (let i = 0; i < DOOR_COUNT; i++) {
          const angle = (i / DOOR_COUNT) * Math.PI * 2;
          this.doorPositions.push({ x: 0, y: 0, angle });
          this.quotaTexts.push(
            this.add.text(0, 0, '', { fontSize: '18px', color: '#fff', align: 'center' }).setOrigin(0.5)
          );
        }
      }

      update(time: number, delta: number) {
        const dt = delta / 1000;
        const mainCam = this.cameras.main;
        const centerX = mainCam.width / 2;
        const centerY = mainCam.height / 2;

        const myPlayer = allPlayersRef.current[myIdRef.current!];
        if (myPlayer && myPlayer.roomIndex === null) {
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
          
          if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
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
        this.graphics.fillStyle(0x0000ff, 1);
        this.doorPositions.forEach((pos, index) => {
            const requiredQuota = doorQuotasRef.current[index] ?? 0;

            if (requiredQuota > 0) {
              const currentAngle = pos.angle + doorRotationRef.current;
              const x = Math.cos(currentAngle) * DOOR_RADIUS;
              const y = Math.sin(currentAngle) * DOOR_RADIUS;
              this.graphics.fillRect(centerX + x - DOOR_WIDTH / 2, centerY + y - DOOR_HEIGHT / 2, DOOR_WIDTH, DOOR_HEIGHT);
              
              const currentPlayersInRoom = Object.values(allPlayersRef.current).filter(p => p.roomIndex === index).length;
              const text = `${currentPlayersInRoom}/${requiredQuota}`;
              this.quotaTexts[index].setText(text).setPosition(centerX + x, centerY + y - DOOR_HEIGHT / 2 - 15).setVisible(true);
            } else {
              this.quotaTexts[index].setVisible(false);
            }
        });

        if (phaseRef.current === 'waiting') {
          this.graphics.lineStyle(6, 0xffffff, 1);
          this.graphics.strokeCircle(centerX, centerY, CIRCLE_RADIUS);
        }
        
        const mainPlayers = Object.entries(allPlayersRef.current).filter(([_,p]) => p.roomIndex === null);

        mainPlayers.forEach(([id, info]) => {
          if (!playerSprites[id]) {
            const isMe = id === myIdRef.current;
            playerSprites[id] = this.add.circle(0, 0, PLAYER_RADIUS, isMe ? 0xff2a7f : 0x00bfff);
            playerSprites[id].setStrokeStyle(3, 0xffffff);
            nameTexts[id] = this.add.text(0, 0, info.nickname, { fontSize: '16px', color: '#fff' }).setOrigin(0.5);
          }
          playerSprites[id].setPosition(centerX + info.x, centerY + info.y);
          nameTexts[id].setPosition(centerX + info.x, centerY + info.y - PLAYER_RADIUS - 10);
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

    const config = { type: Phaser.AUTO, width: window.innerWidth, height: window.innerHeight, parent: phaserRef.current!, backgroundColor: '#000', scene: PairScene };
    gameRef.current = new Phaser.Game(config);

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [roomIndex]);

  if (gameResult) {
    return (
      <div style={{
        width: '100vw', height: '100vh', background: '#111', color: '#fff',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 60, fontWeight: 'bold'
      }}>
        {gameResult === 'survived' ? '생존!' : '사망'}
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', cursor: 'default' }}>
       {(phase === 'waiting' || phase === 'playing') && (
        <div style={{
            position: 'fixed', top: 32, left: '50%', transform: 'translateX(-50%)',
            fontSize: phase === 'waiting' && timer > 0 ? 100 : 48, 
            color: '#fff', 
            fontWeight: 'bold', 
            zIndex: 1000,
            transition: 'font-size 0.3s ease-out'
        }}>
            {phase === 'waiting' && timer > 0 ? timer : mainTimer.toFixed(2)}
        </div>
      )}
      {roomIndex === null ? 
        <div ref={phaserRef} /> : 
        <RoomScreen 
          roomIndex={roomIndex} 
          onExit={handleExitRoom} 
          myId={myIdRef.current} 
          roomId={roomId}
          allPlayers={allPlayers}
        />
      }
    </div>
  );
};

export default GameScreen; 