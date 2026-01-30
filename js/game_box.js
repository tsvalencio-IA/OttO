// =============================================================================
// LÓGICA DO JOGO: SUPER BOXE WII (SOLO & MULTIPLAYER - FULL BODY)
// ARQUITETO: PARCEIRO DE PROGRAMAÇÃO
// =============================================================================

(function() {
    let particles = [];
    let popups = [];

    // --- CONFIGURAÇÕES ---
    const CONF = {
        GAME_DURATION: 99,
        GRAVITY: 0.4,
        TARGET_SPAWN_RATE: 700, // Ms entre bolas no modo solo
        
        // Definição Visual dos Personagens
        CHARS: {
            'luigi': { 
                name: 'Otto', 
                color: '#40a832', // Verde
                skin: '#ffccaa', 
                hat: '#40a832', 
                gloves: '#ffffff' 
            },
            'mario': { 
                name: 'Thiago', 
                color: '#ff0000', // Vermelho
                skin: '#ffccaa', 
                hat: '#ff0000', 
                gloves: '#ffffff' 
            },
            'peach': { 
                name: 'Thamis', 
                color: '#ff69b4', // Rosa
                skin: '#ffe5b4', 
                hat: '#ffd700',   // Coroa Dourada
                gloves: '#ffffff' 
            }
        }
    };

    const Logic = {
        // Estado
        state: 'CHAR_SELECT', // CHAR_SELECT -> MODE_SELECT -> PLAY (Solo) / VERSUS (Multi) -> FINISHED
        mode: 'SOLO',
        
        // Dados de Jogo
        sc: 0,
        hp: 100,
        enemyHp: 100,
        timeLeft: 0,
        startTime: 0,
        
        // Objetos Solo
        tg: [],
        lastSpawn: 0,
        
        // Multiplayer
        roomId: 'arena_box_01',
        isOnline: false,
        rivals: [],
        dbRef: null,
        lastHitTime: 0,
        
        // Jogador Local
        myChar: 'luigi',
        player: {
            head: {x:0, y:0},
            shoulders: {l:{x:0,y:0}, r:{x:0,y:0}},
            elbows: {l:{x:0,y:0}, r:{x:0,y:0}},
            wrists: {l:{x:0,y:0}, r:{x:0,y:0}},
            isBlocking: false
        },

        // --- INICIALIZAÇÃO ---
        init: function() { 
            this.sc = 0; 
            this.hp = 100; 
            this.tg = []; 
            particles = []; 
            popups = [];
            this.rivals = [];
            this.state = 'CHAR_SELECT'; 
            this.resetMultiplayerState();
            window.System.msg("ESCOLHA SEU LUTADOR"); 
        },

        resetMultiplayerState: function() {
            this.isOnline = false;
            if(this.dbRef && window.System.playerId) {
                try { this.dbRef.child('players/' + window.System.playerId).remove(); } catch(e){}
                try { this.dbRef.child('players').off(); } catch(e){}
            }
        },

        // --- MENUS ---
        selectChar: function(charKey) {
            this.myChar = charKey;
            window.Sfx.click();
            this.state = 'MODE_SELECT';
            window.System.msg("MODO DE JOGO?");
        },

        selectMode: function(mode) {
            this.mode = mode;
            this.startTime = Date.now();
            this.timeLeft = CONF.GAME_DURATION;
            
            if (mode === 'VERSUS') {
                if(!window.DB) { 
                    window.System.msg("OFFLINE: TREINO");
                    this.selectMode('SOLO');
                    return; 
                }
                this.isOnline = true;
                this.hp = 100;
                this.connectMultiplayer();
                window.System.msg("A PROCURAR RIVAL...");
                this.state = 'VERSUS';
            } else {
                this.isOnline = false;
                this.sc = 0;
                this.tg = [];
                window.System.msg("TREINO INICIADO!"); 
                window.Sfx.play(600, 'square', 0.5, 0.1);
                this.state = 'PLAY';
            }
        },

        connectMultiplayer: function() {
            this.dbRef = window.DB.ref('rooms/' + this.roomId);
            
            const myData = {
                char: this.myChar,
                hp: 100,
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            };
            this.dbRef.child('players/' + window.System.playerId).set(myData);
            this.dbRef.child('players/' + window.System.playerId).onDisconnect().remove();

            this.dbRef.child('players').on('value', snap => {
                const data = snap.val(); if(!data) return;
                const now = Date.now();
                this.rivals = Object.keys(data)
                    .filter(id => id !== window.System.playerId && (now - data[id].lastSeen < 10000))
                    .map(id => ({ id, ...data[id] }));
                
                if(this.rivals.length > 0) this.enemyHp = this.rivals[0].hp || 0;
            });
        },

        // --- LOOP PRINCIPAL ---
        update: function(ctx, w, h, pose) {
            // Menus
            if (this.state === 'CHAR_SELECT') { this.drawCharSelect(ctx, w, h); return 0; }
            if (this.state === 'MODE_SELECT') { this.drawModeSelect(ctx, w, h); return 0; }

            const now = Date.now();
            
            // Tempo / Fim de Jogo
            if (this.state === 'PLAY' || this.state === 'VERSUS') {
                const elapsed = (now - this.startTime) / 1000;
                this.timeLeft = Math.max(0, CONF.GAME_DURATION - elapsed);

                if (this.timeLeft <= 0 || (this.mode === 'VERSUS' && this.hp <= 0)) {
                    this.state = 'FINISHED';
                    let msg = "FIM DE TREINO";
                    if(this.mode === 'VERSUS') msg = this.hp > 0 ? "VITÓRIA!" : "NOCAUTEADO!";
                    window.System.gameOver(this.mode === 'SOLO' ? this.sc : msg);
                    return this.sc;
                }
            }

            // Fundo e Ringue
            this.drawBackground(ctx, w, h);

            // Input (Câmara)
            this.updatePlayerPose(pose, w, h);

            // Lógica
            if (this.mode === 'SOLO') {
                this.updateSolo(ctx, w, h, now);
            } else {
                this.updateVersus(ctx, w, h, now);
            }

            // Desenha o Jogador (Full Body)
            this.drawCharacter(ctx, this.player, this.myChar, w, true);

            // UI e Efeitos
            this.renderEffects(ctx);
            this.drawHUD(ctx, w, h);

            // Sync
            if(this.isOnline) this.sync();

            return this.sc;
        },

        // --- MODO SOLO (BOLAS) ---
        updateSolo: function(ctx, w, h, now) {
            // Spawn
            if (now - this.lastSpawn > CONF.TARGET_SPAWN_RATE) {
                const rangeX = w * 0.4;
                const cX = w / 2;
                this.tg.push({
                    x: (cX - rangeX/2) + Math.random() * rangeX,
                    y: (h * 0.2) + Math.random() * (h * 0.4),
                    r: w * 0.07, born: now, life: 2000,
                    color: Math.random() > 0.5 ? '#ff4444' : '#4444ff'
                });
                this.lastSpawn = now;
            }

            const hitboxes = [this.player.wrists.l, this.player.wrists.r];

            for (let i = this.tg.length - 1; i >= 0; i--) {
                let t = this.tg[i];
                if (now - t.born > t.life) { this.tg.splice(i, 1); continue; }

                let hit = false;
                hitboxes.forEach(hand => {
                    if (hand.x !== 0 && Math.hypot(hand.x - t.x, hand.y - t.y) < t.r + 30) hit = true;
                });

                if (hit) {
                    this.sc += 50;
                    window.Sfx.hit();
                    this.spawnParticles(t.x, t.y, 10, t.color);
                    popups.push({x:t.x, y:t.y, text:"+50", life:1.0, dy:-3});
                    this.tg.splice(i, 1);
                } else {
                    // Render Alvo
                    const pct = 1 - ((now - t.born) / t.life);
                    ctx.save(); ctx.translate(t.x, t.y); ctx.scale(pct, pct);
                    ctx.beginPath(); ctx.arc(0, 0, t.r, 0, Math.PI*2);
                    ctx.fillStyle = t.color; ctx.fill();
                    ctx.lineWidth=4; ctx.strokeStyle='white'; ctx.stroke();
                    ctx.restore();
                }
            }
        },

        // --- MODO VERSUS (LUTA) ---
        updateVersus: function(ctx, w, h, now) {
            this.rivals.forEach(rival => {
                if(!rival.pose) return;

                // Desenha Rival (Holograma semi-transparente)
                ctx.save(); ctx.globalAlpha = 0.7;
                this.drawCharacter(ctx, rival.pose, rival.char || 'mario', w, false);
                ctx.restore();

                // Lógica de Soco (Eu bato no rival)
                const myHands = [this.player.wrists.l, this.player.wrists.r];
                const rivalHead = rival.pose.head;

                if(rivalHead && rivalHead.x !== 0) {
                    myHands.forEach(hand => {
                        if(hand.x !== 0 && Math.hypot(hand.x - rivalHead.x, hand.y - rivalHead.y) < 80) {
                            if(now - this.lastHitTime > 500) { // Cooldown
                                const isBlocked = rival.pose.isBlocking;
                                const dmg = isBlocked ? 2 : 10;
                                
                                window.Sfx.hit();
                                const color = isBlocked ? '#ffff00' : '#ff0000';
                                const txt = isBlocked ? "DEFESA" : "HIT!";
                                this.spawnParticles(rivalHead.x, rivalHead.y, 15, color);
                                popups.push({x: rivalHead.x, y: rivalHead.y, text: txt, life: 1.0, dy: -5});
                                
                                this.dbRef.child('players/' + rival.id).update({
                                    hp: (rival.hp || 100) - dmg
                                });
                                this.lastHitTime = now;
                            }
                        }
                    });
                }
            });
        },

        // --- POSE (CÂMERA) ---
        updatePlayerPose: function(pose, w, h) {
            if (!pose || !pose.keypoints) return;
            
            const find = (n) => {
                const k = pose.keypoints.find(p => p.name === n);
                // Mapeamento com ZOOM OUT (0.8x) para caber no ecrã e espelhado
                if (k && k.score > 0.3) {
                    // (1 - x) espelha horizontalmente
                    const nx = (1 - k.x/640) * w;
                    const ny = (k.y/480) * h;
                    // Aplica zoom out (centraliza e escala)
                    return { 
                        x: (nx - w/2) * 0.75 + w/2, 
                        y: (ny - h/2) * 0.75 + h/2 + 50 // +50 desce um pouco
                    };
                }
                return {x:0, y:0};
            };

            // Lerp para suavizar
            const lerp = (c, t) => t.x!==0 ? { x: c.x+(t.x-c.x)*0.5, y: c.y+(t.y-c.y)*0.5 } : c;

            this.player.head = lerp(this.player.head, find('nose'));
            this.player.shoulders.l = lerp(this.player.shoulders.l, find('left_shoulder'));
            this.player.shoulders.r = lerp(this.player.shoulders.r, find('right_shoulder'));
            this.player.elbows.l = lerp(this.player.elbows.l, find('left_elbow'));
            this.player.elbows.r = lerp(this.player.elbows.r, find('right_elbow'));
            this.player.wrists.l = lerp(this.player.wrists.l, find('left_wrist'));
            this.player.wrists.r = lerp(this.player.wrists.r, find('right_wrist'));

            // Detetar Defesa
            const p = this.player;
            if(p.head.x !== 0) {
                const dl = Math.hypot(p.wrists.l.x - p.head.x, p.wrists.l.y - p.head.y);
                const dr = Math.hypot(p.wrists.r.x - p.head.x, p.wrists.r.y - p.head.y);
                this.player.isBlocking = (dl < 90 || dr < 90);
            }
        },

        // --- DESENHO DO PERSONAGEM (BONECO) ---
        drawCharacter: function(ctx, p, charKey, w, isSelf) {
            const charData = CONF.CHARS[charKey] || CONF.CHARS['luigi'];
            const color = charData.color;

            // Função para desenhar membros
            const drawLimb = (p1, p2, width) => {
                if(p1.x === 0 || p2.x === 0) return;
                ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
                ctx.lineWidth = width; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.stroke();
            };

            // Tronco (ligar ombros)
            drawLimb(p.shoulders.l, p.shoulders.r, 40);
            
            // Braços
            drawLimb(p.shoulders.l, p.elbows.l, 25);
            drawLimb(p.elbows.l, p.wrists.l, 20);
            drawLimb(p.shoulders.r, p.elbows.r, 25);
            drawLimb(p.elbows.r, p.wrists.r, 20);

            // Se cotovelo falhar, liga direto
            if(p.elbows.l.x===0) drawLimb(p.shoulders.l, p.wrists.l, 20);
            if(p.elbows.r.x===0) drawLimb(p.shoulders.r, p.wrists.r, 20);

            // Cabeça
            if(p.head.x !== 0) {
                // Pele
                ctx.fillStyle = charData.skin;
                ctx.beginPath(); ctx.arc(p.head.x, p.head.y, 45, 0, Math.PI*2); ctx.fill();
                
                // Chapéu
                ctx.fillStyle = charData.hat;
                ctx.beginPath(); ctx.arc(p.head.x, p.head.y - 15, 47, Math.PI, 0); ctx.fill();
                ctx.beginPath(); ctx.ellipse(p.head.x, p.head.y - 15, 50, 15, 0, 0, Math.PI*2); ctx.fill();
            }

            // Luvas
            const drawGlove = (pos) => {
                if(pos.x === 0) return;
                ctx.beginPath(); ctx.arc(pos.x, pos.y, 40, 0, Math.PI*2);
                ctx.fillStyle = charData.gloves; ctx.fill();
                ctx.lineWidth = 3; ctx.strokeStyle = '#ccc'; ctx.stroke();
                // Detalhe cor
                ctx.fillStyle = color; ctx.fillRect(pos.x - 20, pos.y + 15, 40, 10);
            };
            drawGlove(p.wrists.l);
            drawGlove(p.wrists.r);

            // Escudo de Defesa
            if(p.isBlocking) {
                ctx.strokeStyle = '#ffff00'; ctx.lineWidth = 5;
                ctx.beginPath(); ctx.arc(p.head.x, p.head.y, 70, 0, Math.PI*2); ctx.stroke();
            }
        },

        drawBackground: function(ctx, w, h) {
            ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0,0,w,h);
            ctx.lineWidth = 8;
            ctx.strokeStyle = '#d32f2f'; ctx.beginPath(); ctx.moveTo(0, h*0.3); ctx.lineTo(w, h*0.3); ctx.stroke();
            ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, h*0.5); ctx.lineTo(w, h*0.5); ctx.stroke();
            ctx.strokeStyle = '#1976d2'; ctx.beginPath(); ctx.moveTo(0, h*0.7); ctx.lineTo(w, h*0.7); ctx.stroke();
        },

        drawHUD: function(ctx, w, h) {
            ctx.fillStyle = '#fff'; ctx.font = "bold 40px 'Russo One'"; ctx.textAlign = 'center';
            ctx.fillText(Math.ceil(this.timeLeft), w/2, 60);

            if (this.mode === 'VERSUS') {
                const drawBar = (x, val, color, label) => {
                    const bw = w * 0.35;
                    ctx.fillStyle = '#333'; ctx.fillRect(x, 70, bw, 20);
                    ctx.fillStyle = color; ctx.fillRect(x+2, 72, (bw-4)*(val/100), 16);
                    ctx.fillStyle = '#fff'; ctx.font = "bold 16px sans-serif"; ctx.textAlign = 'left';
                    ctx.fillText(label, x, 65);
                };
                drawBar(20, this.hp, '#0f0', 'PLAYER 1');
                drawBar(w - 20 - (w*0.35), this.enemyHp, '#f00', 'RIVAL');
            } else {
                ctx.textAlign = 'left'; ctx.fillText(`SCORE: ${this.sc}`, 20, 60);
            }
        },

        drawCharSelect: function(ctx, w, h) {
            ctx.fillStyle = '#111'; ctx.fillRect(0,0,w,h);
            ctx.fillStyle = '#fff'; ctx.textAlign='center'; ctx.font = "bold 40px 'Russo One'";
            ctx.fillText("ESCOLHA PERSONAGEM", w/2, h*0.2);

            const chars = Object.keys(CONF.CHARS);
            const gap = w / (chars.length + 1);

            chars.forEach((key, i) => {
                const cx = gap * (i+1);
                const cy = h*0.5;
                const c = CONF.CHARS[key];
                
                ctx.fillStyle = '#333'; ctx.fillRect(cx-70, cy-70, 140, 140);
                ctx.strokeStyle = c.color; ctx.lineWidth = 4; ctx.strokeRect(cx-70, cy-70, 140, 140);
                
                ctx.fillStyle = c.color; ctx.beginPath(); ctx.arc(cx, cy, 40, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = c.hat; ctx.beginPath(); ctx.arc(cx, cy-15, 42, Math.PI, 0); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.font = "bold 20px sans-serif"; ctx.fillText(c.name, cx, cy+100);
            });

            if(!window.System.canvas.onclick) {
                window.System.canvas.onclick = (e) => {
                    const x = e.clientX;
                    if(x < w/3) this.selectChar('luigi');
                    else if(x < w*2/3) this.selectChar('mario');
                    else this.selectChar('peach');
                    window.System.canvas.onclick = null;
                };
            }
        },

        drawModeSelect: function(ctx, w, h) {
            ctx.fillStyle = '#111'; ctx.fillRect(0,0,w,h);
            ctx.fillStyle = '#fff'; ctx.textAlign='center'; ctx.font="bold 30px sans-serif";
            ctx.fillText("CIMA: TREINO SOLO", w/2, h*0.4);
            ctx.fillText("BAIXO: LUTA ONLINE", w/2, h*0.6);

            if(!window.System.canvas.onclick) {
                window.System.canvas.onclick = (e) => {
                    const y = e.clientY;
                    this.selectMode(y < h*0.55 ? 'SOLO' : 'VERSUS');
                    window.System.canvas.onclick = null;
                };
            }
        },

        renderEffects: function(ctx) {
            particles.forEach((p,i)=>{
                p.x += p.vx; p.y += p.vy; p.life -= 0.05;
                if(p.life <= 0) particles.splice(i,1);
                else {
                    ctx.fillStyle = p.color; ctx.globalAlpha = p.life;
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
                }
            });
            popups.forEach((p,i)=>{
                p.y += p.dy; p.life -= 0.02;
                if(p.life <= 0) popups.splice(i,1);
                else {
                    ctx.fillStyle = "#fff"; ctx.globalAlpha = p.life;
                    ctx.font = "italic 900 40px 'Roboto'"; 
                    ctx.strokeStyle = "#000"; ctx.lineWidth = 4;
                    ctx.strokeText(p.text, p.x, p.y); ctx.fillText(p.text, p.x, p.y);
                }
            });
            ctx.globalAlpha = 1.0;
        },

        spawnParticles: function(x, y, color) {
            for(let i=0; i<10; i++){
                particles.push({
                    x: x, y: y,
                    vx: (Math.random()-0.5)*15, vy: (Math.random()-0.5)*15,
                    color: color, life: 1.0, size: Math.random() * 8
                });
            }
        },

        sync: function() {
            if(!this.isOnline || !this.dbRef) return;
            if(Date.now() % 50 < 20) {
                this.dbRef.child('players/' + window.System.playerId).update({
                    pose: this.player,
                    hp: this.hp,
                    lastSeen: firebase.database.ServerValue.TIMESTAMP
                });
            }
        }
    };

    window.System.registerGame('box', 'Super Boxe', '🥊', Logic, {camOpacity: 0.15});
})();
