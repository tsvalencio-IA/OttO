/**
 * =============================================================================
 * OTTO KART: LEGACY EDITION (PORTING V5.0)
 * =============================================================================
 * PORT DIRETO DA ENGINE "THIAGO_WII" ORIGINAL PARA A NOVA ESTRUTURA.
 * MANTÉM: Física original, Gráficos originais, Volante detalhado.
 * ADICIONA: Compatibilidade com o Menu V10 e Firebase.
 * =============================================================================
 */

(function() {
    const GAME_ID = 'kart';

    // --- CONFIGURAÇÕES ORIGINAIS (TUNING) ---
    const CONF = {
        MAX_SPEED: 240,
        ACCEL: 1.5,
        BREAKING: -200,
        DECEL: -2,
        OFFROAD_DECEL: -120,
        OFFROAD_LIMIT: 60,
        SEGMENT_LENGTH: 200,
        RUMBLE_LENGTH: 3,
        ROAD_WIDTH: 2000,
        LANES: 3,
        CAMERA_HEIGHT: 1000,
        CAMERA_DEPTH: 0.84,
        FOV: 800,
        DRAW_DISTANCE: 300,
        TOTAL_LAPS: 3
    };

    // --- CORES ORIGINAIS ---
    const COLORS = {
        SKY:  ['#0099ff', '#87CEEB'], // Azul Nintendo
        GRASS: ['#10AA10', '#009900'],
        ROAD:  ['#666666', '#636363'],
        RUMBLE:['#c0392b', '#ffffff'],
        LANE:  '#ffffff'
    };

    // --- ESTADO GLOBAL ---
    let segments = [];
    let cars = [];
    
    // --- UTILITÁRIOS (PROJEÇÃO 3D) ---
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
        percentRemaining: (n, total) => (n % total) / total
    };

    // --- LÓGICA DO JOGO ---
    const Logic = {
        position: 0,
        playerX: 0,
        speed: 0,
        steer: 0,
        lap: 1,
        rank: 8,
        
        hands: { lx:0, ly:0, rx:0, ry:0, active: false, angle: 0 },
        wheel: { angle: 0, opacity: 0 },

        init: function() {
            this.position = 0; 
            this.playerX = 0; 
            this.speed = 0;
            this.steer = 0;
            this.lap = 1;
            this.buildTrack();
            this.createRivais();
            window.System.msg("LARGADA!");
            if(window.Sfx) window.Sfx.boot();
        },

        // --- CONSTRUTOR DE PISTA (LEGADO) ---
        buildTrack: function() {
            segments = [];
            const addSegment = (curve, y) => {
                const n = segments.length;
                segments.push({
                    index: n,
                    p1: { world: { y: this.lastY, z: n * CONF.SEGMENT_LENGTH }, camera: {}, screen: {} },
                    p2: { world: { y: y, z: (n+1) * CONF.SEGMENT_LENGTH }, camera: {}, screen: {} },
                    curve: curve,
                    sprites: [],
                    color: {
                        road:   Math.floor(n/CONF.RUMBLE_LENGTH)%2 ? COLORS.ROAD[0] : COLORS.ROAD[1],
                        grass:  Math.floor(n/CONF.RUMBLE_LENGTH)%2 ? COLORS.GRASS[0] : COLORS.GRASS[1],
                        rumble: Math.floor(n/CONF.RUMBLE_LENGTH)%2 ? COLORS.RUMBLE[0] : COLORS.RUMBLE[1],
                        lane:   Math.floor(n/CONF.RUMBLE_LENGTH)%2 ? COLORS.LANE : null
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
            // Layout da Pista "Otto Circuit"
            addRoad(50, 50, 50,  0,  0);
            addRoad(40, 40, 40,  4,  0);
            addRoad(60, 60, 60, -2,  40);
            addRoad(40, 40, 40, -5, -40);
            addRoad(80, 80, 80,  0,  0);
            addRoad(30, 30, 30,  3,  10);
            addRoad(30, 30, 30, -3, -10);
            addRoad(100, 50, 50, 0,  0);

            // Decoração
            for(let i=20; i<segments.length; i+=20) {
                if(Math.random() > 0.6) segments[i].sprites.push({ type: 'tree', offset: -1.5 - Math.random() });
                if(Math.random() > 0.6) segments[i].sprites.push({ type: 'tree', offset:  1.5 + Math.random() });
            }
            this.trackLength = segments.length * CONF.SEGMENT_LENGTH;
        },

        createRivais: function() {
            cars = [];
            const colors = ['#e74c3c', '#f1c40f', '#3498db', '#9b59b6', '#2ecc71', '#e67e22', '#34495e'];
            for(let i=0; i<7; i++) {
                cars.push({ 
                    z: (i+1) * 800, 
                    speed: CONF.MAX_SPEED * (0.85 + (i*0.01)), 
                    offset: (Math.random()-0.5) * 0.8, 
                    color: colors[i] 
                });
            }
        },

        // --- UPDATE LOOP ---
        update: function(ctx, w, h, pose) {
            const dt = 1/60;

            // 1. INPUT (Controle por Gestos ou Setas)
            let throttle = false;
            
            // Controle por Teclado (Fallback para testes)
            // (Adicione aqui se quiser testar no PC sem câmera, mas o foco é IA)
            
            // Controle por IA (Mãos)
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
                    
                    this.wheel.angle += (angle - this.wheel.angle) * 0.2;
                    this.wheel.opacity = Math.min(1, this.wheel.opacity + 0.1);
                    
                    this.steer = Math.max(-1, Math.min(1, angle * 2.5));
                    throttle = true; // Acelera se detectar mãos
                } else {
                    this.hands.active = false;
                    this.wheel.opacity = Math.max(0, this.wheel.opacity - 0.1);
                }
            }

            // 2. FÍSICA (Aqui faz o carro andar!)
            if (throttle) {
                this.speed = Util.easeIn(this.speed, CONF.MAX_SPEED, 0.02);
            } else {
                this.speed = Util.easeIn(this.speed, 0, 0.05);
            }

            this.position += this.speed * dt; // INCREMENTA POSIÇÃO
            while(this.position >= this.trackLength) this.position -= this.trackLength;
            while(this.position < 0) this.position += this.trackLength;

            const playerSeg = segments[Math.floor(this.position/CONF.SEGMENT_LENGTH) % segments.length];
            const speedPct = this.speed / CONF.MAX_SPEED;
            const dx = dt * 2 * speedPct;
            
            this.playerX -= (dx * playerSeg.curve * speedPct * 0.35);
            this.playerX += (dx * this.steer * 1.8);
            this.playerX = Math.max(-2.5, Math.min(2.5, this.playerX));

            // Offroad Check
            if(Math.abs(this.playerX) > 2.0) {
                this.speed = Math.min(this.speed, CONF.OFFROAD_LIMIT * 100); // Freia na grama
            }

            // 3. RIVAIS
            let pAhead = 0;
            cars.forEach(car => {
                car.z += car.speed * dt;
                if(car.z >= this.trackLength) car.z -= this.trackLength;
                if(car.z > this.position) pAhead++;
            });
            this.rank = 1 + pAhead;

            // 4. RENDERIZAÇÃO
            this.render(ctx, w, h, playerSeg);

            // 5. VOLTAS
            if(this.position < 1000 && this.oldPos > this.trackLength - 1000) {
                this.lap++;
                window.System.msg("VOLTA " + this.lap);
                if(this.lap > CONF.TOTAL_LAPS) {
                    const score = Math.floor(this.speed * 10) + (1000 - this.rank*100);
                    if(window.CoreFB) window.CoreFB.saveScore(GAME_ID, score);
                    window.System.gameOver(score);
                }
            }
            this.oldPos = this.position;

            return Math.floor(this.speed);
        },

        // --- RENDERIZADOR (PINTA O MUNDO) ---
        render: function(ctx, w, h, playerSeg) {
            // A. FUNDO (CÉU + MONTANHAS)
            // Céu
            const grad = ctx.createLinearGradient(0,0,0,h);
            grad.addColorStop(0, COLORS.SKY[0]); 
            grad.addColorStop(1, COLORS.SKY[1]);
            ctx.fillStyle = grad; 
            ctx.fillRect(0,0,w,h);

            // Montanhas (Parallax)
            ctx.fillStyle = '#2c3e50';
            ctx.beginPath();
            ctx.moveTo(0, h/2);
            for(let i=0; i<=w; i+=10) {
                const off = (playerSeg.curve * 300) + (this.steer * 200);
                const noise = Math.sin((i + this.position*0.005 + off) * 0.005) * 80;
                ctx.lineTo(i, (h/2) - 50 - Math.abs(noise));
            }
            ctx.lineTo(w, h/2);
            ctx.fill();

            // B. ESTRADA 3D
            let x = 0;
            let ddx = -(playerSeg.curve * Util.percentRemaining(this.position, CONF.SEGMENT_LENGTH));
            let maxY = h;
            const camY = CONF.CAMERA_HEIGHT;

            for(let n=0; n<CONF.DRAW_DISTANCE; n++) {
                const segIdx = (playerSeg.index + n) % segments.length;
                const seg = segments[segIdx];
                const looped = seg.index < playerSeg.index;
                
                Util.project(seg.p1, (this.playerX * CONF.ROAD_WIDTH) - x,       camY, this.position - (looped?this.trackLength:0), w, h, CONF.CAMERA_DEPTH);
                Util.project(seg.p2, (this.playerX * CONF.ROAD_WIDTH) - x - ddx, camY, this.position - (looped?this.trackLength:0), w, h, CONF.CAMERA_DEPTH);

                x += ddx; ddx += seg.curve;

                if(seg.p1.camera.z <= CONF.CAMERA_DEPTH || seg.p2.screen.y >= maxY) continue;

                // Desenha Grama
                ctx.fillStyle = seg.color.grass;
                ctx.fillRect(0, seg.p2.screen.y, w, seg.p1.screen.y - seg.p2.screen.y);

                // Desenha Zebra
                this.poly(ctx, seg.p1.screen.x, seg.p1.screen.y, seg.p1.screen.w, seg.p2.screen.x, seg.p2.screen.y, seg.p2.screen.w, seg.color.rumble);
                
                // Desenha Estrada
                const rW1 = seg.p1.screen.w * 0.8; const rW2 = seg.p2.screen.w * 0.8;
                this.poly(ctx, seg.p1.screen.x, seg.p1.screen.y, rW1, seg.p2.screen.x, seg.p2.screen.y, rW2, seg.color.road);

                // Faixa
                if(seg.color.lane) this.poly(ctx, seg.p1.screen.x, seg.p1.screen.y, rW1*0.02, seg.p2.screen.x, seg.p2.screen.y, rW2*0.02, seg.color.lane);

                maxY = seg.p1.screen.y;
            }

            // C. SPRITES (De trás para frente)
            for(let n=CONF.DRAW_DISTANCE-1; n>0; n--) {
                const segIdx = (playerSeg.index + n) % segments.length;
                const seg = segments[segIdx];
                const scale = seg.p1.screen.scale;

                // Rivais
                cars.forEach(car => {
                    if(Math.floor(car.z / CONF.SEGMENT_LENGTH) % segments.length === segIdx) {
                        const sX = seg.p1.screen.x + (car.offset * seg.p1.screen.w * 2);
                        const sY = seg.p1.screen.y;
                        this.drawRival(ctx, sX, sY, scale * w * 0.003, car.color);
                    }
                });

                // Árvores
                seg.sprites.forEach(s => {
                    const sX = seg.p1.screen.x + (s.offset * seg.p1.screen.w * 3);
                    const sY = seg.p1.screen.y;
                    this.drawTree(ctx, sX, sY, scale * w * 0.003);
                });
            }

            // D. INTERFACE
            this.drawWheel(ctx, w, h);
            this.drawHUD(ctx, w, h);
        },

        poly: function(ctx, x1, y1, w1, x2, y2, w2, color) {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(x1-w1, y1); ctx.lineTo(x2-w2, y2); ctx.lineTo(x2+w2, y2); ctx.lineTo(x1+w1, y1); ctx.fill();
        },

        drawTree: function(ctx, x, y, scale) {
            const w = 200*scale; const h = 300*scale;
            ctx.save(); ctx.translate(x, y);
            ctx.fillStyle = '#8B4513'; ctx.fillRect(-w/10, -h, w/5, h);
            ctx.fillStyle = '#228B22'; ctx.beginPath(); ctx.arc(0, -h*0.9, w*0.8, 0, Math.PI*2); ctx.fill();
            ctx.restore();
        },

        drawRival: function(ctx, x, y, scale, color) {
            const w = 80*scale; const h = 60*scale;
            ctx.save(); ctx.translate(x, y);
            ctx.fillStyle = color; ctx.fillRect(-w/2, -h, w, h*0.6);
            ctx.fillStyle = '#111'; ctx.fillRect(-w*0.6, -h*0.4, w*0.2, h*0.4); ctx.fillRect(w*0.4, -h*0.4, w*0.2, h*0.4);
            ctx.restore();
        },

        drawWheel: function(ctx, w, h) {
            if(this.wheel.opacity <= 0.01) return;
            const cx = (this.hands.lx + this.hands.rx) / 2;
            const cy = (this.hands.ly + this.hands.ry) / 2;
            const r = Math.hypot(this.hands.lx - this.hands.rx, this.hands.ly - this.hands.ry) / 2;

            ctx.save();
            ctx.globalAlpha = this.wheel.opacity;
            ctx.translate(cx, cy);
            ctx.rotate(this.wheel.angle);

            // Aro
            ctx.lineWidth = 15; ctx.strokeStyle = '#222'; ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.stroke();
            // Grips Azuis
            ctx.fillStyle = '#3498db';
            ctx.beginPath(); ctx.arc(-r*0.9, 0, r*0.15, 0, Math.PI*2); ctx.fill(); 
            ctx.beginPath(); ctx.arc(r*0.9, 0, r*0.15, 0, Math.PI*2); ctx.fill();
            // Marcador Vermelho
            ctx.fillStyle = '#ff0000'; ctx.fillRect(-5, -r-5, 10, 20);
            
            ctx.restore();
            ctx.globalAlpha = 1;
        },

        drawHUD: function(ctx, w, h) {
            // Velocímetro
            ctx.font = "italic bold 60px 'Russo One'";
            ctx.textAlign = "right"; ctx.fillStyle = "#fff"; ctx.strokeStyle="#000"; ctx.lineWidth=3;
            const spd = Math.floor(this.speed);
            ctx.strokeText(spd, w-30, h-40); ctx.fillText(spd, w-30, h-40);
            ctx.font = "20px Arial"; ctx.fillText("KM/H", w-30, h-20);

            // Rank
            ctx.textAlign="left"; ctx.font="bold 80px 'Russo One'";
            ctx.fillStyle = this.rank===1 ? '#ffd700' : '#fff';
            ctx.strokeText(this.rank+"º", 30, h-40); ctx.fillText(this.rank+"º", 30, h-40);

            // Aviso
            if(!this.hands.active) {
                ctx.fillStyle="rgba(0,0,0,0.6)"; ctx.fillRect(0, h/2-40, w, 80);
                ctx.fillStyle="#fff"; ctx.textAlign="center"; ctx.font="30px Arial";
                ctx.fillText("LEVANTE AS MÃOS", w/2, h/2+10);
            }
        }
    };

    // --- REGISTRO NO MENU ---
    const loop = setInterval(() => {
        if(window.System && window.System.registerGame) {
            window.System.registerGame(GAME_ID, { name:'Otto Kart', icon:'🏎️', camOpacity:0.3 }, Logic);
            clearInterval(loop);
        }
    }, 100);

})();