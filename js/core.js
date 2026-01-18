/* =================================================================
   CORE DO SISTEMA (CÉREBRO) - VERSÃO FINAL COM LUVAS
   ================================================================= */

// 1. AUDIO GLOBAL
window.Sfx = {
    ctx: null,
    init: () => { window.AudioContext = window.AudioContext || window.webkitAudioContext; window.Sfx.ctx = new AudioContext(); },
    play: (f, t, d, v=0.1) => {
        if(!window.Sfx.ctx) return;
        const o = window.Sfx.ctx.createOscillator(); const g = window.Sfx.ctx.createGain();
        o.type=t; o.frequency.value=f; g.gain.setValueAtTime(v, window.Sfx.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, window.Sfx.ctx.currentTime+d);
        o.connect(g); g.connect(window.Sfx.ctx.destination); o.start(); o.stop(window.Sfx.ctx.currentTime+d);
    },
    hover: () => window.Sfx.play(800, 'sine', 0.05, 0.02),
    click: () => window.Sfx.play(1200, 'sine', 0.1, 0.1),
    coin: () => { window.Sfx.play(1500,'square',0.1, 0.05); setTimeout(()=>window.Sfx.play(2000,'square',0.1, 0.05), 80); },
    hit: () => window.Sfx.play(150,'sawtooth',0.1, 0.2),
    crash: () => window.Sfx.play(80,'sawtooth',0.4, 0.4),
    skid: () => window.Sfx.play(60,'sawtooth',0.2,0.2)
};

// 2. GRÁFICOS GLOBAIS (COM AS LUVAS)
window.Gfx = {
    map: (p,w,h) => ({x:w-(p.x/640*w), y:p.y/480*h}),
    
    // --- LUVAS DE PILOTO (KART) ---
    drawSteeringHands: (ctx, pose, w, h) => {
        if(!pose) return;
        const kp=pose.keypoints, lw=kp.find(k=>k.name==='left_wrist'), rw=kp.find(k=>k.name==='right_wrist');
        
        // Só desenha se tiver confiança
        if(lw&&rw&&lw.score>0.3&&rw.score>0.3){
            const p1=window.Gfx.map(lw,w,h), p2=window.Gfx.map(rw,w,h);
            
            // Eixo do Volante (Linha Verde)
            ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y);
            ctx.strokeStyle='rgba(0,255,0,0.5)'; ctx.lineWidth=4; ctx.setLineDash([10,10]); ctx.stroke(); ctx.setLineDash([]);
            
            // LUVAS VERMELHAS (Grandes e Visíveis)
            const r=w*0.06; // Tamanho da luva
            
            // Esquerda
            ctx.fillStyle='#ff0000'; ctx.beginPath(); ctx.arc(p1.x,p1.y,r,0,Math.PI*2); ctx.fill();
            ctx.lineWidth=3; ctx.strokeStyle='#fff'; ctx.stroke();
            ctx.fillStyle="#fff"; ctx.font="bold 16px Arial"; ctx.textAlign="center"; ctx.fillText("L",p1.x,p1.y+6);

            // Direita
            ctx.fillStyle='#ff0000'; ctx.beginPath(); ctx.arc(p2.x,p2.y,r,0,Math.PI*2); ctx.fill();
            ctx.lineWidth=3; ctx.strokeStyle='#fff'; ctx.stroke();
            ctx.fillStyle="#fff"; ctx.fillText("R",p2.x,p2.y+6);
        }
    },

    // --- ESQUELETO + LUVAS DE BOXE ---
    drawSkeleton: (ctx, pose, w, h) => {
        if(!pose) return;
        ctx.lineCap='round'; ctx.strokeStyle='#00ffff'; ctx.lineWidth=w*0.01;
        
        const kp=pose.keypoints; const get=n=>kp.find(k=>k.name===n);
        
        // Desenha Ossos
        const bone=(n1,n2)=>{
            const p1=get(n1), p2=get(n2);
            if(p1&&p2&&p1.score>0.3&&p2.score>0.3){
                const m1=window.Gfx.map(p1,w,h), m2=window.Gfx.map(p2,w,h);
                ctx.beginPath(); ctx.moveTo(m1.x,m1.y); ctx.lineTo(m2.x,m2.y); ctx.stroke();
            }
        };
        bone('left_shoulder','left_elbow'); bone('left_elbow','left_wrist');
        bone('right_shoulder','right_elbow'); bone('right_elbow','right_wrist');
        bone('left_shoulder','right_shoulder');

        // LUVAS DE BOXE (GIGANTES)
        const lw=get('left_wrist'), rw=get('right_wrist'), s=w*0.09; // Luva maior que a do carro
        
        if(lw&&lw.score>0.3){
            const p=window.Gfx.map(lw,w,h); 
            ctx.fillStyle='red'; ctx.beginPath(); ctx.arc(p.x,p.y,s,0,Math.PI*2); ctx.fill();
            ctx.strokeStyle='white'; ctx.lineWidth=4; ctx.stroke();
        }
        if(rw&&rw.score>0.3){
            const p=window.Gfx.map(rw,w,h); 
            ctx.fillStyle='red'; ctx.beginPath(); ctx.arc(p.x,p.y,s,0,Math.PI*2); ctx.fill();
            ctx.strokeStyle='white'; ctx.lineWidth=4; ctx.stroke();
        }
    }
};

// 3. SISTEMA OPERACIONAL
window.System = {
    video:null, canvas:null, ctx:null, detector:null,
    activeGame:null, loopId:null, sens:1.0, games:{},

    registerGame: (id, name, icon, logicObj, settings={camOpacity:0.3, showWheel:false}) => {
        window.System.games[id] = { name:name, icon:icon, logic:logicObj, sets:settings };
        console.log("Jogo Registrado:", name);
    },

    boot: async () => {
        document.getElementById('boot-log').innerText="Iniciando..."; window.Sfx.init(); window.Sfx.click();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480}},audio:false});
            window.System.video=document.getElementById('video-source'); window.System.video.srcObject=stream;
            document.getElementById('webcam').srcObject=stream;
            await new Promise(r=>window.System.video.onloadedmetadata=r); window.System.video.play(); document.getElementById('webcam').play();
            
            document.getElementById('screen-safety').classList.add('hidden');
            document.getElementById('screen-load').classList.remove('hidden');

            await tf.setBackend('webgl');
            window.System.detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {modelType:poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING});

            window.System.canvas=document.getElementById('game-canvas'); window.System.ctx=window.System.canvas.getContext('2d');
            window.System.resize(); window.addEventListener('resize',window.System.resize);

            document.getElementById('screen-load').classList.add('hidden');
            window.System.renderMenu();
            window.System.menu();
        } catch(e){ alert("Erro Câmera: " + e.message); }
    },

    renderMenu: () => {
        const grid = document.getElementById('channel-grid'); grid.innerHTML='';
        const keys = Object.keys(window.System.games);
        for(const id of keys){
            const g = window.System.games[id];
            const d=document.createElement('div'); d.className='channel'; d.onclick=()=>window.System.launch(id);
            d.innerHTML=`<div class="channel-icon">${g.icon}</div><div class="channel-name">${g.name}</div>`;
            grid.appendChild(d);
        }
        for(let i=0; i < (4 - keys.length); i++) grid.innerHTML+=`<div class="channel channel-empty"></div>`;
    },

    menu: () => {
        window.System.stopGame();
        document.getElementById('screen-menu').classList.remove('hidden');
        document.getElementById('screen-over').classList.add('hidden');
        document.getElementById('game-ui').classList.add('hidden');
        document.getElementById('webcam').style.opacity='0';
    },

    launch: (id) => {
        window.Sfx.click(); const g = window.System.games[id]; if(!g) return;
        window.System.activeGame = g;
        document.getElementById('screen-menu').classList.add('hidden');
        document.getElementById('game-ui').classList.remove('hidden');
        document.getElementById('webcam').style.opacity = g.sets.camOpacity;
        document.getElementById('ui-wheel').style.opacity = g.sets.showWheel ? '1':'0';
        g.logic.init(); window.System.loop();
    },

    loop: async () => {
        if(!window.System.activeGame) return;
        const ctx=window.System.ctx, w=window.System.canvas.width, h=window.System.canvas.height;
        let pose=null; try{ const p=await window.System.detector.estimatePoses(window.System.video,{flipHorizontal:false}); if(p.length>0) pose=p[0]; }catch(e){}
        const s = window.System.activeGame.logic.update(ctx, w, h, pose);
        document.getElementById('hud-score').innerText=s;
        window.System.loopId = requestAnimationFrame(window.System.loop);
    },

    stopGame: () => { window.System.activeGame=null; if(window.System.loopId) cancelAnimationFrame(window.System.loopId); },
    home: () => { window.Sfx.click(); window.System.menu(); },
    gameOver: (s) => { window.System.stopGame(); window.Sfx.crash(); document.getElementById('final-score').innerText=s; document.getElementById('game-ui').classList.add('hidden'); document.getElementById('screen-over').classList.remove('hidden'); },
    resize: () => { if(window.System.canvas){window.System.canvas.width=window.innerWidth; window.System.canvas.height=window.innerHeight;} },
    setSens: (v) => window.System.sens=parseFloat(v),
    msg: (t) => { const el=document.getElementById('game-msg'); el.innerText=t; setTimeout(()=>el.innerText='',1500); }
};
