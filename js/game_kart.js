// =============================================================================
// LÓGICA DO JOGO: OTTO KART (SAVEIRO SUMMER EDITION - GOLD MASTER)
// ENGINE: "NINTENDO CORE" v4.0 - ESTABILIDADE & ADERÊNCIA MÁXIMA
// =============================================================================
(function() {
    // --- TUNING DE ENGENHARIA (CONFIGURAÇÕES) ---
    const CONF = {
        TRACK_LENGTH: 16000,
        MAX_SPEED: 210,         // Velocidade Agressiva
        ACCEL: 1.5,             // Arrancada forte
        GRIP: 0.94,             // Coeficiente de atrito lateral (Evita sabonete)
        CENTER_FORCE: 0.04,     // O "Fixador" (Puxa pro centro)
        FOV: 800,
        GRACE_TIME: 150,        // Tempo do Auto-Pilot
        LANE_WIDTH: 2000
    };

    // Paleta Clássica Nintendo (Solicitada)
    const PALETTE = {
        skyTop: '#0099ff', skyBot: '#87CEEB',
        grass: '#32cd32',
        road: '#555',
        curbA: '#ff0000', curbB: '#ffffff'
    };

    let particles = [];
    let projectiles = [];
    
    const Logic = {
        // --- FÍSICA ---
        speed: 0, posZ: 0, posX: 0, steer: 0,
        
        // --- ESTADO ---
        lap: 1, totalLaps: 3, rank: 8, score: 0, health: 100,
        item: 'shell',
        spinTimer: 0,
        hitStun: 0,
        
        // --- AUTO-PILOT ---
        handsFreeTimer: 0,
        isAutoPilot: false,
        
        // --- VISUAL ---
        visualTilt: 0, bounce: 0, shake: 0,
        
        // --- INPUT ---
        inputState: 0,
        hands: { left: null, right: null },
        wheel: { x: 0, y: 0, angle: 0, opacity: 0 },
        
        // --- ENTIDADES ---
        opponents: [],
        props: [],
        
        // --- UI ---
        btnFire: null,

        init: function() {
            this.resetRace();
            this.createFireButton();
            
            // Sequência de Largada Profissional
            window.System.msg("QUALIFYING"); 
            window.Sfx.play(100, 'sawtooth', 0.5, 0.2); 
            setTimeout(() => { window.System.msg("3"); window.Sfx.play(400, 'square', 0.2); }, 1000);
            setTimeout(() => { window.System.msg("2"); window.Sfx.play(400, 'square', 0.2); }, 2000);
            setTimeout(() => { window.System.msg("1"); window.Sfx.play(600, 'square', 0.2); }, 3000);
            setTimeout(() => { 
                window.System.msg("GO!!!"); 
                window.Sfx.play(800, 'square', 1.0, 0.1);
            }, 4000);
        },

        resetRace: function() {
            this.speed = 0; this.posZ = 0; this.posX = 0; this.steer = 0;
            this.lap = 1; this.health = 100; this.score = 0; this.item = 'shell';
            this.spinTimer = 0; this.hitStun = 0;
            particles = []; projectiles = [];
            
            // Adversários Competitivos
            const names = ["Luigi", "Peach", "Bowser", "Yoshi", "Toad"];
            const colors = ['#2ecc71', '#ff9ff3', '#f39c12', '#7cfc00', '#ecf0f1'];
            
            this.opponents = [];
            for(let i=0; i<5; i++) {
                this.opponents.push({
                    id: i, name: names[i], color: colors[i],
                    x: (Math.random()-0.5), z: (i+1) * 300, 
                    speed: 0, maxSpeed: CONF.MAX_SPEED * (0.94 + Math.random()*0.08),
                    spin: 0
                });
            }

            // Geração de Pista (Balanceada)
            this.props = [];
            for(let i=1000; i<CONF.TRACK_LENGTH*3; i+=350) {
                // Obstáculos laterais (Canos)
                if(Math.random() < 0.35) {
                    this.props.push({ type: 'pipe', z: i, x: (Math.random()>0.5 ? 1.4 : -1.4), hit:false });
                }
                // Itens no centro
                if(Math.random() < 0.25) {
                    this.props.push({ type: Math.random()<0.6?'box':'coin', z: i, x: (Math.random()*1.2 - 0.6), hit:false });
                }
            }
        },

        createFireButton: function() {
            const old = document.getElementById('kart-fire-btn');
            if(old) old.remove();

            const btn = document.createElement('div');
            btn.id = 'kart-fire-btn';
            // Ícone tático
            btn.innerHTML = `<div style="font-size:40px; transform:rotate(-45deg)">🚀</div>`; 
            
            // ESTILO PAINEL DE CONTROLE (Lado Esquerdo)
            Object.assign(btn.style, {
                position: 'absolute', bottom: '40px', left: '30px',
                width: '100px', height: '100px',
                borderRadius: '16px', // Quadrado arredondado (estilo botão automotivo)
                background: 'linear-gradient(180deg, #ff4444, #990000)',
                border: '4px solid #fff',
                borderBottom: '8px solid #ccc', // Efeito 3D de clique
                boxShadow: '0 10px 20px rgba(0,0,0,0.5)',
                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: '9999', cursor: 'pointer', pointerEvents: 'auto',
                transform: 'scale(0)', transition: 'transform 0.2s',
                userSelect: 'none'
            });

            const action = (e) => {
                e.preventDefault(); e.stopPropagation();
                if(this.item && this.hitStun === 0) {
                    // Animação de clique físico
                    btn.style.borderBottom = '4px solid #ccc';
                    btn.style.transform = 'scale(0.95) translateY(4px)';
                    setTimeout(()=> {
                        btn.style.borderBottom = '8px solid #ccc';
                        btn.style.transform = 'scale(1) translateY(0)';
                    }, 100);
                    this.shoot();
                }
            };
            btn.addEventListener('mousedown', action);
            btn.addEventListener('touchstart', action, {passive: false});

            document.body.appendChild(btn);
            this.btnFire = btn;
        },

        shoot: function() {
            if(!this.item) return;
            window.Sfx.play(800, 'square', 0.1);
            window.Sfx.play(200, 'noise', 0.2);
            
            projectiles.push({
                x: this.posX, z: this.posZ + 250, 
                speed: this.speed + 80, life: 300, type: 'green_shell'
            });
            
            this.item = null;
            if(this.btnFire) {
                this.btnFire.style.filter = 'grayscale(100%)';
                this.btnFire.style.opacity = '0.5';
                setTimeout(() => { if(this.btnFire) this.btnFire.style.transform = 'scale(0)'; }, 400);
            }
        },

        update: function(ctx, w, h, pose) {
            const cx = w/2;
            const cy = h/2;
            const horizon = h * 0.35;

            // =================================================================
            // 1. INPUT SYSTEM PRO (COM ESTABILIZAÇÃO)
            // =================================================================
            let targetSteer = 0;
            let handsActive = false;

            if(pose && this.health > 0) {
                const kp = pose.keypoints;
                const lw = kp.find(k=>k.name==='left_wrist');
                const rw = kp.find(k=>k.name==='right_wrist');
                if(lw && lw.score > 0.4) this.hands.left = window.Gfx.map(lw,w,h);
                if(rw && rw.score > 0.4) this.hands.right = window.Gfx.map(rw,w,h);

                // MÁQUINA DE ESTADOS DE INPUT
                if(this.hands.left && this.hands.right) {
                    // --- MODO DIREÇÃO ESPORTIVA (2 Mãos) ---
                    this.inputState = 2;
                    this.handsFreeTimer = CONF.GRACE_TIME;
                    this.isAutoPilot = false;
                    handsActive = true;

                    // Centraliza volante virtual suavemente
                    const mx = (this.hands.left.x + this.hands.right.x)/2;
                    const my = (this.hands.left.y + this.hands.right.y)/2;
                    this.wheel.x += (mx - this.wheel.x)*0.2;
                    this.wheel.y += (my - this.wheel.y)*0.2;

                    // Calcula Ângulo
                    const dx = this.hands.right.x - this.hands.left.x;
                    const dy = this.hands.right.y - this.hands.left.y;
                    let angle = Math.atan2(dy, dx);
                    
                    // Deadzone Inteligente (Evita tremedeira em retas)
                    if(Math.abs(angle) < 0.12) angle = 0;
                    
                    targetSteer = angle * 2.5; // Resposta rápida (Sport)

                    // Aceleração Progressiva
                    if(this.speed < CONF.MAX_SPEED && this.spinTimer === 0 && this.hitStun === 0) {
                        this.speed += CONF.ACCEL;
                    }

                    // Esconde botão de tiro (Focus Mode)
                    if(this.btnFire) this.btnFire.style.transform = 'scale(0)';

                } else if ((this.hands.left || this.hands.right) && this.handsFreeTimer > 0) {
                    // --- MODO COMBATE (1 Mão + Auto-Pilot) ---
                    this.inputState = 1;
                    this.isAutoPilot = true;
                    this.handsFreeTimer--;
                    handsActive = true;

                    // Mostra Botão
                    if(this.item && this.btnFire) {
                        this.btnFire.style.transform = 'scale(1)';
                        this.btnFire.style.filter = 'none';
                        this.btnFire.style.opacity = '1';
                    }
                    
                    // Auto-Pilot: Mantém o carro estável enquanto atira
                    targetSteer = this.steer * 0.8; 
                    this.speed *= 0.99; // Mantém embalo
                } else {
                    // --- SEM CONTROLE ---
                    this.inputState = 0;
                    this.speed *= 0.96; // Freio motor
                    if(this.btnFire) this.btnFire.style.transform = 'scale(0)';
                }
            }

            // APLICAÇÃO DE FÍSICA NO VOLANTE
            if(this.spinTimer > 0 || this.hitStun > 0) {
                // Perda de controle se bater
                this.steer += (Math.random()-0.5) * 0.5;
                this.speed *= 0.92;
                if(this.spinTimer > 0) this.spinTimer--;
                if(this.hitStun > 0) this.hitStun--;
            } else {
                // Direção precisa
                this.steer += (targetSteer - this.steer) * 0.15;
            }
            
            // Atualiza Visual do Volante
            this.wheel.angle = this.steer;
            this.wheel.opacity += handsActive ? 0.1 : -0.1;
            this.wheel.opacity = Math.max(0, Math.min(1, this.wheel.opacity));

            // =================================================================
            // 2. FÍSICA DO MUNDO (O SEGREDO DO "FIXADOR")
            // =================================================================
            this.posZ += this.speed;

            // Curva Suave (Senoide)
            const curve = Math.sin(this.posZ * 0.002) * 2.2;
            
            // Movimento Lateral com GRIP (Aderência)
            // Se steer for 0, o carro não desliza sozinho.
            this.posX += (this.steer * 0.06);           // Input
            this.posX -= (curve * (this.speed/CONF.MAX_SPEED) * 0.06); // Força centrífuga da curva

            // *** O FIXADOR (CENTER MAGNET) ***
            // Se o jogador não estiver virando muito, puxe suavemente para o centro da pista.
            // Isso cria a sensação de "trilho" e evita o efeito sabonete.
            if(Math.abs(this.steer) < 0.2 && this.spinTimer === 0) {
                this.posX = this.posX * CONF.GRIP; // Decaimento exponencial para o centro
            }

            // Tilt Visual (Inclinação do chassi)
            this.visualTilt += ((this.steer - curve*0.6) - this.visualTilt) * 0.1;
            
            // COLISÃO COM PAREDES (Refinada)
            let offRoad = false;
            if(Math.abs(this.posX) > 1.4) {
                offRoad = true;
                this.speed *= 0.9; // Perde velocidade, mas não para
                this.shake = 8;    // Tremor de impacto
                
                // Rebote Físico (Empurra de volta pra pista sem girar)
                this.posX = (this.posX > 0) ? 1.35 : -1.35;
                this.steer *= -0.2; // Contra-esterço automático leve
                
                if(this.speed > 80 && Math.random() < 0.2) window.Sfx.play(80, 'noise', 0.15);
            } else {
                this.shake = 0;
            }
            
            // Vibração do motor (RPM)
            this.bounce = Math.sin(Date.now()/30) * (1 + (this.speed/CONF.MAX_SPEED)*3);

            // Loop de Pista Infinito
            if(this.posZ >= CONF.TRACK_LENGTH) {
                this.posZ -= CONF.TRACK_LENGTH;
                this.lap++;
                this.opponents.forEach(o => o.z -= CONF.TRACK_LENGTH);
                this.props.forEach(p => p.hit = false);
                window.System.msg("VOLTA " + this.lap + "/" + this.totalLaps);
            }

            // =================================================================
            // 3. IA COMPETITIVA (RUBBER BANDING)
            // =================================================================
            this.opponents.forEach(bot => {
                if(bot.spin > 0) { 
                    bot.spin--; 
                    bot.speed *= 0.85; 
                } else {
                    let targetSpd = bot.maxSpeed;
                    const dist = bot.z - this.posZ;
                    
                    // IA elástica: Se você está na frente, eles aceleram. Se atrás, esperam.
                    if(dist < -1500) targetSpd *= 1.4; // Turbo Mode
                    if(dist > 2500) targetSpd *= 0.8;  // Cruise Mode
                    
                    bot.speed += (targetSpd - bot.speed) * 0.05;
                    bot.z += bot.speed;
                    
                    // IA segue a curva perfeitamente
                    const bCurve = Math.sin(bot.z * 0.002) * 2.2;
                    bot.x += (-Math.sign(bCurve)*0.55 - bot.x) * 0.04;
                    
                    // Desvio de colisão
                    if(Math.abs(dist) < 300 && Math.abs(bot.x - this.posX) < 0.35) {
                        bot.x += bot.x > this.posX ? 0.06 : -0.06;
                    }
                }
            });

            // Projéteis (Cascos Verdes)
            for(let i=projectiles.length-1; i>=0; i--) {
                const p = projectiles[i];
                p.z += p.speed;
                p.life--;
                
                let hit = false;
                this.opponents.forEach(bot => {
                    if(!hit && Math.abs(p.z - bot.z) < 200 && Math.abs(p.x - bot.x) < 0.5) {
                        bot.spin = 60; hit = true;
                        window.System.msg("ACERTOU " + bot.name + "!");
                        window.Sfx.crash();
                        // Partículas de impacto
                        for(let k=0;k<8;k++) particles.push({x:bot.x, z:bot.z, y:0, vx:Math.random()-0.5, vy:Math.random(), c:'#ff0', life:20});
                    }
                });
                if(p.life <= 0 || hit) projectiles.splice(i,1);
            }

            // Obstáculos e Itens
            this.props.forEach(p => {
                let dz = p.z - this.posZ;
                while(dz < -500) dz += CONF.TRACK_LENGTH;
                while(dz > CONF.TRACK_LENGTH - 500) dz -= CONF.TRACK_LENGTH;

                if(!p.hit && Math.abs(dz) < 120 && Math.abs(p.x - this.posX) < 0.4) {
                    p.hit = true;
                    if(p.type === 'box') {
                        window.Sfx.play(1200, 'square', 0.1);
                        this.item = 'shell';
                        window.System.msg("CASCO VERDE!");
                    } else if (p.type === 'pipe') {
                        this.hitStun = 30; // Perda de controle temporária
                        this.health -= 15;
                        this.speed *= 0.3; // Parada brusca
                        window.System.msg("BATIDA!"); 
                        window.Sfx.crash();
                        window.Gfx.shake(20);
                    } else if (p.type === 'coin') {
                         window.Sfx.coin(); this.score+=50; 
                         this.speed = Math.min(this.speed + 10, CONF.MAX_SPEED + 20); // Mini Turbo
                    }
                }
            });

            // Cálculo de Rank em Tempo Real
            let r = 1;
            this.opponents.forEach(o => {
                const bTotal = o.z + (this.lap * CONF.TRACK_LENGTH);
                const pTotal = this.posZ + (this.lap * CONF.TRACK_LENGTH);
                if(bTotal > pTotal) r++;
            });
            this.rank = r;

            // =================================================================
            // 4. RENDERIZAÇÃO (ENGINE VISUAL RETRÔ + SAVEIRO WHEEL)
            // =================================================================
            
            // --- CÉU & FUNDO (ORIGINAL SOLICITADO) ---
            const gradSky = ctx.createLinearGradient(0, 0, 0, horizon);
            gradSky.addColorStop(0, PALETTE.skyTop); gradSky.addColorStop(1, PALETTE.skyBot);
            ctx.fillStyle = gradSky; ctx.fillRect(0, 0, w, horizon);

            // Nuvens Parallax
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            const bgX = this.steer * 80 + (curve * 150);
            const drawCloud = (cx, cy, s) => { ctx.beginPath(); ctx.arc(cx, cy, 30*s, 0, Math.PI*2); ctx.arc(cx+25*s, cy-10*s, 35*s, 0, Math.PI*2); ctx.arc(cx+50*s, cy, 30*s, 0, Math.PI*2); ctx.fill(); };
            for(let k=-1; k<=1; k++) {
                drawCloud(w*0.2 - bgX + (k*w), horizon*0.6, 1.2); 
                drawCloud(w*0.8 - bgX + (k*w), horizon*0.4, 0.8);
            }

            // Morro Verde
            ctx.fillStyle = '#2ecc71'; ctx.beginPath(); ctx.moveTo(0, horizon);
            ctx.quadraticCurveTo(w*0.3, horizon - 50, w*0.6, horizon);
            ctx.quadraticCurveTo(w*0.8, horizon - 80, w, horizon);
            ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();

            // Grama
            ctx.fillStyle = PALETTE.grass; ctx.fillRect(0, horizon, w, h);

            // --- ESTRADA (PROJEÇÃO TRAPEZOIDAL) ---
            const roadW_Far = w * 0.01; const roadW_Near = w * 2.2;
            const cxFar = cx - (curve * w * 0.8) - (this.steer * w * 0.4);
            const cxNear = cx - (this.posX * w * 1.0);

            // Zebras (Efeito Velocidade)
            const segLen = 400; const phase = Math.floor(this.posZ / segLen) % 2;
            const zebraW = w * 0.35;
            ctx.fillStyle = (phase === 0) ? PALETTE.curbA : PALETTE.curbB;
            ctx.beginPath();
            ctx.moveTo(cxFar - roadW_Far - (zebraW*0.05), horizon);
            ctx.lineTo(cxFar + roadW_Far + (zebraW*0.05), horizon);
            ctx.lineTo(cxNear + roadW_Near + zebraW, h);
            ctx.lineTo(cxNear - roadW_Near - zebraW, h);
            ctx.fill();

            // Asfalto
            ctx.fillStyle = PALETTE.road; 
            ctx.beginPath();
            ctx.moveTo(cxFar - roadW_Far, horizon);
            ctx.lineTo(cxFar + roadW_Far, horizon);
            ctx.lineTo(cxNear + roadW_Near, h);
            ctx.lineTo(cxNear - roadW_Near, h);
            ctx.fill();

            // Faixa Central
            ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = w * 0.015;
            ctx.setLineDash([h * 0.1, h * 0.15]); ctx.lineDashOffset = -this.posZ * 1.5;
            ctx.beginPath();
            ctx.moveTo(cxFar, horizon);
            ctx.quadraticCurveTo((cxFar+cxNear)/2 + curve*100, (horizon+h)/2, cxNear, h);
            ctx.stroke(); ctx.setLineDash([]);

            // --- Z-BUFFER RENDER SYSTEM ---
            let drawQueue = [];
            
            // Adiciona Elementos na Fila de Desenho
            this.opponents.forEach(o => {
                let dz = o.z - this.posZ;
                if(dz < -5000) dz += CONF.TRACK_LENGTH;
                if(dz > 5000) dz -= CONF.TRACK_LENGTH;
                if(dz > 10) drawQueue.push({type:'kart', obj:o, z:dz});
            });
            this.props.forEach(p => {
                let dz = p.z - this.posZ;
                while(dz < -500) dz += CONF.TRACK_LENGTH;
                while(dz > CONF.TRACK_LENGTH - 500) dz -= CONF.TRACK_LENGTH;
                if(dz > 10 && dz < 3000) drawQueue.push({type:'prop', obj:p, z:dz});
            });
            projectiles.forEach(p => {
                let dz = p.z - this.posZ;
                if(dz > 10) drawQueue.push({type:'shell', obj:p, z:dz});
            });

            // Ordena do mais longe para o mais perto
            drawQueue.sort((a,b) => b.z - a.z);

            drawQueue.forEach(item => {
                const scale = CONF.FOV / (CONF.FOV + item.z);
                const obj = item.obj;
                const roadW = roadW_Far + (roadW_Near - roadW_Far) * scale;
                const roadCX = cxFar + (cxNear - cxFar) * scale;
                const sx = roadCX + (obj.x * roadW * 0.5);
                const sy = horizon + ((h-horizon)*scale);
                const size = w * 0.18 * scale;

                if(item.type === 'kart') this.drawKartRival(ctx, sx, sy, size, obj, scale, w);
                else if (item.type === 'shell') this.drawShell(ctx, sx, sy, size);
                else if (item.type === 'prop') this.drawProp(ctx, sx, sy, size, obj, scale);
            });

            // --- PLAYER CHARACTER (ORIGINAL RETRÔ) ---
            const carScale = w * 0.0055;
            const carX = cx + this.shake;
            const carY = h * 0.88 + this.bounce;
            
            this.drawPlayerOriginal(ctx, carX, carY, carScale, this.visualTilt);

            // Partículas
            particles.forEach((p,i) => {
                p.x += p.vx; p.y += p.vy; p.life--;
                if(p.life<=0) particles.splice(i,1);
                else { ctx.fillStyle=p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.s || 4, 0, Math.PI*2); ctx.fill(); }
            });

            // --- INTERFACE DE USUÁRIO (HUD) ---
            this.drawHUD(ctx, w, h);
            this.drawSaveiroWheel(ctx, w, h);

            if(this.lap > this.totalLaps) window.System.gameOver("RANK: " + this.rank);
            if(this.health <= 0) window.System.gameOver("GAME OVER");

            return this.score;
        },

        // =====================================================================
        // ASSETS GRÁFICOS (DESENHADOS NO CANVAS)
        // =====================================================================

        drawPlayerOriginal: function(ctx, carX, carY, carScale, tilt) {
            ctx.save(); 
            ctx.translate(carX, carY); 
            ctx.scale(carScale, carScale); 
            ctx.rotate(tilt * 0.15);
            if(this.spinTimer > 0) ctx.rotate(this.spinTimer * 0.4);

            // Sombra
            ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(0, 25, 50, 15, 0, 0, Math.PI*2); ctx.fill();
            // Corpo
            ctx.fillStyle = '#111'; ctx.fillRect(-50, 5, 25, 25); ctx.fillRect(25, 5, 25, 25);
            ctx.fillStyle = '#ddd'; ctx.fillRect(-45, 10, 15, 15); ctx.fillRect(30, 10, 15, 15);
            ctx.fillStyle = '#333'; ctx.fillRect(-25, 20, 50, 15);
            // Escapamentos
            ctx.fillStyle = '#777'; ctx.beginPath(); ctx.arc(-15, 30, 6, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(15, 30, 6, 0, Math.PI*2); ctx.fill(); 
            // Carenagem Vermelha
            const bodyGrad = ctx.createLinearGradient(-30, -20, 30, 20); bodyGrad.addColorStop(0, '#ff0000'); bodyGrad.addColorStop(1, '#cc0000');
            ctx.fillStyle = bodyGrad; ctx.beginPath(); ctx.moveTo(-20, -50); ctx.lineTo(20, -50); ctx.lineTo(35, 10); ctx.lineTo(40, 25); ctx.lineTo(-40, 25); ctx.lineTo(-35, 10); ctx.fill();
            // Banco
            ctx.fillStyle = '#222'; ctx.beginPath(); ctx.ellipse(0, 0, 20, 15, 0, 0, Math.PI*2); ctx.fill();

            // Cockpit e Piloto (M)
            ctx.save(); ctx.rotate(this.steer * 0.5); 
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -25, 18, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#ff0000'; ctx.font="bold 12px Arial"; ctx.textAlign="center"; ctx.fillText("M", 0, -32);
            ctx.fillStyle = '#333'; ctx.fillRect(-12, -28, 24, 8);
            ctx.restore();

            // Rodas Frente (Esterçam com o volante)
            ctx.fillStyle = '#111';
            ctx.save(); ctx.translate(-35, -35); ctx.rotate(this.steer * 0.6); ctx.fillRect(-8, -10, 16, 20); ctx.restore();
            ctx.save(); ctx.translate(35, -35); ctx.rotate(this.steer * 0.6); ctx.fillRect(-8, -10, 16, 20); ctx.restore();
            ctx.restore();

            ctx.restore();
        },

        drawKartRival: function(ctx, x, y, size, o, scale, w) {
            const kScale = scale * w * 0.005;
            ctx.save(); ctx.translate(x, y); ctx.scale(kScale, kScale);
            if(o.spin > 0) ctx.rotate(o.spin * 0.5);

            ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(0, 10, 30, 8, 0, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = o.color; ctx.fillRect(-20, -15, 40, 20);
            ctx.fillStyle = '#222'; ctx.fillRect(-22, -5, 8, 15); ctx.fillRect(14, -5, 8, 15);
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -20, 12, 0, Math.PI*2); ctx.fill();
            
            ctx.fillStyle = '#fff'; ctx.font = "bold 14px Arial"; ctx.textAlign = "center";
            ctx.fillText(o.name, 0, -40);

            ctx.restore();
        },

        drawProp: function(ctx, x, y, size, o, scale) {
            if(o.type === 'pipe') {
                 // Cano Estilo Mario (Verde e Brilhante)
                 const hSign = size * 1.5;
                 ctx.fillStyle = '#00aa00'; ctx.strokeStyle = '#004400'; ctx.lineWidth = 2;
                 ctx.fillRect(x - size/2, y - hSign, size, hSign); ctx.strokeRect(x - size/2, y - hSign, size, hSign);
                 // Borda superior do cano
                 const rimW = size + 10*scale; const rimH = 20*scale;
                 ctx.fillRect(x - rimW/2, y - hSign, rimW, rimH); ctx.strokeRect(x - rimW/2, y - hSign, rimW, rimH);
            } else if (o.type === 'box') {
                 // Item Box Pulsante
                 const bS = size * 0.8;
                 const f = Math.sin(Date.now()/150)*8;
                 ctx.fillStyle = 'rgba(255,200,0,0.8)'; ctx.strokeStyle = '#ffff00'; ctx.lineWidth = 3;
                 ctx.fillRect(x-bS/2, y-bS*2+f, bS, bS); ctx.strokeRect(x-bS/2, y-bS*2+f, bS, bS);
                 ctx.fillStyle = '#fff'; ctx.font="bold 20px Arial"; ctx.textAlign="center"; ctx.fillText("?", x, y-bS*1.3+f);
            } else {
                 // Coin
                 const cS = size * 0.5;
                 ctx.fillStyle = '#f1c40f'; ctx.beginPath(); ctx.ellipse(x, y-cS*1.5, cS*0.7, cS, 0, 0, Math.PI*2); ctx.fill();
            }
        },

        drawShell: function(ctx, x, y, s) {
            ctx.fillStyle = '#2ecc71'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(x, y-s*0.4, s*0.3, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        },

        // --- VOLANTE "SAVEIRO SUMMER" (VW CLASSIC 4-SPOKE) ---
        drawSaveiroWheel: function(ctx, w, h) {
            if(this.wheel.opacity <= 0.01) return;
            
            ctx.save(); 
            ctx.globalAlpha = this.wheel.opacity;
            ctx.translate(this.wheel.x, this.wheel.y); 
            ctx.rotate(this.wheel.angle);
            const s = w * 0.0013; 
            ctx.scale(s, s);

            // Sombra do Volante
            ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 25; ctx.shadowOffsetY = 15;

            // 1. ARO EXTERNO (Grosso, Preto, Textura de Couro)
            ctx.beginPath();
            ctx.arc(0, 0, 140, 0, Math.PI*2); // Externo
            ctx.arc(0, 0, 110, 0, Math.PI*2, true); // Interno
            ctx.fillStyle = '#111'; ctx.fill();
            // Reflexo superior
            const grad = ctx.createLinearGradient(0, -140, 0, -110);
            grad.addColorStop(0, '#444'); grad.addColorStop(1, '#111');
            ctx.strokeStyle = grad; ctx.lineWidth = 2; ctx.stroke();

            // 2. O CLÁSSICO "4 BOLAS" (Design VW Anos 90)
            ctx.fillStyle = '#1a1a1a'; // Preto fosco no centro
            ctx.beginPath(); ctx.arc(0, 0, 55, 0, Math.PI*2); ctx.fill();

            // 3. RAIOS (4 Conexões Sólidas)
            ctx.fillStyle = '#222';
            // Raio Superior Esquerdo
            ctx.beginPath(); ctx.moveTo(-40, -35); ctx.lineTo(-115, -15); ctx.lineTo(-110, 15); ctx.lineTo(-40, 10); ctx.fill();
            // Raio Superior Direito
            ctx.beginPath(); ctx.moveTo(40, -35); ctx.lineTo(115, -15); ctx.lineTo(110, 15); ctx.lineTo(40, 10); ctx.fill();
            // Raio Inferior Esquerdo
            ctx.beginPath(); ctx.moveTo(-30, 45); ctx.lineTo(-80, 100); ctx.lineTo(-60, 110); ctx.lineTo(-20, 50); ctx.fill();
            // Raio Inferior Direito
            ctx.beginPath(); ctx.moveTo(30, 45); ctx.lineTo(80, 100); ctx.lineTo(60, 110); ctx.lineTo(20, 50); ctx.fill();

            // 4. BUZINA CENTRAL (A "Bola" da Saveiro Summer)
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, 0, 35, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = '#333'; ctx.lineWidth = 3; ctx.stroke();
            
            // Logo Central (VW estilizado)
            ctx.fillStyle = '#silver'; 
            ctx.beginPath(); ctx.arc(0,0,12,0,Math.PI*2); ctx.fill();
            ctx.fillStyle = '#000'; ctx.font="bold 10px Arial"; ctx.textAlign="center"; ctx.textBaseline="middle";
            ctx.fillText("VW", 0, 0);

            // Detalhe Vermelho Esportivo
            ctx.fillStyle = '#cc0000'; ctx.beginPath(); ctx.rect(-5, 45, 10, 5); ctx.fill();

            ctx.restore();
        },

        drawHUD: function(ctx, w, h) {
            // Velocímetro (Direita - Não encosta no botão de tiro)
            const hudX = w - 80; const hudY = h - 60;
            ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(hudX, hudY, 50, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.stroke();
            ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = "bold 36px 'Russo One'"; ctx.fillText(Math.floor(this.speed), hudX, hudY + 10);
            ctx.font = "12px Arial"; ctx.fillText("KM/H", hudX, hudY + 30);
            
            // Rank
            ctx.font = "italic 900 60px Arial";
            ctx.fillStyle = this.rank===1?'#ffd700':'#fff';
            ctx.strokeStyle = '#000'; ctx.lineWidth=4;
            ctx.strokeText(this.rank, 50, h-80); ctx.fillText(this.rank, 50, h-80);

            // Item Slot (Topo Esq)
            ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(20, 20, 70, 70);
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(20, 20, 70, 70);
            if(this.item === 'shell') {
                ctx.fillStyle = '#2ecc71'; ctx.beginPath(); ctx.arc(55, 55, 20, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = '#fff'; ctx.stroke();
            }

            // Barra Auto-Pilot
            if(this.isAutoPilot && this.handsFreeTimer > 0) {
                const bw = 300; const bp = this.handsFreeTimer/CONF.GRACE_TIME;
                ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(w/2 - bw/2, h*0.2, bw, 25);
                ctx.fillStyle = bp < 0.3 ? '#f00' : '#0f0';
                ctx.fillRect(w/2 - bw/2 + 3, h*0.2 + 3, (bw-6)*bp, 19);
                ctx.fillStyle = '#fff'; ctx.font="bold 14px Arial"; ctx.textAlign="center";
                ctx.fillText("PILOTO AUTOMÁTICO", w/2, h*0.2 - 5);
            }
        }
    };

    const _stop = window.System.stopGame;
    window.System.stopGame = function() {
        if(document.getElementById('kart-fire-btn')) document.getElementById('kart-fire-btn').remove();
        _stop.apply(this);
    };

    if(window.System) window.System.registerGame('drive', 'Otto Kart', '🏎️', Logic, {camOpacity: 0.4, showWheel: false});
})();