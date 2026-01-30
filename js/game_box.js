// =============================================================================
// LÓGICA DO JOGO: LUIGI BOXING (1ST PERSON VIEW RESTORED)
// ARQUITETO: SENIOR DEV V3
// =============================================================================

(function() {
    const CONF = {
        DURATION: 99,
        SPAWN_RATE: 800,
        COLORS: { HAT: '#40a832', SHIRT: '#40a832', OVERALL: '#2b3a8f', SKIN: '#ffccaa' }
    };

    let particles = [], popups = [];

    const Logic = {
        sc: 0, state: 'MODE_SELECT', timeLeft: 99, startTime: 0,
        tg: [], lastSpawn: 0,
        
        // Estado Físico do Jogador (Suavizado)
        player: {
            head: {x:0, y:0},
            shoulders: {l:{x:0,y:0}, r:{x:0,y:0}},
            elbows: {l:{x:0,y:0}, r:{x:0,y:0}},
            wrists: {l:{x:0,y:0}, r:{x:0,y:0}},
            hp: 100
        },

        isOnline: false, roomId: 'room_box_01', dbRef: null, opponent: null,

        init: function() { 
            this.sc = 0; this.tg = []; particles = []; popups = [];
            this.state = 'MODE_SELECT';
            this.player.hp = 100;
            window.System.msg("LUIGI BOXING");
        },

        selectMode: function(mode) {
            this.state = 'play';
            this.startTime = Date.now();
            this.timeLeft = CONF.DURATION;
            if(mode === 'ONLINE') {
                if(!window.DB) { this.selectMode('OFFLINE'); return; }
                this.isOnline = true;
                this.connectMultiplayer();
                window.System.msg("FIGHT ONLINE!");
            } else {
                window.System.msg("TREINO!");
            }
            window.Sfx.play(600, 'square', 0.5, 0.2);
        },

        connectMultiplayer: function() {
            this.dbRef = window.DB.ref('rooms/' + this.roomId);
            const myRef = this.dbRef.child('players/' + window.System.playerId);
            myRef.set({ hp: 100, lastSeen: firebase.database.ServerValue.TIMESTAMP });
            myRef.onDisconnect().remove();

            this.dbRef.child('players').on('value', snap => {
                const data = snap.val(); if(!data) return;
                const oppId = Object.keys(data).find(id => id !== window.System.playerId);
                if(oppId) {
                    this.opponent = { id: oppId, ...data[oppId] };
                } else { this.opponent = null; }
            });
        },

        update: function(ctx, w, h, pose) {
            const now = Date.now();

            if(this.state === 'MODE_SELECT') { this.drawMenu(ctx, w, h); return 0; }
            if(this.state === 'finished') return this.sc;

            // Tempo
            if(this.state === 'play') {
                const elapsed = (now - this.startTime) / 1000;
                this.timeLeft = Math.max(0, CONF.DURATION - elapsed);
                if(this.timeLeft <= 0 || this.player.hp <= 0) {
                    this.state = 'finished';
                    window.System.gameOver(Math.floor(this.sc));
                }
            }

            // 1. FUNDO (RINGUE)
            this.drawRing(ctx, w, h);

            // 2. POSE (AVATAR)
            this.updatePlayerPose(pose, w, h);
            
            // Desenha Oponente (se Online) ou Saco de Pancada (Treino)
            if(this.isOnline && this.opponent) {
                this.drawOpponent(ctx, w, h);
            } else {
                // Lógica de Alvos (Treino)
                if(now - this.lastSpawn > CONF.SPAWN_RATE) {
                    const range = w * 0.3;
                    this.tg.push({
                        x: (w/2 - range) + Math.random()*(range*2),
                        y: h*0.3 + Math.random()*(h*0.3),
                        r: w*0.06, born: now, life: 2000
                    });
                    this.lastSpawn = now;
                }

                // Render Alvos
                for (let i = this.tg.length - 1; i >= 0; i--) {
                    let t = this.tg[i];
                    let pct = 1 - ((now - t.born) / t.life);
                    if(pct <= 0) { this.tg.splice(i, 1); continue; }

                    // Desenha Alvo
                    ctx.save(); ctx.translate(t.x, t.y); ctx.scale(pct, pct);
                    ctx.beginPath(); ctx.arc(0,0,t.r,0,Math.PI*2); 
                    ctx.fillStyle = ctx.createRadialGradient(-10,-10,5,0,0,t.r);
                    ctx.fillStyle.addColorStop(0, '#ffaa00'); ctx.fillStyle.addColorStop(1, '#cc5500');
                    ctx.fill(); ctx.strokeStyle='#fff'; ctx.lineWidth=4; ctx.stroke();
                    ctx.restore();

                    // Colisão
                    [this.player.wrists.l, this.player.wrists.r].forEach(wr => {
                        if(wr.x !== 0 && Math.hypot(wr.x - t.x, wr.y - t.y) < t.r + 30) {
                            this.sc += 50; window.Sfx.hit(); window.System.msg("POW!");
                            this.spawnParticles(t.x, t.y, 10, '#ffff00');
                            this.tg.splice(i, 1);
                        }
                    });
                }
            }

            // 3. DESENHA AVATAR (1ª PESSOA)
            this.drawLuigiAvatar(ctx, w, h);

            // HUD
            this.drawHUD(ctx, w, h);
            this.renderEffects(ctx);

            // Sync
            if(this.isOnline && now % 5 === 0) {
                this.dbRef.child('players/' + window.System.playerId).update({
                    head: this.player.head, wrists: this.player.wrists, shoulders: this.player.shoulders, elbows: this.player.elbows,
                    hp: this.player.hp, lastSeen: firebase.database.ServerValue.TIMESTAMP
                });
            }

            return this.sc;
        },

        updatePlayerPose: function(pose, w, h) {
            if (!pose || !pose.keypoints) return;
            const kp = pose.keypoints;
            const find = (n) => {
                const k = kp.find(p => p.name === n);
                return (k && k.score > 0.3) ? window.Gfx.map(k, w, h) : null;
            };

            // Lerp para suavizar movimento
            const lerp = (c, t) => t ? { x: c.x + (t.x - c.x) * 0.4, y: c.y + (t.y - c.y) * 0.4 } : c;

            const n = find('nose'); if(n) this.player.head = lerp(this.player.head, n);
            const ls = find('left_shoulder'); if(ls) this.player.shoulders.l = lerp(this.player.shoulders.l, ls);
            const rs = find('right_shoulder'); if(rs) this.player.shoulders.r = lerp(this.player.shoulders.r, rs);
            const le = find('left_elbow'); if(le) this.player.elbows.l = lerp(this.player.elbows.l, le);
            const re = find('right_elbow'); if(re) this.player.elbows.r = lerp(this.player.elbows.r, re);
            const lw = find('left_wrist'); if(lw) this.player.wrists.l = lerp(this.player.wrists.l, lw);
            const rw = find('right_wrist'); if(rw) this.player.wrists.r = lerp(this.player.wrists.r, rw);
        },

        drawLuigiAvatar: function(ctx, w, h) {
            const p = this.player;
            if(p.shoulders.l.x === 0) return;

            // Escala baseada na largura dos ombros
            const sDist = Math.hypot(p.shoulders.r.x - p.shoulders.l.x, p.shoulders.r.y - p.shoulders.l.y);
            const scale = sDist / 120; 

            // Braços
            const drawArm = (s, e, w) => {
                if(s.x === 0 || e.x === 0 || w.x === 0) return;
                ctx.lineWidth = 30 * scale; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                ctx.strokeStyle = CONF.COLORS.SHIRT;
                ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(e.x, e.y); ctx.lineTo(w.x, w.y); ctx.stroke();
            };
            drawArm(p.shoulders.l, p.elbows.l, p.wrists.l);
            drawArm(p.shoulders.r, p.elbows.r, p.wrists.r);

            // Luvas
            const drawGlove = (pos) => {
                if(pos.x === 0) return;
                const r = 40 * scale;
                const g = ctx.createRadialGradient(pos.x-10, pos.y-10, 5, pos.x, pos.y, r);
                g.addColorStop(0, '#fff'); g.addColorStop(1, '#ddd');
                ctx.fillStyle = g; ctx.beginPath(); ctx.arc(pos.x, pos.y, r, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = '#aaa'; ctx.lineWidth = 2; ctx.stroke();
            };
            drawGlove(p.wrists.l);
            drawGlove(p.wrists.r);
        },

        drawOpponent: function(ctx, w, h) {
            // Desenha fantasma do oponente
            const o = this.opponent;
            if(!o.head) return;

            ctx.save(); ctx.globalAlpha = 0.6;
            
            // Cabeça
            ctx.fillStyle = '#ff5555'; ctx.beginPath(); ctx.arc(o.head.x, o.head.y, 40, 0, Math.PI*2); ctx.fill();
            
            // Luvas do Oponente
            const drawOGlove = (pos) => {
                if(!pos || pos.x === 0) return;
                ctx.fillStyle = '#ff0000'; ctx.beginPath(); ctx.arc(pos.x, pos.y, 40, 0, Math.PI*2); ctx.fill();
                
                // Hitbox detection (Eu batendo nele)
                [this.player.wrists.l, this.player.wrists.r].forEach(wr => {
                    if(Math.hypot(wr.x - pos.x, wr.y - pos.y) < 60) {
                        // Bloqueio!
                        window.Sfx.play(150, 'sawtooth', 0.1, 0.1);
                        this.spawnParticles(pos.x, pos.y, 5, '#aaa');
                    }
                });
            };
            drawOGlove(o.wrists?.l);
            drawOGlove(o.wrists?.r);

            // Hitbox Cabeça (Acerto)
            [this.player.wrists.l, this.player.wrists.r].forEach(wr => {
                if(Math.hypot(wr.x - o.head.x, wr.y - o.head.y) < 70) {
                    window.Sfx.hit();
                    this.sc += 10;
                    this.spawnParticles(o.head.x, o.head.y, 10, '#ff0000');
                    // Idealmente enviaríamos o dano via DB, mas por simplicidade apenas visual aqui
                }
            });

            ctx.restore();
        },

        drawRing: function(ctx, w, h) {
            // Fundo e Holofotes
            const grad = ctx.createRadialGradient(w/2, 0, 100, w/2, h, w);
            grad.addColorStop(0, '#333'); grad.addColorStop(1, '#111');
            ctx.fillStyle = grad; ctx.fillRect(0,0,w,h);

            // Cordas
            ctx.strokeStyle = '#d32f2f'; ctx.lineWidth = 8;
            ctx.beginPath(); ctx.moveTo(0, h*0.4); ctx.lineTo(w, h*0.4); ctx.stroke();
            ctx.strokeStyle = '#fff'; 
            ctx.beginPath(); ctx.moveTo(0, h*0.6); ctx.lineTo(w, h*0.6); ctx.stroke();
            ctx.strokeStyle = '#1976d2'; 
            ctx.beginPath(); ctx.moveTo(0, h*0.8); ctx.lineTo(w, h*0.8); ctx.stroke();
        },

        drawHUD: function(ctx, w, h) {
            // Tempo LCD
            ctx.fillStyle = '#000'; ctx.beginPath(); ctx.roundRect(w/2-60, 20, 120, 50, 10); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
            ctx.fillStyle = this.timeLeft < 10 ? '#f00' : '#0f0';
            ctx.font = "bold 30px 'Russo One'"; ctx.textAlign = 'center';
            ctx.fillText(Math.floor(this.timeLeft), w/2, 57);

            // Barra de Vida
            ctx.fillStyle = '#555'; ctx.fillRect(20, 20, 200, 20);
            ctx.fillStyle = this.player.hp > 30 ? '#0f0' : '#f00';
            ctx.fillRect(22, 22, 196 * (this.player.hp/100), 16);
        },
        
        drawMenu: function(ctx, w, h) {
            ctx.fillStyle = '#000'; ctx.fillRect(0,0,w,h);
            ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = "bold 40px 'Russo One'";
            ctx.fillText("BOXE LUIGI", w/2, h/2 - 40);
            ctx.font = "20px sans-serif";
            ctx.fillText("ESQUERDA: TREINO | DIREITA: ONLINE", w/2, h/2 + 30);
            
            if(!window.System.canvas.onclick) {
                window.System.canvas.onclick = (e) => {
                    const rect = window.System.canvas.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    this.selectMode(x < w / 2 ? 'OFFLINE' : 'ONLINE');
                    window.System.canvas.onclick = null;
                };
            }
        },

        spawnParticles: function(x, y, count, color) {
            for(let i=0; i<count; i++) particles.push({x, y, vx:(Math.random()-0.5)*15, vy:(Math.random()-0.5)*15, life:1.0, color});
        },
        
        renderEffects: function(ctx) {
            particles.forEach((p, i) => {
                p.x += p.vx; p.y += p.vy; p.life -= 0.05;
                if(p.life <= 0) particles.splice(i,1);
                else { ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill(); }
            });
            ctx.globalAlpha = 1;
        }
    };

    window.System.registerGame('box', 'Luigi Box', '🥊', Logic, {camOpacity: 0.1});
})();
