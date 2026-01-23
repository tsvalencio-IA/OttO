/* =================================================================
   KART PHYSICS ENGINE V2 (Mario Kart Logic)
   Handles: Vectors, Drifting, Centrifugal Force, Elastic Collisions
   ================================================================= */

window.KartPhysics = {
    // Estado Físico do Jogador
    x: 0,             // Posição lateral normalizada (-1 a 1 na estrada)
    z: 0,             // Distância percorrida total
    speed: 0,         // Velocidade atual
    speedMax: window.K.MAX_SPEED,
    
    driftState: 0,    // 0: Nenhum, 1: Hop, 2: Sliding, 3: Turbo Ready
    driftDir: 0,      // -1 (Esq), 1 (Dir)
    miniTurbo: 0,     // Carga do turbo
    boostTimer: 0,    // Duração do boost ativo
    
    // Output para Render
    visualTilt: 0,    // Inclinação do sprite (visual apenas)
    playerY: 0,       // Pulo/Bumping

    reset: function() {
        this.x = 0;
        this.z = 0;
        this.speed = 0;
        this.driftState = 0;
        this.boostTimer = 0;
    },

    update: function(dt, input, trackLength, currentCurve) {
        const K = window.K;
        
        // 1. ACELERAÇÃO & FREIO (Com Boost)
        let accel = K.ACCEL;
        let max = this.speedMax;
        
        if (this.boostTimer > 0) {
            max += 50; // Boost speed limit
            accel *= 2;
            this.boostTimer -= dt;
        }

        if (input.throttle) {
            this.speed = Utils.accelerate(this.speed, accel, dt);
        } else if (input.brake) {
            this.speed = Utils.accelerate(this.speed, K.BREAKING, dt);
        } else {
            this.speed = Utils.accelerate(this.speed, K.DECEL, dt);
        }

        // 2. OFF-ROAD PHYSICS (NÃO TRAVA, APENAS REDUZ)
        // Se x > 1.2 ou x < -1.2, está na grama
        if ((Math.abs(this.x) > 1.1) && this.boostTimer <= 0) {
            this.speed = Utils.accelerate(this.speed, K.OFFROAD_DECEL, dt);
            // Cap speed on grass
            if(this.speed > K.OFFROAD_LIMIT) 
                this.speed = Utils.interpolate(this.speed, K.OFFROAD_LIMIT, 0.05);
        }

        this.speed = Utils.limit(this.speed, 0, max);

        // 3. CURVAS & FORÇA CENTRÍFUGA (O SEGREDO DO MARIO KART)
        const speedRatio = this.speed / K.MAX_SPEED;
        const dx = dt * 2 * speedRatio; // Base lateral movement speed

        // Input de direção (-1 a 1)
        let steer = input.steer;
        
        // DRIFT LOGIC
        if (input.drift && this.speed > 30 && this.driftState === 0) {
            this.driftState = 1; // Start Hop
            this.playerY = 20;   // Visual Hop
            this.driftDir = Math.sign(steer) || 1;
        }
        
        if (this.driftState > 0 && !input.drift) {
            // Soltou o botão de drift -> Dispara Turbo se carregado
            if (this.miniTurbo > 100) {
                this.boostTimer = 2.0; // 2 segundos de turbo
                // SFX Boost aqui
            }
            this.driftState = 0;
            this.miniTurbo = 0;
        }

        if (this.driftState > 0) {
            // Durante Drift: Carro vira mais, mas desliza
            steer = this.driftDir; // Trava a direção das rodas visualmente
            
            // Counter-steering carrega o turbo
            if (Math.sign(input.steer) !== this.driftDir && input.steer !== 0) {
                this.miniTurbo += 2; 
            } else {
                this.miniTurbo += 0.5;
            }
        }

        // APLICAÇÃO DE FORÇAS
        // A. Força Centrífuga: A curva te joga pra fora (X oposto à curva)
        // Quanto mais rápido, mais forte a força.
        this.x -= (dx * speedRatio * currentCurve * K.CENTRIFUGAL);

        // B. Direção do Jogador: Compensa a centrífuga
        // Grip aumenta se estiver devagar, diminui se rápido (Understeer)
        this.x += (dx * steer * K.STEER_SPEED);

        // 4. COLISÃO ELÁSTICA COM BORDAS (Sem travar)
        // Se bater muito forte no muro invisível (> 2.5), quica de volta
        if (Math.abs(this.x) > 2.2) {
            this.x = Math.sign(this.x) * 2.2;
            this.speed *= 0.96; // Perda leve de velocidade (Wall rub)
        }

        // 5. MOVIMENTO LONGITUDINAL (Z)
        this.z += (this.speed * dt * 1.5); // Escala para unidades do mundo
        if (this.z >= trackLength) this.z -= trackLength; // Loop da pista
        if (this.z < 0) this.z += trackLength;

        // 6. VISUAL TILT (Apenas cosmético)
        const targetTilt = (steer * 20) + (this.driftState > 0 ? this.driftDir * 15 : 0);
        this.visualTilt = Utils.interpolate(this.visualTilt, targetTilt, 0.1);
        
        // Gravidade do Pulo
        if(this.playerY > 0) this.playerY += K.GRAVITY * dt * 10;
        if(this.playerY < 0) this.playerY = 0;
    }
};