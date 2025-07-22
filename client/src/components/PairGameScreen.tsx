import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { useLocation } from 'react-router-dom';
import { getSocket } from '../socket';

const PLAYER_RADIUS = 16;
const PLAYER_MOVE_SPEED = 180;

const GameScreen = () => {
  const location = useLocation();
  const { roomId } = location.state || {};
  const [allPlayers, setAllPlayers] = useState<{ [id: string]: { x: number; y: number; nickname: string } }>({});
  const allPlayersRef = useRef(allPlayers);
  useEffect(() => {
    allPlayersRef.current = allPlayers;
  }, [allPlayers]);
  const myIdRef = useRef<string | null>(null);

  const phaserRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  // Socket connection to receive player data
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    if (!myIdRef.current && socket.id) {
      myIdRef.current = socket.id;
    }

    const onGame2State = (data: { players: { [id: string]: { x: number; y: number; nickname: string } } }) => {
      const updatedPlayers = { ...data.players };
      Object.keys(updatedPlayers).forEach(id => {
        updatedPlayers[id].x = updatedPlayers[id].x ?? 0;
        updatedPlayers[id].y = updatedPlayers[id].y ?? 0;
      });
      setAllPlayers(updatedPlayers);
    };

    socket.on('game2State', onGame2State);

    return () => {
      socket.off('game2State', onGame2State);
    };
  }, [roomId]);

  // Phaser setup effect
  useEffect(() => {
    if (!phaserRef.current || gameRef.current) return;

    let playerSprites: { [id: string]: Phaser.GameObjects.Arc } = {};
    let nameTexts: { [id: string]: Phaser.GameObjects.Text } = {};

    class PairScene extends Phaser.Scene {
      cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

      create() {
        this.cursors = this.input.keyboard!.createCursorKeys();
      }

      update(time: number, delta: number) {
        const dt = delta / 1000;

        // Handle player input
        const myPlayer = allPlayersRef.current[myIdRef.current!];
        if (myPlayer && this.cursors) {
          let dx = 0;
          let dy = 0;

          if (this.cursors.left.isDown) dx -= 1;
          if (this.cursors.right.isDown) dx += 1;
          if (this.cursors.up.isDown) dy -= 1;
          if (this.cursors.down.isDown) dy += 1;

          if (dx !== 0 || dy !== 0) {
            const len = Math.sqrt(dx * dx + dy * dy);
            const newX = myPlayer.x + (dx / len) * PLAYER_MOVE_SPEED * dt;
            const newY = myPlayer.y + (dy / len) * PLAYER_MOVE_SPEED * dt;
            
            const socket = getSocket();
            if(socket) {
              socket.emit('game2Input', { roomId, input: { x: newX, y: newY } });
            }
          }
        }

        // Render players
        const mainCam = this.cameras.main;
        const centerX = mainCam.width / 2;
        const centerY = mainCam.height / 2;

        Object.entries(allPlayersRef.current).forEach(([id, info]) => {
          if (!playerSprites[id]) {
            const isMe = id === myIdRef.current;
            playerSprites[id] = this.add.circle(0, 0, PLAYER_RADIUS, isMe ? 0xff2a7f : 0x00bfff);
            playerSprites[id].setStrokeStyle(3, 0xffffff);
            nameTexts[id] = this.add.text(0, 0, info.nickname, { fontSize: '16px', color: '#fff', fontFamily: 'Arial', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);
          }
          playerSprites[id].setPosition(centerX + info.x, centerY + info.y);
          nameTexts[id].setPosition(centerX + info.x, centerY + info.y - PLAYER_RADIUS - 10);
        });

        Object.keys(playerSprites).forEach(id => {
          if (!allPlayersRef.current[id]) {
            playerSprites[id].destroy();
            nameTexts[id].destroy();
            delete playerSprites[id];
            delete nameTexts[id];
          }
        });
      }
    }

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: window.innerWidth,
      height: window.innerHeight,
      parent: phaserRef.current!,
      backgroundColor: '#000',
      scene: PairScene,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    };

    gameRef.current = new Phaser.Game(config);

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', cursor: 'default' }}>
      <div ref={phaserRef} />
    </div>
  );
};

export default GameScreen; 