// =============================================================================
// OTTO TENNIS - WII SPORTS ENGINE (SKELETON EDITION)
// Engine Física: 3D Pseudo-Projection | Input: Amplified Motion | Visual: Skeleton Overlay
// =============================================================================

(function() {
    // Constantes de Calibragem
    const COURT_WIDTH = 600;
    const NET_Z = 0;
    const BASELINE_Z = 900;
    const BALL_GRAVITY = 0.45;
    const BOUNCE_DAMPING = 0.7;
    const INPUT_SENSITIVITY = 2.8; // Ganho de movimento (Input Gain)

    const Logic = {
        score: [0, 0], // Player, Enemy
        serveTurn: 'player', 
        gameState: 'menu', 
        
        // Entidades 3D
        ball: { x:0, y:100, z:0, vx:0, vy:0, vz:0, visible:false },
        player: { x:0, z: BASELINE_Z, targetX:0, swing:0 },
        enemy: { x:0, z: -BASELINE_Z, targetX:0, speed: 7 },
        
        // Feedback
        flash: 0,
        trail: [],

        init: function() { 
            this.score = [0, 0]; 
            this.serveTurn = 'player';
            this.startPoint();
            window.System.msg("GAME START"); 
        },

        startPoint: function() {
            this.ball.vx = 0; this.ball.vy = 0; this.ball.vz = 0;
            this.trail = [];
            
            if(this.serveTurn === 'player') {
                this.gameState = 'serve';
                this.ball.x = this.player.x + 20;
                this.ball.y = 150;
                this.ball.z = this.player.z - 20;
                this.ball.visible = true;
                window.System.msg("SEU SAQUE");
            } else {
                this.gameState = 'rally';
                this.ball.x = this.enemy.x;
                this.ball.y = 180;
                this.ball.z = this.enemy.z + 50;
                this.ball.visible = true;
                this.ball.vz = 35; 
                this.ball.vy = 12;
                this.ball.vx = (Math.random() - 0.5) * 15;
                window.System.msg("DEFENDA!");
            }
        },

        update: function(ctx, w, h, pose) {
            const centerX = w / 2;
            const centerY = h / 2 - 50;
            
            // --- 1. INPUT AMPLIFICADO ---
            let handDetected = false;
            if(pose) {
                const rW = pose.keypoints.find(k=>k.name==='right_wrist');
                const lW = pose.keypoints.find(k=>k.name==='left_wrist');
                let targetHand = (rW && rW.score > 0.3) ? rW : ((lW && lW.score > 0.3) ? lW : null);

                if(targetHand) {
                    handDetected = true;
                    // Mapeia coordenadas (-1 a 1)
                    const normX = ((targetHand.x / w) - 0.5) * -1; 
                    const normY = (targetHand.y / h) - 0.5;

                    // Aplica ganho para cobrir a quadra inteira
                    this.player.targetX = normX * COURT_WIDTH * INPUT_SENSITIVITY;
                    
                    // Suaviza movimento
                    this.player.x += (this.player.targetX - this.player.x) * 0.2;
                    
                    // Detecta Swing (Armar e Bater)
                    if(normY < -0.2) this.player.swing = 1; // Armou (Cima)
                    else if(this.player.swing === 1 && normY > 0) this.player.swing = 2; // Bateu (Baixo)
                    else this.player.swing = 0; 
                }
            }
            // Trava nas bordas
            this.player.x = Math.max(-COURT_WIDTH/2 - 100, Math.min(COURT_WIDTH/2 + 100, this.player.x));

            // --- 2. FÍSICA ---
            if(this.gameState !== 'point_end') {
                // Rastro
                if(Math.abs(this.ball.vz) > 5) {
                    this.ball.trail.push({x:this.ball.x, y:this.ball.y, z:this.ball.z});
                    if(this.ball.trail.length > 8) this.ball.trail.shift();
                }

                if(this.gameState === 'serve') {
                    this.ball.x = this.player.x + 30;
                    this.ball.z = this.player.z - 20;
                    this.ball.y = 100 + Math.abs(Math.sin(Date.now()/300))*20; // Flutua
                    
                    if(this.player.swing === 2) { // Swing detectado
                        window.Sfx.hit();
                        this.gameState = 'rally';
                        this.ball.vz = -40; 
                        this.ball.vy = 15; 
                        this.ball.vx = (this.player.x / (COURT_WIDTH/2)) * -5;
                        this.player.swing = 0;
                    }
                }
                else if (this.gameState === 'rally') {
                    this.ball.x += this.ball.vx;
                    this.ball.y += this.ball.vy;
                    this.ball.z += this.ball.vz;
                    this.ball.vy -= BALL_GRAVITY; 

                    // Quique
                    if(this.ball.y < 0) {
                        this.ball.y = 0;
                        this.ball.vy = Math.abs(this.ball.vy) * BOUNCE_DAMPING;
                        if(Math.abs(this.ball.z) < 800) window.Sfx.click();
                    }

                    // Rede
                    if(Math.abs(this.ball.z) < 20 && this.ball.y < 40) {
                        this.ball.vz *= -0.5;
                        this.ball.z = (this.ball.z > 0) ? 25 : -25;
                    }

                    // Colisão Jogador
                    if(this.ball.vz > 0 && this.ball.z > this.player.z - 100 && this.ball.z < this.player.z + 100) {
                        if(Math.abs(this.ball.x - this.player.x) < 120) {
                            if(handDetected) {
                                window.Sfx.hit();
                                this.flash = 5;
                                
                                // Timing define direção (Cedo=Cruzada, Tarde=Paralela)
                                const timing = this.ball.z - this.player.z; 
                                const angleMod = timing * 0.15; 
                                this.ball.vz = -45; 
                                this.ball.vy = 15 + Math.random()*5; 
                                this.ball.vx = angleMod + (this.player.x * -0.01); 
                            }
                        }
                    }

                    // IA
                    if(this.ball.vz < 0) {
                        const diff = this.ball.x - this.enemy.x;
                        this.enemy.x += Math.sign(diff) * Math.min(Math.abs(diff), this.enemy.speed);
                        
                        if(this.ball.z < this.enemy.z + 100 && this.ball.z > this.enemy.z - 50) {
                            if(Math.abs(this.ball.x - this.enemy.x) < 100) {
                                window.Sfx.hit();
                                this.ball.vz = 42; 
                                this.ball.vy = 14;
                                const aim = (this.player.x > 0) ? -200 : 200;
                                this.ball.vx = (aim - this.ball.x) * 0.015;
                            }
                        }
                    }

                    // Pontuação
                    if(this.ball.z > BASELINE_Z + 300) this.resolvePoint('enemy');
                    if(this.ball.z < -BASELINE_Z - 300) this.resolvePoint('player');
                }
            }

            // --- 3. RENDERIZAÇÃO 3D ---
            
            const project = (x, y, z) => {
                const scale = 600 / (600 + (z + 800));
                return { x: centerX + (x * scale), y: centerY - (y * scale), s: scale };
            };

            // Fundo e Chão
            const horizonY = project(0, 0, 10000).y;
            const gradSky = ctx.createLinearGradient(0, 0, 0, horizonY);
            gradSky.addColorStop(0, "#4a90e2"); gradSky.addColorStop(1, "#87ceeb");
            ctx.fillStyle = gradSky; ctx.fillRect(0, 0, w, horizonY);
            ctx.fillStyle = "#2c3e50"; ctx.fillRect(0, horizonY, w, h - horizonY);

            // Quadra
            const pTL = project(-COURT_WIDTH/2, 0, -BASELINE_Z);
            const pTR = project(COURT_WIDTH/2, 0, -BASELINE_Z);
            const pBL = project(-COURT_WIDTH/2, 0, BASELINE_Z);
            const pBR = project(COURT_WIDTH/2, 0, BASELINE_Z);

            ctx.fillStyle = "#3498db"; 
            ctx.beginPath(); ctx.moveTo(pTL.x, pTL.y); ctx.lineTo(pTR.x, pTR.y);
            ctx.lineTo(pBR.x, pBR.y); ctx.lineTo(pBL.x, pBL.y); ctx.fill();

            // Linhas
            ctx.strokeStyle = "white"; ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(pTL.x, pTL.y); ctx.lineTo(pBL.x, pBL.y);
            ctx.moveTo(pTR.x, pTR.y); ctx.lineTo(pBR.x, pBR.y);
            ctx.moveTo(pTL.x, pTL.y); ctx.lineTo(pTR.x, pTR.y);
            ctx.moveTo(pBL.x, pBL.y); ctx.lineTo(pBR.x, pBR.y);
            const pCL = project(0, 0, -BASELINE_Z); const pCB = project(0, 0, BASELINE_Z);
            ctx.moveTo(pCL.x, pCL.y); ctx.lineTo(pCB.x, pCB.y); 
            ctx.stroke();

            // Rede
            const pNetL = project(-COURT_WIDTH/2 - 50, 40, 0);
            const pNetR = project(COURT_WIDTH/2 + 50, 40, 0);
            const pNetBL = project(-COURT_WIDTH/2 - 50, 0, 0);
            const pNetBR = project(COURT_WIDTH/2 + 50, 0, 0);
            ctx.fillStyle = "rgba(200,200,200,0.4)";
            ctx.beginPath(); ctx.moveTo(pNetL.x, pNetL.y); ctx.lineTo(pNetR.x, pNetR.y);
            ctx.lineTo(pNetBR.x, pNetBR.y); ctx.lineTo(pNetBL.x, pNetBL.y); ctx.fill();
            ctx.fillStyle = "white"; ctx.fillRect(pNetL.x, pNetL.y, pNetR.x - pNetL.x, 5);

            // Entidades
            const entities = [
                { type: 'player', ...this.player },
                { type: 'enemy', ...this.enemy },
                { type: 'ball', ...this.ball }
            ];
            entities.sort((a, b) => a.z - b.z);

            entities.forEach(ent => {
                if(ent.type === 'ball' && !ent.visible) return;
                const pos = project(ent.x, ent.y || 0, ent.z);
                const gPos = project(ent.x, 0, ent.z);
                const s = pos.s;

                if(ent.type === 'ball') {
                    // Sombra Bola
                    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); 
                    ctx.ellipse(gPos.x, gPos.y, 10*s, 5*s, 0, 0, Math.PI*2); ctx.fill();
                    // Corpo Bola
                    const bSize = 12 * s;
                    ctx.fillStyle = "#ffeb3b"; ctx.beginPath(); ctx.arc(pos.x, pos.y, bSize, 0, Math.PI*2); ctx.fill();
                }
                else {
                    // Sombra Player
                    ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.beginPath(); 
                    ctx.ellipse(gPos.x, gPos.y, 40*s, 15*s, 0, 0, Math.PI*2); ctx.fill();

                    // Avatar
                    const color = ent.type === 'player' ? '#3498db' : '#e74c3c';
                    ctx.fillStyle = color;
                    
                    let tilt = 0;
                    if(ent.type === 'player') tilt = (this.player.swing === 1) ? -0.2 : ((this.player.swing === 2) ? 0.3 : 0);

                    ctx.save();
                    ctx.translate(pos.x, pos.y - 60*s);
                    ctx.rotate(tilt);
                    ctx.fillRect(-15*s, -30*s, 30*s, 60*s); // Corpo
                    ctx.fillStyle = "#f1c40f"; ctx.beginPath(); ctx.arc(0, -45*s, 18*s, 0, Math.PI*2); ctx.fill(); // Cabeça
                    
                    // Raquete 3D
                    ctx.strokeStyle = "#333"; ctx.lineWidth = 4*s;
                    ctx.beginPath();
                    const rX = (ent.type==='player') ? 25*s : -25*s; 
                    const rY = (this.player.swing === 1) ? -50*s : 0;
                    ctx.moveTo(10*s, -10*s); ctx.lineTo(rX, rY); ctx.stroke();
                    ctx.fillStyle = "rgba(255,0,0,0.3)"; ctx.strokeStyle="#cc0000";
                    ctx.beginPath(); ctx.arc(rX, rY, 20*s, 0, Math.PI*2); ctx.fill(); ctx.stroke();
                    ctx.restore();
                }
            });

            // --- 4. VISUALIZAÇÃO DO ESQUELETO (PADRÃO BOXE - OVERLAY) ---
            // Desenha o esqueleto por cima de tudo para feedback do tracking
            if(window.Gfx && window.Gfx.drawSkeleton && pose) {
                ctx.save();
                ctx.globalAlpha = 0.5; // Translucido para não esconder o jogo
                
                // Forçamos a cor para ser visível sobre a quadra azul
                ctx.strokeStyle = '#00ff00'; 
                ctx.lineWidth = 4;
                
                // Chama a função do Core que desenha linhas e pontos
                window.Gfx.drawSkeleton(ctx, pose, w, h);
                
                // Destaque na mão que está controlando a raquete
                if(handDetected) {
                    const rW = pose.keypoints.find(k=>k.name==='right_wrist');
                    const lW = pose.keypoints.find(k=>k.name==='left_wrist');
                    const activeHand = (rW && rW.score > 0.3) ? rW : lW;
                    
                    if(activeHand) {
                        const hPos = window.Gfx.map(activeHand, w, h);
                        ctx.beginPath();
                        ctx.arc(hPos.x, hPos.y, 20, 0, Math.PI*2);
                        ctx.fillStyle = "rgba(255, 255, 0, 0.5)"; // Amarelo brilhante
                        ctx.fill();
                        ctx.stroke();
                        ctx.fillStyle = "#fff"; ctx.font="12px Arial"; ctx.fillText("RAQUETE", hPos.x-25, hPos.y-25);
                    }
                }
                ctx.restore();
            }

            // --- 5. UI ---
            if(this.flash > 0) {
                ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.2})`; ctx.fillRect(0,0,w,h); this.flash--;
            }

            // Placar
            ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.roundRect(20, 20, 150, 80, 10); ctx.fill();
            ctx.fillStyle = "white"; ctx.font = "bold 20px Arial";
            ctx.fillText(`PLAYER: ${this.score[0]}`, 40, 50);
            ctx.fillText(`CPU:    ${this.score[1]}`, 40, 80);

            // Aviso de Limite
            if(Math.abs(this.player.x) > COURT_WIDTH/2 - 50) {
                ctx.fillStyle = "red"; ctx.font = "bold 30px Arial"; ctx.textAlign = "center";
                ctx.fillText("<< VOLTE AO CENTRO >>", centerX, h - 100);
            }

            return this.score[0];
        },

        resolvePoint: function(winner) {
            window.Sfx.coin();
            this.gameState = 'point_end';
            this.ball.visible = false;
            
            if(winner === 'player') {
                this.score[0] += 15;
                if(this.score[0] === 45) this.score[0] = 40;
                window.System.msg("PONTO SEU!");
                this.serveTurn = 'player';
            } else {
                this.score[1] += 15;
                if(this.score[1] === 45) this.score[1] = 40;
                window.System.msg("PONTO CPU!");
                this.serveTurn = 'enemy';
            }

            if(this.score[0] >= 60 || this.score[1] >= 60) {
                window.System.gameOver(this.score[0]);
            } else {
                setTimeout(() => this.startPoint(), 2000);
            }
        }
    };

    // REGISTRO
    const regLoop = setInterval(() => {
        if(window.System && window.System.registerGame) {
            window.System.registerGame('tennis', 'Wii Tennis Pro', '🎾', Logic, {camOpacity: 0.2, showWheel: false});
            clearInterval(regLoop);
        }
    }, 100);
})();
