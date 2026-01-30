/* =================================================================
   LÓGICA DO JOGO: OTTO TENNIS PRO (FÍSICA 3D)
   ================================================================= */

(function() {
    let ball = { x:0, y:0, z:1000, vx:0, vy:0, vz:-15 };
    let sc = 0; let hand = {x:0, y:0};

    const Logic = {
        init: function() { sc = 0; ball = { x:0, y:0, z:1000, vx:2, vy:0, vz:-20 }; },

        update: function(ctx, w, h, pose) {
            ctx.fillStyle = '#2e7d32'; ctx.fillRect(0,0,w,h);
            
            // Rede
            ctx.strokeStyle = 'white'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(0, h*0.5); ctx.lineTo(w, h*0.5); ctx.stroke();

            if(pose) {
                const rw = pose.keypoints.find(k => k.name === 'right_wrist');
                if(rw && rw.score > 0.4) hand = window.Gfx.map(rw, w, h);
            }

            // Física Bola
            ball.x += ball.vx; ball.z += ball.vz;
            if(ball.z < 0) {
                // Rebate
                if(Math.hypot(w/2 + ball.x - hand.x, h*0.7 - hand.y) < 100) {
                    ball.vz *= -1.1; ball.vx = (Math.random()-0.5)*10;
                    sc++; window.Sfx.coin();
                } else { window.System.gameOver(sc); }
            }
            if(ball.z > 1200) ball.vz *= -1;
            if(Math.abs(ball.x) > 400) ball.vx *= -1;

            // Render Bola
            const scale = 400 / (400 + ball.z);
            const bx = w/2 + ball.x * scale;
            const by = h*0.5 + 200 * scale;
            
            ctx.fillStyle = '#ccff00';
            ctx.beginPath(); ctx.arc(bx, by, 20*scale, 0, Math.PI*2); ctx.fill();

            // Raquete
            ctx.strokeStyle = 'white'; ctx.lineWidth = 5;
            ctx.beginPath(); ctx.ellipse(hand.x, hand.y, 40, 60, 0, 0, Math.PI*2); ctx.stroke();

            return sc;
        }
    };
    window.System.registerGame('tennis', 'Otto Tennis Pro', '🎾', Logic, {camOpacity: 0.4});
})();
