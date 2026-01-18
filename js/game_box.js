// LÓGICA DO JOGO: OTTO BOXING
(function() {
    const Logic = {
        score: 0, targets: [], last: 0,
        init: () => { Logic.score=0; Logic.targets=[]; System.msg("BOXE!"); },
        update: (ctx, w, h, pose) => {
            const f = Logic; const now = Date.now();
            ctx.clearRect(0,0,w,h);
            
            // Desenha Esqueleto
            window.Gfx.drawSkeleton(ctx, pose, w, h);
            
            let punches = [];
            if(pose) {
                const kp = pose.keypoints;
                const lw = kp.find(k=>k.name==='left_wrist');
                const rw = kp.find(k=>k.name==='right_wrist');
                // Detecta socos mapeados
                if(lw && lw.score>0.3) punches.push(window.Gfx.mapPoint(lw, w, h));
                if(rw && rw.score>0.3) punches.push(window.Gfx.mapPoint(rw, w, h));
            }

            if(now - f.last > 800) {
                const tx = (Math.random() * (w * 0.8)) + (w * 0.1);
                const ty = (Math.random() * (h * 0.5)) + (h * 0.1);
                f.targets.push({x: tx, y: ty, r: w*0.08, s: now});
                f.last = now;
            }

            f.targets.forEach((t, i) => {
                const age = (now - t.s)/1500;
                if(age>1) { f.targets.splice(i,1); return; }
                
                ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI*2);
                ctx.fillStyle=`rgba(255,255,0,${1-age})`; ctx.fill();
                ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.stroke();
                
                punches.forEach(p => {
                    if(Math.hypot(p.x - t.x, p.y - t.y) < t.r + (w*0.05)) {
                        f.targets.splice(i,1); f.score += 100; Sfx.hit();
                    }
                });
            });
            return f.score;
        }
    };

    if(window.System) {
        System.registerGame('fight', 'Otto Boxing', '🥊', Logic, {camOpacity: 0.3, showWheel: false});
    }
})();
