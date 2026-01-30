// =============================================================================
// LÓGICA DO JOGO: OTTO BOXING (MULTIPLAYER SHADOW EDITION)
// =============================================================================

(function() {
    let particles = [];
    let popups = [];

    const CONF = {
        GAME_DURATION: 120, TARGET_SPAWN_RATE: 700,
        COLORS: { SHIRT: '#40a832', GLOVE: '#ffffff' }
    };

    const Logic = {
        sc: 0, tg: [], lastSpawn: 0, timeLeft: 0, startTime: 0, state: 'intro',
        
        player: { head: {x:0,y:0}, wrists: {l:{x:0,y:0}, r:{x:0,y:0}} },
        
        // Multiplayer
        roomId: 'room_box_01', isOnline: false, rivals: [], dbRef: null, lastSync: 0,

        init: function() { 
            this.sc = 0; this.tg = []; particles = []; popups = [];
            this.state = 'MODE_SELECT';
            this.resetMultiplayerState();
            window.System.msg("SELECIONE MODO"); 
        },

        resetMultiplayerState: function() {
            this.isOnline = false; this.rivals = [];
            if(this.dbRef) try{this.dbRef.child('players').off();}catch(e){}
        },

        selectMode: function(mode) {
            if(mode === 'ONLINE') {
                if(!window.DB) { window.System.msg("SEM REDE!"); this.selectMode('OFFLINE'); return; }
                this.isOnline = true;
                this.connectMultiplayer();
                window.System.msg("CONECTANDO...");
            } else {
                this.isOnline = false;
                window.System.msg("OFFLINE");
            }
            this.startGame();
        },

        connectMultiplayer: function() {
            this.dbRef = window.DB.ref('rooms/' + this.roomId);
            this.dbRef.child('players/' + window.System.playerId).set({
                sc: 0, lastSeen: firebase.database.ServerValue.TIMESTAMP
            });
            this.dbRef.child('players/' + window.System.playerId).onDisconnect().remove();

            this.dbRef.child('players').on('value', snap => {
                const data = snap.val(); if(!data) return;
                const now = Date.now();
                this.rivals = Object.keys(data)
                    .filter(id => id !== window.System.playerId && (now - data[id].lastSeen < 10000))
                    .map(id => ({ id, ...data[id] }));
            });
        },

        startGame: function() {
            this.state = 'play'; this.timeLeft = CONF.GAME_DURATION; this.startTime = Date.now();
            window.System.msg("LUTE!"); window.Sfx.play(600, 'square', 0.5, 0.1);
        },

        sync: function() {
            if(!this.isOnline) return;
            if(Date.now() - this.lastSync > 100) {
                this.lastSync = Date.now();
                // Otimização: Enviamos apenas partes essenciais
                this.dbRef.child('players/' + window.System.playerId).update({
                    sc: this.sc,
                    head: this.player.head,
                    wrists: this.player.wrists,
                    lastSeen: firebase.database.ServerValue.TIMESTAMP
                });
            }
        },

        update: function(ctx, w, h, pose) {
            // MENU
            if(this.state === 'MODE_SELECT') {
                ctx.fillStyle = '#222'; ctx.fillRect(0,0,w,h);
                ctx.fillStyle = '#fff'; ctx.textAlign='center'; ctx.font="30px Arial";
                ctx.fillText("ESQUERDA: OFFLINE | DIREITA: ONLINE", w/2, h/2);
                
                // Hack simples de clique
                if(window.System.canvas.onclick === null) {
                    window.System.canvas.onclick = (e) => {
                        const x = e.clientX;
                        this.selectMode(x < w/2 ? 'OFFLINE' : 'ONLINE');
                        window.System.canvas.onclick = null;
                    };
                }
                return 0;
            }

            const now = Date.now();
            if (this.state === 'play') {
                const elapsed = (now - this.startTime) / 1000;
                this.timeLeft = Math.max(0, CONF.GAME_DURATION - elapsed);
                if (this.timeLeft <= 0) { this.state = 'finished'; window.System.gameOver(Math.floor(this.sc)); }
            }

            // FUNDO
            ctx.fillStyle = '#111'; ctx.fillRect(0,0,w,h);
            // Ringue
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)'; ctx.lineWidth = 6;
            ctx.beginPath(); ctx.moveTo(0, h*0.4); ctx.lineTo(w, h*0.4); ctx.stroke();

            // INPUT
            this.updatePlayerPose(pose, w, h);

            // DESENHA RIVAIS (Fantasmas ao fundo)
            this.rivals.forEach((r, i) => {
                ctx.save(); ctx.globalAlpha = 0.4;
                // Offset para não ficar em cima
                const offsetX = (i + 1) * 100;
                ctx.translate(offsetX, 0); 
                // Se tiver dados de pose, desenha
                if(r.head && r.wrists) {
                    this.drawAvatar(ctx, r.head, r.wrists, '#ff0000', w, h);
                }
                ctx.restore();
            });

            // DESENHA JOGADOR
            this.drawAvatar(ctx, this.player.head, this.player.wrists, CONF.COLORS.SHIRT, w, h);

            // ALVOS
            if (this.state === 'play') {
                if (now - this.lastSpawn > CONF.TARGET_SPAWN_RATE) {
                    this.tg.push({
                        x: (w/2 - w*0.3) + Math.random() * (w*0.6), y: (h*0.2) + Math.random() * (h*0.4),
                        r: w*0.07, born: now, life: 2000
                    });
                    this.lastSpawn = now;
                }

                for (let i = this.tg.length - 1; i >= 0; i--) {
                    let t = this.tg[i];
                    if (now - t.born > t.life) { this.tg.splice(i, 1); continue; }

                    // Colisão
                    const hands = [this.player.wrists.l, this.player.wrists.r];
                    let hit = false;
                    hands.forEach(h => { if (h.x!==0 && Math.hypot(h.x-t.x, h.y-t.y) < t.r+20) hit = true; });

                    if (hit) {
                        this.sc += 50; window.Sfx.hit(); this.tg.splice(i, 1);
                        popups.push({x:t.x, y:t.y, text:"+50", life:1.0});
                    } else {
                        // Desenha Alvo
                        ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI*2);
                        ctx.fillStyle = 'orange'; ctx.fill(); ctx.lineWidth=4; ctx.strokeStyle='white'; ctx.stroke();
                    }
                }
            }

            // HUD
            ctx.fillStyle = '#fff'; ctx.font = "bold 40px Arial"; ctx.textAlign='left';
            ctx.fillText(`SCORE: ${this.sc}`, 20, 50);
            ctx.fillText(`TIME: ${Math.floor(this.timeLeft)}`, 20, 90);
            
            // Placar Rival
            this.rivals.forEach((r, i) => {
                ctx.font = "20px Arial"; ctx.fillStyle = "#aaa";
                ctx.fillText(`Rival ${i+1}: ${r.sc || 0}`, 20, 130 + (i*25));
            });

            // Popups
            popups.forEach((p,i)=>{
                p.y -= 2; p.life -= 0.05;
                if(p.life<=0) popups.splice(i,1);
                else { ctx.fillStyle=`rgba(255,255,255,${p.life})`; ctx.fillText(p.text, p.x, p.y); }
            });

            this.sync();
            return this.sc;
        },

        updatePlayerPose: function(pose, w, h) {
            if (!pose || !pose.keypoints) return;
            const find = (n) => {
                const k = pose.keypoints.find(p => p.name === n);
                // Mapeamento Seguro
                return (k && k.score > 0.3) ? { x: (1 - k.x/640)*w, y: (k.y/480)*h } : null;
            };
            const n = find('nose'); const lw = find('left_wrist'); const rw = find('right_wrist');
            
            // Lerp simples
            const lerp = (c, t) => t ? { x: c.x+(t.x-c.x)*0.5, y: c.y+(t.y-c.y)*0.5 } : c;
            
            if(n) this.player.head = lerp(this.player.head, n);
            if(lw) this.player.wrists.l = lerp(this.player.wrists.l, lw);
            if(rw) this.player.wrists.r = lerp(this.player.wrists.r, rw);
        },

        drawAvatar: function(ctx, head, wrists, color, w, h) {
            if(head.x === 0) return;
            
            // Cabeça
            ctx.beginPath(); ctx.arc(head.x, head.y, 40, 0, Math.PI*2); 
            ctx.fillStyle = '#ffccaa'; ctx.fill();
            
            // Luvas
            [wrists.l, wrists.r].forEach(wr => {
                if(wr.x === 0) return;
                ctx.beginPath(); ctx.arc(wr.x, wr.y, 35, 0, Math.PI*2);
                ctx.fillStyle = '#fff'; ctx.fill();
                ctx.strokeStyle = '#ccc'; ctx.lineWidth=3; ctx.stroke();
            });
        }
    };

    if(window.System) window.System.registerGame('box', 'Otto Boxing', '🥊', Logic, {camOpacity: 0.2});
})();
