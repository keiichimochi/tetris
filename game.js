// ゲームの設定
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const COLORS = [
    0xff0000, 0x00ff00, 0x0000ff, 0xffff00,
    0xff00ff, 0x00ffff, 0xff8800
];

// 音声要素
const bgm = document.getElementById('bgm');
const moveSound = document.getElementById('moveSound');
const rotateSound = document.getElementById('rotateSound');
const dropSound = document.getElementById('dropSound');
const clearSound = document.getElementById('clearSound');
const gameOverSound = document.getElementById('gameOverSound');

// 音量コントロール
const bgmVolume = document.getElementById('bgmVolume');
const sfxVolume = document.getElementById('sfxVolume');

bgmVolume.addEventListener('input', () => {
    bgm.volume = bgmVolume.value;
});

sfxVolume.addEventListener('input', () => {
    const volume = sfxVolume.value;
    moveSound.volume = volume;
    rotateSound.volume = volume;
    dropSound.volume = volume;
    clearSound.volume = volume;
    gameOverSound.volume = volume;
});

// 初期音量設定
bgm.volume = bgmVolume.value;
moveSound.volume = sfxVolume.value;
rotateSound.volume = sfxVolume.value;
dropSound.volume = sfxVolume.value;
clearSound.volume = sfxVolume.value;
gameOverSound.volume = sfxVolume.value;

// テトリミノの形状
const SHAPES = [
    [[1, 1, 1, 1]], // I
    [[1, 1], [1, 1]], // O
    [[1, 1, 1], [0, 1, 0]], // T
    [[1, 1, 1], [1, 0, 0]], // L
    [[1, 1, 1], [0, 0, 1]], // J
    [[1, 1, 0], [0, 1, 1]], // S
    [[0, 1, 1], [1, 1, 0]]  // Z
];

// ゲームステート
let score = 0;
let level = 1;
let gameBoard = Array(ROWS).fill().map(() => Array(COLS).fill(0));
let currentPiece = null;
let nextPiece = null;
let gameLoop = null;
let isGameRunning = false;
let lastDropTime = 0;
let dropInterval = 1000;
let softDropping = false;

// PIXIアプリケーションの設定
const app = new PIXI.Application({
    width: COLS * BLOCK_SIZE,
    height: ROWS * BLOCK_SIZE,
    view: document.getElementById('gameCanvas'),
    backgroundColor: 0x000000,
    antialias: true
});

const nextPieceApp = new PIXI.Application({
    width: 4 * BLOCK_SIZE,
    height: 4 * BLOCK_SIZE,
    view: document.getElementById('nextPieceCanvas'),
    backgroundColor: 0x000000,
    antialias: true
});

// ゲームコンテナ
const gameContainer = new PIXI.Container();
app.stage.addChild(gameContainer);

// パーティクルコンテナ
const particleContainer = new PIXI.Container();
app.stage.addChild(particleContainer);

// 背景エフェクト
const backgroundEffects = new PIXI.Container();
app.stage.addChildAt(backgroundEffects, 0);

function createBackgroundEffect() {
    const effect = new PIXI.Graphics();
    effect.lineStyle(2, COLORS[Math.floor(Math.random() * COLORS.length)], 0.5);
    effect.drawRect(0, 0, app.screen.width, app.screen.height);
    backgroundEffects.addChild(effect);

    gsap.to(effect, {
        alpha: 0,
        duration: 1,
        ease: "power2.out",
        onComplete: () => {
            backgroundEffects.removeChild(effect);
        }
    });
}

class Piece {
    constructor(shape = null) {
        this.shape = shape || SHAPES[Math.floor(Math.random() * SHAPES.length)];
        this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
        this.x = Math.floor(COLS / 2) - Math.floor(this.shape[0].length / 2);
        this.y = 0;
        this.graphics = new PIXI.Graphics();
        this.visualY = 0; // 視覚的なY位置
    }

    draw() {
        this.graphics.clear();
        this.graphics.beginFill(this.color);
        this.graphics.lineStyle(1, 0xFFFFFF, 0.5);
        this.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    this.graphics.drawRect(
                        (this.x + x) * BLOCK_SIZE,
                        (this.visualY + y) * BLOCK_SIZE,
                        BLOCK_SIZE - 1,
                        BLOCK_SIZE - 1
                    );
                }
            });
        });
        this.graphics.endFill();
        gameContainer.addChild(this.graphics);

        // 落下予測位置の表示
        const ghost = new PIXI.Graphics();
        ghost.beginFill(this.color, 0.2);
        ghost.lineStyle(1, 0xFFFFFF, 0.3);
        let ghostY = this.y;
        while (this.isValid(this.x, ghostY + 1)) {
            ghostY++;
        }
        this.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    ghost.drawRect(
                        (this.x + x) * BLOCK_SIZE,
                        (ghostY + y) * BLOCK_SIZE,
                        BLOCK_SIZE - 1,
                        BLOCK_SIZE - 1
                    );
                }
            });
        });
        ghost.endFill();
        gameContainer.addChild(ghost);
    }

    updateVisualPosition() {
        gsap.to(this, {
            visualY: this.y,
            duration: 0.15,
            ease: "power2.out"
        });
    }

    move(dx, dy) {
        const newX = this.x + dx;
        const newY = this.y + dy;
        if (this.isValid(newX, newY)) {
            this.x = newX;
            this.y = newY;
            if (dx !== 0) moveSound.play();
            this.updateVisualPosition();
            return true;
        }
        return false;
    }

    rotate() {
        const newShape = this.shape[0].map((_, i) =>
            this.shape.map(row => row[i]).reverse()
        );
        const originalShape = this.shape;
        this.shape = newShape;
        if (this.isValid(this.x, this.y)) {
            rotateSound.play();
            createRotationEffect(this);
        } else {
            this.shape = originalShape;
        }
    }

    hardDrop() {
        let dropDistance = 0;
        while (this.move(0, 1)) {
            dropDistance++;
        }
        if (dropDistance > 0) {
            dropSound.play();
            createDropEffect(this);
        }
        return dropDistance;
    }

    isValid(newX, newY) {
        return this.shape.every((row, dy) =>
            row.every((value, dx) =>
                !value ||
                (newX + dx >= 0 &&
                 newX + dx < COLS &&
                 newY + dy >= 0 &&
                 newY + dy < ROWS &&
                 !gameBoard[newY + dy][newX + dx])
            )
        );
    }
}

function createRotationEffect(piece) {
    const effect = new PIXI.Graphics();
    effect.lineStyle(2, piece.color);
    effect.drawCircle(
        (piece.x + piece.shape[0].length / 2) * BLOCK_SIZE,
        (piece.y + piece.shape.length / 2) * BLOCK_SIZE,
        BLOCK_SIZE * 2
    );
    particleContainer.addChild(effect);

    gsap.to(effect.scale, {
        x: 1.5,
        y: 1.5,
        duration: 0.3,
        ease: "power2.out"
    });
    gsap.to(effect, {
        alpha: 0,
        duration: 0.3,
        ease: "power2.out",
        onComplete: () => {
            particleContainer.removeChild(effect);
        }
    });
}

function createDropEffect(piece) {
    const startY = piece.y * BLOCK_SIZE;
    for (let i = 0; i < 10; i++) {
        const particle = new PIXI.Graphics();
        particle.beginFill(piece.color);
        particle.drawCircle(0, 0, 2);
        particle.endFill();
        particle.x = (piece.x + Math.random() * piece.shape[0].length) * BLOCK_SIZE;
        particle.y = startY;
        particleContainer.addChild(particle);

        gsap.to(particle, {
            y: particle.y + BLOCK_SIZE * 4,
            alpha: 0,
            duration: 0.5,
            ease: "power2.in",
            onComplete: () => {
                particleContainer.removeChild(particle);
            }
        });
    }
}

function createParticles(x, y, color) {
    for (let i = 0; i < 20; i++) {
        const particle = new PIXI.Graphics();
        particle.beginFill(color);
        particle.drawCircle(0, 0, Math.random() * 3 + 1);
        particle.endFill();
        particle.x = x;
        particle.y = y;
        particle.vx = (Math.random() - 0.5) * 15;
        particle.vy = (Math.random() - 0.5) * 15;
        particle.alpha = 1;
        particleContainer.addChild(particle);

        gsap.to(particle, {
            alpha: 0,
            x: particle.x + particle.vx * 20,
            y: particle.y + particle.vy * 20,
            duration: 1,
            ease: "power2.out",
            onComplete: () => {
                particleContainer.removeChild(particle);
            }
        });
    }
}

function drawBoard() {
    gameBoard.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                const block = new PIXI.Graphics();
                block.beginFill(value);
                block.lineStyle(1, 0xFFFFFF, 0.5);
                block.drawRect(
                    x * BLOCK_SIZE,
                    y * BLOCK_SIZE,
                    BLOCK_SIZE - 1,
                    BLOCK_SIZE - 1
                );
                block.endFill();
                gameContainer.addChild(block);
            }
        });
    });
}

function clearLines() {
    let linesCleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
        if (gameBoard[y].every(cell => cell !== 0)) {
            // ライン消去エフェクト
            const lineGraphics = new PIXI.Graphics();
            lineGraphics.beginFill(0xFFFFFF);
            lineGraphics.drawRect(0, y * BLOCK_SIZE, COLS * BLOCK_SIZE, BLOCK_SIZE);
            lineGraphics.endFill();
            particleContainer.addChild(lineGraphics);

            gsap.to(lineGraphics, {
                alpha: 0,
                duration: 0.3,
                ease: "power2.in",
                onComplete: () => {
                    particleContainer.removeChild(lineGraphics);
                }
            });

            gameBoard[y].forEach((_, x) => {
                createParticles(
                    x * BLOCK_SIZE + BLOCK_SIZE / 2,
                    y * BLOCK_SIZE + BLOCK_SIZE / 2,
                    gameBoard[y][x]
                );
            });

            // ラインを消去して上から詰める
            gameBoard.splice(y, 1);
            gameBoard.unshift(Array(COLS).fill(0));
            linesCleared++;
            y++; // 同じ行をもう一度チェック

            createBackgroundEffect();
        }
    }

    if (linesCleared > 0) {
        clearSound.play();
        score += linesCleared * 100 * level;
        document.getElementById('score').textContent = score;
        if (score >= level * 1000) {
            level++;
            dropInterval = Math.max(100, 1000 - (level - 1) * 100);
            document.getElementById('level').textContent = level;
        }
    }
}

function gameOver() {
    isGameRunning = false;
    clearInterval(gameLoop);
    gameOverSound.play();
    
    // BGMをフェードアウト
    gsap.to(bgm, {
        volume: 0,
        duration: 1,
        onComplete: () => {
            bgm.pause();
            bgm.currentTime = 0;
            bgm.volume = bgmVolume.value; // 音量を元に戻す
        }
    });
    
    // ゲームオーバーエフェクト
    const overlay = new PIXI.Graphics();
    overlay.beginFill(0xFF0000, 0.3);
    overlay.drawRect(0, 0, app.screen.width, app.screen.height);
    overlay.endFill();
    app.stage.addChild(overlay);

    gsap.to(overlay, {
        alpha: 0,
        duration: 1,
        repeat: 3,
        yoyo: true,
        onComplete: () => {
            app.stage.removeChild(overlay);
            const startScreen = document.getElementById('startScreen');
            startScreen.style.display = 'flex';
            gsap.to(startScreen, {
                opacity: 1,
                duration: 0.5,
                ease: "power2.out"
            });
        }
    });
    
    alert('ゲームオーバー！\nスコア: ' + score);
}

function resetGame() {
    score = 0;
    level = 1;
    dropInterval = 1000;
    gameBoard = Array(ROWS).fill().map(() => Array(COLS).fill(0));
    currentPiece = null;
    nextPiece = null;
    document.getElementById('score').textContent = '0';
    document.getElementById('level').textContent = '1';
    gameContainer.removeChildren();
    particleContainer.removeChildren();
    backgroundEffects.removeChildren();
}

function update(timestamp) {
    if (!isGameRunning) return;

    if (!currentPiece) {
        currentPiece = nextPiece || new Piece();
        currentPiece.visualY = currentPiece.y;
        nextPiece = new Piece();
        if (!currentPiece.isValid(currentPiece.x, currentPiece.y)) {
            gameOver();
            return;
        }
        lastDropTime = timestamp;
    }

    const deltaTime = timestamp - lastDropTime;
    if (deltaTime > (softDropping ? dropInterval / 10 : dropInterval)) {
        if (!currentPiece.move(0, 1)) {
            currentPiece.shape.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value) {
                        gameBoard[currentPiece.y + y][currentPiece.x + x] = currentPiece.color;
                    }
                });
            });
            gameContainer.removeChild(currentPiece.graphics);
            currentPiece = null;
            clearLines();
        }
        lastDropTime = timestamp;
    }

    gameContainer.removeChildren();
    drawBoard();
    if (currentPiece) {
        currentPiece.draw();
    }

    nextPieceApp.stage.removeChildren();
    if (nextPiece) {
        const nextPieceGraphics = new PIXI.Graphics();
        nextPieceGraphics.beginFill(nextPiece.color);
        nextPieceGraphics.lineStyle(1, 0xFFFFFF, 0.5);
        nextPiece.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    nextPieceGraphics.drawRect(
                        (x + 1) * BLOCK_SIZE,
                        (y + 1) * BLOCK_SIZE,
                        BLOCK_SIZE - 1,
                        BLOCK_SIZE - 1
                    );
                }
            });
        });
        nextPieceGraphics.endFill();
        nextPieceApp.stage.addChild(nextPieceGraphics);
    }

    requestAnimationFrame(update);
}

// キーボード制御
document.addEventListener('keydown', (e) => {
    if (!currentPiece || !isGameRunning) return;

    switch (e.key) {
        case 'ArrowLeft':
            currentPiece.move(-1, 0);
            break;
        case 'ArrowRight':
            currentPiece.move(1, 0);
            break;
        case 'ArrowDown':
            softDropping = true;
            break;
        case 'ArrowUp':
            currentPiece.rotate();
            break;
        case ' ':
            currentPiece.hardDrop();
            break;
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowDown') {
        softDropping = false;
    }
});

// スタートボタンの制御
document.getElementById('startButton').addEventListener('click', () => {
    const startScreen = document.getElementById('startScreen');
    
    // BGM再生開始
    bgm.play().catch(error => {
        console.log("BGM autoplay failed:", error);
    });
    
    gsap.to(startScreen, {
        opacity: 0,
        duration: 0.5,
        ease: "power2.out",
        onComplete: () => {
            startScreen.style.display = 'none';
            resetGame();
            isGameRunning = true;
            requestAnimationFrame(update);
        }
    });
}); 