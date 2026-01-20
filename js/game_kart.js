// LÓGICA DO JOGO: KART DO OTTO (GRAND PRIX EDITION - TRUE 3D PERSPECTIVE)
// ARCHITECT: CODE 177 - NINTENDO QUALITY STANDARD
(function() {
    let particles = [];
    
    // Configurações Globais de Corrida
    const TRACK_LENGTH = 10000; // Distância de uma volta
    const MAX_SPEED = 140;      // Velocidade máxima escalada
    
    const Logic = {
        // --- ESTADO DO JOGADOR ---
        speed: 0, 
        posZ: 0,        // Distância percorrida na pista
        posX: 0,        // Posição lateral NA PISTA (-1.0 a 1.0)
        steer: 0,       // Valor suavizado do volante
        
        // --- ESTADO DA PISTA ---
        curveCurrent: 0, // Curvatura atual do segmento
        curveNext: 0,    // Próxima curvatura (para antecipação visual)
        
        // --- GAMEPLAY ---
        rank: 4,        // Posição atual (1st, 2nd...)
        lap: 1,
        totalLaps: 3,
        health: 100, 
        score: 0,
        
        // --- EFEITOS ---
        visualTilt: 0,  // Inclinação do corpo do kart
        bounce: 0,      // Vibração vertical
        boost: 0,       // Turbo temporário
        
        // --- INPUT ---
        inputState: 0,
        hands: { left: null, right: null },
        wheel: { radius: 0, x: 0, y: 0, opacity: 0, angle: 0 },
        
        // --- ENTIDADES ---
        opponents: [],  // IAs
        props: [],      // Obstáculos e Moedas
        
        init: function() { 
            this.speed = 0; this.posZ = 0; this.posX = 0; this.steer = 0;
            this.health = 100; this.score = 0; this.lap = 1; this.rank = 4;
            this.props = []; particles = [];
            
            // Inicializa IAs com personalidades
            this.opponents = [
                { id: 'luigi',  x: -0.5, z: 200, speed: 0, maxSpeed: 135, color: '#2ecc71', name: "L-MAN", aggressive: 0.3 },
                { id: 'peach',  x: 0.5,  z: 400, speed: 0, maxSpeed: 138, color: '#ff69b4', name: "P-CESS", aggressive: 0.1 },
                { id: 'bowser', x: 0,    z: 600, speed: 0, maxSpeed: 132, color: '#f39c12', name: "KING-B", aggressive: 0.8 }
            ];

            // Gera Pista (Obstáculos procedurais)
            for(let i=1000; i<TRACK_LENGTH*3; i+=400) {
                if(Math.random() < 0.4) {
                    this.props.push({ 
                        type: Math.random()<0.6 ? 'coin' : (Math.random()<0.5 ? 'banana' : 'cone'), 
                        z: i, 
                        x: (Math.random()*2 - 1) * 0.8, // Espalha na pista
                        hit: false 
                    });
                }
            }

            // Sequência de Largada
            window.System.msg("3..."); window.Sfx.play(200, 'square', 0.2);
            setTimeout(() => { window.System.msg("2..."); window.Sfx.play(200, 'square', 0.2); }, 1000);
            setTimeout(() => { window.System.msg("1..."); window.Sfx.play(200, 'square', 0.2); }, 2000);
            setTimeout(() => { window.System.msg("GO!!!"); window.Sfx.play(600, 'sawtooth', 1.0); }, 3000);
        },
        
        update: function(ctx, w, h, pose) {
            const d = Logic; 
            const cx = w / 2;
            const cy = h / 2;
            const horizon = h * 0.45; // Horizonte um pouco mais alto para visão de profundidade
            
            // =================================================================
            // 1. INPUT & FÍSICA DO VOLANTE (SMART STEERING 3.0)
            // =================================================================
            d.inputState = 0;
            let targetSteer = 0;
            const speedFactor = d.speed / MAX_SPEED; // 0.0 a 1.0

            if(pose) {
                const kp = pose.keypoints;
                const lw = kp.find(k=>k.name==='left_wrist');
                const rw = kp.find(k=>k.name==='right_wrist');
                if(lw && lw.score > 0.4) d.hands.left = window.Gfx.map(lw, w, h);
                if(rw && rw.score > 0.4) d.hands.right = window.Gfx.map(rw, w, h);

                if(d.hands.left && d.hands.right) {
                    d.inputState = 2;
                    // Lógica do Volante Virtual
                    const hCx = (d.hands.left.x + d.hands.right.x) / 2;
                    const hCy = (d.hands.left.y + d.hands.right.y) / 2;
                    d.wheel.x += (hCx - d.wheel.x) * 0.2;
                    d.wheel.y += (hCy - d.wheel.y) * 0.2;
                    d.wheel.radius = w * 0.18;
                    d.wheel.opacity = Math.min(1, d.wheel.opacity + 0.1);

                    // Ângulo
                    const dy = d.hands.right.y - d.hands.left.y;
                    const dx = d.hands.right.x - d.hands.left.x;
                    let rawAngle = Math.atan2(dy, dx);
                    
                    // Deadzone Inteligente (Evita wobble em retas)
                    if(Math.abs(rawAngle) < 0.15) rawAngle = 0;
                    
                    // Curva Exponencial (Precisão no centro, rapidez nas pontas)
                    targetSteer = Math.sign(rawAngle) * Math.pow(Math.abs(rawAngle), 1.5) * 2.0 * window.System.sens;
                    
                    // Aceleração Automática se estiver segurando o volante
                    if(d.speed < MAX_SPEED) d.speed += 0.8; 
                } else {
                    d.wheel.opacity *= 0.8;
                    d.speed *= 0.98; // Desaceleração natural
                }
            }

            // Suavização do Volante (Simula peso hidráulico)
            d.steer += (targetSteer - d.steer) * 0.15;
            d.wheel.angle = d.steer;

            // =================================================================
            // 2. FÍSICA DO KART (MUNDO RELATIVO)
            // =================================================================
            // Em vez de mover o carro na tela, movemos o carro na PISTA (posX)
            // A renderização depois ajusta o mundo baseada nisso.
            
            // Lane Assist (Puxa para o centro se volante estiver reto)
            if(Math.abs(d.steer) < 0.1) d.posX *= 0.98;

            // Movimento Lateral Físico
            // Quanto mais rápido, mais sensível, mas com limite de aderência
            const turnForce = d.steer * 0.04 * (0.5 + speedFactor*0.5);
            d.posX += turnForce;

            // Limites da Pista (com penalidade Off-road)
            let isOffRoad = false;
            if(Math.abs(d.posX) > 1.2) { // 1.0 é a borda da pista
                isOffRoad = true;
                d.speed *= 0.94; // Grama segura o carro
                if(d.speed > 30) {
                    d.bounce = (Math.random() - 0.5) * 8; // Trepidação
                    window.Gfx.shake(2);
                }
            } else {
                d.bounce = Math.sin(Date.now()/50) * speedFactor * 2; // Vibração motor
            }

            // Avanço na Pista
            d.posZ += d.speed;
            
            // Loop de Voltas
            if(d.posZ >= TRACK_LENGTH) {
                d.posZ -= TRACK_LENGTH;
                d.lap++;
                window.System.msg(`VOLTA ${d.lap}/${d.totalLaps}`);
                window.Sfx.play(800, 'sine', 0.5);
                // Reset IAs para manter desafio (Rubber banding de volta)
                d.opponents.forEach(o => o.z -= TRACK_LENGTH);
            }

            // Curvatura Procedural da Pista (Baseada no Z)
            // Cria um mapa "infinito" usando senoides
            d.curveCurrent = Math.sin(d.posZ * 0.001) * 1.5 + Math.sin(d.posZ * 0.003) * 0.5;
            d.curveNext = Math.sin((d.posZ + 500) * 0.001) * 1.5;

            // Força Centrífuga (A pista "empurra" o carro para fora na curva)
            d.posX -= d.curveCurrent * speedFactor * 0.03;

            // Inclinação Visual do Kart (Body Roll)
            // Combina a virada do volante com a força da curva
            d.visualTilt += ((d.steer * 0.8 - d.curveCurrent * 0.5) - d.visualTilt) * 0.1;

            // =================================================================
            // 3. INTELIGÊNCIA ARTIFICIAL (RIVAIS)
            // =================================================================
            d.opponents.forEach(bot => {
                // Aceleração
                if(bot.speed < bot.maxSpeed) bot.speed += 0.5;
                
                // Rubber Banding (Mantém a corrida justa)
                const distToPlayer = bot.z - d.posZ;
                if(distToPlayer < -1000) bot.speed = d.speed * 1.15; // Acelera se ficar muito pra trás
                if(distToPlayer > 1500) bot.speed = d.speed * 0.85;  // Espera se ficar muito na frente
                
                // Movimento na pista
                bot.z += bot.speed;
                
                // IA de Curva: Eles seguem a curva perfeita
                const botCurve = Math.sin(bot.z * 0.001) * 1.5;
                bot.x -= botCurve * (bot.speed/MAX_SPEED) * 0.025; 
                
                // Centralização IA
                if(bot.x < -0.8) bot.x += 0.05;
                if(bot.x > 0.8) bot.x -= 0.05;
                
                // Evita colisão simples com Player
                if(Math.abs(bot.z - d.posZ) < 200 && Math.abs(bot.x - d.posX) < 0.3) {
                    bot.x += (bot.x > d.posX) ? 0.05 : -0.05;
                }
            });

            // Cálculo de Ranking
            let myPos = 1;
            d.opponents.forEach(o => {
                let totalZ_Bot = o.z + ((d.lap - (o.z > d.posZ + 5000 ? 0 : 0)) * TRACK_LENGTH); // Lógica simplificada de volta
                let totalZ_Ply = d.posZ + (d.lap * TRACK_LENGTH);
                // Ajuste simples: Quem tem maior Z absoluto está na frente
                // Como o Z reseta, usamos Z relativo para rank imediato
                if(o.z > d.posZ) myPos++;
            });
            d.rank = myPos;

            // =================================================================
            // 4. RENDERIZAÇÃO: PERSPECTIVA CENTRALIZADA (PSEUDO-3D)
            // =================================================================
            
            // A - CÉU (PARALLAX)
            // O céu gira oposto à curva para simular rotação da câmera
            const skyOffset = (d.curveCurrent * 200) + (d.steer * 100);
            const gradSky = ctx.createLinearGradient(0, 0, 0, horizon);
            gradSky.addColorStop(0, "#00a8ff"); gradSky.addColorStop(1, "#b3e5fc");
            ctx.fillStyle = gradSky; ctx.fillRect(0, 0, w, horizon);
            
            // Nuvens
            ctx.fillStyle = "rgba(255,255,255,0.7)";
            const drawCloud = (x, y, s) => {
                let rx = (x - skyOffset) % (w + 200);
                if(rx < -100) rx += w + 200;
                ctx.beginPath(); ctx.arc(rx, y, 40*s, 0, Math.PI*2); ctx.arc(rx+30*s, y-10*s, 50*s, 0, Math.PI*2); ctx.arc(rx+60*s, y, 40*s, 0, Math.PI*2); ctx.fill();
            };
            drawCloud(200, horizon * 0.4, 1.5);
            drawCloud(600, horizon * 0.6, 1.2);
            drawCloud(900, horizon * 0.3, 0.8);

            // B - CHÃO (GRASS)
            ctx.fillStyle = "#3cb371"; // Medium Sea Green
            ctx.fillRect(0, horizon, w, h - horizon);

            // C - ESTRADA (TRAPEZOIDAL PROJECTION)
            // O segredo da perspectiva fixa no carro:
            // A base da estrada se move oposta ao jogador (se jogador vai pra dir, estrada vai pra esq)
            // O topo da estrada se move com a curva.
            
            const roadW_Base = w * 1.8; // Largura na base da tela
            const roadW_Horizon = w * 0.05; // Largura no horizonte
            
            // Projeção X
            // Se o player está em posX = 1.0 (direita), a estrada deve desenhar mais à esquerda na tela.
            const centerBase = cx - (d.posX * w * 0.8); 
            const centerHorizon = cx - (d.curveCurrent * w * 0.6) - (d.steer * w * 0.3); // A curva desloca o horizonte

            // Desenha Asfalto
            ctx.beginPath();
            ctx.fillStyle = "#555";
            ctx.moveTo(centerHorizon - roadW_Horizon, horizon); // Top Left
            ctx.lineTo(centerHorizon + roadW_Horizon, horizon); // Top Right
            ctx.lineTo(centerBase + roadW_Base, h);           // Bot Right
            ctx.lineTo(centerBase - roadW_Base, h);           // Bot Left
            ctx.fill();

            // Zebras (Curbs) - Animadas pela velocidade
            const stripeSize = 40;
            const stripeOffset = (d.posZ / stripeSize) % 2;
            const curbW_Base = roadW_Base * 1.15;
            const curbW_Horizon = roadW_Horizon * 1.15;
            
            ctx.beginPath();
            ctx.fillStyle = (Math.floor(stripeOffset) === 0) ? "#e74c3c" : "#ecf0f1"; // Vermelho e Branco
            // Desenha por baixo da estrada (mais largo)
            ctx.moveTo(centerHorizon - curbW_Horizon, horizon);
            ctx.lineTo(centerHorizon + curbW_Horizon, horizon);
            ctx.lineTo(centerBase + curbW_Base, h);
            ctx.lineTo(centerBase - curbW_Base, h);
            ctx.fill();
            // Redesenha asfalto por cima (jeito barato de fazer borda)
            ctx.fillStyle = "#555";
            ctx.beginPath();
            ctx.moveTo(centerHorizon - roadW_Horizon, horizon);
            ctx.lineTo(centerHorizon + roadW_Horizon, horizon);
            ctx.lineTo(centerBase + roadW_Base, h);
            ctx.lineTo(centerBase - roadW_Base, h);
            ctx.fill();

            // Faixa Central
            ctx.strokeStyle = "rgba(255,255,255,0.6)";
            ctx.lineWidth = 6;
            ctx.setLineDash([30, 40]);
            ctx.lineDashOffset = -d.posZ * 0.5;
            ctx.beginPath();
            ctx.moveTo(centerHorizon, horizon);
            // Curva de Bézier para suavizar a faixa
            ctx.quadraticCurveTo(
                (centerHorizon + centerBase)/2 + (d.curveCurrent * 50), 
                (horizon + h)/2, 
                centerBase, h
            );
            ctx.stroke();
            ctx.setLineDash([]);

            // =================================================================
            // 5. OBJETOS E ENTIDADES (Z-BUFFERING)
            // =================================================================
            let renderList = [];

            // Adiciona Bots
            d.opponents.forEach(bot => {
                // Calcula distância relativa
                // Lógica de loop: se o bot estiver logo atrás (na volta anterior) ou logo à frente
                let relZ = bot.z - d.posZ;
                if(relZ < -TRACK_LENGTH/2) relZ += TRACK_LENGTH;
                if(relZ > TRACK_LENGTH/2) relZ -= TRACK_LENGTH;
                
                if(relZ > 10 && relZ < 3000) { // Só desenha o que está na frente e visível
                    renderList.push({ type: 'kart', obj: bot, z: relZ });
                }
            });

            // Adiciona Props
            d.props.forEach(prop => {
                let relZ = prop.z - d.posZ;
                // Corrige loop da pista
                while(relZ < -500) relZ += TRACK_LENGTH; 
                while(relZ > TRACK_LENGTH - 500) relZ -= TRACK_LENGTH;

                if(relZ > 10 && relZ < 3000) {
                    renderList.push({ type: 'prop', obj: prop, z: relZ });
                }
            });

            // Ordena do mais longe para o mais perto (Painter's Algorithm)
            renderList.sort((a, b) => b.z - a.z);

            renderList.forEach(item => {
                const scale = 800 / (800 + item.z); // Fator de perspectiva
                const obj = item.obj;
                
                // Posição X na tela
                // Interpolamos entre o horizonte e a base baseado no Z (escala)
                // E aplicamos o offset lateral do objeto relativo ao player
                const roadCenterX = centerHorizon + (centerBase - centerHorizon) * scale;
                const roadWidthAtZ = roadW_Horizon + (roadW_Base - roadW_Horizon) * scale;
                
                // Posição X do objeto relativa à largura da pista naquele ponto Z
                // obj.x é -1 a 1. 
                const screenX = roadCenterX + (obj.x * roadWidthAtZ);
                const screenY = horizon + ((h - horizon) * scale);
                
                // Desenho
                if(item.type === 'kart') {
                    const kSize = w * 0.15 * scale;
                    // Sombra
                    ctx.fillStyle = "rgba(0,0,0,0.4)";
                    ctx.beginPath(); ctx.ellipse(screenX, screenY, kSize*0.6, kSize*0.15, 0, 0, Math.PI*2); ctx.fill();
                    
                    // Kart Sprite (Simples mas efetivo)
                    ctx.fillStyle = obj.color;
                    ctx.fillRect(screenX - kSize/2, screenY - kSize, kSize, kSize*0.6); // Chassi
                    ctx.fillStyle = "#333"; // Rodas
                    ctx.fillRect(screenX - kSize/2 - kSize*0.1, screenY - kSize*0.3, kSize*0.2, kSize*0.3);
                    ctx.fillRect(screenX + kSize/2 - kSize*0.1, screenY - kSize*0.3, kSize*0.2, kSize*0.3);
                    // Piloto
                    ctx.fillStyle = "#fff";
                    ctx.beginPath(); ctx.arc(screenX, screenY - kSize, kSize*0.25, 0, Math.PI*2); ctx.fill();
                    
                    // Nome (Tag)
                    if(scale > 0.3) {
                        ctx.fillStyle = "#fff"; ctx.font = `bold ${12*scale}px Arial`; ctx.textAlign = "center";
                        ctx.fillText(obj.name, screenX, screenY - kSize * 1.4);
                    }
                } 
                else if (item.type === 'prop') {
                    const pSize = w * 0.1 * scale;
                    if(obj.type === 'coin') {
                        // Moeda giratória
                        const spin = Math.abs(Math.sin(Date.now()/100));
                        ctx.fillStyle = "#f1c40f"; ctx.strokeStyle = "#d4ac0d"; ctx.lineWidth = 2*scale;
                        ctx.beginPath(); ctx.ellipse(screenX, screenY - pSize, pSize*0.4*spin, pSize*0.4, 0, 0, Math.PI*2); 
                        ctx.fill(); ctx.stroke();
                        
                        // Colisão Moeda
                        if(item.z < 50 && Math.abs(obj.x - d.posX) < 0.3 && !obj.hit) {
                            obj.hit = true; d.score += 50; window.Sfx.coin(); 
                            d.speed = Math.min(d.speed + 5, MAX_SPEED + 20); // Mini boost
                        }
                    } else {
                        // Banana/Cone
                        ctx.fillStyle = obj.type==='banana' ? '#ffe135' : '#e67e22';
                        ctx.beginPath(); ctx.moveTo(screenX, screenY - pSize); 
                        ctx.lineTo(screenX - pSize*0.3, screenY); ctx.lineTo(screenX + pSize*0.3, screenY); ctx.fill();
                        
                        // Colisão Obstáculo
                        if(item.z < 50 && Math.abs(obj.x - d.posX) < 0.25 && !obj.hit) {
                            obj.hit = true; d.health -= 15; d.speed *= 0.4; window.Sfx.crash(); window.Gfx.shake(15);
                        }
                    }
                }
            });

            // =================================================================
            // 6. PLAYER KART (HUD & COCKPIT)
            // =================================================================
            
            // O Carro do jogador é desenhado FIXO no centro inferior (com tilt e bounce)
            const plyX = cx; // Sempre no centro X da tela
            const plyY = h * 0.85 + d.bounce;
            const plyScale = w * 0.006;
            
            ctx.save();
            ctx.translate(plyX, plyY);
            ctx.scale(plyScale, plyScale);
            ctx.rotate(d.visualTilt * 0.12); // Inclina nas curvas

            // PARTÍCULAS (Escapamento e Derrapagem)
            if(d.speed > 20) {
                if(Math.random() < 0.3) {
                    particles.push({ 
                        x: plyX - (30 * plyScale), y: plyY + (20 * plyScale), 
                        vx: -1 - Math.random(), vy: 2, life: 20, color: 'rgba(200,200,200,0.5)', s: 4 
                    });
                }
                // Fumaça de pneu se virar muito (Drift)
                if(Math.abs(d.steer) > 1.0) {
                    const tireX = d.steer > 0 ? -40 : 40; // Roda oposta
                    particles.push({ 
                        x: plyX + (tireX * plyScale), y: plyY + (25 * plyScale), 
                        vx: 0, vy: 1, life: 10, color: '#3498db', s: 6 // Fumaça azul de drift
                    });
                }
            }

            // MODELO DO KART (HERO)
            // Sombra
            ctx.fillStyle = "rgba(0,0,0,0.5)";
            ctx.beginPath(); ctx.ellipse(0, 15, 55, 12, 0, 0, Math.PI*2); ctx.fill();

            // Chassi Traseiro
            ctx.fillStyle = "#c0392b"; // Vermelho escuro
            ctx.fillRect(-35, -15, 70, 30);
            
            // Motor
            ctx.fillStyle = "#2c3e50";
            ctx.fillRect(-25, -25, 50, 15);
            // Escapamentos
            ctx.fillStyle = "#7f8c8d";
            ctx.beginPath(); ctx.arc(-15, -20, 6, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(15, -20, 6, 0, Math.PI*2); ctx.fill();

            // Rodas Traseiras (Largas)
            ctx.fillStyle = "#111";
            ctx.beginPath(); ctx.ellipse(-45, 10, 12, 18, 0, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(45, 10, 12, 18, 0, 0, Math.PI*2); ctx.fill();
            // Calotas
            ctx.fillStyle = "#f1c40f";
            ctx.beginPath(); ctx.arc(-45, 10, 5, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(45, 10, 5, 0, Math.PI*2); ctx.fill();

            // Corpo Principal
            const kGrad = ctx.createLinearGradient(-30, -50, 30, 20);
            kGrad.addColorStop(0, "#e74c3c"); kGrad.addColorStop(1, "#c0392b");
            ctx.fillStyle = kGrad;
            ctx.beginPath();
            ctx.moveTo(-25, -20); ctx.lineTo(25, -20);
            ctx.quadraticCurveTo(40, 0, 30, 30);
            ctx.lineTo(-30, 30);
            ctx.quadraticCurveTo(-40, 0, -25, -20);
            ctx.fill();

            // Banco e Piloto
            ctx.fillStyle = "#222"; 
            ctx.beginPath(); ctx.arc(0, -5, 22, 0, Math.PI*2); ctx.fill(); // Banco
            
            // Costas do Mario
            ctx.fillStyle = "#3498db"; // Macacão Azul
            ctx.beginPath(); ctx.arc(0, -10, 18, 0, Math.PI, true); ctx.fill();
            ctx.fillRect(-18, -10, 36, 15);
            
            ctx.fillStyle = "#e74c3c"; // Camisa Vermelha
            ctx.beginPath(); ctx.arc(0, -25, 14, 0, Math.PI*2); ctx.fill(); // Ombros/Costas
            
            // Cabeça (Boné Vermelho com M)
            ctx.fillStyle = "#e74c3c";
            ctx.beginPath(); ctx.arc(0, -45, 16, 0, Math.PI*2); ctx.fill();
            // Logo M
            ctx.fillStyle = "#fff"; ctx.font = "bold 16px Arial"; ctx.textAlign="center"; ctx.textBaseline="middle";
            ctx.save(); ctx.scale(1, 0.8); ctx.fillText("M", 0, -56); ctx.restore();

            ctx.restore(); // Fim transform Kart

            // Processa Partículas
            particles.forEach((p, i) => {
                p.x += p.vx; p.y += p.vy; p.life--;
                if(p.life <= 0) particles.splice(i, 1);
                else {
                    ctx.fillStyle = p.color;
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, Math.PI*2); ctx.fill();
                }
            });

            // =================================================================
            // 7. HUD PROFISSIONAL
            // =================================================================
            
            // Velocímetro Digital
            const hudX = w - 90; const hudY = h - 70;
            ctx.save();
            ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.beginPath(); ctx.arc(hudX, hudY, 60, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = "#fff"; ctx.lineWidth = 4; ctx.stroke();
            // Arco de RPM
            ctx.strokeStyle = speedFactor > 0.9 ? "#e74c3c" : "#3498db";
            ctx.beginPath(); ctx.arc(hudX, hudY, 50, Math.PI, Math.PI + (Math.PI * speedFactor)); ctx.stroke();
            
            ctx.fillStyle = "#fff"; ctx.textAlign = "center";
            ctx.font = "bold 40px 'Russo One'"; ctx.fillText(Math.floor(d.speed), hudX, hudY + 10);
            ctx.font = "12px Arial"; ctx.fillText("KM/H", hudX, hudY + 35);
            ctx.restore();

            // POSIÇÃO (RANK)
            const rankSize = 80;
            const rankX = 60; const rankY = h - 60;
            ctx.fillStyle = d.rank === 1 ? "#f1c40f" : (d.rank === 2 ? "#bdc3c7" : (d.rank === 3 ? "#cd7f32" : "#fff"));
            ctx.font = "italic 900 80px 'Arial'"; 
            ctx.strokeStyle = "#000"; ctx.lineWidth = 8;
            ctx.strokeText(d.rank, rankX, rankY);
            ctx.fillText(d.rank, rankX, rankY);
            ctx.font = "bold 20px Arial"; ctx.fillStyle="#fff"; ctx.strokeText((d.rank==1?"st":d.rank==2?"nd":d.rank==3?"rd":"th"), rankX+35, rankY-30); ctx.fillText((d.rank==1?"st":d.rank==2?"nd":d.rank==3?"rd":"th"), rankX+35, rankY-30);

            // VOLTAS
            ctx.fillStyle = "#fff"; ctx.font = "bold 24px 'Chakra Petch'"; ctx.textAlign = "right";
            ctx.fillText(`LAP ${d.lap} / ${d.totalLaps}`, w - 20, 40);

            // DESENHA VOLANTE VIRTUAL (Se ativo)
            if(d.inputState === 2 && d.wheel.opacity > 0) {
                ctx.save();
                ctx.globalAlpha = d.wheel.opacity;
                ctx.translate(d.wheel.x, d.wheel.y);
                ctx.rotate(d.wheel.angle);
                
                const r = d.wheel.radius;
                // Aro Racing
                ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 20;
                ctx.lineWidth = 15; ctx.strokeStyle = '#222';
                ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.stroke();
                ctx.lineWidth = 10; ctx.strokeStyle = '#eee';
                ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.stroke();
                
                // Marcador Central
                ctx.fillStyle = '#e74c3c'; ctx.fillRect(-5, -r-7, 10, 20);
                
                // Centro
                ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(0,0,r*0.2,0,Math.PI*2); ctx.fill();
                // Logo WII
                ctx.fillStyle = '#fff'; ctx.font="bold 20px Arial"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("Wii",0,0);
                
                ctx.restore();
            } else if (d.inputState === 1) {
                // Aviso de uma mão
                ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(0, h/2 - 40, w, 80);
                ctx.fillStyle = "#fff"; ctx.font = "bold 30px Arial"; ctx.textAlign="center"; 
                ctx.fillText("USE AS DUAS MÃOS!", cx, h/2 + 10);
            }

            if(d.lap > d.totalLaps) window.System.gameOver(`VITÓRIA! RANK ${d.rank}`);
            if(d.health <= 0) window.System.gameOver("KART DESTRUÍDO!");

            return d.score;
        }
    };

    if(window.System) {
        window.System.registerGame('drive', 'Otto Kart GP', '🏎️', Logic, {camOpacity: 0.3, showWheel: false});
    }
})();