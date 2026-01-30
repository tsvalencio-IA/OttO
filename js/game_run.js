// =============================================================================
// LÓGICA DO JOGO: SUPER MARIO RUN (WII EDITION)
// ARQUITETO: PARCEIRO DE PROGRAMAÇÃO
// =============================================================================

(function() {
    // --- CONFIGURAÇÕES ---
    const CONF = {
        SPEED: 22,               // Velocidade do jogo
        HORIZON_Y: 0.38,         // Altura do horizonte
        FOCAL_LENGTH: 320,       // Perspectiva
        COLORS: {
            SKY_TOP: '#5c94fc',    // Azul Céu Mario
            SKY_BOT: '#95b8ff',
            GRASS: '#00cc00',      // Verde Mario
            TRACK: '#d65a4e',      // Terra/Pista
            PIPE:  '#00aa00'       // Verde Cano
        }
    };

    let particles = [];
    let clouds = [];
    
    const Logic = {
        // Estado
        sc: 0,
        f: 0,
        lane: 0,            // -1 (Esq), 0 (Meio), 1 (Dir)
        currentLaneX: 0,    // Animação lateral suavizada
        action: 'run',      // 'run', 'jump', 'crouch'
        
        // Calibração
        state: 'calibrate', // calibrate -> play
        baseNoseY: 0,
        calibSamples: [],
        
        // Objetos
        obs: [],
        hitTimer: 0,
        
        // Multiplayer
        roomId: 'room_run_01',
        isOnline: false,
        rivals: [],
        dbRef: null,
        lastSync: 0,

        // --- INICIALIZAÇÃO ---
        init: function() { 
            this.sc = 0; 
            this.f = 0; 
            this.obs = []; 
            this.action = 'run';
            this.hitTimer = 0; 
            particles = []; 
            clouds = [];
            
            // Gerar nuvens iniciais
            for(let i=0; i<8; i++) {
                clouds.push({ 
                    x: (Math.random()*2000)-1000, 
                    y: Math.random()*200, 
                    z: Math.random()*1000 + 500 
                });
            }

            this.state = 'MODE_SELECT';
            this.resetMultiplayerState();
            window.System.msg("ESCOLHA O MODO"); 
        },

        resetMultiplayerState: function() {
            this.isOnline = false;
            if(this.dbRef && window.System.playerId) {
                try { this.dbRef.child('players/' + window.System.playerId).remove(); } catch(e){}
                try { this.dbRef.child('players').off(); } catch(e){}
            }
        },

        // --- GESTÃO DE MODOS ---
        selectMode: function(mode) {
            this.state = 'calibrate';
            this.calibSamples = [];
            this.baseNoseY = 0;
            
            if(mode === 'ONLINE') {
                if(!window.DB) { 
                    window.System.msg("OFFLINE: SOLO"); 
                    this.selectMode('OFFLINE'); 
                    return; 
                }
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
            
            const myData = {
                lane: 0, 
                action: 'run', 
                sc: 0,
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            };
            this.dbRef.child('players/' + window.System.playerId).set(myData);
            this.dbRef.child('players/' + window.System.playerId).onDisconnect().remove();

            this.dbRef.child('players').on('value', snap => {
                const data = snap.val(); if(!data) return;
                const now = Date.now();
                this.rivals = Object.keys(data)
                    .filter(id => id !== window.System.playerId && (now - data[id].lastSeen < 10000))
                    .map(id => ({ 
                        id, ...data[id], 
                        // Inicializa posição visual se não existir
                        currentLaneX: data[id].currentLaneX || 0 
                    })); 
            });
        },

        // --- LOOP PRINCIPAL ---
        update: function(ctx, w, h, pose) {
            const cx = w / 2;
            const horizon = h * CONF.HORIZON_Y;

            // 1. MENU DE SELEÇÃO
            if(this.state === 'MODE_SELECT') {
                this.drawMenu(ctx, w, h);
                return 0;
            }

            // 2. CALIBRAÇÃO / INPUT
            if (pose && this.hitTimer <= 0) {
                const n = pose.keypoints.find(k => k.name === 'nose');
                
                // Mapeamento ESPELHADO: (1 - x) faz com que mover à direita na vida real mova à direita na tela
                const mapPoint = (pt) => ({ x: (1 - pt.x/640)*w, y: (pt.y/480)*h });

                if (n && n.score > 0.4) {
                    const np = mapPoint(n);

                    if (this.state === 'calibrate') {
                        this.calibSamples.push(np.y);
                        this.drawCalibration(ctx, w, h, cx);
                        
                        if (this.calibSamples.length > 60) {
                            const sum = this.calibSamples.reduce((a, b) => a + b, 0);
                            this.baseNoseY = sum / this.calibSamples.length;
                            this.state = 'play';
                            window.System.msg("VAI!");
                            window.Sfx.play(400, 'square', 0.5, 0.1);
                        }
                        return 0;
                    } 
                    else if (this.state === 'play') {
                        // Lógica de Faixas (Espelhada)
                        // Esquerda da tela < 35% | Direita da tela > 65%
                        if (np.x < w * 0.35) this.lane = -1;      
                        else if (np.x > w * 0.65) this.lane = 1;  
                        else this.lane = 0;                       

                        // Pulo / Agachamento (Baseado na altura do nariz calibrada)
                        const diff = np.y - this.baseNoseY;
                        if (diff < -40) this.action = 'jump';      // Subiu o nariz -> Pulo
                        else if (diff > 40) this.action = 'crouch'; // Desceu o nariz -> Agacha
                        else this.action = 'run';
                    }
                }
            }

            this.f++;
            
            // Suavização do movimento lateral
            const targetLaneX = this.lane * (w * 0.25);
            this.currentLaneX += (targetLaneX - this.currentLaneX) * 0.15;

            // --- RENDERIZAÇÃO ---
            
            // 1. Ambiente
            this.renderEnvironment(ctx, w, h, horizon);
            this.renderTrack(ctx, w, h, cx, horizon);
            
            // 2. Objetos e Colisões
            this.renderObjects(ctx, w, h, cx, horizon);

            // 3. Rivais (Fantasmas)
            this.rivals.forEach(r => {
                const rTargetX = (r.lane || 0) * (w * 0.25);
                // Interpolação simples para suavizar movimento online
                r.currentLaneX = (r.currentLaneX || 0) + (rTargetX - (r.currentLaneX || 0)) * 0.1;
                
                ctx.save(); ctx.globalAlpha = 0.5;
                let rY = h * 0.85;
                if(r.action === 'jump') rY -= h * 0.20;
                if(r.action === 'crouch') rY += h * 0.05;
                
                // Desenha Rival (Luigi ou Mario Cinza)
                this.drawMarioBack(ctx, cx + r.currentLaneX, rY, w, r.action, false);
                ctx.restore();
            });

            // 4. Jogador (Mario)
            let charY = h * 0.85;
            if(this.action === 'jump') charY -= h * 0.20; 
            if(this.action === 'crouch') charY += h * 0.05;
            
            this.drawMarioBack(ctx, cx + this.currentLaneX, charY, w, this.action, true);

            // 5. Efeitos e Dano
            if(this.hitTimer > 0) {
                ctx.fillStyle = `rgba(255, 0, 0, ${this.hitTimer * 0.1})`;
                ctx.fillRect(0, 0, w, h);
                this.hitTimer--;
            }

            if(this.isOnline) this.sync();
            return this.sc;
        },

        // --- FUNÇÕES DE RENDERIZAÇÃO ---

        renderEnvironment: function(ctx, w, h, horizon) {
            const gradSky = ctx.createLinearGradient(0, 0, 0, horizon);
            gradSky.addColorStop(0, CONF.COLORS.SKY_TOP);
            gradSky.addColorStop(1, CONF.COLORS.SKY_BOT);
            ctx.fillStyle = gradSky; ctx.fillRect(0, 0, w, horizon);
            
            // Nuvens
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            clouds.forEach(c => {
                c.x -= 0.5; if(c.x < -200) c.x = w + 200;
                const s = 1000/c.z;
                ctx.beginPath(); 
                ctx.arc(c.x, c.y + horizon*0.2, 30*s, 0, Math.PI*2); 
                ctx.arc(c.x + 25*s, c.y + horizon*0.2 - 10*s, 35*s, 0, Math.PI*2);
                ctx.fill();
            });

            ctx.fillStyle = CONF.COLORS.GRASS; ctx.fillRect(0, horizon, w, h-horizon);
        },

        renderTrack: function(ctx, w, h, cx, horizon) {
            ctx.save(); ctx.translate(cx, horizon);
            const trackTopW = w * 0.05; 
            const trackBotW = w * 1.1; 
            const groundH = h - horizon;
            
            ctx.beginPath();
            ctx.fillStyle = CONF.COLORS.TRACK; 
            ctx.moveTo(-trackTopW, 0); 
            ctx.lineTo(trackTopW, 0); 
            ctx.lineTo(trackBotW, groundH); 
            ctx.lineTo(-trackBotW, groundH); 
            ctx.fill();

            // Linhas brancas das raias
            const lanes = [-1, -0.33, 0.33, 1];
            ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 4;
            lanes.forEach(l => {
                ctx.beginPath();
                ctx.moveTo(l * trackTopW, 0);
                ctx.lineTo(l * trackBotW, groundH);
                ctx.stroke();
            });
            ctx.restore();
        },

        renderObjects: function(ctx, w, h, cx, horizon) {
            // Spawn Obstáculos
            if(this.state === 'play' && this.f % 80 === 0) {
                const type = Math.random() < 0.5 ? 'pipe' : 'block';
                // Random Lane: -1, 0, 1
                const lane = Math.floor(Math.random() * 3) - 1;
                this.obs.push({ lane: lane, z: 1500, type: type, passed: false });
            }

            const groundH = h - horizon;
            const trackTopW = w * 0.05; 
            const trackBotW = w * 1.1;

            // Render do fundo para frente
            for(let i = this.obs.length - 1; i >= 0; i--) {
                let o = this.obs[i]; 
                o.z -= CONF.SPEED;
                
                if(o.z < -200) { this.obs.splice(i, 1); continue; }

                const scale = CONF.FOCAL_LENGTH / (CONF.FOCAL_LENGTH + o.z);
                if(scale <= 0) continue;

                const screenY = horizon + (groundH * scale); 
                const size = (w * 0.18) * scale; // Tamanho do obstáculo
                
                // Calcula posição X com base na perspectiva
                const currentTrackW = trackTopW + (trackBotW - trackTopW) * scale;
                const laneSpread = currentTrackW * CONF.LANE_SPREAD;
                const sx = cx + (o.lane * laneSpread);

                // Desenha Obstáculo
                if(o.type === 'pipe') {
                    // Cano Verde (Precisa Pular)
                    const pH = size;
                    ctx.fillStyle = '#00aa00'; ctx.fillRect(sx-size/2, screenY-pH, size, pH);
                    ctx.strokeStyle = '#004400'; ctx.lineWidth = 2 * scale; ctx.strokeRect(sx-size/2, screenY-pH, size, pH);
                    // Borda do cano
                    ctx.fillRect(sx-size/2 - 5*scale, screenY-pH, size + 10*scale, size*0.25);
                    ctx.strokeRect(sx-size/2 - 5*scale, screenY-pH, size + 10*scale, size*0.25);
                } else {
                    // Bloco ? (Precisa Agachar)
                    const bH = size * 0.7;
                    const bY = screenY - (size * 2.0); // Flutuando alto
                    ctx.fillStyle = '#f1c40f'; ctx.fillRect(sx-size/2, bY, size, size);
                    ctx.fillStyle = '#000'; ctx.font = `bold ${size*0.6}px monospace`; ctx.textAlign='center';
                    ctx.fillText("?", sx, bY + size*0.7);
                    
                    // Sombra no chão
                    ctx.fillStyle = 'rgba(0,0,0,0.3)';
                    ctx.beginPath(); ctx.ellipse(sx, screenY, size*0.5, size*0.2, 0, 0, Math.PI*2); ctx.fill();
                }

                // COLISÃO
                if(o.z < 20 && o.z > -20 && this.state === 'play' && o.lane === this.lane) {
                    let hit = false;
                    
                    if(o.type === 'pipe' && this.action !== 'jump') hit = true;
                    if(o.type === 'block' && this.action !== 'crouch') hit = true;

                    if(hit) {
                        this.hitTimer = 10;
                        window.Sfx.crash();
                        window.Gfx.shakeScreen(15);
                        window.System.gameOver(this.sc);
                    } else if(!o.passed) {
                        this.sc += 100;
                        window.Sfx.coin();
                        o.passed = true;
                    }
                }
            }
        },

        drawMarioBack: function(ctx, x, y, w, action, isPlayer) {
            const s = w * 0.0035; 
            ctx.save(); 
            ctx.translate(x, y); 
            ctx.scale(s, s);
            
            const cycle = Math.sin(this.f * 0.5) * 15;
            
            // Cores (Se for rival, fica cinzento/fantasma)
            const C_SHIRT = isPlayer ? '#ff0000' : '#888';
            const C_OVERALL = isPlayer ? '#0000ff' : '#666';
            const C_SKIN = '#ffccaa';
            const C_HAIR = '#4a3222';

            // 1. Pernas
            ctx.fillStyle = C_OVERALL;
            if(action === 'run') {
                ctx.fillRect(-15+cycle, 0, 12, 30); 
                ctx.fillRect(5-cycle, 0, 12, 30);
            } else if (action === 'jump') {
                ctx.fillRect(-18, -10, 12, 25);
                ctx.fillRect(6, 5, 12, 25);
            } else { // Crouch
                ctx.fillRect(-20, 5, 12, 15);
                ctx.fillRect(8, 5, 12, 15);
            }

            // 2. Tronco (Costas)
            const bodyY = action === 'crouch' ? 10 : -35;
            
            // Camisa
            ctx.fillStyle = C_SHIRT;
            ctx.beginPath(); ctx.arc(0, bodyY, 25, 0, Math.PI*2); ctx.fill();
            
            // Macacão (Parte traseira)
            ctx.fillStyle = C_OVERALL;
            ctx.fillRect(-18, bodyY, 36, 25);
            ctx.beginPath(); ctx.arc(0, bodyY+25, 18, 0, Math.PI, false); ctx.fill();

            // Alças Amarelas
            ctx.strokeStyle = '#ffff00'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(-15, bodyY-15); ctx.lineTo(-15, bodyY+15); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(15, bodyY-15); ctx.lineTo(15, bodyY+15); ctx.stroke();

            // 3. Cabeça (Nuca)
            const headY = bodyY - 25;
            
            // Pele
            ctx.fillStyle = C_SKIN;
            ctx.beginPath(); ctx.arc(0, headY, 22, 0, Math.PI*2); ctx.fill();
            
            // Cabelo (Castanho)
            ctx.fillStyle = C_HAIR;
            ctx.beginPath(); ctx.arc(0, headY+5, 20, 0, Math.PI, false); ctx.fill();

            // Boné (Visão Traseira)
            ctx.fillStyle = C_SHIRT; // Vermelho
            ctx.beginPath(); ctx.arc(0, headY-5, 23, Math.PI, 0); ctx.fill();

            ctx.restore();
        },

        drawCalibration: function(ctx, w, h, cx) {
            ctx.fillStyle = "rgba(0,0,0,0.9)"; ctx.fillRect(0,0,w,h);
            ctx.fillStyle = "#fff"; ctx.font = "bold 30px Arial"; ctx.textAlign = "center";
            
            ctx.fillText("FIQUE EM POSIÇÃO NEUTRA", cx, h*0.4);
            ctx.fillText("PARA CALIBRAR", cx, h*0.45);
            
            const pct = this.calibSamples.length / 60;
            ctx.fillStyle = "#3498db"; 
            ctx.fillRect(cx - 150, h*0.55, 300 * pct, 20);
            ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; 
            ctx.strokeRect(cx - 150, h*0.55, 300, 20);
        },

        drawMenu: function(ctx, w, h) {
            ctx.fillStyle = "#222"; ctx.fillRect(0,0,w,h);
            ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.font = "bold 35px 'Russo One'";
            ctx.fillText("SUPER RUN", w/2, h*0.3);
            
            ctx.fillStyle = "#e67e22"; ctx.fillRect(w/2-150, h*0.4, 300, 60);
            ctx.fillStyle = "#27ae60"; ctx.fillRect(w/2-150, h*0.6, 300, 60);
            
            ctx.fillStyle = "#fff"; ctx.font = "20px Arial";
            ctx.fillText("CIMA: OFFLINE", w/2, h*0.4+38);
            ctx.fillText("BAIXO: ONLINE", w/2, h*0.6+38);

            if(!window.System.canvas.onclick) {
                window.System.canvas.onclick = (e) => {
                    const y = e.clientY - window.System.canvas.getBoundingClientRect().top;
                    this.selectMode(y < h/2 ? 'OFFLINE' : 'ONLINE');
                    window.System.canvas.onclick = null;
                };
            }
        },

        sync: function() {
            if(!this.isOnline || !this.dbRef) return;
            if(Date.now() - this.lastSync > 100) {
                this.lastSync = Date.now();
                this.dbRef.child('players/' + window.System.playerId).update({
                    lane: this.lane, action: this.action, sc: Math.floor(this.sc),
                    currentLaneX: this.currentLaneX, // Envia para suavizar no rival
                    lastSeen: firebase.database.ServerValue.TIMESTAMP
                });
            }
        }
    };

    window.System.registerGame('run', 'Otto Super Run', '🏃', Logic, {camOpacity: 0.3});
})();
