/**
 * =============================================================================
 * OTTO KART PRO: REMASTERED ENGINE v3.1
 * =============================================================================
 * ID: 'kart' - Physics Vector Based
 */

(function() {
    const GAME_ID = 'kart'; // ID CRÍTICO PARA O MENU

    // --- CONFIGURAÇÕES ---
    const K = {
        MAX_SPEED: 240, ACCEL: 45, BREAKING: -80, DECEL: -5,
        OFFROAD_DECEL: -120, OFFROAD_LIMIT: 60,
        CENTRIFUGAL: 0.35, STEER_SPEED: 2.2,
        SEGMENT_LENGTH: 200, ROAD_WIDTH: 2000,
        CAMERA_HEIGHT: 1000, CAMERA_DEPTH: 0.8, TOTAL_LAPS: 3
    };

    const U = {
        project: (p, camX, camY, camZ, w, h, depth) => {
            p.camera.x = (p.world.x || 0) - camX;
            p.camera.y = (p.world.y || 0) - camY;
            p.camera.z = (p.world.z || 0) - camZ;
            if(p.camera.z < 1) p.camera.z = 1;
            p.screen.scale = depth / p.camera.z;
            p.screen.x = Math.round((w/2) + (p.screen.scale * p.camera.x * w/2));
            p.screen.y = Math.round((h/2) - (p.screen.scale * p.camera.y * h/2));
            p.screen.w = Math.round((p.screen.scale * K.ROAD_WIDTH * w/2));
        }
    };

    // --- FÍSICA ---
    const Physics = {
        x: 0, z: 0, speed: 0,
        driftState: 0, driftDir: 0, miniTurbo: 0, boostTimer: 0,
        playerY: 0, visualTilt: 0,

        reset: function() {
            this.x = 0; this.z = 0; this.speed = 0;
            this.driftState = 0; this.boostTimer = 0;
        },

        update: function(dt, input, trackLength, curve) {
            let accel = K.ACCEL;
            let max = K.MAX_SPEED;
            
            if(this.boostTimer > 0) { max += 50; accel *= 2; this.boostTimer -= dt; }

            if(input.throttle) this.speed += accel * dt;
            else this.speed += K.DECEL * dt;

            // Offroad
            if(Math.abs(this.x) > 1.1) {
                this.speed += K.OFFROAD_DECEL * dt;
                if(this.speed > K.OFFROAD_LIMIT) this.speed = K.OFFROAD_LIMIT;
            }
            this.speed = Math.max(0, Math.min(this.speed, max));

            const speedRatio = this.speed / K.MAX_SPEED;
            const dx = dt * 2 * speedRatio;
            let steer = input.steer;

            // Drift
            if(input.drift && this.speed > 30 && this.driftState === 0) {
                this.driftState = 1; this.playerY = 20; this.driftDir = Math.sign(steer) || 1;
                window.Sfx.play(150, 'sawtooth', 0.1);
            }
            if(this.driftState > 0) {
                if(!input.drift) {
                    if(this.miniTurbo > 100) { this.boostTimer = 2.0; window.Sfx.play(600, 'square', 0.5); }
                    this.driftState = 0; this.miniTurbo = 0;
                } else {
                    steer = this.driftDir;
                    if(Math.sign(input.steer) !== this.driftDir && input.steer !== 0) this.miniTurbo += 2;
                    else this.miniTurbo += 0.5;
                }
            }

            this.x -= (dx * speedRatio * curve * K.CENTRIFUGAL);
            this.x += (dx * steer * K.STEER_SPEED);

            if(Math.abs(this.x) > 2.2) { this.x = Math.sign(this.x) * 2.2; this.speed *= 0.9; }

            this.z += (this.speed * dt * 1.5);
            if(this.z >= trackLength) this.z -= trackLength;
            if(this.z < 0) this.z += trackLength;

            const targetTilt = (steer * 20) + (this.driftState > 0 ? this.driftDir * 15 : 0);
            this.visualTilt += (targetTilt - this.visualTilt) * 0.1;
            if(this.playerY > 0) this.playerY -= 100 * dt;
            if(this.playerY < 0) this.playerY = 0;
        }
    };

    // --- RENDERIZADOR ---
    const Renderer = {
        draw: function(ctx, w, h, segments, phys) {
            const grad = ctx.createLinearGradient(0,0,0,h);
            grad.addColorStop(0, '#00bfff'); grad.addColorStop(1, '#cceeff');
            ctx.fillStyle = grad; ctx.fillRect(0,0,w,h);

            const baseSeg = segments[Math.floor(phys.z / K.SEGMENT_LENGTH) % segments.length];
            let dx = -(baseSeg.curve * (phys.z % K.SEGMENT_LENGTH) / K.SEGMENT_LENGTH);
            let x = 0;
            let maxY = h;
            const camY = K.CAMERA_HEIGHT + phys.playerY * 100;

            for(let n=0; n<100; n++) {
                const seg = segments[(baseSeg.index + n) % segments.length];
                const looped = seg.index < baseSeg.index;
                const segZ = phys.z - (looped ? segments.length * K.SEGMENT_LENGTH : 0);
                
                U.project(seg.p1, (phys.x * K.ROAD_WIDTH) - x, camY, segZ, w, h, K.CAMERA_DEPTH);
                U.project(seg.p2, (phys.x * K.ROAD_WIDTH) - x - dx, camY, segZ, w, h, K.CAMERA_DEPTH);

                x += dx; dx += seg.curve;

                if(seg.p1.camera.z <= K.CAMERA_DEPTH || seg.p2.screen.y >= maxY) continue;

                ctx.fillStyle = seg.color.grass; ctx.fillRect(0, seg.p2.screen.y, w, seg.p1.screen.y - seg.p2.screen.y);
                ctx.fillStyle = seg.color.road;
                ctx.beginPath(); ctx.moveTo(seg.p1.screen.x-seg.p1.screen.w, seg.p1.screen.y);
                ctx.lineTo(seg.p2.screen.x-seg.p2.screen.w, seg.p2.screen.y);
                ctx.lineTo(seg.p2.screen.x+seg.p2.screen.w, seg.p2.screen.y);
                ctx.lineTo(seg.p1.screen.x+seg.p1.screen.w, seg.p1.screen.y);
                ctx.fill();

                ctx.fillStyle = seg.color.rumble;
                const r1 = seg.p1.screen.w/5; const r2 = seg.p2.screen.w/5;
                ctx.fillRect(seg.p1.screen.x-seg.p1.screen.w-r1, seg.p1.screen.y, r1, -2); // Simple rumble
                ctx.fillRect(seg.p1.screen.x+seg.p1.screen.w, seg.p1.screen.y, r1, -2);

                maxY = seg.p1.screen.y;
            }
            this.player(ctx, w, h, phys);
        },
        player: function(ctx, w, h, phys) {
            const scale = w * 0.004;
            const spriteY = h - 50 - (phys.playerY * 2);
            ctx.save();
            ctx.translate(w/2, spriteY);
            ctx.scale(scale, scale);
            ctx.rotate(phys.visualTilt * 0.02);

            ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(0, 30, 60, 15, 0, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.moveTo(-30,-20); ctx.lineTo(30,-20); ctx.lineTo(40,20); ctx.lineTo(-40,20); ctx.fill();
            const wc = phys.miniTurbo > 100 ? '#ffff00' : '#333';
            ctx.fillStyle = wc; ctx.fillRect(-45, 5, 15, 25); ctx.fillRect(30, 5, 15, 25);
            ctx.fillStyle = '#f5cba7'; ctx.beginPath(); ctx.arc(0, -30, 20, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(0, -35, 22, Math.PI, 0); ctx.fill();
            if(phys.boostTimer > 0) { ctx.fillStyle = '#00ffff'; ctx.beginPath(); ctx.moveTo(0, 20); ctx.lineTo(-10, 50); ctx.lineTo(10, 50); ctx.fill(); }
            ctx.restore();
        }
    };

    // --- LÓGICA DO JOGO ---
    const Logic = {
        segments: [], trackLength: 0,
        input: { steer: 0, throttle: false, brake: false, drift: false },
        lap: 1, lastTime: 0,

        init: function() {
            this.buildTrack();
            Physics.reset();
            this.lap = 1;
            this.setupUI();
            window.System.msg("LARGADA!");
        },

        setupUI: function() {
            const layer = document.getElementById('kart-ui-layer');
            if(layer) layer.innerHTML = '<div style="position:absolute; bottom:20px; right:20px; color:#fff; font-size:40px; font-weight:bold;"><span id="k-speed">0</span> KM/H</div>';
        },

        buildTrack: function() {
            this.segments = [];
            const add = (enter, curve) => {
                for(let i=0; i<enter; i++) {
                    this.segments.push({
                        index: this.segments.length,
                        p1: { world: { z: this.segments.length * K.SEGMENT_LENGTH }, camera: {}, screen: {} },
                        p2: { world: { z: (this.segments.length+1) * K.SEGMENT_LENGTH }, camera: {}, screen: {} },
                        curve: curve,
                        color: {
                            grass: Math.floor(i/3)%2 ? '#2ecc71' : '#27ae60',
                            road: Math.floor(i/3)%2 ? '#555' : '#505050',
                            rumble: Math.floor(i/3)%2 ? '#c0392b' : '#ecf0f1'
                        }
                    });
                }
            };
            add(50, 0); add(40, 2); add(20, 0); add(40, -2); add(50, 0); add(30, 4); add(60, 0);
            this.trackLength = this.segments.length * K.SEGMENT_LENGTH;
        },

        update: function(ctx, w, h, pose) {
            const now = performance.now();
            const dt = 0.016; // Fixed step para estabilidade
            this.lastTime = now;

            // Input
            if(pose) {
                const lw = pose.keypoints.find(k=>k.name==='left_wrist');
                const rw = pose.keypoints.find(k=>k.name==='right_wrist');
                if(lw && rw && lw.score > 0.3 && rw.score > 0.3) {
                    const l = window.Gfx.map(lw, w, h);
                    const r = window.Gfx.map(rw, w, h);
                    const angle = Math.atan2(r.y - l.y, r.x - l.x);
                    this.input.steer = Math.max(-1, Math.min(1, angle * 2));
                    this.input.throttle = true;
                    
                    ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 5;
                    ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(r.x, r.y); ctx.stroke(); ctx.restore();
                } else { this.input.throttle = false; }
            }

            Physics.update(dt, this.input, this.trackLength, this.segments[Math.floor(Physics.z/K.SEGMENT_LENGTH)%this.segments.length].curve);
            Renderer.draw(ctx, w, h, this.segments, Physics);

            const elSpeed = document.getElementById('k-speed');
            if(elSpeed) elSpeed.innerText = Math.floor(Physics.speed);

            if(Physics.z < 200 && this.oldZ > this.trackLength - 200) {
                this.lap++;
                window.System.msg("VOLTA " + this.lap);
                if(this.lap > K.TOTAL_LAPS) {
                    if(window.CoreFB && window.CoreFB.saveScore) window.CoreFB.saveScore('kart', Physics.speed * 100);
                    window.System.gameOver(Math.floor(Physics.speed * 100));
                }
            }
            this.oldZ = Physics.z;
            return Math.floor(Physics.speed);
        }
    };

    // --- AUTO-REGISTRO BLINDADO ---
    const tryReg = setInterval(() => {
        if(window.System && window.System.registerGame) {
            window.System.registerGame(GAME_ID, { name: 'Otto Kart Pro', icon: '🏎️', camOpacity: 0.4 }, Logic);
            clearInterval(tryReg);
        }
    }, 100);

})();