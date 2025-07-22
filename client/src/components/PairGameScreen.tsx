import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import Phaser from 'phaser';
import { useLocation } from 'react-router-dom';
import { getSocket } from '../socket';

const CIRCLE_RADIUS = 200;
const PLAYER_RADIUS = 16;
const ROTATION_SPEED = 0.5;
const PLAYER_MOVE_SPEED = 180;
const WAIT_TIME = 3; // 원 회전 시간
const ENTER_TIME = 5; // 방 진입 제한 시간
const DOOR_COUNT = 10;
const DOOR_INTERACT_DIST = 40;
const DOOR_WIDTH = 32;
const DOOR_HEIGHT = 48;
const DOOR_RADIUS = CIRCLE_RADIUS + 80;

// 방 내부 화면 Phaser로 구현 (동일)
const RoomScreen = forwardRef(({ roomIndex, onExit, myId, roomId }: { roomIndex: number, onExit: () => void, myId: string | null, roomId: string }, ref) => {
  const phaserRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<any>(null); // RoomScene 인스턴스 참조

  useImperativeHandle(ref, () => ({
    updatePlayers: (players: { [id: string]: { x: number; y: number; nickname: string } }) => {
      if (sceneRef.current && typeof sceneRef.current.updatePlayers === 'function') {
        sceneRef.current.updatePlayers(players);
      }
    }
  }), []);

  useEffect(() => {
    const socket = getSocket();
    class RoomScene extends Phaser.Scene {
      playerSprites: { [id: string]: Phaser.GameObjects.Arc } = {};
      nameTexts: { [id: string]: Phaser.GameObjects.Text } = {};
      cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
      myId: string | null = myId;
      allPlayers: { [id: string]: { x: number; y: number; nickname: string } } = {};
      create() {
        this.cursors = this.input.keyboard.createCursorKeys();
        sceneRef.current = this;
      }
      updatePlayers(newPlayers: { [id: string]: { x: number; y: number; nickname: string } }) {
        this.allPlayers = newPlayers;
      }
      update() {
        if (this.myId && this.allPlayers[this.myId]) {
          let dx = 0, dy = 0;
          if (this.cursors.left?.isDown) dx -= 1;
          if (this.cursors.right?.isDown) dx += 1;
          if (this.cursors.up?.isDown) dy -= 1;
          if (this.cursors.down?.isDown) dy += 1;
          if (dx !== 0 || dy !== 0) {
            const len = Math.sqrt(dx*dx + dy*dy);
            dx /= len; dy /= len;
            this.allPlayers[this.myId].x += dx * 4;
            this.allPlayers[this.myId].y += dy * 4;
            socket.emit('game2Input', { roomId, input: { x: this.allPlayers[this.myId].x, y: this.allPlayers[this.myId].y } });
          }
        }
        Object.entries(this.allPlayers).forEach(([id, info]) => {
          if (!this.playerSprites[id]) {
            this.playerSprites[id] = this.add.circle(info.x, info.y, PLAYER_RADIUS, id === this.myId ? 0xff2a7f : 0x00bfff);
            this.nameTexts[id] = this.add.text(info.x, info.y - PLAYER_RADIUS - 18, info.nickname, { fontSize: '16px', color: '#fff', fontFamily: 'Arial', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 0.5);
          }
          this.playerSprites[id].setPosition(info.x, info.y);
          this.nameTexts[id].setPosition(info.x, info.y - PLAYER_RADIUS - 18);
        });
        Object.keys(this.playerSprites).forEach(id => {
          if (!this.allPlayers[id]) {
            this.playerSprites[id].destroy();
            this.nameTexts[id].destroy();
            delete this.playerSprites[id];
            delete this.nameTexts[id];
          }
        });
      }
    }
    if (phaserRef.current !== null) {
      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        width: window.innerWidth,
        height: window.innerHeight,
        parent: phaserRef.current,
        backgroundColor: '#222',
        scene: RoomScene,
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
      };
      gameRef.current = new Phaser.Game(config);
      phaserRef.current.focus();
    }
    return () => {
      if (gameRef.current !== null) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
      sceneRef.current = null;
    };
  }, [onExit]);

  return <div ref={phaserRef} tabIndex={0} style={{ width: '100vw', height: '100vh', outline: 'none' }} />;
});

const GameScreen = () => {
  const location = useLocation();
  const { roomId, players = [], playerNickname } = location.state || {};
  const [allPlayers, setAllPlayers] = useState<{ [id: string]: { x: number; y: number; nickname: string } }>({});
  const myIdRef = useRef<string | null>(null);
  // phase: 'waiting'(3초) | 'entering'(5초) | 'room' | 'dead' | 'survived'
  const [phase, setPhase] = useState<'waiting' | 'entering' | 'room' | 'dead' | 'survived'>('waiting')
  const [timer, setTimer] = useState(WAIT_TIME)
  const [roomIndex, setRoomIndex] = useState<number | null>(null)
  const [restartKey, setRestartKey] = useState(0) // 재시작용
  const roomScreenRef = useRef<any>(null);

  // 타이머 관리
  useEffect(() => {
    if (["waiting", "entering", "room"].includes(phase)) {
      let last = Date.now();
      const id = setInterval(() => {
        const now = Date.now();
        const diff = (now - last) / 1000;
        last = now;
        setTimer(t => Math.max(0, t - diff));
      }, 50);
      return () => clearInterval(id);
    }
  }, [phase]);

  // phase 전환
  useEffect(() => {
    if (phase === 'waiting' && timer <= 0) {
      setPhase('entering')
      setTimer(ENTER_TIME)
    } else if (phase === 'room' && timer <= 0 && roomIndex !== null) {
      setPhase('survived');
    } else if (phase === 'entering' && timer <= 0 && roomIndex === null) {
      setPhase('dead');
    }
    // phase === 'survived'일 때는 아무것도 하지 않음
  }, [phase, timer, roomIndex])

  // phase가 'survived'로 바뀌면 1.5초 후 자동 재시작
  useEffect(() => {
    if (phase === 'survived') {
      setTimer(WAIT_TIME);
      const id = setTimeout(() => {
        setPhase('waiting');
        setRoomIndex(null);
        setRestartKey(k => k + 1);
      }, 1500);
      return () => clearTimeout(id);
    }
  }, [phase]);

  // 방 입장/퇴장 시 phase를 변경
  const handleEnterRoom = useCallback((idx: number) => {
    setRoomIndex(idx);
    setPhase('room');
  }, []);
  const handleExitRoom = useCallback(() => {
    setRoomIndex(null);
    setPhase('entering');
  }, []);

  // Phaser 외부 맵
  const phaserRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const timerRef = useRef(timer)
  useEffect(() => { timerRef.current = timer }, [timer])
  useEffect(() => {
    const socket = getSocket();
    // 내 socket.id 저장
    if (!myIdRef.current && socket.id) {
      myIdRef.current = socket.id;
    }
    // game2State 수신
    const onGame2State = (data: { players: { [id: string]: { x: number; y: number; nickname: string } } }) => {
      setAllPlayers((prev) => {
        // RoomScreen의 updatePlayers 메서드 호출
        if (roomScreenRef.current && typeof roomScreenRef.current.updatePlayers === 'function') {
          roomScreenRef.current.updatePlayers(data.players);
        }
        return data.players;
      });
    };
    socket.on('game2State', onGame2State);
    return () => {
      socket.off('game2State', onGame2State);
    };
  }, [roomId]);
  useEffect(() => {
    if (roomId && playerNickname) {
      const socket = getSocket();
      socket.emit('joinGame', { roomId, nickname: playerNickname });
    }
  }, [roomId, playerNickname]);
  useEffect(() => {
    if (phase !== 'waiting' && phase !== 'entering') return;
    if (phaserRef.current !== null && !gameRef.current) {
      let playerX = 0
      let playerY = 0
      let circleRotation = 0
      let cursors: Phaser.Types.Input.Keyboard.CursorKeys
      let timerText: Phaser.GameObjects.Text
      let doors: Phaser.GameObjects.Rectangle[] = []
      let doorAngles: number[] = []
      let doorCount = DOOR_COUNT
      let doorsCreated = false
      let enterableDoorIndices: number[] = []
      let doorStates: boolean[] = []
      let playerLocation: 'lobby' | number = 'lobby'
      let interactHint: Phaser.GameObjects.Text | null = null
      let lastPhase = phase;
      class MainScene extends Phaser.Scene {
        graphics!: Phaser.GameObjects.Graphics
        player!: Phaser.GameObjects.Arc
        cameraOffsetX: number = 0
        cameraOffsetY: number = 0
        create() {
          const mainCam = this.cameras.main as Phaser.Cameras.Scene2D.Camera;
          const centerX = mainCam.centerX;
          const centerY = mainCam.centerY;
          this.graphics = this.add.graphics()
          this.player = this.add.circle(0, 0, PLAYER_RADIUS, 0xff2a7f)
          this.player.setStrokeStyle(3, 0xffffff)
          timerText = this.add.text(centerX, 40, '', {
            fontSize: '32px', color: '#fff', fontFamily: 'Arial, sans-serif', fontStyle: 'bold', stroke: '#000', strokeThickness: 4, align: 'center',
          }).setOrigin(0.5, 0.5)
          cursors = this.input.keyboard.createCursorKeys()
        }
        update(time: number, delta: number) {
          const dt = delta / 1000
          // phase가 바뀌면 doorsCreated 등 리셋
          if (phase !== lastPhase) {
            if (phase === 'waiting') {
              doorsCreated = false;
            }
            lastPhase = phase;
          }
          if (phase === 'waiting') {
            circleRotation += ROTATION_SPEED * dt
            const cosR = Math.cos(ROTATION_SPEED * dt)
            const sinR = Math.sin(ROTATION_SPEED * dt)
            const rotatedX = playerX * cosR - playerY * sinR
            const rotatedY = playerX * sinR + playerY * cosR
            playerX = rotatedX
            playerY = rotatedY
          }
          let dx = 0, dy = 0
          if (cursors.left?.isDown) dx -= 1
          if (cursors.right?.isDown) dx += 1
          if (cursors.up?.isDown) dy -= 1
          if (cursors.down?.isDown) dy += 1
          if (dx !== 0 || dy !== 0) {
            const len = Math.sqrt(dx*dx + dy*dy)
            dx /= len; dy /= len
            playerX += dx * PLAYER_MOVE_SPEED * dt
            playerY += dy * PLAYER_MOVE_SPEED * dt
          }
          if (phase === 'waiting') {
            const dist = Math.sqrt(playerX*playerX + playerY*playerY)
            if (dist > CIRCLE_RADIUS - PLAYER_RADIUS) {
              const scale = (CIRCLE_RADIUS - PLAYER_RADIUS) / dist
              playerX *= scale
              playerY *= scale
            }
          }
          const mainCam = this.cameras.main as Phaser.Cameras.Scene2D.Camera;
          const centerX = mainCam.centerX;
          const centerY = mainCam.centerY;
          this.cameraOffsetX = playerX;
          this.cameraOffsetY = playerY;
          this.graphics.clear()
          if (phase === 'waiting') {
            this.graphics.lineStyle(6, 0xffffff, 1)
            this.graphics.strokeCircle(centerX - this.cameraOffsetX, centerY - this.cameraOffsetY, CIRCLE_RADIUS)
          }
          if (phase === 'entering' && !doorsCreated) {
            doorAngles = []
            doors = []
            // 파란 문의 개수 랜덤(1~9)
            const blueDoorCount = Phaser.Math.Between(1, doorCount - 1)
            enterableDoorIndices = Phaser.Utils.Array.Shuffle([...Array(doorCount).keys()]).slice(0, blueDoorCount)
            doorStates = Array(doorCount).fill(false)
            for (let i = 0; i < enterableDoorIndices.length; ++i) doorStates[enterableDoorIndices[i]] = true
            playerLocation = 'lobby'
            interactHint = null
            for (let i = 0; i < doorCount; ++i) {
              const theta = (i / doorCount) * Math.PI * 2
              doorAngles.push(theta)
              const color = doorStates[i] ? 0x00bfff : 0xff2a2a
              const door = this.add.rectangle(0, 0, DOOR_WIDTH, DOOR_HEIGHT, color)
              door.setStrokeStyle(3, 0xffffff)
              doors.push(door)
            }
            doorsCreated = true
          }
          if (doorsCreated) {
            for (let i = 0; i < doors.length; ++i) {
              const theta = doorAngles[i] + circleRotation
              const doorX = Math.cos(theta) * DOOR_RADIUS
              const doorY = Math.sin(theta) * DOOR_RADIUS
              doors[i].setPosition(centerX - this.cameraOffsetX + doorX, centerY - this.cameraOffsetY + doorY)
              doors[i].setRotation(theta + Math.PI / 2)
              const color = doorStates[i] ? 0x00bfff : 0xff2a2a
              doors[i].setFillStyle(color)
            }
          }
          if (doorsCreated) {
            if (!interactHint) {
              interactHint = this.add.text(centerX, centerY - 80, '', {
                fontSize: '28px', color: '#fff', fontFamily: 'Arial', stroke: '#000', strokeThickness: 4,
              }).setOrigin(0.5, 0.5).setDepth(10)
            }
            interactHint.setVisible(false)
            if (playerLocation === 'lobby') {
              let nearDoorIdx = -1
              let minDist = 99999
              for (let i = 0; i < doors.length; ++i) {
                const doorPos = doors[i].getCenter()
                const dist = Phaser.Math.Distance.Between(centerX, centerY, doorPos.x, doorPos.y)
                if (dist < DOOR_INTERACT_DIST && doorStates[i]) {
                  if (dist < minDist) {
                    minDist = dist
                    nearDoorIdx = i
                  }
                }
              }
              if (nearDoorIdx !== -1 && phase === 'entering') {
                interactHint.setText('F: 방 입장')
                interactHint.setVisible(true)
                if (Phaser.Input.Keyboard.JustDown(cursors.space) || this.input.keyboard.checkDown(this.input.keyboard.addKey('F'), 0)) {
                  // setRoomIndex(nearDoorIdx)
                  handleEnterRoom(nearDoorIdx)
                }
              }
            }
            interactHint.setPosition(centerX, centerY - 80)
          }
          this.player.setPosition(centerX, centerY)
          timerText.setPosition(centerX, 40)
          timerText.setVisible(false)
        }
      }
      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        width: window.innerWidth,
        height: window.innerHeight,
        parent: phaserRef.current!,
        backgroundColor: '#000',
        scene: MainScene,
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
      }
      gameRef.current = new Phaser.Game(config)
    }
    return () => {
      if (gameRef.current !== null) {
        gameRef.current.destroy(true)
        gameRef.current = null
      }
    }
  }, [phase, restartKey])

  if (phase === 'dead') {
    return (
      <div style={{
        width: '100vw', height: '100vh', background: '#111', color: '#fff',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 40
      }}>
        <div style={{ marginBottom: 32 }}>죽었습니다</div>
        <button style={{ fontSize: 28, padding: '16px 40px', borderRadius: 12 }}
          onClick={() => { setPhase('waiting'); setTimer(WAIT_TIME); setRoomIndex(null); setRestartKey(k => k + 1); }}>
          다시 시작
        </button>
      </div>
    );
  }

  if (phase === 'survived') {
    return (
      <div style={{
        width: '100vw', height: '100vh', background: '#111', color: '#fff',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 40
      }}>
        <div style={{ marginBottom: 32 }}>생존!</div>
      </div>
    );
  }

  return (
    <div>
      <div>Players: {Object.values(allPlayers).map(p => p.nickname).join(', ')}</div>
      {/* 항상 상단에 보이되, 3초 이하일 때만 크게 */}
      <div style={{
        position: 'fixed', top: 32, left: '50%', transform: 'translateX(-50%)',
        fontSize: timer <= 3 ? 100 : 32, color: '#fff', fontWeight: 'bold', zIndex: 1000,
        textShadow: '0 0 32px #000, 0 0 8px #000',
        pointerEvents: 'none',
        transition: 'font-size 0.2s cubic-bezier(0.4,1.4,0.6,1)',
      }}>
        {timer > 0 ? timer.toFixed(2) : '0.00'}
      </div>
      {myIdRef.current && (
        <RoomScreen
          ref={roomScreenRef}
          roomIndex={roomIndex as number}
          onExit={handleExitRoom}
          myId={myIdRef.current}
          roomId={roomId}
        />
      )}
    </div>
  )
}

export default GameScreen 