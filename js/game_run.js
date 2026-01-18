// LÓGICA DO JOGO: OTTO RUNNER
(function() {
    const Logic = {
        lane:0, sc:0, f:0, obs:[],
        init: function(){ this.sc=0; this.obs=[]; window.System.msg("CORRA!"); },
        update: function(ctx, w, h, pose){
            const cx=w/2; this.f++;
            if(pose){
                const n=pose.keypoints.find(k=>k.name==='nose');
                if(n&&n.score>0.4){ if(n.x<210)this.lane=1; else if(n.x>430)this.lane=-1; else this.lane=0; }
            }
            if(this.f%50===0) this.obs.push({l:Math.floor(Math.random()*3)-1, z:1000});
            
            ctx.clearRect(0,0,w,h); ctx.fillStyle='#111'; ctx.fillRect(0,0,w,h);
            ctx.strokeStyle='#00ffcc'; ctx.lineWidth=1;
            ctx.beginPath(); ctx.moveTo(cx-(w*0.3), h/2); ctx.lineTo(0,h); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx+(w*0.3), h/2); ctx.lineTo(w,h); ctx.stroke();

            this.obs.forEach((o,i)=>{
                o.z-=20; if(o.z<-100){this.obs.splice(i,1); this.sc+=10; window.Sfx.coin(); return;}
                const sc=500/(o.z+100);
                if(sc>0){
                    const ox=cx+(o.l*w*0.3*sc), oy=h/2+(50*sc), sz=w*0.15*sc;
                    ctx.fillStyle='#f03'; ctx.fillRect(ox-sz/2, oy, sz, sz);
                    if(o.z<50 && o.z>-50 && o.l===this.lane) window.System.gameOver(this.sc);
                }
            });
            
            ctx.save(); ctx.translate(cx+(this.lane*w*0.25), h*0.85); const ps=w*0.005; ctx.scale(ps,ps);
            ctx.strokeStyle='#0f0'; ctx.lineWidth=3; ctx.lineCap='round';
            const osc=Math.sin(this.f*0.5)*10;
            ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-15); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-8+osc,20); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(8-osc,20); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0,-12); ctx.lineTo(-10-osc,-5); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0,-12); ctx.lineTo(10+osc,-5); ctx.stroke();
            ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(0,-22,5,0,Math.PI*2); ctx.fill();
            ctx.restore();
            return this.sc;
        }
    };

    // REGISTRO SEGURO
    const regLoop = setInterval(() => {
        if(window.System && window.System.registerGame) {
            window.System.registerGame('run', 'Otto Runner', '🏃', Logic, {camOpacity: 0.3, showWheel: false});
            clearInterval(regLoop);
        }
    }, 100);
})();
