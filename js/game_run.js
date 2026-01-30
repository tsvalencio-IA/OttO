// =============================================================================
// LÓGICA DO JOGO: OTTO SUPER RUN (MULTIPLAYER EDITION)
// =============================================================================

(function() {
    const CONF = {
        SPEED: 22,
        HORIZON_Y: 0.38,
        LANE_SPREAD: 0.8,
        FOCAL_LENGTH: 320,
        COLORS: {
            SKY_TOP: '#5c94fc', SKY_BOT: '#95b8ff',
            GRASS: '#00cc00', TRACK: '#d65a4e', LINES: '#ffffff', PIPE: '#00aa00'
        }
    };

    let particles = [], clouds = [], decors = [];

    const Logic = {
        sc: 0, f: 0, lane: 0, currentLaneX: 0, action: 'run',
        state: 'calibrate', baseNoseY: 0, calibSamples: [], obs: [], hitTimer: 0,
        
        // Multiplayer Props
        roomId: 'room_run_01', isOnline: false, isReady: false, 
        rivals: [], dbRef: null, lastSync: 0,

        init: function() { 
            this.sc = 0; this.f = 0; this.obs = []; this.action = 'run';
            this.hitTimer = 0; particles = []; clouds = []; decors = [];
            this.resetMultiplayerState();
            
            for(let i=0; i<8; i++) clouds.push({ x: (Math.random()*2000)-1000, y: Math.random()*200, z: Math.random()*1000 + 500 });
            
            // Inicia direto no menu de seleção
            this.state = 'MODE_SELECT';
            window.System.msg("SELECIONE MODO"); 
        },

        resetMultiplayerState: function() {
            this.isOnline = false; this.isReady = false; this.rivals = [];
            if(this.dbRef) { try { this.dbRef.child('players').off(); } catch(e){} }
        },

        // --- GESTÃO DE REDE ---
        selectMode: function(mode) {
            this.state = 'calibrate';
            this.calibSamples = [];
            this.baseNoseY = 0;
            
            if(mode === 'ONLINE') {
                if(!window.DB) { window.System.msg("SEM REDE!"); this.selectMode('OFFLINE'); return; }
                this.isOnline = true;
                this.connectMultiplayer();
                window.System.msg("CONECTANDO...");
            } else {
                this.isOnline = false;
                window.System.msg("CALIBRANDO...");
            }
        },

        connectMultiplayer: function() {
            this.dbRef = window.DB.ref('rooms/' + this.roomId);
            this.dbRef.child('players/' + window.System.playerId).set({
                lane: 0, action: 'run', ready: false, lastSeen: firebase.database.ServerValue.TIMESTAMP
            });
            this.dbRef.child('players/' + window.System.playerId).onDisconnect().remove();

            this.dbRef.child('players').on('value', snap => {
                const data = snap.val(); if(!data) return;
                const now = Date.now();
                this.rivals = Object.keys(data)
                    .filter(id => id !== window.System.playerId && (now - data[id].lastSeen < 10000))
                    .map(id => ({ id, ...data[id], currentLaneX: data[id].lane * (window.System.canvas.width * 0.25) })); // Pre-calc lane
            });
        },

        sync: function() {
            if(!this.isOnline) return;
            if(Date.now() - this.lastSync > 100) {
                this.lastSync = Date.now();
                this.dbRef.child('players/' + window.System.playerId).update({
                    lane: this.lane, action: this.action, sc: Math.floor(this.sc),
                    lastSeen: firebase.database.ServerValue.TIMESTAMP
                });
            }
        },

        update: function(ctx, w, h, pose) {
            const cx = w / 2; const horizon = h * CONF.HORIZON_Y;
            
            // MENU SELECTION
            if(this.state === 'MODE_SELECT') {
                ctx.fillStyle = '#222'; ctx.fillRect(0,0,w,h);
                ctx.fillStyle = '#fff'; ctx.textAlign='center'; ctx.font="30px Arial";
                ctx.fillText("TOQUE EM CIMA: OFFLINE", cx, h*0.4);
                ctx.fillText("TOQUE EM BAIXO: ONLINE", cx, h*0.6);
                
                // Hack simples para usar clique como seleção inicial
                if(window.System.canvas.onclick === null) {
                    window.System.canvas.onclick = (e) => {
                        const y = e.clientY - window.System.canvas.getBoundingClientRect().top;
                        this.selectMode(y < h/2 ? 'OFFLINE' : 'ONLINE');
                        window.System.canvas.onclick = null;
                    };
                }
                return 0;
            }

            // CALIBRAÇÃO
            if(this.state === 'calibrate') {
                if(pose) {
                    const n = pose.keypoints.find(k => k.name === 'nose');
                    // Usar lógica segura de mapeamento
                    const mapPoint = (pt) => ({ x: (1 - pt.x/640)*w, y: (pt.y/480)*h });
                    
                    if(n && n.score > 0.4) {
                        const np = mapPoint(n);
                        this.calibSamples.push(np.y);
                        this.drawCalibration(ctx, w, h, cx);
                        if(this.calibSamples.length > 60) {
                            this.baseNoseY = this.calibSamples.reduce((a,b)=>a+b,0)/this.calibSamples.length;
                            this.state = 'play';
                            window.System.msg("CORRA!");
                        }
                    } else {
                        ctx.fillStyle='#000'; ctx.fillRect(0,0,w,h);
                        ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.fillText("ENQUADRE O ROSTO", cx, h/2);
                    }
                }
                return 0;
            }

            this.f++;
            
            // INPUT & GAMEPLAY
            if(pose && this.hitTimer <= 0) {
                const n = pose.keypoints.find(k => k.name === 'nose');
                const mapPoint = (pt) => ({ x: (1 - pt.x/640)*w, y: (pt.y/480)*h });

                if(n && n.score > 0.4) {
                    const np = mapPoint(n);
                    if(np.x < w * 0.35) this.lane = 1; else if(np.x > w * 0.65) this.lane = -1; else this.lane = 0;
                    
                    const diff = np.y - this.baseNoseY;
                    if(diff < -45) this.action = 'jump'; else if(diff > 45) this.action = 'crouch'; else this.action = 'run';
                }
            }

            const targetLaneX = this.lane * (w * 0.25);
            this.currentLaneX += (targetLaneX - this.currentLaneX) * 0.15;

            // RENDERIZAÇÃO
            this.renderEnvironment(ctx, w, h, horizon);
            this.renderTrack(ctx, w, h, cx, horizon);
            this.renderObjects(ctx, w, h, cx, horizon);

            // DESENHA RIVAIS
            this.rivals.forEach(r => {
                // Suaviza movimento lateral do rival
                const rTargetX = r.lane * (w * 0.25);
                r.currentLaneX = r.currentLaneX + (rTargetX - r.currentLaneX) * 0.1;
                
                // Desenha Rival (Semi-transparente)
                ctx.save(); ctx.globalAlpha = 0.6;
                let rY = h * 0.85; 
                if(r.action === 'jump') rY -= h * 0.20; if(r.action === 'crouch') rY += h * 0.05;
                this.drawBackViewCharacter(ctx, cx + r.currentLaneX, rY, w, h, r.action, '#aaaaaa');
                ctx.restore();
            });

            // DESENHA JOGADOR
            let charY = h * 0.85;
            if(this.action === 'jump') charY -= h * 0.20; 
            if(this.action === 'crouch') charY += h * 0.05;
            this.drawBackViewCharacter(ctx, cx + this.currentLaneX, charY, w, h, this.action, '#ff0000');

            // EFEITOS
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

            this.sync();
            return this.sc;
        },

        // --- FUNÇÕES AUXILIARES DE RENDER ---
        renderEnvironment: function(ctx, w, h, horizon) {
            const gradSky = ctx.createLinearGradient(0, 0, 0, horizon);
            gradSky.addColorStop(0, CONF.COLORS.SKY_TOP); gradSky.addColorStop(1, CONF.COLORS.SKY_BOT);
            ctx.fillStyle = gradSky; ctx.fillRect(0, 0, w, horizon);
            
            // Nuvens
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            clouds.forEach(c => {
                c.x -= 0.5; if(c.x < -200) c.x = w + 200;
                const s = 1000 / c.z; const cx = c.x; const cy = c.y + (horizon * 0.2);
                ctx.beginPath(); ctx.arc(cx, cy, 30*s, 0, Math.PI*2); ctx.fill();
            });

            ctx.fillStyle = CONF.COLORS.GRASS; ctx.fillRect(0, horizon, w, h-horizon);
        },

        renderTrack: function(ctx, w, h, cx, horizon) {
            ctx.save(); ctx.translate(cx, horizon);
            const trackTopW = w * 0.05; const trackBotW = w * 1.1; 
            const groundH = h - horizon;
            
            ctx.beginPath(); ctx.fillStyle = CONF.COLORS.TRACK; 
            ctx.moveTo(-trackTopW, 0); ctx.lineTo(trackTopW, 0); ctx.lineTo(trackBotW, groundH); ctx.lineTo(-trackBotW, groundH); ctx.fill();

            const lanes = [-1, -0.33, 0.33, 1];
            ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 4;
            lanes.forEach(l => { ctx.beginPath(); ctx.moveTo(l * trackTopW, 0); ctx.lineTo(l * trackBotW, groundH); ctx.stroke(); });
            ctx.restore();
        },

        renderObjects: function(ctx, w, h, cx, horizon) {
            // Spawn
            if(this.state === 'play' && this.f % 80 === 0) {
                const type = Math.random() < 0.5 ? 'hurdle' : 'sign';
                this.obs.push({ lane: Math.floor(Math.random() * 3) - 1, z: 1500, type: type, passed: false });
            }

            const groundH = h - horizon;
            const trackTopW = w * 0.05; const trackBotW = w * 1.1;

            for(let i=this.obs.length-1; i>=0; i--) {
                let o = this.obs[i]; o.z -= CONF.SPEED;
                if(o.z < -200) { this.obs.splice(i, 1); continue; }

                const scale = CONF.FOCAL_LENGTH / (CONF.FOCAL_LENGTH + o.z);
                if(scale <= 0) continue;

                const screenY = horizon + (groundH * scale); 
                const size = (w * 0.15) * scale;
                const currentTrackW = trackTopW + (trackBotW - trackTopW) * scale;
                const sx = cx + (o.lane * currentTrackW * CONF.LANE_SPREAD);

                // Desenha Obstáculo
                if(o.type === 'hurdle') {
                    ctx.fillStyle = '#ff3333'; ctx.fillRect(sx-size/2, screenY-size*0.6, size, size*0.1);
                    ctx.strokeStyle='#fff'; ctx.strokeRect(sx-size/2, screenY-size*0.6, size, size*0.6);
                } else {
                    ctx.fillStyle = '#f1c40f'; ctx.fillRect(sx-size/3, screenY-size, size*0.66, size*0.66);
                    ctx.fillStyle = '#000'; ctx.font=`bold ${size*0.4}px Arial`; ctx.fillText("?", sx, screenY-size*0.5);
                }

                // Colisão
                if(o.z < 15 && o.z > -15 && this.state === 'play' && o.lane === this.lane) {
                    let hit = false;
                    if(o.type === 'hurdle' && this.action !== 'jump') hit = true;
                    if(o.type === 'sign' && this.action !== 'crouch') hit = true;
                    
                    if(hit) {
                        this.hitTimer = 10; window.Gfx.shakeScreen(20); window.System.gameOver(this.sc);
                    } else if(!o.passed) {
                        this.sc += 100; window.Sfx.coin(); o.passed = true;
                    }
                }
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

        drawBackViewCharacter: function(ctx, x, y, w, h, act, color) {
            const s = w * 0.0035; 
            ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
            const cycle = Math.sin(this.f * 0.4) * 20;
            
            // Corpo e Pernas (Simplificado)
            ctx.fillStyle = '#0000ff';
            const legH = (act==='crouch') ? 10 : 30;
            ctx.fillRect(-15, 0, 10, legH); ctx.fillRect(5, 0, 10, legH); // Pernas
            
            ctx.fillStyle = color;
            ctx.beginPath(); ctx.arc(0, -30, 25, 0, Math.PI*2); ctx.fill(); // Costas
            
            // Cabeça
            ctx.fillStyle = '#4a3222'; ctx.beginPath(); ctx.arc(0, -60, 20, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, -65, 22, Math.PI, 0); ctx.fill(); // Boné

            ctx.restore();
        }
    };

    if(window.System) window.System.registerGame('run', 'Otto Super Run', '🏃', Logic, {camOpacity: 0.3, showWheel: false});
})();
