// LÓGICA DO JOGO: KART DO OTTO (GRAND PRIX CHAMPIONSHIP - ESPORT EDITION)
// ARCHITECT: CODE 177 - NINTENDO QUALITY STANDARD v3.0
(function() {
    // --- CONSTANTES DE CONFIGURAÇÃO ---
    const CONF = {
        TRACK_LENGTH: 15000,    // Pista muito maior (Qualidade Real)
        MAX_SPEED: 160,         // Velocidade mais alta
        LANE_WIDTH: 1400,       // Pista larga para ultrapassagens
        GRACE_TIME: 150,        // 5 Segundos (a 30fps) de "Mãos Livres" para atirar
        FOV: 800                // Campo de visão
    };

    let particles = [];
    let projectiles = []; // Cascos verdes, etc.

    const Logic = {
        // --- ESTADO DO JOGADOR ---
        speed: 0, 
        posZ: 0, 
        posX: 0,        // -1 a 1 (Centro da pista)
        steer: 0,       // Direção atual
        
        // --- GAMEPLAY ---
        rank: 4,
        lap: 1,
        totalLaps: 3,
        health: 100,
        score: 0,
        item: 'shell',  // Item atual (shell, boost)
        
        // --- MECÂNICA DE COMBATE (HANDS FREE) ---
        handsFreeTimer: 0, // Cronômetro de tolerância quando solta uma mão
        isCombatMode: false,
        
        // --- EFEITOS VISUAIS ---
        visualTilt: 0,
        bounce: 0,
        rpmLed: 0,      // Para o volante esportivo
        
        // --- INPUT ---
        inputState: 0,  // 0=Nada, 1=Uma Mão (Combate), 2=Duas Mãos (Drive)
        hands: { left: null, right: null },
        wheel: { x: 0, y: 0, opacity: 0, angle: 0 },
        
        // --- ENTIDADES ---
        opponents: [],
        props: [],
        
        // --- ELEMENTOS DOM (Injetados) ---
        fireBtn: null,

        init: function() { 
            this.resetGame();
            this.createFireButton();
            window.System.msg("QUALIFYING..."); 
            
            // Sequência de Largada Estilo Mario Kart
            setTimeout(() => { window.System.msg("3"); window.Sfx.play(300, 'square', 0.2); }, 1000);
            setTimeout(() => { window.System.msg("2"); window.Sfx.play(300, 'square', 0.2); }, 2000);
            setTimeout(() => { window.System.msg("1"); window.Sfx.play(300, 'square', 0.2); }, 3000);
            setTimeout(() => { window.System.msg("GO!!!"); window.Sfx.play(800, 'sawtooth', 1.0); }, 4000);
        },

        resetGame: function() {
            this.speed = 0; this.posZ = 0; this.posX = 0; this.steer = 0;
            this.health = 100; this.score = 0; this.lap = 1; 
            this.handsFreeTimer = 0;
            this.item = 'shell';
            particles = []; projectiles = [];
            
            // IAs INTELIGENTES
            this.opponents = [
                { id: 'luigi',  x: -0.4, z: 300, speed: 0, maxSpeed: 155, color: '#2ecc71', name: "L-MAN", width: 0.15 },
                { id: 'peach',  x: 0.4,  z: 600, speed: 0, maxSpeed: 158, color: '#ff69b4', name: "P-CESS", width: 0.14 },
                { id: 'bowser', x: 0,    z: 900, speed: 0, maxSpeed: 152, color: '#f39c12', name: "KING-B", width: 0.18 }
            ];

            // Geração de Pista Procedural (Curvas complexas)
            this.props = [];
            for(let i=2000; i<CONF.TRACK_LENGTH*3; i+=600) {
                if(Math.random() < 0.5) {
                    this.props.push({ 
                        type: Math.random()<0.4 ? 'coin' : 'box', 
                        z: i, 
                        x: (Math.random()*1.6) - 0.8, // Espalha bem
                        hit: false,
                        angle: Math.random() * Math.PI 
                    });
                }
            }
        },

        createFireButton: function() {
            // Remove se já existir (para evitar duplicatas)
            const old = document.getElementById('kart-fire-btn');
            if(old) old.remove();

            // Cria botão ESTILO NINTENDO/ARCADE
            this.fireBtn = document.createElement('button');
            this.fireBtn.id = 'kart-fire-btn';
            this.fireBtn.innerText = "FIRE!";
            
            // Estilização via JS para garantir encapsulamento
            Object.assign(this.fireBtn.style, {
                position: 'absolute',
                bottom: '15%',
                right: '5%',
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                background: 'radial-gradient(circle at 30% 30%, #ff4444, #cc0000)',
                border: '4px solid white',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5), inset 0 0 20px rgba(0,0,0,0.2)',
                color: 'white',
                fontFamily: "'Russo One', sans-serif",
                fontSize: '24px',
                fontWeight: 'bold',
                textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                cursor: 'pointer',
                zIndex: '100',
                transform: 'scale(0)', // Começa escondido
                transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            });

            // Lógica de Tiro
            this.fireBtn.onclick = (e) => {
                e.stopPropagation(); // Evita cliques fantasmas
                this.fireItem();
            };
            this.fireBtn.ontouchstart = (e) => {
                e.preventDefault(); // Evita delay no mobile
                this.fireItem();
            };

            document.getElementById('game-ui').appendChild(this.fireBtn);
        },

        fireItem: function() {
            if(this.item) {
                window.Sfx.play(600, 'square', 0.1); // Som de disparo
                window.Sfx.play(100, 'noise', 0.2); // Explosão saida
                
                // Cria projétil
                projectiles.push({
                    x: this.posX,
                    z: this.posZ + 200, // Sai da frente do carro
                    speed: this.speed + 40, // Mais rápido que o carro
                    type: 'shell',
                    life: 200
                });
                
                // Feedback Visual
                this.item = null;
                const btn = document.getElementById('kart-fire-btn');
                if(btn) {
                    btn.style.filter = "grayscale(100%)";
                    btn.innerText = "EMPTY";
                    setTimeout(() => { 
                        if(btn) { btn.style.transform = "scale(0)"; }
                    }, 500);
                }
            }
        },

        update: function(ctx, w, h, pose) {
            const cx = w / 2;
            const cy = h / 2;
            const horizon = h * 0.42;

            // =================================================================
            // 1. INPUT SYSTEM: "HANDS FREE ASSIST"
            // =================================================================
            let targetSteer = 0;
            let hasHands = false;
            
            // Detecta mãos
            if(pose) {
                const kp = pose.keypoints;
                const lw = kp.find(k=>k.name==='left_wrist');
                const rw = kp.find(k=>k.name==='right_wrist');
                
                if(lw && lw.score > 0.4) this.hands.left = window.Gfx.map(lw, w, h);
                if(rw && rw.score > 0.4) this.hands.right = window.Gfx.map(rw, w, h);
                
                // LÓGICA DE ESTADOS
                if(this.hands.left && this.hands.right) {
                    // MODO PILOTAGEM (2 Mãos)
                    this.inputState = 2;
                    this.handsFreeTimer = CONF.GRACE_TIME; // Reseta timer de graça
                    this.isCombatMode = false;
                    hasHands = true;
                    
                    // Posiciona Volante
                    const hCx = (this.hands.left.x + this.hands.right.x) / 2;
                    const hCy = (this.hands.left.y + this.hands.right.y) / 2;
                    this.wheel.x += (hCx - this.wheel.x) * 0.3;
                    this.wheel.y += (hCy - this.wheel.y) * 0.3;
                    
                    // Calcula Ângulo
                    const dy = this.hands.right.y - this.hands.left.y;
                    const dx = this.hands.right.x - this.hands.left.x;
                    let rawAngle = Math.atan2(dy, dx);
                    
                    // Deadzone Esportiva
                    if(Math.abs(rawAngle) < 0.1) rawAngle = 0;
                    targetSteer = rawAngle * 1.8 * window.System.sens;

                    // Acelera
                    if(this.speed < CONF.MAX_SPEED) this.speed += 0.8;

                } else if ((this.hands.left || this.hands.right) && this.handsFreeTimer > 0) {
                    // MODO COMBATE (1 Mão + Tempo de Graça)
                    // O usuário soltou uma mão para clicar no botão "FIRE"
                    this.inputState = 1;
                    this.handsFreeTimer--;
                    this.isCombatMode = true;
                    hasHands = true;
                    
                    // MANTÉM O CARRO NA PISTA (LANE KEEP ASSIST)
                    // O volante volta suavemente pro centro para você não bater enquanto atira
                    targetSteer = this.steer * 0.9; 
                    
                    // A velocidade cai levemente, mas não para
                    this.speed *= 0.995;

                    // Mostra botão de tiro
                    if(this.item && this.fireBtn) {
                        this.fireBtn.style.transform = "scale(1)";
                        this.fireBtn.style.filter = "none";
                        this.fireBtn.innerText = "FIRE!";
                    }

                } else {
                    // SEM MÃOS OU TEMPO ESGOTADO
                    this.inputState = 0;
                    this.speed *= 0.95; // Freio forte
                    if(this.fireBtn) this.fireBtn.style.transform = "scale(0)";
                }
            }

            // Suavização do Volante (Inércia)
            this.steer += (targetSteer - this.steer) * 0.1;
            this.wheel.angle = this.steer;
            this.wheel.opacity = hasHands ? Math.min(1, this.wheel.opacity+0.1) : Math.max(0, this.wheel.opacity-0.1);

            // =================================================================
            // 2. FÍSICA E MOVIMENTO (WORLD RELATIVE)
            // =================================================================
            this.posZ += this.speed;
            
            // Curvas Procedurais (Perlin-like noise usando seno)
            // A pista muda conforme você avança (Z)
            const curveFrequency = 0.0008;
            const curveAmplitude = 2.5;
            const currentCurve = Math.sin(this.posZ * curveFrequency) * curveAmplitude + 
                               Math.cos(this.posZ * curveFrequency * 2.3) * 1.0; // Harmônica
            
            // Movimento Lateral
            const centrifugal = currentCurve * (this.speed / CONF.MAX_SPEED);
            this.posX += (this.steer * 0.035) - (centrifugal * 0.04);
            
            // Colisão Borda
            let offRoad = false;
            if(Math.abs(this.posX) > 1.3) {
                offRoad = true;
                this.speed *= 0.92;
                this.posX = this.posX > 0 ? 1.3 : -1.3; // Parede invisível
                window.Gfx.shake(this.speed * 0.05);
            }

            // Tilt Visual (Body Roll)
            this.visualTilt += ((this.steer - currentCurve*0.5) - this.visualTilt) * 0.1;
            this.bounce = offRoad ? (Math.random()-0.5)*15 : Math.sin(Date.now()/40)*2;

            // Loop de Voltas
            if(this.posZ >= CONF.TRACK_LENGTH) {
                this.posZ -= CONF.TRACK_LENGTH;
                this.lap++;
                this.opponents.forEach(o => o.z -= CONF.TRACK_LENGTH); // Mantém bots relativos
                this.props.forEach(p => p.hit = false); // Reseta caixas
            }

            // =================================================================
            // 3. LOGICA DE CORRIDA (IA & PROJÉTEIS)
            // =================================================================
            
            // Atualiza Bots
            this.opponents.forEach(bot => {
                // IA de Pilotagem
                const botCurve = Math.sin(bot.z * curveFrequency) * curveAmplitude + Math.cos(bot.z * curveFrequency * 2.3);
                
                // Bot target X (Seguir a linha ideal oposta à curva)
                const targetX = -Math.sign(botCurve) * 0.5; 
                bot.x += (targetX - bot.x) * 0.02;
                
                // Velocidade & Rubber Banding
                let targetSpeed = bot.maxSpeed;
                const dist = bot.z - this.posZ;
                
                // Se o player está muito longe na frente, bot ganha turbo
                if(dist < -2000) targetSpeed *= 1.3; 
                // Se bot está muito na frente, desacelera (para dar chance)
                if(dist > 3000) targetSpeed *= 0.8;
                
                bot.speed += (targetSpeed - bot.speed) * 0.05;
                bot.z += bot.speed;

                // Colisão Bot x Player (Empurrão)
                if(Math.abs(dist) < 150 && Math.abs(bot.x - this.posX) < 0.25) {
                    window.Sfx.play(100, 'sawtooth', 0.1);
                    const push = (bot.x > this.posX) ? -0.05 : 0.05;
                    this.posX += push;
                    bot.x -= push;
                    this.speed *= 0.98;
                }
            });

            // Atualiza Projéteis
            for(let i = projectiles.length-1; i>=0; i--) {
                const p = projectiles[i];
                p.z += p.speed;
                p.x -= currentCurve * 0.02; // Projétil também faz curva levemente
                p.life--;
                
                // Colisão com Bots
                let hitBot = false;
                this.opponents.forEach(bot => {
                    if(!hitBot && Math.abs(p.z - bot.z) < 100 && Math.abs(p.x - bot.x) < 0.3) {
                        // ACERTOU!
                        hitBot = true;
                        bot.speed = 0; // Para o bot
                        window.System.msg(`HIT ${bot.name}!`);
                        window.Sfx.crash();
                        // Partículas de explosão
                        for(let k=0; k<10; k++) particles.push({x: bot.x, y: 0, z: bot.z, vx: (Math.random()-0.5), vy: Math.random(), color: '#fff', life: 30});
                    }
                });

                if(p.life <= 0 || hitBot) projectiles.splice(i, 1);
            }

            // Cálculo Rank
            let rank = 1;
            this.opponents.forEach(o => {
                // Calcula distância absoluta considerando voltas
                const botTotal = o.z + ((this.lap - (o.z > this.posZ + 5000 ? 1 : 0)) * CONF.TRACK_LENGTH);
                const plyTotal = this.posZ + (this.lap * CONF.TRACK_LENGTH);
                if(botTotal > plyTotal) rank++;
            });
            this.rank = rank;

            // =================================================================
            // 4. RENDERIZAÇÃO (ENGINE 3D)
            // =================================================================
            
            // Céu e Chão
            const skyOffset = (currentCurve * 300) + (this.steer * 150);
            ctx.fillStyle = "#87CEEB"; ctx.fillRect(0,0,w,horizon);
            // Nuvens Parallax
            ctx.fillStyle = "rgba(255,255,255,0.6)";
            ctx.beginPath(); ctx.arc((200-skyOffset)%w, horizon*0.5, 40, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc((600-skyOffset)%w, horizon*0.3, 60, 0, Math.PI*2); ctx.fill();
            
            ctx.fillStyle = "#2ecc71"; ctx.fillRect(0,horizon,w,h-horizon); // Grama

            // --- DESENHO DA ESTRADA ---
            // A estrada é desenhada projetando segmentos
            const roadW_Far = w * 0.02;
            const roadW_Near = w * 2.5; // Mais larga
            
            const roadCenter_Far = cx - (currentCurve * w * 0.8) - (this.steer * w * 0.5);
            const roadCenter_Near = cx - (this.posX * w * 0.9);

            // Asfalto
            ctx.beginPath();
            ctx.fillStyle = "#555";
            ctx.moveTo(roadCenter_Far - roadW_Far, horizon);
            ctx.lineTo(roadCenter_Far + roadW_Far, horizon);
            ctx.lineTo(roadCenter_Near + roadW_Near, h);
            ctx.lineTo(roadCenter_Near - roadW_Near, h);
            ctx.fill();

            // Zebras (Curbs)
            const segmentZ = 500;
            const phase = Math.floor(this.posZ / segmentZ) % 2;
            ctx.lineWidth = 20;
            ctx.strokeStyle = phase ? "#e74c3c" : "#ecf0f1";
            ctx.beginPath();
            ctx.moveTo(roadCenter_Far - roadW_Far, horizon);
            ctx.lineTo(roadCenter_Near - roadW_Near, h);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(roadCenter_Far + roadW_Far, horizon);
            ctx.lineTo(roadCenter_Near + roadW_Near, h);
            ctx.stroke();

            // Faixas Centrais
            ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 6;
            ctx.setLineDash([40, 60]); ctx.lineDashOffset = -this.posZ;
            ctx.beginPath();
            ctx.moveTo(roadCenter_Far, horizon);
            ctx.quadraticCurveTo((roadCenter_Far+roadCenter_Near)/2 + currentCurve*100, (horizon+h)/2, roadCenter_Near, h);
            ctx.stroke(); ctx.setLineDash([]);

            // --- RENDERIZAÇÃO DE OBJETOS (Z-BUFFER) ---
            let drawQueue = [];
            
            // Bots
            this.opponents.forEach(o => {
                let relZ = o.z - this.posZ;
                if(relZ < -5000) relZ += CONF.TRACK_LENGTH;
                if(relZ > 5000) relZ -= CONF.TRACK_LENGTH;
                if(relZ > 10) drawQueue.push({type: 'kart', obj: o, z: relZ});
            });
            // Props
            this.props.forEach(p => {
                let relZ = p.z - this.posZ;
                while(relZ < -500) relZ += CONF.TRACK_LENGTH;
                while(relZ > CONF.TRACK_LENGTH - 500) relZ -= CONF.TRACK_LENGTH;
                if(relZ > 10 && relZ < 2000) drawQueue.push({type: 'prop', obj: p, z: relZ});
            });
            // Projéteis
            projectiles.forEach(p => {
                let relZ = p.z - this.posZ;
                if(relZ > 10) drawQueue.push({type: 'shell', obj: p, z: relZ});
            });

            drawQueue.sort((a,b) => b.z - a.z);

            drawQueue.forEach(item => {
                const scale = CONF.FOV / (CONF.FOV + item.z);
                const obj = item.obj;
                
                // Interpolação de posição na tela
                const itemCenter = roadCenter_Far + (roadCenter_Near - roadCenter_Far) * scale;
                const itemWidth = roadW_Far + (roadW_Near - roadW_Far) * scale;
                
                const sx = itemCenter + (obj.x * itemWidth * 0.5);
                const sy = horizon + ((h - horizon) * scale);
                const size = w * 0.2 * scale;

                if(item.type === 'kart') {
                    // KART ADVERSÁRIO
                    ctx.fillStyle = obj.color;
                    ctx.fillRect(sx - size/2, sy - size, size, size*0.6);
                    ctx.fillStyle = "#fff"; ctx.font = `bold ${14*scale}px Arial`; ctx.textAlign = "center";
                    ctx.fillText(obj.name, sx, sy - size*1.2);
                    // Rodas
                    ctx.fillStyle = "#222"; 
                    ctx.fillRect(sx - size/2 - size*0.1, sy - size*0.3, size*0.2, size*0.3);
                    ctx.fillRect(sx + size/2 - size*0.1, sy - size*0.3, size*0.2, size*0.3);
                } else if (item.type === 'shell') {
                    // CASCO
                    ctx.fillStyle = "#2ecc71"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2*scale;
                    ctx.beginPath(); ctx.arc(sx, sy - size*0.3, size*0.3, 0, Math.PI*2); ctx.fill(); ctx.stroke();
                } else if (item.type === 'prop') {
                    if(obj.type === 'box') {
                        // ITEM BOX (Question Mark)
                        const boxS = size * 0.6;
                        // Cubo girando (efeito simples de escala X)
                        const spin = Math.sin(Date.now()/200);
                        ctx.fillStyle = `rgba(255, 200, 0, 0.8)`;
                        ctx.strokeStyle = "#fff"; ctx.lineWidth = 3*scale;
                        ctx.fillRect(sx - (boxS*spin)/2, sy - boxS*2, boxS*spin, boxS);
                        ctx.strokeRect(sx - (boxS*spin)/2, sy - boxS*2, boxS*spin, boxS);
                        if(Math.abs(spin) > 0.5) {
                            ctx.fillStyle="#fff"; ctx.font=`bold ${20*scale}px monospace`; ctx.textAlign="center";
                            ctx.fillText("?", sx, sy - boxS*1.3);
                        }

                        // Coleta
                        if(item.z < 60 && Math.abs(obj.x - this.posX) < 0.3 && !obj.hit) {
                            obj.hit = true; window.Sfx.play(1200, 'square', 0.1); 
                            this.item = 'shell'; // Ganha munição
                            window.System.msg("ITEM GET!");
                            if(this.fireBtn) {
                                this.fireBtn.innerText = "FIRE!";
                                this.fireBtn.style.filter = "none";
                            }
                        }
                    } else {
                        // COIN
                        const cS = size * 0.4;
                        ctx.fillStyle = "#f1c40f"; 
                        ctx.beginPath(); ctx.ellipse(sx, sy-cS, cS*0.8, cS, 0, 0, Math.PI*2); ctx.fill();
                        if(item.z < 60 && Math.abs(obj.x - this.posX) < 0.3 && !obj.hit) {
                            obj.hit = true; window.Sfx.coin(); this.score+=10; this.speed = Math.min(CONF.MAX_SPEED+10, this.speed+5);
                        }
                    }
                }
            });

            // =================================================================
            // 5. PLAYER COCKPIT (VOLANTE ESPORTIVO GT)
            // =================================================================
            const plyY = h * 0.9 + this.bounce;
            
            // Desenha o Kart Hero (Traseira)
            ctx.save();
            ctx.translate(cx, plyY);
            ctx.rotate(this.visualTilt * 0.15);
            const kScale = w * 0.008;
            ctx.scale(kScale, kScale);
            
            // Modelo 3D fake (Desenhado com paths)
            // Sombra
            ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.beginPath(); ctx.ellipse(0, 10, 60, 15, 0, 0, Math.PI*2); ctx.fill();
            // Corpo
            ctx.fillStyle = "#e74c3c"; // Vermelho Ferrari
            ctx.beginPath();
            ctx.moveTo(-40, -30); ctx.lineTo(40, -30);
            ctx.lineTo(50, 20); ctx.lineTo(-50, 20);
            ctx.fill();
            // Detalhes motor
            ctx.fillStyle = "#222"; ctx.fillRect(-30, -35, 60, 15);
            // Pneus
            ctx.fillStyle = "#111"; 
            ctx.fillRect(-65, -5, 20, 30); ctx.fillRect(45, -5, 20, 30);
            // Personagem (Costas)
            ctx.fillStyle = "#3498db"; ctx.beginPath(); ctx.arc(0, -30, 20, 0, Math.PI, true); ctx.fill(); // Corpo
            ctx.fillStyle = "#e74c3c"; ctx.beginPath(); ctx.arc(0, -50, 16, 0, Math.PI*2); ctx.fill(); // Cabeça
            ctx.fillStyle = "#fff"; ctx.fillText("M", -5, -45);
            
            ctx.restore();

            // =================================================================
            // 6. VOLANTE VIRTUAL ESPORTIVO (GT STEERING WHEEL)
            // =================================================================
            if(this.wheel.opacity > 0.01) {
                ctx.save();
                ctx.globalAlpha = this.wheel.opacity;
                ctx.translate(this.wheel.x, this.wheel.y);
                ctx.rotate(this.wheel.angle);
                const scaleW = w * 0.0012; // Escala do volante
                ctx.scale(scaleW, scaleW);

                // --- BASE DO VOLANTE (Retangular/Flat Bottom) ---
                ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 15;
                
                // Formato Principal
                ctx.fillStyle = "#2c3e50"; // Carbon Fiber Look
                ctx.beginPath();
                ctx.moveTo(-120, -80); // Top Left
                ctx.lineTo(120, -80);  // Top Right
                ctx.quadraticCurveTo(140, -80, 140, -40); // Canto
                ctx.lineTo(130, 60);   // Side Right
                ctx.quadraticCurveTo(120, 100, 80, 100); // Bottom Right
                ctx.lineTo(-80, 100);  // Bottom Flat
                ctx.quadraticCurveTo(-120, 100, -130, 60); // Bottom Left
                ctx.lineTo(-140, -40); // Side Left
                ctx.quadraticCurveTo(-140, -80, -120, -80); // Close
                ctx.fill();
                
                // --- PEGADAS (Grips) EM ALCANTARA ---
                ctx.fillStyle = "#95a5a6"; // Cinza
                // Esq
                ctx.beginPath(); ctx.moveTo(-140, -40); ctx.lineTo(-130, 60); ctx.lineTo(-110, 60); ctx.lineTo(-120, -40); ctx.fill();
                // Dir
                ctx.beginPath(); ctx.moveTo(140, -40); ctx.lineTo(130, 60); ctx.lineTo(110, 60); ctx.lineTo(120, -40); ctx.fill();

                // --- DISPLAY DIGITAL CENTRAL (Telemetria) ---
                ctx.shadowBlur = 0;
                ctx.fillStyle = "#000";
                ctx.fillRect(-60, -60, 120, 50);
                ctx.strokeStyle = "#444"; ctx.lineWidth = 3; ctx.strokeRect(-60, -60, 120, 50);
                
                // Dados no display
                ctx.fillStyle = "#00ff00"; // Texto Digital Verde
                ctx.font = "bold 30px monospace"; ctx.textAlign = "center";
                ctx.fillText(Math.floor(this.speed), 0, -25);
                ctx.font = "12px monospace"; 
                ctx.fillText("KMH  GEAR 4", 0, -10);

                // --- LEDS DE RPM (TOPO) ---
                const leds = 10;
                const rpmPct = this.speed / CONF.MAX_SPEED;
                for(let i=0; i<leds; i++) {
                    const active = (i/leds) < rpmPct;
                    ctx.fillStyle = active ? (i>7 ? '#ff0000' : '#ffff00') : '#333';
                    ctx.beginPath(); ctx.arc(-45 + (i*10), -70, 4, 0, Math.PI*2); ctx.fill();
                }

                // --- BOTÕES NO VOLANTE ---
                const drawBtn = (bx, by, c) => {
                    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(bx, by, 8, 0, Math.PI*2); ctx.fill();
                    ctx.strokeStyle="#fff"; ctx.lineWidth=1; ctx.stroke();
                };
                drawBtn(-80, -20, '#e74c3c'); // Radio
                drawBtn(80, -20, '#3498db');  // Drink
                drawBtn(-70, 20, '#f1c40f');  // Pit
                drawBtn(70, 20, '#2ecc71');   // Menu

                // LOGO CENTRAL
                ctx.fillStyle = "#fff"; ctx.font="bold 16px Arial"; 
                ctx.fillText("Wii GT", 0, 40);

                ctx.restore();
            }

            // --- HUD DA TELA ---
            const rankSize = 60;
            ctx.font = "italic 900 60px Arial";
            ctx.fillStyle = this.rank === 1 ? "#f1c40f" : "#fff";
            ctx.strokeStyle = "#000"; ctx.lineWidth = 5;
            ctx.strokeText(`${this.rank}/${this.opponents.length+1}`, 30, h-30);
            ctx.fillText(`${this.rank}/${this.opponents.length+1}`, 30, h-30);
            
            // Timer do "Hands Free" (Barra de tempo para atirar)
            if(this.handsFreeTimer > 0) {
                const barW = 300;
                const pct = this.handsFreeTimer / CONF.GRACE_TIME;
                ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(cx - barW/2, h*0.2, barW, 20);
                ctx.fillStyle = pct < 0.3 ? "#ff0000" : "#00ff00";
                ctx.fillRect(cx - barW/2 + 2, h*0.2 + 2, (barW-4)*pct, 16);
                ctx.fillStyle = "#fff"; ctx.font="bold 16px Arial"; ctx.textAlign="center";
                ctx.fillText("AUTO-PILOT ACTIVE: SHOOT NOW!", cx, h*0.2 - 10);
            }

            return this.score;
        }
    };

    // Remove botão ao sair
    const originalStop = window.System.stopGame;
    window.System.stopGame = function() {
        const btn = document.getElementById('kart-fire-btn');
        if(btn) btn.remove();
        if(originalStop) originalStop.apply(window.System);
    };

    if(window.System) {
        window.System.registerGame('drive', 'Otto GT Championship', '🏁', Logic, {camOpacity: 0.3, showWheel: false});
    }
})();