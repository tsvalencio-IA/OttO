// LÓGICA DO JOGO: KART DO OTTO (CORRIGIDO: SEM TOMBAR + VISUAL SNES)
(function() {
    const Logic = {
        s: 0, p: 0, x: 0, st: 0, c: 0, obs: [],
        
        init: function() { 
            this.s = 0; this.p = 0; this.x = 0; this.obs = []; 
            window.System.msg("SEGURE O VOLANTE!"); 
        },
        
        update: function(ctx, w, h, pose) {
            const cx = w / 2;
            let ang = 0;

            // --- 1. INPUT (VOLANTE) ---
            if(window.Gfx && window.Gfx.drawSteeringHands) {
                 window.Gfx.drawSteeringHands(ctx, pose, w, h);
            }

            if(pose) {
                const kp = pose.keypoints;
                const lw = kp.find(k => k.name === 'left_wrist');
                const rw = kp.find(k => k.name === 'right_wrist');
                
                // Exige confiança alta para evitar tremedeira
                if(lw && rw && lw.score > 0.4 && rw.score > 0.4) {
                    const dy = rw.y - lw.y; 
                    const dx = rw.x - lw.x;
                    // Ajuste de sensibilidade para ficar "1:1" com a mão
                    ang = Math.atan2(dy, dx) * 1.3 * window.System.sens;
                    
                    // Acelera se estiver segurando o volante (mãos detectadas)
                    if(this.s < h * 0.05) this.s += h * 0.0005;
                } else { 
                    this.s *= 0.96; // Freia se soltar
                }
            }
            // Suavização ajustada para resposta mais rápida (Sem lag)
            this.st += (ang - this.st) * 0.3;
            
            // Atualiza volante da UI (HTML)
            const wheel = document.getElementById('visual-wheel'); 
            if(wheel) wheel.style.transform = `rotate(${this.st * 57}deg)`;

            // --- 2. FÍSICA (ARCADE) ---
            this.p += this.s; 
            // Curva da pista baseada no tempo
            this.c = Math.sin(this.p * 0.003) * 1.5;
            
            // Movimento lateral do carro (Direção + Força Centrifuga da curva)
            this.x += this.st * (this.s / (h * 0.45)); 
            this.x -= this.c * (this.s / h); 
            
            // Limites da pista (Bate e perde velocidade)
            if(Math.abs(this.x) > 1.4) { 
                this.s *= 0.85; 
                this.x = (this.x > 0 ? 1.4 : -1.4); // Trava na borda
            }

            // --- 3. OBSTÁCULOS ---
            if(Math.random() < 0.015 && this.s > 5) {
                this.obs.push({x: (Math.random() * 2.2) - 1.1, z: 1000}); 
            }

            // --- 4. RENDERIZAÇÃO (VISUAL ESTILO NINTENDO) ---

            // A. CÉU
            const horizon = h * 0.4;
            const gradSky = ctx.createLinearGradient(0, 0, 0, horizon);
            gradSky.addColorStop(0, "#0099cc"); // Azul Mario Kart
            gradSky.addColorStop(1, "#99ccff"); 
            ctx.fillStyle = gradSky; 
            ctx.fillRect(0, 0, w, horizon);

            // B. GRAMADO (BACKGROUND)
            ctx.fillStyle = '#3dae36'; // Verde Nintendo
            ctx.fillRect(0, horizon, w, h - horizon);

            // C. ESTRADA (TRAPÉZIO)
            const topW = w * 0.02; 
            const botW = w * 1.6; // Pista larga na base
            const curveOffset = this.c * (w * 0.5); // Curva visual

            // Desenha Zebras (Efeito de velocidade nas bordas)
            const zebraW = w * 0.15;
            const zebraColor = (Math.floor(this.p / 40) % 2 === 0) ? '#e60000' : '#ffffff'; // Pisca
            
            ctx.beginPath();
            ctx.fillStyle = zebraColor;
            // Trapézio maior para as zebras
            ctx.moveTo(cx + curveOffset - topW - (zebraW*0.1), horizon);
            ctx.lineTo(cx + curveOffset + topW + (zebraW*0.1), horizon);
            ctx.lineTo(cx + botW + zebraW, h);
            ctx.lineTo(cx - botW - zebraW, h);
            ctx.fill();

            // Asfalto
            ctx.beginPath();
            ctx.fillStyle = '#555'; // Cinza asfalto
            ctx.moveTo(cx + curveOffset - topW, horizon);
            ctx.lineTo(cx + curveOffset + topW, horizon);
            ctx.lineTo(cx + botW, h);
            ctx.lineTo(cx - botW, h);
            ctx.fill();

            // Linha Central
            ctx.strokeStyle = '#ffcc00'; 
            ctx.lineWidth = w * 0.015;
            ctx.setLineDash([h * 0.05, h * 0.1]); 
            ctx.lineDashOffset = -this.p; 
            ctx.beginPath(); 
            ctx.moveTo(cx + curveOffset, horizon); 
            ctx.quadraticCurveTo(cx + (curveOffset * 0.5), h * 0.7, cx, h); 
            ctx.stroke(); 
            ctx.setLineDash([]);

            // D. OBSTÁCULOS
            this.obs.forEach((o, i) => {
                o.z -= this.s * 2; 
                if(o.z < -100) { this.obs.splice(i, 1); return; }
                
                const scale = 500 / (o.z + 100);
                if(scale > 0 && o.z < 1000) {
                    const cOff = this.c * (w * 0.3) * (1 - (o.z / 1000));
                    const ox = cx + cOff + (o.x * w * 0.5 * scale);
                    const oy = (h * 0.4) + (50 * scale);
                    const sz = (w * 0.1) * scale;

                    // Cone
                    ctx.fillStyle = '#ff6600'; 
                    ctx.beginPath();
                    ctx.moveTo(ox, oy - sz);
                    ctx.lineTo(ox - (sz*0.4), oy);
                    ctx.lineTo(ox + (sz*0.4), oy);
                    ctx.fill();
                    
                    if(o.z < 100 && o.z > 0 && Math.abs(this.x - o.x) < 0.35) {
                        this.s *= 0.3; // Batida forte
                        window.Sfx.crash(); 
                        this.obs.splice(i, 1); 
                        ctx.fillStyle = 'white'; // Flash
                        ctx.fillRect(0, 0, w, h);
                    }
                }
            });

            // E. KART DO JOGADOR (SEM TOMBAR - EFEITO PARALAXE)
            const carX = cx + (this.x * w * 0.25);
            const carY = h * 0.85;
            const carScale = w * 0.0035;

            ctx.save(); 
            ctx.translate(carX, carY); 
            ctx.scale(carScale, carScale);
            // NOTA: Removi ctx.rotate() para evitar o tombo!

            // 1. Sombra
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.beginPath(); ctx.ellipse(0, 15, 40, 15, 0, 0, Math.PI*2); ctx.fill();

            // ILUSÃO DE ÓTICA PARA CURVA (PARALAXE)
            // turnOffset desloca os elementos para simular o giro 3D
            const turnOffset = this.st * 18; 

            // 2. Rodas Traseiras (Fixas)
            ctx.fillStyle = '#222';
            ctx.fillRect(-35 + (turnOffset*0.5), 5, 15, 20); // Esq
            ctx.fillRect(20 + (turnOffset*0.5), 5, 15, 20);  // Dir

            // 3. Chassi (Corpo)
            ctx.fillStyle = '#cc0000'; // Vermelho
            ctx.beginPath();
            ctx.roundRect(-25, -20, 50, 45, 5); 
            ctx.fill();
            
            // Faixa Racing
            ctx.fillStyle = '#fff';
            ctx.fillRect(-5 + (turnOffset*0.2), -20, 10, 45);

            // 4. Rodas Dianteiras (Giram muito)
            ctx.fillStyle = '#222';
            ctx.fillRect(-30 + (turnOffset*1.5), -25, 12, 16); 
            ctx.fillRect(18 + (turnOffset*1.5), -25, 12, 16);

            // 5. Motor
            ctx.fillStyle = '#444';
            ctx.fillRect(-15 + (turnOffset*0.5), 25, 30, 8);
            ctx.fillStyle = '#111';
            ctx.beginPath(); ctx.arc(-10 + (turnOffset*0.5), 30, 4, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(10 + (turnOffset*0.5), 30, 4, 0, Math.PI*2); ctx.fill();

            // 6. Cabeça do Piloto (Inclina na curva)
            ctx.fillStyle = '#ffcc99'; // Pele
            ctx.beginPath(); ctx.arc(turnOffset, -10, 10, 0, Math.PI*2); ctx.fill();
            // Capacete
            ctx.fillStyle = '#e60000';
            ctx.beginPath(); ctx.arc(turnOffset, -12, 11, 0, Math.PI*2); ctx.fill();
            // Visor
            ctx.fillStyle = '#333';
            ctx.fillRect(turnOffset - 8, -12, 16, 6);

            // 7. Volante do Kart
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 3;
            ctx.beginPath(); 
            ctx.moveTo(-8 + (turnOffset*1.8), -15); 
            ctx.lineTo(8 + (turnOffset*1.8), -15); 
            ctx.stroke();

            ctx.restore();

            return Math.floor(this.p / 100);
        }
    };

    // REGISTRO
    const regLoop = setInterval(() => {
        if(window.System && window.System.registerGame) {
            window.System.registerGame('drive', 'Kart do Otto', '🏎️', Logic, {camOpacity: 0.5, showWheel: true});
            clearInterval(regLoop);
        }
    }, 100);
})();
