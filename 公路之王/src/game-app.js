const Core = require('./game-core');
const W=540,H=960;
const C={ink:'#0c202c',panel:'#132d3b',cyan:'#73efd0',white:'#f5f6e9',mute:'#a7bec3',orange:'#ffad70',red:'#ff7967'};
const BEST_KEY='roadking.endless.best.v1';
const number=value=>Math.max(0,Number(value)||0);
const duration=seconds=>Math.floor(number(seconds)/60)+':'+String(Math.floor(number(seconds))%60).padStart(2,'0');
const distance=metres=>number(metres)<1000?Math.floor(number(metres))+' m':(number(metres)/1000).toFixed(2)+' km';

class RoadKingApp {
  constructor(p){
    this.p=p;this.ctx=p.canvas.getContext('2d');
    this.scale=Math.min(p.width/W,(p.height-p.top-p.bottom)/H);
    this.ox=(p.width-W*this.scale)/2;this.oy=p.top+(p.height-p.top-p.bottom-H*this.scale)/2;
    this.buttons=[];this.touchMap={};this.keyboard={};this.queuedLane=null;this.clock=0;this.shake=0;this.newBest=false;
    // Blender renders are optional at startup: a missing image keeps its vector fallback.
    this.art={};this.artLoaded=0;this.artErrors=[];
    const assets=['car-player','car-silver','car-blue','car-orange','barrier','tree','rock','hero'];
    this.artReady=Promise.all(assets.map(name=>Promise.resolve().then(()=>p.loadImage('assets/blender/'+name+'.png')).then(img=>{this.art[name]=img;this.artLoaded++;}).catch(()=>{this.art[name]=null;this.artErrors.push(name);}))).then(()=>true);
    this.muted=!!p.read('roadking.muted.v1');
    const saved=p.read(BEST_KEY)||{};this.best={score:number(saved.score),distance:number(saved.distance),elapsed:number(saved.elapsed)};
    this.game=new Core({onEvent:(type,data)=>this.onEvent(type,data)});
    p.touches(e=>this.touchStart(e),e=>this.touchMove(e),e=>this.touchEnd(e),()=>this.releaseHolds());
    p.lifecycle(()=>{this.releaseHolds();this.game.pause();p.stopSound();},()=>{this.last=p.now();});
    this.last=p.now();
    this.tick=()=>{const now=p.now(),dt=Math.min(.1,Math.max(0,(now-this.last)/1000));this.last=now;this.clock+=dt;this.game.update(dt);this.flushLane();this.shake=Math.max(0,this.shake-dt*2);this.draw();p.frame(this.tick);};
    p.frame(this.tick);
  }
  onEvent(type,data={}){
    if(type==='collision'){this.shake=.5;this.p.vibrate();if(!this.muted)this.p.sound('hit');}
    if(type==='pulse'&&!this.muted)this.p.sound('pulse');
    if(type==='result'){
      const g=this.game;this.releaseHolds();this.newBest=g.score>this.best.score;
      this.best={score:Math.max(this.best.score,number(g.score)),distance:Math.max(this.best.distance,number(g.distance)),elapsed:Math.max(this.best.elapsed,number(g.elapsed))};
      this.p.write(BEST_KEY,this.best);if(!this.muted)this.p.sound(this.newBest?'success':'hit');
    }
  }
  start(){this.releaseHolds();this.newBest=false;this.game.start(0);}
  releaseHolds(){this.touchMap={};this.keyboard={};this.queuedLane=null;if(this.p.clearKeys)this.p.clearKeys();this.game.setBrake(false);this.game.setThrottle(false);}
  changeLane(direction){
    if(this.game.mode!=='playing')return;
    const target=this.queuedLane==null?this.game.lane:this.queuedLane;
    this.queuedLane=Math.max(-1,Math.min(1,target+Math.sign(direction)));
    this.flushLane();
  }
  flushLane(){
    if(this.game.mode!=='playing'){this.queuedLane=null;return;}
    if(this.queuedLane==null)return;
    const direction=Math.sign(this.queuedLane-this.game.lane);
    if(direction)this.game.changeLane(direction);
    if(this.game.lane===this.queuedLane)this.queuedLane=null;
  }
  setKeyboardHolds(brake,throttle){this.keyboard={brake,throttle};this.updateHolds();}
  point(t){return{x:((t.clientX==null?t.x:t.clientX)-this.ox)/this.scale,y:((t.clientY==null?t.y:t.clientY)-this.oy)/this.scale};}
  inside(p,b){return p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h;}
  touchStart(e){
    (e.changedTouches||e.touches||[]).forEach(t=>{
      const pt=this.point(t),b=this.buttons.slice().reverse().find(b=>!b.disabled&&this.inside(pt,b)),id=t.identifier==null?0:t.identifier;
      if(b){this.touchMap[id]={button:b,pt};if(b.hold)this.updateHolds();else{b.action();this.draw();}}
      else this.touchMap[id]={pt,swipe:this.game.mode==='playing'&&pt.y>185&&pt.y<764};
    });
  }
  touchMove(e){
    (e.changedTouches||e.touches||[]).forEach(t=>{
      const id=t.identifier==null?0:t.identifier,item=this.touchMap[id];if(!item)return;const pt=this.point(t);
      if(item.button&&item.button.hold&&!this.inside(pt,item.button)){delete this.touchMap[id];this.updateHolds();}
      // Move the anchor after every lane: a single swipe can cross two lanes and reverse.
      if(item.swipe&&this.game.mode==='playing'){
        const threshold=38;
        while(Math.abs(pt.x-item.pt.x)>=threshold){const dir=pt.x>item.pt.x?1:-1;this.changeLane(dir);item.pt.x+=dir*threshold;}
        item.pt.y=pt.y;
      }
    });
  }
  touchEnd(e){(e.changedTouches||[]).forEach(t=>{delete this.touchMap[t.identifier==null?0:t.identifier];});this.updateHolds();}
  updateHolds(){const a=Object.keys(this.touchMap).map(k=>this.touchMap[k]);this.game.setBrake(!!this.keyboard.brake||a.some(i=>i.button&&i.button.hold==='brake'));this.game.setThrottle(!!this.keyboard.throttle||a.some(i=>i.button&&i.button.hold==='throttle'));}
  toggleSound(){this.muted=!this.muted;this.p.write('roadking.muted.v1',this.muted);if(this.muted)this.p.stopSound();}

  rr(x,y,w,h,r,fill,stroke){
    const c=this.ctx;r=Math.min(r,w/2,h/2);c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=1.3;c.stroke();}
  }
  txt(text,x,y,size,color=C.white,weight='normal',align='left'){const c=this.ctx;c.font=weight+' '+size+'px "Microsoft YaHei", "PingFang SC", sans-serif';c.fillStyle=color;c.textAlign=align;c.textBaseline='middle';c.fillText(String(text),x,y);}
  poly(points,fill){const c=this.ctx;c.beginPath();points.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.closePath();c.fillStyle=fill;c.fill();}
  line(x,y,x2,y2,color,width=1){const c=this.ctx;c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.lineWidth=width;c.strokeStyle=color;c.stroke();}
  button(x,y,w,h,label,action,o={}){
    const c=this.ctx,disabled=!!o.disabled,held=Object.keys(this.touchMap).some(k=>this.touchMap[k].button&&this.touchMap[k].button.key===(o.key||label)),radius=o.radius||14;
    this.rr(x,y+3,w,h,radius,'rgba(0,9,18,.30)');
    const fill=c.createLinearGradient(0,y,0,y+h);fill.addColorStop(0,disabled?'#263e49':held?'#d6fff1':o.primary?'#a0f8d9':o.fill||'#294653');fill.addColorStop(1,disabled?'#203742':held?'#a2f6db':o.primary?'#5bddbc':o.fill||'#1b3442');
    this.rr(x,y,w,h,radius,fill,disabled?'#304853':o.primary?'#bcffe7':'#48616b');
    this.line(x+radius,y+1,x+w-radius,y+1,disabled?'#334b56':o.primary?'rgba(242,255,222,.65)':'rgba(189,218,210,.14)');
    this.txt(label,x+w/2,y+h/2,o.size||22,disabled?'#78929b':o.primary||held?C.ink:C.white,'bold','center');this.buttons.push({x,y,w,h,action,disabled,key:o.key||label,hold:o.hold});
  }
  draw(){
    const c=this.ctx,p=this.p;c.setTransform(1,0,0,1,0,0);c.fillStyle=C.ink;c.fillRect(0,0,p.canvas.width,p.canvas.height);
    c.setTransform(p.ratio*this.scale,0,0,p.ratio*this.scale,p.ratio*this.ox,p.ratio*this.oy);c.save();c.beginPath();c.rect(0,0,W,H);c.clip();this.buttons=[];this.drawWorld();
    if(this.game.mode==='menu')this.drawMenu();else{this.drawHud();if(this.game.mode==='paused')this.drawPause();else if(this.game.mode==='result')this.drawResult();}c.restore();
  }
  projection(z,x=0){const p=1/(1+Math.max(-8,z)/34),half=242*p;return{x:270+x*half*.66,y:208+530*p,p,half};}
  drawWorld(){
    const c=this.ctx,g=this.game,menu=g.mode==='menu',travel=menu?this.clock*12:g.distance*.75;
    const sky=c.createLinearGradient(0,0,0,330);sky.addColorStop(0,'#54809b');sky.addColorStop(.50,'#e4ae97');sky.addColorStop(.82,'#ffdfaa');sky.addColorStop(1,'#efe5be');c.fillStyle=sky;c.fillRect(0,0,W,H);
    const glow=c.createRadialGradient(430,221,5,430,221,133);glow.addColorStop(0,'rgba(255,243,179,.75)');glow.addColorStop(1,'rgba(255,225,169,0)');c.fillStyle=glow;c.fillRect(290,84,250,270);
    c.fillStyle='#fff0b9';c.beginPath();c.arc(430,222,29,0,Math.PI*2);c.fill();
    this.poly([[0,249],[0,229],[30,220],[56,229],[83,207],[109,219],[139,198],[174,218],[204,227],[235,216],[270,241],[324,245],[367,228],[395,237],[422,226],[447,236],[474,231],[512,244],[540,237],[540,272]],'#7d99a0');
    this.poly([[0,254],[0,242],[34,230],[67,239],[102,224],[126,239],[155,229],[185,245],[229,248],[273,257],[319,247],[351,251],[382,241],[411,250],[446,245],[489,255],[540,247],[540,280]],'#678d91');
    const water=c.createLinearGradient(0,252,0,850);water.addColorStop(0,'#92b5af');water.addColorStop(.25,'#649ca0');water.addColorStop(1,'#315d71');c.fillStyle=water;c.fillRect(0,252,W,H-252);
    // The ocean reflection stays off the road; its horizontal layers establish the horizon.
    for(let i=0;i<22;i++){const y=259+i*i*.45,spread=13+i*2.5;c.fillStyle='rgba(255,229,173,'+(.3-i*.009)+')';c.fillRect(427-spread+Math.sin(i*4.7)*7,y,spread*2,1+i*.08);}
    for(let i=0;i<12;i++){const y=275+i*i*2.1;this.line(4+(i*37)%117,y,45+(i*43)%133,y,'rgba(204,228,204,.22)',1+i*.1);this.line(414+(i*23)%83,y+11,475+(i*19)%70,y+11,'rgba(218,229,200,.22)',1);}
    this.poly([[0,247],[87,250],[128,276],[133,311],[98,368],[65,432],[0,500]],'#728f70');
    this.poly([[0,275],[71,280],[105,310],[72,347],[46,410],[0,444]],'#8eaa77');
    this.poly([[0,456],[70,397],[98,340],[131,296],[142,272],[158,288],[132,324],[110,377],[75,440],[0,517]],'#d6bd8b');
    const far=this.projection(1100),near=this.projection(-8);
    // The raised coastal verge supports the entire palm/rock footprint beyond the rails.
    this.poly([[270-far.half-164*far.p,far.y],[270+far.half+164*far.p,far.y],[270+near.half+164*near.p,near.y],[270-near.half-164*near.p,near.y]],'#c7b18a');
    for(const side of[-1,1]){
      this.poly([[270+side*(far.half+132*far.p),far.y],[270+side*(far.half+164*far.p),far.y],[270+side*(near.half+164*near.p),near.y],[270+side*(near.half+132*near.p),near.y]],'#a79778');
      this.poly([[270+side*(far.half+164*far.p),far.y],[270+side*(far.half+169*far.p),far.y],[270+side*(near.half+169*near.p),near.y],[270+side*(near.half+164*near.p),near.y]],'rgba(224,232,191,.65)');
    }
    this.poly([[270-far.half-36*far.p,far.y],[270-far.half-131*far.p,far.y],[270-near.half-131*near.p,near.y],[270-near.half-36*near.p,near.y]],'#839470');
    this.poly([[270-far.half-47*far.p,far.y],[270-far.half-109*far.p,far.y],[270-near.half-109*near.p,near.y],[270-near.half-47*near.p,near.y]],'#93a277');
    this.poly([[270-far.half-30*far.p,far.y],[270+far.half+30*far.p,far.y],[270+near.half+30*near.p,near.y],[270-near.half-30*near.p,near.y]],'#c9baa0');
    const asphalt=c.createLinearGradient(0,far.y,0,near.y);asphalt.addColorStop(0,'#637774');asphalt.addColorStop(.25,'#4d5b60');asphalt.addColorStop(1,'#263845');
    this.poly([[270-far.half,far.y],[270+far.half,far.y],[270+near.half,near.y],[270-near.half,near.y]],asphalt);
    // Narrow tyre-polished strips and fine aggregate add material detail without lane noise.
    for(const lane of[-1,0,1])for(const side of[-1,1]){const offset=lane*.66+side*.13;this.poly([[270+far.half*(offset-.025),far.y],[270+far.half*(offset+.025),far.y],[270+near.half*(offset+.025),near.y],[270+near.half*(offset-.025),near.y]],'rgba(7,25,36,.055)');}
    for(let i=0;i<72;i++){const z=(i*13.37+360-travel%360)%360,a=this.projection(z),x=270+Math.sin(i*6.17)*a.half*.94;this.line(x,a.y,x+(.7+i%4)*a.p,a.y,'rgba(229,229,208,.10)',Math.max(.4,.7*a.p));}
    for(let z=450;z>-12;z-=6){const n=z-travel%6,a=this.projection(n),b=this.projection(n+3.1);for(const dir of[-1,1]){const x1=270+dir*a.half/3,x2=270+dir*b.half/3;this.poly([[x1-1.5*a.p,a.y],[x1+1.5*a.p,a.y],[x2+1.5*b.p,b.y],[x2-1.5*b.p,b.y]],'#e3e0ca');this.poly([[270+dir*(a.half+5*a.p),a.y],[270+dir*(a.half+12*a.p),a.y],[270+dir*(b.half+12*b.p),b.y],[270+dir*(b.half+5*b.p),b.y]],Math.floor(z/6)%2?'#e4d6b6':'#bd765b');}}
    for(const side of[-1,1]){
      this.poly([[270+side*(far.half-4*far.p),far.y],[270+side*(far.half-7*far.p),far.y],[270+side*(near.half-7*near.p),near.y],[270+side*(near.half-4*near.p),near.y]],'#fff0c0');
      const fx=270+side*(far.half+22*far.p),nx=270+side*(near.half+22*near.p);
      this.poly([[fx,far.y],[fx+side*6*far.p,far.y],[nx+side*22*near.p,near.y],[nx+side*9*near.p,near.y]],'rgba(25,42,43,.22)');
      this.poly([[fx,far.y-17*far.p],[fx,far.y-24*far.p],[nx,near.y-24*near.p],[nx,near.y-17*near.p]],'#829295');
      this.line(fx,far.y-24*far.p,nx,near.y-24*near.p,'#eadcc1',Math.max(1,2.4*near.p));
    }
    for(let z=360;z>-12;z-=12){const a=this.projection(z-travel%12);for(const side of[-1,1]){const x=270+side*(a.half+22*a.p);this.line(x,a.y,x,a.y-23*a.p,'#7a817a',Math.max(1,4*a.p));this.line(x-side*2*a.p,a.y-19*a.p,x-side*2*a.p,a.y-23*a.p,'#ffe2a1',Math.max(1,3*a.p));}}
    for(let z=260;z>-8;z-=23){const a=this.projection(z-travel%23);for(const side of[-1,1]){const x=270+side*(a.half+(side<0?74:91)*a.p);if(side<0)this.scenery('tree',x,a.y,115*a.p,172*a.p);else this.scenery('rock',x,a.y+3*a.p,132*a.p,99*a.p);}}
    // Thin roadside lights stay outside the three drivable lanes.
    for(let z=240;z>-8;z-=42){const a=this.projection(z-travel%42),x=270+a.half+37*a.p,h=136*a.p;this.line(x,a.y,x,a.y-h,'#657a7b',Math.max(1,3*a.p));this.line(x,a.y-h,x-28*a.p,a.y-h+2*a.p,'#83918b',Math.max(1,3*a.p));this.line(x-28*a.p,a.y-h+3*a.p,x-48*a.p,a.y-h+3*a.p,'#ffdf9b',Math.max(1,3*a.p));}
    if(!menu){
      this.drawSpeedLines();
      if(g.pulseLife>0){const a=this.projection(0,g.playerX),radius=(.8-g.pulseLife)*220+40;c.strokeStyle=C.cyan;c.lineWidth=7*g.pulseLife;c.beginPath();c.ellipse(a.x,a.y-19,radius,radius*.55,0,0,Math.PI*2);c.stroke();}
    }
    const traffic=menu?[{id:1,x:-1,z:32},{id:2,x:1,z:59,threat:true},{id:4,x:0,z:115},{x:0,z:84,kind:'barrier'}]:g.traffic;
    const actors=traffic.slice();if(!menu)actors.push({player:true,x:g.playerX,z:0});
    actors.sort((a,b)=>b.z-a.z).forEach(car=>{
      if(car.z<-7||car.z>175)return;const a=this.projection(car.z,car.x);
      if(car.player){c.save();c.translate(Math.sin(this.clock*85)*this.shake*5,0);this.car(a.x,a.y,1,C.cyan,true,g.invulnerability>0&&Math.floor(this.clock*12)%2===0);c.restore();}
      else if(car.kind==='barrier')this.barrier(a.x,a.y,a.p,car.hit);else this.car(a.x,a.y,a.p,car.threat?C.orange:car.id%2?'#b7c3b7':'#608b98',false,car.hit);
      if(!menu&&car.warningTimer>0&&car.signalDirection){const y=a.y-137*a.p;this.rr(a.x-37,y,74,28,8,C.orange,'#ffe0a2');this.txt(car.signalDirection<0?'← 变线':'变线 →',a.x,y+14,15,C.ink,'bold','center');}
    });
    if(!menu&&g.braking){const a=this.projection(0,g.playerX);this.line(a.x-24,740,a.x-26,757,C.orange,4);this.line(a.x+24,740,a.x+26,757,C.orange,4);}
    const haze=c.createLinearGradient(0,224,0,330);haze.addColorStop(0,'rgba(255,229,185,.28)');haze.addColorStop(1,'rgba(255,229,185,0)');c.fillStyle=haze;c.fillRect(0,224,W,106);
  }
  scenery(name,x,y,w,h){
    const c=this.ctx,img=this.art[name];this.groundShadow(x-w*.065,y-h*.018,w*.34,h*.057);if(img){c.drawImage(img,x-w*.5,y-h*.92,w,h);return;}
    if(name==='tree'){this.line(x,y,x,y-h*.65,'#655d43',w*.09);this.poly([[x,y-h],[x-w*.4,y-h*.22],[x+w*.4,y-h*.22]],'#3d7662');this.poly([[x,y-h],[x,y-h*.23],[x+w*.4,y-h*.22]],'#2b574e');}
    else{this.poly([[x-w*.45,y],[x-w*.35,y-h*.4],[x-w*.04,y-h*.55],[x+w*.36,y-h*.36],[x+w*.48,y]],'#ad9e84');this.poly([[x-w*.04,y-h*.55],[x+w*.36,y-h*.36],[x+w*.48,y],[x+w*.03,y-h*.1]],'#817e70');}
  }
  groundShadow(x,y,rx,ry){
    const c=this.ctx;c.fillStyle='rgba(7,24,30,.12)';c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();c.fillStyle='rgba(7,24,30,.19)';c.beginPath();c.ellipse(x+rx*.055,y,rx*.77,ry*.71,0,0,Math.PI*2);c.fill();
  }
  drawSpeedLines(){
    const c=this.ctx,intensity=Math.min(1,Math.max(0,(number(this.game.speed)-85)/110));if(!intensity)return;
    c.save();c.globalAlpha=.14+intensity*.26;
    for(let i=0;i<5+Math.floor(intensity*9);i++){const progress=(this.game.distance*.003+i*.137)%1,y=320+progress*440;for(const side of[-1,1]){const x=270+side*(110+progress*185+(i%3)*14);this.line(x,y,x+side*(12+intensity*16),y+22+intensity*53,'#e6fbec',1+intensity);}}
    c.restore();
  }
  car(x,y,p,color,player,hit){
    const name=player?'car-player':color===C.orange?'car-orange':color==='#b7c3b7'?'car-silver':'car-blue',img=this.art[name];
    if(img){
      const c=this.ctx,w=96*p,h=144*p;c.save();c.translate(x,y);if(hit)c.globalAlpha=.48;
      if(player)c.rotate(Math.max(-.065,Math.min(.065,(this.game.lane-this.game.playerX)*.09)));
      this.groundShadow(-7*p,-23*p,44*p,24*p);
      c.drawImage(img,-w*.5,-h*.92,w,h);
      if(player&&this.game.braking){c.fillStyle='rgba(255,92,59,.65)';c.beginPath();c.ellipse(-23*p,-16*p,7*p,3*p,0,0,Math.PI*2);c.ellipse(23*p,-16*p,7*p,3*p,0,0,Math.PI*2);c.fill();}
      c.restore();return;
    }
    const c=this.ctx,w=53*p,h=93*p;c.save();c.translate(x,y);if(hit)c.globalAlpha=.48;
    c.fillStyle='rgba(0,0,0,.24)';c.beginPath();c.ellipse(4*p,4*p,w*.72,h*.2,0,0,Math.PI*2);c.fill();
    for(const side of[-1,1]){this.rr(side<0?-w*.60:w*.45,-h*.84,8*p,23*p,2*p,'#111c23');this.rr(side<0?-w*.60:w*.45,-h*.30,8*p,23*p,2*p,'#111c23');}
    this.rr(-w/2,-h,w,h,9*p,color,'#18343b');this.poly([[-w*.42,-h*.78],[w*.42,-h*.78],[w*.31,-h*.56],[-w*.31,-h*.56]],'#153243');this.rr(-w*.33,-h*.55,w*.66,h*.30,4*p,color);this.poly([[-w*.32,-h*.25],[w*.32,-h*.25],[w*.4,-h*.12],[-w*.4,-h*.12]],'#203b47');this.line(-w*.42,-h*.81,w*.41,-h*.81,'#d9f1ea',2*p);
    if(player){this.rr(w*.12,-h*.97,w*.10,h*.16,0,'#eaf5e7');this.rr(w*.11,-h*.54,w*.10,h*.28,0,'#eaf5e7');}
    this.rr(-w*.43,-h*.08,w*.23,5*p,2*p,'#fb8460');this.rr(w*.2,-h*.08,w*.23,5*p,2*p,'#fb8460');this.rr(-w*.13,-h*.045,w*.26,3*p,0,'#d9e8de');c.restore();
  }
  barrier(x,y,p,hit){
    const img=this.art.barrier;if(img){const c=this.ctx;c.save();if(hit)c.globalAlpha=.45;this.groundShadow(x-5*p,y-4*p,51*p,12*p);c.drawImage(img,x-63*p,y-84*p*.92,126*p,84*p);c.restore();return;}
    const c=this.ctx;c.save();c.translate(x,y);if(hit)c.globalAlpha=.45;
    c.fillStyle='rgba(0,0,0,.3)';c.beginPath();c.ellipse(0,2*p,43*p,12*p,0,0,Math.PI*2);c.fill();
    this.rr(-32*p,-29*p,8*p,31*p,2*p,'#202b30');this.rr(24*p,-29*p,8*p,31*p,2*p,'#202b30');this.rr(-43*p,-51*p,86*p,35*p,4*p,C.orange,'#783c2d');
    for(let i=0;i<4;i++){const left=(-38+i*21)*p;this.poly([[left,-46*p],[left+11*p,-46*p],[left+1*p,-21*p],[left-10*p,-21*p]],'#fff0d2');}
    this.rr(-28*p,-60*p,9*p,9*p,3*p,'#fff0ad');this.rr(19*p,-60*p,9*p,9*p,3*p,'#fff0ad');c.restore();
  }
  drawMenu(){
    const c=this.ctx,fade=c.createLinearGradient(0,0,0,H);fade.addColorStop(0,'rgba(7,24,36,.98)');fade.addColorStop(.21,'rgba(8,27,39,.89)');fade.addColorStop(.41,'rgba(8,27,39,.50)');fade.addColorStop(.57,'rgba(8,27,39,.98)');fade.addColorStop(1,'rgba(8,27,39,1)');c.fillStyle=fade;c.fillRect(0,0,W,H);
    this.rr(28,28,6,17,3,C.orange);this.txt('ROAD KING',45,37,16,C.white,'bold');this.txt('ENDLESS DRIVE',514,37,12,C.mute,'normal','right');
    this.txt('公路之王',26,108,61,C.white,'bold');this.txt('一条公路，没有终点。',30,165,23,'#d0ded6');
    this.rr(28,202,151,31,15,'rgba(88,192,171,.14)','#3f736e');this.txt('日落海岸 · 无尽',103,218,15,C.cyan,'bold','center');
    this.txt('越开越快',29,287,26,C.white,'bold');this.txt('越躲越险',29,327,26,C.white,'bold');this.line(30,355,65,355,C.orange,3);this.txt('下一公里，',29,385,16,'#d2ded4');this.txt('由你的反应决定。',29,409,16,'#d2ded4');
    if(this.art.hero){this.groundShadow(355,439,130,21);c.drawImage(this.art.hero,158,215,388,259);}else this.car(398,412,1.65,C.cyan,true,false);
    this.rr(24,458,492,91,17,'rgba(23,51,63,.96)','#476069');this.txt('个人最高分',43,482,14,C.mute);this.txt(Math.round(this.best.score),43,519,37,C.cyan,'bold');this.txt('最远 '+distance(this.best.distance),493,486,17,C.white,'bold','right');this.txt('最长 '+duration(this.best.elapsed),493,518,16,C.mute,'normal','right');
    const tips=[['01','自动提速','越开越快，提前观察远处车流。'],['02','连续闪避','左右滑动换道，穿过安全空隙。'],['03','把握节奏','短按刹车，气浪推车，路障需绕行。']];
    tips.forEach((tip,i)=>{const y=581+i*58;this.rr(29,y-9,30,29,8,'#263e48');this.txt(tip[0],44,y+6,13,C.orange,'bold','center');this.txt(tip[1],78,y,19,C.white,'bold');this.txt(tip[2],78,y+26,16,C.mute);});
    this.button(24,775,492,76,'开始挑战  →',()=>this.start(),{primary:true,size:28});this.txt('车流越来越密 · 活得越久，得分越高',270,878,16,C.white,'normal','center');
    this.button(24,904,148,35,this.muted?'音效：关':'音效：开',()=>this.toggleSound(),{size:14,radius:9});this.txt('单局无尽 · 随时再来一局',515,922,14,C.mute,'normal','right');
  }
  drawHud(){
    const g=this.game,c=this.ctx,playing=g.mode==='playing',difficulty=g.difficulty||{tier:1,label:'起步巡航',progress:0},danger=difficulty.tier>=4;
    const hud=c.createLinearGradient(0,8,0,108);hud.addColorStop(0,'rgba(24,51,65,.97)');hud.addColorStop(1,'rgba(11,30,43,.97)');
    this.rr(12,8,516,100,18,hud,'#49616a');this.line(29,9,511,9,'rgba(232,235,201,.24)');this.txt('本局得分',29,31,14,C.mute);this.txt(Math.round(g.score),29,70,37,C.white,'bold');this.txt('耐久',190,31,14,C.mute);this.txt(Math.round(g.health)+'%',190,69,28,g.health>35?C.cyan:C.red,'bold');this.rr(190,93,75,3,1.5,'#34535a');if(g.health>0)this.rr(190,93,75*g.health/100,3,1.5,g.health>35?C.cyan:C.red);this.txt('速度 km/h',312,31,13,C.mute);this.txt(Math.round(g.speed),312,71,34,danger?C.orange:C.cyan,'bold');this.button(433,23,76,67,'Ⅱ',()=>{this.releaseHolds();g.pause();},{disabled:!playing,size:25});
    this.rr(12,117,516,65,14,'rgba(13,34,45,.94)','#3d5861');this.txt('存活 '+duration(g.elapsed),27,139,18,C.white,'bold');this.txt(distance(g.distance),510,139,19,C.white,'bold','right');this.txt('强度 '+difficulty.tier+' · '+difficulty.label,27,166,14,danger?C.orange:C.cyan,'bold');
    for(let i=0;i<6;i++)this.rr(382+i*22,161,16,6,3,i<difficulty.tier?danger?C.orange:C.cyan:'#3a515b');
    if(playing&&g.messageTimer>0&&g.message){const message=String(g.message);this.rr(20,199,500,42,12,'rgba(10,27,38,.93)');this.txt(message,270,220,message.length>27?13:16,C.white,'bold','center');}
    if(playing&&g.elapsed<7){this.rr(111,276,318,42,12,'rgba(10,27,38,.88)');this.txt('← 左右滑动，连续闪避 →',270,297,18,C.white,'bold','center');}
    const controls=c.createLinearGradient(0,766,0,H);controls.addColorStop(0,'#163747');controls.addColorStop(1,'#0b202e');c.fillStyle=controls;c.fillRect(0,766,W,194);this.line(0,766,W,766,'#769082');this.txt('自动提速中 · 连续滑动可跨越两条车道',270,785,15,'#b3c9c9','normal','center');
    this.button(16,806,157,72,'← 左移',()=>this.changeLane(-1),{disabled:!playing,primary:true,size:27});this.button(184,806,157,72,'右移 →',()=>this.changeLane(1),{disabled:!playing,primary:true,size:27});this.button(352,806,172,72,g.brakeLocked?'松开恢复':'按住刹车',()=>{},{key:'brake',disabled:!playing,hold:'brake',fill:'#684335',size:22});
    const energy=g.brakeEnergy==null?100:g.brakeEnergy;this.txt('刹车能量',19,902,14,C.mute);this.txt(Math.round(energy)+'%',208,902,14,g.brakeLocked?C.orange:C.cyan,'bold','right');this.rr(19,919,189,8,4,'#304952');if(energy>0)this.rr(19,919,Math.max(1,189*energy/100),8,4,g.brakeLocked?C.orange:C.cyan);this.txt('松开刹车，能量自动恢复',19,944,12,C.mute);
    this.button(228,891,296,57,g.pulseCooldown>0?'气浪 · '+Math.ceil(g.pulseCooldown)+'s':'释放气浪  ✦',()=>g.pulse(),{disabled:!playing||g.pulseCooldown>0,fill:'#274854',size:23});
  }
  scrim(){this.ctx.fillStyle='rgba(3,12,19,.83)';this.ctx.fillRect(0,0,W,H);this.buttons=[];}
  drawPause(){
    this.scrim();this.rr(24,263,492,434,23,C.panel,'#43606a');this.txt('稍停片刻',270,321,35,C.white,'bold','center');this.txt('公路在等你，准备好再出发。',270,371,18,C.mute,'normal','center');
    this.button(50,424,440,66,'继续挑战',()=>{this.releaseHolds();this.game.resume();},{primary:true});this.button(50,507,211,58,'重新开始',()=>this.start(),{size:20});this.button(279,507,211,58,'返回首页',()=>{this.releaseHolds();this.game.menu();},{size:20});this.button(50,593,440,52,this.muted?'音效：关':'音效：开',()=>this.toggleSound(),{size:18});
  }
  drawResult(){
    const g=this.game;this.scrim();this.rr(24,158,492,675,23,C.panel,'#43606a');this.txt('ROAD KING  /  本局纪录',270,195,14,C.cyan,'bold','center');this.txt(this.newBest?'刷新个人纪录':'这一程，到这里',270,252,36,C.white,'bold','center');this.txt('下一次，试着再多坚持一公里。',270,299,18,C.mute,'normal','center');
    this.txt('本局得分',270,354,16,C.mute,'normal','center');this.txt(Math.round(g.score),270,405,62,C.cyan,'bold','center');this.txt('最高分 '+Math.round(this.best.score),270,455,17,this.newBest?C.orange:C.mute,'bold','center');
    const stats=[['行驶距离',distance(g.distance)],['存活时间',duration(g.elapsed)],['最高时速',Math.round(g.maxSpeed||g.speed)+' km/h'],['成功躲避',number(g.dodged)+' 次']];
    stats.forEach((stat,i)=>{const x=i%2===0?150:390,y=i<2?507:591;this.txt(stat[0],x,y,15,C.mute,'normal','center');this.txt(stat[1],x,y+34,27,C.white,'bold','center');});
    this.button(50,672,440,66,'再挑战一次  →',()=>this.start(),{primary:true,size:25});this.button(50,757,440,51,'返回首页',()=>{this.releaseHolds();this.game.menu();},{size:19});this.txt('观察远处空隙，提前换道，短按刹车。',270,872,17,C.mute,'normal','center');
  }
}
module.exports=RoadKingApp;
