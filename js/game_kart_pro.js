// =============================================================================
// OTTO KART: ARCADE TURBO EDITION (VISUAL MODE 7 + DRIFT)
// PROTOCOLO 177: FOCADO EM DIVERSÃO, VELOCIDADE E VISUAL VIBRANTE
// =============================================================================

(function() {
    // --- TUNING DE CORRIDA ARCADE ---
    const CONF = {
        MAX_SPEED: 300,          // Velocidade visual muito alta
        ACCEL: 1.2,              // Arrancada forte
        BRAKE: 0.92,             // Freio responsivo
        OFFROAD_DRAG: 0.94,      // Punição na grama (mas não trava o carro)
        STEER_SENSITIVITY: 2.5,  // Volante muito responsivo
        DRIFT_GRIP: 0.15,        // O quanto o carro escorrega (Drift)
        CENTRIFUGAL: 1.2,        // Força que joga pra fora na curva
        TRACK_LENGTH: 8000,      // Tamanho da volta
        TOTAL_LAPS: 3,           // Total de voltas
        LANE_WIDTH: 1200         // Largura da pista (bem larga para ultrapassar)
    };

    // --- SISTEMA DE PISTA (GEOMETRIA FIXA) ---
    const Track = {
        segments: [],
        length: CONF.TRACK_LENGTH,

        generate: function() {
            this.segments = [];
            let curve = 0;
            let targetCurve = 0;

            // Gera segmentos com curvas suaves e orgânicas
            for(let i = 0; i < this.length; i++) {
                // Mudança de traçado a cada 300m
                if(i % 300 === 0) {
                    const r = Math.random();
                    if(r < 0.2) targetCurve = 0; // Reta
                    else if(r < 0.6) targetCurve = (Math.random() - 0.5) * 3; // Curva média
                    else targetCurve = (Math.random() - 0.5) * 6; // Curva fechada
                }
                
                // Suavização (Lerp) para não ter quinas
                curve += (targetCurve - curve) * 0.02;
                
                this.segments.push({
                    curve: curve,
                    y: 0 // Futuramente pode ter elevação
                });
            }
            
            // Suaviza o final para o loop perfeito
            for(let i = 0; i < 400; i++) {
                const ratio = i / 400;
                const idx = this.length - 1 - i;
                this.segments[idx].curve = this.segments[idx].curve * ratio + this.segments[0].curve * (1 - ratio);
            }
        },

        getSegment: function(z) {
            let index = Math.floor(z) % this.length;
            if (index < 0) index += this.length;
            return this.segments[index];
        }
    };

    // --- CLASSE DE KART (JOGADOR E IA) ---
    class Kart {
        constructor(isPlayer, color, startZ) {
            this.isPlayer = isPlayer;
            this.color = color;
            this.z = startZ;
            this.x = 0;          // 0 = Centro, -1 = Esquerda, 1 = Direita
            this.speed = 0;
            this.steerAngle = 0; // Ângulo visual das rodas
            this.drift = 0;      // Acumulador de derrapagem
            
            // Estado de Corrida
            this.lap = 1;
            this.rank = 0;
            this.finished = false;
            
            // IA
            this.aiOffset = (Math.random() - 0.5) * 0.8; // Preferência de faixa
            this.aiSkill = 0.85 + Math.random() * 0.15;  // Habilidade
        }

        update(dt, inputSteer, inputAccel) {
            if(this.finished) {
                this.speed *= 0.95; // Desacelera ao terminar
                this.z += this.speed;
                return;
            }

            // 1. TERRENO E VELOCIDADE
            // Zona segura alargada: -1.2 a 1.2 é pista/zebra
            const isOffRoad = Math.abs(this.x) > 1.1; 
            
            if(inputAccel) {
                this.speed += CONF.ACCEL;
            } else {
                this.speed *= 0.96; // Freio motor
            }
            
            // Top Speed (IA varia um pouco)
            let maxS = CONF.MAX_SPEED * (this.isPlayer ? 1 : this.aiSkill);
            if(isOffRoad) maxS *= 0.4; // Grama reduz muito a velocidade máxima
            
            this.speed = Math.min(this.speed, maxS);
            if(isOffRoad) this.speed *= CONF.OFFROAD_DRAG; // Atrito extra na grama

            // 2. DIREÇÃO E DRIFT (A MÁGICA ARCADE)
            // O carro vira baseada na velocidade (mais rápido = vira menos, mas faz mais drift)
            
            // Curva da pista atual
            const seg = Track.getSegment(this.z);
            const trackCurve = seg.curve;

            if(this.speed > 5) {
                // Input direto muda o X (Resposta imediata que você pediu)
                this.x += inputSteer * CONF.STEER_SENSITIVITY * 0.03;
                
                // Força Centrífuga (Pista joga pra fora)
                // Se a pista curva pra direita (+), joga o carro pra esquerda (-)
                this.x -= trackCurve * (this.speed / CONF.MAX_SPEED) * CONF.CENTRIFUGAL * 0.04;

                // Drift: Se virar contra a curva, ganha controle. Se virar a favor, drift!
                this.drift = inputSteer; 
                this.steerAngle = inputSteer * 40; // Ângulo visual das rodas
            }

            // 3. MOVIMENTO E LOOP
            this.z += this.speed;
            
            // Tratamento de Voltas
            if(this.z >= CONF.TRACK_LENGTH) {
                this.z -= CONF.TRACK_LENGTH;
                this.lap++;
                if(this.isPlayer && this.lap <= CONF.TOTAL_LAPS) {
                    window.System.msg(`VOLTA ${this.lap}!`);
                    window.Sfx.coin();
                }
                if(this.lap > CONF.TOTAL_LAPS) {
                    this.finished = true;
                }
            }
        }

        updateAI(playerZ) {
            // IA "Elástico": Se estiver muito longe, acelera. Se estiver muito perto, mantém.
            const dist = this.z - playerZ;
            
            // Olha a frente para fazer curva
            const lookAhead = 400;
            const futureSeg = Track.getSegment(this.z + lookAhead);
            
            // Tenta manter a linha ideal (tangente interna)
            let targetX = this.aiOffset;
            if(Math.abs(futureSeg.curve) > 2) {
                targetX = Math.sign(futureSeg.curve) * 0.8; // Corta curva
            }

            // Direção suave
            let steer = (targetX - this.x) * 0.05;
            // Compensa a curva antecipadamente
            steer += futureSeg.curve * 0.2;

            this.update(1, Math.max(-1, Math.min(1, steer)), true);
        }
    }

    // --- ENGINE PRINCIPAL ---
    const Logic = {
        player: null,
        opponents: [],
        camHeight: 1200, // Câmera alta para ver bem a pista
        camDepth: 0.7,   // FOV
        
        // Estado Input
        handSteer: 0,
        
        init: function() {
            Track.generate();
            
            // Cores vibrantes estilo Mario Kart
            this.player = new Kart(true, '#e74c3c', 0); // Vermelho Ferrari
            
            this.opponents = [
                new Kart(false, '#3498db', 300),  // Azul
                new Kart(false, '#f1c40f', 600),  // Amarelo
                new Kart(false, '#2ecc71', 900),  // Verde
                new Kart(false, '#9b59b6', 1200), // Roxo
                new Kart(false, '#e67e22', 1500)  // Laranja
            ];

            window.System.msg("LARGADA!");
            window.Sfx.play(200, 'square', 0.5, 0.2);
        },

        update: function(ctx, w, h, pose) {
            const P = this.player;

            // 1. INPUT (Pose Detection Simples e Robusto)
            let activeHands = false;
            if(pose) {
                const kp = pose.keypoints;
                const lw = kp.find(k => k.name === 'left_wrist');
                const rw = kp.find(k => k.name === 'right_wrist');

                if(lw && rw && lw.score > 0.4 && rw.score > 0.4) {
                    activeHands = true;
                    // Mapeia para tela
                    const l = window.Gfx.map(lw, w, h);
                    const r = window.Gfx.map(rw, w, h);
                    
                    // Ângulo do volante virtual (atan2)
                    const dx = r.x - l.x;
                    const dy = r.y - l.y;
                    const angle = Math.atan2(dy, dx);
                    
                    // Sensibilidade ajustada: Ângulo pequeno já vira muito
                    let rawSteer = angle * 2.0; 
                    rawSteer = Math.max(-1, Math.min(1, rawSteer));
                    
                    // Suavização
                    this.handSteer += (rawSteer - this.handSteer) * 0.2;
                }
            }
            // Centraliza se soltar
            if(!activeHands) this.handSteer *= 0.8;

            // 2. PHYSICS UPDATE
            P.update(1, this.handSteer, true); // Auto-aceleração (Arcade)
            this.opponents.forEach(o => o.updateAI(P.z));

            // 3. RANKING
            const all = [P, ...this.opponents];
            all.sort((a,b) => {
                const scoreA = (a.lap * 100000) + a.z;
                const scoreB = (b.lap * 100000) + b.z;
                return scoreB - scoreA;
            });
            P.rank = all.indexOf(P) + 1;

            if(P.finished && !this.endGame) {
                this.endGame = true;
                setTimeout(() => window.System.gameOver((6 - P.rank) * 2000), 2000);
            }

            // 4. RENDER (MODE 7 REVISITED)
            this.render(ctx, w, h);

            return Math.floor(P.speed);
        },

        render: function(ctx, w, h) {
            const P = this.player;
            const horizon = h * 0.45; // Horizonte
            
            // --- CÉU E PARALLAX (Visual Rico) ---
            const skyGrad = ctx.createLinearGradient(0,0,0,horizon);
            skyGrad.addColorStop(0, '#00bfff'); skyGrad.addColorStop(1, '#87cefa');
            ctx.fillStyle = skyGrad; ctx.fillRect(0,0,w,horizon);

            // Montanhas que se movem com a curva
            const segInfo = Track.getSegment(P.z);
            const parallaxX = (P.x * w * 0.1) + (segInfo.curve * w * 0.5); // Move oposto à curva
            
            ctx.fillStyle = '#2ecc71'; // Montanhas verdes
            ctx.beginPath();
            ctx.ellipse(w*0.2 - parallaxX, horizon, w*0.4, h*0.2, 0, 0, Math.PI, true);
            ctx.ellipse(w*0.8 - parallaxX, horizon, w*0.5, h*0.25, 0, 0, Math.PI, true);
            ctx.fill();

            // Chão (Verde Vibrante)
            ctx.fillStyle = '#27ae60'; ctx.fillRect(0, horizon, w, h-horizon);

            // --- PISTA MODE 7 (Algoritmo de Scanline Trapezoidal) ---
            // Renderiza 100 segmentos do fundo para frente
            const drawDistance = 250;
            const fov = h * 0.8;
            
            // Projeção 3D
            const project = (zWorld, xWorld) => {
                const scale = fov / (zWorld - P.z + fov); // Perspectiva simples
                const xScreen = (w/2) + (xWorld - (P.x * 2)) * scale * (w/2) * 0.8; // 2.0 = largura pista
                const yScreen = (h/2) + (scale * (h*0.3)) + (horizon * 0.2); // Altura da câmera
                return { x: xScreen, y: yScreen, s: scale };
            };

            // Acumulador de curva visual (o carro olha para a curva)
            let dx = 0; 
            let ddx = 0; // Derivada da curva

            // Buffer de desenho para sprites
            let zBuffer = [];

            // A pista é desenhada de TRÁS para FRENTE para garantir oclusão correta sem Z-Buffer complexo
            // Mas para performance em JS canvas, desenhar retângulos de baixo pra cima é melhor.
            // Vamos usar o método "Segment Stack":
            
            // Pega o segmento base do jogador
            const baseIdx = Math.floor(P.z);
            
            // Calcula geometria da pista na tela
            let geometries = [];
            let xOffset = 0; // O quanto a pista entortou
            
            for(let n = 0; n < drawDistance; n++) {
                const z = Math.floor(P.z + n);
                const seg = Track.getSegment(z);
                
                // Acumula a curva
                xOffset += seg.curve; 
                
                // Projeção
                // Z relativo à câmera
                const cameraZ = 200; // Distância da câmera atrás do plano
                const scale = cameraZ / (n + cameraZ);
                
                // Curvatura visual da estrada:
                // O centro da estrada muda baseado na curva acumulada MINUS a posição lateral do player
                const curveScreenX = (xOffset * 2) - (P.x * 200 * scale); // Drift visual
                
                // Coordenadas de tela
                const y = h - ((h - horizon) * scale * scale); // Perspectiva quadrática (mais chão perto)
                const wLine = w * 2.0 * scale; // Largura visual
                const x = (w/2) + (curveScreenX * scale);

                geometries.push({ x: x, y: y, w: wLine, s: scale, index: z });
            }

            // Desenha a Pista (De trás para frente para evitar buracos)
            for(let i = drawDistance - 2; i >= 0; i--) {
                const p1 = geometries[i];
                const p2 = geometries[i+1];
                
                if(p1.y >= p2.y) continue; // Oclusão

                // Cores alternadas (Zebra e Asfalto)
                const isLight = Math.floor(p1.index / 15) % 2 === 0; // Segmento de 5 metros
                
                // Zebra (Larga e bonita)
                ctx.fillStyle = isLight ? '#fff' : '#c0392b'; // Vermelho e Branco
                ctx.fillRect(0, p1.y, w, p2.y - p1.y + 1); // Preenchimento lateral (Grama fake) - Truque visual

                // Asfalto (Cinza Escuro e Claro)
                ctx.fillStyle = isLight ? '#95a5a6' : '#7f8c8d'; 
                
                ctx.beginPath();
                ctx.moveTo(p1.x - p1.w, p1.y);
                ctx.lineTo(p1.x + p1.w, p1.y);
                ctx.lineTo(p2.x + p2.w, p2.y);
                ctx.lineTo(p2.x - p2.w, p2.y);
                ctx.fill();

                // Linha Central
                if(isLight) {
                    ctx.fillStyle = '#fff';
                    const lw = p1.w * 0.05;
                    ctx.fillRect(p1.x - lw/2, p1.y, lw, p2.y - p1.y);
                }
            }

            // --- SPRITES (OPONENTES) ---
            // Renderiza oponentes usando a geometria calculada
            const kartsToDraw = this.opponents.map(o => {
                // Normaliza Z para desenhar loop corretamente
                let relZ = o.z - P.z;
                if(relZ < -200 && o.lap > P.lap) relZ += CONF.TRACK_LENGTH;
                if(relZ > CONF.TRACK_LENGTH - 200 && o.lap < P.lap) relZ -= CONF.TRACK_LENGTH;
                return { obj: o, z: relZ };
            }).filter(k => k.z > 0 && k.z < drawDistance);

            kartsToDraw.sort((a,b) => b.z - a.z); // Z-Sort

            kartsToDraw.forEach(item => {
                const idx = Math.floor(item.z);
                if(idx < geometries.length) {
                    const geom = geometries[idx];
                    const k = item.obj;
                    
                    // X relativo na pista
                    const spriteX = geom.x + (k.x * geom.w * 0.7);
                    const spriteY = geom.y;
                    const size = geom.s * w * 0.15; // Tamanho base
                    
                    this.drawKart(ctx, spriteX, spriteY, size, k);
                }
            });

            // --- JOGADOR (SEMPRE POR ÚLTIMO, GRANDE) ---
            // Efeitos de velocidade
            if(P.speed > 100) {
                // Speed lines
                ctx.strokeStyle = `rgba(255,255,255,${(P.speed/CONF.MAX_SPEED)*0.4})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                for(let i=0; i<8; i++) {
                    ctx.moveTo(w/2, horizon);
                    ctx.lineTo((w/2) + (Math.random()-0.5)*w*2, h);
                }
                ctx.stroke();
            }

            // Sprite do Jogador
            // Inclina o sprite baseado no drift
            const playerTilt = this.handSteer * 0.4;
            const playerSize = w * 0.18; // Bem grande na tela
            
            // Vibração se estiver na grama
            let vibX = 0, vibY = 0;
            if(Math.abs(P.x) > 1.1) {
                vibX = (Math.random() - 0.5) * 10;
                vibY = (Math.random() - 0.5) * 10;
            }

            this.drawKart(ctx, (w/2) + vibX, (h*0.88) + vibY, playerSize, P, playerTilt, true);

            // --- HUD ---
            this.drawHUD(ctx, w, h);
        },

        drawKart: function(ctx, x, y, size, kart, tilt = 0, isPlayer = false) {
            ctx.save();
            ctx.translate(x, y);
            
            // Inclinação nas curvas (Drift visual)
            ctx.rotate(tilt);
            
            // Escala
            const s = size / 100; // Normaliza para desenho em 100px base
            ctx.scale(s, s);

            // Sombra
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.beginPath(); ctx.ellipse(0, 10, 50, 15, 0, 0, Math.PI*2); ctx.fill();

            // Pneus Traseiros (Largos)
            ctx.fillStyle = '#222';
            ctx.fillRect(-50, -20, 25, 30);
            ctx.fillRect(25, -20, 25, 30);

            // Chassi (Cor do Kart)
            ctx.fillStyle = kart.color;
            // Forma de "Seta" para parecer rápido
            ctx.beginPath();
            ctx.moveTo(0, -50); // Bico
            ctx.lineTo(40, -10);
            ctx.lineTo(45, 10);
            ctx.lineTo(-45, 10);
            ctx.lineTo(-40, -10);
            ctx.closePath();
            ctx.fill();
            
            // Detalhe Motor (atrás)
            ctx.fillStyle = '#444';
            ctx.fillRect(-20, 0, 40, 20);
            
            // Escapamentos
            ctx.fillStyle = '#999';
            ctx.beginPath(); ctx.arc(-15, 20, 6, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(15, 20, 6, 0, Math.PI*2); ctx.fill();
            
            // Fogo do escapamento (Turbo/Alta velocidade)
            if(kart.speed > 250 && Math.random() < 0.5) {
                ctx.fillStyle = '#f39c12';
                ctx.beginPath(); ctx.arc(-15, 28, 5, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(15, 28, 5, 0, Math.PI*2); ctx.fill();
            }

            // Piloto (Capacete)
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(0, -20, 18, 0, Math.PI*2); ctx.fill(); // Cabeça
            
            // Viseira
            ctx.fillStyle = '#111';
            ctx.beginPath(); ctx.ellipse(0, -22, 12, 6, 0, 0, Math.PI*2); ctx.fill();

            // Volante e Mãos (Só se for player para feedback visual)
            if(isPlayer) {
                ctx.fillStyle = '#333';
                ctx.save();
                ctx.translate(0, -10);
                ctx.rotate(this.handSteer * 0.8); // Gira o volante visualmente
                ctx.fillRect(-15, -3, 30, 6); // Barra do volante
                ctx.restore();
            }

            ctx.restore();
        },

        drawHUD: function(ctx, w, h) {
            const P = this.player;

            // 1. Velocímetro (Grande e Digital)
            ctx.textAlign = 'right';
            ctx.font = "italic bold 60px 'Russo One'";
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 6;
            ctx.strokeText(Math.floor(P.speed), w - 30, h - 30);
            ctx.fillText(Math.floor(P.speed), w - 30, h - 30);
            ctx.font = "20px Arial";
            ctx.fillText("KM/H", w - 30, h - 15);

            // 2. Ranking (Canto Superior Esquerdo)
            ctx.textAlign = 'left';
            ctx.fillStyle = P.rank === 1 ? '#f1c40f' : '#fff';
            ctx.font = "bold 80px 'Russo One'";
            ctx.strokeText(`${P.rank}º`, 30, 100);
            ctx.fillText(`${P.rank}º`, 30, 100);

            // 3. Voltas
            ctx.fillStyle = '#fff';
            ctx.font = "30px Arial";
            ctx.strokeText(`LAP ${P.lap}/${CONF.TOTAL_LAPS}`, 30, 140);
            ctx.fillText(`LAP ${P.lap}/${CONF.TOTAL_LAPS}`, 30, 140);

            // 4. Minimapa (Canto Superior Direito)
            // Desenha o circuito simplificado
            const mapSize = 120;
            const mx = w - 140; 
            const my = 30;
            
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(mx, my, mapSize, mapSize);
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(mx, my, mapSize, mapSize);

            // Desenha pontos
            const drawDot = (z, color, size) => {
                // Transforma Z (0 a Length) em coordenadas de círculo para o mapa
                // Mapeia a pista num círculo perfeito para o minimapa (simplificação funcional)
                const angle = (z / CONF.TRACK_LENGTH) * Math.PI * 2 - (Math.PI/2);
                const rx = mx + mapSize/2 + Math.cos(angle) * (mapSize * 0.4);
                const ry = my + mapSize/2 + Math.sin(angle) * (mapSize * 0.4);
                
                ctx.fillStyle = color;
                ctx.beginPath(); ctx.arc(rx, ry, size, 0, Math.PI*2); ctx.fill();
            };

            // Desenha pista (círculo guia)
            ctx.strokeStyle = '#555'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(mx+mapSize/2, my+mapSize/2, mapSize*0.4, 0, Math.PI*2); ctx.stroke();

            // Oponentes
            this.opponents.forEach(o => drawDot(o.z, o.color, 4));
            // Player
            drawDot(P.z, '#e74c3c', 6);
        }
    };

    // --- BOOT ---
    const loop = setInterval(() => {
        if(window.System && window.System.registerGame) {
            window.System.registerGame('kart', { 
                name: 'Mario Kart Turbo', 
                icon: '🏎️', 
                camOpacity: 0.3 
            }, Logic);
            clearInterval(loop);
        }
    }, 100);
})();
