<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OTTO KART WII - Pro Edition</title>
    <script src="https://cdn.jsdelivr.net/npm/@mediapipe/pose"></script>
    <script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils"></script>
    <script src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils"></script>
    <style>
        body { margin: 0; overflow: hidden; background: #000; font-family: 'Arial Black', sans-serif; }
        canvas { display: block; width: 100vw; height: 100vh; }
        
        #ui-layer {
            position: absolute;
            top: 20px;
            left: 20px;
            color: white;
            text-shadow: 2px 2px #000;
            pointer-events: none;
        }

        .speedometer { font-size: 24px; }
        .turbo-alert { 
            color: #ff0; 
            font-size: 40px; 
            display: none; 
            position: absolute; 
            top: 50%; 
            left: 50%; 
            transform: translate(-50%, -50%); 
        }

        #video-container {
            position: absolute;
            bottom: 10px;
            right: 10px;
            width: 200px;
            border: 3px solid #fff;
            border-radius: 10px;
            transform: scaleX(-1);
        }
    </style>
</head>
<body>

<div id="ui-layer">
    <div class="speedometer">VELOCIDADE: <span id="speed-val">0</span> km/h</div>
    <div id="turbo-msg" class="turbo-alert">TURBO ATIVADO!</div>
</div>

<video id="input-video" style="display:none"></video>
<canvas id="game-canvas"></canvas>
<video id="video-container" autoplay playsinline></video>

<script>
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const speedEl = document.getElementById('speed-val');
    const turboMsg = document.getElementById('turbo-msg');
    const videoElement = document.getElementById('input-video');
    const videoDisplay = document.getElementById('video-container');

    // Configurações do Jogo
    let speed = 0;
    let maxSpeed = 15;
    let trackOffset = 0;
    let steeringAngle = 0;
    let isTurbo = false;
    let gameActive = true;

    // Inimigos
    const enemies = [
        { x: -0.5, z: 500, color: 'red', speed: 12 },
        { x: 0.5, z: 800, color: 'blue', speed: 10 },
        { x: 0, z: 1200, color: 'yellow', speed: 11 }
    ];

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    // Lógica de Detecção (MediaPipe)
    const pose = new Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });

    pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    pose.onResults(onResults);

    function onResults(results) {
        if (!results.poseLandmarks) return;

        const lm = results.poseLandmarks;
        const leftHand = lm[15];
        const rightHand = lm[16];
        const nose = lm[0];

        // 1. VOLANTE ANTIGO (Cálculo de ângulo pelos ombros/mãos)
        const dx = rightHand.x - leftHand.x;
        const dy = rightHand.y - leftHand.y;
        steeringAngle = Math.atan2(dy, dx) * (180 / Math.PI);

        // 2. FUNÇÃO TURBO (Ambas as mãos acima do nariz)
        if (leftHand.y < nose.y && rightHand.y < nose.y) {
            isTurbo = true;
            maxSpeed = 25;
            speed += 0.5;
            turboMsg.style.display = 'block';
        } else {
            isTurbo = false;
            maxSpeed = 15;
            turboMsg.style.display = 'none';
        }

        // Aceleração Automática Simples
        if (speed < maxSpeed) speed += 0.1;
        if (speed > maxSpeed) speed -= 0.2;
    }

    const camera = new Camera(videoElement, {
        onFrame: async () => {
            await pose.send({image: videoElement});
            videoDisplay.srcObject = videoElement.srcObject;
        },
        width: 640,
        height: 480
    });
    camera.start();

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // --- DESENHO DO CÉU ---
        ctx.fillStyle = '#87CEEB';
        ctx.fillRect(0, 0, canvas.width, canvas.height / 2);

        // --- DESENHO DA PISTA (Efeito de Movimento) ---
        trackOffset += speed;
        const horizon = canvas.height / 2;
        
        // Grama
        ctx.fillStyle = (Math.floor(trackOffset / 40) % 2 === 0) ? '#2d8a2d' : '#246e24';
        ctx.fillRect(0, horizon, canvas.width, canvas.height / 2);

        // Estrada (Perspectiva)
        ctx.beginPath();
        ctx.fillStyle = '#444';
        ctx.moveTo(canvas.width * 0.45, horizon);
        ctx.lineTo(canvas.width * 0.55, horizon);
        ctx.lineTo(canvas.width, canvas.height);
        ctx.lineTo(0, canvas.height);
        ctx.fill();

        // Linhas da Pista (O segredo do movimento)
        ctx.strokeStyle = 'white';
        ctx.setLineDash([20, 40]);
        ctx.lineDashOffset = -trackOffset * 2;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2, horizon);
        ctx.lineTo(canvas.width / 2, canvas.height);
        ctx.stroke();
        ctx.setLineDash([]); // Reset

        // --- DESENHO DOS ADVERSÁRIOS ---
        enemies.forEach(enemy => {
            enemy.z -= speed - enemy.speed; // Movimento relativo
            if (enemy.z < 1) enemy.z = 1500; // Reset ao passar pelo jogador

            const scale = 200 / enemy.z;
            const xPos = (canvas.width / 2) + (enemy.x * canvas.width * scale);
            const yPos = horizon + (enemy.z * 0.1 * scale); 
            const size = 100 * scale;

            if (size > 2) { // Só desenha se estiver visível
                ctx.fillStyle = enemy.color;
                ctx.fillRect(xPos - size/2, horizon + (canvas.height/2 * (1 - scale)) , size, size);
                // Detalhe simples de "carro"
                ctx.fillStyle = 'black';
                ctx.fillRect(xPos - size/2, horizon + (canvas.height/2 * (1 - scale)) + size*0.7, size, size*0.3);
            }
        });

        // --- VOLANTE ANTIGO (Visual Clássico) ---
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height - 150);
        ctx.rotate(steeringAngle * Math.PI / 180);
        
        // Aro do Volante
        ctx.beginPath();
        ctx.lineWidth = 25;
        ctx.strokeStyle = '#333';
        ctx.arc(0, 0, 100, 0, Math.PI * 2);
        ctx.stroke();

        // Detalhes (Centro)
        ctx.fillStyle = isTurbo ? '#ff0' : '#777';
        ctx.beginPath();
        ctx.arc(0, 0, 30, 0, Math.PI * 2);
        ctx.fill();
        
        // Raios do volante
        ctx.fillStyle = '#333';
        ctx.fillRect(-100, -10, 200, 20);
        ctx.fillRect(-10, -30, 20, 60);

        ctx.restore();

        // UI Update
        speedEl.innerText = Math.floor(speed * 10);

        requestAnimationFrame(draw);
    }

    draw();
</script>

</body>
</html>