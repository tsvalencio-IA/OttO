// =============================================================================
// LÓGICA DO JOGO: PRO BOXING LEAGUE (WII STYLE - PUNCH OUT EDITION)
// =============================================================================

(function() {
    // --- EFEITOS VISUAIS ---
    let particles = [];
    let texts = [];
    let shake = 0;

    // --- CONFIGURAÇÕES ---
    const CONF = {
        DURATION: 99,
        GRAVITY: 0.5,
        // Personagens com paletas de cores estilo Nintendo
        CHARS: {
            'mario': { 
                name: 'RED FIRE', 
                skin: '#ffccaa', shirt: '#ff0000', gloves: '#ffffff', pants: '#0000aa' 
            },
            'luigi': { 
                name: 'GREEN THUNDER', 
                skin: '#ffccaa', shirt: '#00aa00', gloves: '#ffffff', pants: '#0000aa' 
            },
            'peach': { 
                name: 'PRINCESS PWR', 
                skin: '#ffe5b4', shirt: '#ff69b4', gloves: '#ffffff', pants: '#ffffff' 
            },
            'mac': {
                name: 'LITTLE MAC',
                skin: '#d2b48c', shirt: '#000000', gloves: '#00ff00', pants: '#006400'
            }
        }
    };

    const Logic = {
        // Máquina de Estados
        state: 'CHAR_SELECT', // CHAR_SELECT -> READY -> FIGHT -> KO
        mode: 'SOLO',         // SOLO (Saco de pancada) ou VERSUS (Online)
        
        // Estado do Jogo
        myChar: 'mario',
        hp: 100,
        enemyHp: 100,
        stamina: 100,
        timeLeft: CONF.DURATION,
        startTime: 0,
        
        // Física
        player: { 
            nose: {x:0, y:0}, 
            left_shoulder: {x:0, y:0}, right_shoulder: {x:0, y:0},
            left_elbow: {x:0, y:0}, right_elbow: {x:0, y:0},
            left_wrist: {x:0, y:0}, right_wrist: {x:0, y:0},
            blocking: false,
            punching: false
        },
        
        // Elementos Solo
        bag: { x: 0, y: 0, hp: 1000, swing: 0 },

        // Multiplayer
        roomId: 'boxing_arena_pro',
        isOnline: false,
        rival: null, // Objeto com dados do rival
        dbRef: null,
        lastHitId: 0,

        // --- INICIALIZAÇÃO ---
        init: function() {
            this.hp = 100;
            this.enemyHp = 100;
            this.stamina = 100;
            this.state = 'CHAR_SELECT';
            particles = [];
            texts = [];
            this.resetNet();
            window.System.msg("ESCOLHA SEU LUTADOR");
        },

        resetNet: function() {
            this.isOnline = false;
            this.rival = null;
            if(window.DB && window.System.playerId) {
                try { window.DB.ref(`rooms/${this.roomId}/players/${window.System.playerId}`).remove(); } catch(e){}
                try { window.DB.ref(`rooms/${this.roomId}/players`).off(); } catch(e){}
            }
        },

        // --- SELEÇÃO DE FLUXO ---
        selectChar: function(key) {
            this.myChar = key;
            window.Sfx.click();
            this.state = 'MODE_SELECT';
        },

        selectMode: function(m) {
            this.mode = m;
            if(m === 'VERSUS') {
                if(!window.DB) { window.System.msg("OFFLINE: TREINO"); this.selectMode('SOLO'); return; }
                this.isOnline = true;
                this.connect();
                this.state = 'READY';
                window.System.msg("AGUARDANDO RIVAL...");
            } else {
                this.isOnline = false;
                this.state = 'FIGHT';
                this.startTime = Date.now();
                window.System.msg("TREINO LIVRE!");
            }
        },

        connect: function() {
            this.dbRef = window.DB.ref(`rooms/${this.roomId}`);
            const me = this.dbRef.child(`players/${window.System.playerId}`);
            me.set({
                char: this.myChar,
                hp: 100,
                pose: this.player,
                hitId: 0,
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            });
            me.onDisconnect().remove();

            // Escutar Rival
            this.dbRef.child('players').on('value', snap => {
                const data = snap.val();
                if(!data) return;
                const ids = Object.keys(data).filter(id => id !== window.System.playerId);
                
                if(ids.length > 0) {
                    const rData = data[ids[0]];
                    // Atualiza dados do rival
                    this.rival = {
                        id: ids[0],
                        char: rData.char || 'mario',
                        pose: rData.pose,
                        hp: rData.hp
                    };

                    // Se rival me acertou (hitId mudou)
                    if(rData.hitId !== this.lastHitId && rData.hitId > 0) {
                        this.takeDamage(10); // Dano fixo recebido via rede
                        this.lastHitId = rData.hitId;
                    }

                    if(this.state === 'READY') {
                        this.state = 'FIGHT';
                        this.startTime = Date.now();
                        window.System.msg("LUTE!");
                        window.Sfx.play(600, 'square', 0.5, 0.2);
                    }
                } else {
                    this.rival = null;
                    if(this.state === 'FIGHT') {
                        this.state = 'READY';
                        window.System.msg("RIVAL SAIU...");
                    }
                }
            });
        },

        // --- UPDATE LOOP ---
        update: function(ctx, w, h, pose) {
            // 1. INPUT
            if(pose) this.processPose(pose, w, h);

            // 2. STATES
            if(this.state === 'CHAR_SELECT') { this.drawCharSelect(ctx, w, h); return 0; }
            if(this.state === 'MODE_SELECT') { this.drawModeSelect(ctx, w, h); return 0; }
            
            // 3. JOGO
            this.updatePhysics(w, h);
            
            // 4. RENDERIZAÇÃO
            this.drawArena(ctx, w, h);
            
            // Desenha Rival (Atrás)
            if(this.mode === 'VERSUS' && this.rival && this.rival.pose) {
                this.drawCharacter(ctx, this.rival.pose, this.rival.char, w, h, false); // False = Rival (Sólido)
            } else if (this.mode === 'SOLO') {
                this.drawPunchingBag(ctx, w, h);
            }

            // Desenha Jogador (Frente - Estilo "Wireframe/Ghost" para não tapar visão)
            this.drawCharacter(ctx, this.player, this.myChar, w, h, true); // True = Self (Transparente)

            this.drawHUD(ctx, w, h);
            this.renderFX(ctx);

            // Shake da tela
            if(shake > 0) {
                ctx.save();
                ctx.translate((Math.random()-0.5)*shake, (Math.random()-0.5)*shake);
                shake *= 0.9;
                if(shake < 1) shake = 0;
                ctx.restore();
            }

            // Sync
            if(this.isOnline) this.sync();

            return this.hp;
        },

        processPose: function(pose, w, h) {
            const kps = pose.keypoints;
            const find = (n) => {
                const p = kps.find(k => k.name === n);
                // Mapeamento: Inverte X (Espelho) e centraliza
                if(p && p.score > 0.3) return { 
                    x: (1 - p.x/640) * w, 
                    y: (p.y/480) * h 
                };
                return null;
            };

            // Lerp para suavizar movimento
            const lerp = (curr, target) => {
                if(!target) return curr;
                return { x: curr.x + (target.x - curr.x)*0.4, y: curr.y + (target.y - curr.y)*0.4 };
            };

            this.player.nose = lerp(this.player.nose, find('nose'));
            this.player.left_wrist = lerp(this.player.left_wrist, find('left_wrist'));
            this.player.right_wrist = lerp(this.player.right_wrist, find('right_wrist'));
            this.player.left_elbow = lerp(this.player.left_elbow, find('left_elbow'));
            this.player.right_elbow = lerp(this.player.right_elbow, find('right_elbow'));
            this.player.left_shoulder = lerp(this.player.left_shoulder, find('left_shoulder'));
            this.player.right_shoulder = lerp(this.player.right_shoulder, find('right_shoulder'));

            // Detecção de Bloqueio (Mãos na frente do rosto)
            if(this.player.nose.x !== 0) {
                const distL = Math.hypot(this.player.left_wrist.x - this.player.nose.x, this.player.left_wrist.y - this.player.nose.y);
                const distR = Math.hypot(this.player.right_wrist.x - this.player.nose.x, this.player.right_wrist.y - this.player.nose.y);
                this.player.blocking = (distL < 100 || distR < 100);
            }
        },

        updatePhysics: function(w, h) {
            if(this.state !== 'FIGHT') return;

            // Timer
            const now = Date.now();
            const elapsed = (now - this.startTime) / 1000;
            this.timeLeft = Math.max(0, CONF.DURATION - elapsed);
            if(this.timeLeft <= 0 || this.hp <= 0 || this.enemyHp <= 0) {
                this.state = 'KO';
                let msg = "TEMPO!";
                if(this.hp <= 0) msg = "VOCÊ PERDEU!";
                if(this.enemyHp <= 0) msg = "VOCÊ VENCEU!";
                window.System.gameOver(msg);
            }

            // Lógica de Soco (Hitbox)
            const hands = [this.player.left_wrist, this.player.right_wrist];
            
            if(this.mode === 'SOLO') {
                // Acertar o Saco
                const bx = w/2 + this.bag.swing;
                const by = h*0.4;
                hands.forEach(hPos => {
                    if(Math.hypot(hPos.x - bx, hPos.y - by) < 80) {
                        // Debounce simples
                        if(Math.random() > 0.8) { 
                            this.bag.hp -= 10;
                            this.bag.swing = (hPos.x - bx) * 0.5; // Balança o saco
                            shake = 10;
                            window.Sfx.hit();
                            this.spawnFX(bx, by, "POW!");
                        }
                    }
                });
                this.bag.swing *= 0.9; // Amortecimento
            } 
            else if (this.mode === 'VERSUS' && this.rival && this.rival.pose) {
                // Acertar o Rival
                const rHead = this.rival.pose.nose;
                const rBodyY = (this.rival.pose.left_shoulder.y + this.rival.pose.left_elbow.y)/2 || rHead.y + 100;
                const rBodyX = rHead.x;

                // Hitboxes do Inimigo
                const targets = [
                    {x: rHead.x, y: rHead.y, r: 60, type: 'HEAD'}, 
                    {x: rBodyX, y: rBodyY, r: 80, type: 'BODY'}
                ];

                hands.forEach(hPos => {
                    targets.forEach(t => {
                        if(t.x !== 0 && Math.hypot(hPos.x - t.x, hPos.y - t.y) < t.r) {
                            // Cooldown local para não spammar
                            if(Math.random() > 0.92) {
                                // Se rival bloqueando, dano reduzido
                                let dmg = this.rival.pose.blocking ? 2 : 8;
                                this.enemyHp = Math.max(0, this.enemyHp - dmg);
                                
                                shake = 15;
                                window.Sfx.play(150, 'sawtooth', 0.1, 0.1);
                                
                                const txt = this.rival.pose.blocking ? "BLOCKED" : "SMASH!";
                                const col = this.rival.pose.blocking ? '#ffff00' : '#ff0000';
                                this.spawnFX(t.x, t.y, txt, col);

                                // Sinaliza hit para o servidor (para o outro saber que tomou dano)
                                if(this.dbRef) {
                                    this.dbRef.child(`players/${this.rival.id}`).update({
                                        hitId: Date.now() // Timestamp serve como ID único de hit
                                    });
                                }
                            }
                        }
                    });
                });
            }
        },

        takeDamage: function(amount) {
            if(this.player.blocking) amount *= 0.2; // Defesa reduz 80%
            this.hp = Math.max(0, this.hp - amount);
            shake = 20;
            // Flash vermelho na tela (feito no render)
        },

        sync: function() {
            if(!this.dbRef) return;
            // Envia dados a 20fps
            if(Date.now() % 50 < 20) {
                this.dbRef.child(`players/${window.System.playerId}`).update({
                    pose: this.player,
                    hp: this.hp,
                    lastSeen: firebase.database.ServerValue.TIMESTAMP
                });
            }
        },

        // --- RENDERIZAÇÃO ---
        drawArena: function(ctx, w, h) {
            // Luzes do Estádio
            const grad = ctx.createRadialGradient(w/2, 0, 100, w/2, h, w);
            grad.addColorStop(0, '#333'); grad.addColorStop(1, '#000');
            ctx.fillStyle = grad; ctx.fillRect(0,0,w,h);

            // Ringue (Perspectiva 3D)
            ctx.beginPath();
            ctx.moveTo(0, h); ctx.lineTo(w, h); // Frente
            ctx.lineTo(w*0.9, h*0.5); ctx.lineTo(w*0.1, h*0.5); // Fundo
            ctx.fillStyle = '#222'; ctx.fill();
            
            // Cordas
            ctx.strokeStyle = '#d32f2f'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(w*0.1, h*0.5); ctx.lineTo(w*0.9, h*0.5); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(w*0.05, h*0.6); ctx.lineTo(w*0.95, h*0.6); ctx.stroke();
        },

        drawCharacter: function(ctx, p, charKey, w, h, isSelf) {
            const c = CONF.CHARS[charKey] || CONF.CHARS['mario'];
            
            // Se for Eu (Self), desenha transparente/wireframe
            // Se for Rival, desenha Sólido
            const alpha = isSelf ? 0.4 : 1.0;
            ctx.save();
            ctx.globalAlpha = alpha;

            // Função auxiliar para desenhar "Cápsula" (Membro 3D)
            const drawCapsule = (p1, p2, width, color) => {
                if(p1.x===0 || p2.x===0) return;
                ctx.lineWidth = width;
                ctx.lineCap = 'round';
                ctx.strokeStyle = color;
                ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
                // Borda para definição
                if(!isSelf) {
                    ctx.lineWidth = width + 2; ctx.strokeStyle = 'rgba(0,0,0,0.3)';
                    ctx.globalCompositeOperation = 'destination-over';
                    ctx.stroke();
                    ctx.globalCompositeOperation = 'source-over';
                }
            };

            // 1. Corpo (Improvisado entre ombros e cintura estimada)
            if(p.left_shoulder.x !== 0 && p.right_shoulder.x !== 0) {
                const cx = (p.left_shoulder.x + p.right_shoulder.x)/2;
                const cy = (p.left_shoulder.y + p.right_shoulder.y)/2;
                const waistY = cy + (h * 0.25); // Estima cintura
                
                // Torso
                drawCapsule({x:cx, y:cy}, {x:cx, y:waistY}, 80, c.shirt);
                // Calção (Base)
                drawCapsule({x:cx, y:waistY}, {x:cx, y:waistY+30}, 75, c.pants);
                
                // Nome no cinto (Opcional)
                if(!isSelf) {
                    ctx.fillStyle = "#fff"; ctx.font = "bold 20px Arial"; ctx.textAlign = "center";
                    ctx.fillText(c.name, cx, waistY);
                }
            }

            // 2. Cabeça
            if(p.nose.x !== 0) {
                const headSize = 50;
                ctx.fillStyle = c.skin;
                ctx.beginPath(); ctx.arc(p.nose.x, p.nose.y, headSize, 0, Math.PI*2); ctx.fill();
                
                // Rosto (Olhos e Boca)
                if(!isSelf) { // Só desenha rosto do inimigo
                    ctx.fillStyle = "#000";
                    // Olhos
                    ctx.beginPath(); 
                    if(p.blocking) { // Olhos fechados se bloqueando
                        ctx.moveTo(p.nose.x-20, p.nose.y-10); ctx.lineTo(p.nose.x-10, p.nose.y-10);
                        ctx.moveTo(p.nose.x+10, p.nose.y-10); ctx.lineTo(p.nose.x+20, p.nose.y-10);
                        ctx.stroke();
                    } else {
                        ctx.arc(p.nose.x - 15, p.nose.y - 10, 5, 0, Math.PI*2); 
                        ctx.arc(p.nose.x + 15, p.nose.y - 10, 5, 0, Math.PI*2);
                        ctx.fill();
                    }
                }
            }

            // 3. Braços (Ombro -> Cotovelo -> Pulso)
            // Desenhamos braços depois para ficarem "na frente" do corpo
            const armW = 25;
            // Braço Esquerdo
            drawCapsule(p.left_shoulder, p.left_elbow, armW, c.skin);
            drawCapsule(p.left_elbow, p.left_wrist, armW-5, c.skin); // Antebraço mais fino
            // Braço Direito
            drawCapsule(p.right_shoulder, p.right_elbow, armW, c.skin);
            drawCapsule(p.right_elbow, p.right_wrist, armW-5, c.skin);

            // Se cotovelo falhar (comum na web), liga direto
            if(p.left_elbow.x === 0) drawCapsule(p.left_shoulder, p.left_wrist, armW, c.skin);
            if(p.right_elbow.x === 0) drawCapsule(p.right_shoulder, p.right_wrist, armW, c.skin);

            // 4. Luvas (Sempre por cima de tudo)
            const drawGlove = (pos) => {
                if(pos.x === 0) return;
                const gSize = 40;
                const grad = ctx.createRadialGradient(pos.x-10, pos.y-10, 5, pos.x, pos.y, gSize);
                grad.addColorStop(0, '#fff'); grad.addColorStop(1, c.gloves);
                
                ctx.fillStyle = grad;
                ctx.beginPath(); ctx.arc(pos.x, pos.y, gSize, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = '#888'; ctx.lineWidth = 2; ctx.stroke();
            };
            drawGlove(p.left_wrist);
            drawGlove(p.right_wrist);

            // Escudo de Defesa (Efeito Visual)
            if(p.blocking) {
                ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 5; ctx.globalAlpha = 0.6;
                ctx.beginPath(); ctx.arc(p.nose.x, p.nose.y, 90, 0, Math.PI*2); ctx.stroke();
            }

            ctx.restore();
        },

        drawPunchingBag: function(ctx, w, h) {
            const bx = w/2 + this.bag.swing;
            const by = h*0.3;
            
            // Corrente
            ctx.beginPath(); ctx.moveTo(w/2, 0); ctx.lineTo(bx, by);
            ctx.strokeStyle = '#888'; ctx.lineWidth = 5; ctx.stroke();

            // Saco
            ctx.fillStyle = '#a52a2a'; // Marrom couro
            ctx.beginPath();
            ctx.ellipse(bx, by + 100, 60, 120, this.bag.swing * 0.005, 0, Math.PI*2);
            ctx.fill();
            // Brilho
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.beginPath(); ctx.ellipse(bx-15, by+100, 20, 80, this.bag.swing * 0.005, 0, Math.PI*2); ctx.fill();

            // Texto HP do Saco
            ctx.fillStyle = '#fff'; ctx.font = "20px Arial"; ctx.textAlign = "center";
            ctx.fillText(`HP: ${this.bag.hp}`, bx, by + 100);
        },

        drawHUD: function(ctx, w, h) {
            // Tempo
            ctx.fillStyle = '#fff'; ctx.font = "bold 60px 'Russo One'"; ctx.textAlign = "center";
            ctx.fillText(Math.ceil(this.timeLeft), w/2, 70);

            if(this.mode === 'VERSUS') {
                // Barra de Vida P1
                this.drawBar(ctx, 20, 20, w*0.4, 30, this.hp, 100, '#00ff00', 'YOU');
                // Barra de Vida P2
                this.drawBar(ctx, w - (w*0.4) - 20, 20, w*0.4, 30, this.enemyHp, 100, '#ff0000', 'RIVAL');
            }
        },

        drawBar: function(ctx, x, y, w, h, val, max, color, label) {
            // Borda
            ctx.fillStyle = '#222'; ctx.fillRect(x, y, w, h);
            ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.strokeRect(x, y, w, h);
            // Vida
            const pct = Math.max(0, val/max);
            ctx.fillStyle = color; ctx.fillRect(x+2, y+2, (w-4)*pct, h-4);
            // Label
            ctx.fillStyle = '#fff'; ctx.font = "bold 16px Arial"; ctx.textAlign = "left";
            ctx.fillText(label, x, y + h + 20);
        },

        drawCharSelect: function(ctx, w, h) {
            ctx.fillStyle = '#111'; ctx.fillRect(0,0,w,h);
            ctx.fillStyle = '#fff'; ctx.textAlign='center'; ctx.font="bold 40px 'Russo One'";
            ctx.fillText("SELECT FIGHTER", w/2, h*0.2);

            const keys = Object.keys(CONF.CHARS);
            const step = w / (keys.length + 1);
            
            keys.forEach((k, i) => {
                const cx = step * (i+1);
                const cy = h*0.5;
                const c = CONF.CHARS[k];
                
                // Card
                ctx.strokeStyle = c.shirt; ctx.lineWidth = 5;
                ctx.strokeRect(cx-60, cy-60, 120, 120);
                ctx.fillStyle = c.shirt; 
                ctx.beginPath(); ctx.arc(cx, cy, 40, 0, Math.PI*2); ctx.fill();
                
                ctx.fillStyle = '#fff'; ctx.font = "20px Arial";
                ctx.fillText(c.name, cx, cy+90);
            });

            if(!window.System.canvas.onclick) {
                window.System.canvas.onclick = (e) => {
                    const x = e.clientX;
                    const idx = Math.floor(x / (w/keys.length));
                    if(keys[idx]) {
                        this.selectChar(keys[idx]);
                        window.System.canvas.onclick = null;
                    }
                };
            }
        },

        drawModeSelect: function(ctx, w, h) {
            ctx.fillStyle = '#111'; ctx.fillRect(0,0,w,h);
            const c = CONF.CHARS[this.myChar];
            
            ctx.fillStyle = c.shirt; ctx.textAlign='center'; ctx.font="bold 50px 'Russo One'";
            ctx.fillText(c.name, w/2, h*0.3);
            ctx.font = "30px Arial"; ctx.fillStyle = "#fff";
            ctx.fillText("READY?", w/2, h*0.4);

            // Botões Grandes
            ctx.fillStyle = "#333";
            ctx.fillRect(w*0.1, h*0.5, w*0.35, h*0.3); // Solo
            ctx.fillRect(w*0.55, h*0.5, w*0.35, h*0.3); // Online

            ctx.fillStyle = "#fff";
            ctx.fillText("TRAINING", w*0.275, h*0.65);
            ctx.fillText("ONLINE PVP", w*0.725, h*0.65);

            if(!window.System.canvas.onclick) {
                window.System.canvas.onclick = (e) => {
                    const x = e.clientX;
                    this.selectMode(x < w/2 ? 'SOLO' : 'VERSUS');
                    window.System.canvas.onclick = null;
                };
            }
        },

        spawnFX: function(x, y, text, color='#fff') {
            texts.push({x, y, text, color, life: 1.0, vy: -2});
            for(let i=0; i<10; i++) {
                particles.push({
                    x, y, 
                    vx:(Math.random()-0.5)*15, vy:(Math.random()-0.5)*15, 
                    color: color, life: 1.0
                });
            }
        },

        renderFX: function(ctx) {
            particles.forEach((p, i) => {
                p.x += p.vx; p.y += p.vy; p.life -= 0.05;
                if(p.life <= 0) particles.splice(i,1);
                else {
                    ctx.globalAlpha = p.life; ctx.fillStyle = p.color;
                    ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI*2); ctx.fill();
                }
            });
            texts.forEach((t, i) => {
                t.y += t.vy; t.life -= 0.02;
                if(t.life <= 0) texts.splice(i,1);
                else {
                    ctx.globalAlpha = t.life; ctx.fillStyle = t.color;
                    ctx.font = "italic bold 40px 'Russo One'"; ctx.strokeStyle = "#000"; ctx.lineWidth = 3;
                    ctx.strokeText(t.text, t.x, t.y); ctx.fillText(t.text, t.x, t.y);
                }
            });
            ctx.globalAlpha = 1.0;
        },

        sync: function() {
            if(!this.isOnline || !this.dbRef) return;
            if(Date.now() % 50 < 20) {
                this.dbRef.child(`players/${window.System.playerId}`).update({
                    pose: this.player,
                    hp: this.hp,
                    lastSeen: firebase.database.ServerValue.TIMESTAMP
                });
            }
        }
    };

    window.System.registerGame('box', 'PRO BOXING', '🥊', Logic, {camOpacity: 0.1});
})();