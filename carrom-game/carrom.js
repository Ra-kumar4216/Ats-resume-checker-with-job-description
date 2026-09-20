/* ==========================================================================
   CARROM POOL: DISC GAME - HTML5 Canvas Engine, Physics & Rules
   ========================================================================== */

(function () {
    // Canvas & Context Setup
    const canvas = document.getElementById('carromCanvas');
    const ctx = canvas.getContext('2d');

    // UI Elements
    const strikerSlider = document.getElementById('strikerSlider');
    const statusBanner = document.getElementById('statusBanner');
    const gameModeSelect = document.getElementById('gameModeSelect');
    const soundBtn = document.getElementById('soundBtn');
    const soundIcon = document.getElementById('soundIcon');
    const rulesBtn = document.getElementById('rulesBtn');
    const closeRulesBtn = document.getElementById('closeRulesBtn');
    const gotItBtn = document.getElementById('gotItBtn');
    const rulesModal = document.getElementById('rulesModal');
    const restartBtn = document.getElementById('restartBtn');
    const victoryModal = document.getElementById('victoryModal');
    const playAgainBtn = document.getElementById('playAgainBtn');

    // Scoreboard UI
    const p1Card = document.getElementById('player1Card');
    const p2Card = document.getElementById('player2Card');
    const p1Score = document.getElementById('p1Score');
    const p2Score = document.getElementById('p2Score');
    const p1Count = document.getElementById('p1Count');
    const p2Count = document.getElementById('p2Count');
    const p1AssignText = document.getElementById('p1AssignText');
    const p2AssignText = document.getElementById('p2AssignText');
    const p1TurnBadge = document.getElementById('p1TurnBadge');
    const p2TurnBadge = document.getElementById('p2TurnBadge');
    const p2Avatar = document.getElementById('p2Avatar');
    const p2Name = document.getElementById('p2Name');
    const winnerTitle = document.getElementById('winnerTitle');
    const winnerDesc = document.getElementById('winnerDesc');
    const finalP1Score = document.getElementById('finalP1Score');
    const finalP2Score = document.getElementById('finalP2Score');
    const finalP2Label = document.getElementById('finalP2Label');

    // Game Config & Dimensions
    const CANVAS_SIZE = 600;
    const FRAME_WIDTH = 40;
    const INNER_BOUND_MIN = FRAME_WIDTH;
    const INNER_BOUND_MAX = CANVAS_SIZE - FRAME_WIDTH;
    const POCKET_RADIUS = 28;

    // Pocket positions
    const POCKETS = [
        { x: INNER_BOUND_MIN + 18, y: INNER_BOUND_MIN + 18 }, // Top-Left
        { x: INNER_BOUND_MAX - 18, y: INNER_BOUND_MIN + 18 }, // Top-Right
        { x: INNER_BOUND_MIN + 18, y: INNER_BOUND_MAX - 18 }, // Bottom-Left
        { x: INNER_BOUND_MAX - 18, y: INNER_BOUND_MAX - 18 }  // Bottom-Right
    ];

    // Disc Config
    const DISC_RADIUS = 15;
    const STRIKER_RADIUS = 21;
    const FRICTION = 0.982; // Friction deceleration
    const RESTITUTION = 0.92; // Bounciness
    const MIN_VELOCITY = 0.08;

    // Audio Engine Setup
    let audioEnabled = true;
    let audioCtx = null;

    function initAudio() {
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                audioCtx = new AudioContext();
            }
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    function playSound(type, intensity = 1) {
        if (!audioEnabled) return;
        try {
            initAudio();
            if (!audioCtx) return;

            const now = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            osc.connect(gain);
            gain.connect(audioCtx.destination);

            if (type === 'strike') {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(120 + intensity * 200, now);
                osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
                gain.gain.setValueAtTime(Math.min(0.8, 0.3 + intensity * 0.5), now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                osc.start(now);
                osc.stop(now + 0.15);
            } else if (type === 'collision') {
                osc.type = 'sine';
                const freq = 600 + Math.random() * 300;
                osc.frequency.setValueAtTime(freq, now);
                osc.frequency.exponentialRampToValueAtTime(150, now + 0.06);
                gain.gain.setValueAtTime(Math.min(0.6, 0.1 + intensity * 0.4), now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
                osc.start(now);
                osc.stop(now + 0.06);
            } else if (type === 'cushion') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(180, now);
                osc.frequency.exponentialRampToValueAtTime(60, now + 0.1);
                gain.gain.setValueAtTime(Math.min(0.5, 0.2 + intensity * 0.3), now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
            } else if (type === 'pocket') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(400, now);
                osc.frequency.exponentialRampToValueAtTime(100, now + 0.25);
                gain.gain.setValueAtTime(0.7, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
                osc.start(now);
                osc.stop(now + 0.25);
            } else if (type === 'foul') {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.setValueAtTime(110, now + 0.1);
                gain.gain.setValueAtTime(0.4, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
            }
        } catch (e) {
            console.error(e);
        }
    }

    soundBtn.addEventListener('click', () => {
        audioEnabled = !audioEnabled;
        if (audioEnabled) {
            soundIcon.className = 'fas fa-volume-up text-amber-400';
            initAudio();
        } else {
            soundIcon.className = 'fas fa-volume-mute text-slate-500';
        }
    });

    /* ==========================================================================
       GAME STATE & DISCS SETUP
       ========================================================================== */

    let gameMode = 'pvai'; // 'pvai', 'pvp', 'practice'
    let activePlayer = 1; // 1 or 2
    let isMoving = false;
    let isAiming = false;
    let dragStart = { x: 0, y: 0 };
    let currentDrag = { x: 0, y: 0 };
    let queenCoverRequired = false;
    let queenPocketedBy = null;
    let turnPocketedTypes = [];

    // Player stats
    let player1 = { score: 0, count: 0, assigned: 'white' };
    let player2 = { score: 0, count: 0, assigned: 'black' };

    // Baseline positions
    const P1_BASELINE_Y = 487.5;
    const P2_BASELINE_Y = 112.5;
    const BASELINE_X_MIN = 145;
    const BASELINE_X_MAX = 455;

    let striker = {
        x: 300,
        y: P1_BASELINE_Y,
        vx: 0,
        vy: 0,
        radius: STRIKER_RADIUS,
        mass: 2.2,
        type: 'striker',
        pocketed: false
    };

    let discs = [];

    function initDiscs() {
        discs = [];
        const centerX = CANVAS_SIZE / 2;
        const centerY = CANVAS_SIZE / 2;

        // Central Queen
        discs.push({
            x: centerX,
            y: centerY,
            vx: 0,
            vy: 0,
            radius: DISC_RADIUS,
            mass: 1.0,
            type: 'queen',
            pocketed: false,
            scale: 1
        });

        // Circle pattern around queen: 6 inner discs, 12 outer discs (alternating white/black)
        const innerRadius = DISC_RADIUS * 2.05;
        for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            discs.push({
                x: centerX + Math.cos(angle) * innerRadius,
                y: centerY + Math.sin(angle) * innerRadius,
                vx: 0,
                vy: 0,
                radius: DISC_RADIUS,
                mass: 1.0,
                type: (i % 2 === 0) ? 'white' : 'black',
                pocketed: false,
                scale: 1
            });
        }

        const outerRadius = DISC_RADIUS * 4.0;
        for (let i = 0; i < 12; i++) {
            const angle = (i * Math.PI) / 6 + Math.PI / 12;
            discs.push({
                x: centerX + Math.cos(angle) * outerRadius,
                y: centerY + Math.sin(angle) * outerRadius,
                vx: 0,
                vy: 0,
                radius: DISC_RADIUS,
                mass: 1.0,
                type: (i % 2 === 0) ? 'black' : 'white',
                pocketed: false,
                scale: 1
            });
        }
    }

    function resetStriker() {
        striker.vx = 0;
        striker.vy = 0;
        striker.pocketed = false;

        const sliderVal = parseFloat(strikerSlider.value) / 100;
        const xPos = BASELINE_X_MIN + sliderVal * (BASELINE_X_MAX - BASELINE_X_MIN);

        if (activePlayer === 1 || gameMode === 'practice') {
            striker.x = xPos;
            striker.y = P1_BASELINE_Y;
        } else {
            striker.x = xPos;
            striker.y = P2_BASELINE_Y;
        }
    }

    function resetGame() {
        player1 = { score: 0, count: 0, assigned: 'white' };
        player2 = { score: 0, count: 0, assigned: 'black' };
        activePlayer = 1;
        isMoving = false;
        isAiming = false;
        queenCoverRequired = false;
        queenPocketedBy = null;
        turnPocketedTypes = [];

        strikerSlider.value = 50;
        initDiscs();
        resetStriker();
        updateUI();
        victoryModal.classList.add('hidden');
    }

    /* ==========================================================================
       BOARD RENDERING & CANVAS DRAWING
       ========================================================================== */

    function drawBoard() {
        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

        // 1. Outer Wooden Frame
        const gradFrame = ctx.createLinearGradient(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        gradFrame.addColorStop(0, '#3a1c0d');
        gradFrame.addColorStop(0.5, '#5c2d15');
        gradFrame.addColorStop(1, '#231007');
        ctx.fillStyle = gradFrame;
        ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

        ctx.strokeStyle = '#180a04';
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, CANVAS_SIZE - 4, CANVAS_SIZE - 4);

        // 2. Play Area Surface
        const boardGrad = ctx.createRadialGradient(
            CANVAS_SIZE / 2, CANVAS_SIZE / 2, 50,
            CANVAS_SIZE / 2, CANVAS_SIZE / 2, 380
        );
        boardGrad.addColorStop(0, '#fdf6e3');
        boardGrad.addColorStop(0.7, '#f5e4c8');
        boardGrad.addColorStop(1, '#ebd0a7');
        ctx.fillStyle = boardGrad;
        ctx.fillRect(INNER_BOUND_MIN, INNER_BOUND_MIN, INNER_BOUND_MAX - INNER_BOUND_MIN, INNER_BOUND_MAX - INNER_BOUND_MIN);

        ctx.strokeStyle = '#854d0e';
        ctx.lineWidth = 3;
        ctx.strokeRect(INNER_BOUND_MIN, INNER_BOUND_MIN, INNER_BOUND_MAX - INNER_BOUND_MIN, INNER_BOUND_MAX - INNER_BOUND_MIN);

        ctx.strokeStyle = '#a16207';
        ctx.lineWidth = 1;
        ctx.strokeRect(INNER_BOUND_MIN + 6, INNER_BOUND_MIN + 6, INNER_BOUND_MAX - INNER_BOUND_MIN - 12, INNER_BOUND_MAX - INNER_BOUND_MIN - 12);

        // 3. Corner Pockets
        POCKETS.forEach(pkt => {
            const pocketGrad = ctx.createRadialGradient(pkt.x, pkt.y, POCKET_RADIUS * 0.2, pkt.x, pkt.y, POCKET_RADIUS);
            pocketGrad.addColorStop(0, '#000000');
            pocketGrad.addColorStop(0.8, '#1e293b');
            pocketGrad.addColorStop(1, '#475569');

            ctx.beginPath();
            ctx.arc(pkt.x, pkt.y, POCKET_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = pocketGrad;
            ctx.fill();

            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 3;
            ctx.stroke();
        });

        // 4. Center Circles & Queen Spot
        const centerX = CANVAS_SIZE / 2;
        const centerY = CANVAS_SIZE / 2;

        ctx.beginPath();
        ctx.arc(centerX, centerY, 65, 0, Math.PI * 2);
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(centerX, centerY, 55, 0, Math.PI * 2);
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(centerX, centerY, 18, 0, Math.PI * 2);
        ctx.fillStyle = '#fecdd3';
        ctx.fill();
        ctx.strokeStyle = '#e11d48';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#e11d48';
        ctx.fill();

        // 5. Baselines
        const isP1Turn = (activePlayer === 1 || gameMode === 'practice');
        const isP2Turn = (activePlayer === 2 && gameMode === 'pvp');

        drawBaselinePair(130, 475, 470, 475, 130, 500, 470, 500, isP1Turn);
        drawBaselinePair(130, 125, 470, 125, 130, 100, 470, 100, isP2Turn);
        drawBaselinePair(125, 130, 125, 470, 100, 130, 100, 470, false);
        drawBaselinePair(475, 130, 475, 470, 500, 130, 500, 470, false);
    }

    function drawBaselinePair(x1, y1, x2, y2, x3, y3, x4, y4, isActive) {
        ctx.strokeStyle = isActive ? '#d97706' : '#a16207';
        ctx.lineWidth = isActive ? 2 : 1.5;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x3, y3);
        ctx.lineTo(x4, y4);
        ctx.stroke();

        const r = 12;
        const circles = [
            { x: x1, y: (y1 + y3) / 2 },
            { x: x2, y: (y2 + y4) / 2 }
        ];

        circles.forEach(c => {
            ctx.beginPath();
            ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
            ctx.fillStyle = isActive ? '#fef3c7' : '#fde68a';
            ctx.fill();
            ctx.strokeStyle = '#b45309';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(c.x, c.y, r * 0.6, 0, Math.PI * 2);
            ctx.fillStyle = '#dc2626';
            ctx.fill();
        });
    }

    function drawDisc(disc) {
        if (disc.pocketed) return;

        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;

        const currentR = disc.radius * (disc.scale || 1);

        ctx.beginPath();
        ctx.arc(disc.x, disc.y, currentR, 0, Math.PI * 2);

        if (disc.type === 'white') {
            const grad = ctx.createRadialGradient(
                disc.x - currentR * 0.3, disc.y - currentR * 0.3, 2,
                disc.x, disc.y, currentR
            );
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.7, '#fef08a');
            grad.addColorStop(1, '#ca8a04');
            ctx.fillStyle = grad;
            ctx.fill();

            ctx.strokeStyle = '#854d0e';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(disc.x, disc.y, currentR * 0.45, 0, Math.PI * 2);
            ctx.strokeStyle = '#ca8a04';
            ctx.lineWidth = 1;
            ctx.stroke();

        } else if (disc.type === 'black') {
            const grad = ctx.createRadialGradient(
                disc.x - currentR * 0.3, disc.y - currentR * 0.3, 2,
                disc.x, disc.y, currentR
            );
            grad.addColorStop(0, '#64748b');
            grad.addColorStop(0.7, '#1e293b');
            grad.addColorStop(1, '#020617');
            ctx.fillStyle = grad;
            ctx.fill();

            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(disc.x, disc.y, currentR * 0.5, 0, Math.PI * 2);
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 1;
            ctx.stroke();

        } else if (disc.type === 'queen') {
            const grad = ctx.createRadialGradient(
                disc.x - currentR * 0.3, disc.y - currentR * 0.3, 2,
                disc.x, disc.y, currentR
            );
            grad.addColorStop(0, '#fda4af');
            grad.addColorStop(0.6, '#e11d48');
            grad.addColorStop(1, '#881337');
            ctx.fillStyle = grad;
            ctx.fill();

            ctx.strokeStyle = '#9f1239';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(disc.x, disc.y, currentR * 0.4, 0, Math.PI * 2);
            ctx.fillStyle = '#f59e0b';
            ctx.fill();

        } else if (disc.type === 'striker') {
            const grad = ctx.createRadialGradient(
                disc.x - currentR * 0.3, disc.y - currentR * 0.3, 3,
                disc.x, disc.y, currentR
            );
            grad.addColorStop(0, '#bae6fd');
            grad.addColorStop(0.5, '#0284c7');
            grad.addColorStop(1, '#0369a1');
            ctx.fillStyle = grad;
            ctx.fill();

            ctx.strokeStyle = '#e0f2fe';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(disc.x, disc.y, currentR * 0.5, 0, Math.PI * 2);
            ctx.strokeStyle = '#f0f9ff';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(disc.x, disc.y, currentR * 0.2, 0, Math.PI * 2);
            ctx.fillStyle = '#38bdf8';
            ctx.fill();
        }

        ctx.restore();
    }

    function drawAimTrajectory() {
        if (!isAiming || isMoving) return;

        const dx = dragStart.x - currentDrag.x;
        const dy = dragStart.y - currentDrag.y;
        const power = Math.hypot(dx, dy);

        if (power < 10) return;

        // Pull back angle is reversed to get shot direction
        const shotAngle = Math.atan2(dy, dx);
        const maxPower = 160;
        const currentPower = Math.min(power, maxPower);
        const powerRatio = currentPower / maxPower;

        // Aim Vector
        const aimDist = currentPower * 2.5;
        const targetX = striker.x + Math.cos(shotAngle) * aimDist;
        const targetY = striker.y + Math.sin(shotAngle) * aimDist;

        // Draw Drag Pull-back Line
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(striker.x, striker.y);
        ctx.lineTo(currentDrag.x, currentDrag.y);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.stroke();

        // Draw Aim Trajectory Line
        ctx.beginPath();
        ctx.moveTo(striker.x, striker.y);
        ctx.lineTo(targetX, targetY);

        const lineGrad = ctx.createLinearGradient(striker.x, striker.y, targetX, targetY);
        lineGrad.addColorStop(0, 'rgba(251, 191, 36, 0.9)');
        lineGrad.addColorStop(1, 'rgba(245, 158, 11, 0.2)');
        ctx.strokeStyle = lineGrad;
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        ctx.stroke();
        ctx.restore();

        // Power Circle Indicator on Striker
        ctx.beginPath();
        ctx.arc(striker.x, striker.y, striker.radius + 6, 0, Math.PI * 2 * powerRatio);
        ctx.strokeStyle = powerRatio > 0.75 ? '#ef4444' : '#f59e0b';
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    /* ==========================================================================
       PHYSICS ENGINE & COLLISION LOGIC
       ========================================================================== */

    function updatePhysics() {
        let allStopped = true;
        const allObjects = [...discs, striker];

        allObjects.forEach(obj => {
            if (obj.pocketed) return;

            // Apply Velocity
            obj.x += obj.vx;
            obj.y += obj.vy;

            // Apply Friction
            obj.vx *= FRICTION;
            obj.vy *= FRICTION;

            if (Math.hypot(obj.vx, obj.vy) < MIN_VELOCITY) {
                obj.vx = 0;
                obj.vy = 0;
            } else {
                allStopped = false;
            }

            // Cushion Boundary Collision
            const minX = INNER_BOUND_MIN + obj.radius;
            const maxX = INNER_BOUND_MAX - obj.radius;
            const minY = INNER_BOUND_MIN + obj.radius;
            const maxY = INNER_BOUND_MAX - obj.radius;

            if (obj.x < minX) {
                obj.x = minX;
                obj.vx = -obj.vx * RESTITUTION;
                playSound('cushion', Math.abs(obj.vx) / 10);
            } else if (obj.x > maxX) {
                obj.x = maxX;
                obj.vx = -obj.vx * RESTITUTION;
                playSound('cushion', Math.abs(obj.vx) / 10);
            }

            if (obj.y < minY) {
                obj.y = minY;
                obj.vy = -obj.vy * RESTITUTION;
                playSound('cushion', Math.abs(obj.vy) / 10);
            } else if (obj.y > maxY) {
                obj.y = maxY;
                obj.vy = -obj.vy * RESTITUTION;
                playSound('cushion', Math.abs(obj.vy) / 10);
            }

            // Check Pocket Sinking
            POCKETS.forEach(pkt => {
                const dist = Math.hypot(obj.x - pkt.x, obj.y - pkt.y);
                if (dist < POCKET_RADIUS - 2) {
                    obj.pocketed = true;
                    obj.vx = 0;
                    obj.vy = 0;
                    playSound('pocket');
                    handlePocketedDisc(obj);
                }
            });
        });

        // Circle-Circle Elastic Collision
        for (let i = 0; i < allObjects.length; i++) {
            for (let j = i + 1; j < allObjects.length; j++) {
                const o1 = allObjects[i];
                const o2 = allObjects[j];

                if (o1.pocketed || o2.pocketed) continue;

                const dx = o2.x - o1.x;
                const dy = o2.y - o1.y;
                const distance = Math.hypot(dx, dy);
                const minDist = o1.radius + o2.radius;

                if (distance < minDist && distance > 0) {
                    // Normal vector
                    const nx = dx / distance;
                    const ny = dy / distance;

                    // Positional overlap correction
                    const overlap = minDist - distance;
                    o1.x -= nx * overlap * 0.5;
                    o1.y -= ny * overlap * 0.5;
                    o2.x += nx * overlap * 0.5;
                    o2.y += ny * overlap * 0.5;

                    // Relative velocity
                    const kx = o1.vx - o2.vx;
                    const ky = o1.vy - o2.vy;
                    const p = 2 * (nx * kx + ny * ky) / (o1.mass + o2.mass);

                    o1.vx -= p * o2.mass * nx * RESTITUTION;
                    o1.vy -= p * o2.mass * ny * RESTITUTION;
                    o2.vx += p * o1.mass * nx * RESTITUTION;
                    o2.vy += p * o1.mass * ny * RESTITUTION;

                    const impactVelocity = Math.hypot(o1.vx - o2.vx, o1.vy - o2.vy);
                    if (impactVelocity > 0.5) {
                        playSound('collision', impactVelocity / 15);
                    }
                }
            }
        }

        // Check if movement state ended
        if (isMoving && allStopped) {
            isMoving = false;
            onTurnComplete();
        }
    }

    function handlePocketedDisc(disc) {
        if (disc.type === 'striker') {
            playSound('foul');
            turnPocketedTypes.push('striker');
        } else {
            turnPocketedTypes.push(disc.type);
        }
    }

    /* ==========================================================================
       GAME LOGIC, TURNS & RULES
       ========================================================================== */

    function fireShot(powerX, powerY) {
        striker.vx = powerX;
        striker.vy = powerY;
        isMoving = true;
        turnPocketedTypes = [];
        playSound('strike', Math.hypot(powerX, powerY) / 15);
    }

    function onTurnComplete() {
        const hasFoul = turnPocketedTypes.includes('striker');
        const whitePocketed = turnPocketedTypes.filter(t => t === 'white').length;
        const blackPocketed = turnPocketedTypes.filter(t => t === 'black').length;
        const queenPocketed = turnPocketedTypes.includes('queen');

        let extraTurn = false;
        let currentPlayerObj = (activePlayer === 1) ? player1 : player2;
        let opponentPlayerObj = (activePlayer === 1) ? player2 : player1;

        if (hasFoul) {
            currentPlayerObj.score = Math.max(0, currentPlayerObj.score - 5);
            setStatusMessage(`Foul! Striker Pocketed (-5 Pts)`);
            if (queenPocketed) {
                // Return Queen to center if pocketed with foul
                const queen = discs.find(d => d.type === 'queen');
                if (queen) {
                    queen.pocketed = false;
                    queen.x = CANVAS_SIZE / 2;
                    queen.y = CANVAS_SIZE / 2;
                }
            }
        } else {
            // Process pocketed discs
            if (whitePocketed > 0) {
                if (activePlayer === 1) {
                    player1.score += whitePocketed * 10;
                    player1.count += whitePocketed;
                    extraTurn = true;
                } else {
                    player2.score += whitePocketed * 10;
                    player2.count += whitePocketed;
                    if (gameMode !== 'practice') extraTurn = true;
                }
            }

            if (blackPocketed > 0) {
                if (activePlayer === 2 || gameMode === 'practice') {
                    player2.score += blackPocketed * 5;
                    player2.count += blackPocketed;
                    extraTurn = true;
                } else {
                    player1.score += blackPocketed * 5;
                    player1.count += blackPocketed;
                }
            }

            if (queenPocketed) {
                queenPocketedBy = activePlayer;
                queenCoverRequired = true;
                currentPlayerObj.score += 30;
                extraTurn = true;
                setStatusMessage(`Queen Pocketed (+30 Pts)! Cover required.`);
            }
        }

        // Verify Queen cover
        if (queenCoverRequired && queenPocketedBy === activePlayer && !queenPocketed) {
            if (whitePocketed > 0 || blackPocketed > 0) {
                queenCoverRequired = false;
                setStatusMessage(`Queen Covered Successfully!`);
            } else if (!extraTurn) {
                // Return Queen to center if cover failed
                queenCoverRequired = false;
                queenPocketedBy = null;
                currentPlayerObj.score = Math.max(0, currentPlayerObj.score - 30);
                const queen = discs.find(d => d.type === 'queen');
                if (queen) {
                    queen.pocketed = false;
                    queen.x = CANVAS_SIZE / 2;
                    queen.y = CANVAS_SIZE / 2;
                }
                setStatusMessage(`Queen Cover Failed! Returned to center.`);
            }
        }

        updateUI();

        // Check Victory Conditions
        if (checkWinCondition()) return;

        // Turn switching
        if (!extraTurn && gameMode !== 'practice') {
            activePlayer = (activePlayer === 1) ? 2 : 1;
        }

        resetStriker();
        updateUI();

        // Trigger AI Turn if applicable
        if (gameMode === 'pvai' && activePlayer === 2) {
            setTimeout(executeAITurn, 900);
        }
    }

    function checkWinCondition() {
        const remainingDiscs = discs.filter(d => !d.pocketed);
        const remainingWhite = remainingDiscs.filter(d => d.type === 'white').length;
        const remainingBlack = remainingDiscs.filter(d => d.type === 'black').length;

        if (remainingWhite === 0 || remainingBlack === 0 || remainingDiscs.length === 0) {
            let winnerText = 'Player 1 Wins!';
            if (gameMode === 'practice') {
                winnerText = 'Board Cleared!';
            } else if (player2.score > player1.score) {
                winnerText = (gameMode === 'pvai') ? 'AI Bot Wins!' : 'Player 2 Wins!';
            }

            winnerTitle.innerText = winnerText;
            winnerDesc.innerText = `Final Score: Player 1 (${player1.score} pts) vs ${gameMode === 'pvai' ? 'AI Bot' : 'Player 2'} (${player2.score} pts)`;
            finalP1Score.innerText = player1.score;
            finalP2Score.innerText = player2.score;
            finalP2Label.innerText = (gameMode === 'pvai') ? 'AI Bot' : 'Player 2';

            victoryModal.classList.remove('hidden');
            return true;
        }
        return false;
    }

    function setStatusMessage(msg) {
        statusBanner.innerText = msg;
    }

    function updateUI() {
        p1Score.innerText = player1.score;
        p2Score.innerText = player2.score;
        p1Count.innerText = player1.count;
        p2Count.innerText = player2.count;

        if (activePlayer === 1) {
            p1TurnBadge.classList.remove('hidden');
            p2TurnBadge.classList.add('hidden');
            p1Card.className = "glass-panel w-full md:w-48 p-4 rounded-2xl flex md:flex-col justify-between items-center transition-all duration-300 border-2 border-amber-400 shadow-lg shadow-amber-500/10 opacity-100";
            p2Card.className = "glass-panel w-full md:w-48 p-4 rounded-2xl flex md:flex-col justify-between items-center transition-all duration-300 border-2 border-transparent opacity-60";
            if (!isMoving) setStatusMessage("Player 1's Turn - Drag & Aim");
        } else {
            p1TurnBadge.classList.add('hidden');
            p2TurnBadge.classList.remove('hidden');
            p2Card.className = "glass-panel w-full md:w-48 p-4 rounded-2xl flex md:flex-col justify-between items-center transition-all duration-300 border-2 border-amber-400 shadow-lg shadow-amber-500/10 opacity-100";
            p1Card.className = "glass-panel w-full md:w-48 p-4 rounded-2xl flex md:flex-col justify-between items-center transition-all duration-300 border-2 border-transparent opacity-60";
            if (!isMoving) {
                setStatusMessage((gameMode === 'pvai') ? "AI Bot Thinking..." : "Player 2's Turn - Drag & Aim");
            }
        }
    }

    /* ==========================================================================
       AI BOT LOGIC
       ========================================================================== */

    function executeAITurn() {
        if (isMoving || activePlayer !== 2 || gameMode !== 'pvai') return;

        // Pick a target disc
        const availableTargets = discs.filter(d => !d.pocketed);
        if (availableTargets.length === 0) return;

        // Position striker at a random baseline spot
        const randomRatio = 0.2 + Math.random() * 0.6;
        strikerSlider.value = randomRatio * 100;
        striker.x = BASELINE_X_MIN + randomRatio * (BASELINE_X_MAX - BASELINE_X_MIN);
        striker.y = P2_BASELINE_Y;

        // Find nearest valid target
        let bestTarget = availableTargets[0];
        let minDist = 9999;

        availableTargets.forEach(t => {
            const dist = Math.hypot(t.x - striker.x, t.y - striker.y);
            if (dist < minDist) {
                minDist = dist;
                bestTarget = t;
            }
        });

        // Aim towards target with slight random inaccuracy
        const dx = bestTarget.x - striker.x + (Math.random() * 12 - 6);
        const dy = bestTarget.y - striker.y + (Math.random() * 12 - 6);
        const angle = Math.atan2(dy, dx);
        const power = 10 + Math.random() * 8;

        fireShot(Math.cos(angle) * power, Math.sin(angle) * power);
    }

    /* ==========================================================================
       EVENT LISTENERS & CONTROLS
       ========================================================================== */

    function getCanvasCoordinates(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left) * (CANVAS_SIZE / rect.width),
            y: (clientY - rect.top) * (CANVAS_SIZE / rect.height)
        };
    }

    function onPointerDown(e) {
        if (isMoving) return;
        if (gameMode === 'pvai' && activePlayer === 2) return;

        const pos = getCanvasCoordinates(e);
        const dist = Math.hypot(pos.x - striker.x, pos.y - striker.y);

        if (dist < striker.radius * 2.5) {
            isAiming = true;
            dragStart = { x: striker.x, y: striker.y };
            currentDrag = { x: pos.x, y: pos.y };
            initAudio();
        }
    }

    function onPointerMove(e) {
        if (!isAiming) return;
        currentDrag = getCanvasCoordinates(e);
    }

    function onPointerUp() {
        if (!isAiming) return;
        isAiming = false;

        const dx = dragStart.x - currentDrag.x;
        const dy = dragStart.y - currentDrag.y;
        const power = Math.hypot(dx, dy);

        if (power > 12) {
            const angle = Math.atan2(dy, dx);
            const shotPower = Math.min(power * 0.15, 22);
            fireShot(Math.cos(angle) * shotPower, Math.sin(angle) * shotPower);
        }
    }

    canvas.addEventListener('mousedown', onPointerDown);
    canvas.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    canvas.addEventListener('touchstart', onPointerDown, { passive: true });
    canvas.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);

    strikerSlider.addEventListener('input', () => {
        if (!isMoving && !isAiming) {
            resetStriker();
        }
    });

    gameModeSelect.addEventListener('change', (e) => {
        gameMode = e.target.value;
        if (gameMode === 'pvai') {
            p2Name.innerText = 'AI Bot';
            p2Avatar.innerText = '🤖';
            p1AssignText.innerText = 'Assigned: White';
            p2AssignText.innerText = 'Assigned: Black';
        } else if (gameMode === 'pvp') {
            p2Name.innerText = 'Player 2';
            p2Avatar.innerText = '👥';
            p1AssignText.innerText = 'Assigned: White';
            p2AssignText.innerText = 'Assigned: Black';
        } else {
            p2Name.innerText = 'Target Practice';
            p2Avatar.innerText = '🎯';
            p1AssignText.innerText = 'Free Play Mode';
            p2AssignText.innerText = 'Practice';
        }
        resetGame();
    });

    rulesBtn.addEventListener('click', () => rulesModal.classList.remove('hidden'));
    closeRulesBtn.addEventListener('click', () => rulesModal.classList.add('hidden'));
    gotItBtn.addEventListener('click', () => rulesModal.classList.add('hidden'));
    restartBtn.addEventListener('click', resetGame);
    playAgainBtn.addEventListener('click', resetGame);

    /* ==========================================================================
       MAIN GAME LOOP
       ========================================================================== */

    function gameLoop() {
        drawBoard();

        if (isMoving) {
            updatePhysics();
        }

        // Draw discs
        discs.forEach(drawDisc);

        // Draw striker
        drawDisc(striker);

        // Draw trajectory
        drawAimTrajectory();

        requestAnimationFrame(gameLoop);
    }

    // Initialize Game
    resetGame();
    requestAnimationFrame(gameLoop);

})();
