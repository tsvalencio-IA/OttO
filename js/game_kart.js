// LÓGICA DO JOGO: KART DO OTTO (ULTIMATE PHYSICS EDITION)
(function() {
    const Logic = {
        // Variáveis de Física Avançada
        speed: 0, 
        pos: 0, 
        x: 0,           // Posição lateral na pista
        steer: 0,       // Direção atual (suavizada)
        rawSteer: 0,    // Direção bruta (input direto)
        curve: 0,       // Curvatura da pista
        centrifugal: 0, // Força lateral
        
        // Gameplay
        health: 100,
        maxHealth: 100,
        score: 0,
        
        // Objetos
        obs: [],
        enemies: [],
        
        init: function() { 
            this.speed = 0; 
            this.pos = 0; 
            this.x = 0; 
            this.health = 100;
            this.score = 0;
            this.obs = [];
            this.enemies = [];
            window.System.msg("MODO SIMULAÇÃO ATIVO!"); 
        },
        
        update: function(ctx, w, h, pose) {
            const d = Logic; 
            const cx = w / 2;

            // --- 1. INPUT DE ALTA PRECISÃO ---
            let targetAngle = 0;
            
            if(pose) {
                const kp = pose.keypoints;
                const lw = kp.find(k=>k.name==='left_wrist');
                const rw = kp.find(k=>k.name==='right_wrist');
                
                if(lw && rw && lw.score > 0.4 && rw.score > 0.4) {
                    const dy = rw.y - lw.y; 
                    const dx = rw.x - lw.x;
                    
                    // Cálculo do Ângulo Bruto
                    let rawAngle = Math.atan2(dy, dx);
                    
                    // APLICANDO DEADZONE (Zona Morta Central)
                    // Evita que o carro trema em retas
                    if(Math.abs(rawAngle) < 0.05) rawAngle = 0;

                    // CURVA DE SENSIBILIDADE EXPONENCIAL
                    // Pequenos movimentos = precisão. Grandes movimentos = curva rápida.
                    // Math.sign mantém o lado (+ ou -)
                    // Math.pow eleva ao quadrado para criar a curva de aceleração da direção
                    targetAngle = Math.sign(rawAngle) * Math.pow(Math.abs(rawAngle), 1.4) * 1.8 * window.System.sens;
                    
                    // Acelerador Progressivo
                    if(d.speed < h * 0.065) d.speed += h * 0.0008; 
                } else { 
                    d.speed *= 0.95; // Freio motor mais forte
                }
            }
            
            // SUAVIZAÇÃO INTELIGENTE (RESPONSIVIDADE)
            // Se estiver voltando pro centro, é mais rápido (0.4). Se estiver virando, um pouco mais suave (0.25).
            const reactionSpeed = (Math.abs(targetAngle) < Math.abs(d.steer)) ? 0.4 : 0.25;
            d.steer += (targetAngle - d.steer) * reactionSpeed;
            
            // Trava física do volante (não deixa girar infinito)
            d.steer = Math.max(-1.5, Math.min(1.5, d.steer));

            // Atualiza UI Volante HTML
            const wheel = document.getElementById('visual-wheel');
            if(wheel) wheel.style.transform = `rotate(${d.steer * 80}deg)`; // Rotação visual mais agressiva

            // --- 2. FÍSICA DO CARRO ---
            d.pos += d.speed;
            d.score += Math.floor(d.speed * 0.1);
            
            // Geometria da Pista
            d.curve = Math.sin(d.pos * 0.003) * 1.5;
            
            // Cálculo de Vetor de Movimento
            // Quanto mais rápido, mais sensível a direção (Realismo)
            const handling = (d.speed / (h * 0.06)) * 1.2; 
            
            d.x += d.steer * (d.speed / (h * 0.55)) * handling; // Direção do piloto
            d.x -= d.curve * (d.speed / h); // Força da pista jogando o carro
            
            // Colisão Lateral (Fricção com Muro)
            if(Math.abs(d.x) > 1.35) { 
                d.speed *= 0.92; // Perde velocidade por atrito
                d.x = d.x > 0 ? 1.35 : -1.35;
                if(d.speed > 5) {
                    d.health -= 0.2; // Dano contínuo ao raspar
                    // Tremor da tela
                    ctx.save();
                    ctx.translate((Math.random()-0.5)*10, (Math.random()-0.5)*10);
                    ctx.restore();
                }
            }

            // --- 3. GERAÇÃO DE MUNDO ---
            
            // Cones e Placas
            if(Math.random() < 0.02 && d.speed > 5) {
                const type = Math.random() < 0.35 ? 'sign' : 'cone';
                let posX = (Math.random() * 2.2) - 1.1;
                if(type === 'sign') posX = (Math.random() < 0.5 ? -1.6 : 1.6); // Placas bem na borda
                d.obs.push({ x: posX, z: 1000, type: type });
            }

            // Inimigos Inteligentes
            if(Math.random() < 0.008 && d.speed > 8) {
                d.enemies.push({
                    x: (Math.random() * 1.6) - 0.8, 
                    z: 1000, 
                    speed: d.speed * (0.6 + Math.random()*0.3), // Velocidade variada
                    color: Math.random() < 0.5 ? '#0033cc' : '#008800',
                    laneChange: (Math.random() - 0.5) * 0.01 // Eles trocam de faixa levemente
                });
            }

            // --- 4. RENDERIZAÇÃO DO AMBIENTE ---
            const horizon = h * 0.4;
            
            // Céu Degradê Realista
            const gradSky = ctx.createLinearGradient(0, 0, 0, horizon);
            gradSky.addColorStop(0, "#1e90ff"); // Azul Dodger
            gradSky.addColorStop(1, "#87cefa"); // Azul Claro
            ctx.fillStyle = gradSky; ctx.fillRect(0, 0, w, horizon);
            
            // Gramado com Textura (Simulada por ruído ou cor sólida)
            ctx.fillStyle = '#2d8a2d'; ctx.fillRect(0, horizon, w, h);

            // Perspectiva da Pista
            const topW = w * 0.01; 
            const botW = w * 1.8; // Pista bem larga na base (sensação de velocidade)
            const curveOff = d.curve * (w * 0.55);

            // 4.1 Zebras (Alta Visibilidade)
            const zebraW = w * 0.2;
            const zebraFreq = Math.floor(d.pos / 35) % 2;
            ctx.fillStyle = (zebraFreq === 0) ? '#cc0000' : '#ffffff';
            ctx.beginPath();
            ctx.moveTo(cx + curveOff - topW - (zebraW*0.1), horizon);
            ctx.lineTo(cx + curveOff + topW + (zebraW*0.1), horizon);
            ctx.lineTo(cx + botW + zebraW, h);
            ctx.lineTo(cx - botW - zebraW, h);
            ctx.fill();

            // 4.2 Asfalto
            ctx.fillStyle = '#444'; 
            ctx.beginPath();
            ctx.moveTo(cx + curveOff - topW, horizon);
            ctx.lineTo(cx + curveOff + topW, horizon);
            ctx.lineTo(cx + botW, h);
            ctx.lineTo(cx - botW, h);
            ctx.fill();

            // 4.3 Faixas Centrais
            ctx.strokeStyle = '#ffcc00'; 
            ctx.lineWidth = w * 0.012;
            ctx.setLineDash([h * 0.08, h * 0.12]); // Faixas mais longas
            ctx.lineDashOffset = -d.pos; 
            ctx.beginPath(); 
            ctx.moveTo(cx + curveOff, horizon); 
            ctx.quadraticCurveTo(cx + (curveOff * 0.4), h * 0.7, cx, h); 
            ctx.stroke(); 
            ctx.setLineDash([]);

            // --- 5. OBJETOS E INIMIGOS ---
            let drawList = [];
            
            // Update Obstáculos
            d.obs.forEach((o, i) => {
                o.z -= d.speed * 2.2; 
                if(o.z < -100) { d.obs.splice(i,1); return; }
                drawList.push({ type: o.type, obj: o, z: o.z });
            });

            // Update Inimigos
            d.enemies.forEach((e, i) => {
                e.z -= (d.speed - e.speed) * 2.2;
                e.x += e.laneChange; // IA simples
                if(e.z < -300 || e.z > 1500) { d.enemies.splice(i,1); return; }
                drawList.push({ type: 'car', obj: e, z: e.z });
            });

            drawList.sort((a, b) => b.z - a.z);

            drawList.forEach(item => {
                const o = item.obj;
                const scale = 500 / (o.z + 100);
                
                if(scale > 0 && o.z < 1000) {
                    const objX = cx + (d.curve * w * 0.3 * (1 - o.z/1000)) + (o.x * w * 0.5 * scale);
                    const objY = (h * 0.4) + (50 * scale);
                    const size = (w * 0.12) * scale;

                    // Hitbox
                    let hit = false;
                    // Hitbox mais precisa (baseada na escala)
                    if(o.z < 100 && o.z > -50 && Math.abs(d.x - o.x) < 0.3) hit = true;

                    if(item.type === 'cone') {
                        ctx.fillStyle = '#ff5500';
                        ctx.beginPath(); ctx.moveTo(objX, objY - size); 
                        ctx.lineTo(objX - size*0.4, objY); ctx.lineTo(objX + size*0.4, objY); ctx.fill();
                        // Faixa reflexiva
                        ctx.fillStyle = '#fff';
                        ctx.fillRect(objX - size*0.2, objY - size*0.6, size*0.4, size*0.2);
                        
                        if(hit) {
                            d.speed *= 0.6; d.health -= 8; window.Sfx.crash(); 
                            d.obs.splice(d.obs.indexOf(o), 1);
                        }
                    } 
                    else if (item.type === 'sign') {
                        const ph = size * 2.5;
                        ctx.fillStyle = '#333'; ctx.fillRect(objX - 2, objY - ph, 4*scale, ph); 
                        ctx.fillStyle = '#004488'; // Azul Rodovia
                        ctx.fillRect(objX - size*1.2, objY - ph, size*2.4, size);
                        ctx.strokeStyle = '#fff'; ctx.lineWidth=2*scale; 
                        ctx.strokeRect(objX - size*1.2, objY - ph, size*2.4, size);
                        
                        // Setas na placa
                        ctx.fillStyle = '#fff'; ctx.beginPath();
                        ctx.moveTo(objX - size*0.5, objY - ph + size*0.2);
                        ctx.lineTo(objX + size*0.5, objY - ph + size*0.5);
                        ctx.lineTo(objX - size*0.5, objY - ph + size*0.8);
                        ctx.fill();

                        if(hit) {
                            d.speed *= 0.3; d.health -= 20; window.Sfx.crash(); 
                            d.obs.splice(d.obs.indexOf(o), 1);
                        }
                    }
                    else if (item.type === 'car') {
                        const es = scale * w * 0.0035;
                        ctx.save(); ctx.translate(objX, objY); ctx.scale(es, es);
                        // Renderização simplificada do inimigo
                        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(0, 15, 35, 12, 0, 0, Math.PI*2); ctx.fill();
                        ctx.fillStyle = '#111'; ctx.fillRect(-28, 0, 10, 16); ctx.fillRect(18, 0, 10, 16);
                        ctx.fillStyle = o.color; ctx.beginPath(); ctx.roundRect(-22, -20, 44, 45, 6); ctx.fill();
                        ctx.fillStyle = '#000'; ctx.fillRect(-18, -15, 36, 10); // Vidro traseiro
                        ctx.restore();

                        if(hit) {
                            d.speed = 0; d.health -= 30; window.Sfx.crash();
                            o.z -= 300; // Física de batida (empurra)
                            o.speed += 5; // Inimigo foge
                        }
                    }
                }
            });

            // --- 6. KART DO JOGADOR (DETALHADO E RESPONSIVO) ---
            const carX = cx + (d.x * w * 0.25);
            const carY = h * 0.85;
            const s = w * 0.0035;
            
            // Efeito visual de curva (Paralaxe Limitado)
            // Multiplicador 22 garante que não "quebra" o sprite
            let visualTurn = d.steer * 22; 
            visualTurn = Math.max(-24, Math.min(24, visualTurn)); 

            ctx.save();
            ctx.translate(carX, carY);
            
            // Shake de dano
            if(d.health < 40) ctx.translate((Math.random()-0.5)*3, (Math.random()-0.5)*3);
            
            ctx.scale(s, s);

            // 1. Sombra
            ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(0, 18, 38, 14, 0, 0, Math.PI*2); ctx.fill();

            // 2. Rodas Traseiras (Largas)
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(-32, 2, 14, 20); ctx.fillRect(18, 2, 14, 20);

            // 3. Chassi (Cor Dinâmica)
            if(d.health > 70) ctx.fillStyle = '#e60000'; // Vermelho Ferrari
            else if(d.health > 30) ctx.fillStyle = '#b71c1c'; // Vermelho Escuro
            else ctx.fillStyle = '#5c0000'; // Queimado
            ctx.beginPath(); ctx.roundRect(-24, -22, 48, 50, 8); ctx.fill();

            // 4. Detalhes do Motor
            ctx.fillStyle = '#333'; ctx.fillRect(-14, 25, 28, 10);
            ctx.fillStyle = '#111'; 
            ctx.beginPath(); ctx.arc(-8, 32, 4, 0, Math.PI*2); ctx.fill(); // Escape E
            ctx.beginPath(); ctx.arc(8, 32, 4, 0, Math.PI*2); ctx.fill();  // Escape D

            // Fumaça de Dano
            if(d.health < 50) {
                const gray = Math.floor(100 + Math.random()*50);
                ctx.fillStyle = `rgba(${gray},${gray},${gray},0.6)`;
                ctx.beginPath(); ctx.arc(0, -35, 15 + Math.random()*10, 0, Math.PI*2); ctx.fill();
            }

            // 5. Rodas Dianteiras (Animadas)
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(-30 + visualTurn, -25, 12, 16); 
            ctx.fillRect(18 + visualTurn, -25, 12, 16);

            // 6. Cockpit e Piloto
            ctx.fillStyle = '#222'; ctx.fillRect(-16, -10, 32, 20); // Banco
            
            // Capacete (Amarelo com listra)
            ctx.fillStyle = '#ffcc00'; ctx.beginPath(); ctx.arc(visualTurn * 0.6, -8, 12, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(visualTurn * 0.6, -8, 12, 0, Math.PI, true); ctx.fill(); // Detalhe

            // Volante
            ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(-10 + visualTurn, -15); ctx.lineTo(10 + visualTurn, -15); ctx.stroke();

            ctx.restore();

            // --- 7. HUD NO TOPO (NÍVEL + VIDA) ---
            const hudY = h * 0.08;
            const hudW = w * 0.5;
            
            // Tubo do Nível
            ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.roundRect(cx - hudW/2, hudY, hudW, 25, 12); ctx.fill(); ctx.stroke();
            
            // Marcações do Nível
            ctx.beginPath(); ctx.moveTo(cx-20, hudY); ctx.lineTo(cx-20, hudY+25); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx+20, hudY); ctx.lineTo(cx+20, hudY+25); ctx.stroke();

            // Bolinha do Nível (Verde = Bom, Vermelho = Ruim)
            let bubX = cx - (d.steer * (hudW * 0.9));
            bubX = Math.max(cx - hudW/2 + 12, Math.min(cx + hudW/2 - 12, bubX));
            ctx.fillStyle = Math.abs(d.steer) < 0.1 ? '#00ff00' : '#ff4400';
            ctx.beginPath(); ctx.arc(bubX, hudY + 12.5, 9, 0, Math.PI*2); ctx.fill();

            // Barra de Vida (Logo abaixo do nível)
            const hpY = hudY + 35;
            ctx.fillStyle = '#000'; ctx.fillRect(cx - hudW/2, hpY, hudW, 8);
            ctx.fillStyle = d.health > 50 ? '#00ff00' : '#ff0000';
            ctx.fillRect(cx - hudW/2, hpY, Math.max(0, hudW * (d.health/100)), 8);
            
            ctx.fillStyle = '#fff'; ctx.font = "bold 12px Arial"; ctx.textAlign="center";
            ctx.fillText(`DANOS: ${100 - Math.ceil(d.health)}%`, cx, hpY + 20);

            // --- 8. GAME OVER ---
            if(d.health <= 0) {
                window.System.gameOver("PERDA TOTAL!");
            }

            // --- 9. LUVAS DO JOGADOR (SEMPRE VISÍVEIS) ---
            // Desenha as luvas por cima de tudo para referência visual perfeita
            if(window.Gfx && window.Gfx.drawSteeringHands) {
                window.Gfx.drawSteeringHands(ctx, pose, w, h);
            }

            return d.score;
        }
    };

    // REGISTRO NO CORE
    if(window.System) {
        window.System.registerGame('drive', 'Kart do Otto', '🏎️', Logic, {camOpacity: 0.5, showWheel: true});
    }
})();
