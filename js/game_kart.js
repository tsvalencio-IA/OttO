// LÓGICA DO JOGO: KART DO OTTO (NINTENDO MASTER EDITION - VISUAL EXTREMO)
// ARCHITECT: CODE 177
(function() {
    // --- CONFIGURAÇÕES DE ALTA FIDELIDADE ---
    const CONF = {
        TRACK_LENGTH: 18000,    // Pista longa (Grand Prix)
        MAX_SPEED: 170,         // Alta velocidade
        FOV: 900,               // Campo de visão amplo
        GRACE_TIME: 150,        // 5 segundos (30fps)
        LANES: 3
    };

    // Cores da Paleta Nintendo
    const PALETTE = {
        skyTop: '#2980b9', skyBot: '#87CEEB',
        grassLight: '#4cd137', grassDark: '#44bd32',
        road: '#555', roadLine: '#ecf0f1',
        curbRed: '#e74c3c', curbWhite: '#fff',
        uiBg: 'rgba(0,0,0,0.7)', uiText: '#fff'
    };

    // Variáveis Globais de Efeito
    let particles = [];
    let projectiles = [];
    
    const Logic = {
        // --- ESTADO FÍSICO ---
        speed: 0,
        posZ: 0,
        posX: 0,        // -1.5 a 1.5
        steer: 0,       // -1 a 1
        
        // --- ESTADO DE JOGO ---
        lap: 1,
        totalLaps: 3,
        rank: 4,
        score: 0,
        health: 100,
        item: 'shell', // Começa com casco para teste
        
        // --- MODO COMBATE (HANDS FREE) ---
        handsFreeTimer: 0,
        isAutoPilot: false,
        
        // --- VISUAL ---
        visualTilt: 0,
        bounce: 0,
        cameraShake: 0,
        
        // --- INPUT ---
        inputState: 0,
        hands: { left: null, right: null },
        wheel: { x: 0, y: 0, angle: 0, opacity: 0 },
        
        // --- ENTIDADES ---
        opponents: [],
        props: [],
        
        // --- ELEMENTOS DOM ---
        btnFire: null,

        init: function() {
            this.resetRace();
            this.injectUI();
            
            // Sequência de Largada Cinematic
            window.System.msg("QUALIFYING");
            setTimeout(()=> { window.System.msg("3"); window.Sfx.play(400,'square',0.1); }, 1000);
            setTimeout(()=> { window.System.msg("2"); window.Sfx.play(400,'square',0.1); }, 2000);
            setTimeout(()=> { window.System.msg("1"); window.Sfx.play(600,'square',0.1); }, 3000);
            setTimeout(()=> { window.System.msg("GO!!!"); window.Sfx.play(800,'sawtooth',1.0); }, 4000);
        },

        resetRace: function() {
            this.speed = 0; this.posZ = 0; this.posX = 0; this.steer = 0;
            this.lap = 1; this.health = 100; this.score = 0;
            this.item = 'shell';
            particles = []; projectiles = [];
            
            // IAs com Personalidade Visual
            this.opponents = [
                { id: 'luigi',  name: 'L-MAN',  char: 'luigi',  x: -0.5, z: 200, speed: 0, color: '#2ecc71' },
                { id: 'peach',  name: 'PEACH',  char: 'peach',  x: 0.5,  z: 500, speed: 0, color: '#ff9ff3' },
                { id: 'bowser', name: 'KING-B', char: 'bowser', x: 0,    z: 800, speed: 0, color: '#f1c40f' }
            ];

            // Geração de Pista (Curvas e Itens)
            this.props = [];
            for(let i=2000; i<CONF.TRACK_LENGTH * 3; i+=800) {
                if(Math.random() < 0.6) {
                    this.props.push({
                        type: Math.random() < 0.3 ? 'box' : (Math.random()<0.5?'coin':'tree'),
                        z: i,
                        x: (Math.random() * 2.4) - 1.2,
                        hit: false
                    });
                }
            }
        },

        injectUI: function() {
            // Remove botão antigo se existir
            const old = document.getElementById('nintendo-fire-btn');
            if(old) old.remove();

            // Cria botão de tiro Estilo Arcade
            const btn = document.createElement('div');
            btn.id = 'nintendo-fire-btn';
            btn.innerHTML = `<div style="font-size:24px; font-weight:900; transform:skew(-5deg)">FIRE</div>`;
            
            Object.assign(btn.style, {
                position: 'absolute', bottom: '15%', right: '5%',
                width: '130px', height: '130px', borderRadius: '50%',
                background: 'radial-gradient(circle at 30% 30%, #ff5252, #b33939)',
                border: '6px solid #fff',
                boxShadow: '0 10px 0 #8b0000, 0 15px 20px rgba(0,0,0,0.5)',
                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', zIndex: '100', transition: 'all 0.1s',
                transform: 'scale(0)', pointerEvents: 'auto', userSelect: 'none'
            });

            // Efeito de clique
            btn.onmousedown = btn.ontouchstart = (e) => {
                e.stopPropagation(); e.preventDefault();
                btn.style.boxShadow = '0 2px 0 #8b0000, 0 5px 10px rgba(0,0,0,0.5)';
                btn.style.transform = 'scale(1) translateY(8px)';
                this.shoot();
            };
            btn.onmouseup = btn.ontouchend = () => {
                btn.style.boxShadow = '0 10px 0 #8b0000, 0 15px 20px rgba(0,0,0,0.5)';
                btn.style.transform = 'scale(1) translateY(0)';
            };

            document.getElementById('game-ui').appendChild(btn);
            this.btnFire = btn;
        },

        shoot: function() {
            if(this.item) {
                window.Sfx.play(800, 'square', 0.1);
                window.Sfx.play(200, 'noise', 0.2);
                projectiles.push({ x: this.posX, z: this.posZ + 300, speed: this.speed + 50, life: 300 });
                this.item = null;
                // Feedback visual no botão
                this.btnFire.style.filter = "grayscale(100%)";
                setTimeout(() => { if(this.btnFire) this.btnFire.style.transform = 'scale(0)'; }, 300);
            }
        },

        update: function(ctx, w, h, pose) {
            const cx = w/2;
            const cy = h/2;
            const horizon = h * 0.45;

            // =================================================================
            // 1. INPUT SYSTEM (SMART HANDS-FREE LOGIC)
            // =================================================================
            let targetSteer = 0;
            let activeHands = false;

            if(pose) {
                const kp = pose.keypoints;
                const lw = kp.find(k=>k.name==='left_wrist');
                const rw = kp.find(k=>k.name==='right_wrist');
                
                if(lw && lw.score > 0.4) this.hands.left = window.Gfx.map(lw,w,h);
                if(rw && rw.score > 0.4) this.hands.right = window.Gfx.map(rw,w,h);

                // DUAS MÃOS (DIRIGINDO)
                if(this.hands.left && this.hands.right) {
                    this.inputState = 2;
                    this.handsFreeTimer = CONF.GRACE_TIME;
                    this.isAutoPilot = false;
                    activeHands = true;

                    // Lógica Volante
                    const midX = (this.hands.left.x + this.hands.right.x)/2;
                    const midY = (this.hands.left.y + this.hands.right.y)/2;
                    this.wheel.x += (midX - this.wheel.x)*0.25;
                    this.wheel.y += (midY - this.wheel.y)*0.25;
                    
                    const dx = this.hands.right.x - this.hands.left.x;
                    const dy = this.hands.right.y - this.hands.left.y;
                    let rawAngle = Math.atan2(dy, dx);
                    
                    // Deadzone & Sensibilidade
                    if(Math.abs(rawAngle) < 0.1) rawAngle = 0;
                    targetSteer = rawAngle * 1.8 * window.System.sens;
                    
                    // Acelera
                    if(this.speed < CONF.MAX_SPEED) this.speed += 1.0;

                    if(this.btnFire && this.item) this.btnFire.style.transform = "scale(0)"; // Esconde botão se estiver dirigindo

                } 
                // MODO TIRO / UMA MÃO (AUTO-PILOT)
                else if ((this.hands.left || this.hands.right) && this.handsFreeTimer > 0) {
                    this.inputState = 1;
                    this.isAutoPilot = true;
                    this.handsFreeTimer--;
                    activeHands = true;

                    // Mostra botão de tiro
                    if(this.btnFire && this.item) {
                        this.btnFire.style.transform = "scale(1)";
                        this.btnFire.style.filter = "none";
                    }

                    // Auto-Pilot: Mantém na pista suavemente
                    targetSteer = this.steer * 0.9; 
                    this.speed *= 0.995; // Mantém embalo
                } 
                else {
                    this.inputState = 0;
                    this.speed *= 0.95; // Freio
                    if(this.btnFire) this.btnFire.style.transform = "scale(0)";
                }
            }

            // Física Volante
            this.steer += (targetSteer - this.steer) * 0.15;
            this.wheel.angle = this.steer;
            this.wheel.opacity += (activeHands ? 0.1 : -0.1);
            this.wheel.opacity = Math.max(0, Math.min(1, this.wheel.opacity));

            // =================================================================
            // 2. FÍSICA DO MUNDO (CURVA & POSIÇÃO)
            // =================================================================
            this.posZ += this.speed;
            
            // Gerador de Curvas Procedural (Senoide Complexa)
            const curveFactor = 0.0007;
            const currentCurve = Math.sin(this.posZ * curveFactor) * 2.5 + Math.cos(this.posZ * curveFactor * 3.1) * 0.5;
            
            // Movimento Lateral (Steer vs Centrífuga)
            this.posX += (this.steer * 0.045) - (currentCurve * (this.speed/CONF.MAX_SPEED) * 0.05);
            
            // Colisão Bordas (Offroad)
            let isOffRoad = false;
            if(Math.abs(this.posX) > 1.4) {
                isOffRoad = true;
                this.speed *= 0.94;
                this.posX = this.posX > 0 ? 1.4 : -1.4;
                if(this.speed > 50) this.cameraShake = 5;
            } else {
                this.cameraShake *= 0.8;
            }

            this.visualTilt += ((this.steer * 0.8 - currentCurve*0.6) - this.visualTilt) * 0.1;
            this.bounce = isOffRoad ? (Math.random()-0.5)*10 : Math.sin(Date.now()/50)*2;

            // Loop Voltas
            if(this.posZ >= CONF.TRACK_LENGTH) {
                this.posZ -= CONF.TRACK_LENGTH;
                this.lap++;
                this.opponents.forEach(o => o.z -= CONF.TRACK_LENGTH);
                this.props.forEach(p => p.hit = false);
            }

            // =================================================================
            // 3. IAs & INTERAÇÃO
            // =================================================================
            this.opponents.forEach(bot => {
                // IA segue curva
                const botCurve = Math.sin(bot.z * curveFactor) * 2.5 + Math.cos(bot.z * curveFactor * 3.1) * 0.5;
                const idealX = -Math.sign(botCurve) * 0.6; // Corta curva por dentro
                
                bot.x += (idealX - bot.x) * 0.015;
                
                // Velocidade Dinâmica (Rubber Banding)
                let targetSpd = 160;
                const dist = bot.z - this.posZ;
                if(dist < -1500) targetSpd = 190; // Catch up
                if(dist > 2500) targetSpd = 130;  // Wait up
                
                bot.speed += (targetSpd - bot.speed) * 0.05;
                bot.z += bot.speed;

                // Colisão Física
                if(Math.abs(dist) < 200 && Math.abs(bot.x - this.posX) < 0.3) {
                    const push = bot.x > this.posX ? 0.05 : -0.05;
                    this.posX -= push;
                    bot.x += push;
                    window.Sfx.play(100, 'noise', 0.1);
                }
            });

            // Projéteis
            projectiles.forEach((p, i) => {
                p.z += p.speed;
                p.life--;
                // Colisão com Bots
                this.opponents.forEach(bot => {
                    if(Math.abs(p.z - bot.z) < 150 && Math.abs(p.x - bot.x) < 0.4) {
                        bot.speed *= 0.2; // Hit!
                        window.System.msg("HIT!");
                        window.Sfx.crash();
                        p.life = 0;
                        // Partículas Explosão
                        for(let k=0;k<15;k++) particles.push({x:bot.x, z:bot.z, y:0, vx:Math.random()-0.5, vy:Math.random(), c:'#ff0', life:30});
                    }
                });
                if(p.life <= 0) projectiles.splice(i,1);
            });

            // Rank
            let r = 1;
            this.opponents.forEach(o => {
                const bZ = o.z + (this.lap * CONF.TRACK_LENGTH);
                const pZ = this.posZ + (this.lap * CONF.TRACK_LENGTH);
                if(bZ > pZ) r++;
            });
            this.rank = r;

            // =================================================================
            // 4. RENDERIZAÇÃO: ENGINE VISUAL "NINTENDO"
            // =================================================================
            
            // --- A. CÉU E PARALLAX ---
            const skyOff = (currentCurve * 400) + (this.steer * 200);
            const gradSky = ctx.createLinearGradient(0,0,0,horizon);
            gradSky.addColorStop(0, PALETTE.skyTop); gradSky.addColorStop(1, PALETTE.skyBot);
            ctx.fillStyle = gradSky; ctx.fillRect(0,0,w,horizon);
            
            // Montanhas ao Fundo (Shapes)
            ctx.fillStyle = '#27ae60';
            ctx.beginPath();
            for(let x=0; x<=w; x+=100) {
                const hM = 50 + Math.sin(x*0.01 + skyOff*0.005)*30;
                ctx.lineTo(x, horizon - hM);
            }
            ctx.lineTo(w, horizon); ctx.lineTo(0, horizon); ctx.fill();

            // Nuvens Fofinhas
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            const drawCloud = (cx, cy, s) => {
                const rx = (cx - skyOff*0.5)% (w+400) - 200;
                ctx.beginPath(); ctx.arc(rx, cy, 30*s, 0, Math.PI*2); ctx.arc(rx+30*s, cy-10*s, 40*s, 0, Math.PI*2); ctx.arc(rx+60*s, cy, 30*s, 0, Math.PI*2); ctx.fill();
            };
            drawCloud(200, horizon*0.3, 1.2); drawCloud(700, horizon*0.5, 1.5);

            // --- B. CHÃO (TEXTURA) ---
            ctx.fillStyle = PALETTE.grassLight; ctx.fillRect(0, horizon, w, h-horizon);
            // Ruído na grama
            ctx.fillStyle = 'rgba(0,0,0,0.03)';
            for(let i=horizon; i<h; i+=4) if(i%8==0) ctx.fillRect(0,i,w,2);

            // --- C. ESTRADA (PROJEÇÃO TRAPEZOIDAL) ---
            const rwFar = w * 0.02;
            const rwNear = w * 2.8;
            
            const cxFar = cx - (currentCurve * w * 0.9) - (this.steer * w * 0.4);
            const cxNear = cx - (this.posX * w * 1.0);

            // Desenho da Pista
            ctx.beginPath(); ctx.fillStyle = PALETTE.road;
            ctx.moveTo(cxFar - rwFar, horizon); ctx.lineTo(cxFar + rwFar, horizon);
            ctx.lineTo(cxNear + rwNear, h); ctx.lineTo(cxNear - rwNear, h);
            ctx.fill();

            // Zebras (Curbs)
            const segLen = 600;
            const phase = Math.floor(this.posZ / segLen) % 2;
            ctx.strokeStyle = phase ? PALETTE.curbRed : PALETTE.curbWhite;
            ctx.lineWidth = 25;
            ctx.beginPath(); ctx.moveTo(cxFar - rwFar, horizon); ctx.lineTo(cxNear - rwNear, h); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cxFar + rwFar, horizon); ctx.lineTo(cxNear + rwNear, h); ctx.stroke();

            // Faixas Centrais
            ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 5;
            ctx.setLineDash([40, 60]); ctx.lineDashOffset = -this.posZ;
            ctx.beginPath();
            ctx.moveTo(cxFar, horizon);
            ctx.quadraticCurveTo((cxFar+cxNear)/2 + currentCurve*150, (horizon+h)/2, cxNear, h);
            ctx.stroke(); ctx.setLineDash([]);

            // --- D. OBJETOS DO MUNDO (Z-SORTED) ---
            let renderList = [];
            
            // Adiciona Bots
            this.opponents.forEach(o => {
                let rz = o.z - this.posZ;
                if(rz < -5000) rz += CONF.TRACK_LENGTH;
                if(rz > 5000) rz -= CONF.TRACK_LENGTH;
                if(rz > 10) renderList.push({type:'kart', obj:o, z:rz});
            });
            // Props
            this.props.forEach(p => {
                let rz = p.z - this.posZ;
                while(rz < -500) rz += CONF.TRACK_LENGTH;
                while(rz > CONF.TRACK_LENGTH - 500) rz -= CONF.TRACK_LENGTH;
                if(rz > 10 && rz < 3000) renderList.push({type:'prop', obj:p, z:rz});
            });
            // Projéteis
            projectiles.forEach(p => {
                let rz = p.z - this.posZ;
                if(rz > 10) renderList.push({type:'shell', obj:p, z:rz});
            });

            // Ordena
            renderList.sort((a,b) => b.z - a.z);

            // Renderiza Objetos
            renderList.forEach(item => {
                const scale = CONF.FOV / (CONF.FOV + item.z);
                const obj = item.obj;
                
                // Interpolação X na tela
                const roadW = rwFar + (rwNear - rwFar) * scale;
                const roadCX = cxFar + (cxNear - cxFar) * scale;
                
                const sx = roadCX + (obj.x * roadW * 0.5);
                const sy = horizon + ((h - horizon) * scale);
                const size = w * 0.25 * scale;

                if(item.type === 'kart') {
                    this.drawKartRival(ctx, sx, sy, size, obj);
                } else if (item.type === 'prop') {
                    if(obj.type === 'tree') this.drawTree(ctx, sx, sy, size);
                    else if (obj.type === 'coin') this.drawCoin(ctx, sx, sy, size, item.z);
                    else this.drawBox(ctx, sx, sy, size, obj);
                } else if (item.type === 'shell') {
                    this.drawShell(ctx, sx, sy, size);
                }
            });

            // --- E. PLAYER KART (HERO) ---
            const plyY = h * 0.88 + this.bounce;
            this.drawPlayerKart(ctx, cx, plyY, w * 0.007);

            // Partículas
            particles.forEach((p,i) => {
                p.x += p.vx; p.y += p.vy; p.life--;
                if(p.life<=0) particles.splice(i,1);
                else { ctx.fillStyle=p.c; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI*2); ctx.fill(); }
            });

            // --- F. HUD & UI ---
            this.drawHUD(ctx, w, h);
            this.drawSportWheel(ctx, w, h);

            if(this.lap > this.totalLaps) window.System.gameOver("VICTORY!");

            return this.score;
        },

        // --- DRAWING HELPERS (VISUAL ENGINE) ---
        
        drawPlayerKart: function(ctx, x, y, s) {
            ctx.save();
            ctx.translate(x + this.cameraShake, y);
            ctx.scale(s, s);
            ctx.rotate(this.visualTilt * 0.15);

            // Sombra
            ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(0, 15, 60, 15, 0, 0, Math.PI*2); ctx.fill();

            // Chassi Base
            const grad = ctx.createLinearGradient(-40, -40, 40, 40);
            grad.addColorStop(0, '#e74c3c'); grad.addColorStop(1, '#c0392b');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(-45, -20); ctx.lineTo(45, -20); ctx.lineTo(55, 10);
            ctx.lineTo(40, 30); ctx.lineTo(-40, 30); ctx.lineTo(-55, 10);
            ctx.fill();

            // Pneus Traseiros (Largos e Escuros)
            ctx.fillStyle = '#1e272e';
            ctx.fillRect(-70, -5, 25, 35); ctx.fillRect(45, -5, 25, 35);
            // Aros
            ctx.fillStyle = '#f1c40f';
            ctx.beginPath(); ctx.arc(-58, 12, 6, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(58, 12, 6, 0, Math.PI*2); ctx.fill();

            // Motor e Escapamento
            ctx.fillStyle = '#34495e'; ctx.fillRect(-30, -35, 60, 20);
            ctx.fillStyle = '#95a5a6'; 
            ctx.beginPath(); ctx.arc(-20, -25, 8, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(20, -25, 8, 0, Math.PI*2); ctx.fill();

            // Personagem (Mario Style)
            // Macacão Azul
            ctx.fillStyle = '#3498db'; 
            ctx.beginPath(); ctx.arc(0, -35, 22, 0, Math.PI, true); ctx.fill();
            ctx.fillRect(-22, -35, 44, 20);
            // Camisa Vermelha
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath(); ctx.arc(-15, -45, 10, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(15, -45, 10, 0, Math.PI*2); ctx.fill();
            // Cabeça
            ctx.fillStyle = '#ffccaa'; ctx.beginPath(); ctx.arc(0, -60, 18, 0, Math.PI*2); ctx.fill();
            // Boné M
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath(); ctx.arc(0, -68, 18, Math.PI, 0); ctx.fill(); // Topo
            ctx.fillRect(-18, -68, 36, 10);
            // Logo M
            ctx.fillStyle = '#fff'; ctx.font="bold 14px Arial"; ctx.textAlign="center"; ctx.fillText("M", 0, -62);

            ctx.restore();
        },

        drawKartRival: function(ctx, x, y, s, obj) {
            // Desenha Karts rivais com cores e estilos diferentes
            ctx.save(); ctx.translate(x, y); ctx.scale(s*0.008, s*0.008); // Normaliza escala
            
            // Sombra
            ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 10, 50, 10, 0, 0, Math.PI*2); ctx.fill();
            
            // Kart
            ctx.fillStyle = obj.color;
            ctx.beginPath(); ctx.moveTo(-40,-10); ctx.lineTo(40,-10); ctx.lineTo(30,20); ctx.lineTo(-30,20); ctx.fill();
            ctx.fillStyle = '#222'; // Rodas
            ctx.fillRect(-45, 0, 15, 20); ctx.fillRect(30, 0, 15, 20);

            // Personagem Simplificado
            if(obj.char === 'luigi') {
                ctx.fillStyle = '#2ecc71'; ctx.beginPath(); ctx.arc(0, -30, 15, 0, Math.PI*2); ctx.fill(); // Chapéu
                ctx.fillStyle = '#fff'; ctx.fillText("L", -3, -25);
            } else if (obj.char === 'peach') {
                ctx.fillStyle = '#f1c40f'; ctx.beginPath(); ctx.arc(0, -25, 18, 0, Math.PI*2); ctx.fill(); // Cabelo
                ctx.fillStyle = '#ff9ff3'; ctx.beginPath(); ctx.arc(0, -35, 10, 0, Math.PI*2); ctx.fill(); // Coroa
            } else { // Bowser
                ctx.fillStyle = '#e67e22'; ctx.beginPath(); ctx.arc(0, -20, 25, 0, Math.PI*2); ctx.fill(); // Casco
                ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.moveTo(-15,-40); ctx.lineTo(-5,-20); ctx.lineTo(-25,-20); ctx.fill(); // Cabelo Spiky
            }
            
            // Tag Name
            ctx.fillStyle = '#fff'; ctx.font="bold 20px Arial"; ctx.textAlign="center";
            ctx.fillText(obj.name, 0, -60);
            
            ctx.restore();
        },

        drawShell: function(ctx, x, y, s) {
            ctx.fillStyle = '#2ecc71'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(x, y-s*0.5, s*0.4, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        },
        
        drawTree: function(ctx, x, y, s) {
            ctx.fillStyle = '#8B4513'; ctx.fillRect(x-s*0.1, y-s, s*0.2, s); // Tronco
            ctx.fillStyle = '#228B22'; // Copa
            ctx.beginPath(); ctx.moveTo(x, y-s*2.5); ctx.lineTo(x+s*0.6, y-s*0.8); ctx.lineTo(x-s*0.6, y-s*0.8); ctx.fill();
        },
        
        drawCoin: function(ctx, x, y, s, z) {
            const spin = Math.abs(Math.sin((Date.now() + z)/150));
            ctx.fillStyle = '#f1c40f'; ctx.strokeStyle = '#f39c12'; ctx.lineWidth = s*0.1;
            ctx.beginPath(); ctx.ellipse(x, y-s, s*0.5*spin, s*0.6, 0, 0, Math.PI*2); 
            ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#f39c12'; ctx.fillRect(x - s*0.1*spin, y-s*1.3, s*0.2*spin, s*0.6); // $ symbol strip
        },

        drawBox: function(ctx, x, y, s, obj) {
            const rot = Math.sin(Date.now()/200);
            const sz = s * 0.8;
            ctx.fillStyle = 'rgba(241, 196, 15, 0.6)'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
            // Fake 3D Box
            ctx.fillRect(x-sz/2, y-sz*1.5, sz*rot, sz);
            ctx.strokeRect(x-sz/2, y-sz*1.5, sz*rot, sz);
            if(Math.abs(rot) > 0.3) { ctx.fillStyle='#fff'; ctx.font=`bold ${sz*0.6}px Arial`; ctx.textAlign='center'; ctx.fillText('?', x, y-sz); }
            // Coleta
            if(!obj.hit && Math.abs(obj.x - this.posX) < 0.3 && obj.z - this.posZ < 50) {
                obj.hit = true; window.Sfx.play(1000,'square',0.1); 
                this.item = 'shell'; window.System.msg("ITEM!");
            }
        },

        drawSportWheel: function(ctx, w, h) {
            if(this.wheel.opacity <= 0.01) return;
            
            ctx.save();
            ctx.globalAlpha = this.wheel.opacity;
            ctx.translate(this.wheel.x, this.wheel.y);
            ctx.rotate(this.wheel.angle);
            const s = w * 0.0013;
            ctx.scale(s, s);

            // Sombra 3D
            ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 15;

            // --- VOLANTE F1/GT (Formato Complexo) ---
            ctx.fillStyle = '#2c3e50'; // Carbono Base
            ctx.beginPath();
            // Desenho vetorial do aro
            ctx.moveTo(-130, -70); ctx.lineTo(130, -70); // Topo
            ctx.bezierCurveTo(150, -70, 150, -30, 140, 20); // Canto Dir Sup
            ctx.lineTo(120, 80); // Lado Dir
            ctx.bezierCurveTo(100, 110, -100, 110, -120, 80); // Baixo (Flat ish)
            ctx.lineTo(-140, 20); // Lado Esq
            ctx.bezierCurveTo(-150, -30, -150, -70, -130, -70); // Canto Esq Sup
            ctx.fill();

            // Grips de Camurça (Cinza)
            ctx.fillStyle = '#7f8c8d';
            ctx.beginPath(); ctx.moveTo(-140, -20); ctx.lineTo(-120, 80); ctx.lineTo(-90, 80); ctx.lineTo(-110, -20); ctx.fill();
            ctx.beginPath(); ctx.moveTo(140, -20); ctx.lineTo(120, 80); ctx.lineTo(90, 80); ctx.lineTo(110, -20); ctx.fill();

            // Display Digital Central
            ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
            ctx.fillStyle = '#000'; ctx.fillRect(-60, -50, 120, 60);
            ctx.strokeStyle = '#555'; ctx.lineWidth = 4; ctx.strokeRect(-60, -50, 120, 60);
            
            // Dados Telemetria
            ctx.fillStyle = '#00ff00'; ctx.font = "bold 35px monospace"; ctx.textAlign = "center";
            ctx.fillText(Math.floor(this.speed), 0, -10); // Velocidade
            ctx.font = "12px monospace"; ctx.fillStyle = '#fff';
            ctx.fillText("GEAR " + Math.min(6, Math.floor(this.speed/30)+1), 0, 5); // Marcha

            // RPM Leds (Barra superior)
            const rpm = this.speed / CONF.MAX_SPEED;
            for(let i=0; i<10; i++) {
                const on = (i/10) < rpm;
                ctx.fillStyle = on ? (i>7?'#ff0000':(i>4?'#f1c40f':'#2ecc71')) : '#333';
                ctx.beginPath(); ctx.arc(-45 + i*10, -60, 5, 0, Math.PI*2); ctx.fill();
            }

            // Botões do Volante
            const btn = (bx,by,c) => { ctx.fillStyle=c; ctx.beginPath(); ctx.arc(bx,by,8,0,Math.PI*2); ctx.fill(); ctx.strokeStyle='#fff'; ctx.lineWidth=1; ctx.stroke(); };
            btn(-90, -30, '#e74c3c'); btn(90, -30, '#3498db');
            btn(-80, 20, '#f1c40f'); btn(80, 20, '#9b59b6');

            // Logo Central
            ctx.fillStyle = '#fff'; ctx.font = "bold 14px Arial"; ctx.fillText("Wii GT", 0, 45);

            ctx.restore();
        },

        drawHUD: function(ctx, w, h) {
            // Rank Gigante
            ctx.font = "italic 900 80px Arial";
            const posColor = this.rank===1 ? '#f1c40f' : (this.rank===2?'#bdc3c7':'#e67e22');
            ctx.fillStyle = posColor; ctx.strokeStyle = '#000'; ctx.lineWidth = 6;
            const txt = this.rank + (this.rank==1?"st":(this.rank==2?"nd":(this.rank==3?"rd":"th")));
            ctx.strokeText(txt, 40, h-40); ctx.fillText(txt, 40, h-40);

            // Item Box UI (Canto Superior Esq)
            const boxS = 80;
            ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(20, 20, boxS, boxS);
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.strokeRect(20, 20, boxS, boxS);
            if(this.item === 'shell') {
                ctx.fillStyle = '#2ecc71'; ctx.beginPath(); ctx.arc(60, 60, 25, 0, Math.PI*2); ctx.fill();
            }

            // Auto-Pilot Timer (Hands Free)
            if(this.handsFreeTimer > 0 && this.isAutoPilot) {
                const barW = 400; const pct = this.handsFreeTimer / CONF.GRACE_TIME;
                ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(w/2 - barW/2, h*0.15, barW, 30);
                ctx.fillStyle = pct < 0.3 ? '#ff0000' : '#3498db'; 
                ctx.fillRect(w/2 - barW/2 + 4, h*0.15 + 4, (barW-8)*pct, 22);
                ctx.fillStyle = '#fff'; ctx.font="bold 16px Arial"; ctx.textAlign="center";
                ctx.fillText("AUTO-PILOT: SHOOT NOW!", w/2, h*0.15 - 10);
            }
        }
    };

    // Sobrescreve stopGame para limpar UI
    const _stop = window.System.stopGame;
    window.System.stopGame = function() {
        if(document.getElementById('nintendo-fire-btn')) document.getElementById('nintendo-fire-btn').remove();
        _stop.apply(this);
    };

    if(window.System) window.System.registerGame('drive', 'Otto Kart Master', '🏎️', Logic, {camOpacity: 0.3, showWheel: false});
})();