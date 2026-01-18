// LÓGICA DO JOGO: KART DO OTTO (COM LUVAS E FÍSICA)
(function() {
    const Logic = {
        s:0, p:0, x:0, st:0, c:0, obs:[],
        
        init: function(){ 
            this.s=0; this.p=0; this.x=0; this.obs=[]; 
            window.System.msg("SEGURE O VOLANTE!"); 
        },
        
        update: function(ctx, w, h, pose){
            const cx=w/2; let ang=0;
            
            // 1. INPUT (Detecção das Mãos)
            if(pose){
                const kp=pose.keypoints, lw=kp.find(k=>k.name==='left_wrist'), rw=kp.find(k=>k.name==='right_wrist');
                if(lw&&rw&&lw.score>0.3&&rw.score>0.3){
                    const dy=rw.y-lw.y, dx=rw.x-lw.x;
                    ang=Math.atan2(dy,dx)*1.5*window.System.sens;
                    if(this.s<h*0.05) this.s+=h*0.0005;
                } else { this.s*=0.95; }
            }
            // Suaviza movimento do volante
            this.st+=(ang-this.st)*0.2;
            
            // Gira o Volante Visual no HTML
            const wheel=document.getElementById('visual-wheel'); 
            if(wheel) wheel.style.transform=`rotate(${this.st*57}deg)`;
            
            // 2. FÍSICA
            this.p+=this.s; this.c=Math.sin(this.p*0.005)*1.5;
            this.x+=this.st*(this.s/(h*0.5)); this.x-=this.c*(this.s/h);
            if(Math.abs(this.x)>1.3) this.s*=0.9;
            
            // 3. OBSTÁCULOS
            if(Math.random()<0.02 && this.s>5) this.obs.push({x:(Math.random()*2)-1, z:1000});

            // 4. DESENHO
            ctx.fillStyle='#111'; ctx.fillRect(0,0,w,h);
            const hor=h*0.4;
            // Céu e Chão
            ctx.fillStyle='#333'; ctx.fillRect(0,hor,w,h-hor);
            ctx.fillStyle='#87CEEB'; ctx.fillRect(0,0,w,hor); // Céu
            
            // Pista
            ctx.fillStyle='#555'; ctx.beginPath();
            const topW=w*0.05, botW=w*1.2, off=this.c*(w*0.3);
            ctx.moveTo(cx+off-topW, hor); ctx.lineTo(cx+off+topW, hor); ctx.lineTo(cx+botW, h); ctx.lineTo(cx-botW, h); ctx.fill();
            
            // Linhas
            ctx.strokeStyle='#ffeb3b'; ctx.lineWidth=w*0.02; ctx.setLineDash([h*0.05, h*0.05]); ctx.lineDashOffset=-this.p;
            ctx.beginPath(); ctx.moveTo(cx+off, hor); ctx.quadraticCurveTo(cx+(off*0.5), h*0.7, cx, h); ctx.stroke(); ctx.setLineDash([]);

            // Obstáculos
            this.obs.forEach((o,i)=>{
                o.z-=this.s*2; if(o.z<-100){this.obs.splice(i,1); return;}
                const sc=500/(o.z+100);
                if(sc>0 && o.z<1000){
                    const ox=cx+(this.c*(w*0.3)*(1-(o.z/1000)))+(o.x*w*0.5*sc);
                    const oy=(h*0.4)+(50*sc), sz=(w*0.08)*sc;
                    ctx.fillStyle='#ff9900'; ctx.beginPath(); ctx.moveTo(ox,oy-sz); ctx.lineTo(ox-sz/2,oy); ctx.lineTo(ox+sz/2,oy); ctx.fill();
                    if(o.z<100 && o.z>0 && Math.abs(this.x-o.x)<0.3){
                        this.s*=0.5; window.Sfx.skid(); this.obs.splice(i,1); ctx.fillStyle='rgba(255,0,0,0.5)'; ctx.fillRect(0,0,w,h);
                    }
                }
            });

            // Carro
            const carX=cx+(this.x*w*0.25);
            ctx.save(); ctx.translate(carX, h*0.85); ctx.rotate(this.st*0.5); // Inclina levemente
            const s=w*0.0035; ctx.scale(s,s);
            ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(-25,-10,50,40); // Sombra
            ctx.fillStyle='#ff0033'; ctx.beginPath(); ctx.roundRect(-20,-20,40,45,5); ctx.fill(); // Corpo
            ctx.fillStyle='#111'; ctx.fillRect(-15,-10,30,10); // Vidro
            ctx.restore();

            // 5. LUVAS VIRTUAIS (CRUCIAL: DESENHA POR ÚLTIMO)
            if(window.Gfx && window.Gfx.drawSteeringHands) {
                window.Gfx.drawSteeringHands(ctx, pose, w, h);
            }

            return Math.floor(this.p/100);
        }
    };

    // REGISTRO
    const regLoop = setInterval(() => {
        if(window.System && window.System.registerGame) {
            window.System.registerGame('drive', 'Kart do Otto', '🏎️', Logic, {camOpacity: 0.6, showWheel: true});
            clearInterval(regLoop);
        }
    }, 100);
})();
