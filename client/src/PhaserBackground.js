import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';

const PhaserBackground = () => {
  const phaserRef = useRef(null);
  const gameRef = useRef(null);

  useEffect(() => {
    if (gameRef.current) return;
    const config = {
      type: Phaser.AUTO,
      width: window.innerWidth,
      height: window.innerHeight,
      transparent: false,
      backgroundColor: '#111', // 오징어게임 느낌의 블랙
      parent: phaserRef.current,
      scene: {
        create() {
          const particles = this.add.particles(0, 0, 'pink', {
            x: { min: 0, max: window.innerWidth },
            y: { min: 0, max: window.innerHeight },
            lifespan: 4000,
            speed: { min: 30, max: 100 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.35, end: 0 },
            quantity: 2,
            blendMode: 'ADD',
            frequency: 100
          });
        },
        preload() {
          // 핑크색 파티클 이미지 생성
          const size = 32;
          const canvas = this.textures.createCanvas('pink', size, size);
          const ctx = canvas.getContext();
          ctx.beginPath();
          ctx.arc(size/2, size/2, size/2, 0, 2 * Math.PI);
          ctx.fillStyle = '#ff2a7f'; // 오징어게임 핑크
          ctx.shadowColor = '#ff2a7f';
          ctx.shadowBlur = 16;
          ctx.fill();
          canvas.refresh();
        },
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

  return <div ref={phaserRef} style={{ position: 'fixed', inset: 0, zIndex: 0 }} />;
};

export default PhaserBackground; 