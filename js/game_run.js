// =============================================================================
// LÓGICA DO JOGO: SUPER RUN (METRO KINGDOM / CITY EDITION)
// ARQUITETO: PARCEIRO DE PROGRAMAÇÃO
// =============================================================================

(function() {
    // --- CONFIGURAÇÕES ---
    const CONF = {
        SPEED: 28,               // Velocidade mais rápida (Cidade)
        HORIZON_Y: 0.35,         // Horizonte
        FOCAL_LENGTH: 300,       
        COLORS: {
            SKY_TOP: '#0d1b2a',    // Céu Noturno
            SKY_BOT: '#415a77',
            ROAD: '#2c3e50',       // Asfalto
            LINES: '#f1c40f',      // Faixas Amarelas
            BUILDING_1: '#1b2631',
            BUILDING_2: '#2e4053',
            PIPE: '#2ecc71'        // Cano Verde Neon
        }
    };

    let buildings = []; // Cenário de fundo

    const Logic = {
        // Estado
        sc: 0,
        f: 0,
        lane: 0,            // -1 (Esq), 0 (Meio), 1 (Dir)
        currentLaneX: 0,    // Suavização
        action: 'run',      // 'run', 'jump', 'crouch'
        
        // Calibração
        state: 'calibrate', 
        baseNoseY: 0,
        calibSamples: [],
        
        // Jogo
        obs: [],
        hitTimer: 0,
        
        // Multiplayer
        roomId: 'room_run_city',
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
            this.state = 'calibrate'; 
            this.calibSamples = [];
            buildings = [];

            // Gerar Skyline Inicial
            for(let i=0; i<20; i++) {
                this.addBuilding(true);
            }

            this.resetMultiplayerState();
            window.System.msg("CALIBRANDO..."); 
        },

        addBuilding: function(initial) {
            const w = window.System.canvas ? window.System.canvas.width : 640;
            const x = initial ? (Math.random() * w * 2) - w : w + 100;
            buildings.push({
                x: x,
                w: 60 + Math.random() * 100,
                h: 150 + Math.random() * 300,
                c: Math.random() > 0.5 ? CONF.COLORS.BUILDING_1 : CONF.COLORS.BUILDING_2,
                windows: Math.random() > 0.3 // Prédio tem janelas?
            });
        },

        resetMultiplayerState: function() {
            this.isOnline = false;
            // Limpeza
            if(window.DB && window.System.playerId) {
                try { 
                    window.DB.ref('rooms/' + this.roomId + '/players/' + window.System.playerId).remove(); 
                    window.DB.ref('rooms/' + this.roomId + '/players').off();
                } catch(e){}
            }
        },

        // --- SELEÇÃO DE MODO (AUTO NOS MENUS GERAIS, MAS AQUI CONFIGURA) ---
        // Chamado internamente ou via UI customizada se necessário
        enableOnline: function() {
            if(!window.DB) return;
            this.isOnline = true;
            this.dbRef = window.DB.ref('rooms/' + this.roomId);
            
            // Ouvinte de Rivais
            this.dbRef.child('players').on('value', snap => {
                const data = snap.val(); if(!data) return;
                const now = Date.now();
                this.rivals = Object.keys(data)
                    .filter(id => id !== window.System.playerId && (now - data[id].lastSeen < 10000))
                    .map(id => ({ id, ...data[id] }));
            });
        },

        // --- UPDATE LOOP ---
        update: function(ctx, w, h, pose) {
            const cx = w / 2;
            const horizon = h * CONF.HORIZON_Y;
            this.f++;

            // 1. INPUT E POSE
            if(pose) {
                const n = pose.keypoints.find(k => k.name === 'nose');
                // Mapeamento: 1-x para espelhar horizontalmente
                const mapPoint = (pt) => ({ x: (1 - pt.x/640)*w, y: (pt.y/480)*h });

                if(n && n.score > 0.4) {
                    const np = mapPoint(n);

                    if(this.state === 'calibrate') {
                        this.calibSamples.push(np.y);
                        this.drawCalibration(ctx, w, h, cx);
                        
                        if(this.calibSamples.length > 50) {
                            const sum = this.calibSamples.reduce((a,b)=>a+b,0);
                            this.baseNoseY = sum / this.calibSamples.length;
                            this.state = 'play';
                            window.System.msg("CORRA!");
                            // Ativar online automaticamente se disponível
                            if(window.DB) this.enableOnline();
                        }
                        return 0;
                    } 
                    else if (this.state === 'play') {
                        // Controles Laterais (Corrigidos)
                        if (np.x < w * 0.4) this.lane = -1;      // Esquerda
                        else if (np.x > w * 0.6) this.lane = 1;  // Direita
                        else this.lane = 0;                      // Centro

                        // Controles Verticais
                        const diff = np.y - this.baseNoseY;
                        if (diff < -35) this.action = 'jump';      // Nariz subiu
                        else if (diff > 35) this.action = 'crouch'; // Nariz desceu
                        else this.action = 'run';
                    }
                }
            }

            // Suavização visual
            const targetLaneX = this.lane * (w * 0.25);
            this.currentLaneX += (targetLaneX - this.currentLaneX) * 0.15;

            // --- RENDERIZAÇÃO ---

            // 1. Cidade (Fundo)
            this.renderCity(ctx, w, h, horizon);

            // 2. Estrada
            this.renderRoad(ctx, w, h, cx, horizon);

            // 3. Obstáculos
            this.renderObstacles(ctx, w, h, cx, horizon);

            // 4. Rivais (Multiplayer)
            this.rivals.forEach(r => {
                // Interpolação simples
                if(typeof r.currX === 'undefined') r.currX = r.lane * (w*0.25);
                r.currX += ((r.lane * (w*0.25)) - r.currX) * 0.1;

                let rY = h * 0.85;
                if(r.action === 'jump') rY -= h * 0.15;
                if(r.action === 'crouch') rY += h * 0.05;

                ctx.save(); ctx.globalAlpha = 0.6; // Fantasma
                this.drawMario(ctx, cx + r.currX, rY, w, r.action, false);
                // Nome do Rival
                ctx.fillStyle = "#fff"; ctx.font = "12px Arial"; ctx.textAlign = "center";
                ctx.fillText("RIVAL", cx + r.currX, rY - (w*0.1));
                ctx.restore();
            });

            // 5. Jogador
            let charY = h * 0.85;
            if(this.action === 'jump') charY -= h * 0.20; 
            if(this.action === 'crouch') charY += h * 0.05;
            
            // Só desenha se não estiver "piscando" por dano
            if (this.hitTimer === 0 || this.f % 4 > 1) {
                this.drawMario(ctx, cx + this.currentLaneX, charY, w, this.action, true);
            }

            // 6. Dano (Flash Vermelho)
            if(this.hitTimer > 0) {
                this.hitTimer--;
                ctx.fillStyle = `rgba(255, 0, 0, 0.3)`;
                ctx.fillRect(0, 0, w, h);
            }

            // Sync Online
            if(this.isOnline && this.state === 'play') {
                this.sc++; // Pontuação por distância
                if(Date.now() - this.lastSync > 100) {
                    this.lastSync = Date.now();
                    this.dbRef.child('players/' + window.System.playerId).update({
                        lane: this.lane,
                        action: this.action,
                        sc: Math.floor(this.sc/10),
                        lastSeen: firebase.database.ServerValue.TIMESTAMP
                    });
                }
            } else if (this.state === 'play') {
                this.sc++;
            }

            return Math.floor(this.sc/10);
        },

        // --- FUNÇÕES GRÁFICAS ---

        renderCity: function(ctx, w, h, horizon) {
            // Céu
            const grad = ctx.createLinearGradient(0, 0, 0, horizon);
            grad.addColorStop(0, CONF.COLORS.SKY_TOP);
            grad.addColorStop(1, CONF.COLORS.SKY_BOT);
            ctx.fillStyle = grad; ctx.fillRect(0, 0, w, horizon);

            // Prédios (Parallax)
            ctx.fillStyle = "#000"; // Chão distante
            ctx.fillRect(0, horizon - 50, w, 50);

            // Atualiza e desenha prédios
            buildings.forEach((b, i) => {
                // Move prédio
                b.x -= 1.5; 
                if(b.x + b.w < 0) {
                    // Recicla prédio para a direita
                    b.x = w;
                    b.h = 100 + Math.random() * 200;
                }

                // Desenha
                ctx.fillStyle = b.c;
                ctx.fillRect(b.x, horizon - b.h, b.w, b.h);

                // Janelas (Luzes da cidade)
                if(b.windows) {
                    ctx.fillStyle = (Math.random() > 0.95) ? '#ffffaa' : '#555'; // Piscar janelas
                    for(let wy = horizon - b.h + 10; wy < horizon - 10; wy += 20) {
                        for(let wx = b.x + 5; wx < b.x + b.w - 5; wx += 15) {
                            if(Math.random() > 0.5) ctx.fillRect(wx, wy, 8, 12);
                        }
                    }
                }
            });

            // Chão Base
            ctx.fillStyle = "#1a1a1a"; ctx.fillRect(0, horizon, w, h - horizon);
        },

        renderRoad: function(ctx, w, h, cx, horizon) {
            ctx.save(); ctx.translate(cx, horizon);
            
            const topW = w * 0.02;
            const botW = w * 1.5;
            const H = h - horizon;

            // Asfalto
            ctx.fillStyle = CONF.COLORS.ROAD;
            ctx.beginPath(); 
            ctx.moveTo(-topW, 0); ctx.lineTo(topW, 0);
            ctx.lineTo(botW, H); ctx.lineTo(-botW, H);
            ctx.fill();

            // Faixas Amarelas
            ctx.strokeStyle = CONF.COLORS.LINES;
            ctx.lineWidth = 4;
            // Faixas divisórias (-0.33 e 0.33 são as divisões das 3 pistas)
            const lanes = [-0.33, 0.33];
            
            lanes.forEach(l => {
                ctx.beginPath();
                ctx.moveTo(l * topW, 0);
                ctx.lineTo(l * botW, H);
                ctx.stroke();
            });

            // Tracejado Central (Efeito de velocidade)
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            const dashOffset = -(this.f * 20) % 100;
            ctx.setLineDash([40, 60]);
            ctx.lineDashOffset = dashOffset;
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, H); ctx.stroke();
            ctx.setLineDash([]);

            ctx.restore();
        },

        renderObstacles: function(ctx, w, h, cx, horizon) {
            // Spawn (Mais frequente na cidade)
            if (this.state === 'play' && this.f % 70 === 0) {
                const lane = Math.floor(Math.random() * 3) - 1; 
                const type = Math.random() < 0.5 ? 'pipe' : 'block';
                this.obs.push({ lane, type, z: 1500, passed: false });
            }

            const groundH = h - horizon;
            const topW = w * 0.02;
            const botW = w * 1.5;

            for(let i = this.obs.length - 1; i >= 0; i--) {
                let o = this.obs[i];
                o.z -= CONF.SPEED;

                if (o.z < -200) { this.obs.splice(i, 1); continue; }

                const scale = CONF.FOCAL_LENGTH / (CONF.FOCAL_LENGTH + o.z);
                if (scale <= 0) continue;

                const screenY = horizon + (groundH * scale);
                const size = (w * 0.15) * scale;
                
                // Calcula X baseado na perspectiva da estrada
                const currentW = topW + (botW - topW) * scale;
                const laneSpread = currentW * 0.66; // Largura relativa das faixas
                const sx = cx + (o.lane * laneSpread);

                // Desenha Obstáculo
                if (o.type === 'pipe') {
                    // CANO (Pular)
                    const pH = size * 1.2;
                    ctx.fillStyle = CONF.COLORS.PIPE;
                    ctx.fillRect(sx - size/2, screenY - pH, size, pH);
                    // Borda
                    ctx.fillStyle = '#27ae60'; // Verde mais escuro
                    ctx.fillRect(sx - size/1.8, screenY - pH, size * 1.1, size * 0.3);
                    
                    // Detalhe visual (reflexo)
                    ctx.fillStyle = 'rgba(255,255,255,0.3)';
                    ctx.fillRect(sx - size/2 + 5, screenY - pH + 5, 5, pH - 10);

                } else {
                    // BLOCO (Agachar)
                    const bY = screenY - (size * 2.5); // Alto
                    ctx.fillStyle = '#f39c12'; // Ouro
                    ctx.fillRect(sx - size/2, bY, size, size);
                    ctx.fillStyle = '#000'; 
                    ctx.strokeRect(sx - size/2, bY, size, size);
                    ctx.textAlign = 'center'; ctx.font = `bold ${size}px monospace`;
                    ctx.fillText("?", sx, bY + size * 0.8);
                    
                    // Sombra no chão
                    ctx.fillStyle = 'rgba(0,0,0,0.5)';
                    ctx.beginPath(); ctx.ellipse(sx, screenY, size/2, size/4, 0, 0, Math.PI*2); ctx.fill();
                }

                // COLISÃO
                // Z próximo de 0 (jogador) e mesma faixa
                if (o.z < 60 && o.z > -60 && this.state === 'play' && o.lane === this.lane) {
                    let hit = false;
                    if (o.type === 'pipe' && this.action !== 'jump') hit = true;
                    if (o.type === 'block' && this.action !== 'crouch') hit = true;

                    if (hit) {
                        this.hitTimer = 20;
                        window.Sfx.play(100, 'sawtooth', 0.2, 0.2); // Som Dano
                        this.sc = Math.max(0, this.sc - 500);
                        window.System.msg("AI!");
                        o.passed = true;
                    } else if (!o.passed) {
                        window.Sfx.play(1000, 'sine', 0.1, 0.1); // Som Coin
                        this.sc += 100;
                        o.passed = true;
                    }
                }
            }
        },

        drawMario: function(ctx, x, y, w, action, isPlayer) {
            const s = w * 0.003; 
            ctx.save(); ctx.translate(x, y); ctx.scale(s, s);

            // Cor do macacão (diferente se for rival)
            const overallColor = isPlayer ? '#0000ff' : '#555';
            const shirtColor = isPlayer ? '#ff0000' : '#888';

            // Animação de corrida
            const legOffset = (action === 'run') ? Math.sin(this.f * 0.5) * 15 : 0;

            // 1. Pernas
            ctx.fillStyle = overallColor;
            if(action === 'jump') {
                // Pernas encolhidas
                ctx.fillRect(-20, -10, 15, 25);
                ctx.fillRect(5, -5, 15, 20);
            } else {
                ctx.fillRect(-20 + legOffset, 0, 15, 35);
                ctx.fillRect(5 - legOffset, 0, 15, 35);
            }

            // 2. Tronco
            const bodyY = action === 'crouch' ? 10 : -40;
            // Camisa
            ctx.fillStyle = shirtColor;
            ctx.beginPath(); ctx.arc(0, bodyY, 30, 0, Math.PI*2); ctx.fill();
            // Macacão costas
            ctx.fillStyle = overallColor;
            ctx.fillRect(-20, bodyY, 40, 35);
            ctx.beginPath(); ctx.arc(0, bodyY+35, 20, 0, Math.PI, false); ctx.fill();
            
            // Botões amarelos das alças
            ctx.fillStyle = "#ff0";
            ctx.beginPath(); ctx.arc(-15, bodyY-5, 5, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(15, bodyY-5, 5, 0, Math.PI*2); ctx.fill();

            // 3. Cabeça
            const headY = bodyY - 35;
            ctx.fillStyle = "#ffccaa"; // Pele
            ctx.beginPath(); ctx.arc(0, headY, 25, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "#4a2c2a"; // Cabelo
            ctx.beginPath(); ctx.arc(0, headY+5, 26, 0, Math.PI, false); ctx.fill();
            // Boné
            ctx.fillStyle = shirtColor;
            ctx.beginPath(); ctx.arc(0, headY-5, 27, Math.PI, 0); ctx.fill();
            
            // "M" no boné
            if(isPlayer) {
                ctx.fillStyle = "white"; ctx.font = "bold 20px Arial"; ctx.textAlign = "center";
                ctx.fillText("M", 0, headY-15);
            }

            ctx.restore();
        },

        drawCalibration: function(ctx, w, h, cx) {
            ctx.fillStyle = "rgba(0,0,0,0.8)"; ctx.fillRect(0,0,w,h);
            ctx.fillStyle = "#fff"; ctx.font = "bold 30px Arial"; ctx.textAlign = "center";
            ctx.fillText("FIQUE EM PÉ", cx, h*0.4);
            ctx.fillText("PARA CALIBRAR", cx, h*0.46);
            
            // Barra de progresso
            const pct = this.calibSamples.length / 50;
            ctx.fillStyle = "#2ecc71";
            ctx.fillRect(cx - 100, h*0.55, 200 * pct, 20);
            ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
            ctx.strokeRect(cx - 100, h*0.55, 200, 20);
        }
    };

    window.System.registerGame('run', 'Super Run City', '🏙️', Logic, {camOpacity: 0.2});
})();