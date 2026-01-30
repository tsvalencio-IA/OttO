// =============================================================================
// LÓGICA DO JOGO: SUPER MARIO RUN (WII EDITION - OBSTÁCULOS E ANIMAÇÃO)
// ARQUITETO: PARCEIRO DE PROGRAMAÇÃO
// =============================================================================

(function() {
    // --- CONFIGURAÇÕES VISUAIS & GAMEPLAY ---
    const CONF = {
        SPEED: 22,               // Velocidade do jogo
        HORIZON_Y: 0.38,         // Altura do horizonte (céu/chão)
        FOCAL_LENGTH: 320,       // Perspectiva 3D
        COLORS: {
            SKY_TOP: '#5c94fc',    // Azul Céu Mario
            SKY_BOT: '#95b8ff',
            GRASS: '#00cc00',      // Verde Grama
            TRACK: '#d65a4e',      // Terra/Pista
            PIPE:  '#00aa00',      // Verde Cano
            BLOCK: '#f1c40f'       // Amarelo Bloco
        }
    };

    let particles = [];
    let clouds = [];

    const Logic = {
        // Estado do Jogo
        sc: 0,              // Pontuação
        f: 0,               // Frame counter
        lane: 0,            // Faixa atual: -1 (Esq), 0 (Meio), 1 (Dir)
        currentLaneX: 0,    // Posição visual suavizada
        action: 'run',      // Ações: 'run', 'jump', 'crouch'
        
        // Calibração
        state: 'calibrate', // calibrate -> play -> gameover
        baseNoseY: 0,       // Altura base do nariz
        calibSamples: [],   // Amostras para calibração
        
        // Objetos do Mundo
        obs: [],            // Obstáculos
        hitTimer: 0,        // Tempo de invencibilidade/dano
        
        // Multiplayer (Estrutura de dados)
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
            this.state = 'calibrate'; 
            this.calibSamples = [];
            
            // Gerar nuvens aleatórias no fundo
            for(let i=0; i<8; i++) {
                clouds.push({ 
                    x: (Math.random()*2000)-1000, 
                    y: Math.random()*200, 
                    z: Math.random()*1000 + 500 
                });
            }

            this.resetMultiplayerState();
            window.System.msg("CALIBRANDO..."); 
        },

        resetMultiplayerState: function() {
            this.isOnline = false;
            // Limpeza de Firebase se existir
            if(window.DB && window.System.playerId) {
                try { 
                    window.DB.ref('rooms/' + this.roomId + '/players/' + window.System.playerId).remove(); 
                } catch(e){}
            }
        },

        // --- LOOP PRINCIPAL (UPDATE) ---
        update: function(ctx, w, h, pose) {
            const cx = w / 2;
            const horizon = h * CONF.HORIZON_Y;
            this.f++;

            // 1. PROCESSAMENTO DE POSE (INPUT)
            if(pose) {
                const n = pose.keypoints.find(k => k.name === 'nose');
                // Mapeamento Espelhado (1-x) para direita ser direita na tela
                const mapPoint = (pt) => ({ x: (1 - pt.x/640)*w, y: (pt.y/480)*h });

                if(n && n.score > 0.4) {
                    const np = mapPoint(n);

                    // FASE 1: CALIBRAÇÃO
                    if(this.state === 'calibrate') {
                        this.calibSamples.push(np.y);
                        this.drawCalibration(ctx, w, h, cx);
                        
                        // Após 60 frames (aprox 2 seg), define a altura base
                        if(this.calibSamples.length > 60) {
                            const sum = this.calibSamples.reduce((a,b)=>a+b,0);
                            this.baseNoseY = sum / this.calibSamples.length;
                            this.state = 'play'; 
                            window.System.msg("VAI!"); 
                            window.Sfx.play(400, 'square', 0.5, 0.1);
                        }
                        return 0;
                    } 
                    // FASE 2: JOGO
                    else if (this.state === 'play') {
                        // Faixas Laterais
                        if (np.x < w * 0.35) this.lane = -1;      // Esquerda
                        else if (np.x > w * 0.65) this.lane = 1;  // Direita
                        else this.lane = 0;                       // Centro

                        // Pulo e Agachamento (Baseado na calibração)
                        const diff = np.y - this.baseNoseY;
                        
                        // Se o nariz subir muito (diff negativo) -> Pulo
                        if (diff < -40) this.action = 'jump';
                        // Se o nariz descer muito (diff positivo) -> Agacha
                        else if (diff > 40) this.action = 'crouch';
                        else this.action = 'run';
                    }
                }
            }

            // Suavização do movimento lateral do personagem
            const targetLaneX = this.lane * (w * 0.25);
            this.currentLaneX += (targetLaneX - this.currentLaneX) * 0.15;

            // --- RENDERIZAÇÃO ---
            
            // 1. Cenário (Céu e Chão)
            this.renderEnvironment(ctx, w, h, horizon);
            
            // 2. Pista
            this.renderTrack(ctx, w, h, cx, horizon);
            
            // 3. Obstáculos (Lógica e Desenho)
            this.renderObjects(ctx, w, h, cx, horizon);

            // 4. Personagem (Mario)
            // Define altura Y baseada na ação
            let charY = h * 0.85;
            if(this.action === 'jump') charY -= h * 0.20; 
            if(this.action === 'crouch') charY += h * 0.05;
            
            this.drawMarioBack(ctx, cx + this.currentLaneX, charY, w, this.action);

            // 5. Feedback de Dano (Tela Vermelha)
            if(this.hitTimer > 0) {
                ctx.fillStyle = `rgba(255, 0, 0, ${this.hitTimer * 0.1})`;
                ctx.fillRect(0, 0, w, h);
                this.hitTimer--;
            }

            // Pontuação Simples
            this.sc++;

            return Math.floor(this.sc / 10); // Retorna pontuação dividida
        },

        // --- FUNÇÕES DE RENDERIZAÇÃO ---

        renderEnvironment: function(ctx, w, h, horizon) {
            // Céu Degradê
            const gradSky = ctx.createLinearGradient(0, 0, 0, horizon);
            gradSky.addColorStop(0, CONF.COLORS.SKY_TOP);
            gradSky.addColorStop(1, CONF.COLORS.SKY_BOT);
            ctx.fillStyle = gradSky; ctx.fillRect(0, 0, w, horizon);
            
            // Nuvens (Parallax simples)
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            clouds.forEach(c => {
                c.x -= 0.5; // Move nuvens lentamente
                if(c.x < -200) c.x = w + 200;
                
                const s = 1000/c.z;
                ctx.beginPath(); 
                ctx.arc(c.x, c.y + horizon*0.3, 40*s, 0, Math.PI*2); 
                ctx.arc(c.x + 30*s, c.y + horizon*0.3 - 10*s, 45*s, 0, Math.PI*2);
                ctx.arc(c.x + 60*s, c.y + horizon*0.3, 40*s, 0, Math.PI*2);
                ctx.fill();
            });

            // Chão Gramado
            ctx.fillStyle = CONF.COLORS.GRASS; ctx.fillRect(0, horizon, w, h-horizon);
        },

        renderTrack: function(ctx, w, h, cx, horizon) {
            ctx.save(); ctx.translate(cx, horizon);
            
            // Largura topo vs base (Perspectiva)
            const trackTopW = w * 0.05; 
            const trackBotW = w * 1.2; 
            const groundH = h - horizon;
            
            // Pista Principal
            ctx.beginPath();
            ctx.fillStyle = CONF.COLORS.TRACK; 
            ctx.moveTo(-trackTopW, 0); 
            ctx.lineTo(trackTopW, 0); 
            ctx.lineTo(trackBotW, groundH); 
            ctx.lineTo(-trackBotW, groundH); 
            ctx.fill();

            // Linhas Divisórias das Faixas
            // Lanes: -1, 0, 1 (Divisões em -0.33 e 0.33)
            ctx.strokeStyle = 'rgba(255,255,255,0.5)'; 
            ctx.lineWidth = 4;
            
            [-0.33, 0.33].forEach(l => {
                ctx.beginPath();
                ctx.moveTo(l * trackTopW, 0);
                ctx.lineTo(l * trackBotW, groundH);
                ctx.stroke();
            });
            
            // Zebras laterais (Opcional, para velocidade)
            ctx.strokeStyle = '#fff';
            const zebraStep = (this.f % 20) * (groundH/20);
            // (Código simplificado para evitar complexidade visual excessiva)

            ctx.restore();
        },

        renderObjects: function(ctx, w, h, cx, horizon) {
            // GERAR OBSTÁCULOS
            // A cada 90 frames, gera um obstáculo
            if(this.state === 'play' && this.f % 90 === 0) {
                const type = Math.random() < 0.5 ? 'pipe' : 'block';
                const lane = Math.floor(Math.random() * 3) - 1; // -1, 0 ou 1
                this.obs.push({ 
                    lane: lane, 
                    z: 1500, // Começa longe (Z positivo)
                    type: type, 
                    passed: false 
                });
            }

            const groundH = h - horizon;
            const trackTopW = w * 0.05; 
            const trackBotW = w * 1.2;

            // Renderizar de trás para frente (Z-sorting implícito pelo loop reverso)
            for(let i = this.obs.length - 1; i >= 0; i--) {
                let o = this.obs[i]; 
                o.z -= CONF.SPEED; // Move em direção à câmera
                
                // Se passou da câmera, remove
                if(o.z < -200) { this.obs.splice(i, 1); continue; }

                // Cálculo de Projeção 3D
                const scale = CONF.FOCAL_LENGTH / (CONF.FOCAL_LENGTH + o.z);
                
                if(scale <= 0) continue;

                // Posição Y na tela
                const screenY = horizon + (groundH * scale); 
                // Tamanho visual
                const size = (w * 0.18) * scale; 
                
                // Posição X na tela (Interpolando largura da pista)
                const currentTrackW = trackTopW + (trackBotW - trackTopW) * scale;
                const laneSpread = currentTrackW * 0.8; // Espalhamento das faixas
                const sx = cx + (o.lane * laneSpread * 0.55); // *0.55 para ajustar ao centro das faixas

                // DESENHO DO OBSTÁCULO
                if(o.type === 'pipe') {
                    // --- CANO VERDE (Deve Pular) ---
                    const pH = size;
                    // Corpo do cano
                    ctx.fillStyle = CONF.COLORS.PIPE; 
                    ctx.fillRect(sx - size/2, screenY - pH, size, pH);
                    ctx.strokeStyle = '#004400'; 
                    ctx.lineWidth = 2; 
                    ctx.strokeRect(sx - size/2, screenY - pH, size, pH);
                    
                    // Borda superior do cano (Rim)
                    const rimH = size * 0.25;
                    const rimW = size * 1.1;
                    ctx.fillRect(sx - rimW/2, screenY - pH, rimW, rimH);
                    ctx.strokeRect(sx - rimW/2, screenY - pH, rimW, rimH);
                    
                    // Brilho
                    ctx.fillStyle = 'rgba(255,255,255,0.3)';
                    ctx.fillRect(sx - size/2 + size*0.1, screenY - pH + 5, size*0.1, pH-10);

                } else {
                    // --- BLOCO '?' (Deve Agachar) ---
                    // Flutua no ar
                    const bY = screenY - (size * 2.2); 
                    
                    // Caixa Dourada
                    ctx.fillStyle = CONF.COLORS.BLOCK; 
                    ctx.fillRect(sx - size/2, bY, size, size);
                    ctx.strokeStyle = '#c49c00'; 
                    ctx.lineWidth = 3; 
                    ctx.strokeRect(sx - size/2, bY, size, size);
                    
                    // Pontos nos cantos (Parafusos)
                    ctx.fillStyle = '#000';
                    const dotS = size * 0.1;
                    ctx.fillRect(sx - size/2 + 2, bY + 2, dotS, dotS);
                    ctx.fillRect(sx + size/2 - 2 - dotS, bY + 2, dotS, dotS);
                    ctx.fillRect(sx - size/2 + 2, bY + size - 2 - dotS, dotS, dotS);
                    ctx.fillRect(sx + size/2 - 2 - dotS, bY + size - 2 - dotS, dotS, dotS);

                    // Interrogação
                    ctx.fillStyle = '#fff'; 
                    ctx.font = `bold ${size*0.6}px monospace`; 
                    ctx.textAlign='center';
                    ctx.fillText("?", sx, bY + size*0.7);
                    
                    // Sombra no chão
                    ctx.fillStyle = 'rgba(0,0,0,0.3)';
                    ctx.beginPath(); 
                    ctx.ellipse(sx, screenY, size*0.5, size*0.15, 0, 0, Math.PI*2); 
                    ctx.fill();
                }

                // COLISÃO
                // Z entre 50 e -50 (perto do jogador) E mesma faixa
                if(o.z < 50 && o.z > -50 && this.state === 'play' && o.lane === this.lane) {
                    let hit = false;
                    
                    // Regras
                    if(o.type === 'pipe' && this.action !== 'jump') hit = true;
                    if(o.type === 'block' && this.action !== 'crouch') hit = true;

                    if(hit) {
                        this.hitTimer = 15; // Frames de tela vermelha
                        window.Sfx.play(150, 'sawtooth', 0.2, 0.2); // Som de dano
                        this.sc = Math.max(0, this.sc - 500); // Perde pontos
                        window.System.msg("BATEU!");
                        o.passed = true; // Marca como passado para não bater 2x
                    } else if(!o.passed) {
                        // Passou com sucesso
                        this.sc += 100;
                        window.Sfx.play(1200, 'sine', 0.1, 0.1); // Som de moeda
                        o.passed = true;
                    }
                }
            }
        },

        // --- DESENHO DO PERSONAGEM (MARIO COSTAS) ---
        drawMarioBack: function(ctx, x, y, w, action) {
            const s = w * 0.0035; // Escala
            ctx.save(); 
            ctx.translate(x, y); 
            ctx.scale(s, s);
            
            // Ciclo de animação para correr
            const cycle = (this.action === 'run') ? Math.sin(this.f * 0.5) * 15 : 0;
            
            // Cores
            const C_SHIRT = '#ff0000';
            const C_OVERALL = '#0000ff';
            const C_SKIN = '#ffccaa';
            const C_HAIR = '#4a3222';

            // 1. Pernas (Animadas)
            ctx.fillStyle = C_OVERALL;
            if(action === 'run') {
                ctx.fillRect(-15+cycle, 0, 12, 35); // Perna Esq
                ctx.fillRect(5-cycle, 0, 12, 35);   // Perna Dir
                // Sapatos
                ctx.fillStyle = '#4a3222';
                ctx.fillRect(-17+cycle, 35, 16, 10);
                ctx.fillRect(3-cycle, 35, 16, 10);
            } else if (action === 'jump') {
                // Pernas encolhidas
                ctx.fillRect(-18, -10, 12, 25);
                ctx.fillRect(6, -5, 12, 20);
                // Sapatos
                ctx.fillStyle = '#4a3222';
                ctx.fillRect(-20, 15, 16, 10);
                ctx.fillRect(4, 15, 16, 10);
            } else { // Crouch
                ctx.fillRect(-20, 10, 12, 15);
                ctx.fillRect(8, 10, 12, 15);
            }

            // 2. Tronco (Costas)
            const bodyY = action === 'crouch' ? 10 : -35;
            
            // Camisa Vermelha (Braços abertos)
            ctx.fillStyle = C_SHIRT;
            ctx.beginPath(); ctx.arc(0, bodyY, 28, 0, Math.PI*2); ctx.fill();
            
            // Macacão Azul (Costas)
            ctx.fillStyle = C_OVERALL;
            ctx.fillRect(-18, bodyY, 36, 30);
            ctx.beginPath(); ctx.arc(0, bodyY+30, 18, 0, Math.PI, false); ctx.fill();

            // Alças Amarelas
            ctx.strokeStyle = '#ffff00'; ctx.lineWidth = 5;
            ctx.beginPath(); ctx.moveTo(-15, bodyY-15); ctx.lineTo(-15, bodyY+15); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(15, bodyY-15); ctx.lineTo(15, bodyY+15); ctx.stroke();

            // 3. Cabeça (Nuca)
            const headY = bodyY - 30;
            
            // Pele (Pescoço/Orelhas)
            ctx.fillStyle = C_SKIN;
            ctx.beginPath(); ctx.arc(0, headY, 24, 0, Math.PI*2); ctx.fill();
            
            // Cabelo
            ctx.fillStyle = C_HAIR;
            ctx.beginPath(); ctx.arc(0, headY+5, 22, 0, Math.PI, false); ctx.fill();

            // Boné Vermelho (Parte de trás)
            ctx.fillStyle = C_SHIRT;
            ctx.beginPath(); ctx.arc(0, headY-5, 25, Math.PI, 0); ctx.fill();

            ctx.restore();
        },

        drawCalibration: function(ctx, w, h, cx) {
            ctx.fillStyle = "rgba(0,0,0,0.9)"; ctx.fillRect(0,0,w,h);
            ctx.fillStyle = "#fff"; ctx.font = "bold 30px Arial"; ctx.textAlign = "center";
            
            ctx.fillText("FIQUE EM PÉ E PARADO", cx, h*0.4);
            ctx.fillText("CALIBRANDO...", cx, h*0.46);
            
            const pct = this.calibSamples.length / 60;
            ctx.fillStyle = "#3498db"; 
            ctx.fillRect(cx - 150, h*0.55, 300 * pct, 20);
            ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; 
            ctx.strokeRect(cx - 150, h*0.55, 300, 20);
        }
    };

    window.System.registerGame('run', 'Super Run', '🏃', Logic, {camOpacity: 0.3});
})();