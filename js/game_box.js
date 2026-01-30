/* =================================================================
   LÓGICA DO JOGO: OTTO BOXING (AVATAR MII COMPLETO)
   ================================================================= */

(function() {
    let tg = []; let lastSpawn = 0; let sc = 0;
    const CONF = { GLOVE_SIZE: 45, DURATION: 120 };

    const Logic = {
        state: 'MODE_SELECT',
        player: { head: {x:0,y:0}, wrists: {l:{x:0,y:0}, r:{x:0,y:0}}, shoulders: {l:{x:0,y:0}, r:{x:0,y:0}} },
        rivals: [], isOnline: false,

        init: function() {
            sc = 0; tg = []; this.state = 'MODE_SELECT';
        },

        update: function(ctx, w, h, pose) {
            if(this.state === 'MODE_SELECT') {
                this.drawModeMenu(ctx, w, h);
                return 0;
            }

            // Background Ringue
            ctx.fillStyle = '#111'; ctx.fillRect(0,0,w,h);
            ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
            for(let i=0; i<w; i+=40) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,h); ctx.stroke(); }

            if(pose) {
                const map = window.Gfx.map;
                const n = pose.keypoints.find(k => k.name === 'nose');
                const lw = pose.keypoints.find(k => k.name === 'left_wrist');
                const rw = pose.keypoints.find(k => k.name === 'right_wrist');
                const ls = pose.keypoints.find(k => k.name === 'left_shoulder');
                const rs = pose.keypoints.find(k => k.name === 'right_shoulder');
                
                if(n && n.score > 0.3) this.player.head = map(n, w, h);
                if(lw && lw.score > 0.3) this.player.wrists.l = map(lw, w, h);
                if(rw && rw.score > 0.3) this.player.wrists.r = map(rw, w, h);
                if(ls && ls.score > 0.3) this.player.shoulders.l = map(ls, w, h);
                if(rs && rs.score > 0.3) this.player.shoulders.r = map(rs, w, h);
            }

            // Desenha Avatar do Jogador (Mii Style)
            this.drawAvatar(ctx, this.player, '#4caf50', w);

            // Alvos
            if(Date.now() - lastSpawn > 800) {
                tg.push({ x: w*0.2 + Math.random()*w*0.6, y: h*0.2 + Math.random()*h*0.4, r: 50, life: 100 });
                lastSpawn = Date.now();
            }

            for(let i=tg.length-1; i>=0; i--) {
                let t = tg[i]; t.life--;
                if(t.life <= 0) { tg.splice(i,1); continue; }
                
                ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI*2);
                ctx.fillStyle = 'rgba(255, 152, 0, 0.8)'; ctx.fill();
                ctx.strokeStyle = 'white'; ctx.lineWidth = 4; ctx.stroke();

                // Colisão com Luvas
                [this.player.wrists.l, this.player.wrists.r].forEach(p => {
                    if(Math.hypot(p.x - t.x, p.y - t.y) < t.r + CONF.GLOVE_SIZE) {
                        sc += 50; window.Sfx.hit(); tg.splice(i,1);
                    }
                });
            }

            return sc;
        },

        drawAvatar: function(ctx, p, color, w) {
            if(!p.head.x) return;
            const s = w * 0.005;

            // Corpo
            const cx = (p.shoulders.l.x + p.shoulders.r.x) / 2 || p.head.x;
            const cy = (p.shoulders.l.y + p.shoulders.r.y) / 2 || p.head.y + 100;
            
            ctx.fillStyle = color;
            ctx.beginPath(); ctx.ellipse(cx, cy + 50, 60, 100, 0, 0, Math.PI*2); ctx.fill();
            
            // Cabeça
            ctx.fillStyle = '#ffccaa';
            ctx.beginPath(); ctx.arc(p.head.x, p.head.y, 45, 0, Math.PI*2); ctx.fill();

            // Luvas
            [p.wrists.l, p.wrists.r].forEach((wr, i) => {
                if(!wr.x) return;
                ctx.fillStyle = 'white';
                ctx.beginPath(); ctx.arc(wr.x, wr.y, CONF.GLOVE_SIZE, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = '#ddd'; ctx.lineWidth = 3; ctx.stroke();
            });
        },

        drawModeMenu: function(ctx, w, h) {
            ctx.fillStyle = '#222'; ctx.fillRect(0,0,w,h);
            ctx.fillStyle = 'white'; ctx.textAlign = 'center'; ctx.font = "bold 40px 'Russo One'";
            ctx.fillText("BOXE: ESCOLHA O MODO", w/2, h*0.3);
            
            const drawBtn = (x, y, txt, c) => {
                ctx.fillStyle = c; ctx.fillRect(x - 200, y, 400, 80);
                ctx.fillStyle = 'white'; ctx.font = "bold 25px sans-serif";
                ctx.fillText(txt, x, y + 50);
            };

            drawBtn(w/2, h*0.45, "SOLO (OFFLINE)", "#e67e22");
            drawBtn(w/2, h*0.60, "VERSUS (ONLINE)", "#27ae60");

            if(!window.System.canvas.onclick) {
                window.System.canvas.onclick = (e) => {
                    const rect = window.System.canvas.getBoundingClientRect();
                    const y = e.clientY - rect.top;
                    if(y > h*0.45 && y < h*0.55) { this.state = 'play'; this.isOnline = false; window.System.msg("START!"); }
                    if(y > h*0.60 && y < h*0.70) { this.state = 'play'; this.isOnline = true; window.System.msg("BUSCANDO RIVAL..."); }
                    window.System.canvas.onclick = null;
                };
            }
        }
    };

    window.System.registerGame('box', 'Luigi Boxe', '🥊', Logic, {camOpacity: 0.1});
})();
