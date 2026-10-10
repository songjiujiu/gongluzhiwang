// Local Blender meshes rendered in a shared perspective scene. No DOM or CDN.
const normalize=v=>{const d=Math.hypot(...v)||1;return v.map(x=>x/d);};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
function cameraMatrix(eye,target,aspect){
  const z=normalize(eye.map((x,i)=>x-target[i])),x=normalize(cross([0,1,0],z)),y=cross(z,x);
  const v=[x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1];
  const f=1/Math.tan(54*Math.PI/360),near=.12,far=500;
  const p=[f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0];
  const m=new Float32Array(16);
  for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let i=0;i<4;i++)m[c*4+r]+=p[i*4+r]*v[c*4+i];
  return m;
}
const vertex=`attribute vec3 aPosition;attribute vec3 aNormal;uniform mat4 uCamera;uniform mediump vec3 uPosition;uniform mediump vec3 uScale;varying mediump vec3 vWorld;varying mediump vec3 vNormal;
void main(){vWorld=aPosition*uScale+uPosition;vNormal=normalize(aNormal/uScale);gl_Position=uCamera*vec4(vWorld,1.0);}`;
const fragment=`precision highp float;varying mediump vec3 vWorld;varying mediump vec3 vNormal;uniform vec3 uEye;uniform vec3 uColor;uniform mediump vec3 uPosition;uniform mediump vec3 uScale;uniform float uMetal;uniform float uRough;uniform float uEmission;uniform float uKind;uniform float uTravel;uniform float uNight;uniform float uDawn;uniform float uFog;uniform float uPlayerX;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
void main(){vec3 n=normalize(vNormal),view=normalize(uEye-vWorld),light=normalize(vec3(-.6,.85,.3));vec3 base=uColor;float rough=uRough,metal=uMetal;float alpha=1.;
if(uKind>0.5&&uKind<1.5){float grain=noise(vec2(vWorld.x*28.,(vWorld.z+uTravel)*28.));base=vec3(.105,.115,.125)*(0.80+grain*.30);float lane=abs(abs(vWorld.x)-1.55);float dash=step(3.,mod(-vWorld.z-uTravel,6.));if(lane<.055&&dash>.5||abs(vWorld.x)>4.48)base=vec3(.84,.82,.71);rough=.9;}
if(uKind>1.5&&uKind<2.5){float wave=sin(vWorld.x*1.8+uTravel*.03)*sin(vWorld.z*.8+uTravel*.06);n=normalize(vec3(wave*.08,1.,cos(vWorld.x*3.+vWorld.z)*.11));base=vec3(.025,.19,.24);rough=.16;metal=.35;}
if(uKind>2.5&&uKind<3.5){float r=length((vWorld.xz-uPosition.xz)/uScale.xz);gl_FragColor=vec4(.015,.02,.025,.38*(1.-smoothstep(.45,1.,r)));return;}
vec3 h=normalize(light+view);float diffuse=max(dot(n,light),0.);float spec=pow(max(dot(n,h),0.),mix(110.,7.,rough));float fresnel=pow(1.-max(dot(n,view),0.),5.);
vec3 ambient=mix(vec3(.14,.19,.24),vec3(.56,.69,.76),n.y*.5+.5);
vec3 color=base*(ambient*.75+vec3(1.,.73,.44)*diffuse*.85)+mix(vec3(.45),base,metal)*spec*(.3+metal*.8);
vec3 reflection=reflect(-view,n);vec3 environment=mix(vec3(.14,.11,.075),vec3(.60,.76,.89),smoothstep(-.15,.4,reflection.y));
float band=1.-smoothstep(.02,.20,abs(reflection.y-.28));environment+=vec3(.90,.79,.59)*band*.65;
color+=environment*mix(vec3(.04),base,metal)*(.12+fresnel*.7)*(1.-rough*.7);
color+=vec3(.72,.81,.86)*band*metal*.36;
// Bounded analytic light pools keep the mobile shader independent of lamp count.
float lampZ=abs(mod(vWorld.z-mod(uTravel,28.)-10.+14.,28.)-14.);
float lampPool=exp(-pow(lampZ/6.,2.)-pow((abs(vWorld.x)-3.95)/3.2,2.));
float ahead=-vWorld.z,beamWidth=1.1+max(ahead,0.)*.085;
float beam=(exp(-pow((vWorld.x-uPlayerX-.7)/beamWidth,2.))+exp(-pow((vWorld.x-uPlayerX+.7)/beamWidth,2.)))*smoothstep(1.,4.,ahead)*(1.-smoothstep(18.,46.,ahead));
float roadMask=1.-smoothstep(5.,8.,abs(vWorld.x));
vec3 nightColor=base*(vec3(.065,.10,.19)+vec3(.10,.14,.22)*diffuse);
nightColor+=base*vec3(1.,.65,.30)*lampPool*.95*roadMask;
nightColor+=base*vec3(.65,.79,1.)*beam*.85;
nightColor+=vec3(.09,.15,.25)*spec*(.3+metal)+base*fresnel*.12;
vec3 dawnColor=base*(vec3(.43,.53,.59)+vec3(.95,.72,.50)*diffuse*.55)+vec3(.55,.66,.72)*spec*(.22+metal*.45);
dawnColor+=environment*mix(vec3(.04),base,metal)*(.12+fresnel*.4)+base*vec3(.75,.83,1.)*beam*.18;
color=mix(mix(color,dawnColor,uDawn),nightColor,uNight)+base*uEmission*(uKind>4.5?(uNight+uDawn*.18)*1.8:mix(.65,1.8,uNight));
float distanceToEye=length(uEye-vWorld);
// Depth fog leaves the first fourteen metres clear and gathers low over the road.
float lowMist=exp(-max(vWorld.y,0.)*.08);
float drift=.88+.12*noise(vec2(vWorld.x*.12,(vWorld.z+uTravel*.07)*.035));
float fogDepth=distanceToEye*mix(.0028,.004,uNight)+max(distanceToEye-14.,0.)*uFog*lowMist*drift;
float fog=1.-exp(-fogDepth);
vec3 fogColor=mix(mix(vec3(.76,.69,.56),vec3(.66,.76,.79),uDawn),vec3(.015,.028,.065),uNight);
color=mix(color,fogColor,fog);color=pow(color/(color+vec3(.7)),vec3(.4545));
gl_FragColor=vec4(color,alpha);}`;
const skyVertex=`attribute vec2 aPosition;varying vec2 vUv;void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,.999,1.);}`;
const skyFragment=`precision mediump float;varying vec2 vUv;uniform float uAspect;uniform float uNight;uniform float uDawn;uniform float uFog;
void main(){vec3 c=mix(vec3(.95,.78,.54),vec3(.25,.43,.58),smoothstep(.36,1.,vUv.y));vec2 d=(vUv-vec2(.77,.65))*vec2(uAspect,1.);float sun=1.-smoothstep(.034,.04,length(d));float glow=exp(-length(d)*15.);c+=vec3(.17,.10,.025)*glow;c=mix(c,vec3(1.,.94,.73),sun);
vec3 night=mix(vec3(.055,.085,.16),vec3(.006,.013,.045),smoothstep(.35,1.,vUv.y));
float moon=1.-smoothstep(.023,.026,length(d));night+=vec3(.08,.13,.23)*exp(-length(d)*21.);night=mix(night,vec3(.78,.86,1.),moon);
vec2 grid=vUv*vec2(85.,135.);vec2 cell=floor(grid);float seed=fract(sin(dot(cell,vec2(12.9898,78.233)))*437.5453);float star=(1.-smoothstep(.02,.10,length(fract(grid)-.5)))*step(.975,seed)*smoothstep(.48,.60,vUv.y);night+=vec3(.55,.70,1.)*star;
vec3 dawn=mix(vec3(.83,.85,.83),vec3(.36,.55,.69),smoothstep(.40,1.,vUv.y));
vec2 dawnDelta=(vUv-vec2(.27,.60))*vec2(uAspect,1.);
dawn+=vec3(.12,.065,.015)*exp(-length(dawnDelta)*12.);
float dawnSun=(1.-smoothstep(.030,.039,length(dawnDelta)))*.65;
dawn=mix(dawn,vec3(1.,.91,.72),dawnSun);
gl_FragColor=vec4(mix(mix(c,dawn,uDawn),night,uNight),1.);}`;

function atmosphere(game){
  const clear={night:0,dawn:0,fog:0};
  if(game.mode==='menu'||!game.difficulty)return clear;
  const index=game.difficulty.tier-1;
  const state=stage=>({night:stage.scene==='night'?1:0,dawn:stage.scene==='dawn'?1:0,fog:stage.scene==='dawn'?stage.fogDensity:0});
  const current=state(game.stages[index]);
  if(index<=(game.startTier||1)-1)return current;
  const previous=state(game.stages[index-1]);
  const start=game.stages.slice(0,index).reduce((sum,stage)=>sum+stage.durationSeconds,0);
  const t=Math.max(0,Math.min(1,(game.elapsed+(game.stageTimeOffset||0)-start)/2.5)),blend=t*t*(3-2*t);
  return Object.fromEntries(Object.keys(clear).map(key=>[key,previous[key]+(current[key]-previous[key])*blend]));
}
function nightAmount(game){return atmosphere(game).night;}

class SceneRenderer{
  constructor(p){
    this.status='loading';this.error=null;this.ready=Promise.resolve().then(async()=>{
      if(!p.createRenderCanvas||!p.loadSceneData)throw new Error('3D platform adapter unavailable');
      this.canvas=p.createRenderCanvas();this.canvas.width=540;this.canvas.height=960;
      const gl=this.gl=this.canvas.getContext('webgl',{alpha:false,antialias:true,preserveDrawingBuffer:true});
      if(!gl)throw new Error('WebGL unavailable');
      const supportsHigh=gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT).precision>0;
      this.program=this.programFor(vertex,supportsHigh?fragment:fragment.replace('precision highp float','precision mediump float'));this.sky=this.programFor(skyVertex,skyFragment);
      this.locations={};for(const name of['uCamera','uPosition','uScale','uColor','uEye','uRough','uMetal','uEmission','uKind','uTravel','uNight','uDawn','uFog','uPlayerX'])this.locations[name]=gl.getUniformLocation(this.program,name);
      this.attributes={aPosition:gl.getAttribLocation(this.program,'aPosition'),aNormal:gl.getAttribLocation(this.program,'aNormal')};
      this.skyBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.skyBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
      const {manifest,binary}=await p.loadSceneData();this.models={};
      for(const name of Object.keys(manifest.models))this.models[name]=manifest.models[name].map(b=>{
        const packed=new Int16Array(binary,b.offset,b.count*6),vertices=new Float32Array(packed.length);
        for(let i=0;i<packed.length;i++)vertices[i]=packed[i]/(i%6<3?manifest.positionScale:manifest.normalScale);
        return this.buffer(vertices,b.material);
      });
      this.cube=this.boxBuffer();this.ground=this.planeBuffer();this.mountain=this.mountainBuffer();this.status='ready';
    }).catch(e=>{this.error=String(e.message||e);this.status='failed';});
  }
  programFor(vs,fs){const g=this.gl,program=g.createProgram();for(const [type,source]of[[g.VERTEX_SHADER,vs],[g.FRAGMENT_SHADER,fs]]){const s=g.createShader(type);g.shaderSource(s,source);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw new Error(g.getShaderInfoLog(s));g.attachShader(program,s);}g.linkProgram(program);if(!g.getProgramParameter(program,g.LINK_STATUS))throw new Error(g.getProgramInfoLog(program));return program;}
  buffer(vertices,material={}){const g=this.gl,b=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,b);g.bufferData(g.ARRAY_BUFFER,vertices,g.STATIC_DRAW);return{buffer:b,count:vertices.length/6,material};}
  planeBuffer(){return this.buffer(new Float32Array([-1,0,-1,0,1,0,1,0,-1,0,1,0,-1,0,1,0,1,0,-1,0,1,0,1,0,1,0,-1,0,1,0,1,0,1,0,1,0]));}
  boxBuffer(){const vertices=[];for(const [n,u,v]of[[[1,0,0],[0,1,0],[0,0,1]],[[-1,0,0],[0,1,0],[0,0,-1]],[[0,1,0],[1,0,0],[0,0,-1]],[[0,-1,0],[1,0,0],[0,0,1]],[[0,0,1],[1,0,0],[0,1,0]],[[0,0,-1],[-1,0,0],[0,1,0]]]){const point=(a,b)=>n.map((x,i)=>x*.5+u[i]*a*.5+v[i]*b*.5);for(const[a,b]of[[-1,-1],[1,-1],[-1,1],[-1,1],[1,-1],[1,1]])vertices.push(...point(a,b),...n);}return this.buffer(new Float32Array(vertices));}
  mountainBuffer(){const vertices=[],rings=10,segments=20;const point=(j,i)=>{const t=j/rings,angle=i/segments*Math.PI*2,r=1-t;return[Math.cos(angle)*r*(1+.13*Math.sin(i*4.13)),Math.pow(t,.7)*(1+.12*Math.sin(i*2.1)),Math.sin(angle)*r];};for(let j=0;j<rings;j++)for(let i=0;i<segments;i++){const a=point(j,i),b=point(j,i+1),c=point(j+1,i),d=point(j+1,i+1);for(const tri of[[a,b,c],[c,b,d]]){const n=normalize(cross(tri[1].map((v,k)=>v-tri[0][k]),tri[2].map((v,k)=>v-tri[0][k])));for(const p of tri)vertices.push(...p,...n);}}return this.buffer(new Float32Array(vertices));}
  uniform(name,type,value){const g=this.gl,loc=this.locations[name];if(type==='vec')g.uniform3fv(loc,value);else g.uniform1f(loc,value);}
  draw(batch,position,scale=[1,1,1],color=null,kind=0){const g=this.gl,m=batch.material;g.bindBuffer(g.ARRAY_BUFFER,batch.buffer);for(const[name,size,offset]of[['aPosition',3,0],['aNormal',3,12]]){const l=this.attributes[name];g.enableVertexAttribArray(l);g.vertexAttribPointer(l,size,g.FLOAT,false,24,offset);}this.uniform('uPosition','vec',position);this.uniform('uScale','vec',scale);this.uniform('uColor','vec',color||m.color||[.4,.4,.4]);this.uniform('uRough','float',m.rough==null?.7:m.rough);this.uniform('uMetal','float',m.metal||0);this.uniform('uEmission','float',m.emission||0);this.uniform('uKind','float',kind);g.drawArrays(g.TRIANGLES,0,batch.count);}
  model(name,position,color=null,scale=1){for(const b of this.models[name]||[])this.draw(b,position,[scale,scale,scale],b.material.paint?color:null);}
  project(point){const m=this.camera;if(!m)return null;const clip=[0,0,0,0];for(let r=0;r<4;r++)clip[r]=m[r]*point[0]+m[4+r]*point[1]+m[8+r]*point[2]+m[12+r];if(clip[3]<=0)return null;return{x:(clip[0]/clip[3]+1)*270,y:(1-clip[1]/clip[3])*480};}
  render(game,clock){
    if(this.status!=='ready')return false;const g=this.gl,menu=game.mode==='menu',travel=menu?clock*9:game.distance;
    const weather=atmosphere(game),night=this.night=weather.night;this.dawn=weather.dawn;this.fog=weather.fog;
    const follow=game.playerX*2.4,eye=[follow,3.3,8.8],target=[follow,1.05,-15];
    g.viewport(0,0,540,960);g.clearColor(.2,.3,.4,1);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);g.disable(g.DEPTH_TEST);g.useProgram(this.sky);g.bindBuffer(g.ARRAY_BUFFER,this.skyBuffer);const a=g.getAttribLocation(this.sky,'aPosition');g.enableVertexAttribArray(a);g.vertexAttribPointer(a,2,g.FLOAT,false,0,0);g.uniform1f(g.getUniformLocation(this.sky,'uAspect'),540/960);g.uniform1f(g.getUniformLocation(this.sky,'uNight'),night);g.uniform1f(g.getUniformLocation(this.sky,'uDawn'),weather.dawn);g.drawArrays(g.TRIANGLES,0,6);
    g.enable(g.DEPTH_TEST);g.depthFunc(g.LEQUAL);g.disable(g.CULL_FACE);g.useProgram(this.program);this.camera=cameraMatrix(eye,target,540/960);g.uniformMatrix4fv(g.getUniformLocation(this.program,'uCamera'),false,this.camera);this.uniform('uEye','vec',eye);this.uniform('uTravel','float',travel);
    this.uniform('uNight','float',night);this.uniform('uDawn','float',weather.dawn);this.uniform('uFog','float',weather.fog);this.uniform('uPlayerX','float',game.playerX*3.1);
    this.draw(this.ground,[70,-.6,-120],[65,1,190],[.025,.18,.25],2);this.draw(this.ground,[-18,-.08,-130],[14,1,200],[.19,.20,.105]);this.draw(this.ground,[6.6,-.07,-130],[2,1,200],[.40,.33,.21]);this.draw(this.ground,[0,0,-140],[4.65,1,210],null,1);
    for(let i=0;i<11;i++)this.draw(this.mountain,[-17-i*.9,0,-25-i*26],[11+i*.6,8+i*.9,22],[.28,.245,.16]);
    for(const side of[-1,1]){this.draw(this.cube,[side*4.96,.73,-130],[.12,.24,300],[.44,.44,.39]);for(let i=0;i<48;i++){const z=i*6-travel%6-15;this.draw(this.cube,[side*4.96,.40,-z],[.10,.8,.12],[.38,.39,.37]);}}
    for(let i=0;i<15;i++){const z=i*18-travel%18-8;this.model('tree',[-6.8,.02,-z],null,1.25);if(i%3===0)this.model('tree',[8.0,-.03,-z-9],null,1.1);this.model('rock',[-5.8,.0,-z-6],null,.7);}
    for(let i=0;i<9;i++){const z=i*28-travel%28-10;for(const side of[-1,1])for(const batch of this.models.streetlamp||[])this.draw(batch,[side*5.8,.02,-z],[side,1,1],null,5);}
    const cars=menu?[{x:-1,z:21},{x:1,z:36,threat:true},{x:0,z:67,kind:'barrier'}]:game.traffic;
    g.enable(g.BLEND);g.blendFunc(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA);g.depthMask(false);
    for(const car of cars){if(car.z> -5&&car.z<150)this.draw(this.ground,[car.x*3.1,.015,-car.z],[1.3,1,2.5],null,3);}
    if(!menu)this.draw(this.ground,[game.playerX*3.1,.018,0],[1.35,1,2.6],null,3);
    g.depthMask(true);g.disable(g.BLEND);
    for(const car of cars){if(car.z< -5||car.z>180)continue;const x=car.x*3.1,z=-car.z;this.model(car.kind==='barrier'?'barrier':car.threat?'player':car.id%2?'suv':'player',[x,.035,z],car.threat?[.76,.18,.035]:car.id%2?[.48,.51,.53]:[.035,.12,.30]);}
    if(!menu)this.model('player',[game.playerX*3.1,.035,0],[.012,.36,.41]);
    return true;
  }
}
module.exports=SceneRenderer;
module.exports.nightAmount=nightAmount;
module.exports.atmosphere=atmosphere;
