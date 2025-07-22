import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import './TitleScreen.css';
import { useNavigate } from 'react-router-dom';

// Squid Game style title screen scene
class SquidGameTitleScene extends Phaser.Scene {
    // Callback function to notify the React component when the animation is complete
    private onAnimationCompleteCallback: (() => void) | undefined;
    // Array of Phaser Graphics objects used to draw shapes (circle, triangle, square)
    private shapeGraphics: Phaser.GameObjects.Graphics[] = [];
    // Array of Phaser Graphics objects used to draw the "SQUID SQUAD" text
    private textGraphics: Phaser.GameObjects.Graphics[] = [];
    // The pink color theme of Squid Game (hexadecimal)
    private pinkColor = 0xff2a7f;

    constructor() {
        super({ key: 'SquidGameTitleScene' });
    }

    /**
     * Initializes the scene with data passed from the React component.
     * @param data - Data object containing the onAnimationComplete callback.
     */
    init(data: { onAnimationComplete: () => void }) {
        this.onAnimationCompleteCallback = data.onAnimationComplete;
    }

    /**
     * Called once when the scene is created and ready to be displayed.
     */
    create() {
        // Set the background color of the game camera to black.
        this.cameras.main.setBackgroundColor('#000000');

        // Initialize graphics objects for drawing shapes.
        // These shapes will fade out after their animation.
        const circleGraphics = this.add.graphics();
        const triangleGraphics = this.add.graphics();
        const squareGraphics = this.add.graphics();
        this.shapeGraphics.push(circleGraphics, triangleGraphics, squareGraphics);

        // Initialize graphics object for drawing text.
        // All text will be drawn on this single graphics object.
        const mainTextGraphics = this.add.graphics();
        this.textGraphics.push(mainTextGraphics);

        // Start the overall animation sequence.
        this.startAnimationSequence();
    }

    /**
     * Animates drawing a line along a given path.
     * @param graphics - The Phaser Graphics object to draw on.
     * @param pathPoints - An array of points defining the path.
     * @param color - The color of the line (hexadecimal).
     * @param lineWidth - The thickness of the line.
     * @param duration - The total duration of the drawing animation for the entire path (milliseconds).
     * @param delay - The delay before starting this animation (milliseconds).
     * @param onCompleteCallback - Callback function to execute after the animation completes.
     */
    private drawPathAnimated(
        graphics: Phaser.GameObjects.Graphics,
        pathPoints: { x: number, y: number }[],
        color: number,
        lineWidth: number,
        duration: number,
        delay: number,
        onCompleteCallback?: () => void
    ) {
        // If there are not enough points to draw a line, call the complete callback immediately.
        if (pathPoints.length < 2) {
            onCompleteCallback?.();
            return;
        }

        let currentSegmentIndex = 0;
        let totalSegments = pathPoints.length - 1;
        // Calculate the duration for drawing each individual segment of the path.
        let segmentDuration = duration / totalSegments;

        const drawNextSegment = () => {
            // If all segments have been drawn, call the complete callback.
            if (currentSegmentIndex >= totalSegments) {
                onCompleteCallback?.();
                return;
            }

            const p1 = pathPoints[currentSegmentIndex];
            const p2 = pathPoints[currentSegmentIndex + 1];

            // Create a temporary graphics object to animate the current segment.
            // This ensures that previous segments remain drawn while the current one animates.
            const tempGraphics = this.add.graphics({ lineStyle: { width: lineWidth, color: color } });
            tempGraphics.beginPath();
            tempGraphics.moveTo(p1.x, p1.y);
            tempGraphics.lineTo(p1.x, p1.y); // Initial length is 0

            // Animate a dummy object to get the intermediate coordinates for drawing.
            this.tweens.add({
                targets: { x: p1.x, y: p1.y },
                x: p2.x,
                y: p2.y,
                duration: segmentDuration, // Duration for drawing this single segment.
                ease: 'Linear', // Linear easing for a smooth drawing effect.
                onUpdate: (tween) => {
                    const target = tween.targets[0] as { x: number, y: number };
                    // Clear the temporary graphics and redraw the current segment up to the current tween position.
                    tempGraphics.clear();
                    tempGraphics.lineStyle(lineWidth, color);
                    tempGraphics.beginPath();
                    tempGraphics.moveTo(p1.x, p1.y);
                    tempGraphics.lineTo(target.x, target.y);
                    tempGraphics.strokePath();
                },
                onComplete: () => {
                    // Once the segment animation is complete, draw it permanently on the main graphics object.
                    graphics.lineStyle(lineWidth, color);
                    graphics.beginPath();
                    graphics.moveTo(p1.x, p1.y);
                    graphics.lineTo(p2.x, p2.y);
                    graphics.strokePath();
                    tempGraphics.destroy(); // Destroy the temporary graphics object.

                    currentSegmentIndex++;
                    drawNextSegment(); // Proceed to draw the next segment.
                }
            });
        };

        // Start drawing the first segment after the specified delay.
        this.time.delayedCall(delay, drawNextSegment);
    }

    /**
     * Defines and returns the drawing paths for the circle, triangle, and square shapes.
     */
    private getShapePaths() {
        const centerX = this.scale.width / 2; // X-coordinate of the screen center.
        const startY = this.scale.height / 2 - 150; // Y-coordinate for the shapes (slightly above center).
        const size = 60; // Base size for the shapes.

        // Define points for drawing a circle.
        const circlePoints: { x: number, y: number }[] = [];
        const circleSegments = 36; // Number of segments to draw the circle (higher for smoother circle).
        for (let i = 0; i <= circleSegments; i++) {
            const angle = (i * Math.PI * 2) / circleSegments;
            circlePoints.push({
                x: centerX + Math.cos(angle) * size,
                y: startY + Math.sin(angle) * size
            });
        }

        // Define points for drawing a triangle.
        const trianglePoints = [
            { x: centerX, y: startY + 150 - size }, // Top vertex
            { x: centerX - size, y: startY + 150 + size }, // Bottom-left vertex
            { x: centerX + size, y: startY + 150 + size }, // Bottom-right vertex
            { x: centerX, y: startY + 150 - size } // Back to top vertex to close the path
        ];

        // Define points for drawing a square.
        const squarePoints = [
            { x: centerX - size, y: startY + 300 - size }, // Top-left
            { x: centerX + size, y: startY + 300 - size }, // Top-right
            { x: centerX + size, y: startY + 300 + size }, // Bottom-right
            { x: centerX - size, y: startY + 300 + size }, // Bottom-left
            { x: centerX - size, y: startY + 300 - size } // Back to top-left to close the path
        ];

        return { circlePoints, trianglePoints, squarePoints };
    }

    /**
     * Defines and returns the path segments for drawing a given letter.
     * Each letter might be composed of multiple line segments.
     * @param letter - The character to draw (e.g., 'S', 'Q').
     * @param baseX - The base X-coordinate for the letter.
     * @param baseY - The base Y-coordinate for the letter.
     */
    private getLetterPaths(letter: string, baseX: number, baseY: number): { x: number, y: number }[][] {
        const letterWidth = 70; // Reference width for a letter.
        const letterHeight = 100; // Reference height for a letter.
        const halfWidth = letterWidth / 2;
        const halfHeight = letterHeight / 2;

        switch (letter) {
            case 'S':
                return [
                    [{ x: baseX + halfWidth, y: baseY - halfHeight }, { x: baseX - halfWidth, y: baseY - halfHeight }], // Top horizontal
                    [{ x: baseX - halfWidth, y: baseY - halfHeight }, { x: baseX - halfWidth, y: baseY }], // Top-left vertical
                    [{ x: baseX - halfWidth, y: baseY }, { x: baseX + halfWidth, y: baseY }], // Middle horizontal
                    [{ x: baseX + halfWidth, y: baseY }, { x: baseX + halfWidth, y: baseY + halfHeight }], // Bottom-right vertical
                    [{ x: baseX + halfWidth, y: baseY + halfHeight }, { x: baseX - halfWidth, y: baseY + halfHeight }] // Bottom horizontal
                ];
            case 'Q':
                return [
                    // Circular part (simplified path)
                    [{ x: baseX, y: baseY - halfHeight }, { x: baseX + halfWidth, y: baseY - halfHeight }, { x: baseX + halfWidth, y: baseY + halfHeight }, { x: baseX, y: baseY + halfHeight }, { x: baseX - halfWidth, y: baseY + halfHeight }, { x: baseX - halfWidth, y: baseY - halfHeight }, { x: baseX, y: baseY - halfHeight }],
                    // Tail part
                    [{ x: baseX + halfWidth / 2, y: baseY + halfHeight / 2 }, { x: baseX + halfWidth + 10, y: baseY + halfHeight + 10 }]
                ];
            case 'U':
                return [
                    [{ x: baseX - halfWidth, y: baseY - halfHeight }, { x: baseX - halfWidth, y: baseY + halfHeight }], // Left vertical
                    [{ x: baseX - halfWidth, y: baseY + halfHeight }, { x: baseX + halfWidth, y: baseY + halfHeight }], // Bottom horizontal
                    [{ x: baseX + halfWidth, y: baseY + halfHeight }, { x: baseX + halfWidth, y: baseY - halfHeight }] // Right vertical
                ];
            case 'I':
                return [
                    [{ x: baseX - halfWidth / 2, y: baseY - halfHeight }, { x: baseX + halfWidth / 2, y: baseY - halfHeight }], // Top horizontal
                    [{ x: baseX, y: baseY - halfHeight }, { x: baseX, y: baseY + halfHeight }], // Central vertical
                    [{ x: baseX - halfWidth / 2, y: baseY + halfHeight }, { x: baseX + halfWidth / 2, y: baseY + halfHeight }] // Bottom horizontal
                ];
            case 'D':
                return [
                    [{ x: baseX - halfWidth, y: baseY - halfHeight }, { x: baseX - halfWidth, y: baseY + halfHeight }], // Left vertical
                    [{ x: baseX - halfWidth, y: baseY + halfHeight }, { x: baseX + halfWidth / 2, y: baseY + halfHeight }], // Bottom curve start
                    [{ x: baseX + halfWidth / 2, y: baseY + halfHeight }, { x: baseX + halfWidth, y: baseY }], // Right curve
                    [{ x: baseX + halfWidth, y: baseY }, { x: baseX + halfWidth / 2, y: baseY - halfHeight }], // Right curve
                    [{ x: baseX + halfWidth / 2, y: baseY - halfHeight }, { x: baseX - halfWidth, y: baseY - halfHeight }] // Top curve end
                ];
            case 'A':
                return [
                    [{ x: baseX, y: baseY - halfHeight }, { x: baseX - halfWidth, y: baseY + halfHeight }], // Left diagonal
                    [{ x: baseX, y: baseY - halfHeight }, { x: baseX + halfWidth, y: baseY + halfHeight }], // Right diagonal
                    [{ x: baseX - halfWidth / 2, y: baseY + halfHeight / 2 }, { x: baseX + halfWidth / 2, y: baseY + halfHeight / 2 }] // Middle horizontal
                ];
            default:
                return [];
        }
    }

    /**
     * Manages the overall animation sequence:
     * Draw shapes -> Fade out shapes -> Draw text.
     */
    private startAnimationSequence() {
        const { circlePoints, trianglePoints, squarePoints } = this.getShapePaths();
        const [circleGraphics, triangleGraphics, squareGraphics] = this.shapeGraphics;

        // --- Variables for adjusting shape drawing speed ---
        const shapeDrawingDuration = 500; // Duration for drawing each shape (milliseconds) - Decrease for faster drawing.
        const delayBetweenShapes = 300; // Delay before starting each shape drawing (milliseconds) - Decrease for more continuous drawing.
        // -------------------------------------------------
        const fadeOutDuration = 700; // Duration for shapes to fade out (milliseconds).

        // 1. Animate drawing the circle.
        this.drawPathAnimated(circleGraphics, circlePoints, this.pinkColor, 8, shapeDrawingDuration, 0, () => {
            // 2. Animate drawing the triangle (after circle and a delay).
            this.drawPathAnimated(triangleGraphics, trianglePoints, this.pinkColor, 8, shapeDrawingDuration, delayBetweenShapes, () => {
                // 3. Animate drawing the square (after triangle and a delay).
                this.drawPathAnimated(squareGraphics, squarePoints, this.pinkColor, 8, shapeDrawingDuration, delayBetweenShapes, () => {
                    // 4. Animate fading out all shapes.
                    this.tweens.add({
                        targets: this.shapeGraphics,
                        alpha: 0, // Set transparency to 0 to make them disappear.
                        duration: fadeOutDuration,
                        ease: 'Power2', // Smooth deceleration effect.
                        onComplete: () => {
                            // 5. After shapes fade out, start drawing the "SQUID SQUAD" text.
                            this.drawSquidSquadText();
                        }
                    });
                });
            });
        });
    }

    /**
     * Manages the sequence for drawing "SQUID SQUAD" text in two lines.
     * All letters start drawing almost simultaneously with a slight stagger.
     */
    private drawSquidSquadText() {
        const lines = ['SQUID', 'SQUAD']; // The text to draw, split into two lines.
        const centerX = this.scale.width / 2; // X-coordinate of the screen center.
        const centerY = this.scale.height / 2; // Y-coordinate of the screen center.
        const letterSpacing = 90; // Horizontal spacing between letters.
        const lineHeightOffset = 70; // Vertical offset between the two lines (relative to centerY).

        // --- Variables for adjusting text drawing speed ---
        // Duration for drawing each segment of a letter (milliseconds) - Decrease for faster drawing.
        const letterSegmentDuration = 300
        // Slight delay before starting each letter's drawing (milliseconds) - 0 for truly simultaneous, increase for a staggered effect.
        const staggerDelayPerLetter = 7;
        // -------------------------------------------------

        let allSegmentsToAnimate: { path: { x: number, y: number }[], delay: number }[] = [];
        let globalLetterIndex = 0; // Global index for all letters (used for stagger delay calculation).

        // Collect all path segments for all letters and calculate their start delays.
        lines.forEach((currentLine, lineIndex) => {
            const lettersInCurrentLine = currentLine.replace(/\s/g, '').length;
            const currentLineTotalWidth = (lettersInCurrentLine - 1) * letterSpacing;
            const currentLineStartX = centerX - currentLineTotalWidth / 2;
            const baseY = (lineIndex === 0) ? centerY - lineHeightOffset : centerY + lineHeightOffset;

            currentLine.split('').forEach((letter, letterIndexInLine) => {
                if (letter === ' ') return; // Skip spaces.

                const baseX = currentLineStartX + letterIndexInLine * letterSpacing;
                const letterPaths = this.getLetterPaths(letter, baseX, baseY);

                letterPaths.forEach(pathSegments => {
                    // Each letter's first segment will start after a delay based on its global index.
                    allSegmentsToAnimate.push({
                        path: pathSegments,
                        delay: globalLetterIndex * staggerDelayPerLetter
                    });
                });
                globalLetterIndex++; // Increment global letter index for the next letter.
            });
        });

        let segmentsCompleted = 0;
        const totalSegments = allSegmentsToAnimate.length;

        // If there are no segments to draw, call the complete callback immediately.
        if (totalSegments === 0) {
            this.onAnimationCompleteCallback?.();
            return;
        }

        // Start animating all collected segments.
        allSegmentsToAnimate.forEach(segmentInfo => {
            this.drawPathAnimated(
                this.textGraphics[0], // Draw all text on the same graphics object.
                segmentInfo.path,
                this.pinkColor,
                8, // Line width.
                letterSegmentDuration, // Duration for drawing this letter segment.
                segmentInfo.delay, // Stagger delay for this segment.
                () => {
                    segmentsCompleted++;
                    // Once all segments are completed, call the animation complete callback.
                    if (segmentsCompleted === totalSegments) {
                        this.onAnimationCompleteCallback?.();
                    }
                }
            );
        });
    }
}


const TitleScreen: React.FC = () => {
    const gameRef = useRef<HTMLDivElement>(null);
    const gameInstance = useRef<Phaser.Game | null>(null);
    const [showStartButton, setShowStartButton] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (gameRef.current && !gameInstance.current) {
            const config: Phaser.Types.Core.GameConfig = {
                type: Phaser.AUTO,
                width: '100%',
                height: '100%',
                parent: gameRef.current,
                backgroundColor: '#000000',
                scale: {
                    mode: Phaser.Scale.FIT,
                    autoCenter: Phaser.Scale.CENTER_BOTH
                },
                scene: SquidGameTitleScene
            };

            gameInstance.current = new Phaser.Game(config);

            setTimeout(() => {
                setShowStartButton(true);
            }, 3000);
        }

        return () => {
            if (gameInstance.current) {
                gameInstance.current.destroy(true);
                gameInstance.current = null;
            }
        };
    }, []);

    const handleNavigateToNickname = () => {
        navigate('/nickname');
    };

    return (
        <div className="title-screen">
            <div ref={gameRef} className="game-container" />

            {showStartButton && (
                <div className="start-button-container">
                    <button
                        className="start-button"
                        onClick={handleNavigateToNickname}
                    >
                        Start Game
                    </button>
                </div>
            )}
        </div>
    );
};

export default TitleScreen;