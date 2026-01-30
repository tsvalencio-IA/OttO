/* =================================================================
   LÓGICA DO JOGO: OTTO SUPER RUN (CORRIGIDO E PERSPECTIVA REAL)
   ================================================================= */

(function() {
    let obs = []; let f = 0; let sc = 0; let lane = 0; let currentX = 0;
    const CONF = { SPEED: 25, HORIZON: 0.4 };

    const Logic = {
        state: 'MODE_SELECT',
        init: function() { sc = 0; obs = []; lane = 0; currentX = 0; this.state = 'MODE_SELECT'; },

        update: function(ctx, w, h, pose) {
            if(this.state === 'MODE_SELECT') { this.drawMenu(ctx, w, h); return 0; }
            f++;

            // Background
            ctx.fillStyle = '#87CEEB'; ctx.fillRect(0, 0, w, h * CONF.HORIZON);
            ctx.fillStyle = '#4CAF50'; ctx.fillRect(0, h * CONF.HORIZON, w, h * (1 - CONF.HORIZON));

            // Pista Perspectiva
            ctx.fillStyle = '#555';
            ctx.beginPath();
            ctx.moveTo(w*0.45, h*CONF.HORIZON); ctx.lineTo(w*0.55, h*CONF.HORIZON);
            ctx.lineTo(w*1.2, h); ctx.lineTo(-w*0.2, h);
            ctx.fill();

            // Input Pose (Mirror Corrected)
            if(pose) {
                const n = pose.keypoints.find(k => k.name === 'nose');
                if(n && n.score > 0.4) {
                    const nx = n.x / 640; 
                    if(nx < 0.35) lane = 1; else if(nx > 0.65) lane = -1; else lane = 0;
                }
            }
            
            currentX += (lane * (w * 0.25) - currentX) * 0.15;

            // Spawn Obstáculos
            if(f % 60 === 0) obs.push({ z: 1000, lane: Math.floor(Math.random()*3)-1, type: 'block' });

            for(let i=obs.length-1; i>=0; i--) {
                let o = obs[i]; o.z -= CONF.SPEED;
                if(o.z < 0) { obs.splice(i,1); sc += 10; continue; }

                const scale = 300 / (300 + o.z);
                const ox = w/2 + (o.lane * (w*0.4) * scale);
                const oy = h*CONF.HORIZON + (h*0.6 * scale);
                const size = 100 * scale;

                ctx.fillStyle = '#ff5722';
                ctx.fillRect(ox - size/2, oy - size, size, size);

                // Colisão
                if(o.z < 50 && o.z > 0 && o.lane === lane) {
                    window.System.gameOver(sc);
                }
            }

            // Jogador (Costas)
            this.drawPlayer(ctx, w/2 + currentX, h*0.9, w);

            return sc;
        },

        drawPlayer: function(ctx, x, y, w) {
            const s = w * 0.005;
            ctx.fillStyle = 'red'; ctx.fillRect(x - 20, y - 60, 40, 60);
            ctx.fillStyle = 'blue'; ctx.fillRect(x - 25, y - 30, 50, 10);
            ctx.fillStyle = '#4a3222'; ctx.beginPath(); ctx.arc(x, y-75, 20, 0, Math.PI*2); ctx.fill();
        },

        drawMenu: function(ctx, w, h) {
            ctx.fillStyle = '#222'; ctx.fillRect(0,0,w,h);
            ctx.fillStyle = 'white'; ctx.textAlign = 'center'; ctx.font = "bold 30px sans-serif";
            ctx.fillText("TOQUE PARA INICIAR CORRIDA", w/2, h/2);
            if(!window.System.canvas.onclick) {
                window.System.canvas.onclick = () => { this.state = 'play'; window.System.canvas.onclick = null; };
            }
        }
    };
    window.System.registerGame('run', 'Otto Super Run', '🏃', Logic, {camOpacity: 0.3});
})();
