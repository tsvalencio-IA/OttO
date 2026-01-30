// =============================================================================
// LÓGICA DO JOGO: OTTO BOXING (LUIGI'S GYM WII EDITION)
// ARQUITETO: SENIOR DEV V3 (RESTAURAÇÃO DE CENÁRIO E AVATAR)
// =============================================================================

(function() {
    let tg = [], lastSpawn = 0;
    const CONF = { DURATION: 120, TARGET_RATE: 850, COLOR_LUIGI: '#40a832' };

    const Logic = {
        sc: 0, 
        state: 'MODE_SELECT', 
        timeLeft: 120, 
        startTime: 0,
        // Estrutura do Jogador
        player: { 
            head: {x:0, y:0}, 
            wrists: {l:{x:0,y:0}, r:{x:0,y:0}}, 
            shoulders: {l:{x:0,y:0}, r:{x:0,y:0}} 
        },
        rivals: [], 
        isOnline: false, 
        dbRef: null,

        init: function() { 
            this.sc = 0; 
            tg = []; 
            this.state = 'MODE_SELECT'; 
            window.System.msg("SELECIONE O MODO");
        },

        selectMode: function(mode) {
            this.state = 'play'; 
            this.startTime = Date.now();
            if(mode === 'ONLINE') {
                this.isOnline = true; 
                this.connectMultiplayer();
                window.System.msg("A CONECTAR...");
            } else {
                window.System.msg("LUIGI TIME!");
            }
        },

        connectMultiplayer: function() {
            this.dbRef = window.DB.ref('rooms/box_01');
            this.dbRef.child('players/' + window.System.playerId).onDisconnect().remove();
            this.dbRef.child('players').on('value', snap => {
                const data = snap.val(); 
                if(!data) return;
                this.rivals = Object.keys(data)
                    .filter(id => id !== window.System.playerId)
                    .map(id => ({ id, ...data[id] }));
            });
        },

        update: function(ctx, w, h, pose) {
            if(this.state === 'MODE_SELECT') { 
                this.drawMenu(ctx, w, h); 
                return 0; 
            }

            // --- 1. RENDERIZAÇÃO DO CENÁRIO (RINGUE) ---
            this.drawScenery(ctx, w, h);

            // --- 2. PROCESSAMENTO DE MOVIMENTO ---
            if(pose) {
                const map = window.Gfx.map;
                const kp = pose.keypoints;
                const get = (name) => { 
                    const k = kp.find(p => p.name === name); 
                    return (k && k.score > 0.3) ? map(k, w, h) : null; 
                };
                
                const n = get('nose'); 
                const lw = get('left_wrist'); 
                const rw = get('right_wrist');
                const ls = get('left_shoulder'); 
                const rs = get('right_shoulder');

                if(n) this.player.head = n;
                if(lw) this.player.wrists.l = lw; 
                if(rw) this.player.wrists.r = rw;
                if(ls) this.player.shoulders.l = ls; 
                if(rs) this.player.shoulders.r = rs;
            }

            // --- 3. RENDERIZAÇÃO DE JOGADORES ---
            // Rivais (Fantasmas)
            this.rivals.forEach(r => {
                ctx.save(); 
                ctx.globalAlpha = 0.3;
                this.drawLuigi(ctx, r, '#ff5555', w);
                ctx.restore();
            });

            // Luigi (Jogador Atual)
            this.drawLuigi(ctx, this.player, CONF.COLOR_LUIGI, w);

            // --- 4. LÓGICA DE ALVOS (TREINO) ---
            const now = Date.now();
            if(now - lastSpawn > CONF.TARGET_RATE) {
                tg.push({ 
                    x: w*0.2 + Math.random()*w*0.6, 
                    y: h*0.2 + Math.random()*h*0.4, 
                    r: 50, 
                    life: 100 
                });
                lastSpawn = now;
            }

            for(let i = tg.length - 1; i >= 0; i--) {
                let t = tg[i]; 
                t.life--;
                if(t.life <= 0) { tg.splice(i, 1); continue; }
                
                // Desenha Alvo estilo Wii Boxing
                ctx.fillStyle = '#ff9800'; 
                ctx.beginPath(); 
                ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); 
                ctx.fill();
                ctx.strokeStyle = 'white'; 
                ctx.lineWidth = 5; 
                ctx.stroke();

                // Colisão com as Luvas
                [this.player.wrists.l, this.player.wrists.r].forEach(wr => {
                    if(wr.x && Math.hypot(wr.x - t.x, wr.y - t.y) < t.r + 40) {
                        this.sc += 50; 
                        window.Sfx.hit(); 
                        tg.splice(i, 1);
                    }
                });
            }

            // Sincronização Online
            if(this.isOnline && now % 5 === 0) {
                this.dbRef.child('players/' + window.System.playerId).update({
                    head: this.player.head, 
                    wrists: this.player.wrists, 
                    sc: this.sc, 
                    lastSeen: firebase.database.ServerValue.TIMESTAMP
                });
            }

            return this.sc;
        },

        drawScenery: function(ctx, w, h) {
            ctx.fillStyle = '#1a1a1a'; 
            ctx.fillRect(0, 0, w, h);
            
            // Cordas do Ringue (Perspectiva)
            ctx.strokeStyle = '#f44336'; ctx.lineWidth = 12; // Corda Superior
            ctx.beginPath(); ctx.moveTo(0, h * 0.4); ctx.lineTo(w, h * 0.4); ctx.stroke();
            
            ctx.strokeStyle = '#2196f3'; ctx.lineWidth = 12; // Corda Inferior
            ctx.beginPath(); ctx.moveTo(0, h * 0.6); ctx.lineTo(w, h * 0.6); ctx.stroke();
            
            // Tapete do Ringue com Degradê
            const grad = ctx.createLinearGradient(0, h * 0.6, 0, h);
            grad.addColorStop(0, '#2c3e50'); 
            grad.addColorStop(1, '#111111');
            ctx.fillStyle = grad; 
            ctx.fillRect(0, h * 0.6, w, h * 0.4);
        },

        drawLuigi: function(ctx, p, color, w) {
            if(!p.head || !p.head.x) return;
            const s = w * 0.005;
            
            // 1. Corpo (Macacão)
            ctx.fillStyle = color;
            ctx.beginPath(); 
            ctx.ellipse(p.head.x, p.head.y + 120, 55, 90, 0, 0, Math.PI * 2); 
            ctx.fill();
            
            // 2. Cabeça
            ctx.fillStyle = '#ffccaa'; // Pele
            ctx.beginPath(); 
            ctx.arc(p.head.x, p.head.y, 45, 0, Math.PI * 2); 
            ctx.fill();
            
            // 3. Boné
            ctx.fillStyle = color;
            ctx.beginPath(); 
            ctx.arc(p.head.x, p.head.y - 12, 50, Math.PI, 0); 
            ctx.fill();
            
            // 4. Luvas (Wrists detetados)
            [p.wrists.l, p.wrists.r].forEach(wr => {
                if(!wr || !wr.x) return;
                ctx.fillStyle = 'white';
                ctx.beginPath(); 
                ctx.arc(wr.x, wr.y, 42, 0, Math.PI * 2); 
                ctx.fill();
                ctx.strokeStyle = '#dddddd'; 
                ctx.lineWidth = 3; 
                ctx.stroke();
            });
        },

        drawMenu: function(ctx, w, h) {
            ctx.fillStyle = '#111111'; 
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#ffffff'; 
            ctx.textAlign = 'center'; 
            ctx.font = "bold 35px 'Russo One'";
            ctx.fillText("BOXE LUIGI: SELECIONE O MODO", w / 2, h / 2 - 40);
            
            ctx.font = "22px sans-serif";
            ctx.fillText("ESQUERDA: SOLO | DIREITA: ONLINE", w / 2, h / 2 + 20);
            
            if(!window.System.canvas.onclick) {
                window.System.canvas.onclick = (e) => {
                    const rect = window.System.canvas.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    this.selectMode(x < w / 2 ? 'OFFLINE' : 'ONLINE');
                    window.System.canvas.onclick = null;
                };
            }
        },

        cleanup: function() { 
            if(this.dbRef) this.dbRef.child('players/' + window.System.playerId).remove(); 
            window.System.canvas.onclick = null;
        }
    };

    window.System.registerGame('box', 'Luigi Boxe', '🥊', Logic, {camOpacity: 0.15});
})();
