import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import './RedLightGreenLight.css';

// Red Light, Green Light Game Scene
class RedLightGreenLightScene extends Phaser.Scene {
    private survivorText!: Phaser.GameObjects.Text;
    private younghee!: Phaser.GameObjects.Sprite; 
    private youngheeVisionGraphics!: Phaser.GameObjects.Graphics;
    private youngheeVisionLineGraphics!: Phaser.GameObjects.Graphics;
    private youngheeMoveTimer!: Phaser.Time.TimerEvent;
    private player!: Phaser.GameObjects.Sprite;
    private playerNameText!: Phaser.GameObjects.Text;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private playerSpeed: number = 500; // Player movement speed
    private playerNickname: string = '플레이어'; // Default nickname, will be overridden by prop

    private visionAngle: number     = 60;   // 콘의 벌어짐 각도 (°)
    private visionDirection: number = 270;  // 시야가 향하는 기본 방향 (°)
    private visionDistance: number  = 200;  // 맨 처음에 시야가 뻗어나가는 거리 (px) - 원 

    //tokens
    private tokens!: Phaser.Physics.Arcade.Group;
    private tokenKeys = ['token1', 'token2'];
    private maxTokens = 20;
    private tokenCount = 0;
    private tokenCountText!: Phaser.GameObjects.Text;

    constructor() {
        super({ key: 'RedLightGreenLightScene' });
    }

    /**
     * Initializes the scene with data passed from the React component.
     * @param data - Data object containing the player's nickname.
     */
    init(data: { playerNickname: string }) {
        this.playerNickname = data.playerNickname;
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
        // 이미지의 원본 해상도에 따라 이 값을 조정하여 원하는 크기를 만드세요.
        this.younghee.setScale(0.5); // 영희 이미지 크기 조정
        this.younghee.setOrigin(0.5, 0.5); // 이미지의 중앙을 기준으로 설정 (기본값)

        // Younghee's vision graphics
        this.youngheeVisionGraphics = this.add.graphics();
        this.youngheeVisionLineGraphics = this.add.graphics();

        // 영희 최소 시야 그리기 
        this.drawYoungheeVision(this.younghee.x, this.younghee.y);

        // 영희 이동하는 시간 설정 - 매번 다르게 설정하기......... !!!!!! 
        this.youngheeMoveTimer = this.time.addEvent({
            delay: 5000, // 5 seconds
            callback: this.moveYounghee,
            callbackScope: this,
            loop: true
        });

        // 4. User's Character (Player)
        // Initial player position (bottom center)
        const initialPlayerX = this.scale.width / 2;
        const initialPlayerY = this.scale.height - 100;

        this.player = this.physics.add.sprite(initialPlayerX, initialPlayerY, 'player')
        .setScale(0.5) // 플레이어 이미지 크기 조정
        .setOrigin(0.5, 0.5);

        const radius = this.player.displayWidth * 0.7;
        const body = this.player.body as Phaser.Physics.Arcade.Body;
        body.setCircle(radius);
        body.setOffset(
            (this.player.displayWidth - radius * 2) / 2,
            (this.player.displayHeight - radius * 2) / 2
        );

        // Player's nickname text
        this.playerNameText = this.add
        .text(initialPlayerX, initialPlayerY - 30, this.playerNickname, {
            fontSize: '18px',
            color: '#000000',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold'
        })
        .setOrigin(0.5); // Center nickname above player

        // Keyboard input setup
        this.cursors = this.input.keyboard!.createCursorKeys();

        //tokens
        //토큰 개수 표시 ui
        const margin = 16;
        this.tokenCountText = this.add
        .text(this.scale.width - 100, margin, '먹은 토큰: 0', {
          fontSize: '16px', color: '#000'
        })
        .setOrigin(1, 0); // 오른쪽 상단에 위치
        //토큰 그룹 생성
        this.tokens = this.physics.add.group();

        // 초기에 maxTokens 개수만큼 랜덤 배치
        for (let i = 0; i < this.maxTokens; i++) {
          this.spawnToken();
        } 

        // 플레이어와 토큰 충돌/겹침 처리
       this.physics.add.overlap(
        this.player,
        this.tokens,
        this.handleCollectToken,
        undefined,
        this
    );
    }

    /** 화면 구석구석 랜덤 위치에 토큰 하나를 생성하거나 재배치 */
  private spawnToken() {
    const key = Phaser.Utils.Array.GetRandom(this.tokenKeys);
    const x = Phaser.Math.Between(50, this.scale.width  - 50);
    const y = Phaser.Math.Between(100, this.scale.height - 50);

    // 그룹에 생성
    const t = this.physics.add.sprite(x, y, key)
    .setScale(0.3) //토큰 크기 조절 
    .setOrigin(0.5);
    this.tokens.add(t);
    // t.body?.setImmovable(true); // 필요하면 고//정

    // 토큰도 반지름 16px 원형 바디로 설정
    const tr = 16;
    t.body.setCircle(tr);
    t.body.setOffset(t.displayWidth/2 - tr, t.displayHeight/2 - tr);
  }

  /** 플레이어가 토큰과 겹쳤을 때 호출 */
  private handleCollectToken(
    player: Phaser.Physics.Arcade.Sprite,
    token: Phaser.Physics.Arcade.Sprite
  ) {
    const p = player as Phaser.Physics.Arcade.Sprite;
    const t = token as Phaser.Physics.Arcade.Sprite;

    // 1) 기존 토큰 제거
    t.disableBody(true, true);

    // 2) 카운터 증가 및 UI 갱신
    this.tokenCount++;
    this.tokenCountText.setText(`먹은 토큰: ${this.tokenCount}`);

    // 3) 잠시 후 새 토큰 스폰
    this.time.delayedCall(500, () => {
      this.spawnToken();
    });
  }


    /**
     * Called every frame to update game logic.
     * @param time - The current game time.
     * @param delta - The time elapsed since the last frame.
     */
    update(time: number, delta: number) {
        // Player movement logic
        // Reset player velocity
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

        // delta 시간에 비례해서 이동 
        this.player.body.setVelocity(playerVelocityX, playerVelocityY);

        // 화면 밖으로 나가지 않도록 제한 
        this.player.x = Phaser.Math.Clamp(this.player.x, 20, this.scale.width - 20);
        this.player.y = Phaser.Math.Clamp(this.player.y, 20, this.scale.height - 20);

        //  닉네임 텍스트가 플레이어 위에 위치하도록 설정 
        this.playerNameText.setPosition(this.player.x, this.player.y - 30);
    }

    /**
     * Moves Younghee to a new random position within the screen,
     * making her disappear and reappear, along with her vision.
     */
    private moveYounghee() {
        // 영희 & 시야 숨기기 
        this.younghee.setVisible(false);
        this.youngheeVisionGraphics.setVisible(false);
        this.youngheeVisionLineGraphics.setVisible(false);

        // Generate new random position within screen bounds, avoiding edges
        // 영희가 화면 위쪽에만 나타나도록 Y 좌표 범위 설정
        const newX = Phaser.Math.Between(100, this.scale.width - 100);
        const newY = Phaser.Math.Between(150, this.scale.height / 2 - 50); 

        this.visionDistance  = Phaser.Math.Between(100, 300); // 300px~800px
        this.drawYoungheeVision(newX, newY);

        // 딜레이 후 영희 & 시야 재등장 
        this.time.delayedCall(200, () => { // 200ms for "뿅!" effect
          this.younghee.setPosition(newX, newY).setVisible(true);

          this.youngheeVisionGraphics.setVisible(true);
          this.youngheeVisionLineGraphics.setVisible(true);
        }, [], this);
    }

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
        const eyeY = youngheeY - (this.younghee.displayHeight / 2) + (this.younghee.displayHeight * 0.35)
        +40; 

        this.youngheeVisionGraphics
        .fillStyle(0xD5F2FF, 0.6)
        .fillCircle(eyeX, eyeY, this.visionDistance);

        this.youngheeVisionLineGraphics
        .strokeCircle(eyeX, eyeY, this.visionDistance);

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
            const config: Phaser.Types.Core.GameConfig = {
                type: Phaser.AUTO,
                // 게임의 내부 해상도를 더 작은 값으로 조정하여 100% 확대율에서 전체가 보이도록 합니다.
                // 800x600에서 720x540으로 추가 조정 (4:3 비율 유지)
                width: 720, 
                height: 540, 
                parent: gameRef.current,
                backgroundColor: '#F0F0F0', // Light grey background
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