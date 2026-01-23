/* =================================================================
   PSEUDO-3D RENDERER (Outrun Style)
   Draws Road, Sprites, Backgrounds using scanline scaling
   ================================================================= */

window.KartRenderer = {
    draw: function(ctx, width, height, segments, playerPos, playerX, playerCurve, background) {
        const K = window.K;
        const horizon = height / 2;
        
        // 1. BACKGROUND PARALLAX
        // Move o fundo baseado na curvatura acumulada (heading)
        this.drawBackground(ctx, width, height, playerCurve);

        // 2. ROAD RENDERING
        const baseSegment = segments[Math.floor(playerPos / K.SEGMENT_LENGTH) % segments.length];
        const basePercent = Utils.percentRemaining(playerPos, K.SEGMENT_LENGTH);
        
        let dx = -(baseSegment.curve * basePercent);
        let x = 0;
        let maxY = height; // Clipping buffer

        // Render Distância: 300 segmentos (~600m)
        const drawDistance = 300; 

        for(let n = 0; n < drawDistance; n++) {
            const nSeg = segments[(baseSegment.index + n) % segments.length];
            const looped = nSeg.index < baseSegment.index;
            
            // Projeção 3D
            // Camera Z é relativo ao jogador. A estrada se move, a câmera é fixa em Z=0.
            const camX = playerX * K.ROAD_WIDTH;
            const camY = K.CAMERA_HEIGHT + window.KartPhysics.playerY * 100;
            const camZ = playerPos - (looped ? window.Game.trackLength : 0);
            
            // Projection Logic
            this.project(nSeg.p1, (playerX * K.ROAD_WIDTH) - x, camY, playerPos - (looped ? window.Game.trackLength : 0), width, height, K.CAMERA_DEPTH);
            this.project(nSeg.p2, (playerX * K.ROAD_WIDTH) - x - dx, camY, playerPos - (looped ? window.Game.trackLength : 0), width, height, K.CAMERA_DEPTH);

            x += dx;
            dx += nSeg.curve;

            // Culling (Otimização)
            if (nSeg.p1.camera.z <= K.CAMERA_DEPTH || nSeg.p2.screen.y >= maxY || nSeg.p2.screen.y >= nSeg.p1.screen.y) {
                continue;
            }

            // Draw Segment
            this.renderSegment(ctx, width, K.LANES, nSeg.p1.screen.x, nSeg.p1.screen.y, nSeg.p1.screen.w, nSeg.p2.screen.x, nSeg.p2.screen.y, nSeg.p2.screen.w, nSeg.color);

            maxY = nSeg.p1.screen.y;
            
            // Draw Sprites in this segment (Rivals, Items)
            // (Implemented in main render loop to handle Z-sorting properly if needed, 
            // but simplified here: render back-to-front painter's algo is inherent in loop order IF reversed. 
            // For Outrun engines, forward loop means we need to draw sprites later or use a buffer.
            // SOLUTION: We store visible segments and draw sprites after road.)
        }
        
        // 3. DRAW PLAYER SPRITE
        this.drawPlayer(ctx, width, height);
    },

    project: function(p, cameraX, cameraY, playerZ, width, height, depth) {
        // Traduz coordenadas do mundo para a tela
        p.camera.x = (p.world.x || 0) - cameraX;
        p.camera.y = (p.world.y || 0) - cameraY;
        p.camera.z = (p.world.z || 0) - playerZ;
        
        // Evita divisão por zero
        if(p.camera.z < 1) p.camera.z = 1;

        p.screen.scale = depth / p.camera.z;
        p.screen.x = Math.round((width / 2) + (p.screen.scale * p.camera.x * width / 2));
        p.screen.y = Math.round((height / 2) - (p.screen.scale * p.camera.y * height / 2));
        p.screen.w = Math.round((p.screen.scale * window.K.ROAD_WIDTH * width / 2));
    },

    renderSegment: function(ctx, width, lanes, x1, y1, w1, x2, y2, w2, color) {
        // Grama
        ctx.fillStyle = color.grass;
        ctx.fillRect(0, y2, width, y1 - y2);

        // Estrada
        ctx.fillStyle = color.road;
        ctx.beginPath();
        ctx.moveTo(x1 - w1, y1);
        ctx.lineTo(x2 - w2, y2);
        ctx.lineTo(x2 + w2, y2);
        ctx.lineTo(x1 + w1, y1);
        ctx.fill();

        // Zebras (Rumble Strips)
        const r1 = w1 / Math.max(6, 2 * lanes);
        const r2 = w2 / Math.max(6, 2 * lanes);
        ctx.fillStyle = color.rumble;
        ctx.beginPath();
        ctx.moveTo(x1 - w1 - r1, y1);
        ctx.lineTo(x1 - w1, y1);
        ctx.lineTo(x2 - w2, y2);
        ctx.lineTo(x2 - w2 - r2, y2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x1 + w1 + r1, y1);
        ctx.lineTo(x1 + w1, y1);
        ctx.lineTo(x2 + w2, y2);
        ctx.lineTo(x2 + w2 + r2, y2);
        ctx.fill();
        
        // Faixa Central
        if (color.lane) {
            const l1 = w1 / 32;
            const l2 = w2 / 32;
            ctx.fillStyle = color.lane;
            ctx.beginPath();
            ctx.moveTo(x1 - l1, y1);
            ctx.lineTo(x2 - l2, y2);
            ctx.lineTo(x2 + l2, y2);
            ctx.lineTo(x1 + l1, y1);
            ctx.fill();
        }
    },

    drawBackground: function(ctx, w, h, rotation) {
        // Sky Gradient
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#00bfff');
        grad.addColorStop(1, '#cceeff');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        
        // Hills (Simple Parallax)
        // rotation changes x offset
        // TODO: Implement image based mountains if assets exist. For now, procedural hills.
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        for(let i=0; i<w; i+=10) {
            const hOffset = Math.sin(i * 0.01 + rotation * 0.1) * 50;
            ctx.lineTo(i, h/2 - 50 + hOffset);
        }
        ctx.lineTo(w, h/2);
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.fill();
    },

    drawPlayer: function(ctx, w, h) {
        const kart = window.KartPhysics;
        const scale = 3.5; // Scale up for Wii look
        const cx = w / 2;
        const cy = h - 100 - (kart.playerY * 2); // Bounce effect

        // Rotação visual do Sprite
        const tilt = kart.visualTilt * (Math.PI / 180);

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(tilt);
        ctx.scale(scale, scale);

        // --- DESENHO PROCEDURAL DO KART (Estilo Mario) ---
        // Sombra
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath(); ctx.ellipse(0, 20, 30, 8, 0, 0, Math.PI*2); ctx.fill();

        // Corpo
        ctx.fillStyle = '#e74c3c'; // Vermelho Mario
        ctx.beginPath();
        ctx.moveTo(-20, -10); ctx.lineTo(20, -10);
        ctx.lineTo(25, 10); ctx.lineTo(-25, 10);
        ctx.fill();

        // Rodas (Mudam de cor no Drift/Turbo)
        const wheelColor = kart.miniTurbo > 100 ? '#f1c40f' : (kart.miniTurbo > 50 ? '#3498db' : '#333');
        ctx.fillStyle = wheelColor;
        ctx.fillRect(-28, 5, 10, 15); // TR
        ctx.fillRect(18, 5, 10, 15);  // TL
        
        // Cabeça
        ctx.fillStyle = '#f5cba7'; // Pele
        ctx.beginPath(); ctx.arc(0, -15, 12, 0, Math.PI*2); ctx.fill();
        // Boné
        ctx.fillStyle = '#c0392b';
        ctx.beginPath(); ctx.arc(0, -18, 12, Math.PI, 0); ctx.fill();
        ctx.fillRect(-12, -18, 24, 4);

        // Volante (Gira)
        ctx.fillStyle = '#111';
        ctx.save();
        ctx.translate(0, -5);
        ctx.rotate(kart.x * 0.5); // Vira com a direção
        ctx.fillRect(-8, -2, 16, 4);
        ctx.restore();

        // Fogo do Turbo
        if(kart.boostTimer > 0) {
            ctx.fillStyle = '#00ffff';
            ctx.beginPath(); ctx.moveTo(-5, 10); ctx.lineTo(0, 30 + Math.random()*10); ctx.lineTo(5, 10); ctx.fill();
        }

        ctx.restore();
    }
};