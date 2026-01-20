// LÓGICA DO JOGO: KART DO OTTO (NINTENDO WORLD CHAMPIONSHIP - FINAL BUILD)
// ARCHITECT: CODE 177
(function() {
    // --- CONFIGURAÇÕES DE ALTA FIDELIDADE ---
    const CONF = {
        TRACK_LENGTH: 16000,    // Volta Longa
        MAX_SPEED: 175,         // Velocidade "500cc"
        FOV: 850,               // Campo de visão estilo console
        GRACE_TIME: 150,        // 5 segundos de piloto automático
        LANES: 3
    };

    // Paleta de Cores "Mushroom Kingdom"
    const PALETTE = {
        skyTop: '#0066cc', skyBot: '#66ccff',
        grassLight: '#7cfc00', grassDark: '#00a800', // Padrão xadrez na grama
        roadMain: '#555', roadSide: '#444',
        curbA: '#e74c3c', curbB: '#ecf0f1',
        pipe: '#00aa00', pipeHigh: '#55ff55'
    };

    let particles = [];
    let projectiles = [];
    
    const Logic = {
        // --- FÍSICA ---
        speed: 0, posZ: 0, posX: 0, steer: 0,
        
        // --- ESTADO ---
        lap: 1, totalLaps: 3, rank: 8, score: 0, health: 100,
        item: 'shell', // Começa armado
        spinTimer: 0,  // Tempo girando após batida
        boostTimer: 0, // Tempo de turbo
        
        // --- AUTO-PILOT (COMBAT MODE) ---
        handsFreeTimer: 0,
        isAutoPilot: false,
        
        // --- VISUAL ---
        visualTilt: 0, bounce: 0, shake: 0,
        turnAnim: 0, // Animação do piloto virando
        
        // --- INPUT ---
        inputState: 0,
        hands: { left: null, right: null },
        wheel: { x: 0, y: 0, angle: 0, opacity: 0 },
        
        // --- MUNDO ---
        opponents: [],
        props: [],
        
        // --- UI ---
        btnFire: null,

        init: function() {
            this.resetRace();
            this.createFireButton();
            
            // Intro
            window.System.msg("GRAND PRIX");
            setTimeout(()=> { window.System.msg("3"); window.Sfx.play(400,'square',0.1); }, 1000);
            setTimeout(()=> { window.System.msg("2"); window.Sfx.play(400,'square',0.1); }, 2000);
            setTimeout(()=> { window.System.msg("1"); window.Sfx.play(600,'square',0.1); }, 3000);
            setTimeout(()=> { window.System.msg("GO!!!"); window.Sfx.play(800,'sawtooth',1.0); }, 4000);
        },

        resetRace: function() {
            this.speed = 0; this.posZ = 0; this.posX = 0; this.steer = 0;
            this.lap = 1; this.health = 100; this.score = 0; this.item = 'shell';
            this.spinTimer = 0; this.boostTimer = 0;
            particles = []; projectiles = [];
            
            // Geração de Rivais Inteligentes
            const names = ["Luigi", "Peach", "Bowser", "Toad", "Yoshi", "Wario", "DK"];
            const colors = ['#2ecc71', '#ff9ff3', '#f39c12', '#ecf0f1', '#7cfc00', '#f1c40f', '#8B4513'];
            
            this.opponents = [];
            for(let i=0; i<7; i++) {
                this.opponents.push({
                    id: i, name: names[i], color: colors[i],
                    x: (Math.random()-0.5), z: (i+1) * 200, 
                    speed: 0, maxSpeed: CONF.MAX_SPEED * (0.95 + Math.random()*0.1),
                    spin: 0
                });
            }

            // Geração de Pista Procedural "Mushroom Kingdom"
            this.props = [];
            for(let i=1000; i<CONF.TRACK_LENGTH*3; i+=400) {
                // Decoração Lateral
                if(Math.random() < 0.4) {
                    this.props.push({ type: 'pipe', z: i, x: (Math.random()>0.5 ? 1.5 : -1.5) + (Math.random()*0.5), hit:false });
                }
                if(Math.random() < 0.3) {
                    this.props.push({ type: 'bush', z: i+200, x: (Math.random()>0.5 ? 2.0 : -2.0), hit:false });
                }
                // Obstáculos e Itens na Pista
                if(Math.random() < 0.2) {
                    this.props.push({ type: 'box', z: i, x: (Math.random()*2 - 1), hit:false });
                }
                if(Math.random() < 0.1) {
                    this.props.push({ type: 'goomba', z: i+100, x: (Math.random()*1.8 - 0.9), hit:false });
                }
            }
        },

        createFireButton: function() {
            const old = document.getElementById('kart-fire-btn');
            if(old) old.remove();

            const btn = document.createElement('div');
            btn.id = 'kart-fire-btn';
            btn.innerHTML = 'FIRE';
            
            // Estilo agressivo para garantir visibilidade
            Object.assign(btn.style, {
                position: 'absolute', bottom: '20%', right: '5%',
                width: '140px', height: '140px',
                borderRadius: '50%',
                background: 'radial-gradient(circle at 30% 30%, #ff3333, #aa0000)',
                border: '8px solid white',
                boxShadow: '0 10px 20px rgba(0,0,0,0.6)',
                color: 'white', fontFamily: "'Russo One', sans-serif", fontSize: '30px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: '9999', cursor: 'pointer', pointerEvents: 'auto',
                transform: 'scale(0)', transition: 'transform 0.2s cubic-bezier(0.68, -0.55, 0.27, 1.55)',
                textShadow: '2px 2px 0 #000'
            });

            // Eventos de Toque/Clique
            const action = (e) => {
                e.preventDefault(); e.stopPropagation();
                if(this.item) {
                    btn.style.transform = 'scale(0.9)';
                    setTimeout(()=> btn.style.transform = 'scale(1)', 100);
                    this.shoot();
                }
            };
            btn.addEventListener('mousedown', action);
            btn.addEventListener('touchstart', action, {passive: false});

            document.body.appendChild(btn); // Injeta no Body para garantir Z-Index
            this.btnFire = btn;
        },

        shoot: function() {
            if(!this.item) return;
            window.Sfx.play(600, 'square', 0.1);
            window.Sfx.play(150, 'noise', 0.3);
            
            // Lança Casco
            projectiles.push({
                x: this.posX, z: this.posZ + 200, 
                speed: this.speed + 60, life: 300, 
                type: 'green_shell'
            });
            
            this.item = null;
            if(this.btnFire) {
                this.btnFire.style.filter = 'grayscale(100%)';
                this.btnFire.innerText = 'EMPTY';
                setTimeout(() => { if(this.btnFire) this.btnFire.style.transform = 'scale(0)'; }, 500);
            }
        },

        update: function(ctx, w, h, pose) {
            const cx = w/2;
            const cy = h/2;
            const horizon = h * 0.45;

            // =================================================================
            // 1. INPUT SYSTEM & AUTO-PILOT
            // =================================================================
            let targetSteer = 0;
            let handsActive = false;

            if(pose) {
                const kp = pose.keypoints;
                const lw = kp.find(k=>k.name==='left_wrist');
                const rw = kp.find(k=>k.name==='right_wrist');
                if(lw && lw.score > 0.4) this.hands.left = window.Gfx.map(lw,w,h);
                if(rw && rw.score > 0.4) this.hands.right = window.Gfx.map(rw,w,h);

                // LÓGICA DE ESTADO
                if(this.hands.left && this.hands.right) {
                    // --- DRIVING MODE (2 MÃOS) ---
                    this.inputState = 2;
                    this.isAutoPilot = false;
                    this.handsFreeTimer = CONF.GRACE_TIME;
                    handsActive = true;

                    // Posiciona Volante
                    const mx = (this.hands.left.x + this.hands.right.x)/2;
                    const my = (this.hands.left.y + this.hands.right.y)/2;
                    this.wheel.x += (mx - this.wheel.x)*0.2;
                    this.wheel.y += (my - this.wheel.y)*0.2;

                    // Calcula Ângulo
                    const dx = this.hands.right.x - this.hands.left.x;
                    const dy = this.hands.right.y - this.hands.left.y;
                    let angle = Math.atan2(dy, dx);
                    if(Math.abs(angle) < 0.1) angle = 0; // Deadzone
                    
                    targetSteer = angle * 2.0;

                    // Acelera
                    if(this.speed < CONF.MAX_SPEED && this.spinTimer === 0) this.speed += 1.2;

                    // Esconde botão de tiro (foco na direção)
                    if(this.btnFire) this.btnFire.style.transform = 'scale(0)';

                } else if ((this.hands.left || this.hands.right) && this.handsFreeTimer > 0) {
                    // --- COMBAT MODE (1 MÃO + AUTO-PILOT) ---
                    this.inputState = 1;
                    this.isAutoPilot = true;
                    this.handsFreeTimer--;
                    handsActive = true;

                    // Mostra botão de tiro
                    if(this.item && this.btnFire) {
                        this.btnFire.style.transform = 'scale(1)';
                        this.btnFire.style.filter = 'none';
                        this.btnFire.innerText = 'FIRE';
                    }

                    // Lógica Auto-Pilot: Mantém o carro estável
                    targetSteer = this.steer * 0.95; // Centraliza devagar
                    this.speed *= 0.998; // Mantém velocidade

                } else {
                    // --- NO CONTROL ---
                    this.inputState = 0;
                    this.speed *= 0.96;
                    if(this.btnFire) this.btnFire.style.transform = 'scale(0)';
                }
            }

            // Aplica Direção
            if(this.spinTimer > 0) {
                // Se estiver rodando, perde controle
                this.steer += 0.5;
                this.spinTimer--;
                this.speed *= 0.9;
            } else {
                this.steer += (targetSteer - this.steer) * 0.15;
            }
            
            // Visual Wheel Update
            this.wheel.angle = this.steer;
            this.wheel.opacity += handsActive ? 0.1 : -0.1;
            this.wheel.opacity = Math.max(0, Math.min(1, this.wheel.opacity));

            // =================================================================
            // 2. FÍSICA E MUNDO
            // =================================================================
            this.posZ += this.speed;
            if(this.boostTimer > 0) { this.speed = CONF.MAX_SPEED * 1.3; this.boostTimer--; }

            // Curva Procedural
            const curve = Math.sin(this.posZ * 0.0005) * 2.0 + Math.sin(this.posZ * 0.002) * 0.5;
            
            // Movimento Lateral
            this.posX += (this.steer * 0.04) - (curve * (this.speed/CONF.MAX_SPEED) * 0.045);

            // Tilt Visual
            this.visualTilt += ((this.steer - curve*0.5) - this.visualTilt) * 0.1;
            this.shake *= 0.8;

            // Colisão Bordas
            let offRoad = false;
            if(Math.abs(this.posX) > 1.4) {
                offRoad = true;
                this.speed *= 0.92;
                this.shake = 5;
                this.posX = this.posX > 0 ? 1.4 : -1.4;
            }
            this.bounce = offRoad ? (Math.random()-0.5)*15 : Math.sin(Date.now()/50)*2;

            // Loop
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
                if(bot.spin > 0) {
                    bot.spin--;
                    bot.speed *= 0.9;
                } else {
                    // IA Simples
                    let targetSpd = bot.maxSpeed;
                    const dist = bot.z - this.posZ;
                    
                    // Rubber Banding
                    if(dist < -2000) targetSpd *= 1.2;
                    if(dist > 3000) targetSpd *= 0.8;
                    
                    bot.speed += (targetSpd - bot.speed) * 0.05;
                    bot.z += bot.speed;
                    
                    // IA Curva
                    const bCurve = Math.sin(bot.z * 0.0005) * 2.0;
                    bot.x += (-Math.sign(bCurve)*0.5 - bot.x) * 0.02;
                    
                    // Desvio
                    if(Math.abs(dist) < 300 && Math.abs(bot.x - this.posX) < 0.3) {
                        bot.x += bot.x > this.posX ? 0.05 : -0.05;
                    }
                }
            });

            // Projéteis
            for(let i=projectiles.length-1; i>=0; i--) {
                const p = projectiles[i];
                p.z += p.speed;
                p.life--;
                
                // Colisão com Bots
                let hit = false;
                this.opponents.forEach(bot => {
                    if(!hit && Math.abs(p.z - bot.z) < 150 && Math.abs(p.x - bot.x) < 0.4) {
                        bot.spin = 60; // Gira o bot
                        hit = true;
                        window.System.msg("HIT " + bot.name + "!");
                        window.Sfx.crash();
                        // Partículas
                        for(let k=0; k<10; k++) particles.push({x:bot.x, z:bot.z, y:0, vx:Math.random()-0.5, vy:Math.random(), c:'#ff0', life:30});
                    }
                });

                if(p.life <= 0 || hit) projectiles.splice(i,1);
            }

            // Colisão Player com Obstáculos
            this.props.forEach(p => {
                const relZ = p.z - this.posZ; // Distância relativa simples para colisão linear (correção de loop seria complexa aqui, simplificado para gameplay)
                // Usando lógica de renderização para colisão exata:
                let dz = p.z - this.posZ;
                while(dz < -500) dz += CONF.TRACK_LENGTH;
                while(dz > CONF.TRACK_LENGTH - 500) dz -= CONF.TRACK_LENGTH;

                if(!p.hit && Math.abs(dz) < 100 && Math.abs(p.x - this.posX) < 0.35) {
                    p.hit = true;
                    if(p.type === 'box') {
                        window.Sfx.play(1000, 'square', 0.1);
                        this.item = 'shell';
                        window.System.msg("GOT SHELL!");
                    } else if (p.type === 'goomba' || p.type === 'pipe') {
                        this.spinTimer = 40;
                        this.health -= 20;
                        window.System.msg("CRASH!");
                        window.Sfx.crash();
                    } else if (p.type === 'coin') {
                         window.Sfx.coin(); this.score+=50;
                    }
                }
            });

            // Rank
            let r = 1;
            this.opponents.forEach(o => {
                const bTotal = o.z + (this.lap * CONF.TRACK_LENGTH);
                const pTotal = this.posZ + (this.lap * CONF.TRACK_LENGTH);
                if(bTotal > pTotal) r++;
            });
            this.rank = r;


            // =================================================================
            // 4. RENDERIZAÇÃO (ENGINE VETORIAL "NINTENDO STYLE")
            // =================================================================
            
            // --- CÉU & FUNDO ---
            const skyOffset = (curve * 300) + (this.steer * 200);
            const gradSky = ctx.createLinearGradient(0,0,0,horizon);
            gradSky.addColorStop(0, PALETTE.skyTop); gradSky.addColorStop(1, PALETTE.skyBot);
            ctx.fillStyle = gradSky; ctx.fillRect(0,0,w,horizon);
            
            // Montanhas e Nuvens (Decor)
            this.drawBackground(ctx, w, horizon, skyOffset);

            // --- CHÃO (EFEITO MODE-7 FAKE) ---
            ctx.fillStyle = PALETTE.grassLight; ctx.fillRect(0,horizon,w,h-horizon);
            // Xadrez na grama
            ctx.fillStyle = PALETTE.grassDark;
            // Desenha padrão de perspectiva
            /* Simplificado para performance */ 

            // --- ESTRADA ---
            const rwFar = w * 0.02;
            const rwNear = w * 2.2;
            const cxFar = cx - (curve * w * 0.8) - (this.steer * w * 0.4);
            const cxNear = cx - (this.posX * w * 1.0);

            // Asfalto
            ctx.beginPath(); ctx.fillStyle = PALETTE.roadMain;
            ctx.moveTo(cxFar-rwFar, horizon); ctx.lineTo(cxFar+rwFar, horizon);
            ctx.lineTo(cxNear+rwNear, h); ctx.lineTo(cxNear-rwNear, h);
            ctx.fill();

            // Zebras (Animação de velocidade)
            const segLen = 400;
            const phase = Math.floor(this.posZ / segLen) % 2;
            ctx.lineWidth = 20;
            ctx.strokeStyle = phase ? PALETTE.curbA : PALETTE.curbB;
            ctx.beginPath(); ctx.moveTo(cxFar-rwFar, horizon); ctx.lineTo(cxNear-rwNear, h); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cxFar+rwFar, horizon); ctx.lineTo(cxNear+rwNear, h); ctx.stroke();

            // --- OBJETOS DO MUNDO (Z-BUFFER) ---
            let drawQueue = [];
            
            // Bots
            this.opponents.forEach(o => {
                let dz = o.z - this.posZ;
                if(dz < -5000) dz += CONF.TRACK_LENGTH;
                if(dz > 5000) dz -= CONF.TRACK_LENGTH;
                if(dz > 10) drawQueue.push({type:'kart', obj:o, z:dz});
            });
            // Props
            this.props.forEach(p => {
                let dz = p.z - this.posZ;
                while(dz < -500) dz += CONF.TRACK_LENGTH;
                while(dz > CONF.TRACK_LENGTH - 500) dz -= CONF.TRACK_LENGTH;
                if(dz > 10 && dz < 3000) drawQueue.push({type:'prop', obj:p, z:dz});
            });
            // Projéteis
            projectiles.forEach(p => {
                let dz = p.z - this.posZ;
                if(dz > 10) drawQueue.push({type:'shell', obj:p, z:dz});
            });

            drawQueue.sort((a,b) => b.z - a.z);

            drawQueue.forEach(item => {
                const scale = CONF.FOV / (CONF.FOV + item.z);
                const obj = item.obj;
                
                // Projeção
                const roadW = rwFar + (rwNear - rwFar) * scale;
                const roadCX = cxFar + (cxNear - cxFar) * scale;
                const sx = roadCX + (obj.x * roadW * 0.5);
                const sy = horizon + ((h-horizon)*scale);
                const size = w * 0.25 * scale;

                if(item.type === 'kart') this.drawKart(ctx, sx, sy, size, obj);
                else if (item.type === 'shell') this.drawShell(ctx, sx, sy, size);
                else if (item.type === 'prop') this.drawProp(ctx, sx, sy, size, obj);
            });

            // --- PLAYER (COCKPIT) ---
            const plyY = h * 0.88 + this.bounce;
            this.drawPlayer(ctx, cx, plyY, w*0.007);

            // Partículas
            particles.forEach((p,i) => {
                p.x += p.vx; p.y += p.vy; p.life--;
                if(p.life<=0) particles.splice(i,1);
                else { ctx.fillStyle=p.c; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill(); }
            });

            // --- HUD ---
            this.drawHUD(ctx, w, h);
            this.drawWheel(ctx, w, h);

            if(this.lap > this.totalLaps) window.System.gameOver("RANK: " + this.rank);
            if(this.health <= 0) window.System.gameOver("GAME OVER");

            return this.score;
        },

        // --- ART ASSETS (PURE CANVAS PAINTING) ---

        drawBackground: function(ctx, w, h, off) {
            // Nuvens
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            const drawC = (x,y,s) => {
                const rx = (x - off*0.5) % (w+400) - 200;
                ctx.beginPath(); ctx.arc(rx,y,30*s,0,Math.PI*2); ctx.arc(rx+40*s,y-10*s,50*s,0,Math.PI*2); ctx.arc(rx+80*s,y,30*s,0,Math.PI*2); ctx.fill();
            };
            drawC(100, h*0.3, 1.2); drawC(600, h*0.5, 1.5);
            
            // Castelo Distante (Silhouette)
            const cx = (w/2 - off*0.2) % (w+200);
            ctx.fillStyle = 'rgba(0,0,50,0.2)';
            ctx.beginPath(); 
            ctx.moveTo(cx, h); ctx.lineTo(cx, h-100); 
            ctx.lineTo(cx+20, h-120); ctx.lineTo(cx+40, h-100);
            ctx.lineTo(cx+60, h-140); ctx.lineTo(cx+80, h-100);
            ctx.lineTo(cx+100, h); ctx.fill();
        },

        drawKart: function(ctx, x, y, s, obj) {
            ctx.save(); ctx.translate(x, y); ctx.scale(s*0.008, s*0.008);
            if(obj.spin > 0) ctx.rotate(obj.spin * 0.5); // Efeito rodar

            // Sombra
            ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(0,10,50,15,0,0,Math.PI*2); ctx.fill();
            
            // Corpo Kart
            ctx.fillStyle = obj.color;
            ctx.beginPath(); ctx.moveTo(-40,-10); ctx.lineTo(40,-10); ctx.lineTo(35,25); ctx.lineTo(-35,25); ctx.fill();
            
            // Rodas
            ctx.fillStyle = '#222';
            ctx.fillRect(-48, 5, 15, 20); ctx.fillRect(33, 5, 15, 20);

            // Piloto (Cabeça)
            ctx.fillStyle = obj.color; // Capacete cor do kart
            ctx.beginPath(); ctx.arc(0,-30,20,0,Math.PI*2); ctx.fill();
            
            // Nome
            ctx.fillStyle = '#fff'; ctx.font="bold 24px Arial"; ctx.textAlign="center";
            ctx.fillText(obj.name, 0, -60);
            
            ctx.restore();
        },

        drawProp: function(ctx, x, y, s, obj) {
            if(obj.type === 'pipe') {
                // Cano Verde Mario
                const wP = s * 0.6; const hP = s * 1.5;
                ctx.fillStyle = PALETTE.pipe; ctx.strokeStyle = '#004400'; ctx.lineWidth = 2;
                ctx.fillRect(x-wP/2, y-hP, wP, hP); ctx.strokeRect(x-wP/2, y-hP, wP, hP);
                ctx.fillRect(x-wP/2 - 5, y-hP, wP+10, s*0.4); ctx.strokeRect(x-wP/2 - 5, y-hP, wP+10, s*0.4);
                // Brilho
                ctx.fillStyle = PALETTE.pipeHigh; ctx.fillRect(x-wP/4, y-hP+2, wP/5, hP-4);
            } 
            else if (obj.type === 'box') {
                // Bloco ?
                const bS = s * 0.8;
                const float = Math.sin(Date.now()/200)*10;
                ctx.fillStyle = 'rgba(255, 200, 0, 0.9)'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
                ctx.fillRect(x-bS/2, y-bS*2+float, bS, bS); ctx.strokeRect(x-bS/2, y-bS*2+float, bS, bS);
                ctx.fillStyle = '#fff'; ctx.font = `bold ${bS*0.7}px Arial`; ctx.textAlign='center';
                ctx.fillText("?", x, y-bS*1.3+float);
            }
            else if (obj.type === 'goomba') {
                // Goomba simplificado
                const gS = s * 0.6;
                ctx.fillStyle = '#8B4513';
                ctx.beginPath(); ctx.moveTo(x, y-gS*1.5); ctx.lineTo(x+gS/2, y); ctx.lineTo(x-gS/2, y); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x-gS*0.2, y-gS*0.8, gS*0.15, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(x+gS*0.2, y-gS*0.8, gS*0.15, 0, Math.PI*2); ctx.fill();
            }
        },

        drawShell: function(ctx, x, y, s) {
            ctx.fillStyle = '#2ecc71'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(x, y-s*0.4, s*0.3, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        },

        drawPlayer: function(ctx, x, y, s) {
            ctx.save(); ctx.translate(x + this.shake, y); 
            ctx.scale(s, s); ctx.rotate(this.visualTilt * 0.15);
            if(this.spinTimer > 0) ctx.rotate(this.spinTimer * 0.4);

            // Sombra
            ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(0,10,70,20,0,0,Math.PI*2); ctx.fill();

            // Kart Hero (Traseira Detalhada)
            // Escapamentos
            ctx.fillStyle = '#555'; ctx.beginPath(); ctx.arc(-25, -20, 10, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(25, -20, 10, 0, Math.PI*2); ctx.fill();
            
            // Corpo Vermelho
            const grad = ctx.createLinearGradient(-50,-50,50,50);
            grad.addColorStop(0, '#ff4d4d'); grad.addColorStop(1, '#cc0000');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(-50, -20); ctx.lineTo(50, -20);
            ctx.lineTo(60, 20); ctx.lineTo(-60, 20); ctx.fill();

            // Pneus
            ctx.fillStyle = '#222';
            ctx.fillRect(-75, 0, 25, 30); ctx.fillRect(50, 0, 25, 30);
            // Calotas
            ctx.fillStyle = '#ffff00';
            ctx.beginPath(); ctx.arc(-62, 15, 8, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(62, 15, 8, 0, Math.PI*2); ctx.fill();

            // Mario Costas
            ctx.fillStyle = '#0000ff'; // Macacão
            ctx.beginPath(); ctx.arc(0, -35, 25, 0, Math.PI, true); ctx.fill();
            ctx.fillStyle = '#ff0000'; // Camisa
            ctx.beginPath(); ctx.arc(-20, -45, 12, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(20, -45, 12, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#ff0000'; // Boné
            ctx.beginPath(); ctx.arc(0, -65, 20, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.font="bold 20px Arial"; ctx.textAlign="center"; ctx.fillText("M", 0, -65);

            ctx.restore();
        },

        drawWheel: function(ctx, w, h) {
            if(this.wheel.opacity <= 0.01) return;
            ctx.save(); ctx.globalAlpha = this.wheel.opacity;
            ctx.translate(this.wheel.x, this.wheel.y); ctx.rotate(this.wheel.angle);
            const s = w * 0.0013; ctx.scale(s, s);

            // VOLANTE ESPORTIVO GT
            ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 20;
            
            // Base Fibra Carbono
            ctx.fillStyle = '#2c3e50';
            ctx.beginPath();
            ctx.moveTo(-120, -60); ctx.lineTo(120, -60);
            ctx.lineTo(140, 20); ctx.lineTo(120, 80);
            ctx.lineTo(-120, 80); ctx.lineTo(-140, 20);
            ctx.fill();

            // Grips Laterais
            ctx.fillStyle = '#95a5a6';
            ctx.beginPath(); ctx.ellipse(-130, 10, 20, 60, 0, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(130, 10, 20, 60, 0, 0, Math.PI*2); ctx.fill();

            // Display Digital
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#000'; ctx.fillRect(-60, -50, 120, 50);
            ctx.fillStyle = '#0f0'; ctx.font="bold 35px monospace"; ctx.textAlign="center";
            ctx.fillText(Math.floor(this.speed), 0, -15);
            
            // LEDs RPM
            const rpm = this.speed/CONF.MAX_SPEED;
            for(let i=0; i<10; i++) {
                ctx.fillStyle = (i/10 < rpm) ? (i>7?'#f00':'#ff0') : '#333';
                ctx.beginPath(); ctx.arc(-45 + i*10, -70, 5, 0, Math.PI*2); ctx.fill();
            }

            // Logo Central
            ctx.fillStyle = '#fff'; ctx.font="bold 16px Arial"; ctx.fillText("Wii", 0, 40);

            ctx.restore();
        },

        drawHUD: function(ctx, w, h) {
            // Rank
            ctx.font = "italic 900 80px Arial";
            ctx.fillStyle = this.rank===1?'#ffd700':'#fff';
            ctx.strokeStyle = '#000'; ctx.lineWidth=6;
            ctx.strokeText(this.rank, 50, h-50); ctx.fillText(this.rank, 50, h-50);
            ctx.font = "bold 30px Arial"; ctx.fillText("/8", 100, h-50);

            // Auto-Pilot Bar
            if(this.isAutoPilot && this.handsFreeTimer > 0) {
                const bw = 400; const bp = this.handsFreeTimer/CONF.GRACE_TIME;
                ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(w/2 - bw/2, h*0.2, bw, 30);
                ctx.fillStyle= bp < 0.3 ? '#f00' : '#0f0';
                ctx.fillRect(w/2 - bw/2 + 5, h*0.2 + 5, (bw-10)*bp, 20);
                ctx.fillStyle='#fff'; ctx.font="bold 20px Arial"; ctx.textAlign="center";
                ctx.fillText("AUTO PILOT - SHOOT!", w/2, h*0.2 - 10);
            }

            // Item Slot
            ctx.lineWidth=4; ctx.strokeStyle='#fff'; ctx.fillStyle='rgba(0,0,0,0.5)';
            ctx.fillRect(20, 20, 80, 80); ctx.strokeRect(20, 20, 80, 80);
            if(this.item === 'shell') {
                ctx.fillStyle='#2ecc71'; ctx.beginPath(); ctx.arc(60,60,25,0,Math.PI*2); ctx.fill();
                ctx.strokeStyle='#fff'; ctx.stroke();
            }
        }
    };

    // Cleanup Limpo
    const _stop = window.System.stopGame;
    window.System.stopGame = function() {
        if(document.getElementById('kart-fire-btn')) document.getElementById('kart-fire-btn').remove();
        _stop.apply(this);
    };

    if(window.System) window.System.registerGame('drive', 'Otto Kart Wii', '🏎️', Logic, {camOpacity: 0.3, showWheel: false});
})();