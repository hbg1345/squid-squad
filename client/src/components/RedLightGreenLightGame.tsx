import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import './RedLightGreenLight.css';
import { getSocket, disconnectSocket } from '../socket';
import { useNavigate, useLocation } from 'react-router-dom';
import AlphabetModal from './AlphabetModal';
import ChatBox from './ChatBox';
import GameDescriptionModal from './GameDescriptionModal';

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
    private socket = getSocket();
    private players: Map<string, Phaser.GameObjects.Sprite> = new Map();
    private playerNameTexts: Map<string, Phaser.GameObjects.Text> = new Map();
    private myId: string = '';
    private playerNickname: string = '';
    private youngheeListenerRegistered = false;
    private roomId: string = '';
    private myCharacter: string = 'player.png';

    private visionAngle: number     = 60;   // 콘의 벌어짐 각도 (°)
    private visionDirection: number = 270;  // 시야가 향하는 기본 방향 (°)
    private visionDistance: number  = 200;  // 맨 처음에 시야가 뻗어나가는 거리 (px) - 원 

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

    // 충돌 처리
    private pushKey!: Phaser.Input.Keyboard.Key | undefined;
    private pushRadius: number = 600; // 푸쉬 반경 (px)
    private pushStrength: number = 300; // 푸쉬 강도 (px/s) 

    private lastInputState: { left: boolean, right: boolean, up: boolean, down: boolean } = { left: false, right: false, up: false, down: false };

    constructor() {
        super({ key: 'RedLightGreenLightScene' });
    }

    /**
     * Initializes the scene with data passed from the React component.
     * @param data - Data object containing the player's nickname.
     */
    init(data: { playerNickname: string, roomId?: string, character?: string }) {
        const settingsData = this.sys.settings.data as { playerNickname?: string, roomId?: string, character?: string };
        const nickname = data?.playerNickname || settingsData?.playerNickname || '';
        const roomId = data?.roomId || settingsData?.roomId || '';
        const character = data?.character || settingsData?.character || 'player.png';
        this.playerNickname = nickname;
        this.roomId = roomId;
        this.myCharacter = character;
    }

    /**
     * Preloads assets required for the scene.
     */
    preload() {
        // 이미지 불러오기 
        this.load.image('background', '/background.png');
        this.load.image('younghee', '/younghee.png');
        // 모든 플레이어 캐릭터 이미지 로드
        this.load.image('player', '/player.png');
        this.load.image('player2', '/player2.png');
        this.load.image('player3', '/player3.png');
        this.load.image('player4', '/player4.png');
        this.load.image('player5', '/player5.png');
        this.load.image('token1', '/token1.png');
        this.load.image('token2', '/token2.png');
    }

    /**
     * Called once when the scene is created and ready to be displayed.
     */
    create() {
        this.myId = this.socket.id ?? '';
        this.socket.emit('joinGame', { roomId: this.roomId, nickname: this.playerNickname, character: this.myCharacter });

        // 화면 크기를 기준으로 월드 크기 설정 (예: 가로 2배, 세로 1.5배)
        const worldWidth = this.scale.width * 1;
        const worldHeight = this.scale.height * 1;

        // Add background image and set world bounds
        this.add.image(0, 0, 'background').setOrigin(0, 0).setDisplaySize(worldWidth, worldHeight);
        this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
        
        // Set camera bounds
        this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

        // Set a light grey background color as in the image
        // this.cameras.main.setBackgroundColor('#F0F0F0');

        // 1. Current Survivors Display
        this.survivorText = this.add.text(this.scale.width / 2, 50, '현재 생존자: 200/456', {
            fontSize: '32px',
            color: '#000000',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0); // Center horizontally, fixed to screen

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
                    // 모든 플레이어 info.character 사용
                    let spriteKey = (info.character || 'player').replace('.png', '');
                    const sprite = this.physics.add.sprite(info.x, info.y, spriteKey)
                        .setScale(0.5)
                        .setOrigin(0.5, 0.5);
                    const pr = sprite.displayWidth * 0.7; //player 충돌체의 반지름 
                    sprite.body.setCircle(pr);
                    sprite.body.setOffset(0,0);
                    this.players.set(id, sprite);
                    // 닉네임 텍스트
                    const nameText = this.add.text(info.x, info.y - 50, info.nickname, {
                        fontSize: '18px',
                        color: '#000000',
                        fontFamily: 'Arial, sans-serif',
                        fontStyle: 'bold'
                    }).setOrigin(0.5 , 0.5);
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
                    nameText.setPosition(
                        sprite.x,
                        sprite.y - sprite.displayHeight/2 - nameText.height - 2); //2px 여백 추가 
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
            const tradius = t.displayWidth * 0.5;
            t.setData('id', token.id);
            t.body.setCircle(tradius); //토큰 충돌체의 반지름름
            t.body.setOffset(0,0);
            this.tokens.add(t);
          });
        });

        // Keyboard input setup
        this.cursors = this.input.keyboard!.createCursorKeys();
        // 키 입력 상태 추적용
        this.input.keyboard!.on('keydown', this.handleKeyInput, this);
        this.input.keyboard!.on('keyup', this.handleKeyInput, this);

        //tokens
        // 토큰 개수 표시 ui
        const margin = 16;
        this.tokenCountText = this.add
          .text(this.scale.width - 100, margin, '먹은 토큰: 0', {
            fontSize: '16px', color: '#000'
          })
          .setOrigin(1, 0)
          .setScrollFactor(0); // 오른쪽 상단에 위치, fixed to screen
        // 토큰 그룹 생성
        this.tokens = this.physics.add.group();

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

        // 푸쉬 키 설정 - space key를 누를 때 
        this.pushKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.socket.on('playerPush', (data: { from: string; ux: number; uy: number; strength: number}) => {
            const pushed = this.players.get(data.from);
            if (pushed) {
                (pushed.body as Phaser.Physics.Arcade.Body).setVelocity(
                    data.ux * data.strength, 
                    data.uy * data.strength
                );
            }
        });
        this.socket.on('playerPushed', ({ id, x, y }) => {
            const sprite = this.players.get(id);
            if (sprite) {
                sprite.x = x;
                sprite.y = y;
            }
        });
    }

    /** 플레이어가 토큰과 겹쳤을 때 호출 */
    private handleCollectToken: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (
        player, token
    ) => {
      const t = token as Phaser.Physics.Arcade.Sprite;
      const tokenId = t.getData('id');
      if (typeof tokenId === 'number') {
        // 서버에 토큰 먹기 알림
        this.socket.emit('collectToken', { roomId: this.roomId, tokenId });
        // 내 토큰 카운트만 증가
        this.tokenCount++;
        this.tokenCountText.setText(`먹은 토큰: ${this.tokenCount}`);
        // React state와 연동
        if (typeof window !== 'undefined' && (window as any).onCollectToken) {
          (window as any).onCollectToken();
        }
      }
    }

    /**
     * Handles keyboard input events for movement and emits to server if changed
     */
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
            this.lastInputState = { ...input };
        }
    }

    /**
     * Younghee의 시야(원형) 안에 플레이어가 있는지 판정
     */
    private isInYoungheeVision(x: number, y: number): boolean {
        if (!this.younghee || !this.younghee.displayHeight || !this.younghee.texture) return false;
        const eyeX = this.younghee.x;
        const eyeY = this.younghee.y - (this.younghee.displayHeight / 2) + (this.younghee.displayHeight * 0.35) + 40;
        const dx = x - eyeX;
        const dy = y - eyeY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance <= this.visionDistance;
    }

    /**
     * Called every frame to update game logic.
     * @param time - The current game time.
     * @param delta - The time elapsed since the last frame.
     */
    update(time: number, delta: number) {
        // 이 로그는 이미 동작하는 것을 확인했습니다.
        // console.log('update called');
        if (!this.myId || !this.players.get(this.myId)) return;

        // --- 밀치기 기능 디버깅 ---
        if (this.pushKey && Phaser.Input.Keyboard.JustDown(this.pushKey)) {
            const mySprite = this.players.get(this.myId)!;
            let collisionDetected = false;

            this.players.forEach((otherSprite, id) => {
                if (id === this.myId) return;

                const dist = Phaser.Math.Distance.Between(mySprite.x, mySprite.y, otherSprite.x, otherSprite.y);
                const myRadius = mySprite.displayWidth * 0.5;
                const otherRadius = otherSprite.displayWidth * 0.7;
                const requiredDist = myRadius + otherRadius + 30; // 충돌 인식 거리 조절 (30px)

                if (dist <= requiredDist) {
                    collisionDetected = true;
                    const dirs = [
                        { dx: 0, dy: -1 }, // up
                        { dx: 0, dy: 1 },  // down
                        { dx: -1, dy: 0 }, // left
                        { dx: 1, dy: 0 },  // right
                    ];
                    const dir = Phaser.Math.RND.pick(dirs);
                    this.socket.emit('playerPush', { id, dx: dir.dx, dy: dir.dy });
                }
            });

            if (!collisionDetected) {
            }
        }
        // --- 디버깅 끝 ---


        // --- 기존 update 로직 (그대로 두세요) ---
        const mySprite = this.players.get(this.myId);
        if (!mySprite) return;
        // 입력 상태 체크 및 emit
        const input = {
            left: this.cursors.left.isDown,
            right: this.cursors.right.isDown,
            up: this.cursors.up.isDown,
            down: this.cursors.down.isDown
        };
        const isMoving = input.left || input.right || input.up || input.down;
        const inVision = this.isInYoungheeVision(mySprite.x, mySprite.y);
        const now = Date.now();
        const invincibleUntil = (typeof window !== 'undefined' && (window as any).getInvincibleUntil)
            ? (window as any).getInvincibleUntil() : 0;
        if (now < invincibleUntil) {
            // 무적 상태: 시야 판정 무시
        } else {
        if (inVision) {
            if (isMoving) {
                // 서버에 죽음 알림
                this.socket.emit('playerDead', { roomId: this.roomId });
                // React로 dead phase 전달
                if (typeof window !== 'undefined' && (window as any).onDeadByYounghee) {
                    (window as any).onDeadByYounghee();
                }
                return; // 더 이상 update 진행 X
            } else {
                // 움직이지 않고 시야에 닿아있으면 모달 요청
                if (typeof window !== 'undefined' && (window as any).onShowAlphabetModal) {
                    (window as any).onShowAlphabetModal();
                }
            }
        }
        }
        this.playerNameTexts.forEach((nameText, id) => {
            const sprite = this.players.get(id);
            if (sprite) {
                nameText.setPosition(sprite.x, sprite.y - sprite.displayHeight / 2 - nameText.height - 2);
            }
        });
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
    const gameRef = useRef<HTMLDivElement>(null);
    const gameInstance = useRef<Phaser.Game | null>(null);
    const navigate = useNavigate();
    const location = useLocation();
    const selectedCharacter = location.state?.character || 'player.png';

    // 제한 시간 및 phase 상태 추가
    const [phase, setPhase] = useState<'waiting' | 'dead' | 'survived' | 'playing'>('waiting');
    const [timer, setTimer] = useState(10);
    const [tokenCount, setTokenCount] = useState(0);
    const [showAlphabetModal, setShowAlphabetModal] = useState(false);
    const [invincibleUntil, setInvincibleUntil] = useState(0);
    const [isChatting, setIsChatting] = useState(false);
    const [isDescribing, setIsDescribing] = useState(true);
    const [isGameStarted, setIsGameStarted] = useState(false);

    // 모달 표시 및 준비 완료 신호 전송
    useEffect(() => {
        // 이 부분의 숫자를 조절하여 모달이 떠 있는 시간을 변경할 수 있습니다. (1000 = 1초)
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

    // 타이머 감소 로직
    useEffect(() => {
        if (phase === 'waiting' && isGameStarted) {
            let last = Date.now();
            const id = setInterval(() => {
                const now = Date.now();
                const diff = (now - last) / 1000;
                last = now;
                setTimer(t => Math.max(0, t - diff));
            }, 50);
            return () => clearInterval(id);
        }
    }, [phase, isGameStarted]);

    // 타이머가 0이 되면 토큰 개수에 따라 phase 분기
    useEffect(() => {
        if (phase === 'waiting' && timer <= 0) {
            if (tokenCount >= 1) {
                setPhase('survived');
            } else {
                // 제한시간 초과로 죽는 경우: 즉시 서버에 playerDead 전송
                const socket = getSocket();
                socket.emit('playerDead', { roomId });
                setPhase('dead');
            }
        }
    }, [phase, timer, tokenCount, roomId]);

    // survived가 되면 서버에 알림
    useEffect(() => {
      if (phase === 'survived') {
        const socket = getSocket();
        socket.emit('survived', { roomId, nickname: playerNickname });
      }
    }, [phase, roomId, playerNickname]);

    // 서버에서 phaseChange 이벤트를 받으면 /game2로 이동
    useEffect(() => {
      const socket = getSocket();
      const handler = ({ phase, players, roomId: eventRoomId }: { phase: string, players: any[], roomId: string }) => {
        // 현재 방과 일치하는 이벤트에만 반응
        if (phase === 'pair' && eventRoomId === roomId) {
          navigate('/game2', { state: { roomId, players, playerNickname } });
        }
      };
      socket.on('phaseChange', handler);
      return () => {
        socket.off('phaseChange', handler);
      };
    }, [navigate, roomId, playerNickname]);

    // survived phase가 되면 PairGameScreen(/game2)으로 이동
    useEffect(() => {
        if (phase === 'survived') {
            navigate('/game2', { state: { roomId, playerNickname } });
        }
    }, [phase, navigate, roomId, playerNickname]);

    // dead phase가 되면 자동으로 타이틀로 이동 + Phaser 인스턴스 안전 파괴 (중복 방지)
    const alreadyDead = useRef(false);
    useEffect(() => {
        if (phase === 'dead' && !alreadyDead.current) {
            alreadyDead.current = true;
            if (gameInstance.current) {
                gameInstance.current.destroy(true);
                gameInstance.current = null;
            }
            disconnectSocket(); // 소켓 연결 해제
            onGoBack();
        }
        if (phase !== 'dead') {
            alreadyDead.current = false;
        }
    }, [phase, onGoBack]);

    useEffect(() => {
        if (gameInstance.current && gameInstance.current.input && gameInstance.current.input.keyboard) {
            gameInstance.current.input.keyboard.enabled = !isChatting;
        }
    }, [isChatting]);

    // phase가 바뀔 때마다 타이머/토큰 초기화 (dead->waiting 등)
    useEffect(() => {
        if (phase === 'waiting') {
            setTimer(10);
            setTokenCount(0);
        }
    }, [phase]);

    // 토큰을 먹을 때 tokenCount 증가 (Phaser와 React 연결)
    // window에 콜백을 등록해서 Phaser에서 호출하도록 연결
    useEffect(() => {
        (window as any).onCollectToken = () => setTokenCount(c => c + 1);
        (window as any).onDeadByYounghee = () => setPhase('dead');
        (window as any).onShowAlphabetModal = () => setShowAlphabetModal(true);
        (window as any).getInvincibleUntil = () => invincibleUntil;
        return () => { 
            delete (window as any).onCollectToken;
            delete (window as any).onDeadByYounghee;
            delete (window as any).onShowAlphabetModal;
            delete (window as any).getInvincibleUntil;
        };
    }, [invincibleUntil]);

    useEffect(() => {
        if (gameRef.current) {
            gameRef.current.tabIndex = 0;
            gameRef.current.focus();
        }
        if (!gameInstance.current) {
            const config: Phaser.Types.Core.GameConfig = {
                type: Phaser.AUTO,
                width: '100%',
                height: '100%',
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
                    gameInstance.current.scene.start('RedLightGreenLightScene', { playerNickname, roomId, character: selectedCharacter });
                }
            }, 100);
        } else {
            // Phaser 인스턴스가 이미 있으면 scene.stop 후 scene.start
            gameInstance.current.scene.stop('RedLightGreenLightScene');
            gameInstance.current.scene.start('RedLightGreenLightScene', { playerNickname, roomId, character: selectedCharacter });
        }
        return () => {
            const socket = getSocket();
            socket.off('gameState');
            socket.off('youngheeUpdate');
            socket.off('tokensUpdate');
            if (gameInstance.current) {
                gameInstance.current.destroy(true);
                gameInstance.current = null;
            }
        };
    }, [playerNickname, roomId, selectedCharacter]); 

    const handleGoBack = () => {
        onGoBack();
    };

    // AlphabetModal 성공 시 무적 3초
    const handleAlphabetSuccess = () => {
        setShowAlphabetModal(false);
        setInvincibleUntil(Date.now() + 3000); // 3초 무적
    };

    // AlphabetModal 실패 시 죽음: 즉시 서버에 playerDead 전송
    const handleAlphabetFail = () => {
        const socket = getSocket();
        socket.emit('playerDead', { roomId });
        setPhase('dead');
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
            <GameDescriptionModal
              isOpen={isDescribing}
              title="무궁화 꽃이 피었습니다"
              description={[
                "술래가 뒤를 돌아볼 때 움직이면 탈락합니다.",
                "술래의 시야에 닿으면 미니게임을 진행해야 합니다.",
                "제한 시간 내에 20개의 토큰 중 1개 이상을 획득하여",
                "탈출하세요.",
              ]}
            />
            {!isDescribing && !isGameStarted && (
                 <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'white', fontSize: '24px', zIndex: 4000, pointerEvents: 'none' }}>
                    다른 플레이어를 기다리는 중...
                </div>
            )}
            {timerUI}
            {/* 채팅창 */}
            {roomId && (
                <ChatBox 
                    roomId={roomId} 
                    playerNickname={playerNickname || '익명'} 
                    onFocus={() => setIsChatting(true)}
                    onBlur={() => setIsChatting(false)}
                />
            )}
            {/* Container where the Phaser game will be rendered */}
            {phase !== 'dead' && (
                <div ref={gameRef} className="game-container" />
            )}
            <AlphabetModal
                isOpen={showAlphabetModal}
                onClose={() => setShowAlphabetModal(false)}
                onSuccess={handleAlphabetSuccess}
                onFail={handleAlphabetFail}
            />
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