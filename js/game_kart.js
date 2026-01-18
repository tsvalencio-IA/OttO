// LÓGICA DO JOGO: KART DO OTTO (V3 - FÍSICA TRAVADA + NÍVEL DE BOLINHA)
(function() {
    const Logic = {
        speed: 0, pos: 0, x: 0, steer: 0, curve: 0, obs: [],
        
        init: function() { 
            this.speed = 0; this.pos = 0; this.x = 0; this.obs = []; 
            window.System.msg("ALINHE O NÍVEL!"); 
        },
        
        update: function(ctx, w, h, pose) {
            const d = Logic; 
            const cx = w / 2;

            // --- 1. INPUT (VOLANTE & MÃOS) ---
            let targetAngle = 0;
            let handAngle = 0; // Para visualização

            if(pose) {
                const kp = pose.keypoints;
                const lw = kp.find(k=>k.name==='left_wrist');
                const rw = kp.find(k=>k.name==='right_wrist');
                
                if(lw && rw && lw.score > 0.4 && rw.score > 0.4) {
                    const dy = rw.y - lw.y; 
                    const dx = rw.x - lw.x;
                    handAngle = Math.atan2(dy, dx); // Ângulo cru
                    
                    // Ajuste de sensibilidade (1.3x)
                    targetAngle = handAngle * 1.3 * window.System.sens;
                    
                    // Acelerador (mãos na tela)
                    if(d.speed < h * 0.05) d.speed += h * 0.0006; 
                } else { 
                    d.speed *= 0.96; // Freio
                }
            }
            // Suavização do movimento
            d.steer += (targetAngle - d.steer) * 0.2;
            
            // Gira o Volante HTML
            const wheel = document.getElementById('visual-wheel');
            if(wheel) wheel.style.transform = `rotate(${d.steer * 60}deg)`;

            // --- 2. FÍSICA ---
            d.pos += d.speed;
            d.curve = Math.sin(d.pos * 0.004) * 1.5;
            d.x += d.steer * (d.speed / (h * 0.5));
            d.x -= d.curve * (d.speed / h);
            
            // Colisão Borda
            if(Math.abs(d.x) > 1.3) { d.speed *= 0.8; d.x = d.x > 0 ? 1.3 : -1.3; }

            // --- 3. RENDERIZAÇÃO DE CENÁRIO ---
            const horizon = h * 0.4;
            // Céu
            const gradSky = ctx.createLinearGradient(0, 0, 0, horizon);
            gradSky.addColorStop(0, "#0099cc"); gradSky.addColorStop(1, "#99ccff");
            ctx.fillStyle = gradSky; ctx.fillRect(0, 0, w, horizon);
            // Chão
            ctx.fillStyle = '#3dae36'; ctx.fillRect(0, horizon, w, h);

            // Pista
            const topW = w * 0.02; const botW = w * 1.4;
            const curveOff = d.curve * (w * 0.4);
            ctx.fillStyle = '#555'; ctx.beginPath();
            ctx.moveTo(cx + curveOff - topW, horizon); ctx.lineTo(cx + curveOff + topW, horizon);
            ctx.lineTo(cx + botW, h); ctx.lineTo(cx - botW, h); ctx.fill();

            // Zebras
            ctx.strokeStyle = (Math.floor(d.pos/30)%2===0) ? '#cc0000' : '#fff';
            ctx.lineWidth = w * 0.08; ctx.beginPath();
            ctx.moveTo(cx + curveOff, horizon); 
            ctx.quadraticCurveTo(cx + (curveOff*0.5), h*0.7, cx, h); ctx.stroke();

            // Obstáculos
            if(Math.random() < 0.02 && d.speed > 5) d.obs.push({x:(Math.random()*2)-1, z:1000}); 
            d.obs.forEach((o, i) => {
                o.z -= d.speed * 2; if(o.z < -100) { d.obs.splice(i,1); return; }
                const scale = 500 / (o.z + 100);
                if(scale > 0 && o.z < 1000) {
                    const ox = cx + (d.curve*w*0.3*(1-o.z/1000)) + (o.x*w*0.5*scale);
                    const oy = (h * 0.4) + (50 * scale);
                    const sz = (w * 0.1) * scale;
                    ctx.fillStyle = '#ff4400'; ctx.beginPath(); 
                    ctx.moveTo(ox, oy-sz); ctx.lineTo(ox-sz/3, oy); ctx.lineTo(ox+sz/3, oy); ctx.fill();
                    if(o.z < 100 && o.z > 0 && Math.abs(d.x - o.x) < 0.35) {
                        d.speed *= 0.2; window.Sfx.crash(); d.obs.splice(i,1);
                    }
                }
            });

            // --- 4. KART (CORREÇÃO DE SPLIT) ---
            const carX = cx + (d.x * w * 0.25);
            const carY = h * 0.85;
            const s = w * 0.004;
            
            // TRAVA DE SEGURANÇA: Limita o efeito visual entre -25 e 25 pixels
            // Isso impede que as rodas "fujam" do carro se você girar muito
            let visualTurn = d.steer * 20; 
            visualTurn = Math.max(-25, Math.min(25, visualTurn)); 

            ctx.save();
            ctx.translate(carX, carY);
            ctx.scale(s, s);

            // Sombra
            ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(0, 15, 35, 12, 0, 0, Math.PI*2); ctx.fill();
            // Rodas Traseiras (Fixas)
            ctx.fillStyle = '#222'; ctx.fillRect(-30, 0, 12, 18); ctx.fillRect(18, 0, 12, 18);
            // Chassi
            ctx.fillStyle = '#d32f2f'; ctx.beginPath(); ctx.roundRect(-22, -20, 44, 45, 6); ctx.fill();
            // Motor
            ctx.fillStyle = '#444'; ctx.fillRect(-12, 20, 24, 8);
            
            // Rodas Dianteiras (Móveis com limite)
            ctx.fillStyle = '#222';
            ctx.fillRect(-28 + visualTurn, -22, 10, 14); 
            ctx.fillRect(18 + visualTurn, -22, 10, 14);

            // Capacete
            ctx.fillStyle = '#ffeb3b'; ctx.beginPath(); ctx.arc(visualTurn * 0.5, -5, 11, 0, Math.PI*2); ctx.fill();
            // Volante
            ctx.strokeStyle = '#111'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(-8 + visualTurn, -12); ctx.lineTo(8 + visualTurn, -12); ctx.stroke();
            ctx.restore();

            // --- 5. NÍVEL DE BOLINHA (BUBBLE LEVEL UI) ---
            // Desenha um medidor de nível logo abaixo do kart
            const levelY = h * 0.75;
            const levelW = w * 0.4;
            const levelH = 20;
            
            // Tubo do nível
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.beginPath(); ctx.roundRect(cx - levelW/2, levelY, levelW, levelH, 10); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
            
            // Marcações centrais
            ctx.beginPath(); ctx.moveTo(cx - 20, levelY); ctx.lineTo(cx - 20, levelY + levelH); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx + 20, levelY); ctx.lineTo(cx + 20, levelY + levelH); ctx.stroke();

            // A Bolinha (Responde inversamente à inclinação, como um nível real)
            // Limitamos a bolinha dentro do tubo
            let bubbleX = cx - (d.steer * (levelW * 0.8)); 
            bubbleX = Math.max(cx - levelW/2 + 10, Math.min(cx + levelW/2 - 10, bubbleX));
            
            // Cor da bolinha muda: Verde (Nivelado) vs Amarelo (Inclinado)
            ctx.fillStyle = (Math.abs(d.steer) < 0.1) ? '#00ff00' : '#ffff00';
            ctx.beginPath(); ctx.arc(bubbleX, levelY + levelH/2, 8, 0, Math.PI*2); ctx.fill();
            
            // Texto de ajuda
            ctx.fillStyle = '#fff'; ctx.font = "12px Arial"; ctx.textAlign = "center";
            ctx.fillText("NÍVEL", cx, levelY - 5);

            // --- 6. LINHA GUIA DAS MÃOS ---
            // Ajuda visual para ver a inclinação detectada
            if(pose) {
                const kp=pose.keypoints;
                const lw=kp.find(k=>k.name==='left_wrist');
                const rw=kp.find(k=>k.name==='right_wrist');
                if(lw && rw && lw.score > 0.3 && rw.score > 0.3) {
                    const p1 = window.Gfx.map(lw, w, h);
                    const p2 = window.Gfx.map(rw, w, h);
                    
                    ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 5]);
                    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
                    ctx.setLineDash([]);
                }
            }

            // Luvas Finais
            if(window.Gfx && window.Gfx.drawSteeringHands) window.Gfx.drawSteeringHands(ctx, pose, w, h);

            return Math.floor(d.pos/100);
        }
    };

    if(window.System) {
        window.System.registerGame('drive', 'Kart do Otto', '🏎️', Logic, {camOpacity: 0.5, showWheel: true});
    }
})();
