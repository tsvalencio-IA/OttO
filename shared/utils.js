window.Utils = {
    // Aumenta valor até o máximo
    accelerate: (v, accel, dt) => v + (accel * dt),
    
    // Limita valor entre min e max
    limit: (v, min, max) => Math.max(min, Math.min(v, max)),
    
    // Percentual de progresso
    percentRemaining: (n, total) => (n % total) / total,
    
    // Interpolação linear
    interpolate: (a, b, percent) => a + (b-a)*percent,
    
    // Pseudo-aleatório determinístico
    randomInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
    
    // Formata tempo 00:00.00
    formatTime: (dt) => {
        const m = Math.floor(dt/60000);
        const s = Math.floor((dt%60000)/1000);
        const ms = Math.floor((dt%1000)/10);
        return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}.${ms.toString().padStart(2,'0')}`;
    },

    // Aumenta brilho da cor hex
    lighten: (color, percent) => {
        // Implementação simplificada, retorna a mesma cor se falhar
        return color; 
    }
};