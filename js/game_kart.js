// LÓGICA DO JOGO: KART DO OTTO (ULTIMATE EDITION - DANO, INIMIGOS, PLACAS)
(function() {
    const Logic = {
        // Variáveis de Física
        speed: 0, 
        pos: 0, 
        x: 0, 
        steer: 0, 
        curve: 0, 
        
        // Variáveis de Gameplay
        health: 100,      // Vida útil do carro
        maxHealth: 100,
        score: 0,
        
        // Objetos do Mundo
        obs: [],          // Cones e Placas
        enemies: [],      // Carros adversários
        
        init: function() { 
            this.speed = 0; 
            this.pos = 0; 
            this.x = 0; 
            this.health = 100;
            this.score = 0;
            this.obs = [];
            this.enemies = [];
            window.System.msg("LIGUE OS MOTORES!"); 
        },
        
        update: function(ctx, w, h, pose) {
            const d = Logic; 
            const cx = w / 2;

            // --- 1. INPUT (VOLANTE & MÃOS) ---
            let targetAngle = 0;
            
            if(pose) {
                const kp = pose.keypoints;
                const lw = kp.find(k=>k.name==='left_wrist');
                const rw = kp.find(k=>k.name==='right_wrist');
                
                // Exige as duas mãos para validar o volante e acelerar
                if(lw && rw && lw.score > 0.4 && rw.score > 0.4) {
                    const dy = rw.y - lw.y; 
                    const dx = rw.x - lw.x;
                    targetAngle = Math.atan2(dy, dx) * 1.5 * window.System.sens;
                    
                    // Acelerador Automático se detectar mãos
                    if(d.speed < h * 0.06) d.speed += h * 0.0005; 
                } else { 
                    d.speed *= 0.96; // Freio motor se soltar
                }
            }
            // Suavização da direção
            d.steer += (targetAngle - d.steer) * 0.2;
            
            // UI Volante (HTML)
            const wheel = document.getElementById('visual-wheel');
            if(wheel) wheel.style.transform = `rotate(${d.steer * 60}deg)`;

            // --- 2. FÍSICA ---
            d.pos += d.speed;
            d.score += Math.floor(d.speed * 0.1); // Pontuação por distância
            
            // Curva da pista (Senoide)
            d.curve = Math.sin(d.pos * 0.003) * 1.5;
            
            // Movimento lateral
            d.x += d.steer * (d.speed / (h * 0.5));
            d.x -= d.curve * (d.speed / h);
            
            // Colisão com borda (Dano leve)
            if(Math.abs(d.x) > 1.3) { 
                d.speed *= 0.9; 
                d.x = d.x > 0 ? 1.3 : -1.3;
                if(d.speed > 5) d.health -= 0.1; // Raspa na parede tira vida
            }

            // --- 3. SPAWN DE OBJETOS (ADVERSÁRIOS E PLACAS) ---
            
            // Cones e Placas
            if(Math.random() < 0.02 && d.speed > 5) {
                const type = Math.random() < 0.3 ? 'sign' : 'cone'; // 30% chance de ser placa
                // Placas ficam mais nas bordas, cones no meio
                let posX = (Math.random() * 2.2) - 1.1;
                if(type === 'sign') posX = (Math.random() < 0.5 ? -1.5 : 1.5); 
                
                d.obs.push({ x: posX, z: 1000, type: type });
            }

            // Inimigos (Carros)
            if(Math.random() < 0.005 && d.speed > 8) { // Raro
                d.enemies.push({
                    x: (Math.random() * 1.8) - 0.9, 
                    z: 1000, 
                    speed: d.speed * 0.5, // Mais lentos que você
                    color: Math.random() < 0.5 ? '#0000cc' : '#00cc00' // Azul ou Verde
                });
            }

            // --- 4. RENDERIZAÇÃO DE CENÁRIO ---
            const horizon = h * 0.4;
            
            // Céu
            const gradSky = ctx.createLinearGradient(0, 0, 0, horizon);
            gradSky.addColorStop(0, "#0099cc"); gradSky.addColorStop(1, "#99ccff");
            ctx.fillStyle = gradSky; ctx.fillRect(0, 0, w, horizon);
            
            // Chão (Grama)
            ctx.fillStyle = '#3dae36'; ctx.fillRect(0, horizon, w, h);

            // Estrada (Trapézio)
            const topW = w * 0.02; 
            const botW = w * 1.6;
            const curveOff = d.curve * (w * 0.5);

            // 4.1. Zebras (Rumble Strips) - Fundo Vermelho e Branco
            const zebraW = w * 0.15;
            const zebraColor = (Math.floor(d.pos / 40) % 2 === 0) ? '#cc0000' : '#ffffff';
            ctx.beginPath();
            ctx.fillStyle = zebraColor;
            ctx.moveTo(cx + curveOff - topW - (zebraW*0.1), horizon);
            ctx.lineTo(cx + curveOff + topW + (zebraW*0.1), horizon);
            ctx.lineTo(cx + botW + zebraW, h);
            ctx.lineTo(cx - botW - zebraW, h);
            ctx.fill();

            // 4.2. Asfalto
            ctx.beginPath();
            ctx.fillStyle = '#555'; 
            ctx.moveTo(cx + curveOff - topW, horizon);
            ctx.lineTo(cx + curveOff + topW, horizon);
            ctx.lineTo(cx + botW, h);
            ctx.lineTo(cx - botW, h);
            ctx.fill();

            // 4.3. Linha Central
            ctx.strokeStyle = '#ffcc00'; 
            ctx.lineWidth = w * 0.015;
            ctx.setLineDash([h * 0.05, h * 0.1]); 
            ctx.lineDashOffset = -d.pos; 
            ctx.beginPath(); 
            ctx.moveTo(cx + curveOff, horizon); 
            ctx.quadraticCurveTo(cx + (curveOff * 0.5), h * 0.7, cx, h); 
            ctx.stroke(); 
            ctx.setLineDash([]);

            // --- 5. RENDERIZAÇÃO DE OBJETOS (SORT Z) ---
            // Junta tudo para desenhar na ordem certa (do fundo para frente)
            let drawList = [];
            
            // Processa Obstáculos
            d.obs.forEach((o, i) => {
                o.z -= d.speed * 2; 
                if(o.z < -100) { d.obs.splice(i,1); return; } // Remove se passou
                drawList.push({ type: o.type, obj: o, z: o.z });
            });

            // Processa Inimigos
            d.enemies.forEach((e, i) => {
                e.z -= (d.speed - e.speed) * 2; // Velocidade relativa
                if(e.z < -200) { d.enemies.splice(i,1); return; }
                drawList.push({ type: 'car', obj: e, z: e.z });
            });

            // Ordena por profundidade (Z maior desenha primeiro)
            drawList.sort((a, b) => b.z - a.z);

            // Loop de Desenho dos Objetos
            drawList.forEach(item => {
                const o = item.obj;
                const scale = 500 / (o.z + 100);
                
                if(scale > 0 && o.z < 1000) {
                    const objX = cx + (d.curve * w * 0.3 * (1 - o.z/1000)) + (o.x * w * 0.5 * scale);
                    const objY = (h * 0.4) + (50 * scale);
                    const size = (w * 0.1) * scale;

                    // COLISÃO
                    let hit = false;
                    if(o.z < 100 && o.z > 0 && Math.abs(d.x - o.x) < 0.35) hit = true;

                    if(item.type === 'cone') {
                        // Desenha Cone
                        ctx.fillStyle = '#ff4400';
                        ctx.beginPath(); ctx.moveTo(objX, objY - size); 
                        ctx.lineTo(objX - size/3, objY); ctx.lineTo(objX + size/3, objY); ctx.fill();
                        ctx.fillStyle = '#fff'; // Faixa
                        ctx.fillRect(objX - size/6, objY - size*0.7, size/3, size*0.2);
                        
                        if(hit) {
                            d.speed *= 0.5; d.health -= 5; window.Sfx.crash(); d.obs.splice(d.obs.indexOf(o), 1);
                        }
                    } 
                    else if (item.type === 'sign') {
                        // Desenha Placa
                        const ph = size * 2; // Altura do poste
                        ctx.fillStyle = '#888'; ctx.fillRect(objX - 2, objY - ph, 4, ph); // Poste
                        ctx.fillStyle = '#003366'; // Placa Azul
                        ctx.fillRect(objX - size, objY - ph, size*2, size*0.8);
                        ctx.fillStyle = '#fff'; ctx.font = `bold ${10*scale}px Arial`; 
                        ctx.fillText("CURVA", objX - size*0.5, objY - ph + size*0.5);
                        
                        if(hit) {
                            d.speed *= 0.2; d.health -= 15; window.Sfx.crash(); d.obs.splice(d.obs.indexOf(o), 1);
                        }
                    }
                    else if (item.type === 'car') {
                        // Desenha Carro Inimigo
                        const es = scale * w * 0.0035;
                        ctx.save(); ctx.translate(objX, objY); ctx.scale(es, es);
                        // Sombra
                        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(0, 15, 35, 12, 0, 0, Math.PI*2); ctx.fill();
                        // Rodas
                        ctx.fillStyle = '#222'; ctx.fillRect(-30, 0, 12, 18); ctx.fillRect(18, 0, 12, 18);
                        // Chassi
                        ctx.fillStyle = o.color; ctx.beginPath(); ctx.roundRect(-22, -20, 44, 45, 6); ctx.fill();
                        // Capacete
                        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -5, 11, 0, Math.PI*2); ctx.fill();
                        ctx.restore();

                        if(hit) {
                            d.speed = 0; // Para na hora
                            d.health -= 25; // Dano massivo
                            window.Sfx.crash();
                            // Empurra o inimigo pra frente pra desgrudar
                            o.z -= 200; 
                        }
                    }
                }
            });

            // --- 6. KART DO JOGADOR (COM DANO VISUAL) ---
            const carX = cx + (d.x * w * 0.25);
            const carY = h * 0.85;
            const s = w * 0.0035;
            
            // Efeito visual de curva (Paralaxe - Sem tombar)
            let visualTurn = d.steer * 20; 
            visualTurn = Math.max(-25, Math.min(25, visualTurn)); 

            ctx.save();
            ctx.translate(carX, carY);
            // Efeito de tremedeira se estiver batido/danificado
            if(d.health < 30) {
                ctx.translate((Math.random()-0.5)*5, (Math.random()-0.5)*5);
            }
            ctx.scale(s, s);

            // Sombra
            ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(0, 15, 35, 12, 0, 0, Math.PI*2); ctx.fill();
            // Rodas Traseiras
            ctx.fillStyle = '#222'; ctx.fillRect(-30, 0, 12, 18); ctx.fillRect(18, 0, 12, 18);
            
            // Chassi (Cor muda conforme dano)
            if(d.health > 70) ctx.fillStyle = '#d32f2f'; // Novo
            else if(d.health > 30) ctx.fillStyle = '#b71c1c'; // Arranhado
            else ctx.fillStyle = '#5c0000'; // Destruído
            
            ctx.beginPath(); ctx.roundRect(-22, -20, 44, 45, 6); ctx.fill();

            // Fumaça se estiver estragado
            if(d.health < 40) {
                ctx.fillStyle = `rgba(100,100,100,${(Math.sin(d.pos)+1)*0.3})`;
                ctx.beginPath(); ctx.arc(0, -30, 20, 0, Math.PI*2); ctx.fill();
            }

            // Rodas Dianteiras (Móveis)
            ctx.fillStyle = '#222';
            ctx.fillRect(-28 + visualTurn, -22, 10, 14); 
            ctx.fillRect(18 + visualTurn, -22, 10, 14);

            // Capacete
            ctx.fillStyle = '#ffeb3b'; ctx.beginPath(); ctx.arc(visualTurn * 0.5, -5, 11, 0, Math.PI*2); ctx.fill();
            // Volante
            ctx.strokeStyle = '#111'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(-8 + visualTurn, -12); ctx.lineTo(8 + visualTurn, -12); ctx.stroke();
            ctx.restore();

            // --- 7. HUD: NÍVEL DE BOLINHA (NO TOPO) ---
            const levelY = h * 0.1; // TOPO DA TELA (10% da altura)
            const levelW = w * 0.4;
            const levelH = 25;
            
            // Fundo do Nível
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.roundRect(cx - levelW/2, levelY, levelW, levelH, 10); 
            ctx.fill(); ctx.stroke();
            
            // Marcações
            ctx.beginPath(); ctx.moveTo(cx - 20, levelY); ctx.lineTo(cx - 20, levelY + levelH); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx + 20, levelY); ctx.lineTo(cx + 20, levelY + levelH); ctx.stroke();

            // Bolinha (Verde/Vermelha)
            let bubbleX = cx - (d.steer * (levelW * 0.8)); 
            bubbleX = Math.max(cx - levelW/2 + 12, Math.min(cx + levelW/2 - 12, bubbleX));
            ctx.fillStyle = (Math.abs(d.steer) < 0.1) ? '#00ff00' : '#ff3300';
            
            // Brilho na bolinha
            ctx.beginPath(); ctx.arc(bubbleX, levelY + levelH/2, 9, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.beginPath(); ctx.arc(bubbleX-3, levelY + levelH/2 -3, 3, 0, Math.PI*2); ctx.fill();

            // --- 8. HUD: BARRA DE VIDA (DANO) ---
            const hpW = w * 0.3;
            ctx.fillStyle = '#333'; ctx.fillRect(cx - hpW/2, levelY + 35, hpW, 10); // Fundo
            // Cor da barra
            ctx.fillStyle = d.health > 50 ? '#0f0' : (d.health > 25 ? '#ff0' : '#f00');
            ctx.fillRect(cx - hpW/2, levelY + 35, hpW * (d.health/100), 10); // Barra atual
            ctx.strokeStyle = '#fff'; ctx.strokeRect(cx - hpW/2, levelY + 35, hpW, 10); // Borda

            // --- 9. GAME OVER ---
            if(d.health <= 0) {
                window.System.gameOver("QUEBROU!");
            }

            // --- 10. LUVAS (SEMPRE POR CIMA) ---
            if(window.Gfx && window.Gfx.drawSteeringHands) {
                window.Gfx.drawSteeringHands(ctx, pose, w, h);
            }

            return d.score;
        }
    };

    // REGISTRO
    if(window.System) {
        window.System.registerGame('drive', 'Kart do Otto', '🏎️', Logic, {camOpacity: 0.5, showWheel: true});
    }
})();
