// LÓGICA DO JOGO: KART DO OTTO
(function() {
    const Logic = {
        s:0, p:0, x:0, st:0, c:0, obs:[],
        init: function(){ this.s=0; this.p=0; this.x=0; this.obs=[]; window.System.msg("SEGURE O VOLANTE!"); },
        update: function(ctx, w, h, pose){
            const cx=w/2; let ang=0;
            // 1. Volante (Feedback Visual + Input)
            if(window.Gfx) window.Gfx.drawSteeringHands(ctx, pose, w, h);

            if(pose){
                const kp=pose.keypoints, lw=kp.find(k=>k.name==='left_wrist'), rw=kp.find(k=>k.name==='right_wrist');
                if(lw&&rw&&lw.score>0.3&&rw.score>0.3){
                    const dy=rw.y-lw.y, dx=rw.x-lw.x;
                    ang=Math.atan2(dy,dx)*1.5*window.System.sens;
                    if(this.s<h*0.05) this.s+=h*0.0005;
                } else { this.s*=0.95; }
            }
            this.st+=(ang-this.st)*0.2;
            const wheel=document.getElementById('visual-wheel'); if(wheel) wheel.style.transform=`rotate(${this.st*57}deg)`;
            
            // 2. Física
            this.p+=this.s; this.c=Math.sin(this.p*0.005)*1.5;
            this.x+=this.st*(this.s/(h*0.5)); this.x-=this.c*(this.s/h);
            if(Math.abs(this.x)>1.3) this.s*=0.9;
            
            // 3. Obstáculos
            if(Math.random()<0.02 && this.s>5) this.obs.push({x:(Math.random()*2)-1, z:1000});

            // 4. Desenho (Estrada)
            ctx.fillStyle='#111'; ctx.fillRect(0,0,w,h);
            const hor=h*0.4;
            ctx.strokeStyle='#00ffcc'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(0,hor); ctx.lineTo(w,hor); ctx.stroke();
            ctx.fillStyle='#333'; ctx.beginPath();
            const topW=w*0.05, botW=w*1.2, off=this.c*(w*0.3);
            ctx.moveTo(cx+off-topW, hor); ctx.lineTo(cx+off+topW, hor); ctx.lineTo(cx+botW, h); ctx.lineTo(cx-botW, h); ctx.fill();
            ctx.strokeStyle='#ffeb3b'; ctx.lineWidth=w*0.02; ctx.setLineDash([h*0.05, h*0.05]); ctx.lineDashOffset=-this.p;
            ctx.beginPath(); ctx.moveTo(cx+off, hor); ctx.quadraticCurveTo(cx+(off*0.5), h*0.7, cx, h); ctx.stroke(); ctx.setLineDash([]);

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

            const carX=cx+(this.x*w*0.25);
            ctx.save(); ctx.translate(carX, h*0.85); ctx.rotate(this.st); const s=w*0.003; ctx.scale(s,s);
            ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(-25,-10,50,40);
            ctx.fillStyle='#ff0033'; ctx.beginPath(); ctx.roundRect(-20,-20,40,40,5); ctx.fill();
            ctx.fillStyle='#111'; ctx.fillRect(-15,-10,30,10);
            ctx.restore();

            return Math.floor(this.p/100);
        }
    };

    // REGISTRO SEGURO
    const regLoop = setInterval(() => {
        if(window.System && window.System.registerGame) {
            window.System.registerGame('drive', 'Kart do Otto', '🏎️', Logic, {camOpacity: 0.5, showWheel: true});
            clearInterval(regLoop);
        }
    }, 100);
})();
