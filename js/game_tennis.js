// LÓGICA DO JOGO: OTTO TABLE TENNIS (FUSÃO DEFINITIVA: ARCADE + WII + BOXE SKELETON)
(function() {
    const Logic = {
        score: 0,
        // Bola: usa a lógica do código antigo (Z vai de 1200 até 0)
        ball: { x:0, y:0, z:1200, vx:0, vy:0, vz:0 },
        // Raquete do jogador
        racket: { x:0, y:0 },
        // Estado
        state: 'serve',
        flash: 0,

        // CONFIGURAÇÃO CIRÚRGICA DE ALCANCE
        // Sensitivity: 2.5x (Moveu 1cm a mão, move 2.5cm a raquete)
        // Isso resolve o problema de não alcançar os cantos.
        sensitivity: 2.5, 

        init: function() { 
            this.score = 0; 
            this.state = 'serve';
            this.resetBall();
            window.System.msg("PING PONG!"); 
        },

        resetBall: function() {
            // Lógica Clássica Arcade (A que você gostou)
            this.ball = { 
                x: 0, // Centro
                y: -200, // Altura inicial (Acima da mesa)
                z: 1200, // Longe (Fundo da mesa)
                vx: (Math.random() - 0.5) * 15, // Efeito lateral
                vy: 4, // Gravidade inicial
                vz: -25 - (this.score * 1.2) // Velocidade progressiva
            };
        },

        update: function(ctx, w, h, pose) {
            const cx = w / 2; 
            const cy = h / 2;

            // --- 1. VISUALIZAÇÃO DO ESQUELETO (PADRÃO BOXE) ---
            // Desenhado ANTES de tudo para ficar no fundo ou DEPOIS para ficar na frente?
            // No Boxe é desenhado primeiro. Vamos manter o padrão.
            // Limpa tela
            ctx.fillStyle = '#111'; ctx.fillRect(0,0,w,h);
            
            if(window.Gfx && window.Gfx.drawSkeleton && pose) {
                ctx.save();
                // Aumenta visibilidade do esqueleto
                ctx.globalAlpha = 0.6; 
                ctx.lineWidth = 4;
                window.Gfx.drawSkeleton(ctx, pose, w, h);
                ctx.restore();
            }

            // --- 2. INPUT DE PRECISÃO CIRÚRGICA ---
            let hand = null;
            if(pose) {
                const rw = pose.keypoints.find(k => k.name === 'right_wrist');
                const lw = pose.keypoints.find(k => k.name === 'left_wrist');
                // Pega a mão com maior confiança
                if(rw && rw.score > 0.3) hand = rw;
                else if(lw && lw.score > 0.3) hand = lw;
            }

            if(hand) {
                // Mapeamento cru
                const rawPos = window.Gfx.map(hand, w, h);
                
                // APLICAÇÃO DO GANHO (REACH)
                // Calcula a distância do centro da tela
                const dx = rawPos.x - cx;
                const dy = rawPos.y - cy;
                
                // Multiplica essa distância pela sensibilidade
                // Isso expande seu alcance
                let targetX = cx + (dx * this.sensitivity);
                let targetY = cy + (dy * this.sensitivity);
                
                // Trava nas bordas da tela (Clamp) para não perder a raquete
                targetX = Math.max(0, Math.min(w, targetX));
                targetY = Math.max(0, Math.min(h, targetY));

                // Suavização Mínima (0.8) para manter a precisão "Cirúrgica"
                // Se for muito baixo (0.1), fica lento (lag). Se for 1.0, treme muito.
                this.racket.x += (targetX - this.racket.x) * 0.8;
                this.racket.y += (targetY - this.racket.y) * 0.8;
            }

            // --- 3. DESENHO DO CENÁRIO (MESA DE PING PONG AZUL) ---
            // Aqui substituímos o "Chão Verde" antigo pela "Mesa Azul"
            const horizon = h * 0.35; // Altura do horizonte
            
            // Desenha a Mesa (Trapézio)
            const topW = w * 0.25; // Largura fundo
            const botW = w * 0.9;  // Largura frente
            
            // Tampo da Mesa
            ctx.beginPath();
            ctx.fillStyle = '#2980b9'; // Azul Profissional
            ctx.moveTo(cx - topW, horizon); ctx.lineTo(cx + topW, horizon);
            ctx.lineTo(cx + botW, h);       ctx.lineTo(cx - botW, h);
            ctx.fill();

            // Bordas e Linhas
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
            ctx.beginPath();
            // Contorno
            ctx.moveTo(cx - topW, horizon); ctx.lineTo(cx - botW, h);
            ctx.moveTo(cx + topW, horizon); ctx.lineTo(cx + botW, h);
            ctx.moveTo(cx - topW, horizon); ctx.lineTo(cx + topW, horizon);
            ctx.moveTo(cx - botW, h); ctx.lineTo(cx + botW, h);
            // Linha Central
            ctx.moveTo(cx, horizon); ctx.lineTo(cx, h);
            ctx.stroke();

            // Rede
            const netY = horizon + (h - horizon) * 0.3; // Posição
            const netW = w * 0.45; // Largura da rede nessa profundidade
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fillRect(cx - netW/2, netY - 20, netW, 20);
            ctx.fillStyle = '#eee'; ctx.fillRect(cx - netW/2, netY - 20, netW, 3); // Topo Branco

            // --- 4. LÓGICA DE JOGO (ORIGINAL RESTAURADA) ---
            if(this.state === 'serve') {
                this.ball.z -= 15; // Aproxima
                if(this.ball.z < 1000) this.state = 'play';
            }
            else {
                // Física Arcade
                this.ball.x += this.ball.vx;
                this.ball.y += this.ball.vy;
                this.ball.z += this.ball.vz;

                // Gravidade
                if(this.ball.y < 200) this.ball.vy += 0.3; // Gravidade um pouco mais forte para mesa

                // COLISÃO COM JOGADOR
                // A mágica: Z < 100 (Perto da tela)
                if(this.ball.z < 100 && this.ball.z > 0 && this.ball.vz < 0) {
                    // Projeção 2D da bola
                    const scale = 500 / (this.ball.z + 500);
                    const bSx = cx + (this.ball.x * scale);
                    const bSy = cy + (this.ball.y * scale) + 50; // Ajuste visual de altura

                    // Distância Bola <-> Raquete
                    const dist = Math.hypot(bSx - this.racket.x, bSy - this.racket.y);
                    
                    // Hitbox Precisa (w * 0.12 é o tamanho da raquete aprox)
                    if(dist < w * 0.12) {
                        window.Sfx.hit();
                        this.score++;
                        this.flash = 5;

                        // Rebate
                        this.ball.vz = Math.abs(this.ball.vz) + 2; // Acelera
                        this.ball.vy = -10; // Sobe
                        // Direção baseada no ponto de impacto (Spin)
                        this.ball.vx = (bSx - this.racket.x) * 0.5;
                        
                        window.System.msg("BATEU! " + this.score);
                    }
                }

                // COLISÃO FUNDO (CPU)
                if(this.ball.z > 1500 && this.ball.vz > 0) {
                    window.Sfx.click(); 
                    this.ball.vz = -20 - (this.score * 0.8);
                    this.ball.vx = (Math.random() - 0.5) * 20;
                    this.ball.vy = -8;
                }

                // GAME OVER
                if(this.ball.z < -200) {
                    window.System.gameOver(this.score);
                }
            }

            // --- 5. RENDERIZAÇÃO OBJETOS ---
            
            // Flash
            if(this.flash > 0) {
                ctx.fillStyle = `rgba(255,255,255,${this.flash*0.2})`; ctx.fillRect(0,0,w,h); this.flash--;
            }

            // Desenha Bola
            const scale = 500 / (this.ball.z + 500);
            if(scale > 0) {
                const bx = cx + (this.ball.x * scale);
                const by = cy + (this.ball.y * scale) + 50;
                const size = (w * 0.05) * scale; // Bola menor (Ping Pong)

                // Sombra da Bola na Mesa
                const sY = cy + (180 * scale) + 50; // Altura do chão da mesa
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.beginPath(); ctx.ellipse(bx, sY, size, size*0.4, 0, 0, Math.PI*2); ctx.fill();

                // Bola Branca
                ctx.fillStyle = '#fff';
                ctx.beginPath(); ctx.arc(bx, by, size, 0, Math.PI*2); ctx.fill();
                // Detalhe sombra interna
                ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1; ctx.stroke();
            }

            // Desenha Raquete (Estilo Ping Pong)
            const rSize = w * 0.08; // Raquete menor que a de Tênis
            
            // Cabo
            ctx.fillStyle = '#d35400'; // Madeira
            ctx.fillRect(this.racket.x - 10, this.racket.y, 20, rSize * 1.5);
            
            // Borracha
            ctx.fillStyle = '#c0392b'; // Vermelha
            ctx.beginPath(); ctx.arc(this.racket.x, this.racket.y, rSize, 0, Math.PI*2); ctx.fill();
            // Borda
            ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 3; ctx.stroke();
            
            // Feedback Visual de Mira (Ponto central da raquete)
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(this.racket.x, this.racket.y, 3, 0, Math.PI*2); ctx.fill();

            return this.score;
        }
    };

    // REGISTRO NO SISTEMA
    const regLoop = setInterval(() => {
        if(window.System && window.System.registerGame) {
            window.System.registerGame('tennis', 'Otto PingPong', '🏓', Logic, {camOpacity: 0.4, showWheel: false});
            clearInterval(regLoop);
        }
    }, 100);
})();
