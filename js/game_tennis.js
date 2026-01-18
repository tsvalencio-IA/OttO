// =============================================================================
// OTTO TENNIS - WII REALISTIC (COM ESQUELETO DO BOXE + AUTO RUN)
// =============================================================================

(function() {
    // Configurações de Quadra e Física
    const COURT_DEPTH = 1600;
    const NET_Z = 0;
    const PLAYER_Z = 700;     // Onde o jogador fica (Fundo)
    const ENEMY_Z = -700;     // Onde a CPU fica
    const GRAVITY = 0.55;     // Peso da bola
    const BOUNCE = 0.75;      // Quanto a bola quica
    
    const Logic = {
        score: [0, 0], // Player, CPU
        state: 'menu', // serve, rally, point_end
        
        // Entidades
        ball: { x:0, y:50, z:0, vx:0, vy:0, vz:0 },
        player: { x:0, swingTimer:0, speed: 9 }, // Speed alto para alcançar a bola
        enemy:  { x:0, swingTimer:0, speed: 7 },
        
        // Input Debug
        handVel: 0,
        lastHand: {x:0, y:0},
        
        // Efeitos
        flash: 0,

        init: function() { 
            this.score = [0, 0]; 
            this.state = 'serve';
            this.resetBall('player');
            window.System.msg("SEU SAQUE!"); 
        },

        resetBall: function(who) {
            this.ball.vx=0; this.ball.vy=0; this.ball.vz=0;
            
            if(who === 'player') {
                this.state = 'serve';
                this.ball.x = this.player.x + 20;
                this.ball.y = 100;
                this.ball.z = PLAYER_Z - 50;
                this.player.x = 0; // Centraliza
            } else {
                this.state = 'rally';
                this.ball.x = this.enemy.x;
                this.ball.y = 150;
                this.ball.z = ENEMY_Z + 50;
                // Saque da CPU
                this.ball.vz = 45; // Vem rápido
                this.ball.vy = 12;
                this.ball.vx = (Math.random()-0.5) * 20; 
                this.enemy.x = 0;
                window.System.msg("DEFENDA!");
            }
        },

        update: function(ctx, w, h, pose) {
            const cx = w / 2;
            const cy = h / 2 - 50; // Horizonte ajustado
            
            // --- 1. RENDERIZAÇÃO DO FUNDO (3D) ---
            const project = (x, y, z) => {
                const scale = 600 / (600 + (z + 800));
                return { x: cx + (x * scale), y: cy - (y * scale), s: scale };
            };

            // Céu e Chão
            const hor = project(0,0,10000).y;
            const grad = ctx.createLinearGradient(0,0,0,hor);
            grad.addColorStop(0, '#2980b9'); grad.addColorStop(1, '#6dd5fa');
            ctx.fillStyle = grad; ctx.fillRect(0,0,w,hor);
            ctx.fillStyle = '#2c3e50'; ctx.fillRect(0,hor,w,h); // Piso externo

            // Quadra Azul
            const pTL = project(-350, 0, ENEMY_Z-100); const pTR = project(350, 0, ENEMY_Z-100);
            const pBL = project(-350, 0, PLAYER_Z+100); const pBR = project(350, 0, PLAYER_Z+100);
            ctx.fillStyle = '#3498db'; 
            ctx.beginPath(); ctx.moveTo(pTL.x, pTL.y); ctx.lineTo(pTR.x, pTR.y);
            ctx.lineTo(pBR.x, pBR.y); ctx.lineTo(pBL.x, pBL.y); ctx.fill();

            // Linhas
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
            ctx.beginPath(); 
            ctx.moveTo(pTL.x, pTL.y); ctx.lineTo(pBL.x, pBL.y); // Esq
            ctx.moveTo(pTR.x, pTR.y); ctx.lineTo(pBR.x, pBR.y); // Dir
            ctx.moveTo(pTL.x, pTL.y); ctx.lineTo(pTR.x, pTR.y); // Fundo
            ctx.moveTo(pBL.x, pBL.y); ctx.lineTo(pBR.x, pBR.y); // Frente
            // Centro
            const midTop = project(0,0,ENEMY_Z-100); const midBot = project(0,0,PLAYER_Z+100);
            ctx.moveTo(midTop.x, midTop.y); ctx.lineTo(midBot.x, midBot.y);
            ctx.stroke();

            // Rede
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            const netL = project(-400, 40, 0); const netR = project(400, 40, 0);
            const netBL = project(-400, 0, 0); const netBR = project(400, 0, 0);
            ctx.beginPath(); ctx.moveTo(netL.x, netL.y); ctx.lineTo(netR.x, netR.y);
            ctx.lineTo(netBR.x, netBR.y); ctx.lineTo(netBL.x, netBL.y); ctx.fill();
            ctx.fillStyle='#fff'; ctx.fillRect(netL.x, netL.y, netR.x - netL.x, 4); // Topo rede

            // --- 2. INPUT & ESQUELETO (PADRÃO BOXE) ---
            let isSwing = false;
            
            if(window.Gfx && window.Gfx.drawSkeleton && pose) {
                // DESENHA O ESQUELETO POR CIMA DA QUADRA (FEEDBACK)
                ctx.save();
                ctx.globalAlpha = 0.6;
                // Usa a cor verde neon padrão do boxe
                ctx.strokeStyle = '#00ff00'; 
                ctx.lineWidth = 4;
                window.Gfx.drawSkeleton(ctx, pose, w, h);
                ctx.restore();
            }

            if(pose) {
                const rW = pose.keypoints.find(k=>k.name==='right_wrist');
                const lW = pose.keypoints.find(k=>k.name==='left_wrist');
                // Detecta mão mais ativa
                const hand = (rW && rW.score > 0.3) ? rW : (lW && lW.score > 0.3 ? lW : null);
                
                if(hand) {
                    const hPos = window.Gfx.map(hand, w, h);
                    
                    // Desenha luva/raquete na mão do esqueleto
                    ctx.fillStyle = 'rgba(255, 255, 0, 0.5)';
                    ctx.beginPath(); ctx.arc(hPos.x, hPos.y, 25, 0, Math.PI*2); ctx.fill();

                    // Detecta Velocidade (Swing)
                    const dist = Math.hypot(hPos.x - this.lastHand.x, hPos.y - this.lastHand.y);
                    if(dist > 25 && this.player.swingTimer === 0) {
                        isSwing = true;
                        this.player.swingTimer = 15; // Cooldown
                    }
                    this.lastHand = hPos;
                }
            }
            if(this.player.swingTimer > 0) this.player.swingTimer--;

            // --- 3. LÓGICA DE AUTO-RUN (WII) ---
            // O boneco segue a bola horizontalmente
            if(this.state === 'rally') {
                if(this.ball.vz > 0) { // Se a bola vem na minha direção
                    const dx = this.ball.x - this.player.x;
                    if(Math.abs(dx) > 10) {
                        this.player.x += Math.sign(dx) * Math.min(Math.abs(dx), this.player.speed);
                    }
                }
            }

            // --- 4. FÍSICA DA BOLA ---
            if(this.state !== 'point_end') {
                // SAQUE
                if(this.state === 'serve') {
                    this.ball.x = this.player.x + 30;
                    this.ball.y = 110 + Math.sin(Date.now()/200)*15;
                    this.ball.z = PLAYER_Z - 40;
                    
                    if(isSwing) {
                        window.Sfx.hit();
                        this.state = 'rally';
                        this.ball.vz = -50; // Saque potente
                        this.ball.vy = 12;
                        this.ball.vx = (this.player.x / 400) * -10; // Ângulo
                    }
                }
                // RALLY
                else if (this.state === 'rally') {
                    this.ball.x += this.ball.vx;
                    this.ball.y += this.ball.vy;
                    this.ball.z += this.ball.vz;
                    this.ball.vy -= GRAVITY;

                    // Quique
                    if(this.ball.y < 0) {
                        this.ball.y = 0;
                        this.ball.vy = Math.abs(this.ball.vy) * BOUNCE;
                        if(Math.abs(this.ball.z) < 900) window.Sfx.click();
                    }

                    // --- COLISÃO PLAYER ---
                    // Zona de acerto: Perto do fundo e perto do player
                    if(this.ball.vz > 0 && Math.abs(this.ball.z - PLAYER_Z) < 120) {
                        if(Math.abs(this.ball.x - this.player.x) < 120) {
                            if(isSwing) { // Bateu!
                                window.Sfx.hit();
                                this.flash = 4;
                                
                                // TIMING (O Segredo do Wii)
                                // Z positivo = perto do corpo (Atrasado/Late) -> Paralela
                                // Z longe = longe do corpo (Adiantado/Early) -> Cruzada
                                const timing = this.ball.z - PLAYER_Z; 
                                const angle = timing * 0.2; 
                                
                                this.ball.vz = -55; // Devolução rápida
                                this.ball.vy = 15 + Math.random()*5;
                                this.ball.vx = angle + (this.player.x * -0.01);
                            }
                        }
                    }

                    // --- COLISÃO CPU ---
                    if(this.ball.vz < 0) {
                        const dx = this.ball.x - this.enemy.x;
                        this.enemy.x += Math.sign(dx) * Math.min(Math.abs(dx), this.enemy.speed);
                        
                        if(Math.abs(this.ball.z - ENEMY_Z) < 100 && Math.abs(this.ball.x - this.enemy.x) < 100) {
                            window.Sfx.hit();
                            this.ball.vz = 45;
                            this.ball.vy = 14;
                            const aim = (this.player.x > 0) ? -200 : 200; // Tenta tirar do player
                            this.ball.vx = (aim - this.ball.x) * 0.02;
                        }
                    }

                    // PONTOS
                    if(this.ball.z < ENEMY_Z - 300) this.point('player');
                    if(this.ball.z > PLAYER_Z + 300) this.point('enemy');
                }
            }

            // --- 5. RENDERIZAÇÃO DOS OBJETOS (SORT Z) ---
            const objs = [
                {t:'ball', ...this.ball},
                {t:'player', ...this.player, z:PLAYER_Z},
                {t:'enemy', ...this.enemy, z:ENEMY_Z}
            ];
            objs.sort((a,b) => a.z - b.z); // Desenha do fundo p/ frente

            objs.forEach(o => {
                const pos = project(o.x, o.y, o.z);
                const shadow = project(o.x, 0, o.z);
                const s = pos.s;

                // Sombra (Essencial para profundidade)
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.beginPath(); ctx.ellipse(shadow.x, shadow.y, 25*s, 10*s, 0, 0, Math.PI*2); ctx.fill();

                if(o.t === 'ball') {
                    // Bola
                    const bSz = 15 * s;
                    ctx.fillStyle = '#ff0'; ctx.beginPath(); ctx.arc(pos.x, pos.y, bSz, 0, Math.PI*2); ctx.fill();
                    // Brilho
                    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(pos.x-bSz*0.3, pos.y-bSz*0.3, bSz*0.3, 0, Math.PI*2); ctx.fill();
                } else {
                    // Boneco (Mii Style)
                    const color = o.t==='player' ? '#00ccff' : '#ff5555';
                    ctx.save();
                    ctx.translate(pos.x, pos.y - 50*s);
                    
                    // Swing visual
                    let rot = 0;
                    if(o.t==='player' && this.player.swingTimer > 5) rot = -0.5;
                    
                    // Corpo
                    ctx.fillStyle = color; ctx.fillRect(-20*s, -25*s, 40*s, 70*s);
                    // Cabeça
                    ctx.fillStyle = '#fceabb'; ctx.beginPath(); ctx.arc(0, -40*s, 22*s, 0, Math.PI*2); ctx.fill();
                    
                    // Braço
                    ctx.translate(25*s, -10*s);
                    ctx.rotate(rot);
                    ctx.fillStyle='#333'; ctx.fillRect(0, -5*s, 35*s, 8*s);
                    
                    // Raquete
                    ctx.translate(35*s, 0);
                    ctx.strokeStyle='#222'; ctx.lineWidth=4*s; 
                    ctx.beginPath(); ctx.arc(0,0, 20*s, 0, Math.PI*2); ctx.stroke();
                    ctx.fillStyle='rgba(255,0,0,0.2)'; ctx.fill();
                    
                    ctx.restore();
                }
            });

            // Efeitos Finais
            if(this.flash > 0) {
                ctx.fillStyle = `rgba(255,255,255,${this.flash*0.2})`; ctx.fillRect(0,0,w,h); this.flash--;
            }

            // Placar TV
            ctx.fillStyle = '#000'; ctx.fillRect(20, 20, 160, 70);
            ctx.fillStyle = '#fff'; ctx.font="20px Arial";
            ctx.fillText(`PLAYER: ${this.score[0]}`, 30, 50);
            ctx.fillText(`CPU:    ${this.score[1]}`, 30, 80);

            return this.score[0];
        },

        point: function(who) {
            this.state = 'point_end';
            window.Sfx.coin();
            if(who === 'player') {
                this.score[0] += 15;
                if(this.score[0]===45) this.score[0]=40;
                window.System.msg("PONTO SEU!");
                setTimeout(() => this.resetBall('player'), 2000);
            } else {
                this.score[1] += 15;
                if(this.score[1]===45) this.score[1]=40;
                window.System.msg("PONTO CPU!");
                setTimeout(() => this.resetBall('cpu'), 2000);
            }
            if(this.score[0]>=60 || this.score[1]>=60) window.System.gameOver(this.score[0]);
        }
    };

    // REGISTRO
    const regLoop = setInterval(() => {
        if(window.System && window.System.registerGame) {
            window.System.registerGame('tennis', 'Wii Tennis Real', '🎾', Logic, {camOpacity: 0.1, showWheel: false});
            clearInterval(regLoop);
        }
    }, 100);
})();
