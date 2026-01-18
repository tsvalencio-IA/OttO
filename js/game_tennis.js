// LÓGICA DO JOGO: OTTO TENNIS PRO
(function() {
    const Logic = {
        score: 0,
        highscore: 0,
        // Bola com física avançada + Rastro
        ball: { x:0, y:0, z:1200, vx:0, vy:0, vz:0, trail:[] },
        // Raquete do Jogador (e cálculo de velocidade do braço)
        racket: { x:0, y:0, lastX:0, lastY:0, velocity:0 },
        // Oponente (IA)
        enemy: { x:0, y:0, speed: 0.1 },
        
        state: 'serve', // serve, play, point_player, point_enemy
        msgTimer: 0,

        init: function() { 
            this.score = 0; 
            this.state = 'serve';
            this.resetBall(true); // true = saque do jogador
            window.System.msg("SEU SAQUE!"); 
        },

        // Reseta a bola para um novo ponto
        resetBall: function(playerServe) {
            this.ball.trail = [];
            if(playerServe) {
                this.ball.x = 0; this.ball.y = -100; this.ball.z = 100; // Perto do jogador
                this.ball.vx = 0; this.ball.vy = 0; this.ball.vz = 0;
                this.state = 'serve';
            } else {
                // Saque da IA
                this.ball.x = 0; this.ball.y = -200; this.ball.z = 1600;
                this.ball.vx = (Math.random()-0.5)*15; 
                this.ball.vy = 5; 
                this.ball.vz = -25; // Saque rápido
                this.state = 'play';
                window.System.msg("DEFENDA!");
            }
        },

        update: function(ctx, w, h, pose) {
            const cx = w / 2; const cy = h / 2;
            const netZ = 800; // Profundidade da rede

            // --- 1. DETECÇÃO DA MÃO (RAQUETE) ---
            let hand = null;
            if(pose) {
                const rw = pose.keypoints.find(k => k.name === 'right_wrist');
                const lw = pose.keypoints.find(k => k.name === 'left_wrist');
                // Pega a mão com maior confiança
                if(rw && rw.score > 0.3) hand = rw;
                else if(lw && lw.score > 0.3) hand = lw;
            }

            if(hand) {
                const pos = window.Gfx.map(hand, w, h);
                // Guarda posição anterior para calcular força do golpe (Swing)
                this.racket.lastX = this.racket.x;
                this.racket.lastY = this.racket.y;
                
                // Movimento suave
                this.racket.x += (pos.x - this.racket.x) * 0.6;
                this.racket.y += (pos.y - this.racket.y) * 0.6;

                // Calcula velocidade do golpe (Pitágoras)
                const dx = this.racket.x - this.racket.lastX;
                const dy = this.racket.y - this.racket.lastY;
                this.racket.velocity = Math.sqrt(dx*dx + dy*dy);
            }

            // --- 2. LÓGICA DE JOGO ---
            
            // SAQUE
            if(this.state === 'serve') {
                // Bola flutua na frente do jogador esperando o golpe
                this.ball.x = this.racket.x + 20;
                this.ball.y = this.racket.y - 50;
                
                // Se detectar movimento rápido (Swing), saca!
                if(this.racket.velocity > 15) {
                    window.Sfx.hit();
                    this.state = 'play';
                    this.ball.vz = 35; // Velocidade do saque
                    this.ball.vx = (this.ball.x - cx) * 0.05; // Direção baseada na posição
                    this.ball.vy = -10; // Arco para cima
                }
            }
            
            // JOGO ROLANDO
            else if (this.state === 'play') {
                // Guarda rastro
                if(this.ball.trail.length > 10) this.ball.trail.shift();
                this.ball.trail.push({x:this.ball.x, y:this.ball.y, z:this.ball.z});

                // Física da Bola
                this.ball.x += this.ball.vx;
                this.ball.y += this.ball.vy;
                this.ball.z += this.ball.vz;
                this.ball.vy += 0.3; // Gravidade

                // Pingo no chão
                if(this.ball.y > 150) {
                    this.ball.vy *= -0.7; // Quica
                    this.ball.y = 150;
                    if(Math.abs(this.ball.z - netZ) > 100) window.Sfx.click(); // Som se não for na rede
                }

                // --- IA DO OPONENTE ---
                // Oponente segue a bola quando ela está longe
                if(this.ball.z > netZ) {
                    const targetX = this.ball.x;
                    // IA falha propositalmente se a bola for muito rápida no canto
                    const difficulty = 0.05 + (this.score * 0.005); 
                    this.enemy.x += (targetX - this.enemy.x) * difficulty; 
                }

                // Colisão Oponente x Bola (Rebatida da IA)
                if(this.ball.z > 1600 && Math.abs(this.ball.x - this.enemy.x) < 200) {
                    window.Sfx.hit();
                    this.ball.z = 1600;
                    this.ball.vz = -30 - (Math.random()*10); // Devolve rápido
                    
                    // Mira no lado oposto do jogador para dificultar
                    const targetPlayer = (this.racket.x > cx) ? -200 : 200;
                    this.ball.vx = (targetPlayer - this.ball.x) * 0.02;
                    this.ball.vy = -12;
                }
                // Ponto do Jogador (IA errou)
                else if (this.ball.z > 1800) {
                    this.score++;
                    window.Sfx.coin();
                    window.System.msg("PONTO!");
                    this.resetBall(false); // IA saca agora
                }

                // --- COLISÃO JOGADOR (VOCÊ) ---
                if(this.ball.z < 100 && this.ball.z > 0 && this.ball.vz < 0) {
                    const dist = Math.hypot(this.ball.x - (this.racket.x - cx), this.ball.y - (this.racket.y - cy));
                    
                    // Hitbox precisa
                    if(dist < 100) {
                        // Mecânica de Força: Só rebate forte se mover a mão!
                        if(this.racket.velocity > 5) {
                            window.Sfx.hit();
                            this.ball.vz = 35 + (this.racket.velocity * 0.5); // Força baseada no braço
                            this.ball.vy = -10 - (this.racket.velocity * 0.2);
                            // Efeito lateral (Spin)
                            this.ball.vx = (this.ball.x - (this.racket.x - cx)) * 0.2;
                        } else {
                            // Bloqueio fraco (bola morre)
                            window.Sfx.click();
                            this.ball.vz = 15; // Devolução lenta
                            this.ball.vy = -15; // Balão alto
                        }
                    }
                }

                // Ponto da IA (Bola passou do jogador)
                if(this.ball.z < -200) {
                    window.System.gameOver(this.score);
                }
            }

            // --- 3. RENDERIZAÇÃO ---
            
            // Fundo (Céu e Chão)
            const horizon = h * 0.35;
            // Céu
            const gradSky = ctx.createLinearGradient(0, 0, 0, horizon);
            gradSky.addColorStop(0, "#4fa8e0"); gradSky.addColorStop(1, "#cce0f0");
            ctx.fillStyle = gradSky; ctx.fillRect(0, 0, w, horizon);
            // Quadra (Azul Profissional)
            ctx.fillStyle = '#2c5ea8'; ctx.fillRect(0, horizon, w, h);

            // Linhas da Quadra (Trapézio 3D)
            ctx.strokeStyle = 'white'; ctx.lineWidth = 3; ctx.beginPath();
            const topW = w * 0.25; const botW = w * 1.5;
            ctx.moveTo(cx - topW, horizon); ctx.lineTo(cx + topW, horizon); // Fundo
            ctx.moveTo(cx - botW, h); ctx.lineTo(cx + botW, h); // Frente
            ctx.moveTo(cx - topW, horizon); ctx.lineTo(cx - botW, h); // Esquerda
            ctx.moveTo(cx + topW, horizon); ctx.lineTo(cx + botW, h); // Direita
            ctx.moveTo(cx, horizon); ctx.lineTo(cx, h); // Centro
            ctx.stroke();

            // Rede
            const netScale = 500 / (netZ + 500);
            const netW = (w * 1.2) * netScale;
            const netY = cy + (50 * netScale);
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.fillRect(cx - netW/2, netY - (40*netScale), netW, 40*netScale);
            ctx.strokeStyle = '#eee'; ctx.strokeRect(cx - netW/2, netY - (40*netScale), netW, 40*netScale);

            // Desenha Oponente
            const enScale = 500 / 2100; // Fica lá no fundo
            const enX = cx + (this.enemy.x * enScale);
            const enY = cy + (50 * enScale);
            ctx.fillStyle = '#ff5555';
            ctx.beginPath(); ctx.arc(enX, enY - (60*enScale), 30*enScale, 0, Math.PI*2); ctx.fill(); // Cabeça
            ctx.fillRect(enX - (20*enScale), enY - (30*enScale), 40*enScale, 60*enScale); // Corpo

            // Desenha Bola + Rastro
            // Rastro
            for(let i=0; i<this.ball.trail.length; i++) {
                const t = this.ball.trail[i];
                const sc = 500 / (t.z + 500);
                if(sc <= 0) continue;
                ctx.fillStyle = `rgba(220, 255, 0, ${i/10})`;
                ctx.beginPath(); ctx.arc(cx + t.x*sc, cy + t.y*sc, (w*0.04)*sc, 0, Math.PI*2); ctx.fill();
            }
            // Bola Principal
            const bSc = 500 / (this.ball.z + 500);
            if(bSc > 0) {
                const bx = cx + (this.ball.x * bSc);
                const by = cy + (this.ball.y * bSc);
                const br = (w * 0.05) * bSc;
                
                // Sombra
                ctx.fillStyle = 'rgba(0,0,0,0.2)';
                ctx.beginPath(); ctx.ellipse(bx, by + br, br, br*0.3, 0, 0, Math.PI*2); ctx.fill();
                
                // Corpo Bola
                const gradB = ctx.createRadialGradient(bx-br*0.3, by-br*0.3, br*0.2, bx, by, br);
                gradB.addColorStop(0, '#ffffaa'); gradB.addColorStop(1, '#aacc00');
                ctx.fillStyle = gradB;
                ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI*2); ctx.fill();
            }

            // Desenha Raquete do Jogador
            const rX = this.racket.x; 
            const rY = this.racket.y;
            
            // Cabo
            ctx.strokeStyle = '#333'; ctx.lineWidth = 12; ctx.lineCap='round';
            ctx.beginPath(); ctx.moveTo(rX, rY); ctx.lineTo(rX, rY + 80); ctx.stroke();
            
            // Rede da Raquete
            ctx.fillStyle = 'rgba(100, 0, 0, 0.4)';
            ctx.strokeStyle = '#d00'; ctx.lineWidth = 5;
            ctx.beginPath(); 
            ctx.ellipse(rX, rY-30, 50, 60, 0, 0, Math.PI*2); 
            ctx.fill(); ctx.stroke();

            // Mensagem de Tutorial
            if(this.state === 'serve') {
                ctx.fillStyle = "yellow"; ctx.font = "bold 30px Arial"; ctx.textAlign = "center";
                ctx.fillText("BALANCE PARA SACAR!", cx, h*0.8);
            }

            return this.score;
        }
    };

    // REGISTRO
    const regLoop = setInterval(() => {
        if(window.System && window.System.registerGame) {
            window.System.registerGame('tennis', 'Otto Tennis', '🎾', Logic, {camOpacity: 0.6, showWheel: false});
            clearInterval(regLoop);
        }
    }, 100);
})();
