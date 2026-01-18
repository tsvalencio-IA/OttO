// LÓGICA DO JOGO: KART DO OTTO (ENGINE V.2 - PARALLAX SPRITE)
(function() {
    const Logic = {
        speed: 0, pos: 0, x: 0, steer: 0, curve: 0, obs: [],
        
        init: function() { 
            this.speed = 0; this.pos = 0; this.x = 0; this.obs = []; 
            window.System.msg("LIGUE OS MOTORES!"); 
        },
        
        update: function(ctx, w, h, pose) {
            const d = Logic; 
            const cx = w / 2;

            // --- 1. INPUT ---
            let targetAngle = 0;
            if(pose) {
                const kp = pose.keypoints;
                const lw = kp.find(k=>k.name==='left_wrist');
                const rw = kp.find(k=>k.name==='right_wrist');
                
                // Exige as duas mãos para validar o volante
                if(lw && rw && lw.score > 0.4 && rw.score > 0.4) {
                    const dy = rw.y - lw.y; 
                    const dx = rw.x - lw.x;
                    targetAngle = Math.atan2(dy, dx) * 1.5 * window.System.sens;
                    
                    // Acelera
                    if(d.speed < h * 0.05) d.speed += h * 0.0006; 
                } else { 
                    d.speed *= 0.96; // Freio motor
                }
            }
            // Suavização da direção (Lerp)
            d.steer += (targetAngle - d.steer) * 0.2;
            
            // UI Volante (Rotação real HTML)
            const wheel = document.getElementById('visual-wheel');
            if(wheel) wheel.style.transform = `rotate(${d.steer * 60}deg)`;

            // --- 2. FÍSICA ---
            d.pos += d.speed;
            d.curve = Math.sin(d.pos * 0.004) * 1.5;
            d.x += d.steer * (d.speed / (h * 0.5));
            d.x -= d.curve * (d.speed / h);
            
            // Colisão com borda (Ricochete suave)
            if(Math.abs(d.x) > 1.3) { 
                d.speed *= 0.8; 
                d.x = d.x > 0 ? 1.3 : -1.3;
            }

            // --- 3. RENDERIZAÇÃO DE PISTA ---
            
            // Céu
            const horizon = h * 0.4;
            ctx.fillStyle = '#87CEEB'; ctx.fillRect(0, 0, w, horizon);
            
            // Grama
            ctx.fillStyle = '#3dae36'; ctx.fillRect(0, horizon, w, h);

            // Estrada (Trapézio)
            const topW = w * 0.02; 
            const botW = w * 1.4;
            const curveOff = d.curve * (w * 0.4);

            ctx.beginPath();
            ctx.fillStyle = '#555'; // Asfalto
            ctx.moveTo(cx + curveOff - topW, horizon);
            ctx.lineTo(cx + curveOff + topW, horizon);
            ctx.lineTo(cx + botW, h);
            ctx.lineTo(cx - botW, h);
            ctx.fill();

            // Zebras (Detalhe crucial para sensação de velocidade)
            const zebraSize = 20;
            const offsetZebra = (d.pos % zebraSize) / zebraSize;
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 4;
            // (Simplificado para performance, usando linha central)
            ctx.beginPath();
            ctx.strokeStyle = '#ffcc00'; 
            ctx.lineWidth = w * 0.01;
            ctx.setLineDash([50, 50]); 
            ctx.lineDashOffset = -d.pos;
            ctx.moveTo(cx + curveOff, horizon); 
            ctx.quadraticCurveTo(cx + (curveOff * 0.5), h * 0.7, cx, h); 
            ctx.stroke(); 
            ctx.setLineDash([]);

            // Obstáculos
            // (Mantive sua lógica de spawn, mas melhorei o desenho)
            if(Math.random() < 0.02 && d.speed > 5) d.obs.push({x: (Math.random()*2)-1, z: 1000}); 
            
            d.obs.forEach((o, i) => {
                o.z -= d.speed * 2; 
                if(o.z < -100) { d.obs.splice(i,1); return; }
                
                const scale = 500 / (o.z + 100);
                if(scale > 0 && o.z < 1000) {
                    const objX = cx + (d.curve * w * 0.3 * (1 - o.z/1000)) + (o.x * w * 0.5 * scale);
                    const objY = (h * 0.4) + (50 * scale);
                    const size = (w * 0.1) * scale;
                    
                    // Desenho Cone
                    ctx.fillStyle = '#ff4400';
                    ctx.beginPath(); ctx.moveTo(objX, objY - size); 
                    ctx.lineTo(objX - size/3, objY); ctx.lineTo(objX + size/3, objY); ctx.fill();
                    
                    if(o.z < 100 && o.z > 0 && Math.abs(d.x - o.x) < 0.35) {
                        d.speed *= 0.2; 
                        window.Sfx.crash(); 
                        d.obs.splice(i,1);
                    }
                }
            });

            // --- 4. RENDERIZAÇÃO DO KART (TÉCNICA SPRITE PARALAXE) ---
            // NUNCA USE ROTATE AQUI PARA JOGOS 2D PSEUDO-3D
            
            const carX = cx + (d.x * w * 0.25);
            const carY = h * 0.85;
            const s = w * 0.004; // Escala do carro
            
            // O segredo: 'turn' define o quanto deslocamos os elementos para o lado
            // em vez de girar o carro todo.
            const turn = d.steer * 20; 

            ctx.save();
            ctx.translate(carX, carY);
            ctx.scale(s, s);

            // Sombra (Sempre fixa no chão)
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.beginPath(); ctx.ellipse(0, 15, 35, 12, 0, 0, Math.PI*2); ctx.fill();

            // Pneus Traseiros (Fixos)
            ctx.fillStyle = '#222';
            ctx.fillRect(-30, 0, 12, 18);
            ctx.fillRect(18, 0, 12, 18);

            // Chassi (Corpo vermelho)
            ctx.fillStyle = '#d32f2f';
            ctx.beginPath(); ctx.roundRect(-22, -20, 44, 45, 6); ctx.fill();

            // Motor (Detalhe cinza)
            ctx.fillStyle = '#444'; ctx.fillRect(-12, 20, 24, 8);

            // Pneus Dianteiros (Estes se movem com o 'turn' para dar efeito de curva)
            ctx.fillStyle = '#222';
            // Note o "+ turn": desloca o pneu visualmente
            ctx.fillRect(-28 + turn, -22, 10, 14); 
            ctx.fillRect(18 + turn, -22, 10, 14);

            // Capacete do Piloto (Move um pouco menos que os pneus)
            ctx.fillStyle = '#ffeb3b'; // Amarelo
            ctx.beginPath(); ctx.arc(turn * 0.5, -5, 11, 0, Math.PI*2); ctx.fill();
            
            // Detalhe do Capacete
            ctx.fillStyle = '#d32f2f'; 
            ctx.beginPath(); ctx.arc(turn * 0.5, -5, 4, 0, Math.PI*2); ctx.fill();

            // Volante (Preto, acompanha o piloto)
            ctx.strokeStyle = '#111'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(-8 + turn, -12); ctx.lineTo(8 + turn, -12); ctx.stroke();

            ctx.restore();

            // --- 5. LUVAS (DESENHADAS POR CIMA - FORA DO RESTORE) ---
            if(window.Gfx && window.Gfx.drawSteeringHands) {
                window.Gfx.drawSteeringHands(ctx, pose, w, h);
            }

            return Math.floor(d.pos/100);
        }
    };

    // REGISTRO
    if(window.System) {
        window.System.registerGame('drive', 'Kart do Otto', '🏎️', Logic, {camOpacity: 0.5, showWheel: true});
    }
})();
