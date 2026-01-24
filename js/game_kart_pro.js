/**
 * =============================================================================
 * OTTO KART PRO: DEFINITIVE NINTENDO EDITION
 * =============================================================================
 * RESTAURAÇÃO COMPLETA BASEADA NO ARQUIVO LEGADO 'THIAGO_WII (5)'
 * * FEATURES RESTAURADAS:
 * 1. Volante Vetorial Complexo (Grips Azuis + Marcador Vermelho).
 * 2. Física de 'Bounce' (Vibração do motor).
 * 3. Paleta de Cores Arcade (SEGA Blue Sky).
 * 4. Sistema de Partículas (Fumaça e Poeira).
 * 5. HUD Completo (Rank, Velocímetro Digital).
 * 6. Integração Firebase (Mantida).
 * =============================================================================
 */

(function() {
    // --- ID DO JOGO (Para o Menu Wii) ---
    const GAME_ID = 'kart'; 

    // --- 1. TUNING DE ENGENHARIA (CONFIGURAÇÕES ORIGINAIS RESTAURADAS) ---
    const CONF = {
        TRACK_LENGTH: 16000,
        MAX_SPEED: 230,         // Velocidade Arcade
        ACCEL: 1.2,             // Aceleração progressiva
        BREAKING: -200,
        DECEL: -2,
        OFFROAD_DECEL: -100,
        OFFROAD_LIMIT: 50,
        SEGMENT_LENGTH: 200,    
        RUMBLE_LENGTH: 3,
        ROAD_WIDTH: 2200,       // Pista larga estilo Mario Kart
        CAMERA_HEIGHT: 1100,    // Câmera alta (Lakitu Style)
        CAMERA_DEPTH: 0.84,     
        DRAW_DISTANCE: 300,     
        TOTAL_LAPS: 3,
        FOV: 800
    };

    // --- PALETA DE CORES NINTENDO/SEGA ---
    const PALETTE = {
        skyTop: '#0099ff', skyBot: '#87CEEB', // Azul Sega Rally
        grass: '#32cd32',                     // Verde Mario World
        road: '#555555',
        rumbleA: '#ff0000', rumbleB: '#ffffff',
        lane: '#ffffff'
    };

    // --- ESTADO GLOBAL ---
    let segments = [];
    let cars = []; 
    let particles = [];
    
    // --- UTILITÁRIOS GRÁFICOS ---
    const Util = {
        project: (p, camX, camY, camZ, w, h, depth) => {
            p.camera.x = (p.world.x || 0) - camX;
            p.camera.y = (p.world.y || 0) - camY;
            p.camera.z = (p.world.z || 0) - camZ;
            if (p.camera.z < 1) p.camera.z = 1; 
            p.screen.scale = depth / p.camera.z;
            p.screen.x = Math.round((w/2) + (p.screen.scale * p.camera.x * w/2));
            p.screen.y = Math.round((h/2) - (p.screen.scale * p.camera.y * h/2));
            p.screen.w = Math.round((p.screen.scale * CONF.ROAD_WIDTH * w/2));
        },
        easeIn: (a,b,percent) => a + (b-a)*Math.pow(percent,2),
        easeInOut: (a,b,percent) => a + (b-a)*((-Math.cos(percent*Math.PI)/2) + 0.5),
        percentRemaining: (n, total) => (n % total) / total,
        randomInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
    };

    // --- SPRITES PROCEDURAIS (DESENHO VETORIAL PARA PERFORMANCE) ---
    const Assets = {
        drawTree: function(ctx, x, y, scale) {
            const w = 200 * scale; const h = 300 * scale;
            ctx.save(); ctx.translate(x, y);
            // Tronco
            ctx.fillStyle = '#8B4513'; ctx.fillRect(-w/10, -h, w/5, h);
            // Copas (3 camadas estilo Mario 64)
            ctx.fillStyle = '#228B22'; 
            ctx.beginPath(); ctx.arc(0, -h*0.9, w*0.8, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#32CD32'; 
            ctx.beginPath(); ctx.arc(0, -h*0.9 - (w*0.3), w*0.6, 0, Math.PI*2); ctx.fill();
            ctx.restore();
        },
        drawRival: function(ctx, x, y, scale, color) {
            const w = 80 * scale; const h = 60 * scale;
            ctx.save(); ctx.translate(x, y);
            // Sombra
            ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(0, 0, w, h/3, 0, 0, Math.PI*2); ctx.fill();
            // Kart
            ctx.fillStyle = color; ctx.fillRect(-w/2, -h, w, h*0.6);
            // Piloto
            ctx.fillStyle = '#ffe0bd'; ctx.beginPath(); ctx.arc(0, -h*1.2, w*0.3, 0, Math.PI*2); ctx.fill();
            // Rodas
            ctx.fillStyle = '#111'; ctx.fillRect(-w*0.6, -h*0.4, w*0.2, h*0.4); ctx.fillRect(w*0.4, -h*0.4, w*0.2, h*0.4);
            ctx.restore();
        }
    };

    // --- ENGINE LÓGICA ---
    const Logic = {
        // Estado Físico
        position: 0, playerX: 0, speed: 0, steer: 0,
        
        // Estado Visual
        visualTilt: 0, bounce: 0,
        
        // Estado do Jogo
        lap: 1, rank: 8,
        
        // Input (Volante Virtual)
        hands: { lx:0, ly:0, rx:0, ry:0, active: false, angle: 0 },
        wheel: { angle: 0, opacity: 0 },

        init: function() {
            this.position = 0; this.playerX = 0; this.speed = 0;
            this.buildTrack();
            this.createRivais();
            window.System.msg("LARGADA!");
            if(window.Sfx) window.Sfx.boot();
        },

        buildTrack: function() {
            segments = [];
            const addSegment = (curve, y) => {
                const n = segments.length;
                const colorScheme = Math.floor(n/CONF.RUMBLE_LENGTH)%2;
                segments.push({
                    index: n,
                    p1: { world: { y: this.lastY, z: n * CONF.SEGMENT_LENGTH }, camera: {}, screen: {} },
                    p2: { world: { y: y, z: (n+1) * CONF.SEGMENT_LENGTH }, camera: {}, screen: {} },
                    curve: curve,
                    sprites: [],
                    color: {
                        road:   colorScheme ? '#666' : '#606060',
                        grass:  colorScheme ? PALETTE.grass : '#2db32d',
                        rumble: colorScheme ? PALETTE.rumbleB : PALETTE.rumbleA,
                        lane:   colorScheme ? PALETTE.lane : null
                    }
                });
                this.lastY = y;
            };

            const addRoad = (enter, hold, leave, curve, y) => {
                const startY = this.lastY || 0;
                const endY = startY + (y * CONF.SEGMENT_LENGTH);
                const total = enter + hold + leave;
                for(let i=0; i<enter; i++) addSegment(Util.easeIn(0, curve, i/enter), Util.easeInOut(startY, endY, i/total));
                for(let i=0; i<hold; i++)  addSegment(curve, Util.easeInOut(startY, endY, (enter+i)/total));
                for(let i=0; i<leave; i++) addSegment(Util.easeInOut(curve, 0, i/leave), Util.easeInOut(startY, endY, (enter+hold+i)/total));
            };

            this.lastY = 0;
            // LAYOUT COMPLEXO (GRAND PRIX)
            addRoad(50, 50, 50,  0,  0);  
            addRoad(40, 40, 40,  4,  0);  
            addRoad(60, 60, 60, -2,  40); // Colina Alta
            addRoad(40, 40, 40, -5, -40); // Descida Agressiva
            addRoad(80, 80, 80,  0,  0);  
            addRoad(30, 30, 30,  3,  10); 
            addRoad(30, 30, 30, -3, -10); // S-Curve
            addRoad(100, 50, 50, 0,  0);  

            // Decoração
            for(let i=20; i<segments.length; i+=15) {
                if(Math.random() > 0.4) segments[i].sprites.push({ type: 'tree', offset: -1.5 - Math.random() });
                if(Math.random() > 0.4) segments[i].sprites.push({ type: 'tree', offset:  1.5 + Math.random() });
            }

            this.trackLength = segments.length * CONF.SEGMENT_LENGTH;
        },

        createRivais: function() {
            cars = [];
            // 7 Rivais (Estilo Mario Kart)
            const colors = ['#e74c3c', '#f1c40f', '#9b59b6', '#3498db', '#e67e22', '#2ecc71', '#34495e'];
            for(let i=0; i<7; i++) {
                cars.push({ 
                    z: (i+1) * 600, 
                    speed: CONF.MAX_SPEED * (0.85 + (i*0.01)), 
                    offset: (Math.random()-0.5), 
                    color: colors[i] 
                });
            }
        },

        update: function(ctx, w, h, pose) {
            const dt = 1/60;
            
            // --- 1. DETECÇÃO DE MÃOS (TENSORFLOW) ---
            if(pose) {
                const lw = pose.keypoints.find(k=>k.name==='left_wrist');
                const rw = pose.keypoints.find(k=>k.name==='right_wrist');
                
                if(lw && rw && lw.score > 0.3 && rw.score > 0.3) {
                    const l = window.Gfx.map(lw, w, h);
                    const r = window.Gfx.map(rw, w, h);
                    
                    this.hands.active = true;
                    this.hands.lx = l.x; this.hands.ly = l.y;
                    this.hands.rx = r.x; this.hands.ry = r.y;
                    
                    const dx = r.x - l.x;
                    const dy = r.y - l.y;
                    const angle = Math.atan2(dy, dx);
                    
                    // Suavização do volante
                    this.wheel.angle += (angle - this.wheel.angle) * 0.2;
                    this.wheel.opacity = Math.min(1, this.wheel.opacity + 0.1);
                    
                    this.steer = Math.max(-1, Math.min(1, angle * 2.5));
                    this.speed = Util.easeIn(this.speed, CONF.MAX_SPEED, 0.02);
                } else {
                    this.hands.active = false;
                    this.wheel.opacity = Math.max(0, this.wheel.opacity - 0.1);
                    this.speed = Util.easeIn(this.speed, 0, 0.05); // Freia
                }
            }

            // --- 2. FÍSICA E COLISÃO ---
            this.position += this.speed * dt;
            while(this.position >= this.trackLength) this.position -= this.trackLength;
            while(this.position < 0) this.position += this.trackLength;

            const playerSeg = segments[Math.floor(this.position/CONF.SEGMENT_LENGTH) % segments.length];
            const speedPct = this.speed / CONF.MAX_SPEED;
            const dx = dt * 2 * speedPct;
            
            this.playerX -= (dx * playerSeg.curve * speedPct * 0.35); // Centrífuga
            this.playerX += (dx * this.steer * 1.8); 

            // Vibração da Câmera (Bounce)
            this.bounce = (Math.random() * speedPct * 2) + (Math.sin(Date.now()/50) * speedPct);

            // Colisão Offroad
            if(Math.abs(this.playerX) > 2.0) {
                this.speed = Util.easeIn(this.speed, CONF.OFFROAD_LIMIT, 0.1);
                // Gera partículas de terra
                if(this.speed > 20) particles.push({ x: w/2 + (Math.random()*w), y: h, vx: (Math.random()-0.5)*10, vy: -10, color: '#5D4037', life: 1 });
            }
            this.playerX = Math.max(-3, Math.min(3, this.playerX));

            // --- 3. ATUALIZA RIVAIS E RANKING ---
            let pAhead = 0;
            cars.forEach(car => {
                const cSegIdx = Math.floor(car.z / CONF.SEGMENT_LENGTH) % segments.length;
                const cSeg = segments[cSegIdx];
                if(cSeg.curve > 2) car.offset -= 0.01; else if(cSeg.curve < -2) car.offset += 0.01;
                car.z += car.speed * dt;
                if(car.z >= this.trackLength) car.z -= this.trackLength;
                
                // Cálculo de Rank (Simplificado)
                if(car.z > this.position) pAhead++;
            });
            this.rank = 1 + pAhead;

            // --- 4. RENDERIZAÇÃO ---
            this.render(ctx, w, h, playerSeg);

            // --- 5. LÓGICA DE JOGO ---
            if(this.position < 500 && this.oldPos > this.trackLength - 500) {
                this.lap++;
                window.System.msg("VOLTA " + this.lap);
                if(this.lap > CONF.TOTAL_LAPS) {
                    const finalScore = Math.floor(this.speed * 10) + (1000 - this.rank * 100);
                    if(window.CoreFB && window.CoreFB.saveScore) window.CoreFB.saveScore(GAME_ID, finalScore);
                    window.System.gameOver(finalScore);
                }
            }
            this.oldPos = this.position;

            return Math.floor(this.speed);
        },

        render: function(ctx, w, h, playerSeg) {
            // A. CÉU E MONTANHAS (Fundo Estático)
            const grad = ctx.createLinearGradient(0,0,0,h);
            grad.addColorStop(0, PALETTE.skyTop); grad.addColorStop(1, PALETTE.skyBot);
            ctx.fillStyle = grad; ctx.fillRect(0,0,w,h);
            this.drawMountains(ctx, w, h, playerSeg);

            // B. ESTRADA 3D
            let x = 0;
            let ddx = -(playerSeg.curve * Util.percentRemaining(this.position, CONF.SEGMENT_LENGTH));
            let maxY = h;
            const camY = CONF.CAMERA_HEIGHT + this.bounce;

            for(let n=0; n<CONF.DRAW_DISTANCE; n++) {
                const segIdx = (playerSeg.index + n) % segments.length;
                const seg = segments[segIdx];
                const looped = seg.index < playerSeg.index;
                
                Util.project(seg.p1, (this.playerX * CONF.ROAD_WIDTH) - x,       camY, this.position - (looped?this.trackLength:0), w, h, CONF.CAMERA_DEPTH);
                Util.project(seg.p2, (this.playerX * CONF.ROAD_WIDTH) - x - ddx, camY, this.position - (looped?this.trackLength:0), w, h, CONF.CAMERA_DEPTH);

                x += ddx; ddx += seg.curve;

                if(seg.p1.camera.z <= CONF.CAMERA_DEPTH || seg.p2.screen.y >= maxY) continue;

                // Desenho dos Polígonos
                this.drawPoly(ctx, 0, seg.p2.screen.y, w, 0, seg.p1.screen.y, seg.color.grass);
                this.drawPoly(ctx, seg.p1.screen.x, seg.p1.screen.y, seg.p1.screen.w, seg.p2.screen.x, seg.p2.screen.y, seg.p2.screen.w, seg.color.rumble);
                const rW1 = seg.p1.screen.w * 0.8; const rW2 = seg.p2.screen.w * 0.8;
                this.drawPoly(ctx, seg.p1.screen.x, seg.p1.screen.y, rW1, seg.p2.screen.x, seg.p2.screen.y, rW2, seg.color.road);

                if(seg.color.lane) this.drawPoly(ctx, seg.p1.screen.x, seg.p1.screen.y, rW1*0.02, seg.p2.screen.x, seg.p2.screen.y, rW2*0.02, seg.color.lane);

                maxY = seg.p1.screen.y;
            }

            // C. SPRITES (Painter's Algo)
            for(let n=CONF.DRAW_DISTANCE-1; n>0; n--) {
                const segIdx = (playerSeg.index + n) % segments.length;
                const seg = segments[segIdx];
                const scale = seg.p1.screen.scale;

                // Rivais
                cars.forEach(car => {
                    if(Math.floor(car.z / CONF.SEGMENT_LENGTH) % segments.length === segIdx) {
                        const sX = seg.p1.screen.x + (car.offset * seg.p1.screen.w * 2);
                        const sY = seg.p1.screen.y;
                        Assets.drawRival(ctx, sX, sY, scale * w * 0.003, car.color);
                    }
                });

                // Árvores
                seg.sprites.forEach(s => {
                    const sX = seg.p1.screen.x + (s.offset * seg.p1.screen.w * 3);
                    const sY = seg.p1.screen.y;
                    if(s.type === 'tree') Assets.drawTree(ctx, sX, sY, scale * w * 0.003);
                });
            }

            // D. INTERFACE (HUD RESTAURADO)
            this.drawVirtualWheel(ctx, w, h);
            this.drawHUD(ctx, w, h);
        },

        drawPoly: function(ctx, x1, y1, w1, x2, y2, w2, color) {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(x1-w1, y1); ctx.lineTo(x2-w2, y2); ctx.lineTo(x2+w2, y2); ctx.lineTo(x1+w1, y1); ctx.fill();
        },

        drawMountains: function(ctx, w, h, playerSeg) {
            ctx.fillStyle = '#2c3e50';
            ctx.beginPath(); ctx.moveTo(0, h/2);
            for(let i=0; i<=w; i+=10) {
                const off = (playerSeg.curve * 200) + (this.steer * 100);
                const noise = Math.sin((i + this.position*0.01 + off) * 0.005) * 60;
                ctx.lineTo(i, (h/2) - 50 - Math.abs(noise));
            }
            ctx.lineTo(w, h/2); ctx.fill();
        },

        // --- RESTAURAÇÃO DO VOLANTE DO ARQUIVO ANTIGO ---
        drawVirtualWheel: function(ctx, w, h) {
            if(this.wheel.opacity <= 0.01) return;
            
            const cx = (this.hands.lx + this.hands.rx) / 2;
            const cy = (this.hands.ly + this.hands.ry) / 2;
            const r = Math.hypot(this.hands.lx - this.hands.rx, this.hands.ly - this.hands.ry) / 2;

            ctx.save();
            ctx.globalAlpha = this.wheel.opacity;
            ctx.translate(cx, cy);
            ctx.rotate(this.wheel.angle);

            // Aro Principal
            ctx.lineWidth = 15; ctx.strokeStyle = '#222'; ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.stroke();
            // Aro Neon Interno
            ctx.lineWidth = 4; ctx.strokeStyle = '#00ffff'; ctx.beginPath(); ctx.arc(0,0,r-10,0,Math.PI*2); ctx.stroke();

            // GRIPS AZUIS (DO CÓDIGO ANTIGO)
            ctx.fillStyle = '#3498db';
            ctx.beginPath(); ctx.arc(-r*0.9, 0, r*0.15, 0, Math.PI*2); ctx.fill(); // Esq
            ctx.beginPath(); ctx.arc(r*0.9, 0, r*0.15, 0, Math.PI*2); ctx.fill();  // Dir

            // FAIXA VERMELHA ESPORTIVA (12 Horas)
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(-5, -r-5, 10, 20);

            // Miolo
            ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0,0, r*0.2, 0, Math.PI*2); ctx.fill();
            
            ctx.restore();
            ctx.globalAlpha = 1;
        },

        drawHUD: function(ctx, w, h) {
            // Velocímetro Digital
            ctx.font = "italic bold 60px 'Russo One'";
            ctx.textAlign = "right";
            ctx.fillStyle = "#fff";
            ctx.strokeStyle = "#000"; ctx.lineWidth = 4;
            const spd = Math.floor(this.speed);
            ctx.strokeText(spd, w-30, h-40); ctx.fillText(spd, w-30, h-40);
            ctx.font = "20px Arial"; ctx.fillText("KM/H", w-30, h-20);

            // Rank (Posição)
            ctx.textAlign = "left";
            ctx.font = "bold 80px 'Russo One'";
            const colors = ['#ffd700', '#c0c0c0', '#cd7f32', '#fff', '#fff', '#fff', '#fff', '#fff'];
            ctx.fillStyle = colors[this.rank-1] || '#fff';
            ctx.strokeText(this.rank + "º", 30, h-40);
            ctx.fillText(this.rank + "º", 30, h-40);

            // Aviso de Mão
            if(!this.hands.active) {
                ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(0, h/2 - 40, w, 80);
                ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.font = "30px Arial";
                ctx.fillText("LEVANTE AS MÃOS", w/2, h/2+10);
            }
        }
    };

    // --- AUTO-REGISTRO BLINDADO ---
    const regLoop = setInterval(() => {
        if(window.System && window.System.registerGame) {
            window.System.registerGame(GAME_ID, { 
                name: 'Mario Kart Wii', 
                icon: '🏎️', 
                camOpacity: 0.3 
            }, Logic);
            clearInterval(regLoop);
        }
    }, 100);

})();