// =============================================================================
// LÓGICA DO JOGO: OTTO SUPER RUN (MARIO WORLD WII EDITION)
// ARQUITETO: SENIOR DEV V3 (LOGICA DE PULO/ABAIXAR + CENÁRIO MARIO)
// =============================================================================

(function() {
    const CONF = {
        SPEED: 22,
        HORIZON_Y: 0.38,
        LANE_SPREAD: 0.8,
        FOCAL_LENGTH: 320,
        COLORS: {
            SKY_TOP: '#5c94fc', SKY_BOT: '#95b8ff',
            GRASS: '#00cc00', TRACK: '#d65a4e', PIPE: '#00aa00'
        }
    };

    let particles = [], clouds = [], decors = [];

    const Logic = {
        sc: 0, f: 0, lane: 0, currentLaneX: 0, action: 'run',
        state: 'MODE_SELECT', baseNoseY: 0, calibSamples: [], obs: [], hitTimer: 0,
        
        roomId: 'room_run_01', isOnline: false, rivals: [], dbRef: null, lastSync: 0,

        init: function() { 
            this.sc = 0; this.f = 0; this.obs = []; this.action = 'run';
            this.hitTimer = 0; particles = []; clouds = []; decors = [];
            this.resetMultiplayerState();
            
            for(let i=0; i<8; i++) clouds.push({ x: (Math.random()*2000)-1000, y: Math.random()*200, z: Math.random()*1000 + 500 });
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
            if(mode === 'ONLINE') {
                if(!window.DB) { this.selectMode('OFFLINE'); return; }
                this.isOnline = true;
                this.connectMultiplayer();
            }
            window.System.msg("CALIBRANDO...");
        },

        connectMultiplayer: function() {
            this.dbRef = window.DB.ref('rooms/' + this.roomId);
            this.dbRef.child('players/' + window.System.playerId).set({ lane: 0, action: 'run', lastSeen: firebase.database.ServerValue.TIMESTAMP });
            this.dbRef.child('players/' + window.System.playerId).onDisconnect().remove();
            this.dbRef.child('players').on('value', snap => {
                const data = snap.val(); if(!data) return;
                this.rivals = Object.keys(data).filter(id => id !== window.System.playerId).map(id => ({ id, ...data[id] }));
            });
        },

        update: function(ctx, w, h, pose) {
            const cx = w / 2; const horizon = h * CONF.HORIZON_Y;
            
            if(this.state === 'MODE_SELECT') { this.drawMenu(ctx, w, h); return 0; }

            // POSE LOGIC (MIRROR CORRECTED)
            if(pose) {
                const n = pose.keypoints.find(k => k.name === 'nose');
                const mapPoint = (pt) => ({ x: (1 - pt.x/640)*w, y: (pt.y/480)*h });
                
                if(n && n.score > 0.4) {
                    const np = mapPoint(n);
                    if(this.state === 'calibrate') {
                        this.calibSamples.push(np.y);
                        this.drawCalibration(ctx, w, h, cx);
                        if(this.calibSamples.length > 60) {
                            this.baseNoseY = this.calibSamples.reduce((a,b)=>a+b,0)/this.calibSamples.length;
                            this.state = 'play'; window.System.msg("START!");
                        }
                        return 0;
                    }

                    // Lanes
                    if(np.x < w * 0.35) this.lane = 1; else if(np.x > w * 0.65) this.lane = -1; else this.lane = 0;
                    
                    // Jump/Crouch based on Calibration
                    const diff = np.y - this.baseNoseY;
                    if(diff < -50) this.action = 'jump'; 
                    else if(diff > 50) this.action = 'crouch'; 
                    else this.action = 'run';
                }
            }

            this.f++;
            const targetLaneX = this.lane * (w * 0.25);
            this.currentLaneX += (targetLaneX - this.currentLaneX) * 0.15;

            // RENDER WORLD
            this.renderEnvironment(ctx, w, h, horizon);
            this.renderTrack(ctx, w, h, cx, horizon);
            this.renderObjects(ctx, w, h, cx, horizon);

            // GHOSTS
            this.rivals.forEach(r => {
                ctx.save(); ctx.globalAlpha = 0.5;
                let rY = h * 0.85; 
                if(r.action === 'jump') rY -= h * 0.15; if(r.action === 'crouch') rY += h * 0.05;
                this.drawBackViewCharacter(ctx, cx + (r.lane * (w*0.25)), rY, w, h, r.action, '#aaa');
                ctx.restore();
            });

            // PLAYER (MARIO BACK VIEW)
            let charY = h * 0.85;
            if(this.action === 'jump') charY -= h * 0.15; 
            if(this.action === 'crouch') charY += h * 0.05;
            this.drawBackViewCharacter(ctx, cx + this.currentLaneX, charY, w, h, this.action, '#ff0000');

            if(this.hitTimer > 0) { ctx.fillStyle = `rgba(255, 0, 0, ${this.hitTimer * 0.1})`; ctx.fillRect(0, 0, w, h); this.hitTimer--; }

            if(this.isOnline && this.f % 5 === 0) {
                this.dbRef.child('players/' + window.System.playerId).update({
                    lane: this.lane, action: this.action, sc: Math.floor(this.sc),
                    lastSeen: firebase.database.ServerValue.TIMESTAMP
                });
            }

            return this.sc;
        },

        renderEnvironment: function(ctx, w, h, horizon) {
            const gradSky = ctx.createLinearGradient(0, 0, 0, horizon);
            gradSky.addColorStop(0, CONF.COLORS.SKY_TOP); gradSky.addColorStop(1, CONF.COLORS.SKY_BOT);
            ctx.fillStyle = gradSky; ctx.fillRect(0, 0, w, horizon);
            
            clouds.forEach(c => {
                c.x -= 0.5; if(c.x < -200) c.x = w + 200;
                const s = 1000 / c.z;
                ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(c.x, c.y + (horizon*0.2), 30*s, 0, Math.PI*2); ctx.fill();
            });

            ctx.fillStyle = CONF.COLORS.GRASS; ctx.fillRect(0, horizon, w, h-horizon);
        },

        renderTrack: function(ctx, w, h, cx, horizon) {
            ctx.save(); ctx.translate(cx, horizon);
            const trackTopW = w * 0.05; const trackBotW = w * 1.1; 
            ctx.beginPath(); ctx.fillStyle = CONF.COLORS.TRACK; 
            ctx.moveTo(-trackTopW, 0); ctx.lineTo(trackTopW, 0); ctx.lineTo(trackBotW, h-horizon); ctx.lineTo(-trackBotW, h-horizon); ctx.fill();
            
            ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 4;
            [-1, -0.33, 0.33, 1].forEach(l => {
                ctx.beginPath(); ctx.moveTo(l * trackTopW, 0); ctx.lineTo(l * trackBotW, h-horizon); ctx.stroke();
            });
            ctx.restore();
        },

        renderObjects: function(ctx, w, h, cx, horizon) {
            if(this.f % 75 === 0) {
                const type = Math.random() < 0.5 ? 'pipe' : 'block';
                this.obs.push({ lane: Math.floor(Math.random() * 3) - 1, z: 1500, type: type, passed: false });
            }

            for(let i=this.obs.length-1; i>=0; i--) {
                let o = this.obs[i]; o.z -= CONF.SPEED;
                if(o.z < -200) { this.obs.splice(i, 1); continue; }

                const scale = CONF.FOCAL_LENGTH / (CONF.FOCAL_LENGTH + o.z);
                const screenY = horizon + ((h - horizon) * scale); 
                const size = (w * 0.2) * scale;
                const sx = cx + (o.lane * (w*0.4) * scale);

                if(o.type === 'pipe') {
                    ctx.fillStyle = '#00aa00'; ctx.fillRect(sx-size/2, screenY-size, size, size);
                    ctx.strokeStyle = '#004400'; ctx.lineWidth = 2; ctx.strokeRect(sx-size/2, screenY-size, size, size);
                } else {
                    ctx.fillStyle = '#f1c40f'; ctx.fillRect(sx-size/3, screenY-size*1.8, size*0.6, size*0.6);
                    ctx.fillStyle = '#000'; ctx.font=`bold ${size*0.35}px Arial`; ctx.textAlign='center'; ctx.fillText("?", sx, screenY-size*1.4);
                }

                if(o.z < 25 && o.z > -25 && o.lane === this.lane) {
                    let hit = false;
                    if(o.type === 'pipe' && this.action !== 'jump') hit = true;
                    if(o.type === 'block' && this.action !== 'crouch') hit = true;
                    if(hit) { this.hitTimer = 10; window.System.gameOver(this.sc); }
                    else if(!o.passed) { this.sc += 100; window.Sfx.coin(); o.passed = true; }
                }
            }
        },

        drawBackViewCharacter: function(ctx, x, y, w, h, act, color) {
            const s = w * 0.0035; 
            ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
            ctx.fillStyle = '#0000ff'; ctx.fillRect(-18, -10, 12, 25); ctx.fillRect(6, -10, 12, 25); 
            ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, -40, 28, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#4a3222'; ctx.beginPath(); ctx.arc(0, -70, 22, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, -75, 26, Math.PI, 0); ctx.fill(); 
            ctx.restore();
        },

        drawMenu: function(ctx, w, h) {
            ctx.fillStyle = '#222'; ctx.fillRect(0,0,w,h);
            ctx.fillStyle = '#fff'; ctx.textAlign='center'; ctx.font="bold 35px 'Russo One'";
            ctx.fillText("CORRIDA MARIO: SELECIONE O MODO", w/2, h/2 - 40);
            ctx.font="22px sans-serif"; ctx.fillText("SOLO (ESQUERDA) | ONLINE (DIREITA)", w/2, h/2 + 20);
            if(!window.System.canvas.onclick) {
                window.System.canvas.onclick = (e) => {
                    this.selectMode(e.clientX < w/2 ? 'OFFLINE' : 'ONLINE');
                    window.System.canvas.onclick = null;
                };
            }
        },

        drawCalibration: function(ctx, w, h, cx) {
            ctx.fillStyle = "rgba(0,0,0,0.8)"; ctx.fillRect(0,0,w,h);
            ctx.fillStyle = "#fff"; ctx.font = "bold 25px sans-serif"; ctx.textAlign = "center";
            ctx.fillText("FIQUE EM POSIÇÃO NEUTRA", cx, h*0.45);
            const pct = this.calibSamples.length / 60;
            ctx.fillStyle = "#58b4e8"; ctx.fillRect(cx - 150, h*0.55, 300 * pct, 15);
        },

        cleanup: function() { if(this.dbRef) this.dbRef.child('players/' + window.System.playerId).remove(); }
    };

    window.System.registerGame('run', 'Otto Super Run', '🏃', Logic, {camOpacity: 0.25});
})();
