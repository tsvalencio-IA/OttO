/**
 * =============================================================================
 * OTTO KART PRO: PLATINUM EDITION (VISUAL RESTORED)
 * =============================================================================
 * A única versão que combina:
 * 1. O Sistema de Menu do Thiaguinho OS.
 * 2. O Visual rico (Volante, Pista 3D, Rivais) da versão clássica.
 * 3. A conexão com Firebase.
 * =============================================================================
 */

(function() {
    // --- ID PARA O MENU WII ---
    const GAME_ID = 'kart'; 

    // --- CONFIGURAÇÕES VISUAIS E FÍSICAS (TUNING) ---
    const CONF = {
        MAX_SPEED: 24000,       // Velocidade máxima interna
        ACCEL: 100,             // Aceleração
        BREAKING: -200,         // Freio
        DECEL: -50,             // Desaceleração natural
        OFFROAD_DECEL: -300,    // Grama
        OFFROAD_LIMIT: 6000,    // Limite na grama
        SEGMENT_LENGTH: 200,    // Comprimento do segmento 3D
        RUMBLE_LENGTH: 3,       // Tamanho das zebras
        ROAD_WIDTH: 2000,       // Largura da pista
        CAMERA_HEIGHT: 1000,    // Altura da câmera
        CAMERA_DEPTH: 0.84,     // Profundidade de campo (FOV)
        DRAW_DISTANCE: 300,     // Quantos segmentos desenhar (Visibilidade)
        TOTAL_LAPS: 3,
        COLORS: {
            SKY_TOP: '#3498db',    SKY_BOT: '#85c1e9',
            GRASS_L: '#10aa10',    GRASS_D: '#009900',
            ROAD_L:  '#666666',    ROAD_D:  '#636363',
            RUMBLE_L:'#ffffff',    RUMBLE_D:'#c0392b',
            LANE:    '#ffffff'
        }
    };

    // --- VARIÁVEIS DE MEMÓRIA ---
    let segments = [];
    let cars = []; // Rivais
    
    // --- UTILITÁRIOS INTERNOS DE RENDERIZAÇÃO ---
    const Util = {
        project: (p, camX, camY, camZ, w, h, depth) => {
            p.camera.x = (p.world.x || 0) - camX;
            p.camera.y = (p.world.y || 0) - camY;
            p.camera.z = (p.world.z || 0) - camZ;
            
            // Proteção contra divisão por zero e objetos atrás da câmera
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

    // --- SPRITES PROCEDURAIS (DESENHADOS VIA CÓDIGO) ---
    const Sprites = {
        BILLBOARD: { w: 300, h: 180, color: '#f1c40f', type: 'sign' },
        TREE:      { w: 200, h: 300, color: '#2ecc71', type: 'tree' },
        RIVAL:     { w: 80,  h: 70,  color: '#e74c3c', type: 'car' }
    };

    // --- LÓGICA PRINCIPAL ---
    const Logic = {
        // Estado do Jogador
        position: 0,
        playerX: 0,
        speed: 0,
        steer: 0,
        
        // Estado do Jogo
        lap: 1,
        totalTime: 0,
        rank: 4,
        
        // Estado das Mãos (TensorFlow)
        hands: { lx:0, ly:0, rx:0, ry:0, active: false, angle: 0 },
        
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

        // --- CONSTRUÇÃO DA PISTA ---
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
                        road:   colorScheme ? CONF.COLORS.ROAD_L : CONF.COLORS.ROAD_D,
                        grass:  colorScheme ? CONF.COLORS.GRASS_L : CONF.COLORS.GRASS_D,
                        rumble: colorScheme ? CONF.COLORS.RUMBLE_L : CONF.COLORS.RUMBLE_D,
                        lane:   colorScheme ? CONF.COLORS.LANE : null
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
                if(segments[n]) segments[n].sprites.push({ source: sprite, offset: offset });
            };

            this.lastY = 0;
            // DESIGN DA PISTA
            addRoad(50, 50, 50,  0,  0);  // Reta Inicial
            addRoad(30, 30, 30,  4,  0);  // Curva Direita
            addRoad(40, 40, 40, -2,  20); // Subida Esquerda
            addRoad(50, 50, 50, -4, -10); // Descida Curva Esquerda
            addRoad(60, 60, 60,  3,  0);  // Curva Direita Longa
            addRoad(30, 30, 30,  0,  10); // Reta
            addRoad(20, 20, 20, -5,  0);  // Chicane
            addRoad(100, 50, 50, 0,  0);  // Reta Final

            // Decoração (Árvores e Placas)
            for(let i=20; i<segments.length; i+=20) {
                if(Math.random() > 0.5) addSprite(i, Sprites.TREE, -1.5 - Math.random());
                if(Math.random() > 0.5) addSprite(i, Sprites.TREE,  1.5 + Math.random());
            }
            for(let i=50; i<segments.length; i+=80) {
                addSprite(i, Sprites.BILLBOARD, -1.2);
            }

            this.trackLength = segments.length * CONF.SEGMENT_LENGTH;
        },

        createRivais: function() {
            cars = [];
            // Cria rivais em posições aleatórias à frente
            cars.push({ z: 1000, speed: CONF.MAX_SPEED * 0.92, sprite: Sprites.RIVAL, offset: -0.5, color: '#e74c3c' }); // Luigi (Vermelho/Verde)
            cars.push({ z: 3000, speed: CONF.MAX_SPEED * 0.88, sprite: Sprites.RIVAL, offset: 0.5,  color: '#f1c40f' }); // Toad (Amarelo)
            cars.push({ z: 5000, speed: CONF.MAX_SPEED * 0.85, sprite: Sprites.RIVAL, offset: 0,    color: '#3498db' }); // Bowser (Azul)
        },

        // --- UPDATE LOOP (FÍSICA + RENDERIZAÇÃO) ---
        update: function(ctx, w, h, pose) {
            const dt = 1/60; // Passo fixo de tempo
            
            // ----------------------------------------------------
            // 1. INPUT E CONTROLE (Volante Virtual)
            // ----------------------------------------------------
            if(pose) {
                const lw = pose.keypoints.find(k=>k.name==='left_wrist');
                const rw = pose.keypoints.find(k=>k.name==='right_wrist');
                
                if(lw && rw && lw.score > 0.3 && rw.score > 0.3) {
                    // Mapeia coordenadas para a tela
                    const l = window.Gfx.map(lw, w, h);
                    const r = window.Gfx.map(rw, w, h);
                    
                    this.hands.active = true;
                    this.hands.lx = l.x; this.hands.ly = l.y;
                    this.hands.rx = r.x; this.hands.ry = r.y;
                    
                    // Calcula ângulo
                    const dx = r.x - l.x;
                    const dy = r.y - l.y;
                    const angle = Math.atan2(dy, dx);
                    this.hands.angle = angle;

                    // Aplica direção (-1 a 1)
                    this.steer = Math.max(-1, Math.min(1, angle * 2.5));
                    
                    // Acelera automaticamente
                    this.speed = Util.easeIn(this.speed, CONF.MAX_SPEED, 0.02);
                } else {
                    this.hands.active = false;
                    this.speed = Util.easeIn(this.speed, 0, 0.05); // Freia
                }
            } else {
                // Fallback para teclado (setas) se necessário
                // (Opcional, focado na câmera por enquanto)
            }

            // ----------------------------------------------------
            // 2. FÍSICA DO KART
            // ----------------------------------------------------
            this.position += this.speed * dt;
            while(this.position >= this.trackLength) this.position -= this.trackLength;
            while(this.position < 0) this.position += this.trackLength;

            const playerSeg = segments[Math.floor(this.position/CONF.SEGMENT_LENGTH) % segments.length];
            const speedPct = this.speed / CONF.MAX_SPEED;
            const dx = dt * 2 * speedPct;
            
            this.playerX -= (dx * playerSeg.curve * speedPct * 0.3); // Centrífuga
            this.playerX += (dx * this.steer * 2.0); // Volante

            // Colisão com Bordas (Grama)
            if(Math.abs(this.playerX) > 2.0) {
                this.speed = Util.easeIn(this.speed, CONF.OFFROAD_LIMIT * 100, 0.1);
            }
            // Limite lateral
            this.playerX = Math.max(-3, Math.min(3, this.playerX));

            // ----------------------------------------------------
            // 3. FÍSICA DOS RIVAIS
            // ----------------------------------------------------
            cars.forEach(car => {
                const carSegIdx = Math.floor(car.z / CONF.SEGMENT_LENGTH) % segments.length;
                const carSeg = segments[carSegIdx];
                // IA Simples: Desviar das bordas
                if(carSeg.curve > 2) car.offset -= 0.01;
                else if(carSeg.curve < -2) car.offset += 0.01;
                
                car.z += car.speed * dt;
                if(car.z >= this.trackLength) car.z -= this.trackLength;
            });

            // ----------------------------------------------------
            // 4. RENDERIZAÇÃO (O GRANDE TRUQUE VISUAL)
            // ----------------------------------------------------
            
            // A. Limpar Tela e Desenhar Céu
            const grad = ctx.createLinearGradient(0,0,0,h);
            grad.addColorStop(0, CONF.COLORS.SKY_TOP); 
            grad.addColorStop(1, CONF.COLORS.SKY_BOT);
            ctx.fillStyle = grad; 
            ctx.fillRect(0,0,w,h);

            // B. Desenhar Montanhas (Parallax)
            this.drawBackground(ctx, w, h, playerSeg, this.steer);

            // C. Projeção 3D da Pista (Raycasting)
            let x = 0;
            let ddx = -(playerSeg.curve * Util.percentRemaining(this.position, CONF.SEGMENT_LENGTH));
            let maxY = h;
            const camY = CONF.CAMERA_HEIGHT;

            for(let n=0; n<CONF.DRAW_DISTANCE; n++) {
                const segIdx = (playerSeg.index + n) % segments.length;
                const seg = segments[segIdx];
                const looped = seg.index < playerSeg.index;
                const segZ = this.position - (looped ? this.trackLength : 0);
                
                // Projeta p1 e p2
                Util.project(seg.p1, (this.playerX * CONF.ROAD_WIDTH) - x,       camY, this.position - (looped?this.trackLength:0), w, h, CONF.CAMERA_DEPTH);
                Util.project(seg.p2, (this.playerX * CONF.ROAD_WIDTH) - x - ddx, camY, this.position - (looped?this.trackLength:0), w, h, CONF.CAMERA_DEPTH);

                x += ddx;
                ddx += seg.curve;

                if(seg.p1.camera.z <= CONF.CAMERA_DEPTH || seg.p2.screen.y >= maxY || seg.p2.screen.y >= seg.p1.screen.y) continue;

                // Desenha Grama, Zebra e Estrada
                this.drawPoly(ctx, 0, seg.p2.screen.y, w, 0, seg.p1.screen.y, seg.color.grass);
                this.drawPoly(ctx, seg.p1.screen.x, seg.p1.screen.y, seg.p1.screen.w, seg.p2.screen.x, seg.p2.screen.y, seg.p2.screen.w, seg.color.rumble);
                const rW1 = seg.p1.screen.w * 0.8; 
                const rW2 = seg.p2.screen.w * 0.8;
                this.drawPoly(ctx, seg.p1.screen.x, seg.p1.screen.y, rW1, seg.p2.screen.x, seg.p2.screen.y, rW2, seg.color.road);

                if(seg.color.lane) {
                    this.drawPoly(ctx, seg.p1.screen.x, seg.p1.screen.y, rW1*0.02, seg.p2.screen.x, seg.p2.screen.y, rW2*0.02, seg.color.lane);
                }

                maxY = seg.p1.screen.y;
            }

            // D. Sprites e Rivais (Painter's Algorithm: Trás para Frente)
            for(let n=CONF.DRAW_DISTANCE-1; n>0; n--) {
                const segIdx = (playerSeg.index + n) % segments.length;
                const seg = segments[segIdx];

                // Rivais
                cars.forEach(car => {
                    const cSegIdx = Math.floor(car.z / CONF.SEGMENT_LENGTH) % segments.length;
                    if(cSegIdx === segIdx) {
                        const spriteScale = seg.p1.screen.scale;
                        const spriteX = seg.p1.screen.x + (car.offset * seg.p1.screen.w * 2);
                        const spriteY = seg.p1.screen.y;
                        this.drawCar(ctx, spriteX, spriteY, spriteScale * w * 0.005, car.color);
                    }
                });

                // Árvores e Placas
                seg.sprites.forEach(s => {
                    this.drawSprite(ctx, w, h, s.source, s.offset, seg.p1);
                });
            }

            // E. HUD e Volante
            this.drawHUD(ctx, w, h);

            // ----------------------------------------------------
            // 5. DETECÇÃO DE VOLTA E FIM DE JOGO
            // ----------------------------------------------------
            if(this.position < 500 && this.oldPos > this.trackLength - 500) {
                this.lap++;
                window.System.msg("VOLTA " + this.lap);
                if(this.lap > CONF.TOTAL_LAPS) {
                    const finalScore = Math.floor(this.speed * 0.5); // Pontuação simples
                    if(window.CoreFB && window.CoreFB.saveScore) {
                        window.CoreFB.saveScore(GAME_ID, finalScore);
                    }
                    window.System.gameOver(finalScore);
                }
            }
            this.oldPos = this.position;

            return Math.floor(this.speed / 200); // Retorna Score para o Core exibir
        },

        // --- FUNÇÕES AUXILIARES DE DESENHO ---
        drawPoly: function(ctx, x1, y1, w1, x2, y2, w2, color) {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(x1-w1, y1); ctx.lineTo(x2-w2, y2);
            ctx.lineTo(x2+w2, y2); ctx.lineTo(x1+w1, y1);
            ctx.fill();
        },

        drawBackground: function(ctx, w, h, playerSeg, steer) {
            // Desenha montanhas simples que se movem com a curva
            ctx.fillStyle = '#2c3e50';
            ctx.beginPath();
            ctx.moveTo(0, h/2);
            for(let i=0; i<=w; i+=20) {
                // Parallax Math
                const offset = (playerSeg.curve * 200) + (steer * 100);
                const hOffset = Math.sin((i + this.position*0.01 + offset) * 0.01) * 40;
                ctx.lineTo(i, (h/2) - 50 - Math.abs(hOffset));
            }
            ctx.lineTo(w, h/2);
            ctx.fill();
        },

        drawSprite: function(ctx, w, h, sprite, offset, point) {
            const destX = point.screen.x + (point.screen.w * offset);
            const destY = point.screen.y;
            const destW = sprite.w * point.screen.scale * w * 0.002;
            const destH = sprite.h * point.screen.scale * w * 0.002;

            ctx.save();
            ctx.translate(destX, destY);
            if(sprite.type === 'tree') {
                // Árvore Procedural
                ctx.fillStyle = '#8e44ad'; ctx.fillRect(-destW/10, -destH, destW/5, destH);
                ctx.fillStyle = sprite.color; ctx.beginPath(); ctx.arc(0, -destH*0.8, destW, 0, Math.PI*2); ctx.fill();
            } else if(sprite.type === 'sign') {
                // Placa Procedural
                ctx.fillStyle = '#f39c12'; ctx.fillRect(-destW/2, -destH, destW, destH);
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(-destW/2, -destH, destW, destH);
                ctx.fillStyle = '#fff'; ctx.fillRect(-destW/4, -destH*0.8, destW/2, destH/5);
            }
            ctx.restore();
        },

        drawCar: function(ctx, x, y, scale, color) {
            ctx.save();
            ctx.translate(x, y);
            const w = 40 * scale; const h = 30 * scale;
            // Sombra
            ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(0, 0, w, h/3, 0, 0, Math.PI*2); ctx.fill();
            // Corpo
            ctx.fillStyle = color; ctx.fillRect(-w/2, -h, w, h*0.7);
            // Rodas
            ctx.fillStyle = '#222'; ctx.fillRect(-w/2-5, -h/2, 5, h/2); ctx.fillRect(w/2, -h/2, 5, h/2);
            ctx.restore();
        },

        drawHUD: function(ctx, w, h) {
            // 1. VOLANTE VIRTUAL (Se detectado)
            if(this.hands.active) {
                const cx = (this.hands.lx + this.hands.rx) / 2;
                const cy = (this.hands.ly + this.hands.ry) / 2;
                const radius = Math.hypot(this.hands.lx - this.hands.rx, this.hands.ly - this.hands.ry) / 2;
                
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(this.hands.angle);
                
                // Aro
                ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI*2);
                ctx.lineWidth = 12; ctx.strokeStyle = '#333'; ctx.stroke();
                ctx.lineWidth = 6; ctx.strokeStyle = '#e74c3c'; ctx.stroke();
                
                // Miolo
                ctx.fillStyle = '#ccc'; ctx.beginPath(); ctx.arc(0, 0, radius*0.3, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.arc(0, 0, radius*0.1, 0, Math.PI*2); ctx.fill();
                
                // Hastes
                ctx.beginPath(); ctx.moveTo(-radius*0.3,0); ctx.lineTo(-radius,0); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(radius*0.3,0); ctx.lineTo(radius,0); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0,radius*0.3); ctx.lineTo(0,radius); ctx.stroke();
                
                ctx.restore();
            } else {
                // Aviso
                ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0, h/2 - 30, w, 60);
                ctx.fillStyle = "#fff"; ctx.font = "bold 20px 'Russo One'"; ctx.textAlign = "center";
                ctx.fillText("✋ LEVANTE AS MÃOS ✋", w/2, h/2 + 10);
            }

            // 2. VELOCÍMETRO
            ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
            ctx.font = "italic bold 50px 'Russo One'"; ctx.textAlign = "right";
            const speedDisplay = Math.floor(this.speed / 100);
            ctx.strokeText(speedDisplay, w-30, h-40);
            ctx.fillText(speedDisplay, w-30, h-40);
            ctx.font = "20px Arial"; ctx.fillText("KM/H", w-30, h-20);

            // 3. MINIMAPA
            const mapS = 100; const mapX = 20; const mapY = h - 120;
            ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(mapX, mapY, mapS, mapS);
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(mapX, mapY, mapS, mapS);
            
            // Player Dot
            const pct = this.position / this.trackLength;
            const px = mapX + mapS/2 + Math.cos(pct * Math.PI * 2) * (mapS*0.4);
            const py = mapY + mapS/2 + Math.sin(pct * Math.PI * 2) * (mapS*0.4);
            ctx.fillStyle = '#0ff'; ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI*2); ctx.fill();

            // Rivals Dots
            cars.forEach(c => {
                const cp = c.z / this.trackLength;
                const cx = mapX + mapS/2 + Math.cos(cp * Math.PI * 2) * (mapS*0.4);
                const cy = mapY + mapS/2 + Math.sin(cp * Math.PI * 2) * (mapS*0.4);
                ctx.fillStyle = '#f00'; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI*2); ctx.fill();
            });
        }
    };

    // --- AUTO-REGISTRO BLINDADO (GARANTE QUE O JOGO APAREÇA) ---
    const regLoop = setInterval(() => {
        if(window.System && window.System.registerGame) {
            window.System.registerGame(GAME_ID, { 
                name: 'Otto Kart Pro', 
                icon: '🏎️', 
                camOpacity: 0.4 
            }, Logic);
            clearInterval(regLoop);
        }
    }, 100);

})();