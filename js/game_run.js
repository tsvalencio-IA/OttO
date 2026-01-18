// LÓGICA DO JOGO: OTTO RUNNER
(function() {
    const Logic = {
        lane: 0, score: 0, frame: 0, obs: [],
        init: () => { Logic.score=0; Logic.obs=[]; System.msg("CORRA!"); },
        update: (ctx, w, h, pose) => {
            const r = Logic; const cx = w/2; r.frame++;
            if(pose) {
                const nose = pose.keypoints.find(k=>k.name==='nose');
                if(nose && nose.score > 0.4) {
                    if(nose.x < 210) r.lane = 1; else if(nose.x > 430) r.lane = -1; else r.lane = 0;
                }
            }
            if(r.frame%50===0) r.obs.push({l: Math.floor(Math.random()*3)-1, z: 1000});
            
            ctx.clearRect(0,0,w,h);
            ctx.fillStyle = '#111'; ctx.fillRect(0,0,w,h);
            ctx.strokeStyle='#00ffcc'; ctx.lineWidth=1;
            ctx.beginPath(); ctx.moveTo(cx - (w*0.3), h/2); ctx.lineTo(0,h); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx + (w*0.3), h/2); ctx.lineTo(w,h); ctx.stroke();

            r.obs.forEach((o, i) => {
                o.z -= 20; 
                if(o.z < -100) { r.obs.splice(i,1); r.score+=10; Sfx.coin(); }
                const scale = 500/(o.z+100);
                if(scale > 0) {
                    const laneWidth = w * 0.3; const ox = cx + (o.l * laneWidth * scale);
                    const oy = h/2 + (50 * scale); const sz = (w * 0.15) * scale;
                    ctx.fillStyle = '#ff3300'; ctx.fillRect(ox-sz/2, oy, sz, sz);
                    if(o.z < 50 && o.z > -50 && o.l === r.lane) { System.gameOver(r.score); }
                }
            });

            ctx.save(); ctx.translate(cx + (r.lane * w * 0.25), h * 0.85);
            const pScale = w * 0.005; ctx.scale(pScale, pScale);
            ctx.strokeStyle='#00ff00'; ctx.lineWidth=3; ctx.lineCap='round';
            const s = Math.sin(r.frame*0.5)*10;
            ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-15); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-8+s, 20); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(8-s, 20); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0,-12); ctx.lineTo(-10-s, -5); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0,-12); ctx.lineTo(10+s, -5); ctx.stroke();
            ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(0,-22,5,0,Math.PI*2); ctx.fill();
            ctx.restore();
            return r.score;
        }
    };

    if(window.System) {
        System.registerGame('run', 'Otto Runner', '🏃', Logic, {camOpacity: 0.3, showWheel: false});
    }
})();
