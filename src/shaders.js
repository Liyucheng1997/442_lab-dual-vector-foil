// ───────── GLSL ─────────
export const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 CC=vec2(1./6.,1./3.); const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,CC.yyy)); vec3 x0=v-i+dot(i,CC.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+CC.xxx; vec3 x2=x0-i2+CC.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.; vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.); m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*snoise(p);p=p*2.03+17.1;a*=.5;}return s;}
float fbm3(vec3 p){float a=.5,s=0.;for(int i=0;i<3;i++){s+=a*snoise(p);p=p*2.03+17.1;a*=.5;}return s;}
`;

// 维度跌落：与 data.js 中完全相同的公式，在 GPU 上逐顶点求解
export const COLLAPSE = /* glsl */ `
uniform float uT, uC, uA, uG;
vec3 collapse(vec3 p, out float st, out float since){
  float d=length(p);
  float k=d*uA/(uC*uC)+1.;
  float th=(uC/uA)*sqrt(max(k*k-1.,0.));
  float tau=uT-th; st=0.; since=0.;
  if(tau<=0.) return p;
  float h=abs(p.y);
  float q=uG*tau/uC;
  float dr=(uC*uC/uG)*(sqrt(1.+q*q)-1.);
  if(dr<h){ st=1.; since=tau; p.y=sign(p.y)*(h-dr); return p; }
  float kk=h*uG/(uC*uC)+1.;
  since=tau-(uC/uG)*sqrt(max(kk*kk-1.,0.));
  st=2.; p.y=0.; return p;
}
`;

export const BODY_VERT = /* glsl */ `
varying vec3 vObj, vWorld, vN;
void main(){
  vObj=position;
  vec4 w=modelMatrix*vec4(position,1.);
  vWorld=w.xyz;
  vN=normalize(mat3(modelMatrix)*normal);
  gl_Position=projectionMatrix*viewMatrix*w;
}
`;

// 行星 / 恒星表面（全程序化）。uType: 0 岩石  1 地球  2 条带大气  3 恒星
export const BODY_FRAG = /* glsl */ `
${NOISE}
uniform int uType;
uniform vec3 uC1,uC2,uC3,uAtm,uCut,uSunPos;
uniform float uClipSign,uTime,uSeed,uBands,uSpot;
varying vec3 vObj,vWorld,vN;
void main(){
  if(vWorld.y*uClipSign<0.) discard;               // 已经落入平面的部分不再存在于三维
  if(!gl_FrontFacing){ gl_FragColor=vec4(uCut*.55,1.); return; }   // 截面：正在被"展开"的炽热内部
  vec3 n=normalize(vObj);
  vec3 N=normalize(vN);
  vec3 V=normalize(cameraPosition-vWorld);
  vec3 L=normalize(uSunPos-vWorld);
  float ndl=dot(N,L);
  vec3 col; float spec=0.;
  if(uType==3){
    float f=fbm(n*4.+vec3(0.,uTime*.04,0.))+.5*fbm(n*13.-vec3(uTime*.06));
    float cell=snoise(n*30.+uTime*.1);
    col=mix(uC1,uC2,clamp(f*.6+.5,0.,1.));
    col=mix(col,uC3,smoothstep(.45,.9,-f)*.6);
    col*=2.3+.5*cell;
    float mu=max(dot(N,V),0.);
    col*=.45+.55*pow(mu,.5);
    gl_FragColor=vec4(col,1.); return;
  }
  if(uType==0){
    float f=fbm(n*3.+uSeed); float f2=fbm(n*9.+uSeed*2.);
    col=mix(uC2,uC1,smoothstep(-.35,.4,f));
    col*=.8+.4*f2;
    float cr=smoothstep(.5,.75,snoise(n*15.+uSeed));
    col*=1.-.3*cr;
    if(uC3.r>.01){ float cap=smoothstep(.84,.9,abs(n.y)+.06*f2); col=mix(col,uC3,cap); }
  } else if(uType==1){
    float c=fbm(n*2.1+uSeed)+.35*fbm(n*7.+3.);
    float land=smoothstep(.03,.09,c);
    float lat=abs(n.y);
    vec3 lc=mix(uC2,uC3,smoothstep(.15,.55,c+.3*(1.-lat)*snoise(n*5.)));
    vec3 oc=mix(uC1*.55,uC1*1.5+vec3(0.,.08,.1),smoothstep(-.5,.03,c));
    col=mix(oc,lc,land);
    float ice=smoothstep(.8,.88,lat+.07*snoise(n*6.));
    col=mix(col,vec3(.93,.96,1.),ice);
    vec3 cp=n*3.5+vec3(uTime*.01,0.,0.); cp+=.35*vec3(snoise(cp*1.3),snoise(cp*1.3+9.),snoise(cp*1.3+5.));
    float cl=smoothstep(.05,.55,fbm(cp));
    col=mix(col,vec3(1.),cl*.85);
    vec3 H=normalize(L+V); spec=pow(max(dot(N,H),0.),60.)*(1.-land)*(1.-cl)*.8;
    float night=smoothstep(.05,-.2,ndl)*land*(1.-cl)*smoothstep(.55,.8,snoise(n*40.));
    gl_FragColor.rgb=vec3(1.,.75,.4)*night*.6;
  } else {
    float lat=n.y;
    float w=fbm3(n*vec3(2.,7.,2.)+uSeed)*.09+fbm3(n*9.+uSeed)*.025;
    float b=(lat+w)*uBands;
    float s=sin(b*3.14159);
    col=mix(uC2,uC1,smoothstep(-.7,.7,s));
    float t=fbm3(vec3(n.x*4.,lat*uBands*3.,n.z*4.)+uSeed+w*6.);
    col=mix(col,uC3,smoothstep(.1,.8,t)*.45);
    col*=.92+.12*sin(b*9.4);
    if(uSpot>.5){
      vec3 sc=normalize(vec3(.75,-.36,.55));
      vec3 dd=n-sc; float e=length(vec3(dd.x,dd.y*2.1,dd.z));
      float sp=smoothstep(.2,.1,e);
      col=mix(col,vec3(.72,.27,.14),sp*.85);
    }
  }
  float diff=smoothstep(-.08,.0,ndl)*max(ndl,0.)*1.35+.018;
  vec3 outc=col*diff+vec3(spec)*smoothstep(0.,.2,ndl);
  float rim=pow(1.-max(dot(N,V),0.),3.2);
  outc+=uAtm*rim*smoothstep(-.25,.35,ndl)*.9;
  if(uType==1) outc+=gl_FragColor.rgb;
  gl_FragColor=vec4(outc,1.);
}
`;

export const RING_FRAG = /* glsl */ `
${NOISE}
uniform vec3 uC1,uSunPos,uCenter; uniform float uClipSign,uRad;
varying vec3 vObj,vWorld,vN;
void main(){
  if(vWorld.y*uClipSign<0.) discard;
  float r=length(vObj.xy);
  float x=(r-1.25)/1.05;
  float d=.6+.35*snoise(vec3(r*42.,0.,3.))+.25*snoise(vec3(r*11.,1.,0.));
  float a=smoothstep(0.,.03,x)*smoothstep(1.,.95,x)*clamp(d,0.05,1.);
  a*=1.-.93*smoothstep(.03,.012,abs(x-.63));
  a*=.55+.45*smoothstep(.0,.3,x);
  vec3 L=normalize(uSunPos-vWorld);
  float lit=.45+.55*abs(dot(normalize(vN),L));
  // 行星本体投在光环上的影子
  vec3 c=vWorld-uCenter;
  float rr=uRad;
  float along=dot(c,-L); float perp=length(c+L*along);
  float sh=1.-smoothstep(rr*1.02,rr*.94,perp)*step(0.,along)*.85;
  gl_FragColor=vec4(uC1*(.75+.35*d)*lit*sh,a*.92);
}
`;

// 二维画：把球体的每一个同心壳层按"体积 → 面积"铺成同心环（年轮）
export const DISC_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv=position.xz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }
`;
export const DISC_FRAG = /* glsl */ `
${NOISE}
uniform int uKind;                 // 0 行星  1 恒星  2 光环
uniform vec3 uCol[5]; uniform vec4 uB; uniform vec3 uSurf,uHot;
uniform float uTime,uHeat,uSeed,uRings;
varying vec2 vUv;
vec3 layer(float w){
  float e=.012;
  vec3 c=uCol[0];
  c=mix(c,uCol[1],smoothstep(uB.x-e,uB.x+e,w));
  c=mix(c,uCol[2],smoothstep(uB.y-e,uB.y+e,w));
  c=mix(c,uCol[3],smoothstep(uB.z-e,uB.z+e,w));
  c=mix(c,uCol[4],smoothstep(uB.w-e,uB.w+e,w));
  return c;
}
void main(){
  float s=length(vUv)*1.25;
  vec2 dir=vUv/max(length(vUv),1e-5);
  float edge=1.+.03*snoise(vec3(dir*4.,uSeed))+.012*snoise(vec3(dir*13.,uSeed+2.));
  float sr=s/edge;
  if(sr>1.){
    float g=exp(-(sr-1.)*16.)*uHeat;
    if(g<.004) discard;
    gl_FragColor=vec4(uHot*g*.9,g*.8); return;
  }
  if(uKind==2){
    if(sr<.52) discard;
    float x=(sr-.52)/.48;
    float d=.6+.35*snoise(vec3(sr*90.,uSeed,3.))+.25*snoise(vec3(sr*25.,1.,uSeed));
    float a=smoothstep(0.,.04,x)*clamp(d,.05,1.)*(1.-.9*smoothstep(.03,.012,abs(x-.63)));
    vec3 c=uCol[4]*(.6+.3*d)+uHot*uHeat*pow(sr,10.)*.6;
    gl_FragColor=vec4(c,a*.85); return;
  }
  float rho=pow(sr,2./3.);       // 面积占比 s² ↔ 体积占比 ρ³
  float w=rho+.022*snoise(vec3(vUv*5.,uSeed+3.))+.01*snoise(vec3(vUv*17.,uSeed));
  vec3 col=layer(w);
  float ring=sin(w*uRings*6.2832+2.5*snoise(vec3(vUv*3.,uSeed+7.)));
  col*=.84+.2*ring;
  float streak=snoise(vec3(dir*16.,rho*2.5+uSeed));
  col*=1.+.14*streak*smoothstep(.15,.7,rho);
  float sf=smoothstep(.0,.35,snoise(vec3(vUv*8.,uSeed+11.))+.4*snoise(vec3(vUv*24.,uSeed)));
  col=mix(col,uSurf,sf*step(uB.w,w)*.85);
  if(uKind==1){
    float a=2.2/(.35+sr)+uTime*.12;
    mat2 R=mat2(cos(a),-sin(a),sin(a),cos(a));
    vec2 p=R*vUv*3.2;
    float n=fbm(vec3(p*1.6,uTime*.05+uSeed));
    float n2=fbm3(vec3(R*vUv*9.,uTime*.08));
    vec3 fire=mix(vec3(1.,.32,.04),vec3(1.,.93,.6),smoothstep(-.5,.6,n+.4*n2));
    col=mix(col,fire,.7)*(1.25+.5*n2)*(1.35-.5*sr);
    col+=vec3(1.,.5,.15)*pow(sr,5.)*.6;
    gl_FragColor=vec4(col,1.); return;
  }
  col*=.78;
  col+=uHot*uHeat*(pow(sr,9.)*.8+.02);
  gl_FragColor=vec4(col,1.);
}
`;

// 尘埃 / 小行星带 / 柯伊伯带
export const DUST_VERT = /* glsl */ `
${COLLAPSE}
attribute float aSize; attribute vec3 aTint;
uniform float uPx;
varying vec3 vCol; varying float vA;
void main(){
  float st,since; vec3 p=collapse(position,st,since);
  vec3 col=aTint; float a=.55; float sz=aSize;
  if(st>.5&&st<1.5){ col=mix(aTint,vec3(.55,.85,1.7),.8); a=.95; sz*=1.5; }
  else if(st>1.5){ float fl=exp(-since*5.); col=mix(vec3(1.,.72,.36)*.8,vec3(2.4,2.1,1.6),fl); a=.7+.3*fl; sz*=1.+1.6*fl; }
  vec4 mv=viewMatrix*vec4(p,1.);
  gl_Position=projectionMatrix*mv;
  float s=sz*uPx/max(-mv.z,.01);
  gl_PointSize=clamp(s,1.,6.);
  vA=a*clamp(s,.28,1.); vCol=col;
}
`;
export const DUST_FRAG = /* glsl */ `
varying vec3 vCol; varying float vA;
void main(){
  float d=length(gl_PointCoord-.5);
  float a=smoothstep(.5,.1,d)*vA;
  gl_FragColor=vec4(vCol*a,a);
}
`;

export const ORBIT_VERT = /* glsl */ `
${COLLAPSE}
varying float vSt;
void main(){
  float st,since; vec3 p=collapse(position,st,since);
  vSt=st; gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);
}
`;
export const ORBIT_FRAG = /* glsl */ `
uniform vec3 uColor; varying float vSt;
void main(){
  vec3 c=mix(uColor,vec3(1.,.74,.4),smoothstep(.2,1.8,vSt));
  gl_FragColor=vec4(c,.32+.2*smoothstep(.2,1.8,vSt));
}
`;

// 二维平面本身
export const SHEET_VERT = /* glsl */ `
varying vec3 vW;
void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }
`;
export const SHEET_FRAG = /* glsl */ `
uniform float uR,uTime;
varying vec3 vW;
void main(){
  float r=length(vW.xz);
  if(r>uR) discard;
  vec2 gc=vW.xz/10.;
  vec2 fw=fwidth(gc);
  vec2 g=abs(fract(gc-.5)-.5)/max(fw,1e-5);
  float line=(1.-min(min(g.x,g.y),1.))*clamp(1.-max(fw.x,fw.y)*5.,0.,1.);
  float wd=max(.6,uR*.018);
  float rim=exp(-(uR-r)/wd);
  float wave=.5+.5*sin((uR-r)*(4./wd)-uTime*4.);
  float glow=exp(-(uR-r)/(wd*7.));
  vec3 col=vec3(.012,.03,.07)+vec3(.12,.26,.5)*line*.3;
  col+=vec3(.5,.85,1.6)*rim*(1.2+.8*wave)+vec3(.1,.25,.6)*glow*.5;
  gl_FragColor=vec4(col,.62+.38*rim);
}
`;

export const FRESNEL_VERT = /* glsl */ `
varying vec3 vWorld,vN;
void main(){ vec4 w=modelMatrix*vec4(position,1.); vWorld=w.xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w; }
`;
export const FRESNEL_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uPow,uAmp;
varying vec3 vWorld,vN;
void main(){
  vec3 V=normalize(cameraPosition-vWorld);
  float f=pow(1.-abs(dot(normalize(vN),V)),uPow)*uAmp;
  gl_FragColor=vec4(uColor*f,f);
}
`;

export const SKY_FRAG = /* glsl */ `
${NOISE}
varying vec3 vObj;
void main(){
  vec3 d=normalize(vObj);
  float b=dot(d,normalize(vec3(.35,.8,.48)));
  float band=exp(-b*b*14.);
  float n=fbm(d*3.2)*.5+.5;
  float lanes=smoothstep(-.25,.45,fbm(d*7.+4.));
  vec3 col=vec3(.035,.04,.07)*band*(.35+n)*lanes+vec3(.05,.03,.02)*band*band*n;
  col+=vec3(.004,.005,.01);
  gl_FragColor=vec4(col,1.);
}
`;
export const SKY_VERT = /* glsl */ `
varying vec3 vObj; void main(){ vObj=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }
`;

export const STAR_VERT = /* glsl */ `
attribute float aSize; attribute vec3 aTint; varying vec3 vCol;
void main(){ vCol=aTint; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); gl_PointSize=aSize; }
`;
export const STAR_FRAG = /* glsl */ `
varying vec3 vCol;
void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,.0,d); gl_FragColor=vec4(vCol*a,1.); }
`;

// 海洋冻结成的二维雪花
export const FLAKE_VERT = /* glsl */ `
attribute float aSize; attribute float aPhase;
uniform float uGrow,uPx; varying float vA; varying float vRot;
void main(){
  float g=clamp(uGrow*1.6-aPhase*.6,0.,1.);
  vec4 mv=modelViewMatrix*vec4(position,1.);
  gl_Position=projectionMatrix*mv;
  gl_PointSize=clamp(aSize*g*uPx/max(-mv.z,.01),0.,90.);
  vA=g; vRot=aPhase*6.2832;
}
`;
export const FLAKE_FRAG = /* glsl */ `
varying float vA; varying float vRot;
void main(){
  if(vA<=0.) discard;
  vec2 p=gl_PointCoord*2.-1.;
  float r=length(p);
  float a=atan(p.y,p.x)+vRot;
  a=mod(a,1.0471976)-.5235988;
  vec2 q=r*vec2(cos(a),sin(a));
  float arm=smoothstep(.07,.015,abs(q.y));
  float br=smoothstep(.06,.01,abs(abs(q.y)-fract(q.x*3.5)*.24))*step(.22,q.x);
  float al=max(arm,br*.8)*smoothstep(1.,.8,r);
  if(al<.02) discard;
  gl_FragColor=vec4(vec3(.8,.93,1.25)*al*vA,al*vA);
}
`;
