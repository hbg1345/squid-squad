import React, { useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import './TitleScreen.css'

// 오징어 게임 스타일 시작 화면 씬
class SquidGameTitleScene extends Phaser.Scene {
  private shapes: Phaser.GameObjects.Graphics[] = []
  private titleText!: Phaser.GameObjects.Text
  private currentShapeIndex = 0
  private drawingPath: { x: number; y: number }[] = []
  private pathIndex = 0

  constructor() {
    super({ key: 'SquidGameTitleScene' })
  }

  create() {
    // 검은 배경
    this.cameras.main.setBackgroundColor('#000000')

    // 도형들 생성 (원, 삼각형, 사각형)
    const shapes = [
      { type: 'circle', x: 100, y: 100, size: 40 },
      { type: 'triangle', x: 200, y: 100, size: 40 },
      { type: 'square', x: 300, y: 100, size: 40 }
    ]

    shapes.forEach((shape, index) => {
      const graphics = this.add.graphics()
      graphics.lineStyle(6, 0x00ff00, 1) // 초록색 선
      
      switch (shape.type) {
        case 'circle':
          graphics.strokeCircle(shape.x, shape.y, shape.size)
          break
        case 'triangle':
          graphics.strokeTriangle(
            shape.x, shape.y - shape.size,
            shape.x - shape.size, shape.y + shape.size,
            shape.x + shape.size, shape.y + shape.size
          )
          break
        case 'square':
          graphics.strokeRect(shape.x - shape.size, shape.y - shape.size, shape.size * 2, shape.size * 2)
          break
      }
      
      this.shapes.push(graphics)
    })

    // 제목 텍스트 (처음에는 숨김)
    this.titleText = this.add.text(400, 300, 'SQUID SQUAD', {
      fontSize: '72px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold'
    }).setOrigin(0.5).setAlpha(0)

    // 애니메이션 시작
    this.startAnimation()
  }

  startAnimation() {
    // 1초 후 첫 번째 도형 애니메이션 시작
    this.time.delayedCall(1000, () => {
      this.animateShape(0)
    })
  }

  animateShape(shapeIndex: number) {
    if (shapeIndex >= this.shapes.length) {
      // 모든 도형 애니메이션 완료 후 텍스트 표시
      this.showTitleText()
      return
    }

    const shape = this.shapes[shapeIndex]
    const targetX = 400 + (shapeIndex - 1) * 120
    const targetY = 200

    // 도형을 목표 위치로 이동
    this.tweens.add({
      targets: shape,
      x: targetX,
      y: targetY,
      duration: 2500,
      ease: 'Power2',
      onComplete: () => {
        // 글씨 그리기 애니메이션 시작
        this.drawLetter(shapeIndex, () => {
          // 다음 도형으로
          this.animateShape(shapeIndex + 1)
        })
      }
    })
  }

  drawLetter(shapeIndex: number, onComplete: () => void) {
    const letters = ['S', 'Q', 'U', 'I', 'D', ' ', 'S', 'Q', 'U', 'A', 'D']
    const letter = letters[shapeIndex]
    
    if (!letter || letter === ' ') {
      onComplete()
      return
    }

    // 글씨 그리기 경로 정의
    const paths = this.getLetterPath(letter, shapeIndex)
    this.drawingPath = paths
    this.pathIndex = 0

    // 경로 따라 그리기
    this.drawPath(shapeIndex, onComplete)
  }

  getLetterPath(letter: string, index: number): { x: number; y: number }[] {
    const baseX = 400 + (index - 1) * 120
    const baseY = 200
    
    // 각 글씨의 그리기 경로
    switch (letter) {
      case 'S':
        return [
          { x: baseX - 25, y: baseY - 40 },
          { x: baseX + 25, y: baseY - 40 },
          { x: baseX + 25, y: baseY },
          { x: baseX - 25, y: baseY },
          { x: baseX - 25, y: baseY + 40 },
          { x: baseX + 25, y: baseY + 40 }
        ]
      case 'Q':
        return [
          { x: baseX - 25, y: baseY - 40 },
          { x: baseX + 25, y: baseY - 40 },
          { x: baseX + 25, y: baseY + 40 },
          { x: baseX - 25, y: baseY + 40 },
          { x: baseX - 25, y: baseY - 40 },
          { x: baseX + 15, y: baseY + 15 }
        ]
      case 'U':
        return [
          { x: baseX - 25, y: baseY - 40 },
          { x: baseX - 25, y: baseY + 40 },
          { x: baseX + 25, y: baseY + 40 },
          { x: baseX + 25, y: baseY - 40 }
        ]
      case 'I':
        return [
          { x: baseX, y: baseY - 40 },
          { x: baseX, y: baseY + 40 }
        ]
      case 'D':
        return [
          { x: baseX - 25, y: baseY - 40 },
          { x: baseX + 15, y: baseY - 40 },
          { x: baseX + 25, y: baseY - 25 },
          { x: baseX + 25, y: baseY + 25 },
          { x: baseX + 15, y: baseY + 40 },
          { x: baseX - 25, y: baseY + 40 },
          { x: baseX - 25, y: baseY - 40 }
        ]
      case 'A':
        return [
          { x: baseX, y: baseY - 40 },
          { x: baseX - 25, y: baseY + 40 },
          { x: baseX + 25, y: baseY + 40 },
          { x: baseX, y: baseY - 15 },
          { x: baseX - 20, y: baseY - 15 },
          { x: baseX + 20, y: baseY - 15 }
        ]
      default:
        return []
    }
  }

  drawPath(shapeIndex: number, onComplete: () => void) {
    if (this.pathIndex >= this.drawingPath.length) {
      onComplete()
      return
    }

    const point = this.drawingPath[this.pathIndex]
    const shape = this.shapes[shapeIndex]
    
    // 도형을 경로 포인트로 이동
    this.tweens.add({
      targets: shape,
      x: point.x,
      y: point.y,
      duration: 300,
      ease: 'Linear',
      onComplete: () => {
        this.pathIndex++
        this.drawPath(shapeIndex, onComplete)
      }
    })
  }

  showTitleText() {
    // 텍스트 페이드인 애니메이션
    this.tweens.add({
      targets: this.titleText,
      alpha: 1,
      duration: 3000,
      ease: 'Power2'
    })
  }
}

// React 컴포넌트
const TitleScreen: React.FC = () => {
  const gameRef = useRef<HTMLDivElement>(null)
  const gameInstance = useRef<Phaser.Game | null>(null)
  const [showStartButton, setShowStartButton] = useState(false)

  useEffect(() => {
    if (gameRef.current && !gameInstance.current) {
      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        width: 800,
        height: 600,
        parent: gameRef.current,
        scene: SquidGameTitleScene,
        backgroundColor: '#000000',
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH
        }
      }

      gameInstance.current = new Phaser.Game(config)

      // 애니메이션 완료 후 시작 버튼 표시
      setTimeout(() => {
        setShowStartButton(true)
      }, 12000) // 12초 후 완료
    }

    return () => {
      if (gameInstance.current) {
        gameInstance.current.destroy(true)
        gameInstance.current = null
      }
    }
  }, [])

  const handleStartGame = () => {
    alert('게임이 시작됩니다! 🦑')
    // 여기에 실제 게임 시작 로직 추가
  }

  return (
    <div className="title-screen">
      <div ref={gameRef} className="game-container" />
      
      {showStartButton && (
        <div className="start-button-container">
          <button 
            className="start-button"
            onClick={handleStartGame}
          >
            게임 시작
          </button>
        </div>
      )}
    </div>
  )
}

export default TitleScreen 