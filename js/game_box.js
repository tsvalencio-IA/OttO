// =============================================================================
// LÓGICA DO JOGO: PRO BOXING LEAGUE (PHYSICS & VELOCITY EDITION)
// ARQUITETO: PARCEIRO DE PROGRAMAÇÃO
// =============================================================================

(function() {
    // Sistema de Partículas e Efeitos
    let particles = [];
    let popups = [];
    let shakeStrength = 0;

    const CONF = {
        ROUND_TIME: 90,
        GRAVITY: 0.5,
        PUNCH_THRESH: 15, // Velocidade mínima para considerar um soco
        BLOCK_DIST: 80,   // Distância mão-rosto para bloquear
        
        CHARS: {
            'mario': { name: 'RED FIRE', color: '#e74c3c', skin: '#ffccaa', hat: '#d32f2f' },
            'luigi': { name: 'GREEN THUNDER', color: '#2ecc71', skin: '#ffccaa', hat: '#27ae60' },
            'peach': { name: 'PRINCESS PWR', color: '#e91e63', skin: '#ffe5b4', hat: '#f48fb1' }
        }
    };

    const Logic = {
        state: 'CHAR_SELECT',
        mode: 'SOLO',
        
        // Status do Jogo
        hp: 100,
        stamina: 100,
        enemyHp: 100,
        timeLeft: 0,
        startTime: 0,
        
        // Multiplayer
        roomId: 'arena_pro_01',
        isOnline: false,
        rivals: [],
        dbRef: null,
        
        // Física Local
        lastPose: null, // Para calcular velocidade
        myChar: 'mario',
        
        player: {
            head: {x:0, y:0},
            shoulders: {l:{x:0,y:0}, r:{x:0,y:0}},
            elbows: {l:{x:0,y:0}, r:{x:0,y:0}},
            wrists: {l:{x:0,y:0}, r:{x:0,y:0}},
            // Estados calculados
            velocity: {l:0, r:0},
            isBlocking: false,
            isPunching: {l:false, r:false}
        },

        // --- INICIALIZAÇÃO ---
        init: function() { 
            this.hp = 100; this.stamina = 100; this.enemyHp = 100;
            particles = []; popups = [];
            this.state = 'CHAR_SELECT';
            this.resetNet();
            window.System.msg("ESCOLHA SEU LUTADOR"); 
        },

        resetNet: function() {
            this.isOnline = false;
            if(window.DB && window.System.playerId) {
                try { window.DB.ref(`rooms/${this.roomId}/players/${window.System.playerId}`).remove(); } catch(e){}
                try { window.DB.ref(`rooms/${this.roomId}/players`).off(); } catch(e){}
            }
        },

        // --- FLUXO ---
        selectChar: function(k) { this.myChar = k; window.Sfx.click(); this.state = 'MODE_SELECT'; },
        
        selectMode: function(m) {
            this.mode = m;
            this.startTime = Date.now();
            this.timeLeft = CONF.ROUND_TIME;
            
            if(m === 'VERSUS') {
                if(!window.DB) { window.System.msg("OFFLINE"); this.selectMode('SOLO'); return; }
                this.isOnline = true;
                this.connect();
                window.System.msg("AGUARDANDO RIVAL...");
                this.state = 'VERSUS';
            } else {
                this.isOnline = false;
                this.state = 'PLAY'; // Modo treino/saco de pancada
                window.System.msg("FIGHT!");
            }
        },

        connect: function() {
            this.dbRef = window.DB.ref(`rooms/${this.roomId}`);
            const me = this.dbRef.child(`players/${window.System.playerId}`);
            
            me.set({ char: this.myChar, hp: 100, maxHp: 100, action: 'idle' });
            me.onDisconnect().remove();

            this.dbRef.child('players').on('value', snap => {
                const data = snap.val(); if(!data) return;
                const now = Date.now();
                
                // Filtra rivais e atualiza HP localmente para display
                this.rivals = Object.keys(data)
                    .filter(id => id !== window.System.playerId)
                    .map(id => ({ id, ...data[id] }));
                
                if(this.rivals.length > 0) {
                    this.enemyHp = this.rivals[0].hp || 0;
                    // Se o rival mandou um evento de "hit" em mim recentemente
                    if(this.rivals[0].hitId && this.rivals[0].hitId !== this.lastProcessedHit) {
                        this.takeDamage(this.rivals[0].hitDamage);
                        this.lastProcessedHit = this.rivals[0].hitId;
                    }
                }
            });
        },

        // --- LOOP PRINCIPAL ---
        update: function(ctx, w, h, pose) {
            if(this.state === 'CHAR_SELECT') { this.drawCharSelect(ctx, w, h); return 0; }
            if(this.state === 'MODE_SELECT') { this.drawModeSelect(ctx, w, h); return 0; }

            // Tempo
            if(this.state === 'PLAY' || this.state === 'VERSUS') {
                const elapsed = (Date.now() - this.startTime)/1000;
                this.timeLeft = Math.max(0, CONF.ROUND_TIME - elapsed);
                
                // Regenera Stamina
                this.stamina = Math.min(100, this.stamina + 0.5);

                if(this.timeLeft <= 0 || this.hp <= 0 || (this.mode==='VERSUS' && this.enemyHp <= 0)) {
                    this.state = 'FINISHED';
                    let res = "TEMPO ESGOTADO";
                    if(this.hp <= 0) res = "K.O. - VOCÊ PERDEU";
                    if(this.enemyHp <= 0) res = "K.O. - VOCÊ VENCEU";
                    window.System.gameOver(res);
                }
            }

            // Física e Input
            this.updatePhysics(pose, w, h);

            // Renderização
            this.drawArena(ctx, w, h);
            
            // Desenha Rival (Versus) ou Saco de Pancada (Solo)
            if(this.mode === 'VERSUS') {
                this.rivals.forEach(r => {
                    if(r.pose) this.drawCharacter(ctx, r.pose, r.char, w, false); // Rival sólido
                });
            } else {
                this.drawPunchingBag(ctx, w, h);
            }

            // Desenha Jogador (Ghost/Wireframe para ver através)
            this.drawCharacter(ctx, this.player, this.myChar, w, true);

            // UI
            this.drawHUD(ctx, w, h);
            this.renderEffects(ctx);

            // Screen Shake
            if(shakeStrength > 0) {
                ctx.translate((Math.random()-0.5)*shakeStrength, (Math.random()-0.5)*shakeStrength);
                shakeStrength *= 0.9;
                if(shakeStrength < 0.5) shakeStrength = 0;
                ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
            }

            // Sync
            if(this.isOnline) this.sync();

            return this.hp;
        },

        // --- FÍSICA AVANÇADA (VELOCIDADE = SOCO) ---
        updatePhysics: function(pose, w, h) {
            if(!pose || !pose.keypoints) return;

            const find = (n) => {
                const k = pose.keypoints.find(p => p.name === n);
                // Mapeamento: Inverte X e ajusta escala
                return (k && k.score > 0.3) ? { x: (1 - k.x/640)*w, y: (k.y/480)*h } : {x:0,y:0};
            };

            // 1. Atualiza posições atuais
            const curr = {
                head: find('nose'),
                shoulders: {l:find('left_shoulder'), r:find('right_shoulder')},
                elbows: {l:find('left_elbow'), r:find('right_elbow')},
                wrists: {l:find('left_wrist'), r:find('right_wrist')}
            };

            // 2. Calcula Velocidade (Soco vs Movimento)
            if(this.lastPose) {
                const distL = Math.hypot(curr.wrists.l.x - this.lastPose.wrists.l.x, curr.wrists.l.y - this.lastPose.wrists.l.y);
                const distR = Math.hypot(curr.wrists.r.x - this.lastPose.wrists.r.x, curr.wrists.r.y - this.lastPose.wrists.r.y);
                
                this.player.velocity.l = distL;
                this.player.velocity.r = distR;

                // Detecta intenção de soco (Alta velocidade + Stamina disponível)
                this.player.isPunching.l = (distL > CONF.PUNCH_THRESH && this.stamina > 10);
                this.player.isPunching.r = (distR > CONF.PUNCH_THRESH && this.stamina > 10);
            }

            // 3. Suavização (Lerp) para visual fluido
            const lerp = (c, t) => t.x!==0 ? { x: c.x+(t.x-c.x)*0.5, y: c.y+(t.y-c.y)*0.5 } : c;
            this.player.head = lerp(this.player.head, curr.head);
            this.player.shoulders.l = lerp(this.player.shoulders.l, curr.shoulders.l);
            this.player.shoulders.r = lerp(this.player.shoulders.r, curr.shoulders.r);
            this.player.elbows.l = lerp(this.player.elbows.l, curr.elbows.l);
            this.player.elbows.r = lerp(this.player.elbows.r, curr.elbows.r);
            this.player.wrists.l = lerp(this.player.wrists.l, curr.wrists.l);
            this.player.wrists.r = lerp(this.player.wrists.r, curr.wrists.r);

            this.lastPose = JSON.parse(JSON.stringify(this.player)); // Deep copy para proximo frame

            // 4. Detecção de Bloqueio (Mãos próximas ao rosto)
            if(this.player.head.x !== 0) {
                const dL = Math.hypot(this.player.wrists.l.x - this.player.head.x, this.player.wrists.l.y - this.player.head.y);
                const dR = Math.hypot(this.player.wrists.r.x - this.player.head.x, this.player.wrists.r.y - this.player.head.y);
                this.player.isBlocking = (dL < CONF.BLOCK_DIST || dR < CONF.BLOCK_DIST);
            }

            // 5. DETECÇÃO DE HIT (EU SOCO O RIVAL)
            if(this.mode === 'VERSUS' && this.rivals.length > 0) {
                const rival = this.rivals[0];
                if(rival.pose) {
                    const rHead = rival.pose.head;
                    // Minhas mãos vs Cabeça do Rival
                    ['l', 'r'].forEach(hand => {
                        if(this.player.isPunching[hand]) {
                            const myHand = this.player.wrists[hand];
                            if(Math.hypot(myHand.x - rHead.x, myHand.y - rHead.y) < 80) {
                                // ACERTOU!
                                const damage = rival.pose.isBlocking ? 2 : 8; // Dano reduzido se bloquear
                                this.enemyHp -= damage;
                                this.stamina -= 15; // Custa stamina socar
                                
                                // Efeitos
                                shakeStrength = 10;
                                window.Sfx.hit();
                                const color = rival.pose.isBlocking ? '#ffff00' : '#ff0000';
                                const txt = rival.pose.isBlocking ? "DEFESA" : "HIT!";
                                this.spawnParticles(rHead.x, rHead.y, color);
                                popups.push({x:rHead.x, y:rHead.y, t:txt, life:1});

                                // Envia Hit para o servidor (Autoridade do Atacante)
                                if(this.isOnline) {
                                    this.dbRef.child(`players/${rival.id}`).update({
                                        hitId: Date.now(),
                                        hitDamage: damage,
                                        hp: this.enemyHp
                                    });
                                }
                            }
                        }
                    });
                }
            } else if (this.mode === 'SOLO') {
                // Saco de pancada
                const bagX = w/2; const bagY = h*0.4;
                ['l', 'r'].forEach(hand => {
                    if(this.player.isPunching[hand]) {
                        if(Math.hypot(this.player.wrists[hand].x - bagX, this.player.wrists[hand].y - bagY) < 100) {
                            this.stamina -= 10;
                            shakeStrength = 5;
                            window.Sfx.hit();
                            this.spawnParticles(bagX, bagY, '#fff');
                        }
                    }
                });
            }
        },

        takeDamage: function(amount) {
            this.hp = Math.max(0, this.hp - amount);
            shakeStrength = 20; // Tremor forte ao receber dano
            window.Sfx.play(100, 'sawtooth', 0.2, 0.2); // Som de dor
        },

        // --- RENDERIZAÇÃO ---
        drawCharacter: function(ctx, p, charKey, w, isSelf) {
            const c = CONF.CHARS[charKey] || CONF.CHARS['mario'];
            const alpha = isSelf ? 0.5 : 1.0; // Fantasma se for eu
            
            ctx.save();
            ctx.globalAlpha = alpha;

            // Função para desenhar membros "Cápsula"
            const limb = (p1, p2, w, color) => {
                if(p1.x===0 || p2.x===0) return;
                ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.strokeStyle = color;
                ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
            };

            // Tronco (Abstrato)
            if(p.shoulders.l.x !== 0) {
                const cx = (p.shoulders.l.x + p.shoulders.r.x)/2;
                const cy = (p.shoulders.l.y + p.shoulders.r.y)/2;
                limb({x:cx, y:cy}, {x:cx, y:cy+120}, 80, c.color); // Camisa
            }

            // Braços
            limb(p.shoulders.l, p.elbows.l, 25, c.skin);
            limb(p.elbows.l, p.wrists.l, 20, c.skin);
            limb(p.shoulders.r, p.elbows.r, 25, c.skin);
            limb(p.elbows.r, p.wrists.r, 20, c.skin);

            // Cabeça
            if(p.head.x !== 0) {
                ctx.fillStyle = c.skin; ctx.beginPath(); ctx.arc(p.head.x, p.head.y, 45, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = c.hat; ctx.beginPath(); ctx.arc(p.head.x, p.head.y-15, 47, Math.PI, 0); ctx.fill();
            }

            // Luvas
            const glove = (pos, punching) => {
                if(pos.x===0) return;
                const size = punching ? 55 : 40; // Luva cresce no soco
                ctx.fillStyle = c.color; 
                ctx.beginPath(); ctx.arc(pos.x, pos.y, size, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
            };
            
            // Só desenha se tiver dados de soco, se não assume false
            const punchL = p.isPunching ? p.isPunching.l : false;
            const punchR = p.isPunching ? p.isPunching.r : false;
            glove(p.wrists.l, punchL);
            glove(p.wrists.r, punchR);

            // Escudo de Bloqueio
            if(p.isBlocking) {
                ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 4;
                ctx.beginPath(); ctx.arc(p.head.x, p.head.y, 80, 0, Math.PI*2); ctx.stroke();
            }

            ctx.restore();
        },

        drawArena: function(ctx, w, h) {
            // Estádio
            const grad = ctx.createRadialGradient(w/2, h/2, 50, w/2, h/2, w);
            grad.addColorStop(0, '#444'); grad.addColorStop(1, '#111');
            ctx.fillStyle = grad; ctx.fillRect(0,0,w,h);
            
            // Ringue
            ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(w, h);
            ctx.lineTo(w*0.8, h*0.6); ctx.lineTo(w*0.2, h*0.6);
            ctx.fillStyle = '#2c3e50'; ctx.fill();
            
            // Cordas
            ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 6;
            ctx.beginPath(); ctx.moveTo(w*0.2, h*0.6); ctx.lineTo(w*0.8, h*0.6); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(w*0.1, h*0.75); ctx.lineTo(w*0.9, h*0.75); ctx.stroke();
        },

        drawPunchingBag: function(ctx, w, h) {
            const bx = w/2; const by = h*0.4;
            ctx.fillStyle = '#a1887f';
            ctx.beginPath(); ctx.ellipse(bx, by+100, 60, 150, 0, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 5; ctx.stroke();
            // Corrente
            ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx, by-50); ctx.stroke();
        },

        drawHUD: function(ctx, w, h) {
            // Tempo
            ctx.fillStyle = '#fff'; ctx.font = "bold 50px Arial"; ctx.textAlign='center';
            ctx.fillText(Math.ceil(this.timeLeft), w/2, 60);

            // Barras de Vida
            const drawBar = (x, y, val, max, color, label) => {
                const bw = w * 0.35;
                ctx.fillStyle = '#333'; ctx.fillRect(x, y, bw, 20);
                const pct = Math.max(0, val/max);
                ctx.fillStyle = color; ctx.fillRect(x+2, y+2, (bw-4)*pct, 16);
                ctx.fillStyle = '#fff'; ctx.font = "16px Arial"; ctx.textAlign='left';
                ctx.fillText(label, x, y-5);
            };

            drawBar(20, 40, this.hp, 100, '#2ecc71', 'VOCÊ');
            drawBar(w - (w*0.35) - 20, 40, this.enemyHp, 100, '#e74c3c', 'RIVAL');

            // Barra de Stamina (Abaixo da vida)
            ctx.fillStyle = '#f1c40f'; 
            ctx.fillRect(20, 65, (w*0.35) * (this.stamina/100), 5);
        },

        spawnParticles: function(x, y, c) {
            for(let i=0; i<8; i++) {
                particles.push({x:x, y:y, vx:(Math.random()-0.5)*20, vy:(Math.random()-0.5)*20, c:c, life:1});
            }
        },

        renderEffects: function(ctx) {
            particles.forEach((p,i)=>{
                p.x+=p.vx; p.y+=p.vy; p.life-=0.1;
                if(p.life<=0) particles.splice(i,1);
                else { ctx.globalAlpha=p.life; ctx.fillStyle=p.c; ctx.beginPath(); ctx.arc(p.x,p.y,5,0,Math.PI*2); ctx.fill(); }
            });
            ctx.globalAlpha=1;
            
            popups.forEach((p,i)=>{
                p.y-=2; p.life-=0.05;
                if(p.life<=0) popups.splice(i,1);
                else { 
                    ctx.globalAlpha=p.life; ctx.fillStyle="#fff"; ctx.font="bold 40px Arial"; 
                    ctx.strokeStyle="#000"; ctx.lineWidth=3;
                    ctx.strokeText(p.t, p.x, p.y); ctx.fillText(p.t, p.x, p.y); 
                }
            });
            ctx.globalAlpha=1;
        },

        sync: function() {
            if(!this.isOnline || !this.dbRef) return;
            // Envia estado comprimido a cada 50ms
            if(Date.now() % 50 < 20) {
                this.dbRef.child(`players/${window.System.playerId}`).update({
                    pose: this.player,
                    hp: this.hp,
                    lastSeen: firebase.database.ServerValue.TIMESTAMP
                });
            }
        },

        // Menus básicos (reutilizando estrutura)
        drawCharSelect: function(ctx, w, h) {
            ctx.fillStyle = '#222'; ctx.fillRect(0,0,w,h);
            ctx.fillStyle = '#fff'; ctx.textAlign='center'; ctx.font="40px Arial";
            ctx.fillText("ESCOLHA PERSONAGEM", w/2, h*0.2);
            const keys = Object.keys(CONF.CHARS);
            keys.forEach((k, i) => {
                const x = (w/(keys.length+1)) * (i+1);
                ctx.fillStyle = CONF.CHARS[k].color; ctx.beginPath(); ctx.arc(x, h/2, 50, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.font="20px Arial"; ctx.fillText(CONF.CHARS[k].name, x, h/2+80);
            });
            if(!window.System.canvas.onclick) window.System.canvas.onclick = (e) => {
                const idx = Math.floor(e.clientX / (w/keys.length)); if(keys[idx]) this.selectChar(keys[idx]); window.System.canvas.onclick = null;
            };
        },
        drawModeSelect: function(ctx, w, h) {
            ctx.fillStyle = '#222'; ctx.fillRect(0,0,w,h);
            ctx.fillStyle = '#fff'; ctx.textAlign='center'; ctx.font="30px Arial";
            ctx.fillText("CIMA: TREINO | BAIXO: ONLINE", w/2, h/2);
            if(!window.System.canvas.onclick) window.System.canvas.onclick = (e) => {
                this.selectMode(e.clientY < h/2 ? 'SOLO' : 'VERSUS'); window.System.canvas.onclick = null;
            };
        }
    };

    window.System.registerGame('box', 'PRO BOXING', '🥊', Logic, {camOpacity: 0.15});
})();