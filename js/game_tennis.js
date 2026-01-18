// LÓGICA DO JOGO: OTTO TENNIS
(function() {
    const Logic = {
        score: 0,
        // Bola: X, Y (posição tela), Z (profundidade), VX/VY/VZ (velocidade)
        ball: { x:0, y:0, z:1200, vx:0, vy:0, vz:0 },
        racket: { x:0, y:0 },
        state: 'serve', // Estados: 'serve' (sacar), 'play' (jogando)

        init: function() { 
            this.score = 0; 
            this.state = 'serve';
            this.resetBall();
            window.System.msg("SAQUE!"); 
        },

        resetBall: function() {
            // Bola começa lá no fundo (Z=1200)
            this.ball = { 
                x: 0, // Centro
                y: -150, // Um pouco para cima (altura da rede)
                z: 1200, 
                vx: (Math.random() - 0.5) * 8, // Efeito lateral aleatório
                vy: 2, // Gravidade inicial
                vz: -15 - (this.score * 0.5) // Velocidade aumenta com os pontos
            };
        },

        update: function(ctx, w, h, pose) {
            const cx = w / 2; 
            const cy = h / 2;

            // 1. INPUT (DETECTAR MÃO/RAQUETE)
            // Tenta achar a mão direita, senão usa a esquerda
            let hand = null;
            if(pose) {
                const rw = pose.keypoints.find(k => k.name === 'right_wrist');
                const lw = pose.keypoints.find(k => k.name === 'left_wrist');
                if(rw && rw.score > 0.3) hand = rw;
                else if(lw && lw.score > 0.3) hand = lw;
            }

            if(hand) {
                // Mapeia a mão para a tela usando a função global do Core
                const pos = window.Gfx.map(hand, w, h);
                // Suaviza o movimento da raquete (Lag visual intencional para ficar fluido)
                this.racket.x += (pos.x - this.racket.x) * 0.5;
                this.racket.y += (pos.y - this.racket.y) * 0.5;
            }

            // 2. LÓGICA DO JOGO
            if(this.state === 'serve') {
                // Apenas espera um momento antes de lançar
                this.ball.z -= 10;
                if(this.ball.z < 1100) this.state = 'play';
            }
            else {
                // Física da Bola
                this.ball.x += this.ball.vx;
                this.ball.y += this.ball.vy;
                this.ball.z += this.ball.vz;

                // Gravidade (Bola faz uma curva)
                if(this.ball.y < 100) this.ball.vy += 0.15;

                // --- COLISÃO COM O JOGADOR (Z próximo de 0) ---
                if(this.ball.z < 100 && this.ball.z > 0 && this.ball.vz < 0) {
                    // Calcula a posição projetada da bola na tela
                    const scale = 500 / (this.ball.z + 500);
                    const ballScreenX = cx + (this.ball.x * scale);
                    const ballScreenY = cy + (this.ball.y * scale);

                    // Distância entre a Bola e a Raquete
                    const dist = Math.hypot(ballScreenX - this.racket.x, ballScreenY - this.racket.y);

                    // Se a distância for menor que o tamanho da raquete (HIT!)
                    if(dist < w * 0.15) {
                        window.Sfx.hit();
                        window.System.msg("BATEU!");
                        this.score++;

                        // Rebate a bola de volta (Inverte Z)
                        this.ball.vz = Math.abs(this.ball.vz) + 2; // Volta mais rápida
                        this.ball.vy = -8; // Joga pra cima
                        // Adiciona efeito lateral baseado em onde bateu na raquete
                        this.ball.vx = (ballScreenX - this.racket.x) * 0.3;
                    }
                }

                // --- COLISÃO COM O FUNDO (OPONENTE CPU) ---
                if(this.ball.z > 1500 && this.ball.vz > 0) {
                    window.Sfx.click(); // Som de quique
                    // CPU devolve a bola
                    this.ball.vz = -15 - (this.score * 0.5); // Vem na sua direção
                    this.ball.vx = (Math.random() - 0.5) * 15; // Mira aleatória
                    this.ball.vy = -5;
                }

                // --- GAME OVER (Bola passou do jogador) ---
                if(this.ball.z < -200) {
                    window.System.gameOver(this.score);
                }
            }

            // 3. DESENHO (RENDERIZAÇÃO)
            
            // Fundo (Quadra Verde)
            ctx.fillStyle = '#1e6b36'; 
            ctx.fillRect(0, 0, w, h);

            // Linhas da Quadra (Perspectiva)
            ctx.strokeStyle = 'rgba(255,255,255,0.6)';
            ctx.lineWidth = 4;
            ctx.beginPath();
            const horizon = h * 0.4;
            // Linha do horizonte e laterais
            ctx.moveTo(0, horizon); ctx.lineTo(w, horizon);
            ctx.moveTo(cx - (w*0.2), horizon); ctx.lineTo(0, h); // Esquerda
            ctx.moveTo(cx + (w*0.2), horizon); ctx.lineTo(w, h); // Direita
            ctx.moveTo(cx, horizon); ctx.lineTo(cx, h); // Centro
            ctx.stroke();

            // Desenha a Bola
            // Escala baseada na profundidade (Z) para efeito 3D
            const scale = 500 / (this.ball.z + 500);
            if(scale > 0) {
                const bx = cx + (this.ball.x * scale);
                const by = cy + (this.ball.y * scale);
                const size = (w * 0.06) * scale;

                // Sombra
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.beginPath(); ctx.ellipse(bx, by + size, size, size*0.3, 0, 0, Math.PI*2); ctx.fill();

                // Bola Amarela
                ctx.fillStyle = '#eeff00';
                ctx.beginPath(); ctx.arc(bx, by, size, 0, Math.PI*2); ctx.fill();
                ctx.lineWidth = 2; ctx.strokeStyle = '#aa9900'; ctx.stroke();
            }

            // Desenha a Raquete (Seguindo a mão)
            const rSize = w * 0.12;
            
            // Cabo da raquete
            ctx.strokeStyle = '#666'; ctx.lineWidth = 15; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(this.racket.x, this.racket.y); ctx.lineTo(this.racket.x, this.racket.y + rSize); ctx.stroke();
            
            // Cabeça da raquete
            ctx.fillStyle = 'rgba(200, 50, 50, 0.7)'; // Vermelho transparente
            ctx.lineWidth = 5; ctx.strokeStyle = '#fff';
            ctx.beginPath(); 
            ctx.ellipse(this.racket.x, this.racket.y - (rSize*0.3), rSize*0.6, rSize*0.7, 0, 0, Math.PI*2); 
            ctx.fill(); ctx.stroke();

            return this.score;
        }
    };

    // REGISTRO AUTOMÁTICO
    const regLoop = setInterval(() => {
        if(window.System && window.System.registerGame) {
            window.System.registerGame('tennis', 'Otto Tennis', '🎾', Logic, {camOpacity: 0.6, showWheel: false});
            clearInterval(regLoop);
        }
    }, 100);
})();
