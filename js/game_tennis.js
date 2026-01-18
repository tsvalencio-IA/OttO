// LÓGICA DO JOGO: OTTO PING PONG (LÓGICA CLÁSSICA + VISUAL WII + CORREÇÃO DE ALCANCE)
(function() {
    // CONSTANTES DE CALIBRAGEM
    const TABLE_W = 500; // Largura da mesa virtual
    const SENSITIVITY = 2.5; // FATOR DE GANHO (Isso corrige o alcance esquerdo/direito)
    
    const Logic = {
        score: 0,
        // Lógica Clássica: Bola começa longe (Z=1200) e vem para a tela (Z=0)
        ball: { x:0, y:0, z:1200, vx:0, vy:0, vz:0 },
        racket: { x:0, y:0 },
        state: 'serve', 
        flash: 0,

        init: function() { 
            this.score = 0; 
            this.state = 'serve';
            this.resetBall();
            window.System.msg("SAQUE!"); 
        },

        resetBall: function() {
            // RESTAURAÇÃO DA FÍSICA CLÁSSICA (User Legacy Code)
            this.ball = { 
                x: 0, 
                y: -150, // Começa alto
                z: 1200, // Começa longe
                vx: (Math.random() - 0.5) * 12, 
                vy: 3,   // Gravidade inicial
                vz: -20 - (this.score * 1.5) // Velocidade aumenta com pontos
            };
        },

        update: function(ctx, w, h, pose) {
            const cx = w / 2; 
            const cy = h / 2;

            // --- 1. VISUALIZAÇÃO DO ESQUELETO (PRIMEIRA CAMADA) ---
            // Desenha o fundo escuro para destacar a mesa
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, '#222'); grad.addColorStop(1, '#111');
            ctx.fillStyle = grad; ctx.fillRect(0,0,w,h);

            // Desenha o esqueleto VERDE (Igual ao Boxe) para feedback preciso
            if(window.Gfx && window.Gfx.drawSkeleton && pose) {
                ctx.save();
                ctx.globalAlpha = 0.5; 
                ctx.strokeStyle = '#00ff00';
                ctx.lineWidth = 4;
                window.Gfx.drawSkeleton(ctx, pose, w, h);
                ctx.restore();
            }

            // --- 2. INPUT DA RAQUETE (CORREÇÃO DE ALCANCE) ---
            let hand = null;
            if(pose) {
                const rw = pose.keypoints.find(k => k.name === 'right_wrist');
                const lw = pose.keypoints.find(k => k.name === 'left_wrist');
                // Pega a mão com melhor confiança
                if(rw && rw.score > 0.4) hand = rw;
                else if(lw && lw.score > 0.4) hand = lw;
            }

            if(hand) {
                // Mapeia coordenadas da tela (0..Width)
                const rawPos = window.Gfx.map(hand, w, h);
                
                // CONVERSÃO E AMPLIFICAÇÃO (CORREÇÃO DE ALCANCE)
                // 1. Centraliza o input (0 é o meio da tela)
                const dx = rawPos.x - cx;
                const dy = rawPos.y - cy;
                
                // 2. Multiplica pela sensibilidade (2.5x)
                // Isso faz com que mover a mão 10cm mova a raquete 25cm
                let targetX = dx * SENSITIVITY;
                let targetY = dy * SENSITIVITY;

                // 3. Aplica à raquete com suavização leve (0.7)
                // Usamos coordenada relativa ao centro (0,0 é o meio da mesa)
                this.racket.x += (targetX - this.racket.x) * 0.7;
                this.racket.y += (targetY - this.racket.y) * 0.7;

                // 4. Trava nas bordas da mesa (Clamp)
                this.racket.x = Math.max(-TABLE_W/2 - 50, Math.min(TABLE_W/2 + 50, this.racket.x));
            }

            // --- 3. LÓGICA DE FLUXO (CLASSIC ARCADE) ---
            if(this.state === 'serve') {
                this.ball.z -= 15; // Bola se aproxima
                if(this.ball.z < 1000) this.state = 'play';
            }
            else {
                // FÍSICA CLÁSSICA
                this.ball.x += this.ball.vx;
                this.ball.y += this.ball.vy;
                this.ball.z += this.ball.vz;

                // Gravidade (Y cresce = cai)
                if(this.ball.y < 200) this.ball.vy += 0.3;

                // COLISÃO COM JOGADOR (Z próximo de 0)
                // Aumentei a "zona de rebatida" (Z entre 150 e -50) para garantir que não falhe
                if(this.ball.z < 150 && this.ball.z > -50 && this.ball.vz < 0) {
                    
                    // Onde a bola está visualmente na tela?
                    const scale = 500 / (this.ball.z + 500);
                    // Como racket.x é relativo ao centro, ajustamos a bola para comparar
                    const ballRelX = this.ball.x * scale;
                    const ballRelY = (this.ball.y * scale) + 50; 

                    // Distância visual entre Bola e Raquete
                    const dist = Math.hypot(ballRelX - this.racket.x, ballRelY - this.racket.y);

                    // HITBOX (Generosa: 15% da largura da tela)
                    if(dist < w * 0.15) {
                        window.Sfx.hit();
                        this.score++;
                        this.flash = 4;

                        // REBATIDA
                        this.ball.vz = Math.abs(this.ball.vz) + 3; // Devolve mais rápido
                        this.ball.vy = -12; // Joga pra cima
                        
                        // Efeito de Spin (Onde bateu na raquete define o ângulo)
                        this.ball.vx = (ballRelX - this.racket.x) * 0.4;
                        
                        window.System.msg("BATEU! " + this.score);
                    }
                }

                // CPU REBATE (Lá no fundo)
                if(this.ball.z > 1500 && this.ball.vz > 0) {
                    window.Sfx.click(); 
                    this.ball.vz = -20 - (this.score * 0.8); // CPU devolve
                    this.ball.vx = (Math.random() - 0.5) * 20; // Mira aleatória
                    this.ball.vy = -6;
                }

                // GAME OVER (Passou do jogador)
                if(this.ball.z < -300) {
                    window.System.gameOver(this.score);
                }
            }

            // --- 4. RENDERIZAÇÃO (VISUAL WII/MESA AZUL) ---
            
            // Função de Perspectiva 3D
            const project = (x, y, z) => {
                const scale = 500 / (500 + z);
                return {
                    x: cx + (x * scale),
                    y: cy + ((y + 100) * scale), // +100 ajusta altura da câmera
                    s: scale
                };
            };

            // MESA DE PING PONG (Trapézio)
            const pTL = project(-TABLE_W/2, 0, 1500); // Top Left (Fundo)
            const pTR = project(TABLE_W/2, 0, 1500);  // Top Right
            const pBL = project(-TABLE_W/2, 0, 0);    // Bot Left (Frente/Tela)
            const pBR = project(TABLE_W/2, 0, 0);     // Bot Right

            // Tampo Azul
            ctx.beginPath();
            ctx.fillStyle = '#2980b9';
            ctx.moveTo(pTL.x, pTL.y); ctx.lineTo(pTR.x, pTR.y);
            ctx.lineTo(pBR.x, pBR.y); ctx.lineTo(pBL.x, pBL.y);
            ctx.fill();

            // Bordas Brancas
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(pTL.x, pTL.y); ctx.lineTo(pBL.x, pBL.y);
            ctx.moveTo(pTR.x, pTR.y); ctx.lineTo(pBR.x, pBR.y);
            ctx.moveTo(pTL.x, pTL.y); ctx.lineTo(pTR.x, pTR.y);
            ctx.moveTo(pBL.x, pBL.y); ctx.lineTo(pBR.x, pBR.y);
            // Linha Central
            const midTop = project(0,0,1500); const midBot = project(0,0,0);
            ctx.moveTo(midTop.x, midTop.y); ctx.lineTo(midBot.x, midBot.y);
            ctx.stroke();

            // Rede (No meio, Z=750 aprox na logica visual)
            const netY = pTL.y + (pBL.y - pTL.y) * 0.5; // Meio visual
            const netW = (pBR.x - pBL.x) * 0.7; // Largura aproximada
            ctx.fillStyle='rgba(255,255,255,0.4)';
            ctx.fillRect(cx - netW/2, netY-20, netW, 20);

            // BOLA (RENDERIZADA COM ESCALA)
            const ballPos = project(this.ball.x, this.ball.y, this.ball.z);
            if(ballPos.s > 0) {
                const size = 15 * ballPos.s;
                
                // Sombra da Bola (Projetada no "chão/mesa")
                // Assumimos que a mesa está em Y=0 na física visual, mas bola voa em Y negativo?
                // Na lógica clássica Y negativo é "alto". Vamos desenhar a sombra fixa na mesa.
                const shadowPos = project(this.ball.x, 150, this.ball.z); // 150 é "chão" na lógica clássica
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.beginPath(); ctx.ellipse(shadowPos.x, shadowPos.y, size, size*0.4, 0, 0, Math.PI*2); ctx.fill();

                // Corpo da Bola
                ctx.fillStyle = '#fff';
                ctx.beginPath(); ctx.arc(ballPos.x, ballPos.y, size, 0, Math.PI*2); ctx.fill();
                // Sombra interna
                ctx.strokeStyle = '#ccc'; ctx.lineWidth=1; ctx.stroke();
            }

            // RAQUETE DO JOGADOR (Overlay 2D na frente da mesa)
            // racket.x/y já estão convertidos e amplificados
            const rX = cx + this.racket.x;
            const rY = cy + this.racket.y;
            const rSize = w * 0.08;

            // Cabo
            ctx.fillStyle = '#d35400';
            ctx.fillRect(rX-10, rY, 20, rSize*1.6);
            
            // Borracha Vermelha
            ctx.fillStyle = '#c0392b'; 
            ctx.beginPath(); ctx.arc(rX, rY, rSize, 0, Math.PI*2); ctx.fill();
            // Borda
            ctx.strokeStyle = '#f39c12'; ctx.lineWidth = 3; ctx.stroke();
            
            // Ponto de Mira (Branco)
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(rX, rY, 4, 0, Math.PI*2); ctx.fill();

            // Efeito Flash
            if(this.flash > 0) {
                ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.2})`;
                ctx.fillRect(0,0,w,h);
                this.flash--;
            }

            // HUD
            ctx.fillStyle = "white"; ctx.font = "bold 30px Arial"; ctx.textAlign = "left";
            ctx.fillText("SCORE: " + this.score, 20, 50);

            return this.score;
        }
    };

    // REGISTRO
    const regLoop = setInterval(() => {
        if(window.System && window.System.registerGame) {
            window.System.registerGame('tennis', 'Otto PingPong', '🏓', Logic, {camOpacity: 0.5, showWheel: false});
            clearInterval(regLoop);
        }
    }, 100);
})();
