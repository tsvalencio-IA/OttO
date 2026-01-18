// LÓGICA DO JOGO: KART DO OTTO (VISUAL ENHANCED)
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

            // --- 1. INPUT (MANTIDO) ---
            if(window.Gfx) window.Gfx.drawSteeringHands(ctx, pose, w, h);

            if(pose) {
                const kp = pose.keypoints;
                const lw = kp.find(k => k.name === 'left_wrist');
                const rw = kp.find(k => k.name === 'right_wrist');
                if(lw && rw && lw.score > 0.3 && rw.score > 0.3) {
                    const dy = rw.y - lw.y; 
                    const dx = rw.x - lw.x;
                    ang = Math.atan2(dy, dx) * 1.5 * window.System.sens;
                    if(this.s < h * 0.05) this.s += h * 0.0005;
                } else { this.s *= 0.95; }
            }
            this.st += (ang - this.st) * 0.2;
            
            // UI Volante
            const wheel = document.getElementById('visual-wheel'); 
            if(wheel) wheel.style.transform = `rotate(${this.st * 57}deg)`;

            // --- 2. FÍSICA (MANTIDA) ---
            this.p += this.s; 
            this.c = Math.sin(this.p * 0.005) * 1.5;
            this.x += this.st * (this.s / (h * 0.5)); 
            this.x -= this.c * (this.s / h);
            
            if(Math.abs(this.x) > 1.3) this.s *= 0.9; // Colisão borda

            // --- 3. OBSTÁCULOS (MANTIDO) ---
            if(Math.random() < 0.02 && this.s > 5) {
                this.obs.push({x: (Math.random() * 2) - 1, z: 1000}); 
            }

            // --- 4. RENDERIZAÇÃO NIVEL CONSOLE (NOVO!) ---

            // A. CÉU (Degradê Nintendo)
            const horizon = h * 0.4;
            const gradSky = ctx.createLinearGradient(0, 0, 0, horizon);
            gradSky.addColorStop(0, "#00bfff"); // Azul Céu
            gradSky.addColorStop(1, "#87cefa"); // Azul Claro
            ctx.fillStyle = gradSky; 
            ctx.fillRect(0, 0, w, horizon);

            // B. GRAMADO (Verde)
            ctx.fillStyle = '#2e8b57'; // SeaGreen
            ctx.fillRect(0, horizon, w, h - horizon);

            // C. ESTRADA (Trapézio com Zebras)
            const topW = w * 0.02; 
            const botW = w * 1.4;
            const curveOffset = this.c * (w * 0.4); // Curva visual

            // Desenha Zebras (Rumble Strips) nas bordas
            const zebraWidth = w * 0.1; // Largura extra para a zebra
            ctx.beginPath();
            ctx.fillStyle = (Math.floor(this.p / 50) % 2 === 0) ? '#cc0000' : '#ffffff'; // Pisca Vermelho/Branco com a velocidade
            ctx.moveTo(cx + curveOffset - topW - (zebraWidth*0.1), horizon);
            ctx.lineTo(cx + curveOffset + topW + (zebraWidth*0.1), horizon);
            ctx.lineTo(cx + botW + zebraWidth, h);
            ctx.lineTo(cx - botW - zebraWidth, h);
            ctx.fill();

            // Desenha Asfalto (Cinza Escuro)
            ctx.beginPath();
            ctx.fillStyle = '#333';
            ctx.moveTo(cx + curveOffset - topW, horizon);
            ctx.lineTo(cx + curveOffset + topW, horizon);
            ctx.lineTo(cx + botW, h);
            ctx.lineTo(cx - botW, h);
            ctx.fill();

            // Linha Central (Amarela tracejada)
            ctx.strokeStyle = '#ffeb3b'; 
            ctx.lineWidth = w * 0.015;
            ctx.setLineDash([h * 0.05, h * 0.08]); 
            ctx.lineDashOffset = -this.p; // Animação da velocidade
            ctx.beginPath(); 
            ctx.moveTo(cx + curveOffset, horizon); 
            ctx.quadraticCurveTo(cx + (curveOffset * 0.5), h * 0.7, cx, h); 
            ctx.stroke(); 
            ctx.setLineDash([]);

            // D. OBSTÁCULOS (CONES 3D)
            this.obs.forEach((o, i) => {
                o.z -= this.s * 2; 
                if(o.z < -100) { this.obs.splice(i, 1); return; }
                
                const scale = 500 / (o.z + 100);
                if(scale > 0 && o.z < 1000) {
                    // Cálculo de posição 3D
                    const cOff = this.c * (w * 0.3) * (1 - (o.z / 1000));
                    const ox = cx + cOff + (o.x * w * 0.5 * scale);
                    const oy = (h * 0.4) + (50 * scale);
                    const sz = (w * 0.1) * scale; // Tamanho do obstáculo

                    // Desenha Cone Laranja
                    ctx.fillStyle = '#ff6600'; 
                    ctx.beginPath();
                    ctx.moveTo(ox, oy - sz); // Topo
                    ctx.lineTo(ox - (sz*0.4), oy); // Base Esq
                    ctx.lineTo(ox + (sz*0.4), oy); // Base Dir
                    ctx.fill();
                    
                    // Base do Cone
                    ctx.fillStyle = '#cc4400';
                    ctx.fillRect(ox - (sz*0.5), oy - (sz*0.1), sz, sz*0.1);

                    // Colisão
                    if(o.z < 100 && o.z > 0 && Math.abs(this.x - o.x) < 0.3) {
                        this.s *= 0.5; 
                        window.Sfx.skid(); 
                        this.obs.splice(i, 1); 
                        ctx.fillStyle = 'rgba(255,0,0,0.5)'; 
                        ctx.fillRect(0, 0, w, h);
                    }
                }
            });

            // E. KART DO JOGADOR (SPRITE VETORIAL)
            const carX = cx + (this.x * w * 0.25);
            const carY = h * 0.85;
            const carScale = w * 0.0035; // Um pouco maior

            ctx.save(); 
            ctx.translate(carX, carY); 
            ctx.rotate(this.st * 0.5); // Inclina o carro levemente na curva
            ctx.scale(carScale, carScale);

            // Sombra
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.beginPath(); ctx.ellipse(0, 10, 35, 15, 0, 0, Math.PI*2); ctx.fill();

            // Rodas Traseiras (Largas)
            ctx.fillStyle = '#111';
            ctx.fillRect(-30, 0, 12, 18); // Esq
            ctx.fillRect(18, 0, 12, 18);  // Dir

            // Rodas Dianteiras (Menores)
            ctx.fillRect(-28, -25, 10, 14); // Esq
            ctx.fillRect(18, -25, 10, 14);  // Dir

            // Chassi Principal (Vermelho Ferrari)
            ctx.fillStyle = '#d32f2f';
            ctx.beginPath();
            ctx.roundRect(-20, -20, 40, 45, 5);
            ctx.fill();

            // Detalhe Motor (Cinza atrás)
            ctx.fillStyle = '#555';
            ctx.fillRect(-15, 20, 30, 8);
            
            // Escapamentos
            ctx.fillStyle = '#222';
            ctx.beginPath(); ctx.arc(-8, 28, 3, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(8, 28, 3, 0, Math.PI*2); ctx.fill();

            // Capacete do Piloto (Amarelo)
            ctx.fillStyle = '#fbc02d';
            ctx.beginPath(); ctx.arc(0, -5, 11, 0, Math.PI*2); ctx.fill();
            
            // Volante (Preto)
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(-8, -10); ctx.lineTo(8, -10); ctx.stroke();

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
