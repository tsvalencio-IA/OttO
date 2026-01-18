// LÓGICA DO JOGO: OTTO TENNIS (CALIBRADO E AMPLIFICADO)
(function() {
    const Logic = {
        score: 0,
        // Bola
        ball: { x:0, y:0, z:2000, vx:0, vy:0, vz:0, trail:[] },
        // Raquete
        racket: { x:0, y:0, lastX:0, lastY:0, velocity:0, swingTimer:0 },
        // Oponente
        enemy: { x:0, y:0, state:'idle' },
        
        state: 'serve',
        flash: 0,

        // CONFIGURAÇÃO DE ALCANCE (Sensibilidade)
        // Quanto maior, menos você precisa esticar o braço.
        // 2.0 significa que o movimento é dobrado (alcança o canto mexendo pouco)
        reachMult: 2.2, 

        init: function() { 
            this.score = 0; 
            this.state = 'serve';
            this.resetBall('player');
            window.System.msg("CENTRALIZAR MÃO!"); 
        },

        resetBall: function(who) {
            this.ball.trail = [];
            this.ball.vx = 0; this.ball.vy = 0;
            
            if(who === 'player') {
                this.state = 'serve';
                this.ball.x = 0; this.ball.y = -50; this.ball.z = 200; 
                this.ball.vz = 0;
            } else {
                this.state = 'play';
                this.ball.x = 0; this.ball.y = -200; this.ball.z = 2400;
                this.ball.vz = -55; // Saque IA
                this.ball.vx = (Math.random()-0.5) * 15;
                this.ball.vy = 2;
                window.System.msg("DEFENDA!");
            }
        },

        update: function(ctx, w, h, pose) {
            const cx = w / 2; const cy = h / 2;
            const netZ = 1200;

            // --- 1. INPUT AMPLIFICADO (A SOLUÇÃO DO PROBLEMA) ---
            let hand = null;
            if(pose) {
                const rw = pose.keypoints.find(k => k.name === 'right_wrist');
                const lw = pose.keypoints.find(k => k.name === 'left_wrist');
                if(rw && rw.score > 0.3) hand = rw;
                else if(lw && lw.score > 0.3) hand = lw;
            }

            if(hand) {
                // 1. Pega posição crua da câmera
                const rawPos = window.Gfx.map(hand, w, h);
                
                // 2. Calcula a distância do centro
                const deltaX = rawPos.x - cx;
                const deltaY = rawPos.y - cy;

                // 3. AMPLIFICA O MOVIMENTO (Multiplica pelo reachMult)
                // Isso faz a raquete ir mais longe que a mão
                const targetX = cx + (deltaX * this.reachMult);
                const targetY = cy + (deltaY * this.reachMult);

                // 4. TRAVA NA TELA (Clamp)
                // Garante que a raquete não suma se você exagerar
                const clampedX = Math.max(50, Math.min(w - 50, targetX));
                const clampedY = Math.max(50, Math.min(h - 50, targetY));

                // 5. MOVIMENTO SUAVE
                this.racket.lastX = this.racket.x;
                this.racket.lastY = this.racket.y;
                
                this.racket.x += (clampedX - this.racket.x) * 0.7;
                this.racket.y += (clampedY - this.racket.y) * 0.7;

                // Cálculo de velocidade (Swing)
                const dx = this.racket.x - this.racket.lastX;
                const dy = this.racket.y - this.racket.lastY;
                const currentVel = Math.sqrt(dx*dx + dy*dy);
                this.racket.velocity = (this.racket.velocity * 0.5) + (currentVel * 0.5);

                if(this.racket.velocity > 12) this.racket.swingTimer = 5;
            }
            if(this.racket.swingTimer > 0) this.racket.swingTimer--;

            // --- 2. LÓGICA (GAMEPLAY) ---
            
            if(this.state === 'serve') {
                this.ball.x = this.racket.x + 30;
                this.ball.y = this.racket.y - 60;
                
                if(this.racket.swingTimer > 0) {
                    window.Sfx.hit();
                    this.state = 'play';
                    this.ball.vz = 60 + (this.racket.velocity * 0.5); 
                    this.ball.vy = -15; 
                    this.ball.vx = (this.ball.x - cx) * 0.15; // Direção baseada no ponto de impacto
                    this.flash = 5;
                }
            }
            else if (this.state === 'play') {
                // Rastro
                if(this.ball.trail.length > 8) this.ball.trail.shift();
                this.ball.trail.push({x:this.ball.x, y:this.ball.y, z:this.ball.z});

                // Física Bola
                this.ball.x += this.ball.vx;
                this.ball.y += this.ball.vy;
                this.ball.z += this.ball.vz;
                this.ball.vy += 0.6; // Gravidade

                // Quique
                if(this.ball.y > 180) {
                    this.ball.y = 180;
                    this.ball.vy *= -0.65;
                    if(Math.abs(this.ball.z - netZ) > 150) window.Sfx.click();
                }

                // IA Oponente
                if(this.ball.z > netZ) {
                    let destX = this.ball.x;
                    const speed = 9 + (this.score * 0.6); // IA melhora com o tempo
                    if(this.enemy.x < destX - 20) this.enemy.x += speed;
                    else if(this.enemy.x > destX + 20) this.enemy.x -= speed;

                    // IA Rebate
                    if(this.ball.z > 2400 && Math.abs(this.ball.x - this.enemy.x) < 250) {
                        window.Sfx.hit();
                        this.ball.z = 2400;
                        this.ball.vz = -60 - (this.score); 
                        this.ball.vy = -18;
                        const target = (this.racket.x > cx) ? -350 : 350; // Joga no canto oposto
                        this.ball.vx = (target - this.ball.x) * 0.022;
                    }
                    else if(this.ball.z > 2800) { // Ponto Jogador
                        this.score++; window.Sfx.coin(); window.System.msg("PONTO!");
                        this.resetBall('enemy');
                    }
                }

                // Colisão Jogador
                if(this.ball.z < 250 && this.ball.z > -50 && this.ball.vz < 0) {
                    const dist = Math.hypot(this.ball.x - (this.racket.x - cx), this.ball.y - (this.racket.y - cy));
                    
                    // Hitbox Aumentada para compensar lag
                    if(dist < 140) { 
                        if(this.racket.velocity > 5) {
                            window.Sfx.hit();
                            this.flash = 3;
                            const power = 55 + Math.min(30, this.racket.velocity);
                            this.ball.vz = power; 
                            this.ball.vy = -12 - (this.racket.velocity * 0.2);
                            const spin = (this.ball.x - (this.racket.x - cx)) * 0.35; // Efeito lateral
                            this.ball.vx = spin;
                        } else {
                            window.Sfx.click(); // Bloqueio
                            this.ball.vz = 25; 
                            this.ball.vy = -20;
                        }
                    }
                }

                if(this.ball.z < -200) window.System.gameOver(this.score);
            }

            // --- 3. RENDERIZAÇÃO ---
            
            // Flash
            if(this.flash > 0) {
                ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.2})`; ctx.fillRect(0,0,w,h); this.flash--;
            }

            // Fundo
            const horizon = h * 0.35;
            const grad = ctx.createLinearGradient(0,0,0,horizon);
            grad.addColorStop(0, "#2980b9"); grad.addColorStop(1, "#6dd5fa");
            ctx.fillStyle = grad; ctx.fillRect(0,0,w,horizon);

            // Quadra
            ctx.fillStyle = '#2c3e50'; ctx.fillRect(0, horizon, w, h);
            const topW = w * 0.25; const botW = w * 1.8;
            ctx.fillStyle = '#3498db'; ctx.beginPath();
            ctx.moveTo(cx - topW, horizon); ctx.lineTo(cx + topW, horizon);
            ctx.lineTo(cx + botW, h); ctx.lineTo(cx - botW, h); ctx.fill();

            // Linhas
            ctx.strokeStyle = 'white'; ctx.lineWidth = 4; ctx.beginPath();
            ctx.moveTo(cx - topW, horizon); ctx.lineTo(cx - botW, h);
            ctx.moveTo(cx + topW, horizon); ctx.lineTo(cx + botW, h);
            ctx.moveTo(cx, horizon); ctx.lineTo(cx, h);
            ctx.moveTo(cx - topW, horizon); ctx.lineTo(cx + topW, horizon);
            ctx.stroke();

            // Rede
            const netScale = 500 / (netZ + 500);
            const netW = (w * 1.4) * netScale;
            const netH = 60 * netScale;
            const netY = cy + (50 * netScale);
            ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(cx - netW/2, netY - netH, netW, netH);
            ctx.strokeRect(cx - netW/2, netY - netH, netW, netH);

            // Oponente
            const enSc = 500 / 2900;
            const enX = cx + (this.enemy.x * enSc);
            const enY = cy + (50 * enSc);
            ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(enX, enY, 40*enSc, 10*enSc, 0, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.roundRect(enX - 25*enSc, enY - 80*enSc, 50*enSc, 80*enSc, 10); ctx.fill();
            ctx.fillStyle = '#f1c40f'; ctx.beginPath(); ctx.arc(enX, enY - 90*enSc, 35*enSc, 0, Math.PI*2); ctx.fill();

            // Bola
            this.ball.trail.forEach((t, i) => {
                const sc = 500 / (t.z + 500);
                if(sc > 0) {
                    ctx.globalAlpha = i / 10; ctx.fillStyle = '#ffff00';
                    ctx.beginPath(); ctx.arc(cx + t.x*sc, cy + t.y*sc, (w*0.04)*sc, 0, Math.PI*2); ctx.fill();
                }
            });
            ctx.globalAlpha = 1;

            const bSc = 500 / (this.ball.z + 500);
            if(bSc > 0) {
                const bx = cx + (this.ball.x * bSc);
                const by = cy + (this.ball.y * bSc);
                const br = (w * 0.055) * bSc;
                
                // Sombra da bola
                const sY = cy + (180 * bSc);
                ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(bx, sY, br, br*0.4, 0, 0, Math.PI*2); ctx.fill();

                const gradB = ctx.createRadialGradient(bx-br*0.3, by-br*0.3, br*0.1, bx, by, br);
                gradB.addColorStop(0, '#ffffdd'); gradB.addColorStop(1, '#d4d400');
                ctx.fillStyle = gradB; ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1; ctx.stroke();
            }

            // Raquete do Jogador
            const rX = this.racket.x; const rY = this.racket.y;
            
            // Motion Blur
            if(this.racket.velocity > 10) {
                ctx.globalAlpha = 0.3; ctx.fillStyle = '#d00';
                ctx.beginPath(); ctx.ellipse(this.racket.lastX, this.racket.lastY-40, 60, 70, 0, 0, Math.PI*2); ctx.fill();
                ctx.globalAlpha = 1;
            }

            ctx.translate(rX, rY);
            const tilt = (rX - this.racket.lastX) * 0.05; ctx.rotate(tilt);
            
            ctx.fillStyle = '#333'; ctx.fillRect(-10, 0, 20, 80);
            ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 12;
            ctx.beginPath(); ctx.ellipse(0, -50, 55, 65, 0, 0, Math.PI*2); ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fill();
            
            ctx.rotate(-tilt); ctx.translate(-rX, -rY);

            // --- HUD: ZONA DE CAPTURA ---
            // Desenha um retângulo sutil para mostrar ao jogador onde a câmera "enxerga"
            // Se a raquete estiver no limite, desenha vermelho
            const margin = 50;
            const isLimit = (rX < margin+10 || rX > w-margin-10 || rY < margin+10 || rY > h-margin-10);
            
            if(isLimit || this.state === 'serve') {
                ctx.strokeStyle = isLimit ? 'rgba(255,0,0,0.5)' : 'rgba(255,255,255,0.2)';
                ctx.lineWidth = 4;
                ctx.setLineDash([10, 10]);
                ctx.strokeRect(margin, margin, w - margin*2, h - margin*2);
                ctx.setLineDash([]);
                if(isLimit) {
                    ctx.fillStyle = "red"; ctx.font = "bold 20px Arial"; ctx.textAlign = "center";
                    ctx.fillText("VOLTE PARA O CENTRO!", cx, h/2);
                }
            }

            return this.score;
        }
    };

    // REGISTRO
    const regLoop = setInterval(() => {
        if(window.System && window.System.registerGame) {
            window.System.registerGame('tennis', 'Wii Tennis Pro', '🎾', Logic, {camOpacity: 0.6, showWheel: false});
            clearInterval(regLoop);
        }
    }, 100);
})();
