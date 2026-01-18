// LÓGICA DO JOGO: OTTO PING PONG (SMART TRACKING ENGINE)
(function() {
    // CALIBRAGEM FÍSICA
    const TABLE_W = 550; // Largura da mesa
    const SENSITIVITY_BASE = 2.0; // Sensibilidade base
    const REACH_BOOST = 1.5; // Impulso extra para cantos
    
    const Logic = {
        score: 0,
        // Lógica Arcade Clássica (Z: 1200 -> 0)
        ball: { x:0, y:0, z:1200, vx:0, vy:0, vz:0 },
        
        // Raquete com física inteligente
        racket: { x:0, y:0, vx:0, vy:0 },
        
        // Variáveis de Input Inteligente
        handRaw: { x:0, y:0 },
        handCenter: { x:null, y:null }, // Auto-calibração do centro
        
        state: 'serve', 
        flash: 0,

        init: function() { 
            this.score = 0; 
            this.state = 'serve';
            this.handCenter = { x:null, y:null }; // Reseta calibração
            this.resetBall();
            window.System.msg("CENTRALIZAR MÃO..."); 
        },

        resetBall: function() {
            this.ball = { 
                x: 0, 
                y: -180, 
                z: 1200, 
                vx: (Math.random() - 0.5) * 14, 
                vy: 4,   
                vz: -22 - (this.score * 1.5) 
            };
        },

        update: function(ctx, w, h, pose) {
            const cx = w / 2; 
            const cy = h / 2;

            // --- 1. RENDERIZAÇÃO DO AMBIENTE (VISUAL WII) ---
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, '#1a1a1a'); grad.addColorStop(1, '#000');
            ctx.fillStyle = grad; ctx.fillRect(0,0,w,h);

            // Esqueleto (Feedback Visual Essencial)
            if(window.Gfx && window.Gfx.drawSkeleton && pose) {
                ctx.save();
                ctx.globalAlpha = 0.4; 
                ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 4;
                window.Gfx.drawSkeleton(ctx, pose, w, h);
                ctx.restore();
            }

            // --- 2. INTELIGÊNCIA DE CAPTAÇÃO (SMART TRACKING) ---
            let hand = null;
            if(pose) {
                const rw = pose.keypoints.find(k => k.name === 'right_wrist');
                const lw = pose.keypoints.find(k => k.name === 'left_wrist');
                // Usa a mão com melhor leitura
                if(rw && rw.score > 0.4) hand = rw;
                else if(lw && lw.score > 0.4) hand = lw;
            }

            if(hand) {
                const rawPos = window.Gfx.map(hand, w, h);
                
                // AUTO-CALIBRAÇÃO DE CENTRO (Na primeira leitura)
                if(this.handCenter.x === null) {
                    this.handCenter = { x: rawPos.x, y: rawPos.y };
                    window.System.msg("CALIBRADO!");
                }

                // CÁLCULO DE DELTA (Distância do centro do corpo)
                // Usamos o centro calibrado, não o centro da tela, para mais conforto
                let dx = rawPos.x - this.handCenter.x;
                let dy = rawPos.y - this.handCenter.y;

                // CURVA EXPONENCIAL (A Mágica da "Inteligência")
                // Se dx for pequeno, sensitivity é normal. Se dx for grande, sensitivity aumenta.
                // Isso permite precisão no meio e alcance infinito nas bordas.
                const reachFactor = 1 + (Math.abs(dx) / (w*0.2)) * REACH_BOOST;
                
                let targetX = dx * SENSITIVITY_BASE * reachFactor;
                let targetY = dy * SENSITIVITY_BASE; // Y geralmente precisa de menos ganho

                // SUAVIZAÇÃO ADAPTATIVA (Smart Smoothing)
                // Se a mão move rápido, suavização diminui (0.9) para resposta instantânea.
                // Se a mão move devagar, suavização aumenta (0.4) para remover tremedeira.
                const distToTarget = Math.hypot(targetX - this.racket.x, targetY - this.racket.y);
                const smoothFactor = Math.min(0.9, 0.4 + (distToTarget / 200)); 

                this.racket.x += (targetX - this.racket.x) * smoothFactor;
                this.racket.y += (targetY - this.racket.y) * smoothFactor;
                
                // Trava física na mesa (Clamp)
                this.racket.x = Math.max(-TABLE_W/2 - 60, Math.min(TABLE_W/2 + 60, this.racket.x));
            }

            // --- 3. LÓGICA DE JOGO (ARCADE SIMPLIFICADO) ---
            if(this.state === 'serve') {
                this.ball.z -= 18;
                if(this.ball.z < 1000) this.state = 'play';
            }
            else {
                this.ball.x += this.ball.vx;
                this.ball.y += this.ball.vy;
                this.ball.z += this.ball.vz;

                // Gravidade "Wii Sports" (Bola pesada)
                if(this.ball.y < 200) this.ball.vy += 0.35;

                // COLISÃO JOGADOR (Z perto de 0)
                // Zona de rebatida expandida para evitar frustração
                if(this.ball.z < 180 && this.ball.z > -80 && this.ball.vz < 0) {
                    
                    // Projeção visual da bola
                    const scale = 500 / (this.ball.z + 500);
                    const ballScreenX = (this.ball.x * scale); // Relativo ao centro
                    const ballScreenY = (this.ball.y * scale) + 50; 

                    // Hitbox
                    const dist = Math.hypot(ballScreenX - this.racket.x, ballScreenY - this.racket.y);
                    
                    // IMÃ DE ACERTO (Aim Assist Sutil)
                    // Se passar "perto", o jogo conta como acerto para não frustrar
                    if(dist < w * 0.18) {
                        window.Sfx.hit();
                        this.score++;
                        this.flash = 4;

                        // Física de Rebatida
                        this.ball.vz = Math.abs(this.ball.vz) + 4; // Devolve MUITO rápido
                        this.ball.vy = -14; // Joga pra cima
                        
                        // Spin Direcional (Onde bateu na raquete?)
                        this.ball.vx = (ballScreenX - this.racket.x) * 0.6;
                        
                        window.System.msg("BATEU! " + this.score);
                    }
                }

                // CPU
                if(this.ball.z > 1500 && this.ball.vz > 0) {
                    window.Sfx.click(); 
                    this.ball.vz = -22 - (this.score * 1.0); 
                    this.ball.vx = (Math.random() - 0.5) * 25; 
                    this.ball.vy = -8;
                }

                // Game Over
                if(this.ball.z < -350) {
                    window.System.gameOver(this.score);
                }
            }

            // --- 4. RENDERIZAÇÃO (PERSPECTIVA 2.5D) ---
            const project = (x, y, z) => {
                const scale = 500 / (500 + z);
                return {
                    x: cx + (x * scale),
                    y: cy + ((y + 120) * scale),
                    s: scale
                };
            };

            // MESA DE PING PONG AZUL
            const pTL = project(-TABLE_W/2, 0, 1500); // Fundo Esq
            const pTR = project(TABLE_W/2, 0, 1500);  // Fundo Dir
            const pBL = project(-TABLE_W/2, 0, 0);    // Frente Esq
            const pBR = project(TABLE_W/2, 0, 0);     // Frente Dir

            // Tampo
            ctx.beginPath();
            ctx.fillStyle = '#2980b9'; // Azul WII
            ctx.moveTo(pTL.x, pTL.y); ctx.lineTo(pTR.x, pTR.y);
            ctx.lineTo(pBR.x, pBR.y); ctx.lineTo(pBL.x, pBL.y);
            ctx.fill();

            // Bordas e Linhas
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(pTL.x, pTL.y); ctx.lineTo(pBL.x, pBL.y);
            ctx.moveTo(pTR.x, pTR.y); ctx.lineTo(pBR.x, pBR.y);
            ctx.moveTo(pTL.x, pTL.y); ctx.lineTo(pTR.x, pTR.y);
            ctx.moveTo(pBL.x, pBL.y); ctx.lineTo(pBR.x, pBR.y);
            // Meio
            const pMidT = project(0,0,1500); const pMidB = project(0,0,0);
            ctx.moveTo(pMidT.x, pMidT.y); ctx.lineTo(pMidB.x, pMidB.y);
            ctx.stroke();

            // Rede
            const netY = pTL.y + (pBL.y - pTL.y) * 0.5;
            const netW = (pBR.x - pBL.x) * 0.7;
            ctx.fillStyle='rgba(255,255,255,0.3)';
            ctx.fillRect(cx - netW/2, netY-25, netW, 25);
            ctx.fillStyle='#fff'; ctx.fillRect(cx - netW/2, netY-25, netW, 3);

            // BOLA
            const ballPos = project(this.ball.x, this.ball.y, this.ball.z);
            if(ballPos.s > 0) {
                const bSize = 16 * ballPos.s;
                
                // Sombra (Fixa na mesa Y=150 da logica classica)
                const shadowPos = project(this.ball.x, 150, this.ball.z); 
                ctx.fillStyle = 'rgba(0,0,0,0.4)';
                ctx.beginPath(); ctx.ellipse(shadowPos.x, shadowPos.y, bSize, bSize*0.4, 0, 0, Math.PI*2); ctx.fill();

                // Bola
                ctx.fillStyle = '#fff';
                ctx.beginPath(); ctx.arc(ballPos.x, ballPos.y, bSize, 0, Math.PI*2); ctx.fill();
                // Detalhe 3D
                ctx.fillStyle = '#eee'; 
                ctx.beginPath(); ctx.arc(ballPos.x - bSize*0.2, ballPos.y - bSize*0.2, bSize*0.3, 0, Math.PI*2); ctx.fill();
            }

            // RAQUETE (Overlay 2D)
            const rX = cx + this.racket.x;
            const rY = cy + this.racket.y;
            const rSize = w * 0.10;

            // Cabo
            ctx.fillStyle = '#d35400';
            ctx.fillRect(rX - 12, rY, 24, rSize * 1.8);
            
            // Cabeça
            ctx.fillStyle = '#c0392b'; 
            ctx.beginPath(); ctx.arc(rX, rY, rSize, 0, Math.PI*2); ctx.fill();
            // Borda
            ctx.strokeStyle = '#f39c12'; ctx.lineWidth = 4; ctx.stroke();
            
            // Ponto Central (Mira)
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(rX, rY, 4, 0, Math.PI*2); ctx.fill();

            // Flash
            if(this.flash > 0) {
                ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.2})`; ctx.fillRect(0,0,w,h); this.flash--;
            }

            // HUD
            ctx.fillStyle = "white"; ctx.font = "bold 40px Arial"; ctx.textAlign = "left";
            ctx.fillText(this.score, 30, 60);

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
