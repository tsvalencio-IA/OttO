/* =================================================================
   🔊 AUDIO ENGINE (GLOBAL)
   ================================================================= */
window.Sfx = {
    ctx: null,
    init: () => { 
        window.AudioContext = window.AudioContext || window.webkitAudioContext; 
        window.Sfx.ctx = new AudioContext(); 
    },
    play: (f, t, d, v=0.1) => {
        if(!window.Sfx.ctx) return;
        const o = window.Sfx.ctx.createOscillator(); 
        const g = window.Sfx.ctx.createGain();
        o.type = t; 
        o.frequency.value = f; 
        g.gain.setValueAtTime(v, window.Sfx.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, window.Sfx.ctx.currentTime+d);
        o.connect(g); 
        g.connect(window.Sfx.ctx.destination); 
        o.start(); 
        o.stop(window.Sfx.ctx.currentTime+d);
    },
    // Atalhos para sons comuns
    hover: () => window.Sfx.play(800, 'sine', 0.05, 0.02),
    click: () => window.Sfx.play(1200, 'sine', 0.1, 0.1),
    coin: () => { 
        window.Sfx.play(1500, 'square', 0.1, 0.05); 
        setTimeout(() => window.Sfx.play(2000, 'square', 0.1, 0.05), 80); 
    },
    hit: () => window.Sfx.play(150, 'sawtooth', 0.1, 0.2),
    crash: () => window.Sfx.play(80, 'sawtooth', 0.4, 0.4),
    skid: () => window.Sfx.play(60, 'sawtooth', 0.2, 0.2)
};

/* =================================================================
   🎨 GRAPHICS ENGINE (GLOBAL HELPERS)
   ================================================================= */
window.Gfx = {
    // Converte coordenadas do vídeo para a tela cheia
    map: (p, w, h) => ({
        x: w - (p.x / 640 * w), 
        y: p.y / 480 * h
    }),
    
    // Desenha Esqueleto Padrão (Usado no Boxe)
    drawSkel: (ctx, pose, w, h) => {
        if(!pose) return;
        ctx.lineCap = 'round'; 
        ctx.lineJoin = 'round'; 
        ctx.strokeStyle = '#00ffff'; 
        ctx.lineWidth = w * 0.015;
        
        const kp = pose.keypoints; 
        const get = n => kp.find(k => k.name === n);
        
        const bone = (n1, n2) => {
            const p1 = get(n1), p2 = get(n2);
            if(p1 && p2 && p1.score > 0.3 && p2.score > 0.3) {
                const m1 = window.Gfx.map(p1, w, h);
                const m2 = window.Gfx.map(p2, w, h);
                ctx.beginPath(); 
                ctx.moveTo(m1.x, m1.y); 
                ctx.lineTo(m2.x, m2.y); 
                ctx.stroke();
            }
        };
        
        bone('left_shoulder','left_elbow'); bone('left_elbow','left_wrist');
        bone('right_shoulder','right_elbow'); bone('right_elbow','right_wrist');
        bone('left_shoulder','right_shoulder');
        
        // Luvas (opcional para feedback visual no esqueleto)
        const lw = get('left_wrist'), rw = get('right_wrist'), s = w * 0.08;
        if(lw && lw.score > 0.3){
            const p = window.Gfx.map(lw, w, h); 
            ctx.fillStyle = 'red'; ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, Math.PI*2); ctx.fill();
        }
        if(rw && rw.score > 0.3){
            const p = window.Gfx.map(rw, w, h); 
            ctx.fillStyle = 'red'; ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, Math.PI*2); ctx.fill();
        }
    },

    // Mãos Virtuais (Específico para o Volante/Kart)
    drawSteeringHands: (ctx, pose, w, h) => {
        if(!pose) return;
        const kp = pose.keypoints;
        const lw = kp.find(k => k.name === 'left_wrist');
        const rw = kp.find(k => k.name === 'right_wrist');
        
        if(lw && rw && lw.score > 0.3 && rw.score > 0.3) {
            const p1 = window.Gfx.map(lw, w, h);
            const p2 = window.Gfx.map(rw, w, h);
            
            // Linha de conexão (eixo do volante)
            ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)'; 
            ctx.lineWidth = 4; 
            ctx.setLineDash([10, 10]); 
            ctx.stroke(); 
            ctx.setLineDash([]);
            
            // Mãos (Punhos)
            const r = w * 0.05;
            ctx.fillStyle = 'rgba(255, 0, 0, 0.8)'; 
            ctx.beginPath(); ctx.arc(p1.x, p1.y, r, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "#fff"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center"; ctx.fillText("L", p1.x, p1.y+4);
            
            ctx.fillStyle = 'rgba(255, 0, 0, 0.8)'; 
            ctx.beginPath(); ctx.arc(p2.x, p2.y, r, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "#fff"; ctx.fillText("R", p2.x, p2.y+4);
        }
    }
};

/* =================================================================
   🧠 SYSTEM KERNEL (GLOBAL)
   ================================================================= */
window.System = {
    video: null, 
    canvas: null, 
    ctx: null, 
    detector: null,
    activeGame: null, 
    loopId: null, 
    sens: 1.0,
    games: {}, // Registro de Jogos

    // Método Global para registrar jogos (Usado pelos arquivos game_*.js)
    reg: (id, name, icon, logicObj, settings={cam:0.3, wheel:false}) => {
        window.System.games[id] = { 
            name: name, 
            icon: icon, 
            logic: logicObj, 
            sets: settings 
        };
        console.log(`Jogo registrado: ${name}`);
    },

    // Renderiza o Grid do Menu com base nos jogos registrados
    renderMenu: () => {
        const grid = document.getElementById('channel-grid');
        if(!grid) return;
        grid.innerHTML = '';
        
        // Cria ícones para cada jogo registrado
        for (const [id, game] of Object.entries(window.System.games)) {
            const div = document.createElement('div');
            div.className = 'channel';
            div.onclick = () => window.System.launch(id);
            div.innerHTML = `<div class="channel-icon">${game.icon}</div><div class="channel-name">${game.name}</div>`;
            grid.appendChild(div);
        }
        
        // Preenche espaços vazios para manter o layout bonito
        for(let i=0; i<4; i++) {
            const empty = document.createElement('div');
            empty.className = 'channel channel-empty';
            grid.appendChild(empty);
        }
    },

    // Inicialização do Hardware (Câmera e IA)
    boot: async () => {
        document.getElementById('boot-log').innerText = "Iniciando Sensores...";
        window.Sfx.init(); 
        window.Sfx.click();
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'user', width: {ideal: 640}, height: {ideal: 480} }, 
                audio: false 
            });
            
            window.System.video = document.getElementById('video-source');
            window.System.video.srcObject = stream;
            document.getElementById('webcam').srcObject = stream;
            
            await new Promise(r => window.System.video.onloadedmetadata = r);
            window.System.video.play(); 
            document.getElementById('webcam').play();

            document.getElementById('screen-safety').classList.add('hidden');
            document.getElementById('screen-load').classList.remove('hidden');

            // Carrega TensorFlow
            await tf.setBackend('webgl');
            window.System.detector = await poseDetection.createDetector(
                poseDetection.SupportedModels.MoveNet, 
                { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
            );

            window.System.canvas = document.getElementById('game-canvas');
            window.System.ctx = window.System.canvas.getContext('2d');
            window.System.resize(); 
            window.addEventListener('resize', window.System.resize);

            document.getElementById('screen-load').classList.add('hidden');
            
            // Renderiza o menu AGORA, depois que os scripts de jogo já rodaram
            window.System.renderMenu(); 
            window.System.menu();
            
        } catch(e) { 
            alert("Erro Fatal: Permita o uso da câmera! " + e.message); 
        }
    },

    // Volta para o Menu
    menu: () => {
        window.System.stop();
        document.getElementById('screen-menu').classList.remove('hidden');
        document.getElementById('screen-over').classList.add('hidden');
        document.getElementById('game-ui').classList.add('hidden');
        document.getElementById('webcam').style.opacity = '0';
    },

    // Lança um Jogo Específico
    launch: (gameId) => {
        window.Sfx.click();
        const game = window.System.games[gameId];
        if(!game) return;

        window.System.activeGame = game;
        document.getElementById('screen-menu').classList.add('hidden');
        document.getElementById('game-ui').classList.remove('hidden');
        
        // Aplica configurações específicas do jogo
        document.getElementById('webcam').style.opacity = game.sets.cam;
        document.getElementById('ui-wheel').style.opacity = game.sets.wheel ? '1' : '0';

        // Inicia a lógica do jogo
        game.logic.init();
        window.System.loop();
    },

    // Loop Principal do Jogo (60 FPS)
    loop: async () => {
        if(!window.System.activeGame) return;
        
        const ctx = window.System.ctx; 
        const w = window.System.canvas.width; 
        const h = window.System.canvas.height;
        
        let pose = null;
        try { 
            const p = await window.System.detector.estimatePoses(window.System.video, {flipHorizontal: false}); 
            if(p.length > 0) pose = p[0]; 
        } catch(e){}

        // Executa o update do jogo ativo
        const score = window.System.activeGame.logic.update(ctx, w, h, pose);
        
        document.getElementById('hud-score').innerText = score;
        window.System.loopId = requestAnimationFrame(window.System.loop);
    },

    // Para o jogo atual
    stop: () => {
        window.System.activeGame = null;
        if(window.System.loopId) cancelAnimationFrame(window.System.loopId);
    },

    home: () => { 
        window.Sfx.click(); 
        window.System.menu(); 
    },

    gameOver: (score) => {
        window.System.stop();
        window.Sfx.crash();
        document.getElementById('final-score').innerText = score;
        document.getElementById('game-ui').classList.add('hidden');
        document.getElementById('screen-over').classList.remove('hidden');
    },

    resize: () => {
        if(window.System.canvas) {
            window.System.canvas.width = window.innerWidth;
            window.System.canvas.height = window.innerHeight;
        }
    },
    
    setSens: (v) => window.System.sens = parseFloat(v),
    
    msg: (txt) => {
        const el = document.getElementById('game-msg');
        el.innerText = txt;
        setTimeout(() => el.innerText = '', 1500);
    }
};
