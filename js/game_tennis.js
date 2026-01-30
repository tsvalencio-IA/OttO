// =============================================================================
// LÓGICA DO JOGO: OTTO PING PONG PRO (PSEUDO-3D REALISTA)
// ARQUITETO: SENIOR DEV V3
// =============================================================================

(function() {
    // Configurações de Espaço e Física
    const TABLE_W = 550;
    const TABLE_L = 1300;
    const NET_Z = 650;
    const BALL_RADIUS = 15;
    
    // Configurações de Velocidade (Muito mais rápido que o anterior)
    const BASE_SPEED_Z = 28; 
    const SPEED_INC = 1.2;

    const Logic = {
        state: 'MODE_SELECT', // MODE_SELECT, CALIBRATE, PLAY
        score: 0,
        ball: { x: 0, y: -250, z: 1200, vx: 0, vy: 0, vz: 0 },
        
        // Mapeamento do Jogador
        hand: { x: 0, y: 0 },
        handRaw: { x: 0, y: 0 },
        handCenter: { x: 0, y: 0 },
        handScale: 2.8, // Escala para cobrir a mesa com movimentos curtos
        
        calibTimer: 0,
        particles: [],
        
        // Multiplayer (Estrutura base para integração)
        isOnline: false,
        rivals: [],
        dbRef: null,

        init: function() {
            this.score = 0;
            this.state = 'MODE_SELECT';
            this.resetBall(false);
            this.particles = [];
            window.System.msg("ESCOLHA O MODO");
        },

        resetBall: function(towardsPlayer) {
            const speed = BASE_SPEED_Z + (this.score * SPEED_INC);
            this.ball = {
                x: (Math.random() - 0.5) * 300,
                y: -350,
                z: towardsPlayer ? 1300 : 100,
                vx: (Math.random() - 0.5) * 12,
                vy: 5,
                vz: towardsPlayer ? -speed : speed
            };
        },

        update: function(ctx, w, h, pose) {
            const cx = w / 2;
            const cy = h / 2;

            // 1. PROCESSAMENTO DE POSE
            if (pose) {
                const rw = pose.keypoints.find(k => k.name === 'right_wrist' || k.name === 'left_wrist');
                if (rw && rw.score > 0.3) {
                    const mapped = window.Gfx.map(rw, w, h);
                    this.handRaw = mapped;

                    if (this.state === 'PLAY') {
                        // Aplica calibração e escala
                        this.hand.x = (mapped.x - this.handCenter.x) * this.handScale;
                        this.hand.y = (mapped.y - this.handCenter.y) * this.handScale;
                    }
                }
            }

            // 2. MÁQUINA DE ESTADOS
            switch (this.state) {
                case 'MODE_SELECT':
                    this.drawMenu(ctx, w, h);
                    break;
                case 'CALIBRATE':
                    this.drawCalibration(ctx, w, h, cx, cy);
                    break;
                case 'PLAY':
                    this.runGameLogic(ctx, w, h, cx, cy);
                    break;
            }

            return this.score;
        },

        runGameLogic: function(ctx, w, h, cx, cy) {
            // FÍSICA DA BOLA
            this.ball.x += this.ball.vx;
            this.ball.y += this.ball.vy;
            this.ball.z += this.ball.vz;

            // Gravidade e Quique na Mesa
            if (this.ball.y < 180) {
                this.ball.vy += 1.0; // Gravidade forte para ping-pong
            } else if (this.ball.y >= 180 && this.ball.vy > 0) {
                // Só quica se estiver dentro da mesa (Z entre 0 e 1300)
                if (this.ball.z > 0 && this.ball.z < 1300 && Math.abs(this.ball.x) < TABLE_W) {
                    this.ball.vy *= -0.85; 
                    window.Sfx.play(250, 'sine', 0.05, 0.05);
                }
            }

            // COLISÃO COM RAQUETE (Z perto do jogador ~0)
            if (this.ball.z < 120 && this.ball.z > -100 && this.ball.vz < 0) {
                const scale = 600 / (600 + this.ball.z);
                const bx = this.ball.x * scale;
                const by = (this.ball.y - 150) * scale;

                // Hitbox generosa para evitar frustração
                const dist = Math.hypot(bx - this.hand.x, by - this.hand.y);
                if (dist < 130) {
                    this.score++;
                    window.Sfx.hit();
                    window.Gfx.shakeScreen(8);
                    
                    this.ball.vz = Math.abs(this.ball.vz) + SPEED_INC;
                    this.ball.vy = -18; // Lob inicial
                    this.ball.vx = (bx - this.hand.x) * 0.6; // Controle direcional
                    
                    this.spawnParticles(cx + bx, cy + by, '#ff5500');
                }
            }

            // IA REBATE (Fundo da mesa ~1300)
            if (this.ball.z > 1400 && this.ball.vz > 0) {
                this.ball.vz *= -1;
                this.ball.vx = (Math.random() - 0.5) * 20;
                window.Sfx.play(200, 'square', 0.1, 0.05);
            }

            // GAME OVER
            if (this.ball.z < -400) {
                window.System.gameOver(this.score);
            }

            // RENDERIZAÇÃO
            this.drawScenery(ctx, w, h, cx, cy);
            this.drawBall(ctx, cx, cy);
            this.drawRacket(ctx, cx + this.hand.x, cy + this.hand.y);
            this.renderParticles(ctx);
        },

        drawScenery: function(ctx, w, h, cx, cy) {
            // Fundo Sala de Jogos
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, '#1a1a2e'); grad.addColorStop(1, '#16213e');
            ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);

            const project = (x, y, z) => {
                const scale = 600 / (600 + z);
                return { x: cx + x * scale, y: cy + (y + 200) * scale, s: scale };
            };

            // Mesa (Pseudo-3D)
            const p1 = project(-TABLE_W, 0, 1300);
            const p2 = project(TABLE_W, 0, 1300);
            const p3 = project(TABLE_W, 0, 0);
            const p4 = project(-TABLE_W, 0, 0);

            // Tampo da Mesa
            ctx.fillStyle = '#0f3460';
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
            ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y);
            ctx.fill();
            ctx.strokeStyle = '#e94560'; ctx.lineWidth = 4; ctx.stroke();

            // Linhas da Mesa
            ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2;
            const mid = project(0, 0, 1300); const mid2 = project(0, 0, 0);
            ctx.beginPath(); ctx.moveTo(mid.x, mid.y); ctx.lineTo(mid2.x, mid2.y); ctx.stroke();

            // Rede
            const n1 = project(-TABLE_W, -60, NET_Z);
            const n2 = project(TABLE_W, -60, NET_Z);
            const n3 = project(TABLE_W, 0, NET_Z);
            const n4 = project(-TABLE_W, 0, NET_Z);
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.beginPath(); ctx.moveTo(n1.x, n1.y); ctx.lineTo(n2.x, n2.y); ctx.lineTo(n3.x, n3.y); ctx.lineTo(n4.x, n4.y); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        },

        drawBall: function(ctx, cx, cy) {
            const b = this.ball;
            const scale = 600 / (600 + b.z);
            const bx = cx + b.x * scale;
            const by = cy + (b.y + 200) * scale;
            
            // Sombra na mesa
            const sy = cy + (200) * scale;
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.beginPath(); ctx.ellipse(bx, sy, BALL_RADIUS * scale * 1.5, BALL_RADIUS * scale * 0.5, 0, 0, Math.PI * 2); ctx.fill();

            // Esfera da bola
            const gradB = ctx.createRadialGradient(bx - 5, by - 5, 2, bx, by, BALL_RADIUS * scale);
            gradB.addColorStop(0, '#ffffff'); gradB.addColorStop(1, '#ffaa00');
            ctx.fillStyle = gradB;
            ctx.beginPath(); ctx.arc(bx, by, BALL_RADIUS * scale, 0, Math.PI * 2); ctx.fill();
        },

        drawRacket: function(ctx, x, y) {
            // Sombra da raquete
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.beginPath(); ctx.ellipse(x, y + 100, 50, 15, 0, 0, Math.PI * 2); ctx.fill();

            // Cabo
            ctx.fillStyle = '#5d4037';
            ctx.fillRect(x - 8, y + 40, 16, 60);

            // Madeira da Raquete
            ctx.fillStyle = '#e94560';
            ctx.beginPath(); ctx.arc(x, y, 55, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.stroke();
        },

        drawCalibration: function(ctx, w, h, cx, cy) {
            ctx.fillStyle = 'rgba(0,0,0,0.9)'; ctx.fillRect(0,0,w,h);
            ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 5;
            ctx.beginPath(); ctx.arc(cx, cy, 70, 0, Math.PI*2); ctx.stroke();
            
            ctx.fillStyle = 'white'; ctx.textAlign='center'; ctx.font="bold 24px Arial";
            ctx.fillText("POSICIONE A RAQUETE NO CENTRO", cx, cy - 100);
            
            if(Math.hypot(this.handRaw.x - cx, this.handRaw.y - cy) < 70) {
                this.calibTimer++;
                ctx.fillStyle = '#00ff00';
                ctx.fillRect(cx - 70, cy + 90, this.calibTimer * 2.8, 15);
                if(this.calibTimer > 50) {
                    this.handCenter = { x: this.handRaw.x, y: this.handRaw.y };
                    this.state = 'PLAY';
                    window.System.msg("BOM JOGO!");
                    window.Sfx.coin();
                }
            } else { this.calibTimer = 0; }

            // Preview da mão
            ctx.fillStyle = '#00ffff'; ctx.beginPath(); ctx.arc(this.handRaw.x, this.handRaw.y, 15, 0, Math.PI*2); ctx.fill();
        },

        drawMenu: function(ctx, w, h) {
            ctx.fillStyle = '#111'; ctx.fillRect(0,0,w,h);
            ctx.fillStyle = 'white'; ctx.textAlign = 'center'; ctx.font = "bold 40px 'Russo One'";
            ctx.fillText("PING PONG PRO", w/2, h * 0.3);
            
            const drawBtn = (y, txt, c) => {
                ctx.fillStyle = c; ctx.beginPath();
                ctx.roundRect(w/2 - 200, y, 400, 80, 40); ctx.fill();
                ctx.fillStyle = 'white'; ctx.font = "bold 24px sans-serif";
                ctx.fillText(txt, w/2, y + 48);
            };

            drawBtn(h*0.45, "SOLO (OFFLINE)", "#e67e22");
            drawBtn(h*0.60, "VERSUS (ONLINE)", "#27ae60");

            if(!window.System.canvas.onclick) {
                window.System.canvas.onclick = (e) => {
                    const rect = window.System.canvas.getBoundingClientRect();
                    const y = e.clientY - rect.top;
                    this.state = 'CALIBRATE';
                    this.isOnline = (y > h*0.55);
                    window.System.canvas.onclick = null;
                };
            }
        },

        spawnParticles: function(x, y, color) {
            for(let i=0; i<8; i++) {
                this.particles.push({
                    x, y, vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10, life: 1.0, color
                });
            }
        },

        renderParticles: function(ctx) {
            for(let i=this.particles.length-1; i>=0; i--) {
                const p = this.particles[i];
                p.x += p.vx; p.y += p.vy; p.life -= 0.05;
                if(p.life <= 0) { this.particles.splice(i, 1); continue; }
                ctx.globalAlpha = p.life;
                ctx.fillStyle = p.color;
                ctx.fillRect(p.x, p.y, 4, 4);
            }
            ctx.globalAlpha = 1.0;
        }
    };

    window.System.registerGame('tennis', 'Otto Ping Pong Pro', '🏓', Logic, {camOpacity: 0.2});
})();
