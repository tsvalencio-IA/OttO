// =============================================================================
// OTTO PING PONG - REALISTIC 3D PERSPECTIVE (WII STYLE)
// Baseado nas referências visuais: Mesa com profundidade + Esqueleto Visível
// =============================================================================

(function() {
    // Configurações Físicas
    const TABLE_WIDTH = 500;
    const TABLE_DEPTH = 800;
    const TABLE_Y = 0; // Altura da mesa no mundo 3D
    const NET_Z = 0;
    const PLAYER_Z = 450;
    const CPU_Z = -450;
    const GRAVITY = 0.45;
    
    const Logic = {
        score: [0, 0],
        state: 'menu', // serve, play, point_end
        
        // Bola (X, Y, Z) - Y é altura (pra cima é positivo)
        ball: { x:0, y:50, z:0, vx:0, vy:0, vz:0 },
        
        // Raquetes
        player: { x:0, y:30, width:60 },
        cpu:    { x:0, y:30, width:60, speed:6, targetX:0 },
        
        // Input
        lastHand: {x:0, y:0},
        swingSpeed: 0,
        
        // Efeitos
        flash: 0,

        init: function() { 
            this.score = [0, 0]; 
            this.state = 'serve';
            window.System.msg("PING PONG!"); 
            this.resetBall('player');
        },

        resetBall: function(server) {
            this.ball.vx = 0; this.ball.vy = 0; this.ball.vz = 0;
            
            if(server === 'player') {
                this.state = 'serve';
                this.ball.x = this.player.x;
                this.ball.y = 60; // um pouco acima da mesa
                this.ball.z = PLAYER_Z - 20;
            } else {
                this.state = 'play';
                this.ball.x = this.cpu.x;
                this.ball.y = 60;
                this.ball.z = CPU_Z + 20;
                // Saque CPU
                this.ball.vz = 18; // Vem na direção do player
                this.ball.vy = 8;  // Arco leve
                this.ball.vx = (Math.random()-0.5) * 10;
                window.System.msg("DEFENDA!");
            }
        },

        update: function(ctx, w, h, pose) {
            const cx = w / 2;
            const cy = h / 2 - 50; // Horizonte (Ponto de fuga)

            // --- 1. PROJEÇÃO 3D (A Mágica da Perspectiva) ---
            // Transforma coordenadas do mundo (x,y,z) em tela (px,py)
            const project = (x, y, z) => {
                const fov = 400; // Campo de visão
                const scale = fov / (fov + (z + 600)); // +600 afasta a câmera
                return {
                    x: cx + (x * scale),
                    y: cy - (y * scale) + 100, // +100 abaixa a câmera para ver a mesa de cima
                    s: scale
                };
            };

            // --- 2. INPUT & ESQUELETO (PADRÃO BOXE) ---
            let handDetected = false;

            // Fundo Escuro (Estilo Arena das Imagens)
            const hor = project(0, 0, 10000).y;
            const grad = ctx.createLinearGradient(0, 0, 0, hor);
            grad.addColorStop(0, '#111'); grad.addColorStop(1, '#333');
            ctx.fillStyle = grad; ctx.fillRect(0,0,w,hor); // Parede fundo
            ctx.fillStyle = '#222'; ctx.fillRect(0,hor,w,h); // Chão

            // DESENHA ESQUELETO (CRUCIAL PARA O USUÁRIO)
            if(window.Gfx && window.Gfx.drawSkeleton && pose) {
                ctx.save();
                ctx.globalAlpha = 0.5; // Transparente para não tapar a mesa
                ctx.lineWidth = 3;
                window.Gfx.drawSkeleton(ctx, pose, w, h);
                ctx.restore();
            }

            if(pose) {
                const rW = pose.keypoints.find(k=>k.name==='right_wrist');
                const lW = pose.keypoints.find(k=>k.name==='left_wrist');
                const hand = (rW && rW.score>0.3) ? rW : (lW && lW.score>0.3 ? lW : null);

                if(hand) {
                    handDetected = true;
                    // Mapeia a mão 1:1 na tela
                    const mapped = window.Gfx.map(hand, w, h);
                    
                    // Converte posição da tela 2D para posição da raquete no mundo 3D
                    // Invertemos a lógica da projeção para achar o X
                    const scaleAtPlayer = 400 / (400 + (PLAYER_Z + 600));
                    const worldX = (mapped.x - cx) / scaleAtPlayer;
                    const worldY = (cy + 100 - mapped.y) / scaleAtPlayer;

                    // Move Raquete
                    this.player.x += (worldX - this.player.x) * 0.5;
                    this.player.y = Math.max(10, worldY); // Não deixa atravessar a mesa

                    // Calcula velocidade do golpe (Swing)
                    const dist = Math.hypot(this.player.x - this.lastHand.x, this.player.y - this.lastHand.y);
                    this.swingSpeed = dist;
                    this.lastHand = {x:this.player.x, y:this.player.y};

                    // Gesto de Saque
                    if(this.state === 'serve' && this.swingSpeed > 15) {
                        window.Sfx.hit();
                        this.state = 'play';
                        this.ball.vz = -22; // Vai pro fundo
                        this.ball.vy = 8;
                        this.ball.vx = (this.player.x * -0.1); // Ângulo
                    }
                }
            }
            // Limita raquete na mesa
            this.player.x = Math.max(-TABLE_WIDTH/2, Math.min(TABLE_WIDTH/2, this.player.x));


            // --- 3. FÍSICA DA BOLA ---
            if(this.state === 'serve') {
                this.ball.x = this.player.x;
                this.ball.y = 50 + Math.sin(Date.now()/200)*10;
                this.ball.z = PLAYER_Z - 10;
            }
            else if (this.state === 'play') {
                this.ball.x += this.ball.vx;
                this.ball.y += this.ball.vy;
                this.ball.z += this.ball.vz;
                this.ball.vy -= GRAVITY;

                // Quique na Mesa
                if(this.ball.y < 0) {
                    // Verifica se caiu dentro da mesa
                    if(Math.abs(this.ball.x) <= TABLE_WIDTH/2 && Math.abs(this.ball.z) <= TABLE_DEPTH/2) {
                        this.ball.y = 0;
                        this.ball.vy = Math.abs(this.ball.vy) * 0.8; // Perde energia
                        window.Sfx.click();
                    } else if (this.ball.y < -200) {
                        // Caiu fora (Chão)
                        if(this.ball.z > 0) { this.score[1]++; this.resetBall('cpu'); window.Sfx.crash(); } // Erro Player
                        else { this.score[0]++; this.resetBall('player'); window.Sfx.coin(); } // Erro CPU
                    }
                }

                // Rede
                if(Math.abs(this.ball.z) < 10 && this.ball.y < 25) {
                    this.ball.vz *= -0.5; // Bate e volta/cai
                    this.ball.z = (this.ball.z > 0) ? 15 : -15;
                }

                // Colisão Player
                if(this.ball.vz > 0 && Math.abs(this.ball.z - PLAYER_Z) < 40) {
                    // Hitbox circular
                    const dist = Math.hypot(this.ball.x - this.player.x, this.ball.y - this.player.y);
                    if(dist < 50) {
                        window.Sfx.hit();
                        this.flash = 3;
                        // Física de Rebatida
                        this.ball.vz = -25 - (this.swingSpeed * 0.5); // Força
                        this.ball.vy = 8 + (this.player.y * 0.1); // Lift
                        // Efeito lateral (Spin)
                        this.ball.vx = (this.ball.x - this.player.x) * 0.3;
                    }
                }

                // Colisão CPU
                if(this.ball.vz < 0) {
                    // IA segue a bola
                    const diff = this.ball.x - this.cpu.x;
                    this.cpu.x += Math.sign(diff) * Math.min(Math.abs(diff), this.cpu.speed);
                    
                    if(Math.abs(this.ball.z - CPU_Z) < 40 && Math.abs(this.ball.x - this.cpu.x) < 50) {
                        window.Sfx.hit();
                        this.ball.vz = 20 + (Math.random()*5);
                        this.ball.vy = 8;
                        const aim = (this.player.x > 0) ? -100 : 100;
                        this.ball.vx = (aim - this.ball.x) * 0.05;
                    }
                }
            }

            // --- 4. RENDERIZAÇÃO DA MESA E OBJETOS ---

            // Mesa (Trapézio 3D)
            const pTL = project(-TABLE_WIDTH/2, 0, -TABLE_DEPTH/2);
            const pTR = project(TABLE_WIDTH/2, 0, -TABLE_DEPTH/2);
            const pBL = project(-TABLE_WIDTH/2, 0, TABLE_DEPTH/2);
            const pBR = project(TABLE_WIDTH/2, 0, TABLE_DEPTH/2);

            // Tampo da Mesa (Azul Profissional igual imagem)
            ctx.fillStyle = '#2980b9'; // Azul
            ctx.beginPath(); ctx.moveTo(pTL.x, pTL.y); ctx.lineTo(pTR.x, pTR.y);
            ctx.lineTo(pBR.x, pBR.y); ctx.lineTo(pBL.x, pBL.y); ctx.fill();

            // Bordas Brancas
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
            ctx.beginPath(); 
            ctx.moveTo(pTL.x, pTL.y); ctx.lineTo(pBL.x, pBL.y);
            ctx.moveTo(pTR.x, pTR.y); ctx.lineTo(pBR.x, pBR.y);
            ctx.moveTo(pTL.x, pTL.y); ctx.lineTo(pTR.x, pTR.y);
            ctx.moveTo(pBL.x, pBL.y); ctx.lineTo(pBR.x, pBR.y);
            // Linha Central
            const midTop = project(0, 0, -TABLE_DEPTH/2);
            const midBot = project(0, 0, TABLE_DEPTH/2);
            ctx.moveTo(midTop.x, midTop.y); ctx.lineTo(midBot.x, midBot.y);
            ctx.stroke();

            // Rede
            ctx.fillStyle = 'rgba(200,200,200,0.5)';
            const netL = project(-TABLE_WIDTH/2-20, 25, 0); const netR = project(TABLE_WIDTH/2+20, 25, 0);
            const netBL = project(-TABLE_WIDTH/2-20, 0, 0); const netBR = project(TABLE_WIDTH/2+20, 0, 0);
            ctx.beginPath(); ctx.moveTo(netL.x, netL.y); ctx.lineTo(netR.x, netR.y);
            ctx.lineTo(netBR.x, netBR.y); ctx.lineTo(netBL.x, netBL.y); ctx.fill();
            ctx.fillStyle='#fff'; ctx.fillRect(netL.x, netL.y, netR.x-netL.x, 2); // Topo

            // Objetos (Sort Z)
            const objs = [
                {t:'ball', ...this.ball},
                {t:'player', ...this.player, z:PLAYER_Z},
                {t:'cpu', ...this.cpu, z:CPU_Z}
            ];
            objs.sort((a,b) => a.z - b.z);

            objs.forEach(o => {
                const pos = project(o.x, o.y, o.z);
                const shadow = project(o.x, 0, o.z);
                const s = pos.s;

                // Sombra
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.beginPath(); ctx.ellipse(shadow.x, shadow.y, 15*s, 6*s, 0, 0, Math.PI*2); ctx.fill();

                if(o.t === 'ball') {
                    const bSz = 8 * s;
                    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(pos.x, pos.y, bSz, 0, Math.PI*2); ctx.fill();
                } else {
                    // Raquete (Círculo Vermelho/Azul)
                    const rSz = 25 * s;
                    ctx.fillStyle = o.t==='player' ? '#e74c3c' : '#3498db'; // Vermelho ou Azul
                    
                    // Cabo da raquete
                    ctx.fillStyle = '#d35400';
                    const handleY = o.t==='player' ? 20*s : -20*s;
                    ctx.fillRect(pos.x - 5*s, pos.y + handleY, 10*s, 20*s);

                    // Borracha
                    ctx.fillStyle = o.t==='player' ? '#c0392b' : '#2980b9';
                    ctx.beginPath(); ctx.arc(pos.x, pos.y, rSz, 0, Math.PI*2); ctx.fill();
                    
                    // Brilho
                    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth=2;
                    ctx.beginPath(); ctx.arc(pos.x, pos.y, rSz-2, 0, Math.PI*2); ctx.stroke();
                }
            });

            // Placar na Parede
            if(this.flash > 0) {
                ctx.fillStyle = `rgba(255,255,255,${this.flash*0.2})`; ctx.fillRect(0,0,w,h); this.flash--;
            }
            
            // HUD Placar (Estilo Imagem 2)
            ctx.fillStyle = 'white'; ctx.font = "bold 40px Arial";
            ctx.fillText(this.score[1], cx, hor - 50); // CPU
            ctx.fillText(this.score[0], cx, h - 50); // Player

            // Bandeiras/Nomes
            ctx.font = "14px Arial"; ctx.textAlign="center";
            ctx.fillText("CPU", cx, hor - 20);
            ctx.fillText("VOCÊ", cx, h - 20);

            return this.score[0];
        }
    };

    // REGISTRO NO SISTEMA
    const regLoop = setInterval(() => {
        if(window.System && window.System.registerGame) {
            window.System.registerGame('tennis', 'Otto PingPong', '🏓', Logic, {camOpacity: 0.2, showWheel: false});
            clearInterval(regLoop);
        }
    }, 100);
})();
