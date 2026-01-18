// LÓGICA DO JOGO: OTTO TENNIS (WII CLASSIC MECHANIC - AUTO RUN)
(function() {
    // Configurações
    const COURT_DEPTH = 1600;
    const NET_Z = 0;
    const PLAYER_Z = 700;
    const ENEMY_Z = -700;
    const GRAVITY = 0.5;

    const Logic = {
        score: [0, 0], // [Player, CPU]
        state: 'menu', // menu, serve, rally, point_end
        
        // Entidades
        ball: { x:0, y:50, z:0, vx:0, vy:0, vz:0 },
        player: { x:0, y:0, swingTimer:0, speed:8 }, // Speed = velocidade de corrida automática
        enemy:  { x:0, y:0, swingTimer:0, speed:7 },
        
        // Input
        handPos: { x:0, y:0 },
        lastHandPos: { x:0, y:0 },
        handVel: 0,

        // Visual
        flash: 0,
        msg: "",

        init: function() { 
            this.score = [0, 0]; 
            this.state = 'serve';
            this.resetBall('player');
            window.System.msg("SEU SAQUE!"); 
        },

        resetBall: function(server) {
            this.ball.vx=0; this.ball.vy=0; this.ball.vz=0;
            
            if(server === 'player') {
                this.state = 'serve';
                this.ball.x = this.player.x + 20;
                this.ball.y = 100;
                this.ball.z = PLAYER_Z - 50;
                this.player.x = 0; // Volta ao centro
            } else {
                this.state = 'rally'; // CPU saca rápido
                this.ball.x = this.enemy.x;
                this.ball.y = 150;
                this.ball.z = ENEMY_Z + 50;
                this.ball.vz = 40; // Vem pro player
                this.ball.vy = 12;
                this.ball.vx = (Math.random()-0.5) * 15;
                this.enemy.x = 0;
                window.System.msg("DEFENDA!");
            }
        },

        update: function(ctx, w, h, pose) {
            const cx = w / 2;
            const cy = h / 2 - 50;

            // --- 1. INPUT DO ESQUELETO (SWING DETECTION) ---
            let isSwing = false;
            
            if(pose) {
                // Desenha o Esqueleto (Overlay de Debug)
                if(window.Gfx && window.Gfx.drawSkeleton) {
                    ctx.save();
                    ctx.globalAlpha = 0.4;
                    ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 3;
                    window.Gfx.drawSkeleton(ctx, pose, w, h);
                    ctx.restore();
                }

                // Detecta Mão Dominante
                const rW = pose.keypoints.find(k=>k.name==='right_wrist');
                const lW = pose.keypoints.find(k=>k.name==='left_wrist');
                const hand = (rW && rW.score>0.3) ? rW : (lW && lW.score>0.3 ? lW : null);

                if(hand) {
                    const mapped = window.Gfx.map(hand, w, h);
                    this.lastHandPos = { ...this.handPos };
                    this.handPos = mapped;

                    // Calcula velocidade do gesto
                    const dist = Math.hypot(this.handPos.x - this.lastHandPos.x, this.handPos.y - this.lastHandPos.y);
                    this.handVel = dist;

                    // Se a velocidade for alta, é um SWING
                    if(this.handVel > 20 && this.player.swingTimer === 0) {
                        isSwing = true;
                        this.player.swingTimer = 10; // Cooldown da raquetada
                    }
                }
            }
            if(this.player.swingTimer > 0) this.player.swingTimer--;

            // --- 2. LÓGICA DO JOGADOR (AUTO-RUN WII STYLE) ---
            // O jogador corre sozinho na direção X da bola, mas com limite de velocidade
            if(this.state === 'rally') {
                const targetX = this.ball.x;
                const diff = targetX - this.player.x;
                // Move o player na direção da bola
                if(Math.abs(diff) > 10) {
                    this.player.x += Math.sign(diff) * Math.min(Math.abs(diff), this.player.speed);
                }
            }

            // --- 3. FÍSICA DA BOLA ---
            if(this.state !== 'point_end') {
                
                // SAQUE
                if(this.state === 'serve') {
                    this.ball.x = this.player.x + 30;
                    this.ball.y = 120 + Math.sin(Date.now()/200)*20; // Flutua
                    this.ball.z = PLAYER_Z - 50;
                    
                    if(isSwing) {
                        window.Sfx.hit();
                        this.state = 'rally';
                        this.ball.vz = -45; // Vai pro fundo
                        this.ball.vy = 15; // Sobe
                        // Mira levemente onde o jogador não está
                        this.ball.vx = (Math.random()-0.5) * 10; 
                    }
                }
                
                // BOLA EM JOGO
                else if (this.state === 'rally') {
                    this.ball.x += this.ball.vx;
                    this.ball.y += this.ball.vy;
                    this.ball.z += this.ball.vz;
                    this.ball.vy -= GRAVITY; // Gravidade

                    // Quique no chão
                    if(this.ball.y < 0) {
                        this.ball.y = 0;
                        this.ball.vy = Math.abs(this.ball.vy) * 0.75; // Perde força
                        if(Math.abs(this.ball.z) < 900) window.Sfx.click();
                    }

                    // --- COLISÃO PLAYER (REBATIDA) ---
                    // Se a bola estiver perto do plano Z do jogador
                    if(this.ball.vz > 0 && Math.abs(this.ball.z - PLAYER_Z) < 100) {
                        // Se a bola estiver perto do corpo do jogador (X)
                        if(Math.abs(this.ball.x - this.player.x) < 100) {
                            // Se houver Swing ou a bola vier muito em cima (Bloqueio automático)
                            if(isSwing) {
                                window.Sfx.hit();
                                this.flash = 5;
                                
                                // MECÂNICA DE TIMING (CRUCIAL!)
                                // Se bater Cedo (bola longe): Cruzada. 
                                // Se bater Tarde (bola perto do corpo): Reta.
                                const timing = (this.ball.z - PLAYER_Z); 
                                const angle = timing * 0.15; // Define o ângulo X
                                
                                this.ball.vz = -50; // Devolve rápido
                                this.ball.vy = 15 + (Math.random()*5);
                                this.ball.vx = angle + (this.player.x * -0.02);
                            }
                        }
                    }

                    // --- COLISÃO CPU (IA) ---
                    // IA corre pra bola
                    if(this.ball.vz < 0) {
                        const diff = this.ball.x - this.enemy.x;
                        this.enemy.x += Math.sign(diff) * Math.min(Math.abs(diff), this.enemy.speed);
                        
                        // IA Rebate
                        if(Math.abs(this.ball.z - ENEMY_Z) < 80 && Math.abs(this.ball.x - this.enemy.x) < 100) {
                            window.Sfx.hit();
                            this.ball.vz = 45; // Devolve
                            this.ball.vy = 14;
                            // IA Tenta jogar longe do player
                            const target = (this.player.x > 0) ? -200 : 200;
                            this.ball.vx = (target - this.ball.x) * 0.02;
                        }
                    }

                    // PONTUAÇÃO
                    if(this.ball.z < ENEMY_Z - 300) this.point('player');
                    if(this.ball.z > PLAYER_Z + 300) this.point('enemy');
                }
            }

            // --- 4. RENDERIZAÇÃO (SIMPLES E EFICIENTE) ---
            
            // Função de Projeção 3D -> 2D
            const project = (x, y, z) => {
                const fov = 600;
                const scale = fov / (fov + (z + 800)); // Câmera recuada
                return {
                    x: cx + (x * scale),
                    y: cy - (y * scale),
                    s: scale
                };
            };

            // Céu e Chão
            const hor = project(0,0,10000).y;
            const grad = ctx.createLinearGradient(0,0,0,hor);
            grad.addColorStop(0, '#2980b9'); grad.addColorStop(1, '#6dd5fa');
            ctx.fillStyle = grad; ctx.fillRect(0,0,w,hor);
            ctx.fillStyle = '#2c3e50'; ctx.fillRect(0,hor,w,h);

            // Quadra (Azul)
            const pTL = project(-300, 0, ENEMY_Z); const pTR = project(300, 0, ENEMY_Z);
            const pBL = project(-300, 0, PLAYER_Z); const pBR = project(300, 0, PLAYER_Z);
            
            ctx.fillStyle = '#3498db'; 
            ctx.beginPath(); ctx.moveTo(pTL.x, pTL.y); ctx.lineTo(pTR.x, pTR.y);
            ctx.lineTo(pBR.x, pBR.y); ctx.lineTo(pBL.x, pBL.y); ctx.fill();
            
            // Linhas
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(pTL.x, pTL.y); ctx.lineTo(pBL.x, pBL.y); // Esq
            ctx.moveTo(pTR.x, pTR.y); ctx.lineTo(pBR.x, pBR.y); // Dir
            ctx.moveTo(pTL.x, pTL.y); ctx.lineTo(pTR.x, pTR.y); // Fundo
            ctx.moveTo(pBL.x, pBL.y); ctx.lineTo(pBR.x, pBR.y); // Frente
            // Linha central e rede
            const pMidL = project(-300, 0, 0); const pMidR = project(300, 0, 0);
            ctx.moveTo(pMidL.x, pMidL.y); ctx.lineTo(pMidR.x, pMidR.y);
            ctx.stroke();

            // Rede (Altura)
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            const netHL = project(-350, 40, 0); const netHR = project(350, 40, 0);
            const netBL = project(-350, 0, 0); const netBR = project(350, 0, 0);
            ctx.beginPath(); ctx.moveTo(netHL.x, netHL.y); ctx.lineTo(netHR.x, netHR.y);
            ctx.lineTo(netBR.x, netBR.y); ctx.lineTo(netBL.x, netBL.y); ctx.fill();
            ctx.fillStyle='#fff'; ctx.fillRect(netHL.x, netHL.y, netHR.x-netHL.x, 3);

            // --- DESENHA OBJETOS (SORT Z) ---
            const objs = [
                {t:'ball', ...this.ball},
                {t:'player', ...this.player, z:PLAYER_Z},
                {t:'enemy', ...this.enemy, z:ENEMY_Z}
            ];
            objs.sort((a,b) => a.z - b.z); // Desenha do fundo pra frente

            objs.forEach(o => {
                const pos = project(o.x, o.y, o.z);
                const shadow = project(o.x, 0, o.z);
                const s = pos.s;

                // Sombra
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.beginPath(); ctx.ellipse(shadow.x, shadow.y, 20*s, 8*s, 0, 0, Math.PI*2); ctx.fill();

                if(o.t === 'ball') {
                    // Bola
                    const bSize = 12 * s;
                    ctx.fillStyle = '#ff0'; 
                    ctx.beginPath(); ctx.arc(pos.x, pos.y, bSize, 0, Math.PI*2); ctx.fill();
                    // Brilho
                    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(pos.x-bSize*0.3, pos.y-bSize*0.3, bSize*0.3, 0, Math.PI*2); ctx.fill();
                } else {
                    // Boneco (Mii Simplificado)
                    const color = o.t==='player' ? '#00ccff' : '#ff5555';
                    
                    // Animação de Raquete
                    let rackRot = 0;
                    if(o.t==='player' && this.player.swingTimer > 5) rackRot = -1; // Swing visual
                    
                    ctx.save();
                    ctx.translate(pos.x, pos.y - 40*s);
                    // Corpo
                    ctx.fillStyle = color; ctx.fillRect(-15*s, -20*s, 30*s, 60*s);
                    // Cabeça
                    ctx.fillStyle = '#fceabb'; ctx.beginPath(); ctx.arc(0, -35*s, 18*s, 0, Math.PI*2); ctx.fill();
                    
                    // Braço e Raquete
                    ctx.translate(20*s, -10*s);
                    ctx.rotate(rackRot);
                    ctx.fillStyle = '#333'; ctx.fillRect(0, -5*s, 30*s, 5*s); // Braço
                    
                    // Raquete
                    ctx.translate(30*s, 0);
                    ctx.strokeStyle='#333'; ctx.lineWidth=3*s;
                    ctx.beginPath(); ctx.arc(0,0, 15*s, 0, Math.PI*2); ctx.stroke();
                    ctx.fillStyle='rgba(255,0,0,0.3)'; ctx.fill();
                    
                    ctx.restore();
                }
            });

            // Feedback Visual (Flash)
            if(this.flash > 0) {
                ctx.fillStyle = `rgba(255,255,255,${this.flash*0.3})`;
                ctx.fillRect(0,0,w,h);
                this.flash--;
            }

            // Placar
            ctx.fillStyle = 'white'; ctx.font = "20px Arial"; ctx.textAlign="left";
            ctx.fillText(`P1: ${this.score[0]}`, 30, 50);
            ctx.fillText(`CPU: ${this.score[1]}`, 30, 80);

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

    // REGISTRO NO SISTEMA
    // Garante que o jogo só registra quando o System estiver pronto
    const regLoop = setInterval(() => {
        if(window.System && window.System.registerGame) {
            window.System.registerGame('tennis', 'Wii Tennis', '🎾', Logic, {camOpacity: 0.2, showWheel: false});
            clearInterval(regLoop);
        }
    }, 100);
})();
