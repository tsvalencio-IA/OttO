/* =================================================================
   MAIN GAME CONTROLLER
   Integrates Physics, Rendering, Input and Game Loop
   ================================================================= */

window.Game = {
    running: false,
    ctx: null,
    canvas: null,
    
    // Track Data
    segments: [],
    trackLength: 0,
    
    // Timing
    lastTime: 0,
    dt: 0,
    timeElapsed: 0,
    
    // Player State
    input: { steer: 0, throttle: false, brake: false, drift: false },
    playerName: "Player",
    
    init: function() {
        // Setup Canvas
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d', { alpha: false }); // Optimização
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // Setup Systems
        window.CoreFB.init();
        
        // Show Menu
        document.getElementById('loader').classList.add('hidden');
        document.getElementById('menu-screen').classList.remove('hidden');
    },

    start: function() {
        const nameInput = document.getElementById('player-name').value;
        this.playerName = nameInput || "Racer X";
        
        document.getElementById('menu-screen').classList.add('hidden');
        document.getElementById('game-hud').classList.remove('hidden');
        
        this.buildTrack();
        window.KartPhysics.reset();
        window.Minimap.init(this.segments);
        window.Ranking.init();
        
        // Inputs (Keyboard for PC / Touch handled roughly via steering logic if added)
        this.setupControls();
        
        this.running = true;
        this.lastTime = performance.now();
        requestAnimationFrame(t => this.loop(t));
        
        this.msg("LARGADA!", 2000);
    },

    buildTrack: function() {
        this.segments = [];
        const K = window.K;
        
        // Procedural Track Generation (Otto Circuit)
        const addSection = (enter, curve, y) => {
            for(let i=0; i<enter; i++) {
                const p1 = { world: { z: this.segments.length * K.SEGMENT_LENGTH }, camera: {}, screen: {} };
                const p2 = { world: { z: (this.segments.length + 1) * K.SEGMENT_LENGTH }, camera: {}, screen: {} };
                
                // Color Palette
                const isDark = Math.floor(this.segments.length / K.RUMBLE_LENGTH) % 2;
                const color = {
                    grass: isDark ? '#16a085' : '#1abc9c',
                    road: isDark ? '#666' : '#636363',
                    rumble: isDark ? '#c0392b' : '#ecf0f1',
                    lane: isDark ? '#fff' : null
                };

                this.segments.push({
                    index: this.segments.length,
                    p1: p1, p2: p2,
                    curve: curve,
                    color: color
                });
            }
        };

        // LAYOUT DA PISTA
        addSection(50, 0, 0);    // Start Straight
        addSection(40, 2, 0);    // Medium Right
        addSection(20, 0, 0);
        addSection(30, -3, 0);   // Hard Left
        addSection(40, -1, 0);   // Easy Left
        addSection(50, 0, 0);
        addSection(30, 4, 0);    // Very Hard Right
        addSection(60, 0, 0);    // Long Straight
        addSection(20, -2, 0);   // Chicane Left
        addSection(20, 2, 0);    // Chicane Right
        addSection(100, 0, 0);   // Finish Line Straight

        this.trackLength = this.segments.length * K.SEGMENT_LENGTH;
    },

    setupControls: function() {
        const onKey = (val) => (e) => {
            switch(e.key) {
                case 'ArrowLeft': this.input.steer = -val; break;
                case 'ArrowRight': this.input.steer = val; break;
                case 'ArrowUp': this.input.throttle = !!val; break;
                case 'ArrowDown': this.input.brake = !!val; break;
                case ' ': this.input.drift = !!val; break; // Spacebar Drift
            }
        };
        window.addEventListener('keydown', onKey(1));
        window.addEventListener('keyup', onKey(0));
        
        // Touch Controls (Simples: Esquerda/Direita da tela)
        window.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const x = e.touches[0].clientX;
            if(x < window.innerWidth/2) this.input.steer = -1;
            else this.input.steer = 1;
            this.input.throttle = true;
        }, {passive: false});
        
        window.addEventListener('touchend', () => {
            this.input.steer = 0;
            this.input.throttle = false;
        });
    },

    loop: function(now) {
        if(!this.running) return;
        
        const dt = Math.min(1, (now - this.lastTime) / 1000); // Delta Time in seconds
        this.lastTime = now;
        this.timeElapsed += dt;

        // 1. UPDATE
        const phys = window.KartPhysics;
        const currentSeg = this.segments[Math.floor(phys.z / window.K.SEGMENT_LENGTH) % this.segments.length];
        
        // Physics Step
        phys.update(dt, this.input, this.trackLength, currentSeg.curve);
        
        // Ranking Step
        const rank = window.Ranking.update(dt, phys.z, phys.speed, this.trackLength);

        // 2. RENDER
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        window.KartRenderer.draw(
            this.ctx, 
            this.canvas.width, 
            this.canvas.height, 
            this.segments, 
            phys.z, 
            phys.x, 
            currentSeg.curve, // Para parallax
            null
        );

        // 3. UI UPDATES
        this.updateHUD(phys, rank);
        window.Minimap.update(phys.z, this.trackLength);

        // 4. LOOP CHECK
        // Detecta volta completa (simples)
        if(phys.z < 200 && this.oldZ > this.trackLength - 200) {
            this.onLapComplete();
        }
        this.oldZ = phys.z;

        requestAnimationFrame(t => this.loop(t));
    },

    updateHUD: function(phys, rank) {
        document.getElementById('speed-display').innerText = Math.floor(phys.speed);
        document.getElementById('nitro-bar').style.width = Math.min(100, phys.miniTurbo) + '%';
        // Rank visual change if needed
    },

    onLapComplete: function() {
        const p = window.Ranking.racers.find(r => r.id === 'player');
        p.lap++;
        
        if(p.lap > window.K.TOTAL_LAPS) {
            this.finishRace(p);
        } else {
            document.getElementById('lap-display').innerText = `${p.lap}/${window.K.TOTAL_LAPS}`;
            this.msg(`VOLTA ${p.lap}`);
        }
    },

    finishRace: function(p) {
        this.running = false;
        const totalTime = window.Utils.formatTime(this.timeElapsed * 1000);
        
        this.msg("FIM DE JOGO!", 5000);
        
        // Save to Firebase
        const rank = window.Ranking.getPlayerRank();
        const score = Math.floor((10000 / this.timeElapsed) * (4 - rank)); // Score calc based on time & rank
        window.CoreFB.saveScore(this.playerName, totalTime, score);

        setTimeout(() => {
            alert(`POSIÇÃO: ${rank}º\nTEMPO: ${totalTime}\nPONTOS: ${score}`);
            location.reload();
        }, 3000);
    },

    msg: function(text, duration=1000) {
        const el = document.getElementById('center-msg');
        el.innerText = text;
        el.style.opacity = 1;
        setTimeout(() => el.style.opacity = 0, duration);
    },

    resize: function() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
};