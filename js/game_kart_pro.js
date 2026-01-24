/**
 * =============================================================================
 * OTTO KART PRO: ULTIMATE HYBRID EDITION
 * =============================================================================
 * FUSÃO: Física Vetorial (Nova) + Renderização Rica (Antiga) + UI HUD (Wii)
 */

(function() {
    // --- ID DO JOGO (Para o Menu Wii) ---
    const GAME_ID = 'kart'; 

    // --- CONFIGURAÇÕES VISUAIS E DE FÍSICA ---
    const CONF = {
        MAX_SPEED: 24000,       // Escala interna de velocidade
        ACCEL: 100,             
        BREAKING: -200,
        DECEL: -50,
        OFFROAD_DECEL: -300,
        OFFROAD_LIMIT: 6000,
        SEGMENT_LENGTH: 200,    // Tamanho do segmento de pista
        RUMBLE_LENGTH: 3,
        ROAD_WIDTH: 2000,       // Largura da estrada
        CAMERA_HEIGHT: 1000,    // Altura da câmera
        CAMERA_DEPTH: 0.84,     // Distância focal (FOV)
        FOG_DENSITY: 5,
        DRAW_DISTANCE: 300,     // Distância de visão
        TOTAL_LAPS: 3
    };

    // --- VARIÁVEIS DE ESTADO (MEMORY SAFE) ---
    let segments = [];
    let cars = []; // Rivais
    let player = null; // Referência ao jogador
    
    // --- UTILITÁRIOS INTERNOS ---
    const Util = {
        project: (p, camX, camY, camZ, w, h, depth) => {
            p.camera.x = (p.world.x || 0) - camX;
            p.camera.y = (p.world.y || 0) - camY;
            p.camera.z = (p.world.z || 0) - camZ;
            
            // Evita divisão por zero ou projeção atrás da câmera
            if (p.camera.z < 1) p.camera.z = 1; 
            
            p.screen.scale = depth / p.camera.z;
            p.screen.x = Math.round((w/2) + (p.screen.scale * p.camera.x * w/2));
            p.screen.y = Math.round((h/2) - (p.screen.scale * p.camera.y * h/2));
            p.screen.w = Math.round((p.screen.scale * CONF.ROAD_WIDTH * w/2));
        },
        overlap: (x1, w1, x2, w2, percent) => {
            const half = (percent || 1) / 2;
            const min1 = x1 - (w1 * half); const max1 = x1 + (w1 * half);
            const min2 = x2 - (w2 * half); const max2 = x2 + (w2 * half);
            return !((max1 < min2) || (min1 > max2));
        },
        randomInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
        easeIn: (a,b,percent) => a + (b-a)*Math.pow(percent,2),
        easeInOut: (a,b,percent) => a + (b-a)*((-Math.cos(percent*Math.PI)/2) + 0.5)
    };

    // --- SPRITES E ASSETS (Gerados via Código para não depender de imagens externas) ---
    const Sprites = {
        BILLBOARD: { w: 300, h: 180, color: '#f1c40f', text: 'OTTO' },
        TREE:      { w: 200, h: 300, color: '#2ecc71', type: 'tree' },
        RIVAL:     { w: 80,  h: 70,  color: '#e74c3c' }
    };

    // --- ENGINE LÓGICA ---
    const Logic = {
        // Física do Jogador
        position: 0,
        playerX: 0,
        speed: 0,
        steer: 0,
        
        // Estado
        lap: 1,
        lapTime: 0,
        totalTime: 0,
        rank: 4,
        
        // Input Visual
        hands: { lx:0, ly:0, rx:0, ry:0, active: false, angle: 0 },
        
        init: function() {
            this.reset();
            this.buildTrack();
            this.createRivais();
            window.System.msg("LARGADA!");
            if(window.Sfx) window.Sfx.boot();
        },

        reset: function() {
            this.position = 0;
            this.playerX = 0;
            this.speed = 0;
            this.steer = 0;
            this.lap = 1;
            this.lapTime = 0;
        },

        // --- CONSTRUÇÃO DA PISTA (RICA E COM CURVAS) ---
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
                    cars: [],
                    color: {
                        road:   Math.floor(n/CONF.RUMBLE_LENGTH)%2 ? '#666666' : '#636363',
                        grass:  Math.floor(n/CONF.RUMBLE_LENGTH)%2 ? '#10aa10' : '#009900',
                        rumble: Math.floor(n/CONF.RUMBLE_LENGTH)%2 ? '#ffffff' : '#c0392b',
                        lane:   Math.floor(n/CONF.RUMBLE_LENGTH)%2 ? '#ffffff' : ''
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

            const addSprite = (n, sprite, offset) => {
                segments[n].sprites.push({ source: sprite, offset: offset });
            };

            this.lastY = 0;
            // LAYOUT DA PISTA (Curvas, Colinas, Retas)
            addRoad(50, 50, 50,  0,  0);  // Start
            addRoad(30, 30, 30,  4,  0);  // Curva Direita
            addRoad(40, 40, 40, -2,  20); // Subida Esquerda
            addRoad(50, 50, 50, -4, -10); // Descida Curva Esquerda
            addRoad(60, 60, 60,  3,  0);  // Curva Direita Longa
            addRoad(30, 30, 30,  0,  10); // Reta
            addRoad(20, 20, 20, -5,  0);  // Chicane
            addRoad(100, 50, 50, 0,  0);  // Reta Final

            // Decoração
            for(let i=20; i<segments.length; i+=30) {
                addSprite(i, Sprites.TREE, -1.5 - Math.random());
                addSprite(i, Sprites.TREE,  1.5 + Math.random());
            }
            for(let i=50; i<segments.length; i+=100) {
                addSprite(i, Sprites.BILLBOARD, -1.2);
            }

            this.trackLength = segments.length * CONF.SEGMENT_LENGTH;
        },

        createRivais: function() {
            cars = [];
            cars.push({ z: 1000, speed: CONF.MAX_SPEED * 0.90, sprite: Sprites.RIVAL, offset: -0.5, name: 'Luigi' });
            cars.push({ z: 3000, speed: CONF.MAX_SPEED * 0.85, sprite: Sprites.RIVAL, offset: 0.5, name: 'Toad' });
            cars.push({ z: 5000, speed: CONF.MAX_SPEED * 0.80, sprite: Sprites.RIVAL, offset: 0, name: 'Bowser' });
        },

        // --- UPDATE LOOP ---
        update: function(ctx, w, h, pose) {
            const dt = 1/60; // 60 FPS fixo para física
            
            // 1. INPUT (VISÃO COMPUTACIONAL)
            if(pose) {
                const lw = pose.keypoints.find(k=>k.name==='left_wrist');
                const rw = pose.keypoints.find(k=>k.name==='right_wrist');
                
                if(lw && rw && lw.score > 0.3 && rw.score > 0.3) {
                    const l = window.Gfx.map(lw, w, h);
                    const r = window.Gfx.map(rw, w, h);
                    
                    this.hands.active = true;
                    this.hands.lx = l.x; this.hands.ly = l.y;
                    this.hands.rx = r.x; this.hands.ry = r.y;
                    
                    // Cálculo do Ângulo do Volante
                    const dx = r.x - l.x;
                    const dy = r.y - l.y;
                    const angle = Math.atan2(dy, dx);
                    this.hands.angle = angle;

                    // Mapeia ângulo para direção (-1 a 1)
                    this.steer = Math.max(-1, Math.min(1, angle * 2.5));
                    
                    // Aceleração Automática se mãos detectadas
                    this.speed = Util.easeIn(this.speed, CONF.MAX_SPEED, 0.02);
                } else {
                    this.hands.active = false;
                    this.speed = Util.easeIn(this.speed, 0, 0.05); // Freia se perder rastreio
                }
            }

            // 2. FÍSICA DO JOGADOR
            this.position += this.speed * dt;
            while(this.position >= this.trackLength) this.position -= this.trackLength;
            while(this.position < 0) this.position += this.trackLength;

            // Centrífuga e Direção
            const playerSeg = segments[Math.floor(this.position/CONF.SEGMENT_LENGTH) % segments.length];
            const speedPct = this.speed / CONF.MAX_SPEED;
            const dx = dt * 2 * speedPct;
            
            this.playerX -= (dx * playerSeg.curve * speedPct * 0.3); // Força centrífuga
            this.playerX += (dx * this.steer * 2.0); // Direção do volante

            // Limites e Offroad
            if(Math.abs(this.playerX) > 2.0) {
                this.speed = Util.easeIn(this.speed, CONF.OFFROAD_LIMIT * 100, 0.1);
            }
            this.playerX = Math.max(-3, Math.min(3, this.playerX));

            // 3. FÍSICA DOS RIVAIS
            cars.forEach(car => {
                const carSegIdx = Math.floor(car.z / CONF.SEGMENT_LENGTH) % segments.length;
                const carSeg = segments[carSegIdx];
                
                // IA Básica: Segue a pista e desvia
                if(carSeg.curve > 2) car.offset -= 0.01;
                else if(carSeg.curve < -2) car.offset += 0.01;
                
                car.z += car.speed * dt;
                if(car.z >= this.trackLength) car.z -= this.trackLength;
            });

            // 4. CÁLCULO DE POSIÇÃO (RANKING)
            let pAhead = 0;
            const totalDistPlayer = (this.lap * this.trackLength) + this.position;
            cars.forEach(c => {
                // Simplificação de Ranking
                if(c.z > this.position) pAhead++;
            });
            this.rank = 1 + pAhead;

            // 5. RENDERIZAÇÃO
            this.render(ctx, w, h);

            // 6. DETECÇÃO DE VOLTA
            if(this.position < 500 && this.oldPos > this.trackLength - 500) {
                this.lap++;
                window.System.msg("VOLTA " + this.lap);
                if(this.lap > CONF.TOTAL_LAPS) {
                    if(window.CoreFB) window.CoreFB.saveScore(GAME_ID, Math.floor(this.speed));
                    window.System.gameOver(Math.floor(this.speed/100));
                }
            }
            this.oldPos = this.position;

            return Math.floor(this.speed / 100);
        },

        // --- RENDERIZADOR COMPLETO ---
        render: function(ctx, w, h) {
            // A. CÉU E CENÁRIO (PARALLAX)
            const playerSeg = segments[Math.floor(this.position/CONF.SEGMENT_LENGTH)%segments.length];
            const basePct = Util.percentRemaining(this.position, CONF.SEGMENT_LENGTH);
            
            // Céu Degradê
            const grad = ctx.createLinearGradient(0,0,0,h);
            grad.addColorStop(0, '#3498db'); grad.addColorStop(1, '#85c1e9');
            ctx.fillStyle = grad; ctx.fillRect(0,0,w,h);

            // Montanhas (Procedural)
            ctx.fillStyle = '#2c3e50';
            ctx.beginPath();
            ctx.moveTo(0, h/2);
            for(let i=0; i<=w; i+=10) {
                // Parallax baseada na curva da pista e steering
                const offset = (playerSeg.curve * 200 * basePct) + (this.steer * 50);
                const noise = Math.sin((i + this.position*0.01 + offset) * 0.01) * 50;
                ctx.lineTo(i, (h/2) - 50 - Math.abs(noise));
            }
            ctx.lineTo(w, h/2);
            ctx.fill();

            // B. ESTRADA 3D (PROJEÇÃO)
            let dx = -(playerSeg.curve * basePct);
            let x = 0;
            let maxY = h;
            const camY = CONF.CAMERA_HEIGHT;

            // Renderiza 300 segmentos à frente
            for(let n=0; n<CONF.DRAW_DISTANCE; n++) {
                const segIdx = (playerSeg.index + n) % segments.length;
                const seg = segments[segIdx];
                const looped = seg.index < playerSeg.index;
                const segZ = this.position - (looped ? this.trackLength : 0);
                
                // Projeção
                Util.project(seg.p1, (this.playerX * CONF.ROAD_WIDTH) - x,      camY, this.position - (looped?this.trackLength:0), w, h, CONF.CAMERA_DEPTH);
                Util.project(seg.p2, (this.playerX * CONF.ROAD_WIDTH) - x - dx, camY, this.position - (looped?this.trackLength:0), w, h, CONF.CAMERA_DEPTH);

                x += dx;
                dx += seg.curve;

                if(seg.p1.camera.z <= CONF.CAMERA_DEPTH || seg.p2.screen.y >= maxY || seg.p2.screen.y >= seg.p1.screen.y) continue;

                // Desenha o trapézio da estrada
                this.drawPoly(ctx, 0, seg.p2.screen.y, w, 0, seg.p1.screen.y, seg.color.grass); // Grama
                this.drawPoly(ctx, seg.p1.screen.x, seg.p1.screen.y, seg.p1.screen.w, seg.p2.screen.x, seg.p2.screen.y, seg.p2.screen.w, seg.color.rumble); // Zebra
                const rW1 = seg.p1.screen.w * 0.8; 
                const rW2 = seg.p2.screen.w * 0.8;
                this.drawPoly(ctx, seg.p1.screen.x, seg.p1.screen.y, rW1, seg.p2.screen.x, seg.p2.screen.y, rW2, seg.color.road); // Asfalto

                // Faixa Central
                if(seg.color.lane) {
                    const lW1 = rW1 * 0.02; const lW2 = rW2 * 0.02;
                    this.drawPoly(ctx, seg.p1.screen.x, seg.p1.screen.y, lW1, seg.p2.screen.x, seg.p2.screen.y, lW2, seg.color.lane);
                }

                maxY = seg.p1.screen.y;
            }

            // C. RENDERIZAÇÃO DE SPRITES (DE TRÁS PRA FRENTE)
            for(let n=CONF.DRAW_DISTANCE-1; n>0; n--) {
                const segIdx = (playerSeg.index + n) % segments.length;
                const seg = segments[segIdx];
                
                // 1. Sprites do Cenário
                seg.sprites.forEach(s => {
                    this.drawSprite(ctx, w, h, s.source, s.offset, seg.p1, seg);
                });

                // 2. Carros Rivais
                cars.forEach(car => {
                    const cSegIdx = Math.floor(car.z / CONF.SEGMENT_LENGTH) % segments.length;
                    if(cSegIdx === segIdx) {
                        // Interpolação para suavidade
                        const percent = (car.z % CONF.SEGMENT_LENGTH) / CONF.SEGMENT_LENGTH;
                        // Usa a projeção do segmento atual
                        const carScale = seg.p1.screen.scale; // Aproximado
                        const carX = seg.p1.screen.x + (car.offset * seg.p1.screen.w * 2); // Aproximado
                        const carY = seg.p1.screen.y;
                        
                        this.drawCar(ctx, carX, carY, carScale * 10, car.sprite.color);
                    }
                });
            }

            // D. HUD E VOLANTE (UI)
            this.drawHUD(ctx, w, h);
        },

        drawPoly: function(ctx, x1, y1, w1, x2, y2, w2, color) {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(x1-w1, y1);
            ctx.lineTo(x2-w2, y2);
            ctx.lineTo(x2+w2, y2);
            ctx.lineTo(x1+w1, y1);
            ctx.fill();
        },

        drawSprite: function(ctx, w, h, sprite, offset, point, seg) {
            const destX = point.screen.x + (point.screen.w * offset);
            const destY = point.screen.y;
            const destW = sprite.w * point.screen.scale * w/2 * 0.003;
            const destH = sprite.h * point.screen.scale * w/2 * 0.003;

            // Render Simples (Retângulo/Círculo)
            ctx.save();
            ctx.translate(destX, destY);
            if(sprite.type === 'tree') {
                ctx.fillStyle = '#8e44ad'; // Tronco
                ctx.fillRect(-destW/10, -destH, destW/5, destH);
                ctx.fillStyle = sprite.color; // Copa
                ctx.beginPath(); ctx.arc(0, -destH*0.8, destW, 0, Math.PI*2); ctx.fill();
            } else {
                // Placa
                ctx.fillStyle = '#f39c12';
                ctx.fillRect(-destW/2, -destH, destW, destH);
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(-destW/2, -destH, destW, destH);
            }
            ctx.restore();
        },

        drawCar: function(ctx, x, y, scale, color) {
            const w = 60 * scale;
            const h = 40 * scale;
            ctx.save();
            ctx.translate(x, y);
            // Sombra
            ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(0, 0, w/1.5, h/4, 0, 0, Math.PI*2); ctx.fill();
            // Carro
            ctx.fillStyle = color;
            ctx.fillRect(-w/2, -h, w, h/1.5);
            ctx.fillStyle = '#333'; // Rodas
            ctx.fillRect(-w/2 - w*0.1, -h/2, w*0.2, h/2);
            ctx.fillRect(w/2 - w*0.1, -h/2, w*0.2, h/2);
            ctx.restore();
        },

        // --- E. HUD: VOLANTE VIRTUAL, VELOCÍMETRO, MAPA ---
        drawHUD: function(ctx, w, h) {
            const cx = w/2;
            const cy = h/2;

            // 1. VOLANTE VIRTUAL ENTRE AS MÃOS (CRÍTICO)
            if(this.hands.active) {
                const hx = (this.hands.lx + this.hands.rx) / 2;
                const hy = (this.hands.ly + this.hands.ry) / 2;
                const radius = Math.hypot(this.hands.lx - this.hands.rx, this.hands.ly - this.hands.ry) / 2;

                ctx.save();
                ctx.translate(hx, hy);
                ctx.rotate(this.hands.angle);

                // Aro do Volante
                ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI*2);
                ctx.lineWidth = 10; ctx.strokeStyle = '#333'; ctx.stroke();
                ctx.lineWidth = 5; ctx.strokeStyle = '#e74c3c'; ctx.stroke(); // Highlight Vermelho Mario

                // Miolo
                ctx.fillStyle = '#ccc';
                ctx.beginPath(); ctx.arc(0, 0, radius*0.3, 0, Math.PI*2); ctx.fill();
                
                // Hastes
                ctx.beginPath(); ctx.moveTo(-radius*0.3, 0); ctx.lineTo(-radius, 0); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(radius*0.3, 0); ctx.lineTo(radius, 0); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0, radius*0.3); ctx.lineTo(0, radius); ctx.stroke();

                ctx.restore();

                // Debug Points das Mãos
                ctx.fillStyle = '#00ffff'; ctx.beginPath(); ctx.arc(this.hands.lx, this.hands.ly, 5, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#ff00ff'; ctx.beginPath(); ctx.arc(this.hands.rx, this.hands.ry, 5, 0, Math.PI*2); ctx.fill();
            } else {
                // Aviso de mão
                ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0, h/2 - 40, w, 80);
                ctx.fillStyle = "#fff"; ctx.font = "bold 30px 'Russo One'"; ctx.textAlign = "center";
                ctx.fillText("LEVANTE AS MÃOS PARA DIRIGIR", cx, cy + 10);
            }

            // 2. VELOCÍMETRO
            const kmh = Math.floor(this.speed / 100);
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'right';
            ctx.font = "bold 60px 'Russo One'";
            ctx.fillText(kmh, w - 20, h - 50);
            ctx.font = "20px Arial";
            ctx.fillText("KM/H", w - 20, h - 20);

            // 3. MINIMAPA
            const mapSize = 100;
            const mapX = 20; const mapY = h - 120;
            
            // Fundo Mapa
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(mapX, mapY, mapSize, mapSize);
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(mapX, mapY, mapSize, mapSize);

            // Jogador no Mapa
            const pct = this.position / this.trackLength;
            const myX = mapX + mapSize/2 + Math.cos(pct * Math.PI * 2) * (mapSize*0.4);
            const myY = mapY + mapSize/2 + Math.sin(pct * Math.PI * 2) * (mapSize*0.4);
            
            ctx.fillStyle = '#00ffff'; ctx.beginPath(); ctx.arc(myX, myY, 4, 0, Math.PI*2); ctx.fill();

            // Rivais no Mapa
            cars.forEach(c => {
                const cPct = c.z / this.trackLength;
                const cX = mapX + mapSize/2 + Math.cos(cPct * Math.PI * 2) * (mapSize*0.4);
                const cY = mapY + mapSize/2 + Math.sin(cPct * Math.PI * 2) * (mapSize*0.4);
                ctx.fillStyle = '#ff0000'; ctx.beginPath(); ctx.arc(cX, cY, 3, 0, Math.PI*2); ctx.fill();
            });
        }
    };

    // --- AUTO-REGISTRO NO MENU WII ---
    const tryReg = setInterval(() => {
        if(window.System && window.System.registerGame) {
            console.log("[KART PRO] Engine Carregada. Registrando...");
            window.System.registerGame(GAME_ID, { 
                name: 'Otto Kart Pro', 
                icon: '🏎️', 
                camOpacity: 0.4 
            }, Logic);
            clearInterval(tryReg);
        }
    }, 100);

})();