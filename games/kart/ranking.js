/* =================================================================
   REAL-TIME RANKING SYSTEM
   Manages Rivals, Positions, and Leaderboard Display
   ================================================================= */

window.Ranking = {
    racers: [], // { id, name, pos, z, speed, color }
    
    init: function() {
        this.racers = [
            { id: 'player', name: 'VOCÊ', z: 0, speed: 0, color: '#e74c3c', lap: 1, finished: false },
            { id: 'cpu1', name: 'LUIGI', z: 200, speed: 230, color: '#2ecc71', lap: 1, finished: false }, // Começa na frente
            { id: 'cpu2', name: 'PEACH', z: 400, speed: 225, color: '#e91e63', lap: 1, finished: false },
            { id: 'cpu3', name: 'BOWSER', z: -200, speed: 245, color: '#f39c12', lap: 1, finished: false }
        ];
        this.updateTable();
    },

    update: function(dt, playerZ, playerSpeed, trackLength) {
        // Atualiza Player
        const p = this.racers.find(r => r.id === 'player');
        p.z = playerZ;
        p.speed = playerSpeed;

        // Atualiza Rivals (IA Simples)
        this.racers.forEach(r => {
            if(r.id === 'player') return;
            
            // Rubber banding (Elástico)
            let targetSpeed = r.speed;
            if(r.z > p.z + 1000) targetSpeed *= 0.95; // Se muito longe, espera
            if(r.z < p.z - 1000) targetSpeed *= 1.05; // Se muito atrás, acelera
            
            r.z += (r.speed * dt * 1.5); // Mesma escala física
            
            // Loop Logic
            if(r.z >= trackLength) {
                r.z -= trackLength;
                r.lap++;
            }
        });

        // Ordena por Distância Total (Volta * Tamanho + Posição)
        this.racers.sort((a, b) => {
            const distA = (a.lap * trackLength) + a.z;
            const distB = (b.lap * trackLength) + b.z;
            return distB - distA; // Descending
        });

        this.updateTable();
        return this.getPlayerRank();
    },

    getPlayerRank: function() {
        return this.racers.findIndex(r => r.id === 'player') + 1;
    },

    updateTable: function() {
        const el = document.getElementById('leaderboard');
        let html = '';
        this.racers.forEach((r, i) => {
            const isPlayer = r.id === 'player';
            html += `
                <div class="rank-row" style="${isPlayer ? 'background:rgba(255,255,255,0.2)' : ''}">
                    <div class="rank-pos">${i+1}º</div>
                    <div class="rank-name">${r.name}</div>
                    <div class="rank-lap">L${r.lap}</div>
                </div>
            `;
        });
        el.innerHTML = html;
    }
};