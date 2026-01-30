// =============================================================================
// LÓGICA DO JOGO: SUPER RUN (MARIO RACE EDITION - V4)
// ARQUITETO: PARCEIRO DE PROGRAMAÇÃO
// =============================================================================

(function() {
    // --- CONFIGURAÇÕES ---
    const CONF = {
        SPEED: 28,               // Velocidade base
        HORIZON_Y: 0.35,         // Altura do horizonte
        FOCAL_LENGTH: 300,
        GOAL_DISTANCE: 10000,    // Distância para terminar a fase (Metros)
        COLORS: {
            SKY_TOP: '#0d1b2a',    // Céu
            SKY_BOT: '#415a77',
            ROAD: '#2c3e50',
            LINES: '#f1c40f',
            PIPE: '#2ecc71',
            UI_BG: 'rgba(0,0,0,0.5)',
            UI_BAR: '#fff'
        }
    };

    let buildings = [];

    const Logic = {
        // Estado
        distance: 0,        // Distância percorrida
        coins: 0,           // Moedas coletadas
        f: 0,
        lane: 0,            // -1, 0, 1
        currentLaneX: 0,
        action: 'run',
        
        // Estado de Jogo
        state: 'calibrate', // calibrate -> play -> finished
        rank: 1,            // Posição atual (1º, 2º...)
        
        // Calibração
        baseNoseY: 0,
        calibSamples: [],
        
        // Objetos
        obs: [],
        hitTimer: 0,
        
        // Multiplayer
        roomId: 'room_run_race',
        isOnline: false,
        rivals: [],
        dbRef: null,
        lastSync: 0,

        // --- INICIALIZAÇÃO ---
        init: function() { 
            this.distance = 0;
            this.coins = 0;
            this.f = 0; 
            this.obs = []; 
            this.action = 'run';
            this.hitTimer = 0; 
            this.state = 'calibrate'; 
            this.calibSamples = [];
            this.rank = 1;
            buildings = [];

            // Cenário Inicial
            for(let i=0; i<20; i++) this.addBuilding(true);

            this.resetMultiplayerState();
            window.System.msg("CALIBRANDO..."); 
        },

        addBuilding: function(initial) {
            const w = window.System.canvas ? window.System.canvas.width : 640;
            const x = initial ? (Math.random() * w * 2) - w : w + 100;
            buildings.push({
                x: x, w: 60 + Math.random() * 100, h: 100 + Math.random() * 300,
                c: Math.random() > 0.5 ? '#1b2631' : '#2e4053',
                windows: Math.random() > 0.3
            });
        },

        resetMultiplayerState: function() {
            this.isOnline = false;
            if(window.DB && window.System.playerId) {
                try { 
                    window.DB.ref('rooms/' + this.roomId + '/players/' + window.System.playerId).remove(); 
                    window.DB.ref('rooms/' + this.roomId + '/players').off();
                } catch(e){}
            }
        },

        enableOnline: function() {
            if(!window.DB) return;
            this.isOnline = true;
            this.dbRef = window.DB.ref('rooms/' + this.roomId);
            
            // Entrar na sala
            this.dbRef.child('players/' + window.System.playerId).set({
                distance: 0, coins: 0, finished: false,
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            });

            // Ouvir rivais
            this.dbRef.child('players').on('value', snap => {
                const data = snap.val(); if(!data) return;
                this.rivals = Object.keys(data)
                    .filter(id => id !== window.System.playerId)
                    .map(id => ({ id, ...data[id] }));
            });
        },

        // --- UPDATE LOOP ---
        update: function(ctx, w, h, pose) {
            const cx = w / 2;
            const horizon = h * CONF.HORIZON_Y;
            this.f++;

            // 1. INPUT (Pulo/Agacha/Lados)
            if(pose) {
                const n = pose.keypoints.find(k => k.name === 'nose');
                const mapPoint = (pt) => ({ x: (1 - pt.x/640)*w, y: (pt.y/480)*h });

                if(n && n.score > 0.4) {
                    const np = mapPoint(n);

                    if(this.state === 'calibrate') {
                        this.calibSamples.push(np.y);
                        this.drawCalibration(ctx, w, h, cx);
                        if(this.calibSamples.length > 50) {
                            this.baseNoseY = this.calibSamples.reduce((a,b)=>a+b,0)/this.calibSamples.length;
                            this.state = 'play';
                            window.System.msg("LARGADA!");
                            window.Sfx.play(600, 'square', 0.5, 0.2); // Som de largada
                            if(window.DB) this.enableOnline();
                        }
                        return 0;
                    } 
                    else if (this.state === 'play') {
                        // Controles
                        if (np.x < w * 0.4) this.lane = -1;
                        else if (np.x > w * 0.6) this.lane = 1;
                        else this.lane = 0;

                        const diff = np.y - this.baseNoseY;
                        if (diff < -35) this.action = 'jump';
                        else if (diff > 35) this.action = 'crouch';
                        else this.action = 'run';
                    }
                }
            }

            // Suavização
            this.currentLaneX += ((this.lane * (w * 0.25)) - this.currentLaneX) * 0.15;

            // --- LÓGICA DE JOGO ---
            if (this.state === 'play') {
                // Avanço
                this.distance += (CONF.SPEED / 2); // Metros percorridos
                
                // Checagem de Vitória
                if (this.distance >= CONF.GOAL_DISTANCE) {
                    this.state = 'finished';
                    window.Sfx.play(800, 'sine', 0.1, 0.5); // Victory sound
                    window.System.gameOver("CHEGADA! RANK: " + this.rank + "º");
                    if(this.isOnline) {
                        this.dbRef.child('players/' + window.System.playerId).update({ finished: true });
                    }
                }

                // Cálculo de Ranking
                if (this.isOnline) {
                    // Conta quantos rivais têm distância maior que a minha
                    let better = 0;
                    this.rivals.forEach(r => {
                        if (r.distance > this.distance) better++;
                    });
                    this.rank = 1 + better;
                }
            }

            // --- RENDERIZAÇÃO ---
            this.renderCity(ctx, w, h, horizon);
            this.renderRoad(ctx, w, h, cx, horizon);
            this.renderObstacles(ctx, w, h, cx, horizon);

            // Rivais (Fantasmas)
            this.rivals.forEach(r => {
                // Interpolação X
                if(typeof r.currX === 'undefined') r.currX = r.lane * (w*0.25);
                r.currX += ((r.lane * (w*0.25)) - r.currX) * 0.1;
                
                // Desenha Rival apenas se estiver próximo (simulado)
                // Na verdade desenhamos sempre para feedback visual no multiplayer, 
                // mas podemos deixá-lo transparente
                let rY = h * 0.85;
                if(r.action === 'jump') rY -= h * 0.15;
                
                ctx.save(); ctx.globalAlpha = 0.5;
                this.drawMario(ctx, cx + r.currX, rY, w, r.action, false);
                // Nome e Distância do Rival
                ctx.fillStyle = "#fff"; ctx.font = "10px Arial"; ctx.textAlign = "center";
                ctx.fillText(`RIVAL (${Math.floor(r.distance)}m)`, cx + r.currX, rY - (w*0.12));
                ctx.restore();
            });

            // Jogador
            if (this.state !== 'finished') {
                let charY = h * 0.85;
                if(this.action === 'jump') charY -= h * 0.20; 
                if(this.action === 'crouch') charY += h * 0.05;
                
                if (this.hitTimer === 0 || this.f % 4 > 1) {
                    this.drawMario(ctx, cx + this.currentLaneX, charY, w, this.action, true);
                }
            }

            // Dano
            if(this.hitTimer > 0) {
                this.hitTimer--;
                ctx.fillStyle = `rgba(255, 0, 0, 0.3)`; ctx.fillRect(0, 0, w, h);
            }

            // HUD DE CORRIDA (PROGRESS BAR)
            this.drawRaceHUD(ctx, w, h);

            // Sync Online
            if(this.isOnline && this.state === 'play') {
                if(Date.now() - this.lastSync > 100) {
                    this.lastSync = Date.now();
                    this.dbRef.child('players/' + window.System.playerId).update({
                        lane: this.lane,
                        action: this.action,
                        distance: Math.floor(this.distance),
                        coins: this.coins,
                        lastSeen: firebase.database.ServerValue.TIMESTAMP
                    });
                }
            }

            return this.coins; // Retorna moedas como Score principal para o Core
        },

        // --- FUNÇÕES GRÁFICAS ---

        drawRaceHUD: function(ctx, w, h) {
            // 1. Barra de Progresso no Topo
            const barW = w * 0.8;
            const barH = 10;
            const barX = (w - barW) / 2;
            const barY = 40;

            // Fundo da barra
            ctx.fillStyle = "rgba(0,0,0,0.5)";
            ctx.roundRect(barX, barY, barW, barH, 5);
            ctx.fill();
            
            // Linha de chegada
            ctx.fillStyle = "#fff"; // Bandeira
            ctx.fillRect(barX + barW - 2, barY - 10, 4, 30);
            ctx.fillStyle = "#e74c3c"; // Pano da bandeira
            ctx.beginPath(); ctx.moveTo(barX + barW, barY-10); ctx.lineTo(barX+barW+15, barY-5); ctx.lineTo(barX+barW, barY); ctx.fill();

            // Ícone do Jogador (Mario)
            const myPct = Math.min(1, this.distance / CONF.GOAL_DISTANCE);
            const myX = barX + (barW * myPct);
            
            ctx.fillStyle = "#ff0000"; // Vermelho Mario
            ctx.beginPath(); ctx.arc(myX, barY + 5, 12, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
            
            // Ícones dos Rivais
            this.rivals.forEach(r => {
                const rPct = Math.min(1, (r.distance || 0) / CONF.GOAL_DISTANCE);
                const rX = barX + (barW * rPct);
                ctx.fillStyle = "#3498db"; // Azul Rival
                ctx.beginPath(); ctx.arc(rX, barY + 5, 8, 0, Math.PI*2); ctx.fill();
            });

            // 2. Texto de Distância e Posição
            ctx.fillStyle = "#fff";
            ctx.font = "bold 20px 'Russo One'";
            ctx.textAlign = "left";
            ctx.fillText(`${Math.floor(this.distance)}m / ${CONF.GOAL_DISTANCE}m`, 20, 80);
            
            // Moedas
            ctx.fillStyle = "#f1c40f";
            ctx.textAlign = "right";
            ctx.fillText(`💰 ${this.coins}`, w - 20, 80);

            // RANKING GIGANTE
            if (this.isOnline) {
                ctx.fillStyle = this.rank === 1 ? "#f1c40f" : "#fff";
                ctx.font = "italic bold 40px 'Russo One'";
                ctx.strokeStyle = "#000"; ctx.lineWidth = 4;
                const txt = this.rank + "º";
                ctx.strokeText(txt, w - 60, 130);
                ctx.fillText(txt, w - 60, 130);
            }
        },

        renderCity: function(ctx, w, h, horizon) {
            const grad = ctx.createLinearGradient(0, 0, 0, horizon);
            grad.addColorStop(0, CONF.COLORS.SKY_TOP); grad.addColorStop(1, CONF.COLORS.SKY_BOT);
            ctx.fillStyle = grad; ctx.fillRect(0, 0, w, horizon);

            // Prédios
            ctx.fillStyle = "#000"; ctx.fillRect(0, horizon - 50, w, 50);
            buildings.forEach((b, i) => {
                b.x -= 1.5 + (CONF.SPEED * 0.05); // Move com a velocidade
                if(b.x + b.w < 0) { b.x = w; b.h = 100 + Math.random() * 200; }
                
                ctx.fillStyle = b.c;
                ctx.fillRect(b.x, horizon - b.h, b.w, b.h);
                if(b.windows) {
                    ctx.fillStyle = (Math.random() > 0.98) ? '#ffffaa' : '#444'; 
                    for(let wy = horizon - b.h + 10; wy < horizon - 10; wy += 20) {
                        for(let wx = b.x + 5; wx < b.x + b.w - 5; wx += 15) {
                            if(Math.random() > 0.6) ctx.fillRect(wx, wy, 6, 10);
                        }
                    }
                }
            });
            ctx.fillStyle = "#1a1a1a"; ctx.fillRect(0, horizon, w, h - horizon);
        },

        renderRoad: function(ctx, w, h, cx, horizon) {
            ctx.save(); ctx.translate(cx, horizon);
            const topW = w * 0.02; const botW = w * 1.5; const H = h - horizon;

            ctx.fillStyle = CONF.COLORS.ROAD;
            ctx.beginPath(); ctx.moveTo(-topW, 0); ctx.lineTo(topW, 0); ctx.lineTo(botW, H); ctx.lineTo(-botW, H); ctx.fill();

            // Linhas
            ctx.strokeStyle = CONF.COLORS.LINES; ctx.lineWidth = 4;
            [-0.33, 0.33].forEach(l => {
                ctx.beginPath(); ctx.moveTo(l * topW, 0); ctx.lineTo(l * botW, H); ctx.stroke();
            });

            ctx.restore();
        },

        renderObstacles: function(ctx, w, h, cx, horizon) {
            // Spawn Obstáculos (Frequência baseada na distância para aumentar dificuldade)
            if (this.state === 'play' && this.f % 70 === 0) {
                const lane = Math.floor(Math.random() * 3) - 1; 
                const type = Math.random() < 0.6 ? 'pipe' : 'block';
                this.obs.push({ lane, type, z: 1500, passed: false });
            }

            const groundH = h - horizon;
            const topW = w * 0.02; const botW = w * 1.5;

            for(let i = this.obs.length - 1; i >= 0; i--) {
                let o = this.obs[i];
                o.z -= CONF.SPEED;

                if (o.z < -200) { this.obs.splice(i, 1); continue; }

                const scale = CONF.FOCAL_LENGTH / (CONF.FOCAL_LENGTH + o.z);
                if (scale <= 0) continue;

                const screenY = horizon + (groundH * scale);
                const size = (w * 0.15) * scale;
                const currentW = topW + (botW - topW) * scale;
                const laneSpread = currentW * 0.66; 
                const sx = cx + (o.lane * laneSpread);

                if (o.type === 'pipe') {
                    // CANO
                    const pH = size * 1.2;
                    ctx.fillStyle = CONF.COLORS.PIPE; ctx.fillRect(sx - size/2, screenY - pH, size, pH);
                    ctx.strokeStyle = '#004400'; ctx.lineWidth = 2; ctx.strokeRect(sx - size/2, screenY - pH, size, pH);
                    // Topo do cano
                    ctx.fillRect(sx - size/1.8, screenY - pH, size * 1.1, size * 0.3);
                    ctx.strokeRect(sx - size/1.8, screenY - pH, size * 1.1, size * 0.3);
                } else {
                    // BLOCO MOEDA
                    const bY = screenY - (size * 2.5); 
                    ctx.fillStyle = '#f39c12'; ctx.fillRect(sx - size/2, bY, size, size);
                    ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.strokeRect(sx - size/2, bY, size, size);
                    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `bold ${size}px monospace`;
                    ctx.fillText("?", sx, bY + size * 0.8);
                }

                // COLISÃO
                if (o.z < 60 && o.z > -60 && this.state === 'play' && o.lane === this.lane) {
                    let hit = false;
                    if (o.type === 'pipe' && this.action !== 'jump') hit = true;
                    if (o.type === 'block' && this.action !== 'crouch') hit = true;

                    if (hit) {
                        this.hitTimer = 20;
                        window.Sfx.play(100, 'sawtooth', 0.2, 0.2); 
                        // Bater recua um pouco ou perde moedas
                        this.coins = Math.max(0, this.coins - 5);
                        window.System.msg("BATEU!");
                        o.passed = true;
                    } else if (!o.passed) {
                        window.Sfx.play(1000, 'sine', 0.1, 0.1); 
                        this.coins += 1; // Ganha Moeda
                        o.passed = true;
                    }
                }
            }
        },

        drawMario: function(ctx, x, y, w, action, isPlayer) {
            const s = w * 0.003; 
            ctx.save(); ctx.translate(x, y); ctx.scale(s, s);

            const overallColor = isPlayer ? '#0000ff' : '#555';
            const shirtColor = isPlayer ? '#ff0000' : '#888';
            const legOffset = (action === 'run') ? Math.sin(this.f * 0.5) * 15 : 0;

            // Pernas
            ctx.fillStyle = overallColor;
            if(action === 'jump') { ctx.fillRect(-20, -10, 15, 25); ctx.fillRect(5, -5, 15, 20); } 
            else { ctx.fillRect(-20 + legOffset, 0, 15, 35); ctx.fillRect(5 - legOffset, 0, 15, 35); }

            // Tronco
            const bodyY = action === 'crouch' ? 10 : -40;
            ctx.fillStyle = shirtColor; ctx.beginPath(); ctx.arc(0, bodyY, 30, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = overallColor; ctx.fillRect(-20, bodyY, 40, 35);
            
            // Cabeça
            const headY = bodyY - 35;
            ctx.fillStyle = "#ffccaa"; ctx.beginPath(); ctx.arc(0, headY, 25, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "#4a2c2a"; ctx.beginPath(); ctx.arc(0, headY+5, 26, 0, Math.PI, false); ctx.fill();
            ctx.fillStyle = shirtColor; ctx.beginPath(); ctx.arc(0, headY-5, 27, Math.PI, 0); ctx.fill(); // Boné

            ctx.restore();
        },

        drawCalibration: function(ctx, w, h, cx) {
            ctx.fillStyle = "rgba(0,0,0,0.85)"; ctx.fillRect(0,0,w,h);
            ctx.fillStyle = "#fff"; ctx.font = "bold 30px Arial"; ctx.textAlign = "center";
            ctx.fillText("FIQUE EM PÉ", cx, h*0.4);
            const pct = this.calibSamples.length / 50;
            ctx.fillStyle = "#2ecc71"; ctx.fillRect(cx - 100, h*0.55, 200 * pct, 20);
            ctx.strokeStyle = "#fff"; ctx.strokeRect(cx - 100, h*0.55, 200, 20);
        }
    };

    window.System.registerGame('run', 'Super Run Race', '🏙️', Logic, {camOpacity: 0.2});
})();