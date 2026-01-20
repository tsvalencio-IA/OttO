// LÓGICA DO JOGO: KART DO OTTO (NINTENDO WORLD CHAMPIONSHIP - FINAL FUSION)
// ARCHITECT: CODE 177
(function() {
    // --- CONFIGURAÇÕES ---
    const CONF = {
        TRACK_LENGTH: 16000,
        MAX_SPEED: 180,
        FOV: 800,
        GRACE_TIME: 150, // 5 Segundos de piloto automático
        LANES: 3
    };

    // Paleta baseada no código que você gostou
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
        
        // --- AUTO-PILOT ---
        handsFreeTimer: 0,
        isAutoPilot: false,
        
        // --- VISUAL ---
        visualTilt: 0, bounce: 0, shake: 0,
        
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
            
            // Som de partida clássico
            window.System.msg("PREPARAR..."); 
            window.Sfx.play(100, 'sawtooth', 0.5, 0.2); 
            setTimeout(() => { window.System.msg("3"); window.Sfx.play(400, 'square', 0.2); }, 1000);
            setTimeout(() => { window.System.msg("2"); window.Sfx.play(400, 'square', 0.2); }, 2000);
            setTimeout(() => { window.System.msg("1"); window.Sfx.play(400, 'square', 0.2); }, 3000);
            setTimeout(() => { 
                window.System.msg("VAI!"); 
                window.Sfx.play(400, 'square', 1.0, 0.1);
            }, 4000);
        },

        resetRace: function() {
            this.speed = 0; this.posZ = 0; this.posX = 0; this.steer = 0;
            this.lap = 1; this.health = 100; this.score = 0; this.item = 'shell';
            this.spinTimer = 0;
            particles = []; projectiles = [];
            
            // Rivais Inteligentes
            const names = ["Luigi", "Peach", "Bowser", "Toad", "Yoshi"];
            const colors = ['#2ecc71', '#ff9ff3', '#f39c12', '#ecf0f1', '#7cfc00'];
            
            this.opponents = [];
            for(let i=0; i<5; i++) {
                this.opponents.push({
                    id: i, name: names[i], color: colors[i],
                    x: (Math.random()-0.5), z: (i+1) * 300, 
                    speed: 0, maxSpeed: CONF.MAX_SPEED * (0.92 + Math.random()*0.1),
                    spin: 0
                });
            }

            // Pista Procedural (Baseada no snippet mas adaptada para 3D)
            this.props = [];
            for(let i=1000; i<CONF.TRACK_LENGTH*3; i+=400) {
                if(Math.random() < 0.3) {
                    this.props.push({ type: 'pipe', z: i, x: (Math.random()>0.5 ? 1.4 : -1.4), hit:false });
                }
                if(Math.random() < 0.2) {
                    this.props.push({ type: Math.random()<0.5?'box':'coin', z: i, x: (Math.random()*1.8 - 0.9), hit:false });
                }
            }
        },

        createFireButton: function() {
            const old = document.getElementById('kart-fire-btn');
            if(old) old.remove();

            const btn = document.createElement('div');
            btn.id = 'kart-fire-btn';
            btn.innerHTML = 'FIRE';
            
            // POSICIONAMENTO CORRIGIDO: ESQUERDA PARA NÃO BATER NO VELOCÍMETRO
            Object.assign(btn.style, {
                position: 'absolute', bottom: '30px', left: '30px',
                width: '110px', height: '110px',
                borderRadius: '50%',
                background: 'radial-gradient(circle at 30% 30%, #ff3333, #aa0000)',
                border: '6px solid white',
                boxShadow: '0 8px 15px rgba(0,0,0,0.6)',
                color: 'white', fontFamily: "'Russo One', sans-serif", fontSize: '24px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: '9999', cursor: 'pointer', pointerEvents: 'auto',
                transform: 'scale(0)', transition: 'transform 0.2s',
                textShadow: '2px 2px 0 #000'
            });

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

            document.body.appendChild(btn);
            this.btnFire = btn;
        },

        shoot: function() {
            if(!this.item) return;
            window.Sfx.play(600, 'square', 0.1);
            projectiles.push({
                x: this.posX, z: this.posZ + 200, 
                speed: this.speed + 60, life: 300, type: 'green_shell'
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
            const horizon = h * 0.35; // Horizonte original que você gostava

            // =================================================================
            // 1. INPUT SYSTEM
            // =================================================================
            let targetSteer = 0;
            let handsActive = false;

            if(pose) {
                const kp = pose.keypoints;
                const lw = kp.find(k=>k.name==='left_wrist');
                const rw = kp.find(k=>k.name==='right_wrist');
                if(lw && lw.score > 0.4) this.hands.left = window.Gfx.map(lw,w,h);
                if(rw && rw.score > 0.4) this.hands.right = window.Gfx.map(rw,w,h);

                if(this.hands.left && this.hands.right) {
                    // MODO DIRIGIR
                    this.inputState = 2;
                    this.handsFreeTimer = CONF.GRACE_TIME;
                    this.isAutoPilot = false;
                    handsActive = true;

                    const mx = (this.hands.left.x + this.hands.right.x)/2;
                    const my = (this.hands.left.y + this.hands.right.y)/2;
                    this.wheel.x += (mx - this.wheel.x)*0.25;
                    this.wheel.y += (my - this.wheel.y)*0.25;

                    const dx = this.hands.right.x - this.hands.left.x;
                    const dy = this.hands.right.y - this.hands.left.y;
                    let angle = Math.atan2(dy, dx);
                    if(Math.abs(angle) < 0.1) angle = 0;
                    
                    targetSteer = angle * 2.2; // Resposta rápida

                    if(this.speed < CONF.MAX_SPEED && this.spinTimer === 0) this.speed += 0.8;
                    if(this.btnFire) this.btnFire.style.transform = 'scale(0)';

                } else if ((this.hands.left || this.hands.right) && this.handsFreeTimer > 0) {
                    // MODO TIRO (Auto-Pilot)
                    this.inputState = 1;
                    this.isAutoPilot = true;
                    this.handsFreeTimer--;
                    handsActive = true;

                    if(this.item && this.btnFire) {
                        this.btnFire.style.transform = 'scale(1)';
                        this.btnFire.style.filter = 'none';
                        this.btnFire.innerText = 'FIRE';
                    }
                    targetSteer = this.steer * 0.9;
                    this.speed *= 0.995;
                } else {
                    this.inputState = 0;
                    this.speed *= 0.96;
                    if(this.btnFire) this.btnFire.style.transform = 'scale(0)';
                }
            }

            if(this.spinTimer > 0) {
                this.steer += 0.4; this.spinTimer--; this.speed *= 0.9;
            } else {
                this.steer += (targetSteer - this.steer) * 0.1;
            }
            
            this.wheel.angle = this.steer;
            this.wheel.opacity += handsActive ? 0.1 : -0.1;
            this.wheel.opacity = Math.max(0, Math.min(1, this.wheel.opacity));

            // =================================================================
            // 2. FÍSICA E MUNDO (MECÂNICA AVANÇADA, VISUAL RETRO)
            // =================================================================
            this.posZ += this.speed;

            // Curva baseada em seno (suave como MK)
            const curve = Math.sin(this.posZ * 0.002) * 2.2;
            
            // Movimento do carro na pista
            this.posX += (this.steer * 0.05) - (curve * (this.speed/CONF.MAX_SPEED) * 0.05);

            // Tilt
            this.visualTilt += ((this.steer - curve*0.5) - this.visualTilt) * 0.1;
            
            // Colisão Borda
            let offRoad = false;
            if(Math.abs(this.posX) > 1.4) {
                offRoad = true;
                this.speed *= 0.92;
                this.shake = 5;
                this.posX = this.posX > 0 ? 1.4 : -1.4;
            } else {
                this.shake = 0;
            }
            this.bounce = Math.sin(Date.now()/30) * (1 + (this.speed/CONF.MAX_SPEED)*2);

            // Loop
            if(this.posZ >= CONF.TRACK_LENGTH) {
                this.posZ -= CONF.TRACK_LENGTH;
                this.lap++;
                this.opponents.forEach(o => o.z -= CONF.TRACK_LENGTH);
                this.props.forEach(p => p.hit = false);
            }

            // =================================================================
            // 3. IAs
            // =================================================================
            this.opponents.forEach(bot => {
                if(bot.spin > 0) { bot.spin--; bot.speed *= 0.9; }
                else {
                    let targetSpd = bot.maxSpeed;
                    const dist = bot.z - this.posZ;
                    if(dist < -2000) targetSpd *= 1.3; // Catch up
                    if(dist > 3000) targetSpd *= 0.7; // Wait
                    
                    bot.speed += (targetSpd - bot.speed) * 0.05;
                    bot.z += bot.speed;
                    
                    // Curva perfeita
                    const bCurve = Math.sin(bot.z * 0.002) * 2.2;
                    bot.x += (-Math.sign(bCurve)*0.6 - bot.x) * 0.03;
                    
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
                
                let hit = false;
                this.opponents.forEach(bot => {
                    if(!hit && Math.abs(p.z - bot.z) < 150 && Math.abs(p.x - bot.x) < 0.4) {
                        bot.spin = 60; hit = true;
                        window.System.msg("HIT " + bot.name + "!");
                        window.Sfx.crash();
                    }
                });
                if(p.life <= 0 || hit) projectiles.splice(i,1);
            }

            // Obstáculos
            this.props.forEach(p => {
                let dz = p.z - this.posZ;
                while(dz < -500) dz += CONF.TRACK_LENGTH;
                while(dz > CONF.TRACK_LENGTH - 500) dz -= CONF.TRACK_LENGTH;

                if(!p.hit && Math.abs(dz) < 100 && Math.abs(p.x - this.posX) < 0.35) {
                    p.hit = true;
                    if(p.type === 'box') {
                        window.Sfx.play(1000, 'square', 0.1);
                        this.item = 'shell';
                        window.System.msg("ITEM GET!");
                    } else if (p.type === 'pipe') {
                        this.spinTimer = 40; this.health -= 20;
                        window.System.msg("CRASH!"); window.Sfx.crash();
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
            // 4. RENDERIZAÇÃO (RESGATANDO O ESTILO QUE VOCÊ GOSTOU)
            // =================================================================
            
            // --- CÉU & FUNDO (IDÊNTICO AO SEU SNIPPET) ---
            const gradSky = ctx.createLinearGradient(0, 0, 0, horizon);
            gradSky.addColorStop(0, "#0099ff"); gradSky.addColorStop(1, "#87CEEB");
            ctx.fillStyle = gradSky; ctx.fillRect(0, 0, w, horizon);

            // Montanhas/Nuvens Parallax
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            const bgX = this.steer * 80 + (curve * 150);
            const drawCloud = (cx, cy, s) => { ctx.beginPath(); ctx.arc(cx, cy, 30*s, 0, Math.PI*2); ctx.arc(cx+25*s, cy-10*s, 35*s, 0, Math.PI*2); ctx.arc(cx+50*s, cy, 30*s, 0, Math.PI*2); ctx.fill(); };
            // Loop para garantir cobertura
            for(let k=-1; k<=1; k++) {
                drawCloud(w*0.2 - bgX + (k*w), horizon*0.6, 1.2); 
                drawCloud(w*0.8 - bgX + (k*w), horizon*0.4, 0.8);
            }

            // Morro Verde Fundo
            ctx.fillStyle = '#2ecc71'; ctx.beginPath(); ctx.moveTo(0, horizon);
            ctx.quadraticCurveTo(w*0.3, horizon - 50, w*0.6, horizon);
            ctx.quadraticCurveTo(w*0.8, horizon - 80, w, horizon);
            ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();

            // Grama
            ctx.fillStyle = PALETTE.grass; ctx.fillRect(0, horizon, w, h);

            // --- ESTRADA (PROJEÇÃO DO SEU SNIPPET ADAPTADA PARA 3D) ---
            const roadW_Far = w * 0.01; const roadW_Near = w * 2.2;
            const cxFar = cx - (curve * w * 0.8) - (this.steer * w * 0.4);
            const cxNear = cx - (this.posX * w * 1.0);

            // Zebras
            const segLen = 400; const phase = Math.floor(this.posZ / segLen) % 2;
            const zebraW = w * 0.35;
            ctx.fillStyle = (phase === 0) ? '#ff0000' : '#ffffff';
            ctx.beginPath();
            ctx.moveTo(cxFar - roadW_Far - (zebraW*0.05), horizon);
            ctx.lineTo(cxFar + roadW_Far + (zebraW*0.05), horizon);
            ctx.lineTo(cxNear + roadW_Near + zebraW, h);
            ctx.lineTo(cxNear - roadW_Near - zebraW, h);
            ctx.fill();

            // Asfalto
            ctx.fillStyle = '#555'; 
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
                const roadW = roadW_Far + (roadW_Near - roadW_Far) * scale;
                const roadCX = cxFar + (cxNear - cxFar) * scale;
                const sx = roadCX + (obj.x * roadW * 0.5);
                const sy = horizon + ((h-horizon)*scale);
                const size = w * 0.18 * scale; // Tamanho original

                if(item.type === 'kart') this.drawKartRival(ctx, sx, sy, size, obj, scale, w);
                else if (item.type === 'shell') this.drawShell(ctx, sx, sy, size);
                else if (item.type === 'prop') this.drawProp(ctx, sx, sy, size, obj, scale);
            });

            // --- PLAYER KART (O DESENHO QUE VOCÊ GOSTOU) ---
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

            // --- HUD ---
            this.drawHUD(ctx, w, h);
            this.drawSaveiroWheel(ctx, w, h); // NOVO VOLANTE

            if(this.lap > this.totalLaps) window.System.gameOver("RANK: " + this.rank);
            if(this.health <= 0) window.System.gameOver("GAME OVER");

            return this.score;
        },

        // --- DRAWING FUNCTIONS ---

        // O KART ORIGINAL (EXATAMENTE COMO NO SEU SNIPPET)
        drawPlayerOriginal: function(ctx, carX, carY, carScale, tilt) {
            ctx.save(); 
            ctx.translate(carX, carY); 
            ctx.scale(carScale, carScale); 
            ctx.rotate(tilt * 0.15);
            if(this.spinTimer > 0) ctx.rotate(this.spinTimer * 0.4);

            // Modelo do Kart (Retro)
            ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(0, 25, 50, 15, 0, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#111'; ctx.fillRect(-50, 5, 25, 25); ctx.fillRect(25, 5, 25, 25);
            ctx.fillStyle = '#ddd'; ctx.fillRect(-45, 10, 15, 15); ctx.fillRect(30, 10, 15, 15);
            ctx.fillStyle = '#333'; ctx.fillRect(-25, 20, 50, 15);
            ctx.fillStyle = '#777'; ctx.beginPath(); ctx.arc(-15, 30, 6, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(15, 30, 6, 0, Math.PI*2); ctx.fill(); 
            const bodyGrad = ctx.createLinearGradient(-30, -20, 30, 20); bodyGrad.addColorStop(0, '#ff0000'); bodyGrad.addColorStop(1, '#cc0000');
            ctx.fillStyle = bodyGrad; ctx.beginPath(); ctx.moveTo(-20, -50); ctx.lineTo(20, -50); ctx.lineTo(35, 10); ctx.lineTo(40, 25); ctx.lineTo(-40, 25); ctx.lineTo(-35, 10); ctx.fill();
            ctx.fillStyle = '#222'; ctx.beginPath(); ctx.ellipse(0, 0, 20, 15, 0, 0, Math.PI*2); ctx.fill();

            // Cockpit e Piloto
            ctx.save(); ctx.rotate(this.steer * 0.5); 
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -25, 18, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#ff0000'; ctx.font="bold 12px Arial"; ctx.textAlign="center"; ctx.fillText("M", 0, -32);
            ctx.fillStyle = '#333'; ctx.fillRect(-12, -28, 24, 8);
            ctx.restore();

            // Rodas Frente
            ctx.fillStyle = '#111';
            ctx.save(); ctx.translate(-35, -35); ctx.rotate(this.steer * 0.6); ctx.fillRect(-8, -10, 16, 20); ctx.restore();
            ctx.save(); ctx.translate(35, -35); ctx.rotate(this.steer * 0.6); ctx.fillRect(-8, -10, 16, 20); ctx.restore();
            ctx.restore();

            ctx.restore();
        },

        drawKartRival: function(ctx, screenX, screenY, size, o, scale, w) {
            const kScale = scale * w * 0.005;
            ctx.save(); ctx.translate(screenX, screenY); ctx.scale(kScale, kScale);
            if(o.spin > 0) ctx.rotate(o.spin * 0.5);

            ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(0, 10, 30, 8, 0, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = o.color; ctx.fillRect(-20, -15, 40, 20);
            ctx.fillStyle = '#222'; ctx.fillRect(-22, -5, 8, 15); ctx.fillRect(14, -5, 8, 15);
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -20, 12, 0, Math.PI*2); ctx.fill();
            
            // Tag Name
            ctx.fillStyle = '#fff'; ctx.font = "bold 14px Arial"; ctx.textAlign = "center";
            ctx.fillText(o.name, 0, -40);

            ctx.restore();
        },

        drawProp: function(ctx, screenX, screenY, size, o, scale) {
            if(o.type === 'pipe') {
                 const hSign = size * 1.5;
                 ctx.fillStyle = '#00aa00'; ctx.strokeStyle = '#004400'; ctx.lineWidth = 2;
                 ctx.fillRect(screenX - size/2, screenY - hSign, size, hSign); ctx.strokeRect(screenX - size/2, screenY - hSign, size, hSign);
                 ctx.fillRect(screenX - size/2 - 5*scale, screenY - hSign, size + 10*scale, 20*scale); ctx.strokeRect(screenX - size/2 - 5*scale, screenY - hSign, size + 10*scale, 20*scale);
            } else if (o.type === 'box') {
                 const bS = size * 0.8;
                 const f = Math.sin(Date.now()/200)*5;
                 ctx.fillStyle = 'rgba(255,200,0,0.9)'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
                 ctx.fillRect(screenX-bS/2, screenY-bS*2+f, bS, bS); ctx.strokeRect(screenX-bS/2, screenY-bS*2+f, bS, bS);
                 ctx.fillStyle = '#fff'; ctx.font="bold 20px Arial"; ctx.textAlign="center"; ctx.fillText("?", screenX, screenY-bS*1.3+f);
            } else {
                 // Coin
                 const cS = size * 0.5;
                 ctx.fillStyle = '#f1c40f'; ctx.beginPath(); ctx.ellipse(screenX, screenY-cS*1.5, cS*0.7, cS, 0, 0, Math.PI*2); ctx.fill();
            }
        },

        drawShell: function(ctx, x, y, s) {
            ctx.fillStyle = '#2ecc71'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(x, y-s*0.4, s*0.3, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        },

        // --- NOVO VOLANTE "SAVEIRO SUMMER" ---
        // Redondo, 4 raios, esportivo, pegada firme
        drawSaveiroWheel: function(ctx, w, h) {
            if(this.wheel.opacity <= 0.01) return;
            ctx.save(); ctx.globalAlpha = this.wheel.opacity;
            ctx.translate(this.wheel.x, this.wheel.y); ctx.rotate(this.wheel.angle);
            const s = w * 0.0013; ctx.scale(s, s);

            // Sombra
            ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 10;

            // 1. ARO EXTERNO (Preto Couro)
            ctx.beginPath();
            ctx.arc(0, 0, 140, 0, Math.PI*2); // Fora
            ctx.arc(0, 0, 115, 0, Math.PI*2, true); // Dentro
            ctx.fillStyle = '#1a1a1a'; ctx.fill();
            ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.stroke();

            // 2. DETALHE PRATA NO ARO (Estilo esportivo anos 90)
            // Pequenos parafusos ou costura
            ctx.fillStyle = '#555';
            for(let i=0; i<8; i++) {
                const a = (i/8) * Math.PI*2;
                ctx.beginPath(); ctx.arc(Math.cos(a)*127, Math.sin(a)*127, 3, 0, Math.PI*2); ctx.fill();
            }

            // 3. CENTRO (4 RAIOS - ESTILO VOLKS)
            ctx.fillStyle = '#2c3e50'; // Cinza escuro / Carbono
            ctx.beginPath();
            // Raio Esq
            ctx.moveTo(-115, -10); ctx.lineTo(-40, -20); ctx.lineTo(-40, 20); ctx.lineTo(-115, 10);
            // Raio Dir
            ctx.moveTo(115, -10); ctx.lineTo(40, -20); ctx.lineTo(40, 20); ctx.lineTo(115, 10);
            // Raio Baixo Esq
            ctx.moveTo(-90, 80); ctx.lineTo(-30, 30); ctx.lineTo(-10, 40); ctx.lineTo(-60, 100);
            // Raio Baixo Dir
            ctx.moveTo(90, 80); ctx.lineTo(30, 30); ctx.lineTo(10, 40); ctx.lineTo(60, 100);
            ctx.fill();

            // 4. BUZINA CENTRAL (REDONDA)
            ctx.fillStyle = '#000'; 
            ctx.beginPath(); ctx.arc(0, 0, 35, 0, Math.PI*2); ctx.fill();
            
            // Logo Prata
            ctx.fillStyle = '#bdc3c7'; ctx.beginPath(); ctx.arc(0, 0, 25, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI*2); ctx.fill();
            
            // Logo VW Stylized (Wii)
            ctx.fillStyle = '#bdc3c7'; 
            ctx.font = "bold 16px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText("Wii", 0, 1);

            ctx.restore();
        },

        drawHUD: function(ctx, w, h) {
            // Velocímetro Canto Direito (Original)
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
            }

            // Auto Pilot Bar
            if(this.isAutoPilot && this.handsFreeTimer > 0) {
                const bw = 300; const bp = this.handsFreeTimer/CONF.GRACE_TIME;
                ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(w/2 - bw/2, h*0.2, bw, 25);
                ctx.fillStyle = bp < 0.3 ? '#f00' : '#0f0';
                ctx.fillRect(w/2 - bw/2 + 3, h*0.2 + 3, (bw-6)*bp, 19);
                ctx.fillStyle = '#fff'; ctx.font="bold 14px Arial"; ctx.textAlign="center";
                ctx.fillText("AUTO PILOT ACTIVE", w/2, h*0.2 - 5);
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