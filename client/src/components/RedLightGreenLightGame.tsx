import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import './RedLightGreenLight.css';
import { socket } from '../socket';

// Vite 환경변수 타입 선언 (없으면 추가)
declare global {
  interface ImportMeta {
    readonly env: {
      VITE_SOCKET_URL: string;
      [key: string]: string;
    };
  }
}

// Red Light, Green Light Game Scene
class RedLightGreenLightScene extends Phaser.Scene {
    private survivorText!: Phaser.GameObjects.Text;
    private younghee!: Phaser.GameObjects.Sprite; 
    private youngheeVisionGraphics!: Phaser.GameObjects.Graphics;
    private youngheeVisionLineGraphics!: Phaser.GameObjects.Graphics;
    private youngheeMoveTimer!: Phaser.Time.TimerEvent;
    private socket = socket;
    private players: Map<string, Phaser.GameObjects.Sprite> = new Map();
    private playerNameTexts: Map<string, Phaser.GameObjects.Text> = new Map();
    private myId: string = '';
    private playerNickname: string = '';
    private youngheeListenerRegistered = false;
    private roomId: string = '';

    private visionAngle: number     = 60;   // 콘의 벌어짐 각도 (°)
    private visionDirection: number = 270;  // 시야가 향하는 기본 방향 (°)
    private visionDistance: number  = 600;  // 시야가 뻗어나가는 거리 (px)

    //tokens
    private tokens!: Phaser.Physics.Arcade.Group;
    private tokenKeys = ['token1', 'token2'];
    private maxTokens = 20;
    private tokenCount = 0;
    private tokenCountText!: Phaser.GameObjects.Text;

    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private playerSpeed: number = 500;

    private handleGameState: any;
    private handleYoungheeUpdate: any;

    constructor() {
        super({ key: 'RedLightGreenLightScene' });
    }

    /**
     * Initializes the scene with data passed from the React component.
     * @param data - Data object containing the player's nickname.
     */
    init(data: { playerNickname: string, roomId?: string }) {
        const settingsData = this.sys.settings.data as { playerNickname?: string, roomId?: string };
        const nickname = data?.playerNickname || settingsData?.playerNickname || '';
        const roomId = data?.roomId || settingsData?.roomId || '';
        console.log('[LOG] RedLightGreenLightScene.init', data, settingsData);
        this.playerNickname = nickname;
        this.roomId = roomId;
    }

    /**
     * Preloads assets required for the scene.
     */
    preload() {
        // 이미지 불러오기 
        this.load.image('younghee', '/younghee.png'); 
        this.load.image('player', '/player.png');
        this.load.image('token1', '/token1.png');
        this.load.image('token2', '/token2.png');
    }

    /**
     * Called once when the scene is created and ready to be displayed.
     */
    create() {
        this.myId = this.socket.id ?? '';
        console.log('[CLIENT] create() called, roomId:', this.roomId);
        this.socket.emit('joinGame', { roomId: this.roomId, nickname: this.playerNickname });
        // Set a light grey background color as in the image
        this.cameras.main.setBackgroundColor('#F0F0F0');

        // 1. Current Survivors Display
        this.survivorText = this.add.text(this.scale.width / 2, 50, '현재 생존자: 200/456', {
            fontSize: '32px',
            color: '#000000',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5); // Center horizontally

        // 2. Younghee (Doll) Implementation
        // Initial Younghee position (randomized later)
        const initialYoungheeX = this.scale.width / 2;
        const initialYoungheeY = 180; // 이미지 크기 고려하여 Y 위치 조정

        // 영희 이미지를 사용하여 Sprite 생성
        this.younghee = this.add.sprite(initialYoungheeX, initialYoungheeY, 'younghee');
        this.younghee.setScale(0.5); // 영희 이미지 크기 조정
        this.younghee.setOrigin(0.5, 0.5); // 이미지의 중앙을 기준으로 설정 (기본값)

        // Younghee's vision graphics
        this.youngheeVisionGraphics = this.add.graphics();
        this.youngheeVisionLineGraphics = this.add.graphics();

        // 영희 최소 시야 그리기 
        this.drawYoungheeVision(this.younghee.x, this.younghee.y);


        // 서버에서 영희 위치 동기화 받기 (중복 등록 방지)
        if (!this.youngheeListenerRegistered) {
            this.socket.on('youngheeUpdate', (data: { x: number, y: number }) => {
                if (this.younghee) {
                    this.younghee.setPosition(data.x, data.y);
                    this.drawYoungheeVision(data.x, data.y);
                }
            });
            this.youngheeListenerRegistered = true;
        }
        this.handleGameState = (data: any) => {
            // 1. 없는 플레이어 생성
            Object.entries(data.players).forEach(([id, info]: [string, any]) => {
                if (!this.players.has(id)) {
                    const sprite = this.physics.add.sprite(info.x, info.y, 'player')
                        .setScale(0.5)
                        .setOrigin(0.5, 0.5);
                    const pr = 20;
                    sprite.body.setCircle(pr);
                    sprite.body.setOffset(
                        sprite.displayWidth/2 - pr,
                        sprite.displayHeight/2 - pr
                    );
                    this.players.set(id, sprite);
                    // 닉네임 텍스트
                    const nameText = this.add.text(info.x, info.y - 30, info.nickname, {
                        fontSize: '18px',
                        color: '#000000',
                        fontFamily: 'Arial, sans-serif',
                        fontStyle: 'bold'
                    }).setOrigin(0.5);
                    this.playerNameTexts.set(id, nameText);
                }
            });
            // 2. 위치 갱신
            Object.entries(data.players).forEach(([id, info]: [string, any]) => {
                const sprite = this.players.get(id);
                const nameText = this.playerNameTexts.get(id);
                if (sprite) {
                    // 내 플레이어도 서버 좌표로 이동시킴
                    sprite.x = info.x;
                    sprite.y = info.y;
                }
                if (nameText && sprite) {
                    nameText.setPosition(sprite.x, sprite.y - 30);
                }
            });
            // 3. 사라진 플레이어 제거
            Array.from(this.players.keys()).forEach((id) => {
                if (!data.players[id]) {
                    this.players.get(id)?.destroy();
                    this.playerNameTexts.get(id)?.destroy();
                    this.players.delete(id);
                    this.playerNameTexts.delete(id);
                }
            });
            // 생존자 수 표시 (size → Object.keys(...).length)
            const survivorCount = data.players ? Object.keys(data.players).length : 0;
            this.survivorText.setText(`현재 생존자: ${survivorCount}/456`);
        };
        this.handleYoungheeUpdate = (data: any) => {
            if (this.younghee) {
                this.younghee.setPosition(data.x, data.y);
                this.drawYoungheeVision(data.x, data.y);
            }
        };
        this.socket.on('gameState', this.handleGameState);
        this.socket.on('youngheeUpdate', this.handleYoungheeUpdate);
        this.socket.on('tokensUpdate', (data) => {
          // 기존 토큰 모두 제거
          this.tokens.clear(true, true);
          // 서버에서 받은 토큰만 다시 생성
          data.forEach((token: any) => {
            const t = this.physics.add.sprite(token.x, token.y, token.key)
              .setScale(0.3)
              .setOrigin(0.5);
            t.setData('id', token.id);
            t.body.setCircle(16);
            t.body.setOffset(t.displayWidth/2 - 16, t.displayHeight/2 - 16);
            this.tokens.add(t);
          });
        });

        // Keyboard input setup
        this.cursors = this.input.keyboard!.createCursorKeys();
        // 키 입력 상태 추적용
        this.lastInputState = { left: false, right: false, up: false, down: false };
        this.input.keyboard!.on('keydown', this.handleKeyInput, this);
        this.input.keyboard!.on('keyup', this.handleKeyInput, this);

        //tokens
        // 토큰 개수 표시 ui
        const margin = 16;
        this.tokenCountText = this.add
          .text(this.scale.width - 100, margin, '먹은 토큰: 0', {
            fontSize: '16px', color: '#000'
          })
          .setOrigin(1, 0); // 오른쪽 상단에 위치
        // 토큰 그룹 생성
        this.tokens = this.physics.add.group();

        // 서버에서 토큰 정보 수신
        this.socket.on('tokensUpdate', (tokens) => {
          // 기존 토큰 모두 제거
          this.tokens.clear(true, true);
          // 서버에서 받은 토큰만 다시 생성
          tokens.forEach((token: any) => {
            const t = this.physics.add.sprite(token.x, token.y, token.key)
              .setScale(0.3)
              .setOrigin(0.5);
            t.setData('id', token.id);
            t.body.setCircle(16);
            t.body.setOffset(t.displayWidth/2 - 16, t.displayHeight/2 - 16);
            this.tokens.add(t);
          });
        });

        // 플레이어와 토큰 충돌/겹침 처리
        const myPlayer = this.players.get(this.myId);
        if (myPlayer) {
          this.physics.add.overlap(
            myPlayer,
            this.tokens,
            this.handleCollectToken,
            undefined,
            this
          );
        }
    }

    private lastInputState: { left: boolean, right: boolean, up: boolean, down: boolean } = { left: false, right: false, up: false, down: false };
    private handleKeyInput() {
        const input = {
            left: this.cursors.left.isDown,
            right: this.cursors.right.isDown,
            up: this.cursors.up.isDown,
            down: this.cursors.down.isDown
        };
        // 입력 상태가 바뀌었을 때만 emit
        if (JSON.stringify(input) !== JSON.stringify(this.lastInputState)) {
            this.socket.emit('playerInput', { roomId: this.roomId, input });
            this.lastInputState = input;
        }
    }

    /** 플레이어가 토큰과 겹쳤을 때 호출 */
    private handleCollectToken: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (
      player,
      token
    ) => {
      const t = token as Phaser.Physics.Arcade.Sprite;
      const tokenId = t.getData('id');
      if (typeof tokenId === 'number') {
        // 서버에 토큰 먹기 알림
        this.socket.emit('collectToken', { roomId: this.roomId, tokenId });
        // 내 토큰 카운트만 증가
        this.tokenCount++;
        this.tokenCountText.setText(`먹은 토큰: ${this.tokenCount}`);
      }
    }


    /**
     * Called every frame to update game logic.
     * @param time - The current game time.
     * @param delta - The time elapsed since the last frame.
     */
    update(time: number, delta: number) {
        if (!this.myId) return;
        const mySprite = this.players.get(this.myId);
        if (!mySprite) return;
        // 입력 상태 체크 및 emit
        const input = {
            left: this.cursors.left.isDown,
            right: this.cursors.right.isDown,
            up: this.cursors.up.isDown,
            down: this.cursors.down.isDown
        };
        // 키 입력 상태 콘솔 출력 제거
        if (JSON.stringify(input) !== JSON.stringify(this.lastInputState)) {
            this.socket.emit('playerInput', input);
            this.lastInputState = { ...input };
        }
        this.playerNameTexts.get(this.myId)?.setPosition(mySprite.x, mySprite.y - 30);
        this.physics.overlap(mySprite, this.tokens, this.handleCollectToken, undefined, this);
    }

    // moveYounghee 제거 (서버 동기화로 대체)

    /**
     * Draws Younghee's vision cone and lines.
     * @param youngheeX - Younghee's X position.
     * @param youngheeY - Younghee's Y position (Sprite's center).
     */
    private drawYoungheeVision(youngheeX: number, youngheeY: number) {
        // null 체크 추가
        if (!this.younghee || !this.younghee.displayHeight || !this.younghee.texture) return;
        // 이전에 그려둔 반투명 영역과 테두리 선 지우기 (이전 프레임에서 그려진 것들을 지움)
        this.youngheeVisionGraphics.clear();
        this.youngheeVisionLineGraphics.clear();

        // 영희 이미지의 눈 위치에 맞춰 시야의 시작점 조정
        // Sprite의 Y는 중앙이므로, 이미지 높이의 절반 위쪽으로 이동하여 눈 높이로 맞춤
        // 영희 이미지의 눈이 대략 이미지 상단에서 35% 지점에 있다고 가정하고 계산
        const eyeX = youngheeX;
        const eyeY = youngheeY - (this.younghee.displayHeight / 2) + (this.younghee.displayHeight * 0.35) + 40;

        // 원형 시야 그리기 (싱글플레이 방식)
        this.youngheeVisionGraphics
            .fillStyle(0xD5F2FF, 0.6)
            .fillCircle(eyeX, eyeY, this.visionDistance);

        this.youngheeVisionLineGraphics
            .strokeCircle(eyeX, eyeY, this.visionDistance);

        this.children.bringToTop(this.younghee);
    }

    shutdown() {
        this.socket.off('gameState', this.handleGameState);
        this.socket.off('youngheeUpdate', this.handleYoungheeUpdate);
    }
    destroy() {
        this.socket.off('gameState', this.handleGameState);
        this.socket.off('youngheeUpdate', this.handleYoungheeUpdate);
    }
}

type RedLightGreenLightGameProps = {
    onGoBack: () => void;
    playerNickname: string;
    roomId?: string;
};

const RedLightGreenLightGame: React.FC<RedLightGreenLightGameProps> = ({ onGoBack, playerNickname, roomId }) => {
    console.log('[LOG] RedLightGreenLightGame props', { playerNickname, roomId });
    const gameRef = useRef<HTMLDivElement>(null);
    const gameInstance = useRef<Phaser.Game | null>(null);

    // 제한 시간 및 phase 상태 추가
    const [phase, setPhase] = useState<'waiting' | 'dead' | 'playing'>('waiting');
    const [timer, setTimer] = useState(10);

    // 타이머 감소 로직
    useEffect(() => {
        if (phase === 'waiting') {
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

    // 타이머가 0이 되면 dead로 전환
    useEffect(() => {
        if (phase === 'waiting' && timer <= 0) {
            setPhase('dead');
        }
    }, [phase, timer]);

    // dead phase가 되면 자동으로 타이틀로 이동 + Phaser 인스턴스 안전 파괴 (중복 방지)
    const alreadyDead = useRef(false);
    useEffect(() => {
        if (phase === 'dead' && !alreadyDead.current) {
            alreadyDead.current = true;
            if (gameInstance.current) {
                gameInstance.current.destroy(true);
                gameInstance.current = null;
            }
            onGoBack();
        }
        if (phase !== 'dead') {
            alreadyDead.current = false;
        }
    }, [phase, onGoBack]);

    // phase가 바뀔 때마다 타이머 초기화 (dead->waiting 등)
    useEffect(() => {
        if (phase === 'waiting') {
            setTimer(10);
        }
    }, [phase]);

    useEffect(() => {
        if (gameRef.current) {
            gameRef.current.tabIndex = 0;
            gameRef.current.focus();
        }
        if (!gameInstance.current) {
            const width = window.innerWidth;
            const height = window.innerHeight;
            const config: Phaser.Types.Core.GameConfig = {
                type: Phaser.AUTO,
                width,
                height,
                parent: gameRef.current,
                backgroundColor: '#F0F0F0',
                scale: {
                    mode: Phaser.Scale.RESIZE,
                    autoCenter: Phaser.Scale.CENTER_BOTH
                },
                scene: RedLightGreenLightScene,
                physics: {
                    default: 'arcade', 
                    arcade: {
                        gravity: { x: 0, y: 0 }, 
                        debug: false 
                    }
                }
            };
            gameInstance.current = new Phaser.Game(config);
            setTimeout(() => {
                if (gameInstance.current) {
                    gameInstance.current.scene.stop('RedLightGreenLightScene');
                    console.log('[LOG] scene.start with', { playerNickname, roomId });
                    gameInstance.current.scene.start('RedLightGreenLightScene', { playerNickname, roomId });
                }
            }, 100);
        } else {
            // Phaser 인스턴스가 이미 있으면 scene.stop 후 scene.start
            gameInstance.current.scene.stop('RedLightGreenLightScene');
            console.log('[LOG] scene.start (existing instance) with', { playerNickname, roomId });
            gameInstance.current.scene.start('RedLightGreenLightScene', { playerNickname, roomId });
        }
        return () => {
            if (gameInstance.current) {
                gameInstance.current.destroy(true); 
                gameInstance.current = null;
            }
        };
    }, [playerNickname, roomId]); 

    const handleGoBack = () => {
        onGoBack();
    };

    // 타이머 UI
    const timerUI = phase === 'waiting' && (
        <div style={{
            position: 'fixed', top: 32, left: '50%', transform: 'translateX(-50%)',
            fontSize: timer <= 3 ? 100 : 32, color: '#fff', fontWeight: 'bold', zIndex: 1000,
            textShadow: '0 0 32px #000, 0 0 8px #000',
            pointerEvents: 'none',
            transition: 'font-size 0.2s cubic-bezier(0.4,1.4,0.6,1)',
        }}>
            {timer > 0 ? timer.toFixed(2) : '0.00'}
        </div>
    );

    // deadUI 제거 (자동 이동)

    return (
        <div className="game-screen">
            {timerUI}
            {/* Container where the Phaser game will be rendered */}
            {phase !== 'dead' && (
                <div ref={gameRef} className="game-container" />
            )}
            {/* Back button */}
            <div className="back-button-container">
                <button
                    className="back-button"
                    onClick={handleGoBack}
                >
                    타이틀로 돌아가기
                </button>
            </div>
        </div>
    );
};

export default RedLightGreenLightGame;