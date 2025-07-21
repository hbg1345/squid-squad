import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import './RedLightGreenLight.css';
import { io, Socket } from 'socket.io-client';

// Red Light, Green Light Game Scene
class RedLightGreenLightScene extends Phaser.Scene {
    private survivorText!: Phaser.GameObjects.Text;
    private younghee!: Phaser.GameObjects.Sprite; 
    private youngheeVisionGraphics!: Phaser.GameObjects.Graphics;
    private youngheeVisionLineGraphics!: Phaser.GameObjects.Graphics;
    private youngheeMoveTimer!: Phaser.Time.TimerEvent;
    private socket!: Socket;
    private players: Map<string, Phaser.GameObjects.Sprite> = new Map();
    private playerNameTexts: Map<string, Phaser.GameObjects.Text> = new Map();
    private myId: string = '';
    private playerNickname: string = '';
    private youngheeListenerRegistered = false;

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

    constructor() {
        super({ key: 'RedLightGreenLightScene' });
    }

    /**
     * Initializes the scene with data passed from the React component.
     * @param data - Data object containing the player's nickname.
     */
    init(data: { playerNickname: string }) {
        // Phaser에서 scene.start로 전달된 데이터는 this.sys.settings.data에 있음
        const nickname = data?.playerNickname || ((this.sys.settings.data as { playerNickname?: string })?.playerNickname) || '';
        this.playerNickname = nickname;
        console.log('[PHASER] init() called, playerNickname:', this.playerNickname);
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
        // 소켓이 없으면 새로 연결
        if (!this.socket) {
            this.socket = io('http://localhost:3001');
            this.socket.on('connect', () => {
                this.myId = this.socket.id ?? '';
                console.log('[SOCKET] Connected! myId:', this.myId);
            });
        }
        console.log('[PHASER] create() called');
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
                console.log('[SOCKET] youngheeUpdate', data);
                if (this.younghee) {
                    this.younghee.setPosition(data.x, data.y);
                    this.drawYoungheeVision(data.x, data.y);
                }
            });
            this.youngheeListenerRegistered = true;
        }
        this.socket.on('gameState', (data) => {
            console.log('[SOCKET] gameState', data);
            console.log('[DEBUG] myId:', this.myId, typeof this.myId);
            Object.keys(data.players).forEach(id => {
                console.log('[DEBUG] players id:', id, typeof id);
                if (id === this.myId) {
                    console.log('[DEBUG] id matches myId!');
                }
            });
            // 1. 없는 플레이어 생성
            Object.entries(data.players).forEach(([id, info]: [string, any]) => {
                if (!this.players.has(id)) {
                    console.log('[PHASER] Creating sprite for player:', id, 'myId at creation:', this.myId, typeof id, typeof this.myId);
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
                    // 내 플레이어는 서버 좌표로 덮어쓰지 않는다!
                    if (id !== this.myId) {
                        sprite.x = info.x;
                        sprite.y = info.y;
                        console.log('[PHASER] Updating sprite position for', id, 'to', info.x, info.y);
                    }
                }
                if (nameText && sprite) {
                    nameText.setPosition(sprite.x, sprite.y - 30);
                }
            });
            // 3. 사라진 플레이어 제거
            Array.from(this.players.keys()).forEach((id) => {
                if (!data.players[id]) {
                    console.log('[PHASER] Removing sprite for player:', id);
                    this.players.get(id)?.destroy();
                    this.playerNameTexts.get(id)?.destroy();
                    this.players.delete(id);
                    this.playerNameTexts.delete(id);
                }
            });
        });
        this.socket.on('tokensUpdate', (data) => {
            console.log('[SOCKET] tokensUpdate', data);
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

    /** 플레이어가 토큰과 겹쳤을 때 호출 */
    private handleCollectToken: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (
      player,
      token
    ) => {
      const t = token as Phaser.Physics.Arcade.Sprite;
      const tokenId = t.getData('id');
      if (typeof tokenId === 'number') {
        // 서버에 토큰 먹기 알림
        this.socket.emit('collectToken', tokenId);
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
        if (!this.myId) {
            return;
        }
        // 내 플레이어만 입력 처리
        const mySprite = this.players.get(this.myId);
        console.log('[PHASER] update() myId:', this.myId, typeof this.myId, 'players:', Array.from(this.players.keys()));
        if (!mySprite || !this.cursors) {
            console.log('[PHASER] update() - mySprite missing for myId:', this.myId, 'players:', Array.from(this.players.keys()));
            return;
        }
        let playerVelocityX = 0;
        let playerVelocityY = 0;
        if (this.cursors.left.isDown) {
            playerVelocityX = -this.playerSpeed;
        } else if (this.cursors.right.isDown) {
            playerVelocityX = this.playerSpeed;
        }
        if (this.cursors.up.isDown) {
            playerVelocityY = -this.playerSpeed;
        } else if (this.cursors.down.isDown) {
            playerVelocityY = this.playerSpeed;
        }
        if (mySprite.body && 'setVelocity' in mySprite.body) {
            (mySprite.body as Phaser.Physics.Arcade.Body).setVelocity(playerVelocityX, playerVelocityY);
        }
        mySprite.x = Phaser.Math.Clamp(mySprite.x, 20, this.scale.width - 20);
        mySprite.y = Phaser.Math.Clamp(mySprite.y, 20, this.scale.height - 20);
        this.playerNameTexts.get(this.myId)?.setPosition(mySprite.x, mySprite.y - 30);
        // 서버로 내 위치 전송
        this.socket.emit('playerMove', { x: mySprite.x, y: mySprite.y, nickname: this.playerNickname });
        console.log('[SOCKET] Emit playerMove (on update):', { x: mySprite.x, y: mySprite.y, nickname: this.playerNickname });

        // 항상 토큰과의 충돌 체크
        this.physics.overlap(mySprite, this.tokens, this.handleCollectToken, undefined, this);
    }

    // moveYounghee 제거 (서버 동기화로 대체)

    /**
     * Draws Younghee's vision cone and lines.
     * @param youngheeX - Younghee's X position.
     * @param youngheeY - Younghee's Y position (Sprite's center).
     */
    private drawYoungheeVision(youngheeX: number, youngheeY: number) {
        // 이전에 그려둔 반투명 영역과 테두리 선 지우기 (이전 프레임에서 그려진 것들을 지움)
        this.youngheeVisionGraphics.clear();
        this.youngheeVisionLineGraphics.clear();

        // 영희 이미지의 눈 위치에 맞춰 시야의 시작점 조정
        // Sprite의 Y는 중앙이므로, 이미지 높이의 절반 위쪽으로 이동하여 눈 높이로 맞춤
        // 영희 이미지의 눈이 대략 이미지 상단에서 35% 지점에 있다고 가정하고 계산
        const eyeX = youngheeX;
        const eyeY = youngheeY - (this.younghee.displayHeight / 2) + (this.younghee.displayHeight * 0.35); 

        // 화면 대각선 길이 계산 -> 시야가 화면 전체를 덮을 수 있도록
        const w = this.scale.width;
        const h = this.scale.height;

        // 3) 방향·각도·거리 가져오기
        const angle     = this.visionAngle;
        const dir       = this.visionDirection;
        const distance  = Math.hypot(w, h);

        // 4) 양쪽 경계점 계산
        const leftRad  = Phaser.Math.DegToRad(dir - angle/2);
        const rightRad = Phaser.Math.DegToRad(dir + angle/2);

        const leftX  = eyeX + distance * Math.cos(leftRad);
        const leftY  = eyeY + distance * Math.sin(leftRad);
        const rightX = eyeX + distance * Math.cos(rightRad);
        const rightY = eyeY + distance * Math.sin(rightRad);
        
        
        // 5) 반투명 콘 채우기
        this.youngheeVisionGraphics
          .fillStyle(0xD5F2FF, 1)
          .beginPath()
          .moveTo(eyeX, eyeY)
          .lineTo(leftX, leftY)
          .lineTo(rightX, rightY)
          .closePath()
          .fill();

         // 6) 테두리 선 그리기
         this.youngheeVisionLineGraphics
          .clear()
          .lineStyle(2, 0x000000, 0.6)
          .beginPath()
          .moveTo(eyeX, eyeY)
          .strokePath();

        this.children.bringToTop(this.younghee);
    }
}

type RedLightGreenLightGameProps = {
    onGoBack: () => void;
    playerNickname: string;
};

const RedLightGreenLightGame: React.FC<RedLightGreenLightGameProps> = ({ onGoBack, playerNickname }) => {
    const gameRef = useRef<HTMLDivElement>(null);
    const gameInstance = useRef<Phaser.Game | null>(null);

    useEffect(() => {
        if (gameRef.current && !gameInstance.current) {
            console.log('[REACT] Creating Phaser.Game instance');
            const config: Phaser.Types.Core.GameConfig = {
                type: Phaser.AUTO,
                width: 720, 
                height: 540, 
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
            // Phaser가 완전히 초기화된 후 scene.start로 데이터 전달
            setTimeout(() => {
                if (gameInstance.current) {
                    // 씬이 이미 시작된 경우에도 start를 호출하면 init이 재실행됨
                    gameInstance.current.scene.start('RedLightGreenLightScene', { playerNickname });
                    console.log('[REACT] Called scene.start with playerNickname:', playerNickname);
                }
            }, 100);
        }
        // Cleanup game instance on component unmount
        return () => {
            if (gameInstance.current) {
                gameInstance.current.destroy(true); 
                gameInstance.current = null;
            }
        };
    }, [playerNickname]); 

    const handleGoBack = () => {
        onGoBack();
    };

    return (
        <div className="game-screen">
            {/* Container where the Phaser game will be rendered */}
            <div ref={gameRef} className="game-container" />

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