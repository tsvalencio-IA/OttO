// =============================================================================
// OTTO KART: DEFINITIVE EDITION (RESTORED V5 PHYSICS & FEEL)
// BASEADO NA ESTRUTURA V8, MAS COM A ALMA DO THIAGUINHO V5
// =============================================================================

(function() {
    // --- SISTEMA DE PARTÍCULAS E EFEITOS ---
    let particles = [];
    
    // Configurações de Gameplay (Física V5 Pura)
    const CONF = {
        MAX_SPEED: 260,          // Velocidade máxima alta para sensação de risco
        ACCEL: 0.8,              // Aceleração progressiva
        DECEL: 0.96,             // Desaceleração natural (freio motor)
        OFFROAD_GRIP: 0.92,      // Perda de aderência na grama
        STEER_SENS: 2.8,         // Sensibilidade do volante (Nintendo style)
        CURVE_FACTOR: 2.2,       // Força das curvas geradas
        LANE_FORCE: 0.985,       // Assistência de centralização suave
        CENTRIFUGAL: 0.85        // Força que joga pra fora na curva
    };

    const Logic = {
        // --- ESTADO DO JOGO ---
        speed: 0,
        pos: 0,              // Posição Z global na pista infinita
        x: 0,                // Posição X lateral (-1.5 a 1.5)
        steer: 0,            // Volante virtual suavizado
        curve: 0,            // Curvatura atual da pista
        
        health: 100,         // "Motor" do carro
        score: 0,
        rank: 8,             // Posição na corrida (começa em último)
        enemiesPassed: 0,    // Contador de ultrapassagens
        
        // --- VISUAL ---
        visualTilt: 0,       // Inclinação visual do chassi
        bounce: 0,           // Vibração vertical
        
        // --- INPUT (SISTEMA HÍBRIDO) ---
        inputState: 0,       // 0=Nada, 1=1 Mão, 2=Volante
        hands: { left: null, right: null },
        wheel: { radius: 0, x: 0, y: 0, opacity: 0, angle: 0 },
        
        // --- OBJETOS ---
        obs: [],
        enemies: [],
        
        // --- INICIALIZAÇÃO ---
        init: function() {
            this.speed = 0;
            this.pos = 0;
            this.x = 0;
            this.steer = 0;
            this.health = 100;
            this.score = 0;
            this.rank = 8;
            this.enemiesPassed = 0;
            this.obs = [];
            this.enemies = [];
            particles = [];
            this.inputState = 0;

            // Start Sequence
            window.System.msg("MOTORES PRONTOS...");
            if(window.Sfx) {
                window.Sfx.play(100, 'sawtooth', 0.5, 0.2);
                setTimeout(() => {
                    window.System.msg("VAI!!!");
                    window.Sfx.play(400, 'square', 1.0, 0.1);
                }, 1500);
            }
        },

        // --- UPDATE LOOP (60 FPS) ---
        update: function(ctx, w, h, pose) {
            const cx = w / 2;
            const horizon = h * 0.35; // Linha do horizonte clássica V5

            // =================================================================
            // 1. INPUT: DETECÇÃO DO VOLANTE VIRTUAL (V5 LOGIC)
            // =================================================================
            this.inputState = 0;
            this.hands.left = null;
            this.hands.right = null;
            let targetAngle = 0;
            
            // Proporção de velocidade para ajustar física
            const speedRatio = Math.min(1.2, this.speed / (h * 0.08));

            if(pose) {
                const kp = pose.keypoints;
                const lw = kp.find(k => k.name === 'left_wrist');
                const rw = kp.find(k => k.name === 'right_wrist');

                if(lw && lw.score > 0.4) this.hands.left = window.Gfx.map(lw, w, h);
                if(rw && rw.score > 0.4) this.hands.right = window.Gfx.map(rw, w, h);

                if(this.hands.left && this.hands.right) this.inputState = 2; // Volante!
                else if(this.hands.left || this.hands.right) this.inputState = 1; // Uma mão
            }

            // FÍSICA DO VOLANTE
            if(this.inputState === 2) {
                const p1 = this.hands.left;
                const p2 = this.hands.right;

                // Centro e Raio
                const centerX = (p1.x + p2.x) / 2;
                const centerY = (p1.y + p2.y) / 2;
                const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);

                // Suavização da UI do volante
                this.wheel.x += (centerX - this.wheel.x) * 0.25;
                this.wheel.y += (centerY - this.wheel.y) * 0.25;
                this.wheel.radius += ((dist/2) - this.wheel.radius) * 0.15;
                this.wheel.opacity = Math.min(1, this.wheel.opacity + 0.15);

                // Cálculo do Ângulo
                const dy = p2.y - p1.y;
                const dx = p2.x - p1.x;
                let rawAngle = Math.atan2(dy, dx);

                // Deadzone Dinâmica (Estabilidade em retas)
                const deadzone = 0.06 + (0.12 * speedRatio);
                if(Math.abs(rawAngle) < deadzone) rawAngle = 0;
                else rawAngle -= Math.sign(rawAngle) * deadzone;

                // Curva de Resposta Exponencial (Drift Feel)
                targetAngle = Math.sign(rawAngle) * Math.pow(Math.abs(rawAngle), 2.2) * CONF.STEER_SENS;
                
                // Aceleração Automática
                if(this.speed < h * 0.075) this.speed += h * 0.0008;

            } else {
                // Sem mãos: Desacelera e centraliza
                this.wheel.opacity *= 0.8;
                this.speed *= CONF.DECEL;
                targetAngle = 0;
            }

            // Aplica Inércia ao Volante
            const steerInertia = 0.05 + (0.10 * (1 - speedRatio));
            this.steer += (targetAngle - this.steer) * steerInertia;
            this.steer = Math.max(-1.6, Math.min(1.6, this.steer));
            
            this.wheel.angle = this.steer; // Visual segue a física

            // =================================================================
            // 2. FÍSICA DE MOVIMENTO (PISTA PROCEDURAL V5)
            // =================================================================
            this.pos += this.speed;
            this.score += Math.floor(this.speed * 0.1);

            // GERAÇÃO DA CURVA (Procedural - Math.sin)
            // Cria uma pista infinita baseada em ondas senoidais
            this.curve = Math.sin(this.pos * 0.002) * CONF.CURVE_FACTOR;
            
            // Adiciona complexidade à curva (retas e curvas fechadas)
            if(Math.sin(this.pos * 0.0005) > 0.5) this.curve *= 2; // Curva fechada
            if(Math.cos(this.pos * 0.001) > 0.8) this.curve = 0;   // Reta

            // Assistência de Curva Inteligente
            let centrifugal = CONF.CENTRIFUGAL;
            const turningIntoCurve = (Math.sign(this.curve) !== Math.sign(this.steer));
            if(turningIntoCurve && Math.abs(this.steer) > 0.3) {
                centrifugal = 0.40; // Se virar contra a curva, ganha grip
            }

            // Lane Assist (Ímã de Centro)
            if(Math.abs(this.steer) < 0.1) this.x *= CONF.LANE_FORCE;

            // CÁLCULO FINAL DE POSIÇÃO X
            // X = Direção - Força da Curva (que joga pra fora)
            const grip = 1.0 - (speedRatio * 0.05);
            this.x += (this.steer * 0.095 * grip) - (this.curve * (this.speed/h) * centrifugal);

            // Colisão com Bordas (Offroad)
            let isOffRoad = false;
            if(Math.abs(this.x) > 1.4) {
                this.speed *= CONF.OFFROAD_GRIP;
                isOffRoad = true;
                this.x = this.x > 0 ? 1.4 : -1.4; // Parede invisível elástica
                
                // Shake e Som
                if(this.speed > 2) {
                    window.Gfx.shake(Math.random() * 3);
                    if(Math.random() < 0.2 && window.Sfx) window.Sfx.play(100, 'noise', 0.1, 0.05);
                }
            }

            // Vibrações Visuais
            this.bounce = Math.sin(Date.now() / 30) * (1 + speedRatio * 2);
            if(isOffRoad) this.bounce = (Math.random() - 0.5) * 12;
            this.visualTilt += (this.steer - this.visualTilt) * 0.2;

            // =================================================================
            // 3. OBJETOS E INIMIGOS (SPAWN & LOGIC)
            // =================================================================
            // Spawn Obstáculos
            if(Math.random() < 0.025 && this.speed > 5) {
                const type = Math.random() < 0.3 ? 'sign' : 'cone';
                let obsX = (Math.random() * 2.0) - 1.0;
                if(type === 'sign') obsX = (Math.random() < 0.5 ? -1.6 : 1.6);
                this.obs.push({ x: obsX, z: 3000, type: type, hit: false });
            }

            // Spawn Inimigos (Competição)
            // Mantém sempre 3 inimigos na frente para perseguir
            if(this.enemies.length < 3) {
                this.enemies.push({
                    x: (Math.random() * 1.5) - 0.75,
                    z: 2000 + (Math.random() * 2000), // Spawna lá na frente
                    speed: this.speed * (0.8 + Math.random() * 0.15), // Mais lentos que o player no max speed
                    color: ['#e67e22', '#2980b9', '#2ecc71', '#f1c40f'][Math.floor(Math.random()*4)],
                    laneChange: (Math.random() - 0.5) * 0.02,
                    passed: false
                });
            }

            // Atualiza Objetos
            // Z diminui baseado na velocidade do player (objetos vêm em direção à câmera)
            
            // Obstáculos
            this.obs.forEach((o, i) => {
                o.z -= this.speed * 2.0; // Velocidade relativa do mundo
                if(o.z < -500) this.obs.splice(i, 1);
            });

            // Inimigos
            this.enemies.forEach((e, i) => {
                // Inimigos se movem! Velocidade relativa = SpeedPlayer - SpeedEnemy
                e.z -= (this.speed - e.speed) * 2.0;
                
                // IA Simples de Inimigo
                e.x += e.laneChange;
                if(e.x > 0.8) e.laneChange = -0.015;
                if(e.x < -0.8) e.laneChange = 0.015;

                // Ultrapassagem
                if(e.z < 0 && !e.passed) {
                    e.passed = true;
                    this.enemiesPassed++;
                    this.rank = Math.max(1, 8 - this.enemiesPassed); // Rank melhora
                    window.System.msg(`POSIÇÃO ${this.rank}º`);
                    window.Sfx.coin();
                }

                // Remove se ficar muito pra trás
                if(e.z < -1000) this.enemies.splice(i, 1);
            });

            // =================================================================
            // 4. RENDERIZAÇÃO (ESTILO V5)
            // =================================================================
            
            // Céu
            const gradSky = ctx.createLinearGradient(0, 0, 0, horizon);
            gradSky.addColorStop(0, "#0099ff"); gradSky.addColorStop(1, "#87CEEB");
            ctx.fillStyle = gradSky; ctx.fillRect(0, 0, w, horizon);

            // Montanhas Parallax
            ctx.fillStyle = 'rgba(255,255,255,0.8)'; // Nuvens
            const bgX = this.steer * 80 + (this.curve * 150); // Move com a curva
            
            const drawCloud = (cloudX, cloudY, s) => { 
                ctx.beginPath(); ctx.arc(cloudX, cloudY, 30*s, 0, Math.PI*2); 
                ctx.arc(cloudX+25*s, cloudY-10*s, 35*s, 0, Math.PI*2); 
                ctx.arc(cloudX+50*s, cloudY, 30*s, 0, Math.PI*2); ctx.fill(); 
            };
            drawCloud(w*0.2 - bgX, horizon*0.6, 1.2); 
            drawCloud(w*0.8 - bgX, horizon*0.4, 0.8);

            // Montanha Verde
            ctx.fillStyle = '#2ecc71'; 
            ctx.beginPath(); ctx.moveTo(0, horizon);
            ctx.quadraticCurveTo(w*0.3, horizon - 50, w*0.6, horizon);
            ctx.quadraticCurveTo(w*0.8, horizon - 80, w, horizon);
            ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();

            // Chão (Grama)
            ctx.fillStyle = '#32cd32'; ctx.fillRect(0, horizon, w, h);

            // PISTA (PROJEÇÃO TRAPEZOIDAL - MODO 7 FAKE)
            const roadW_Far = w * 0.01; 
            const roadW_Near = w * 2.2; // Bem larga na base
            const roadCurveVis = this.curve * (w * 0.7); // Curva visual na tela

            // Zebras (Efeito de velocidade)
            const zebraSize = w * 0.35; 
            const segmentSize = 40; 
            const segmentPhase = Math.floor(this.pos / segmentSize) % 2;
            
            ctx.fillStyle = (segmentPhase === 0) ? '#ff0000' : '#ffffff';
            ctx.beginPath();
            ctx.moveTo(cx + roadCurveVis - roadW_Far - (zebraSize*0.05), horizon);
            ctx.lineTo(cx + roadCurveVis + roadW_Far + (zebraSize*0.05), horizon);
            ctx.lineTo(cx + roadW_Near + zebraSize, h);
            ctx.lineTo(cx - roadW_Near - zebraSize, h);
            ctx.fill();

            // Asfalto
            ctx.fillStyle = '#555'; 
            ctx.beginPath();
            ctx.moveTo(cx + roadCurveVis - roadW_Far, horizon);
            ctx.lineTo(cx + roadCurveVis + roadW_Far, horizon);
            ctx.lineTo(cx + roadW_Near, h);
            ctx.lineTo(cx - roadW_Near, h);
            ctx.fill();

            // Speed Lines (Textura de velocidade no asfalto)
            if(this.speed > 1) {
                ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 4;
                ctx.beginPath();
                const lines = 4; const offset = (this.pos % 100) / 100;
                for(let i=0; i<lines; i++) {
                    const depth = (i + offset) / lines; 
                    const y = horizon + (h-horizon) * (depth*depth); // Perspectiva quadrática
                    const widthAtY = roadW_Far + (roadW_Near-roadW_Far) * (depth*depth);
                    const centerAtY = cx + roadCurveVis * (1-depth);
                    ctx.moveTo(centerAtY - widthAtY, y); ctx.lineTo(centerAtY + widthAtY, y);
                }
                ctx.stroke();
            }

            // Faixa Central
            ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = w * 0.015;
            ctx.setLineDash([h * 0.1, h * 0.15]); ctx.lineDashOffset = -this.pos * 1.5;
            ctx.beginPath();
            ctx.moveTo(cx + roadCurveVis, horizon);
            ctx.quadraticCurveTo(cx + (roadCurveVis * 0.3), h * 0.7, cx, h);
            ctx.stroke(); ctx.setLineDash([]);

            // =================================================================
            // 5. RENDERIZAÇÃO DE OBJETOS (Z-SORTING)
            // =================================================================
            let drawQueue = [];
            
            // Adiciona Obstáculos
            this.obs.forEach((o, i) => drawQueue.push({ type: o.type, obj: o, z: o.z }));
            // Adiciona Inimigos
            this.enemies.forEach((e, i) => drawQueue.push({ type: 'kart', obj: e, z: e.z }));
            
            // Ordena do fundo para frente (Painter's Algorithm)
            drawQueue.sort((a, b) => b.z - a.z);

            drawQueue.forEach(item => {
                const o = item.obj;
                const scale = 500 / (o.z + 500); // Escala de perspectiva

                if(scale > 0 && o.z < 3500) { // Render distance
                    // Posição X na tela: Centro + Curva + Offset Lateral do Objeto
                    const screenX = cx + (this.curve * w * 0.8 * (o.z/3000)) + (o.x * w * 0.7 * scale);
                    const screenY = horizon + (30 * scale);
                    const size = (w * 0.18) * scale;
                    
                    // Colisão Simples (Z perto, X perto)
                    let hit = false;
                    if(o.z < 100 && o.z > -100 && Math.abs(this.x - o.x) < 0.45 && !o.hit) hit = true;

                    if(item.type === 'cone') {
                        ctx.fillStyle = '#ff6b6b'; ctx.beginPath(); 
                        ctx.moveTo(screenX, screenY - size);
                        ctx.lineTo(screenX - size*0.3, screenY); 
                        ctx.lineTo(screenX + size*0.3, screenY); ctx.fill();
                        
                        if(hit) { 
                            o.hit = true; this.speed *= 0.8; this.health -= 5; 
                            window.Sfx.crash(); window.Gfx.shake(10); 
                            this.obs.splice(this.obs.indexOf(o), 1); 
                        }
                    } 
                    else if(item.type === 'kart') {
                        // Desenha Inimigo (Sprite Simples)
                        const kScale = scale * w * 0.005;
                        ctx.save(); ctx.translate(screenX, screenY); ctx.scale(kScale, kScale);
                        
                        // Sombra
                        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(0, 10, 30, 8, 0, 0, Math.PI*2); ctx.fill();
                        // Corpo
                        ctx.fillStyle = o.color; ctx.fillRect(-20, -15, 40, 20);
                        // Rodas
                        ctx.fillStyle = '#222'; ctx.fillRect(-22, -5, 8, 15); ctx.fillRect(14, -5, 8, 15);
                        // Capacete
                        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -20, 12, 0, Math.PI*2); ctx.fill();
                        
                        ctx.restore();

                        if(hit) { 
                            o.hit = true; this.speed = 0; this.health -= 20; 
                            window.Sfx.crash(); window.Gfx.shake(30); 
                            o.z -= 500; // Joga ele pra trás
                        }
                    }
                    else if(item.type === 'sign') {
                        const hSign = size * 2;
                        ctx.fillStyle = '#555'; ctx.fillRect(screenX-2*scale, screenY-hSign, 4*scale, hSign);
                        ctx.fillStyle = '#f1c40f'; ctx.beginPath(); 
                        ctx.moveTo(screenX - size*0.8, screenY - hSign); 
                        ctx.lineTo(screenX + size*0.8, screenY - hSign); 
                        ctx.lineTo(screenX, screenY - hSign - size); ctx.fill();
                        
                        if(hit) { 
                            o.hit = true; this.speed *= 0.5; this.health -= 15; 
                            window.Sfx.crash(); window.Gfx.shake(20); 
                            this.obs.splice(this.obs.indexOf(o), 1); 
                        }
                    }
                }
            });

            // =================================================================
            // 6. PLAYER KART (SPRITE V5 RESTAURADO)
            // =================================================================
            const carScale = w * 0.0055;
            const carX = cx + (this.x * w * 0.3); // O carro se move um pouco lateralmente
            const carY = h * 0.88 + this.bounce;
            
            ctx.save(); 
            ctx.translate(carX, carY); 
            ctx.scale(carScale, carScale); 
            ctx.rotate(this.visualTilt * 0.15); // Inclina nas curvas

            // Partículas de Pneu
            if(Math.abs(this.steer) > 0.8 && this.speed > 50) {
                const color = (Math.floor(Date.now()/100)%2===0) ? '#ffcc00' : '#ff3300'; // Fagulhas de drift
                if(Math.random()<0.5) { 
                    particles.push({x: carX - 30, y: carY+20, vx: -2, vy: 2, s: 5, c: color, l: 20}); 
                    particles.push({x: carX + 30, y: carY+20, vx: 2, vy: 2, s: 5, c: color, l: 20}); 
                }
            }
            if(isOffRoad) {
                particles.push({x: carX, y: carY+10, vx: (Math.random()-0.5)*5, vy: 5, s: 8, c: '#8B4513', l: 30});
            }

            // Desenho do Kart (Retro Vector Style)
            // Sombra
            ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(0, 25, 50, 15, 0, 0, Math.PI*2); ctx.fill();
            // Rodas Traseiras
            ctx.fillStyle = '#111'; ctx.fillRect(-50, 5, 25, 25); ctx.fillRect(25, 5, 25, 25);
            // Calotas
            ctx.fillStyle = '#ddd'; ctx.fillRect(-45, 10, 15, 15); ctx.fillRect(30, 10, 15, 15);
            // Motor
            ctx.fillStyle = '#333'; ctx.fillRect(-25, 20, 50, 15);
            // Escapamentos
            ctx.fillStyle = '#777'; 
            ctx.beginPath(); ctx.arc(-15, 30, 6, 0, Math.PI*2); ctx.fill(); 
            ctx.beginPath(); ctx.arc(15, 30, 6, 0, Math.PI*2); ctx.fill(); 
            // Chassi (Gradiente Vermelho)
            const bodyGrad = ctx.createLinearGradient(-30, -20, 30, 20); bodyGrad.addColorStop(0, '#ff0000'); bodyGrad.addColorStop(1, '#cc0000');
            ctx.fillStyle = bodyGrad; 
            ctx.beginPath(); ctx.moveTo(-20, -50); ctx.lineTo(20, -50); ctx.lineTo(35, 10); ctx.lineTo(40, 25); ctx.lineTo(-40, 25); ctx.lineTo(-35, 10); ctx.fill();
            // Volante (base)
            ctx.fillStyle = '#222'; ctx.beginPath(); ctx.ellipse(0, 0, 20, 15, 0, 0, Math.PI*2); ctx.fill();

            // Cockpit e Piloto (Gira com o volante)
            ctx.save(); ctx.rotate(this.steer * 0.5); 
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -25, 18, 0, Math.PI*2); ctx.fill(); // Capacete
            ctx.fillStyle = '#ff0000'; ctx.font="bold 12px Arial"; ctx.textAlign="center"; ctx.fillText("M", 0, -32); // Logo
            ctx.fillStyle = '#333'; ctx.fillRect(-12, -28, 24, 8); // Visor
            ctx.restore();

            // Rodas Frente (Giram com o volante)
            ctx.fillStyle = '#111';
            ctx.save(); ctx.translate(-35, -35); ctx.rotate(this.steer * 0.6); ctx.fillRect(-8, -10, 16, 20); ctx.restore();
            ctx.save(); ctx.translate(35, -35); ctx.rotate(this.steer * 0.6); ctx.fillRect(-8, -10, 16, 20); ctx.restore();
            
            ctx.restore(); // Fim do Carro

            // Renderiza Partículas
            particles.forEach((p, i) => { 
                p.x += p.vx; p.y += p.vy; p.l--; 
                if(p.l <= 0) particles.splice(i, 1); 
                else { ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, Math.PI*2); ctx.fill(); } 
            });

            // =================================================================
            // 7. INTERFACE (HUD) & MINI-MAPA MELHORADO
            // =================================================================
            const hudX = w - 80; const hudY = h - 60;
            
            // Velocímetro
            ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.beginPath(); ctx.arc(hudX, hudY, 50, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.stroke();
            ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = "bold 36px 'Russo One'"; 
            ctx.fillText(Math.floor(this.speed), hudX, hudY + 10);
            ctx.font = "12px Arial"; ctx.fillText("KM/H", hudX, hudY + 30);
            
            // Barra de Vida
            const hpW = w * 0.3;
            ctx.fillStyle = '#333'; ctx.fillRect(cx - hpW/2, 20, hpW, 10);
            const hpColor = this.health > 50 ? '#2ecc71' : '#e74c3c';
            ctx.fillStyle = hpColor; ctx.fillRect(cx - hpW/2 + 2, 22, (hpW-4) * (this.health/100), 6);

            // Posição (Rank)
            ctx.fillStyle = "#fff"; ctx.font = "italic bold 60px 'Russo One'"; ctx.textAlign = "left";
            ctx.shadowColor="black"; ctx.shadowBlur=10;
            ctx.fillText(this.rank + "º", 20, h - 20);
            ctx.shadowBlur=0;

            // --- MINI-MAPA (NOVO: CLARO, OPACO, FUNCIONAL) ---
            const mapW = 120; const mapH = 100;
            const mapX = 20; const mapY = 20;
            
            // Fundo Opaco
            ctx.fillStyle = "#111"; 
            ctx.fillRect(mapX, mapY, mapW, mapH);
            ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.strokeRect(mapX, mapY, mapW, mapH);

            // Traçado da Pista (Previsão)
            ctx.strokeStyle = "#0f0"; ctx.lineWidth = 3; ctx.beginPath();
            const mapScaleX = 15;
            const lookAhead = 4000; // Olha 4000 unidades a frente
            const startMapX = mapX + mapW/2;
            const startMapY = mapY + mapH - 10;
            
            ctx.moveTo(startMapX, startMapY);
            
            for(let i = 0; i < lookAhead; i+=100) {
                // Calcula curvatura futura usando a mesma fórmula da física
                const futureCurve = Math.sin((this.pos + i) * 0.002) * CONF.CURVE_FACTOR;
                // Complexidade extra (igual física)
                let modCurve = futureCurve;
                if(Math.sin((this.pos+i) * 0.0005) > 0.5) modCurve *= 2;
                if(Math.cos((this.pos+i) * 0.001) > 0.8) modCurve = 0;

                const pointX = startMapX + (modCurve * mapScaleX);
                const pointY = startMapY - (i / lookAhead) * mapH * 0.8;
                
                ctx.lineTo(pointX, pointY);
            }
            ctx.stroke();

            // Ponto do Jogador
            ctx.fillStyle = "#ff0000"; ctx.beginPath(); 
            // O jogador se move lateralmente no mapa baseado no X real
            ctx.arc(startMapX + (this.x * 5), startMapY, 4, 0, Math.PI*2); 
            ctx.fill();

            // Texto "MAP"
            ctx.fillStyle = "#aaa"; ctx.font = "10px Arial"; ctx.fillText("TRACK", mapX+mapW/2, mapY+12);


            // =================================================================
            // 8. RENDERIZAÇÃO DE INPUT (VOLANTE VIRTUAL HOLOGRÁFICO)
            // =================================================================
            const drawGlove = (x, y, label) => {
                const s = w * 0.06;
                const grad = ctx.createRadialGradient(x, y, s*0.2, x, y, s);
                grad.addColorStop(0, '#ffffff'); grad.addColorStop(1, '#cccccc');
                ctx.save(); ctx.shadowColor = '#3498db'; ctx.shadowBlur = 15;
                ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#3498db'; ctx.beginPath(); ctx.arc(x, y, s*0.6, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.font = "bold 20px Arial"; ctx.textAlign="center"; ctx.textBaseline="middle"; 
                ctx.fillText(label, x, y);
                ctx.restore();
            };

            if(this.inputState === 1) {
                if(this.hands.left) drawGlove(this.hands.left.x, this.hands.left.y, "L");
                if(this.hands.right) drawGlove(this.hands.right.x, this.hands.right.y, "R");
                
                ctx.fillStyle = "#fff"; ctx.font = "bold 24px Arial"; ctx.textAlign = "center";
                ctx.shadowColor = "black"; ctx.shadowBlur = 5;
                ctx.fillText("USE AS DUAS MÃOS!", cx, h * 0.2);
                ctx.shadowBlur = 0;
            }
            else if (this.inputState === 2 && this.wheel.opacity > 0.05) {
                ctx.save();
                ctx.globalAlpha = this.wheel.opacity;
                ctx.translate(this.wheel.x, this.wheel.y);
                ctx.rotate(this.wheel.angle); // Usa o ângulo suavizado
                
                const r = this.wheel.radius;

                // Volante Visual Detalhado
                ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 15;
                ctx.fillStyle = '#eee'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill(); // Aro externo
                ctx.globalCompositeOperation = 'destination-out';
                ctx.beginPath(); ctx.arc(0, 0, r * 0.75, 0, Math.PI*2); ctx.fill(); // Buraco
                ctx.globalCompositeOperation = 'source-over';
                
                // Grips Laterais
                ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
                ctx.fillStyle = '#3498db'; 
                ctx.beginPath(); ctx.arc(-r*0.9, 0, r*0.15, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(r*0.9, 0, r*0.15, 0, Math.PI*2); ctx.fill();

                // Centro e Hastes
                ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(0, 0, r*0.25, 0, Math.PI*2); ctx.fill();
                ctx.fillRect(-r*0.8, -10, r*1.6, 20); // Haste horizontal

                // Marcador de Centro
                ctx.fillStyle = '#e74c3c'; ctx.fillRect(-5, -r, 10, 20);

                ctx.restore();
            }

            // Game Over Check
            if(this.health <= 0) window.System.gameOver(this.score);

            return this.score;
        }
    };

    // --- REGISTRO DO JOGO (INTEGRAÇÃO OTTO V8) ---
    // Registra usando o novo padrão do Core.js (ID, MetaData, LogicObject)
    const registerLoop = setInterval(() => {
        if(window.System && window.System.registerGame) {
            window.System.registerGame('kart', { 
                name: 'Otto Kart V5', 
                icon: '🏎️', 
                camOpacity: 0.4, 
                showWheel: false 
            }, Logic);
            clearInterval(registerLoop);
        }
    }, 100);

})();