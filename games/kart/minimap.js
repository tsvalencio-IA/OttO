/* =================================================================
   DYNAMIC MINIMAP
   Generates a top-down view of the track geometry
   ================================================================= */

window.Minimap = {
    canvas: null,
    ctx: null,
    path: [],
    
    init: function(segments) {
        this.canvas = document.getElementById('minimap-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.generatePath(segments);
    },

    generatePath: function(segments) {
        this.path = [];
        let x = 0;
        let y = 0;
        let angle = 0; // -PI/2 para começar apontando pra cima? Ajustar.

        // Simula o traçado
        segments.forEach(seg => {
            // A curva em pseudo-3d é mudança de ângulo
            angle += seg.curve * 0.03; // Escala arbitrária para 2D
            x += Math.sin(angle) * 2;
            y -= Math.cos(angle) * 2;
            this.path.push({x, y});
        });

        // Normaliza para caber no canvas (150x150)
        // Encontra bounding box
        let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
        this.path.forEach(p => {
            if(p.x < minX) minX = p.x; if(p.x > maxX) maxX = p.x;
            if(p.y < minY) minY = p.y; if(p.y > maxY) maxY = p.y;
        });

        const scaleX = 130 / (maxX - minX);
        const scaleY = 130 / (maxY - minY);
        const scale = Math.min(scaleX, scaleY);

        // Centraliza
        const offsetX = (150 - (maxX - minX) * scale) / 2 - minX * scale;
        const offsetY = (150 - (maxY - minY) * scale) / 2 - minY * scale;

        this.path = this.path.map(p => ({
            x: p.x * scale + offsetX,
            y: p.y * scale + offsetY
        }));
    },

    update: function(playerPos, trackLength) {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, 150, 150);

        // Desenha Pista
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        if(this.path.length > 0) ctx.moveTo(this.path[0].x, this.path[0].y);
        
        for(let i=1; i<this.path.length; i++) {
            ctx.lineTo(this.path[i].x, this.path[i].y);
        }
        ctx.closePath();
        ctx.stroke();

        // Desenha Jogador
        // Mapeia posição linear Z para índice do array de caminho
        const index = Math.floor((playerPos / trackLength) * this.path.length) % this.path.length;
        const p = this.path[index];

        if(p) {
            ctx.fillStyle = '#00ffff';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 6, 0, Math.PI*2);
            ctx.fill();
            
            // Seta de Direção (Pega próximo ponto)
            const nextP = this.path[(index + 5) % this.path.length];
            const angle = Math.atan2(nextP.y - p.y, nextP.x - p.x);
            
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(angle);
            ctx.fillStyle = '#f1c40f';
            ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-5, 5); ctx.lineTo(-5, -5); ctx.fill();
            ctx.restore();
        }
    }
};