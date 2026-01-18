// =============================================================================
// OTTO TENNIS - WII SPORTS ENGINE (FINAL VERSION)
// Engine Física: 3D Pseudo-Projection | Input: Amplified Motion Tracking
// =============================================================================

(function() {
    // Constantes de Calibragem (Senior Dev Tuning)
    const COURT_WIDTH = 600;
    const COURT_DEPTH = 1800;
    const NET_Z = 0;
    const BASELINE_Z = 900;
    const BALL_GRAVITY = 0.45;
    const BOUNCE_DAMPING = 0.7;
    const INPUT_SENSITIVITY = 2.8; // Multiplicador de movimento (O segredo do Wii)

    const Logic = {
        score: [0, 0], // Player, Enemy
        serveTurn: 'player', // player | enemy
        gameState: 'menu', // menu, serve, rally, point_end, game_over
        
        // Entidades 3D (X, Y, Z são coordenadas do mundo, não da tela)
        ball: { x:0, y:100, z:0, vx:0, vy:0, vz:0, visible:false },
        player: { x:0, z: BASELINE_Z, targetX:0, swing:0 },
        enemy: { x:0, z: -BASELINE_Z, targetX:0, speed: 7 },
        
        // Feedback Visual
        messages: [],
        cameraShake: 0,
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
                this.ball.y = 150; // Altura da mão
                this.ball.z = this.player.z - 20;
                this.ball.visible = true;
                window.System.msg("SEU SAQUE");
            } else {
                this.gameState = 'rally'; // IA saca automático
                this.ball.x = this.enemy.x;
                this.ball.y = 180;
                this.ball.z = this.enemy.z + 50;
                this.ball.visible = true;
                // Física do saque da IA
                this.ball.vz = 35; // Vem na direção do player
                this.ball.vy = 12;
                this.ball.vx = (Math.random() - 0.5) * 15;
                window.System.msg("DEFENDA!");
            }
        },

        // --- ENGINE FÍSICA E LÓGICA ---
        update: function(ctx, w, h, pose) {
            const centerX = w / 2;
            const centerY = h / 2 - 50; // Horizonte ajustado
            
            // 1. INPUT DO JOGADOR (COM AMPLIFICAÇÃO)
            let handDetected = false;
            let handX = 0;
            let handY = 0;

            if(pose) {
                // Tenta achar a mão dominante
                const rW = pose.keypoints.find(k=>k.name==='right_wrist');
                const lW = pose.keypoints.find(k=>k.name==='left_wrist');
                let targetHand = (rW && rW.score > 0.3) ? rW : ((lW && lW.score > 0.3) ? lW : null);

                if(targetHand) {
                    handDetected = true;
                    // Mapeia a mão da câmera (0..W) para coordenadas normalizadas (-1..1)
                    // Invertemos X porque a câmera é espelho
                    const normX = ((targetHand.x / w) - 0.5) * -1; 
                    const normY = (targetHand.y / h) - 0.5;

                    // APLICA O GANHO (Input Gain)
                    // Multiplica por INPUT_SENSITIVITY para cobrir a quadra movendo pouco a mão
                    this.player.targetX = normX * COURT_WIDTH * INPUT_SENSITIVITY;
                    
                    // Suavização de movimento (Lerp) para não "teletransportar"
                    this.player.x += (this.player.targetX - this.player.x) * 0.2;
                    
                    // Detecção de SWING (Balanço da raquete)
                    // Se a mão mover rápido verticalmente ou horizontalmente
                    // Usamos a posição Y para simular "armar" o golpe
                    if(normY < -0.2) this.player.swing = 1; // Armou
                    else if(this.player.swing === 1 && normY > 0) this.player.swing = 2; // Bateu
                    else this.player.swing = 0; // Idle
                }
            }

            // Trava o jogador nas bordas da quadra
            this.player.x = Math.max(-COURT_WIDTH/2 - 100, Math.min(COURT_WIDTH/2 + 100, this.player.x));

            // 2. FÍSICA DA BOLA
            if(this.gameState !== 'point_end') {
                
                // Salva rastro
                if(Math.abs(this.ball.vz) > 5) {
                    this.ball.trail.push({x:this.ball.x, y:this.ball.y, z:this.ball.z});
                    if(this.ball.trail.length > 8) this.ball.trail.shift();
                }

                // Saque do Jogador (Bola presa na mão)
                if(this.gameState === 'serve') {
                    this.ball.x = this.player.x + 30;
                    this.ball.z = this.player.z - 20;
                    // Bola quica na mão esperando saque
                    this.ball.y = 100 + Math.abs(Math.sin(Date.now()/300))*20;
                    
                    // Se detectar movimento brusco (Swing), lança a bola
                    if(this.player.swing === 2) {
                        window.Sfx.hit();
                        this.gameState = 'rally';
                        this.ball.vz = -40; // Vai para o fundo
                        this.ball.vy = 15; // Sobe
                        this.ball.vx = (this.player.x / (COURT_WIDTH/2)) * -5; // Ângulo básico
                        this.player.swing = 0;
                    }
                }
                // Bola em Jogo
                else if (this.gameState === 'rally') {
                    this.ball.x += this.ball.vx;
                    this.ball.y += this.ball.vy;
                    this.ball.z += this.ball.vz;
                    this.ball.vy -= BALL_GRAVITY; // Gravidade puxa pra baixo (Y diminui)

                    // Quique no chão (Y = 0 é o chão)
                    if(this.ball.y < 0) {
                        this.ball.y = 0;
                        this.ball.vy = Math.abs(this.ball.vy) * BOUNCE_DAMPING;
                        // Som de quique
                        if(Math.abs(this.ball.z) < 800) window.Sfx.click();
                        
                        // Verifica se saiu (Fora)
                        if(Math.abs(this.ball.x) > COURT_WIDTH/2 + 50 || Math.abs(this.ball.z) > BASELINE_Z + 200) {
                            // Quem deixou sair perdeu, a menos que tenha quicado 2x
                            // (Simplificação: Saiu da quadra = Ponto)
                            // this.resolvePoint('out');
                        }
                    }

                    // Colisão com a Rede
                    if(Math.abs(this.ball.z) < 20 && this.ball.y < 40) {
                        this.ball.vz *= -0.5; // Bate e cai
                        this.ball.z = (this.ball.z > 0) ? 25 : -25;
                    }

                    // --- COLISÃO JOGADOR ---
                    // Se bola está perto do Baseline (Z ~ 900) e perto do X do jogador
                    if(this.ball.vz > 0 && this.ball.z > this.player.z - 100 && this.ball.z < this.player.z + 100) {
                        if(Math.abs(this.ball.x - this.player.x) < 120) { // Raio de alcance
                            // Acertou!
                            if(handDetected) { // Só rebate se tiver input
                                window.Sfx.hit();
                                this.flash = 5; // Efeito visual
                                
                                // MECÂNICA DE TIMING DO WII SPORTS
                                // Z da bola indica o timing.
                                // Z > PlayerZ: Atrasado (Late) -> Bola vai na paralela
                                // Z < PlayerZ: Adiantado (Early) -> Bola cruza (Cross)
                                const timing = this.ball.z - this.player.z; 
                                const angleMod = timing * 0.15; 

                                this.ball.vz = -45; // Devolve rápido
                                this.ball.vy = 15 + Math.random()*5; // Arco
                                this.ball.vx = angleMod + (this.player.x * -0.01); // Direção baseada no timing
                            }
                        }
                    }

                    // --- IA INIMIGO ---
                    // Tenta seguir a bola
                    if(this.ball.vz < 0) { // Bola vindo pra ele
                        const target = this.ball.x;
                        const diff = target - this.enemy.x;
                        this.enemy.x += Math.sign(diff) * Math.min(Math.abs(diff), this.enemy.speed);
                        
                        // Rebate
                        if(this.ball.z < this.enemy.z + 100 && this.ball.z > this.enemy.z - 50) {
                            if(Math.abs(this.ball.x - this.enemy.x) < 100) {
                                window.Sfx.hit();
                                this.ball.vz = 42; // Devolve forte
                                this.ball.vy = 14;
                                // IA mira onde o jogador NÃO está
                                const aim = (this.player.x > 0) ? -200 : 200;
                                this.ball.vx = (aim - this.ball.x) * 0.015;
                            }
                        }
                    }

                    // Ponto Marcado (Passou do fundo)
                    if(this.ball.z > BASELINE_Z + 300) this.resolvePoint('enemy'); // Ponto pra IA
                    if(this.ball.z < -BASELINE_Z - 300) this.resolvePoint('player'); // Ponto pro Player
                }
            }

            // --- RENDERIZAÇÃO 3D (PROJECTION) ---
            
            // Função auxiliar para projetar 3D -> 2D
            // fov = Field of View
            const project = (x, y, z) => {
                const scale = 600 / (600 + (z + 800)); // +800 empurra a câmera pra trás
                const x2d = centerX + (x * scale);
                const y2d = centerY - (y * scale); // Y cresce pra cima no 3D, pra baixo no Canvas
                return { x: x2d, y: y2d, s: scale };
            };

            // 1. CÉU E CHÃO
            const horizonY = project(0, 0, 10000).y;
            const gradSky = ctx.createLinearGradient(0, 0, 0, horizonY);
            gradSky.addColorStop(0, "#4a90e2"); gradSky.addColorStop(1, "#87ceeb");
            ctx.fillStyle = gradSky; ctx.fillRect(0, 0, w, horizonY);
            
            ctx.fillStyle = "#2c3e50"; // Cor externa da quadra
            ctx.fillRect(0, horizonY, w, h - horizonY);

            // 2. QUADRA (TRAPÉZIO)
            const pTL = project(-COURT_WIDTH/2, 0, -BASELINE_Z); // Top Left
            const pTR = project(COURT_WIDTH/2, 0, -BASELINE_Z);  // Top Right
            const pBL = project(-COURT_WIDTH/2, 0, BASELINE_Z);  // Bottom Left
            const pBR = project(COURT_WIDTH/2, 0, BASELINE_Z);   // Bottom Right

            ctx.fillStyle = "#3498db"; // Azul Quadra Rápida
            ctx.beginPath();
            ctx.moveTo(pTL.x, pTL.y); ctx.lineTo(pTR.x, pTR.y);
            ctx.lineTo(pBR.x, pBR.y); ctx.lineTo(pBL.x, pBL.y);
            ctx.fill();

            // LINHAS DA QUADRA
            ctx.strokeStyle = "white"; ctx.lineWidth = 2;
            ctx.beginPath();
            // Laterais
            ctx.moveTo(pTL.x, pTL.y); ctx.lineTo(pBL.x, pBL.y);
            ctx.moveTo(pTR.x, pTR.y); ctx.lineTo(pBR.x, pBR.y);
            // Fundos
            ctx.moveTo(pTL.x, pTL.y); ctx.lineTo(pTR.x, pTR.y);
            ctx.moveTo(pBL.x, pBL.y); ctx.lineTo(pBR.x, pBR.y);
            // Linha de Saque e Centro
            const pML = project(-COURT_WIDTH/2, 0, 0); const pMR = project(COURT_WIDTH/2, 0, 0);
            ctx.moveTo(pML.x, pML.y); ctx.lineTo(pMR.x, pMR.y); // Rede linha chão
            const pCL = project(0, 0, -BASELINE_Z); const pCB = project(0, 0, BASELINE_Z);
            ctx.moveTo(pCL.x, pCL.y); ctx.lineTo(pCB.x, pCB.y); // Centro
            ctx.stroke();

            // 3. REDE
            const netHeight = 40;
            const pNetL = project(-COURT_WIDTH/2 - 50, netHeight, 0);
            const pNetR = project(COURT_WIDTH/2 + 50, netHeight, 0);
            const pNetBaseL = project(-COURT_WIDTH/2 - 50, 0, 0);
            const pNetBaseR = project(COURT_WIDTH/2 + 50, 0, 0);

            ctx.fillStyle = "rgba(200,200,200,0.4)";
            ctx.beginPath();
            ctx.moveTo(pNetL.x, pNetL.y); ctx.lineTo(pNetR.x, pNetR.y);
            ctx.lineTo(pNetBaseR.x, pNetBaseR.y); ctx.lineTo(pNetBaseL.x, pNetBaseL.y);
            ctx.fill();
            ctx.fillStyle = "white"; ctx.fillRect(pNetL.x, pNetL.y, pNetR.x - pNetL.x, 5); // Faixa branca topo

            // 4. ENTIDADES (SORT Z ORDER)
            // Desenhamos na ordem de profundidade para oclusão correta
            const entities = [
                { type: 'player', ...this.player },
                { type: 'enemy', ...this.enemy },
                { type: 'ball', ...this.ball }
            ];
            entities.sort((a, b) => b.z - a.z); // Z maior (perto) desenha por último? Não, Z menor (longe) primeiro.
            // No nosso sistema: Z negativo é fundo (Enemy), Z positivo é frente (Player).
            // Logo, desenhamos do menor Z para o maior Z.
            entities.sort((a, b) => a.z - b.z);

            entities.forEach(ent => {
                if(ent.type === 'ball' && !ent.visible) return;

                const pos = project(ent.x, ent.y || 0, ent.z);
                const groundPos = project(ent.x, 0, ent.z); // Para sombra
                const scale = pos.s;

                if(ent.type === 'ball') {
                    // Rastro
                    this.trail.forEach((t, i) => {
                        const tp = project(t.x, t.y, t.z);
                        ctx.globalAlpha = i / 10;
                        ctx.fillStyle = '#ff0';
                        ctx.beginPath(); ctx.arc(tp.x, tp.y, 8*tp.s, 0, Math.PI*2); ctx.fill();
                    });
                    ctx.globalAlpha = 1;

                    // Sombra da Bola (Depth Perception Crucial!)
                    ctx.fillStyle = "rgba(0,0,0,0.3)";
                    ctx.beginPath(); 
                    ctx.ellipse(groundPos.x, groundPos.y, 10*scale, 5*scale, 0, 0, Math.PI*2); 
                    ctx.fill();
                    // Linha guia de altura (opcional, ajuda muito)
                    ctx.beginPath(); ctx.moveTo(groundPos.x, groundPos.y); ctx.lineTo(pos.x, pos.y);
                    ctx.strokeStyle = "rgba(0,0,0,0.1)"; ctx.stroke();

                    // Bola
                    const size = 12 * scale;
                    ctx.fillStyle = "#ffeb3b"; // Amarelo Tênis
                    ctx.beginPath(); ctx.arc(pos.x, pos.y, size, 0, Math.PI*2); ctx.fill();
                    // Brilho
                    ctx.fillStyle = "white"; 
                    ctx.beginPath(); ctx.arc(pos.x - size*0.3, pos.y - size*0.3, size*0.3, 0, Math.PI*2); ctx.fill();
                }
                else if (ent.type === 'player' || ent.type === 'enemy') {
                    // Sombra
                    ctx.fillStyle = "rgba(0,0,0,0.4)";
                    ctx.beginPath(); 
                    ctx.ellipse(groundPos.x, groundPos.y, 40*scale, 15*scale, 0, 0, Math.PI*2); 
                    ctx.fill();

                    // Corpo (Mii Style - Simples e Legível)
                    const color = ent.type === 'player' ? '#3498db' : '#e74c3c';
                    ctx.fillStyle = color;
                    
                    // Animação de Swing (Inclinação do corpo)
                    let tilt = 0;
                    if(ent.type === 'player' && this.player.swing === 1) tilt = -0.2; // Preparando
                    if(ent.type === 'player' && this.player.swing === 2) tilt = 0.3; // Batendo

                    ctx.save();
                    ctx.translate(pos.x, pos.y - 60*scale);
                    ctx.rotate(tilt);
                    
                    // Tronco
                    ctx.fillRect(-15*scale, -30*scale, 30*scale, 60*scale);
                    // Cabeça
                    ctx.fillStyle = "#f1c40f"; // Pele
                    ctx.beginPath(); ctx.arc(0, -45*scale, 18*scale, 0, Math.PI*2); ctx.fill();
                    
                    // Raquete
                    ctx.strokeStyle = "#333"; ctx.lineWidth = 4*scale;
                    ctx.beginPath();
                    // Posição da raquete muda com swing
                    const rackX = (ent.type==='player') ? 25*scale : -25*scale; 
                    const rackY = (this.player.swing === 1) ? -50*scale : 0;
                    
                    ctx.moveTo(10*scale, -10*scale); ctx.lineTo(rackX, rackY); ctx.stroke();
                    // Cabeça da raquete
                    ctx.fillStyle = "rgba(255,0,0,0.3)"; ctx.strokeStyle="#cc0000";
                    ctx.beginPath(); ctx.arc(rackX, rackY, 20*scale, 0, Math.PI*2); 
                    ctx.fill(); ctx.stroke();

                    ctx.restore();
                }
            });

            // 5. HUD E FLASH
            if(this.flash > 0) {
                ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.2})`;
                ctx.fillRect(0,0,w,h);
                this.flash--;
            }

            // PLACAR (Estilo TV)
            ctx.fillStyle = "rgba(0,0,0,0.7)";
            ctx.roundRect(20, 20, 150, 80, 10); ctx.fill();
            ctx.fillStyle = "white"; ctx.font = "bold 20px Arial";
            ctx.fillText(`PLAYER: ${this.score[0]}`, 40, 50);
            ctx.fillText(`CPU:    ${this.score[1]}`, 40, 80);

            // GUIA DE ZONA (Calibração)
            // Se o jogador estiver muito na borda, avisa
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
                if(this.score[0] === 45) this.score[0] = 40; // Tênis score simplificado
                window.System.msg("PONTO SEU!");
                this.serveTurn = 'player';
            } else {
                this.score[1] += 15;
                if(this.score[1] === 45) this.score[1] = 40;
                window.System.msg("PONTO CPU!");
                this.serveTurn = 'enemy';
            }

            // Game Over Check
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
            window.System.registerGame('tennis', 'Wii Tennis Pro', '🎾', Logic, {camOpacity: 0.7, showWheel: false});
            clearInterval(regLoop);
        }
    }, 100);
})();
