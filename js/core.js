/* =================================================================
   🔊 AUDIO ENGINE
   ================================================================= */
const Sfx = {
    ctx: null,
    init: () => { window.AudioContext = window.AudioContext || window.webkitAudioContext; Sfx.ctx = new AudioContext(); },
    play: (f, t, d, v=0.1) => {
        if(!Sfx.ctx) return;
        const o = Sfx.ctx.createOscillator(), g = Sfx.ctx.createGain();
        o.type=t; o.frequency.value=f; g.gain.setValueAtTime(v, Sfx.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, Sfx.ctx.currentTime+d);
        o.connect(g); g.connect(Sfx.ctx.destination); o.start(); o.stop(Sfx.ctx.currentTime+d);
    },
    hover: () => Sfx.play(800, 'sine', 0.05, 0.02),
    click: () => Sfx.play(1200, 'sine', 0.1, 0.1),
    coin: () => { Sfx.play(1500,'square',0.1, 0.05); setTimeout(()=>Sfx.play(2000,'square',0.1, 0.05), 80); },
    hit: () => Sfx.play(150,'sawtooth',0.1, 0.2),
    crash: () => Sfx.play(80,'sawtooth',0.4, 0.4),
    skid: () => Sfx.play(60, 'sawtooth', 0.2, 0.2)
};

/* =================================================================
   🎨 GRAPHICS ENGINE (Global Helpers)
   ================================================================= */
const Gfx = {
    mapPoint: (p, w, h) => ({ x: w - (p.x / 640 * w), y: p.y / 480 * h }),
    
    // Esqueleto Padrão
    drawSkeleton: (ctx, pose, w, h) => {
        if(!pose) return;
        ctx.lineCap='round'; ctx.lineJoin='round'; ctx.strokeStyle='#00ffff'; ctx.lineWidth = w * 0.015;
        const kp = pose.keypoints; const get = n => kp.find(k=>k.name===n);
        const bone = (n1, n2) => {
            const p1 = get(n1), p2 = get(n2);
            if(p1 && p2 && p1.score>0.3 && p2.score>0.3) {
                const m1 = Gfx.mapPoint(p1, w, h), m2 = Gfx.mapPoint(p2, w, h);
                ctx.beginPath(); ctx.moveTo(m1.x, m1.y); ctx.lineTo(m2.x, m2.y); ctx.stroke();
            }
        };
        bone('left_shoulder','left_elbow'); bone('left_elbow','left_wrist');
        bone('right_shoulder','right_elbow'); bone('right_elbow','right_wrist');
        bone('left_shoulder','right_shoulder');
    },

    // Mãos Virtuais (Volante)
    drawSteeringHands: (ctx, pose, w, h) => {
        if(!pose) return;
        const kp = pose.keypoints;
        const lw = kp.find(k=>k.name==='left_wrist'), rw = kp.find(k=>k.name==='right_wrist');
        if(lw && rw && lw.score>0.3 && rw.score>0.3) {
            const p1 = Gfx.mapPoint(lw, w, h), p2 = Gfx.mapPoint(rw, w, h);
            ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)'; ctx.lineWidth = 4; ctx.setLineDash([10, 10]); ctx.stroke(); ctx.setLineDash([]);
            const r = w * 0.05;
            ctx.fillStyle = 'rgba(255, 0, 0, 0.8)'; ctx.beginPath(); ctx.arc(p1.x, p1.y, r, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "#fff"; ctx.font = "bold 12px sans-serif"; ctx.textAlign="center"; ctx.fillText("L", p1.x, p1.y+4);
            ctx.fillStyle = 'rgba(255, 0, 0, 0.8)'; ctx.beginPath(); ctx.arc(p2.x, p2.y, r, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "#fff"; ctx.fillText("R", p2.x, p2.y+4);
        }
    }
};

/* =================================================================
   🧠 SYSTEM KERNEL
   ================================================================= */
const System = {
    video: null, canvas: null, ctx: null, detector: null,
    activeGame: null, loopId: null, sens: 1.0,
    games: {}, // Registro de Jogos

    // Método para adicionar jogos dinamicamente
    registerGame: (id, name, icon, logicObj, settings={camOpacity:0.3, showWheel:false}) => {
        System.games[id] = { name, icon, logic: logicObj, settings };
        console.log(`Jogo registrado: ${name}`);
    },

    renderMenu: () => {
        const grid = document.getElementById('channel-grid');
        grid.innerHTML = '';
        // Renderiza jogos registrados
        for (const [id, game] of Object.entries(System.games)) {
            const div = document.createElement('div');
            div.className = 'channel';
            div.onclick = () => System.launch(id);
            div.innerHTML = `<div class="channel-icon">${game.icon}</div><div class="channel-name">${game.name}</div>`;
            grid.appendChild(div);
        }
        // Preenche vazios
        for(let i=0; i<4; i++) {
            const empty = document.createElement('div');
            empty.className = 'channel channel-empty';
            grid.appendChild(empty);
        }
    },

    boot: async () => {
        document.getElementById('boot-log').innerText = "Iniciando Sensores...";
        Sfx.init(); Sfx.click();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: {ideal: 640}, height: {ideal: 480} }, audio: false });
            System.video = document.getElementById('video-source');
            System.video.srcObject = stream;
            document.getElementById('webcam').srcObject = stream;
            await new Promise(r => System.video.onloadedmetadata = r);
            System.video.play(); document.getElementById('webcam').play();

            document.getElementById('screen-safety').classList.add('hidden');
            document.getElementById('screen-load').classList.remove('hidden');

            await tf.setBackend('webgl');
            System.detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING });

            System.canvas = document.getElementById('game-canvas');
            System.ctx = System.canvas.getContext('2d');
            System.resize(); window.addEventListener('resize', System.resize);

            document.getElementById('screen-load').classList.add('hidden');
            System.renderMenu(); // Cria o menu
            System.menu();
        } catch(e) { alert("Erro: Permita a câmera! " + e.message); }
    },

    menu: () => {
        System.stopGame();
        document.getElementById('screen-menu').classList.remove('hidden');
        document.getElementById('screen-over').classList.add('hidden');
        document.getElementById('game-ui').classList.add('hidden');
        document.getElementById('webcam').style.opacity = '0';
    },

    launch: (gameId) => {
        Sfx.click();
        const game = System.games[gameId];
        if(!game) return;

        System.activeGame = game;
        document.getElementById('screen-menu').classList.add('hidden');
        document.getElementById('game-ui').classList.remove('hidden');
        
        // Aplica configurações do jogo
        document.getElementById('webcam').style.opacity = game.settings.camOpacity;
        document.getElementById('ui-wheel').style.opacity = game.settings.showWheel ? '1' : '0';

        // Inicia
        game.logic.init();
        System.loop();
    },

    loop: async () => {
        if(!System.activeGame) return;
        const ctx = System.ctx, w = System.canvas.width, h = System.canvas.height;
        let pose = null;
        try { const p = await System.detector.estimatePoses(System.video, {flipHorizontal: false}); if(p.length>0) pose = p[0]; } catch(e){}

        // Executa lógica do jogo atual
        const score = System.activeGame.logic.update(ctx, w, h, pose);
        
        document.getElementById('hud-score').innerText = score;
        System.loopId = requestAnimationFrame(System.loop);
    },

    stopGame: () => {
        System.activeGame = null;
        if(System.loopId) cancelAnimationFrame(System.loopId);
    },

    home: () => { Sfx.click(); System.menu(); },
    gameOver: (score) => {
        System.stopGame(); Sfx.crash();
        document.getElementById('final-score').innerText = score;
        document.getElementById('game-ui').classList.add('hidden');
        document.getElementById('screen-over').classList.remove('hidden');
    },
    restart: () => System.menu(),
    setSens: (v) => System.sens = parseFloat(v),
    msg: (txt) => { const el = document.getElementById('game-msg'); el.innerText = txt; setTimeout(()=>el.innerText='', 1500); },
    resize: () => { if(System.canvas) { System.canvas.width = window.innerWidth; System.canvas.height = window.innerHeight; } }
};
