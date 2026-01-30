// =============================================================================
// LÓGICA DO JOGO: OTTO SUPER RUN (MARIO WORLD WII EDITION - RESTORED)
// ARQUITETO: SENIOR DEV V3
// =============================================================================

(function() {
    // --- CONFIGURAÇÕES VISUAIS & GAMEPLAY ---
    const CONF = {
        SPEED: 22,               // Velocidade do mundo
        HORIZON_Y: 0.38,         // Altura do horizonte
        LANE_SPREAD: 0.8,        // Espalhamento das faixas
        FOCAL_LENGTH: 320,       // Perspectiva 3D
        COLORS: {
            SKY_TOP: '#5c94fc', SKY_BOT: '#95b8ff',
            GRASS: '#00cc00', TRACK: '#d65a4e', 
            LINES: '#ffffff', PIPE:  '#00aa00'
        }
    };

    let particles = [], clouds = [], decors = []; 

    const Logic = {
        sc: 0, f: 0, lane: 0, currentLaneX: 0, action: 'run',
        state: 'MODE_SELECT', baseNoseY: 0, calibSamples: [], 
        obs: [], hitTimer: 0,
        
        roomId: 'room_run_01', isOnline: false, rivals: [], dbRef: null,

        init: function() { 
            this.sc = 0; this.f = 0; this.obs = []; this.action = 'run';
            this.hitTimer = 0; particles = []; clouds = []; decors = [];
            this.resetMultiplayerState();
            
            // Gera nuvens iniciais
            for(let i=0; i<8; i++) {
                clouds.push({ x: (Math.random()*2000)-1000, y: Math.random()*200, z: Math.random()*1000 + 500 });
            }

            this.state = 'MODE_SELECT';
            window.System.msg("SELECIONE O MODO"); 
        },

        resetMultiplayerState: function() {
            this.isOnline = false; this.rivals = [];
            if(this.dbRef) try { this.dbRef.child('players').off(); } catch(e){}
        },

        selectMode: function(mode) {
            this.state = 'calibrate';
            this.calibSamples = [];
            this.baseNoseY = 0;
            if(mode === 'ONLINE') {
                if(!window.DB) { this.selectMode('OFFLINE'); return; }
                this.isOnline = true;
                this.connectMultiplayer();
                window.System.msg("BUSCANDO RIVAIS...");
            } else {
                window.System.msg("CALIBRANDO..."); 
            }
        },

        connectMultiplayer: function() {
            this.dbRef = window.DB.ref('rooms/' + this.roomId);
            const myRef = this.dbRef.child('players/' + window.System.playerId);
            myRef.set({ lane: 0, action: 'run', lastSeen: firebase.database.ServerValue.TIMESTAMP });
            myRef.onDisconnect().remove();

            this.dbRef.child('players').on('value', snap => {
                const data = snap.val(); if(!data) return;
                this.rivals = Object.keys(data)
                    .filter(id => id !== window.System.playerId)
                    .map(id => ({ id, ...data[id] }));
            });
        },

        update: function(ctx, w, h, pose) {
            const cx = w / 2;
            const horizon = h * CONF.HORIZON_Y;
            const groundH = h - horizon;

            if(this.state === 'MODE_SELECT') { this.drawMenu(ctx, w, h); return 0; }

            this.f++;

            // ========================
            // 1. INPUT E CONTROLE
            // ========================
            if(pose && this.hitTimer <= 0) {
                const n = pose.keypoints.find(k => k.name === 'nose');
                
                if(n && n.score > 0.4) {
                    // Mapeamento normalizado (0 a 1)
                    let nx = n.x / 640; 
                    let ny = n.y / 480;

                    if(this.state === 'calibrate') {
                        this.calibSamples.push(ny * h);
                        this.drawCalibration(ctx, w, h, cx);
                        if(this.calibSamples.length > 60) {
                            const sum = this.calibSamples.reduce((a, b) => a + b, 0);
                            this.baseNoseY = sum / this.calibSamples.length;
                            this.state = 'play';
                            window.System.msg("LARGADA!"); 
                            window.Sfx.play(400, 'square', 0.5, 0.1); 
                        }
                        return 0; 
                    }
                    else if(this.state === 'play') {
                        // CORREÇÃO DE INVERSÃO:
                        // Webcam espelhada: Minha direita = Direita da Tela = x maior
                        // Minha esquerda = Esquerda da Tela = x menor
                        // O problema anterior era inverter essa lógica.
                        
                        if(nx < 0.4) this.lane = -1;       // Esquerda
                        else if(nx > 0.6) this.lane = 1;   // Direita
                        else this.lane = 0;                // Centro

                        // Pulo e Agachamento (Baseado na calibração)
                        const diff = (ny * h) - this.baseNoseY;
                        const sensitivity = 50; 

                        if(diff < -sensitivity) this.action = 'jump';
                        else if (diff > sensitivity) this.action = 'crouch';
                        else this.action = 'run';
                    }
                }
            }

            // Suavização da faixa (Lerp)
            const targetLaneX = this.lane * (w * 0.25);
            this.currentLaneX += (targetLaneX - this.currentLaneX) * 0.15;

            // ========================
            // 2. RENDERIZAÇÃO MUNDO
            // ========================
            
            // Céu
            const gradSky = ctx.createLinearGradient(0, 0, 0, horizon);
            gradSky.addColorStop(0, CONF.COLORS.SKY_TOP);
            gradSky.addColorStop(1, CONF.COLORS.SKY_BOT);
            ctx.fillStyle = gradSky; ctx.fillRect(0, 0, w, horizon);

            this.drawClouds(ctx, w, horizon);
            this.drawFloatingBlocks(ctx, w, horizon);

            // Chão (Gramado)
            ctx.fillStyle = CONF.COLORS.GRASS;
            ctx.fillRect(0, horizon, w, groundH);

            // Pista
            ctx.save();
            ctx.translate(cx, horizon);
            const trackTopW = w * 0.05; 
            const trackBotW = w * 1.1; 
            
            ctx.beginPath();
            ctx.fillStyle = CONF.COLORS.TRACK; 
            ctx.moveTo(-trackTopW, 0); ctx.lineTo(trackTopW, 0);
            ctx.lineTo(trackBotW, groundH); ctx.lineTo(-trackBotW, groundH);
            ctx.fill();

            // Linhas
            ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 4;
            [-1, -0.33, 0.33, 1].forEach(l => {
                ctx.beginPath(); ctx.moveTo(l * trackTopW, 0); ctx.lineTo(l * trackBotW, groundH); ctx.stroke();
            });
            ctx.restore();

            // ========================
            // 3. OBJETOS E COLISÃO
            // ========================
            
            // Spawn
            if(this.state === 'play') {
                if(this.f % 90 === 0) {
                    const type = Math.random() < 0.5 ? 'hurdle' : 'sign';
                    const obsLane = Math.floor(Math.random() * 3) - 1; 
                    this.obs.push({ lane: obsLane, z: 1500, type: type, passed: false, animOffset: Math.random() * 10 });
                }
                if(this.f % 35 === 0) {
                    decors.push({ z: 1500, side: -1, type: Math.random() < 0.5 ? 'pipe' : 'bush' }); 
                    decors.push({ z: 1500, side: 1, type: Math.random() < 0.5 ? 'pipe' : 'bush' });
                }
            }

            // Render Queue (Z-Sort)
            const renderQueue = [];
            this.obs.forEach((o, i) => {
                o.z -= CONF.SPEED;
                if(o.z < -200) { this.obs.splice(i, 1); return; }
                renderQueue.push({ type: 'obs', obj: o, z: o.z });
            });
            decors.forEach((d, i) => {
                d.z -= CONF.SPEED;
                if(d.z < -200) { decors.splice(i, 1); return; }
                renderQueue.push({ type: 'decor', obj: d, z: d.z });
            });
            renderQueue.sort((a, b) => b.z - a.z);

            renderQueue.forEach(item => {
                const scale = CONF.FOCAL_LENGTH / (CONF.FOCAL_LENGTH + item.z);
                if(scale <= 0) return;
                const screenY = horizon + (groundH * scale); 
                const size = (w * 0.15) * scale; 
                
                if(item.type === 'decor') {
                    const d = item.obj;
                    const spread = (w * 1.2) * scale; 
                    const sx = cx + (d.side * spread);
                    if(d.type === 'pipe') {
                        // Cano do Mario
                        const pH = size * 1.0; const pW = size * 0.6;
                        ctx.fillStyle = CONF.COLORS.PIPE; ctx.strokeStyle = '#004400'; ctx.lineWidth = 2 * scale;
                        ctx.fillRect(sx - pW/2, screenY - pH, pW, pH); ctx.strokeRect(sx - pW/2, screenY - pH, pW, pH);
                        ctx.fillRect(sx - pW/2 - (5*scale), screenY - pH, pW + (10*scale), 15*scale); ctx.strokeRect(sx - pW/2 - (5*scale), screenY - pH, pW + (10*scale), 15*scale);
                    } else {
                        // Arbusto
                        ctx.fillStyle = '#228B22'; ctx.beginPath();
                        ctx.arc(sx, screenY, size*0.5, Math.PI, 0); ctx.arc(sx+size*0.4, screenY, size*0.4, Math.PI, 0); ctx.arc(sx-size*0.4, screenY, size*0.4, Math.PI, 0); ctx.fill();
                    }
                } else {
                    const o = item.obj;
                    const trackWCurrent = (trackTopW + (trackBotW - trackTopW) * scale);
                    const sx = cx + (o.lane * trackWCurrent * CONF.LANE_SPREAD);
                    
                    if(o.type === 'hurdle') {
                        const hH = size * 0.6;
                        ctx.strokeStyle = '#fff'; ctx.lineWidth = 4*scale;
                        ctx.beginPath(); ctx.moveTo(sx-size/2, screenY); ctx.lineTo(sx-size/2, screenY-hH); ctx.moveTo(sx+size/2, screenY); ctx.lineTo(sx+size/2, screenY-hH); ctx.stroke();
                        ctx.fillStyle = '#ff3333'; ctx.fillRect(sx-size/2-2, screenY-hH-(20*scale), size+4, 20*scale);
                        if(!o.passed && scale > 0.5) ctx.fillStyle='#ffff00', ctx.fillText("PULO!", sx, screenY-hH-30*scale);
                    } else {
                        const signH = size * 2.5; const signBox = size * 0.8;
                        ctx.fillStyle = '#333'; ctx.fillRect(sx-2*scale, screenY-signH, 4*scale, signH);
                        ctx.fillStyle = '#f1c40f'; ctx.fillRect(sx-signBox/2, screenY-signH, signBox, signBox);
                        ctx.strokeStyle = '#c27c0e'; ctx.strokeRect(sx-signBox/2, screenY-signH, signBox, signBox);
                        ctx.fillStyle = '#fff'; ctx.font=`bold ${30*scale}px monospace`; ctx.fillText("?", sx, screenY-signH + signBox*0.7); 
                        if(!o.passed && scale > 0.5) ctx.fillStyle='#fff', ctx.fillText("ABAIXE!", sx, screenY-signH-30*scale);
                    }

                    // Colisão
                    if(o.z < 15 && o.z > -15 && this.state === 'play') {
                        if(o.lane === this.lane) {
                            let hit = false;
                            if(o.type === 'hurdle' && this.action !== 'jump') hit = true;
                            if(o.type === 'sign' && this.action !== 'crouch') hit = true;

                            if(hit) {
                                this.hitTimer = 10; window.Gfx.shake(20); window.Sfx.crash(); window.System.gameOver(Math.floor(this.sc));
                            } else if(!o.passed) {
                                this.sc += 100; window.Sfx.coin(); o.passed = true;
                                this.spawnParticles(sx, screenY - size, 10, '#ffff00');
                            }
                        }
                    }
                }
            });

            // ========================
            // 4. PERSONAGEM (MARIO)
            // ========================
            const charX = cx + this.currentLaneX;
            let charY = h * 0.85;
            if(this.action === 'jump') charY -= h * 0.20; 
            if(this.action === 'crouch') charY += h * 0.05;

            // Multiplayer Ghosts
            if(this.isOnline) {
                this.rivals.forEach(r => {
                    const rX = cx + (r.lane * (w*0.25));
                    let rY = h * 0.85;
                    if(r.action === 'jump') rY -= h * 0.20; if(r.action === 'crouch') rY += h * 0.05;
                    ctx.save(); ctx.globalAlpha = 0.5;
                    this.drawBackViewCharacter(ctx, rX, rY, w, h, r.action, '#aaa');
                    ctx.restore();
                });
                
                // Sync
                if(this.f % 5 === 0) {
                    this.dbRef.child('players/' + window.System.playerId).update({
                        lane: this.lane, action: this.action, sc: Math.floor(this.sc),
                        lastSeen: firebase.database.ServerValue.TIMESTAMP
                    });
                }
            }

            this.drawBackViewCharacter(ctx, charX, charY, w, h, this.action, '#ff0000'); // Mario Red

            // Efeitos
            particles.forEach((p, i) => {
                p.x += p.vx; p.y += p.vy; p.life--; p.vy += 0.5;
                if(p.life <= 0) particles.splice(i, 1);
                else { ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, p.s, p.s); }
            });

            if(this.hitTimer > 0) {
                ctx.fillStyle = `rgba(255, 0, 0, ${this.hitTimer * 0.1})`;
                ctx.fillRect(0, 0, w, h);
                this.hitTimer--;
            }

            return this.sc;
        },

        drawBackViewCharacter: function(ctx, x, y, w, h, act, color) {
            const s = w * 0.0035; 
            const cycle = Math.sin(this.f * 0.4) * 20;

            const C_SKIN = '#ffccaa';
            const C_SHIRT = color; 
            const C_OVERALL = '#0000ff'; 
            const C_BOOT = '#654321';

            ctx.save(); ctx.translate(x, y); ctx.scale(s, s);

            const drawLimb = (x, y, w, h, angle) => {
                ctx.save(); ctx.translate(x, y); ctx.rotate(angle * Math.PI / 180);
                ctx.beginPath(); ctx.ellipse(0, h/2, w/2, h/2, 0, 0, Math.PI*2); ctx.fill(); ctx.restore();
            };

            const drawBoot = (bx, by) => {
                ctx.fillStyle = C_BOOT;
                ctx.beginPath(); ctx.ellipse(bx, by, 8, 6, 0, 0, Math.PI*2); ctx.fill();
            };

            // Pernas
            ctx.fillStyle = C_OVERALL;
            if(act === 'run') {
                drawLimb(-15, 0, 14, 30, cycle); drawLimb(15, 0, 14, 30, -cycle);
                drawBoot(-15+(cycle*0.8), 30); drawBoot(15-(cycle*0.8), 30);
            } else if (act === 'jump') {
                drawLimb(-15, -10, 14, 25, -20); drawLimb(15, 5, 14, 35, 10);
            } else {
                drawLimb(-20, -5, 14, 20, -40); drawLimb(20, -5, 14, 20, 40);
            }

            // Corpo (Costas)
            const bodyY = act === 'crouch' ? -20 : -40;
            ctx.fillStyle = C_SHIRT; ctx.beginPath(); ctx.arc(0, bodyY, 28, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = C_OVERALL; ctx.fillRect(-20, bodyY, 40, 30); 
            ctx.beginPath(); ctx.arc(0, bodyY+30, 21, 0, Math.PI, false); ctx.fill();

            // Suspensórios nas costas (V)
            ctx.beginPath(); ctx.moveTo(-15, bodyY-15); ctx.lineTo(0, bodyY+15); ctx.lineTo(15, bodyY-15); ctx.fill();

            // Cabeça (Nuca)
            const headY = bodyY - 25;
            ctx.fillStyle = C_SKIN; ctx.beginPath(); ctx.arc(0, headY, 26, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#4a3222'; ctx.beginPath(); ctx.arc(0, headY+2, 25, 0, Math.PI, false); ctx.fill(); // Cabelo

            // Boné (Traseira)
            ctx.fillStyle = C_SHIRT; ctx.beginPath(); ctx.arc(0, headY-5, 27, Math.PI, 0); ctx.fill();

            // Braços
            const armSwing = act === 'run' ? -cycle : 0;
            ctx.fillStyle = C_SHIRT;
            drawLimb(-28, bodyY-5, 20, 36, 10 + armSwing); drawLimb(28, bodyY-5, 20, 36, -10 - armSwing);

            ctx.restore();

            // Feedback Texto
            if(this.state === 'play') {
                ctx.font = "bold 20px 'Russo One'"; ctx.textAlign = "center";
                if(act === 'jump') { ctx.fillStyle = "#00ff00"; ctx.fillText("PULO!", x, y - (h*0.25)); }
                if(act === 'crouch') { ctx.fillStyle = "#ffff00"; ctx.fillText("AGACHA", x, y - (h*0.25)); }
            }
        },

        drawMenu: function(ctx, w, h) {
            ctx.fillStyle = '#222'; ctx.fillRect(0,0,w,h);
            ctx.fillStyle = '#fff'; ctx.textAlign='center'; ctx.font="bold 35px 'Russo One'";
            ctx.fillText("CORRIDA MARIO", w/2, h*0.3);
            
            const btn = (y, t, c) => {
                ctx.fillStyle = c; ctx.fillRect(w/2-150, y, 300, 60);
                ctx.fillStyle = '#fff'; ctx.font="20px sans-serif"; ctx.fillText(t, w/2, y+38);
            };
            btn(h*0.5, "SOLO (OFFLINE)", "#e67e22");
            btn(h*0.65, "MULTIPLAYER", "#27ae60");

            if(!window.System.canvas.onclick) {
                window.System.canvas.onclick = (e) => {
                    const rect = window.System.canvas.getBoundingClientRect();
                    const y = e.clientY - rect.top;
                    this.selectMode(y > h*0.6 ? 'ONLINE' : 'OFFLINE');
                    window.System.canvas.onclick = null;
                };
            }
        },

        drawCalibration: function(ctx, w, h, cx) {
            ctx.fillStyle = "rgba(0,0,0,0.85)"; ctx.fillRect(0,0,w,h);
            ctx.fillStyle = "#fff"; ctx.font = "bold 30px 'Russo One'"; ctx.textAlign = "center";
            ctx.fillText("FIQUE EM POSIÇÃO NEUTRA", cx, h*0.4);
            const pct = this.calibSamples.length / 60;
            ctx.fillStyle = "#3498db"; ctx.fillRect(cx - 150, h*0.5, 300 * pct, 20);
            ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.strokeRect(cx - 150, h*0.5, 300, 20);
        },

        spawnParticles: function(x, y, count, color) {
            for(let i=0; i<count; i++) {
                particles.push({ x: x, y: y, vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 1.0) * 10, life: 20 + Math.random() * 10, c: color, s: 4 + Math.random() * 4 });
            }
        },
        
        drawClouds: function(ctx, w, horizon) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            clouds.forEach(c => {
                c.x -= 0.5; if(c.x < -200) c.x = w + 200;
                const s = 1000 / c.z;
                ctx.beginPath(); ctx.arc(c.x, c.y + (horizon * 0.2), 30*s, 0, Math.PI*2); ctx.fill();
            });
        },

        drawFloatingBlocks: function(ctx, w, horizon) {
            const blockSize = 30; const offset = (this.f * 0.5) % 1000;
            ctx.fillStyle = '#b85c00'; ctx.strokeStyle = '#000';
            for(let i=0; i<w; i+= 300) {
                const bx = (i - offset + 1000) % (w + 200) - 100;
                ctx.fillRect(bx, horizon*0.5, blockSize, blockSize); ctx.strokeRect(bx, horizon*0.5, blockSize, blockSize);
            }
        },

        cleanup: function() { if(this.dbRef) this.dbRef.child('players/' + window.System.playerId).remove(); }
    };

    window.System.registerGame('run', 'Super Run', '🏃', Logic, {camOpacity: 0.3});
})();
