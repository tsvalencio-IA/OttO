// LÓGICA DO JOGO: OTTO PING PONG (ARCADE CLASSIC + VISUAL WII)
(function() {
    const Logic = {
        score: 0,
        // Bola: X, Y, Z (Profundidade), Velocidades
        // Começa longe (Z=1200) e vem para perto (Z=0)
        ball: { x:0, y:0, z:1200, vx:0, vy:0, vz:0 },
        racket: { x:0, y:0 },
        state: 'serve', // serve, play
        flash: 0, // Efeito visual de impacto

        init: function() { 
            this.score = 0; 
            this.state = 'serve';
            this.resetBall();
            window.System.msg("SAQUE!"); 
        },

        resetBall: function() {
            // LÓGICA ANTIGA RESTAURADA: Bola surge no fundo
            this.ball = { 
                x: 0, 
                y: -150, // Altura inicial
                z: 1200, // Longe
                vx: (Math.random() - 0.5) * 10, // Efeito lateral
                vy: 2, 
                vz: -20 - (this.score * 1.5) // Fica mais rápido a cada ponto
            };
        },

        update: function(ctx, w, h, pose) {
            const cx = w / 2; 
            const cy = h / 2;

            // --- 1. VISUALIZAÇÃO DO ESQUELETO (CRUCIAL) ---
            // Desenha o esqueleto antes de tudo para feedback visual
            if(window.Gfx && window.Gfx.drawSkeleton && pose) {
                ctx.save();
                ctx.globalAlpha = 0.5; // Transparente
                ctx.lineWidth = 4;
                window.Gfx.drawSkeleton(ctx, pose, w, h);
                ctx.restore();
            }

            // --- 2. INPUT (RAQUETE) ---
            let hand = null;
            if(pose) {
                const rw = pose.keypoints.find(k => k.name === 'right_wrist');
                const lw = pose.keypoints.find(k => k.name === 'left_wrist');
                if(rw && rw.score > 0.3) hand = rw;
                else if(lw && lw.score > 0.3) hand = lw;
            }

            if(hand) {
                const pos = window.Gfx.map(hand, w, h);
                // Suavização para não tremer
                this.racket.x += (pos.x - this.racket.x) * 0.6;
                this.racket.y += (pos.y - this.racket.y) * 0.6;
            }

            // --- 3. LÓGICA DE JOGO (A QUE FUNCIONA) ---
            if(this.state === 'serve') {
                this.ball.z -= 15; // Aproxima para iniciar
                if(this.ball.z < 1000) this.state = 'play';
            }
            else {
                // Física Simples e Divertida
                this.ball.x += this.ball.vx;
                this.ball.y += this.ball.vy;
                this.ball.z += this.ball.vz;

                // Gravidade (Arco da bola)
                if(this.ball.y < 200) this.ball.vy += 0.25;

                // --- DETECÇÃO DE BATIDA (HIT) ---
                // A mágica acontece quando Z está perto de 0 (Tela)
                if(this.ball.z < 150 && this.ball.z > 0 && this.ball.vz < 0) {
                    
                    // Projeta onde a bola está na tela 2D
                    const scale = 500 / (this.ball.z + 500);
                    const ballScreenX = cx + (this.ball.x * scale);
                    const ballScreenY = cy + (this.ball.y * scale) + 50; // Ajuste de altura da mesa

                    // Distância Raquete <-> Bola
                    const dist = Math.hypot(ballScreenX - this.racket.x, ballScreenY - this.racket.y);

                    // HITBOX (Tolerância generosa para ser divertido)
                    if(dist < w * 0.18) {
                        window.Sfx.hit();
                        this.score++;
                        this.flash = 5; // Flash na tela

                        // REBATE A BOLA (Inverte Z)
                        this.ball.vz = Math.abs(this.ball.vz) + 3; // Volta mais rápida
                        this.ball.vy = -12; // Joga pra cima
                        
                        // Efeito Lateral (Baseado em onde bateu na raquete)
                        this.ball.vx = (ballScreenX - this.racket.x) * 0.4;
                        
                        window.System.msg("BATEU! " + this.score);
                    }
                }

                // --- CPU REBATE DE VOLTA (LOOP) ---
                if(this.ball.z > 1500 && this.ball.vz > 0) {
                    window.Sfx.click(); // Som de quique na mesa lá longe
                    // CPU devolve
                    this.ball.vz = -20 - (this.score * 0.8); // Vem rápido
                    this.ball.vx = (Math.random() - 0.5) * 20; // Mira aleatória
                    this.ball.vy = -6;
                }

                // --- GAME OVER (Passou do jogador) ---
                if(this.ball.z < -200) {
                    window.System.gameOver(this.score);
                }
            }

            // --- 4. RENDERIZAÇÃO (VISUAL PING PONG WII) ---
            
            // Efeito Flash
            if(this.flash > 0) {
                ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.2})`;
                ctx.fillRect(0,0,w,h);
                this.flash--;
            }

            // Fundo (Escuro Profissional)
            ctx.fillStyle = '#222'; ctx.fillRect(0, 0, w, h);
            
            // Horizonte
            const horizon = h * 0.35;
            
            // MESA DE PING PONG (Trapézio Azul)
            const topW = w * 0.25;  // Largura no fundo (longe)
            const botW = w * 0.85;  // Largura na frente (perto)
            
            ctx.beginPath();
            ctx.fillStyle = '#2980b9'; // Azul Mesa Oficial
            ctx.moveTo(cx - topW, horizon); 
            ctx.lineTo(cx + topW, horizon);
            ctx.lineTo(cx + botW, h);       
            ctx.lineTo(cx - botW, h);       
            ctx.fill();

            // Bordas Brancas da Mesa
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(cx - topW, horizon); ctx.lineTo(cx - botW, h); // Esq
            ctx.moveTo(cx + topW, horizon); ctx.lineTo(cx + botW, h); // Dir
            ctx.moveTo(cx - topW, horizon); ctx.lineTo(cx + topW, horizon); // Fundo
            ctx.moveTo(cx - botW, h); ctx.lineTo(cx + botW, h); // Frente
            // Linha Central
            ctx.moveTo(cx, horizon); ctx.lineTo(cx, h);
            ctx.stroke();

            // Rede (No meio da profundidade)
            const netY = horizon + (h - horizon) * 0.3; // Posição visual da rede
            const netW = w * 0.45; // Largura visual da rede
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.fillRect(cx - netW/2, netY - 20, netW, 20);
            ctx.fillStyle = '#eee'; ctx.fillRect(cx - netW/2, netY - 20, netW, 3); // Topo rede

            // BOLA
            const scale = 500 / (this.ball.z + 500);
            if(scale > 0) {
                const bx = cx + (this.ball.x * scale);
                const by = cy + (this.ball.y * scale) + 50; // Ajuste de altura
                const size = (w * 0.05) * scale;

                // Sombra da Bola (Dá noção de altura)
                const shadowY = cy + (180 * scale) + 50; // Chão da mesa
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.beginPath(); ctx.ellipse(bx, shadowY, size, size*0.3, 0, 0, Math.PI*2); ctx.fill();

                // Bola Branca
                ctx.fillStyle = '#fff';
                ctx.beginPath(); ctx.arc(bx, by, size, 0, Math.PI*2); ctx.fill();
                // Brilho
                ctx.fillStyle = '#eee'; 
                ctx.beginPath(); ctx.arc(bx - size*0.3, by - size*0.3, size*0.2, 0, Math.PI*2); ctx.fill();
            }

            // RAQUETE DO JOGADOR
            const rSize = w * 0.15;
            // Cabo
            ctx.strokeStyle = '#d35400'; ctx.lineWidth = 15; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(this.racket.x, this.racket.y); ctx.lineTo(this.racket.x, this.racket.y + rSize); ctx.stroke();
            
            // Borracha Vermelha
            ctx.fillStyle = '#c0392b'; 
            ctx.beginPath(); 
            ctx.arc(this.racket.x, this.racket.y, rSize/2, 0, Math.PI*2);
            ctx.fill(); 
            // Borda Madeira
            ctx.strokeStyle = '#f39c12'; ctx.lineWidth = 3; ctx.stroke();
            
            // Placar HUD
            ctx.fillStyle = "white"; ctx.font = "bold 30px Arial"; ctx.textAlign = "left";
            ctx.fillText("SCORE: " + this.score, 30, 50);

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
