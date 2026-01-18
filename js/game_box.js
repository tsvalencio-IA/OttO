// LÓGICA DO JOGO: OTTO BOXING
(function() {
    const Logic = {
        sc:0, tg:[], last:0,
        init: function(){ this.sc=0; this.tg=[]; window.System.msg("BOXE!"); },
        update: function(ctx, w, h, pose){
            const now=Date.now();
            ctx.clearRect(0,0,w,h); 
            if(window.Gfx) window.Gfx.drawSkeleton(ctx, pose, w, h);
            
            let hits=[];
            if(pose){
                const kp=pose.keypoints, lw=kp.find(k=>k.name==='left_wrist'), rw=kp.find(k=>k.name==='right_wrist');
                if(lw&&lw.score>0.3) hits.push(window.Gfx.map(lw,w,h));
                if(rw&&rw.score>0.3) hits.push(window.Gfx.map(rw,w,h));
            }
            if(now-this.last>800){
                this.tg.push({x:Math.random()*(w*0.8)+w*0.1, y:Math.random()*(h*0.5)+h*0.1, r:w*0.08, s:now});
                this.last=now;
            }
            this.tg.forEach((t,i)=>{
                const age=(now-t.s)/1500; if(age>1){this.tg.splice(i,1); return;}
                ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI*2);
                ctx.fillStyle=`rgba(255,255,0,${1-age})`; ctx.fill(); ctx.stroke();
                hits.forEach(h=>{
                    if(Math.hypot(h.x-t.x, h.y-t.y)<t.r*1.5){
                        this.tg.splice(i,1); this.sc+=100; window.Sfx.hit();
                    }
                });
            });
            return this.sc;
        }
    };

    // REGISTRO SEGURO + CANAL EXTRA
    const regLoop = setInterval(() => {
        if(window.System && window.System.registerGame) {
            window.System.registerGame('fight', 'Otto Boxing', '🥊', Logic, {camOpacity: 0.3, showWheel: false});
            window.System.registerGame('mii', 'Otto Channel', '🙂', {init:()=>{window.System.msg("EM BREVE");setTimeout(()=>window.System.home(),1000)},update:()=>0}, {camOpacity:0,showWheel:false});
            clearInterval(regLoop);
        }
    }, 100);
})();
