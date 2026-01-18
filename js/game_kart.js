// LÓGICA DO JOGO: KART DO OTTO
(function() {
    const Logic = {
        speed: 0, pos: 0, x: 0, steer: 0, curve: 0, obs: [],
        init: () => { 
            Logic.speed=0; Logic.pos=0; Logic.x=0; Logic.obs=[]; 
            System.msg("SEGURE O VOLANTE!"); 
        },
        update: (ctx, w, h, pose) => {
            const d = Logic; const cx = w/2;
            
            // 1. INPUT (Volante)
            let targetAngle = 0;
            if(pose) {
                const kp = pose.keypoints;
                const lw = kp.find(k=>k.name==='left_wrist'), rw = kp.find(k=>k.name==='right_wrist');
                if(lw && rw && lw.score>0.3 && rw.score>0.3) {
                    const dy = rw.y - lw.y; 
                    const dx = rw.x - lw.x;
                    targetAngle = Math.atan2(dy, dx) * 1.5 * System.sens;
                    if(d.speed < h*0.05) d.speed += h*0.0005; 
                } else { d.speed *= 0.95; }
            }
            d.steer += (targetAngle - d.steer) * 0.2;
            
            const wheel = document.getElementById('visual-wheel');
            if(wheel) wheel.style.transform = `rotate(${d.steer * 57}deg)`;

            // 2. OBSTÁCULOS
            if(Math.random() < 0.02 && d.speed > 5) d.obs.push({x: (Math.random()*2)-1, z: 1000}); 

            // 3. FÍSICA
            d.pos += d.speed;
            d.curve = Math.sin(d.pos * 0.005) * 1.5;
            d.x += d.steer * (d.speed / (h*0.5));
            d.x -= d.curve * (d.speed / (h));
            if(Math.abs(d.x) > 1.3) { d.speed *= 0.9; }

            // 4. DESENHO
            const Gfx = window.Gfx; // Acesso ao global
            
            // Estrada
            ctx.fillStyle = '#111'; ctx.fillRect(0,0,w,h);
            const horizon = h * 0.4;
            ctx.strokeStyle = '#00ffcc'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, horizon); ctx.lineTo(w, horizon); ctx.stroke();
            ctx.fillStyle = '#333'; ctx.beginPath();
            const topW = w * 0.05, botW = w * 1.2, curveOffset = d.curve * (w * 0.3);
            ctx.moveTo(cx + curveOffset - topW, horizon); ctx.lineTo(cx + curveOffset + topW, horizon);
            ctx.lineTo(cx + botW, h); ctx.lineTo(cx - botW, h); ctx.fill();
            ctx.strokeStyle = '#ffeb3b'; ctx.lineWidth = w * 0.02; ctx.setLineDash([h*0.05, h*0.05]); ctx.lineDashOffset = -d.pos;
            ctx.beginPath(); ctx.moveTo(cx + curveOffset, horizon); ctx.quadraticCurveTo(cx + (curveOffset*0.5), h*0.7, cx, h); ctx.stroke(); ctx.setLineDash([]);

            // Obstáculos
            d.obs.forEach((o, i) => {
                o.z -= (d.speed * 2);
                if(o.z < -100) { d.obs.splice(i,1); return; }
                const scale = 500/(o.z+100);
                if(scale > 0 && o.z < 1000) {
                    const cOff = d.curve * (w * 0.3) * (1 - (o.z/1000));
                    const ox = cx + cOff + (o.x * w * 0.5 * scale);
                    const oy = (h * 0.4) + (50 * scale);
                    const sz = (w * 0.08) * scale;
                    ctx.fillStyle = '#ff9900'; ctx.beginPath(); ctx.moveTo(ox, oy - sz); ctx.lineTo(ox - sz/2, oy); ctx.lineTo(ox + sz/2, oy); ctx.fill();
                    if(o.z < 100 && o.z > 0 && Math.abs(d.x - o.x) < 0.3) {
                        d.speed *= 0.5; Sfx.skid(); d.obs.splice(i,1); ctx.fillStyle = 'rgba(255,0,0,0.5)'; ctx.fillRect(0,0,w,h);
                    }
                }
            });

            // Carro
            const carX = cx + (d.x * w * 0.25);
            ctx.save(); ctx.translate(carX, h * 0.85); ctx.rotate(d.steer); const s = w * 0.003; ctx.scale(s, s); 
            ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(-25, -10, 50, 40);
            ctx.fillStyle = '#ff0033'; ctx.beginPath(); ctx.roundRect(-20, -20, 40, 40, 5); ctx.fill();
            ctx.fillStyle = '#111'; ctx.fillRect(-15, -10, 30, 10);
            ctx.fillStyle = '#ffcc00'; ctx.fillRect(-18, -18, 8, 5); ctx.fillRect(10, -18, 8, 5);
            ctx.restore();

            // Mãos Virtuais
            Gfx.drawSteeringHands(ctx, pose, w, h);

            return Math.floor(d.pos/100);
        }
    };

    // REGISTRO NO PAINEL
    if(window.System) {
        System.registerGame('drive', 'Kart do Otto', '🏎️', Logic, {camOpacity: 0.5, showWheel: true});
    }
})();
