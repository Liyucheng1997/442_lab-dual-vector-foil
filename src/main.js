import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import * as S from './shaders.js';
import { AU, C, A, G, T_END, SUN_POS, BODIES, body, bodyState, frontR, frontV, eclToWorld } from './data.js';

// ───────── 渲染器 ─────────
const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
stage.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer({ element: document.getElementById('labels') });

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 14000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.4;
controls.maxDistance = 2500;
controls.enablePan = false;

const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.55, 0.6, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// 所有材质共享的 uniform
const U = {
  uT: { value: 0 }, uTime: { value: 0 }, uC: { value: C }, uA: { value: A }, uG: { value: G },
  uPx: { value: 600 }, uSunPos: { value: new THREE.Vector3(...SUN_POS) },
};
const col = (hex) => new THREE.Color(hex);
const rnd = (() => { let s = 20260711; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 0.87;

// ───────── 星空 ─────────
const sky = new THREE.Group();
scene.add(sky);
sky.add(new THREE.Mesh(
  new THREE.SphereGeometry(6000, 48, 32),
  new THREE.ShaderMaterial({ vertexShader: S.SKY_VERT, fragmentShader: S.SKY_FRAG, side: THREE.BackSide, depthWrite: false }),
));
{
  const N = 9000, pos = new Float32Array(N * 3), size = new Float32Array(N), tint = new Float32Array(N * 3);
  const mw = new THREE.Vector3(0.35, 0.8, 0.48).normalize();
  const v = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    do { v.set(gauss(), gauss(), gauss()).normalize(); } while (i % 3 === 0 && Math.abs(v.dot(mw)) > 0.22 * rnd() + 0.03);
    pos.set([v.x * 5500, v.y * 5500, v.z * 5500], i * 3);
    const m = Math.pow(rnd(), 6);
    size[i] = (1.1 + m * 3.2) * renderer.getPixelRatio();
    const k = 0.25 + m * 1.6 + rnd() * 0.3, w = rnd();
    tint.set([k * (0.8 + 0.4 * w), k * 0.9, k * (1.2 - 0.4 * w)], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aTint', new THREE.BufferAttribute(tint, 3));
  sky.add(new THREE.Points(g, new THREE.ShaderMaterial({
    vertexShader: S.STAR_VERT, fragmentShader: S.STAR_FRAG, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  })));
}

// ───────── 尘埃、小行星带、柯伊伯带（三维空间的"质感"）─────────
{
  const pos = [], size = [], tint = [], w = [0, 0, 0];
  const add = (p, s, c) => { pos.push(p[0], p[1], p[2]); size.push(s); tint.push(c[0], c[1], c[2]); };
  for (let i = 0; i < 70000; i++) {          // 行星际尘埃
    const r = 660 * Math.sqrt(rnd()), a = rnd() * 6.2832;
    eclToWorld(r * Math.cos(a), gauss() * (10 + r * 0.05), r * Math.sin(a), w);
    add(w, 0.12 + rnd() * 0.2, [0.3, 0.38, 0.55]);
  }
  for (let i = 0; i < 9000; i++) {           // 二向箔附近
    const r = 46 * Math.pow(rnd(), 0.6), a = rnd() * 6.2832, e = Math.acos(2 * rnd() - 1);
    add([r * Math.sin(e) * Math.cos(a), r * Math.cos(e) * 0.7, r * Math.sin(e) * Math.sin(a)], 0.05 + rnd() * 0.09, [0.4, 0.48, 0.66]);
  }
  for (let i = 0; i < 5000; i++) {           // 内太阳系
    const r = 26 * Math.sqrt(rnd()), a = rnd() * 6.2832;
    eclToWorld(r * Math.cos(a), gauss() * 2.5, r * Math.sin(a), w);
    add(w, 0.04 + rnd() * 0.06, [0.42, 0.44, 0.52]);
  }
  for (let i = 0; i < 7000; i++) {           // 小行星带 2.1–3.3 AU
    const r = (2.1 + 1.2 * rnd()) * AU, a = rnd() * 6.2832;
    eclToWorld(r * Math.cos(a), gauss() * 1.4, r * Math.sin(a), w);
    add(w, 0.05 + rnd() * 0.08, [0.72, 0.6, 0.46]);
  }
  for (let i = 0; i < 16000; i++) {          // 柯伊伯带 30–50 AU
    const r = (30 + 20 * Math.pow(rnd(), 1.4)) * AU, a = rnd() * 6.2832;
    eclToWorld(r * Math.cos(a), gauss() * 22, r * Math.sin(a), w);
    add(w, 0.3 + rnd() * 0.5, [0.5, 0.66, 0.85]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
  g.setAttribute('aTint', new THREE.Float32BufferAttribute(tint, 3));
  const m = new THREE.ShaderMaterial({
    uniforms: U, vertexShader: S.DUST_VERT, fragmentShader: S.DUST_FRAG,
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false; p.renderOrder = 5;
  scene.add(p);
}

// ───────── 二维平面、坍缩前沿、二向箔 ─────────
const sheetU = { uR: { value: 0 }, uTime: U.uTime };
const sheet = new THREE.Mesh(
  new THREE.CircleGeometry(1, 256).rotateX(-Math.PI / 2),
  new THREE.ShaderMaterial({ uniforms: sheetU, vertexShader: S.SHEET_VERT, fragmentShader: S.SHEET_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
);
sheet.renderOrder = 1; sheet.frustumCulled = false;
scene.add(sheet);

const fresnelMat = (c, pow, amp) => new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Color(...c) }, uPow: { value: pow }, uAmp: { value: amp } },
  vertexShader: S.FRESNEL_VERT, fragmentShader: S.FRESNEL_FRAG,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
});
const front = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), fresnelMat([0.35, 0.6, 1.0], 3.5, 0.5));
front.renderOrder = 6; front.frustumCulled = false;
scene.add(front);

const foilMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.15, 1.2, 1.4), transparent: true, side: THREE.DoubleSide, depthWrite: false });
const foil = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.26), foilMat);
const field = new THREE.Mesh(new THREE.SphereGeometry(0.5, 64, 48), fresnelMat([0.4, 0.6, 1.0], 2.6, 0.6));
scene.add(foil, field);

// ───────── 轨道线 ─────────
for (const b of BODIES) {
  if (!b.a || b.parent) continue;
  const N = 720, pos = new Float32Array(N * 3), w = [0, 0, 0];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * 6.2832;
    eclToWorld(b.a * AU * Math.cos(a), 0, b.a * AU * Math.sin(a), w);
    pos.set(w, i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const line = new THREE.LineLoop(g, new THREE.ShaderMaterial({
    uniforms: { ...U, uColor: { value: new THREE.Color(0.32, 0.42, 0.62) } },
    vertexShader: S.ORBIT_VERT, fragmentShader: S.ORBIT_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  line.frustumCulled = false; line.renderOrder = 4;
  scene.add(line);
}

// ───────── 天体 ─────────
const sphereGeo = new THREE.SphereGeometry(1, 128, 96);
const discGeo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
const HOT = new THREE.Color(1.6, 1.25, 0.8);

function makeDisc(b, kind, order, seed) {
  const L = b.layers;
  const u = {
    uKind: { value: kind }, uCol: { value: L.cols.map(col) }, uB: { value: new THREE.Vector4(...L.b) },
    uSurf: { value: col(L.surf || L.cols[4]) }, uHot: { value: HOT }, uTime: U.uTime,
    uHeat: { value: 0 }, uSeed: { value: seed }, uRings: { value: kind === 1 ? 5 : 9 + b.r * 8 },
  };
  const m = new THREE.Mesh(discGeo, new THREE.ShaderMaterial({
    uniforms: u, vertexShader: S.DISC_VERT, fragmentShader: S.DISC_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }));
  m.renderOrder = order; m.visible = false; m.frustumCulled = false;
  scene.add(m);
  return m;
}

BODIES.forEach((b, i) => {
  const sf = b.surf, seed = 3.7 + i * 11.3;
  b.u = {
    uType: { value: sf.type }, uC1: { value: col(sf.c1) }, uC2: { value: col(sf.c2) }, uC3: { value: col(sf.c3) },
    uAtm: { value: col(sf.atm || '#000000') }, uCut: { value: new THREE.Color(...sf.cut) },
    uSunPos: U.uSunPos, uClipSign: { value: b.sgn }, uTime: U.uTime, uSeed: { value: seed },
    uBands: { value: sf.bands || 0 }, uSpot: { value: sf.spot || 0 },
  };
  b.holder = new THREE.Group();
  b.holder.rotation.z = (b.tilt * Math.PI) / 180;
  b.holder.rotation.y = i * 1.3;
  b.mesh = new THREE.Mesh(sphereGeo, new THREE.ShaderMaterial({ uniforms: b.u, vertexShader: S.BODY_VERT, fragmentShader: S.BODY_FRAG, side: THREE.DoubleSide }));
  b.mesh.scale.setScalar(b.r);
  b.holder.add(b.mesh);
  scene.add(b.holder);

  if (b.rings) {
    b.ringU = { uC1: { value: col('#d8c49a') }, uSunPos: U.uSunPos, uCenter: { value: new THREE.Vector3() }, uClipSign: { value: b.sgn }, uRad: { value: b.r } };
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.25, 2.3, 192, 1), new THREE.ShaderMaterial({
      uniforms: b.ringU, vertexShader: S.BODY_VERT, fragmentShader: S.RING_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    }));
    ring.rotation.x = Math.PI / 2;
    b.mesh.add(ring);
    b.ringDisc = makeDisc(b, 2, 2, seed + 5);
  }
  b.disc = makeDisc(b, b.layers.kind || 0, b.id === 'sun' ? 2 : 3, seed);

  const el = document.createElement('div');
  el.className = 'label'; el.textContent = b.name;
  b.labelEl = el;
  b.anchor = new THREE.Object3D();
  b.anchor.add(new CSS2DObject(el));
  scene.add(b.anchor);
  b.st = { x: 0, y: 0, z: 0, phase: 0, p: 0, f: 0 };
});

// 日冕
const corona = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d'), g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,220,160,1)'); g.addColorStop(0.16, 'rgba(255,170,80,0.75)');
  g.addColorStop(0.3, 'rgba(255,120,40,0.22)'); g.addColorStop(0.6, 'rgba(255,90,30,0.05)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  s.scale.setScalar(body('sun').r * 9);
  scene.add(s);
  return s;
})();

// 地球海洋 → 二维雪花
const earth = body('earth');
const flakeU = { uGrow: { value: 0 }, uPx: U.uPx };
{
  const N = 420, pos = new Float32Array(N * 3), size = new Float32Array(N), ph = new Float32Array(N);
  const R0 = earth.r * earth.S;
  for (let i = 0; i < N; i++) {
    const r = R0 * (1.04 + 1.7 * Math.pow(rnd(), 1.6)), a = rnd() * 6.2832;
    pos.set([earth.pHit[0] + r * Math.cos(a), 0, earth.pHit[2] + r * Math.sin(a)], i * 3);
    size[i] = 0.06 + 0.3 * Math.pow(rnd(), 3); ph[i] = rnd();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
  const p = new THREE.Points(g, new THREE.ShaderMaterial({
    uniforms: flakeU, vertexShader: S.FLAKE_VERT, fragmentShader: S.FLAKE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  p.frustumCulled = false; p.renderOrder = 4;
  scene.add(p);
}

// ───────── 导演：镜头与时间流速 ─────────
const featured = BODIES.filter((b) => b.feature).sort((a, b) => a.tContact - b.tContact);
const shots = [];
{
  let cur = 0;
  for (const b of featured) {
    const s = Math.max(cur, b.tContact - 0.5), e = b.tDone + (b.id === 'sun' ? 0.45 : 0.03);
    if (e - s < 0.2) continue;
    if (s > cur + 0.01) shots.push({ t0: cur, t1: s, wide: true });
    shots.push({ t0: s, t1: e, b });
    cur = e;
  }
  shots.push({ t0: cur, t1: T_END + 1, wide: true, final: true });
}
const shotAt = (t) => shots.find((s) => t < s.t1) || shots[shots.length - 1];
const smooth = (a, b, x) => { const k = Math.min(Math.max((x - a) / (b - a), 0), 1); return k * k * (3 - 2 * k); };
const FINAL_FOCUS = new THREE.Vector3(170, 0, 0);

function shotParams(t, out) {
  const s = shotAt(t);
  if (s.b) {
    const b = s.b, st = b.st, big = b.id === 'sun';
    const k = smooth(b.tContact - 0.05, b.tContact + b.flat * 0.6, t);
    out.focus.set(st.x, st.phase >= 2 ? 0 : st.y, st.z);
    out.dist = THREE.MathUtils.lerp(b.r * (big ? 7 : 8), big ? 24 : b.r * b.S * (b.rings ? 8 : 3.4), k);
    out.el = b.sgn * THREE.MathUtils.lerp(0.3, 0.72, k);
    out.az = big ? -2.3 : Math.atan2(SUN_POS[2] - st.z, SUN_POS[0] - st.x) + 0.75;
    out.rate = t < b.tContact - 0.06 ? 0.3 : t < b.tDone ? b.flat / (big ? 13 : 6.5) : 0.15;
    out.id = b.id;
  } else if (s.final) {
    out.focus.copy(FINAL_FOCUS); out.dist = 1050; out.el = 1.08; out.az = -1.9; out.rate = 0.8; out.id = null;
  } else if (s.t0 === 0) {
    out.focus.set(0, 0, 0);
    out.dist = Math.min(3.4 + frontR(t) * 2.3, 420); out.el = 0.42; out.az = -2.25 + t * 0.08;
    out.rate = t < 0.9 ? 0.22 : 0.9; out.id = null;
  } else {
    out.focus.set(120, 0, 0); out.dist = 560; out.el = 0.6; out.az = -2.0; out.rate = 0.7; out.id = null;
  }
  return out;
}

// ───────── 状态 ─────────
let t = 0, playing = false, started = false, speedMul = 1, director = true, focusId = null;
const cam = { az: -2.25, el: 0.3, dist: 3.4, focus: new THREE.Vector3() };
const sp = { focus: new THREE.Vector3(), dist: 3, el: 0, az: 0, rate: 0, id: null };
const tmpV = new THREE.Vector3();

const $ = (id) => document.getElementById(id);
const ui = {
  t: $('tm-t'), r: $('tm-r'), v: $('tm-v'), rate: $('tm-rate'), vbar: $('tm-vbar'),
  scrub: $('scrub'), play: $('btn-play'), dir: $('btn-director'), cap: $('caption'), list: $('bodies'),
};

// 天体列表
for (const b of [...BODIES].sort((x, y) => x.tContact - y.tContact)) {
  const btn = document.createElement('button');
  btn.innerHTML = `<i></i>${b.name}<em>三维</em>`;
  btn.onclick = () => { setDirector(false); focusOn(b.id); };
  ui.list.appendChild(btn);
  b.btn = btn; b.em = btn.querySelector('em');
  const tick = document.createElement('span');
  tick.style.left = `${(b.tContact / T_END) * 100}%`;
  if (b.feature) tick.innerHTML = `<b>${b.name}</b>`;
  $('ticks').appendChild(tick);
}

// 解说
const N = (id) => body(id);
const captions = [
  [0.01, '封装力场解除。二向箔接触到三维空间，一个维度开始向微观蜷缩。'],
  [0.9, '空间自己向平面跌落，像瀑布落进深渊，带走其中的每一粒尘埃。'],
  [2.6, '二维平面的边缘持续加速，逼近光速。坍缩区内，逃逸速度就是光速。'],
  [N('neptune').tContact - 0.45, '海王星被前沿追上，连同周围的空间一起坠向平面。'],
  [N('neptune').tContact + 0.05, '它不是被压扁，而是被展开：内核落在画心，冰幔与大气一圈圈向外，像年轮。'],
  [N('saturn').tContact - 0.3, '土星和它的光环，被画进同一张平面。'],
  [N('jupiter').tContact - 0.3, '木星。落入二维的物质把多余的能量化成光，画的边缘因此发亮。'],
  [N('earth').tContact - 0.2, '地球。地核、地幔、大陆与海洋，每一个三维细节都在二维上铺开。'],
  [N('earth').tDone - 0.05, '海水在二维中凝结，成为环绕地球的巨大雪花。'],
  [N('sun').tContact + 0.75, '太阳正在二维化。一颗恒星，变成一幅燃烧的画。'],
  [N('uranus').tContact - 0.3, '天王星。前沿此刻的速度已超过光速的六成。'],
  [N('pluto').tContact - 0.3, '冥王星，太阳系边缘最后的见证者。'],
  [N('pluto').tDone + 0.3, '整个太阳系，成了一幅厚度为零的画。'],
].sort((a, b) => a[0] - b[0]);
let capIdx = -2, capShownAt = 0;

function setDirector(on) {
  director = on;
  ui.dir.classList.toggle('on', on);
  if (on) {
    tmpV.copy(camera.position).sub(cam.focus);
    cam.dist = tmpV.length(); cam.el = Math.asin(tmpV.y / cam.dist); cam.az = Math.atan2(tmpV.z, tmpV.x);
    setFocus(null);
  }
}
function setFocus(id) {
  focusId = id;
  for (const b of BODIES) b.btn.classList.toggle('focus', b.id === id);
}
function focusOn(id) {
  setFocus(id);
  const b = body(id);
  tmpV.set(b.st.x, b.st.phase >= 2 ? 0 : b.st.y, b.st.z);
  const dir = camera.position.clone().sub(controls.target).normalize();
  if (Math.abs(dir.y) < 0.25) { dir.y = 0.35 * b.sgn; dir.normalize(); }
  cam.focus.copy(tmpV); controls.target.copy(tmpV);
  camera.position.copy(tmpV).addScaledVector(dir, b.r * (b.st.phase >= 2 ? b.S * 3.4 : 8));
}
controls.addEventListener('start', () => { if (director) setDirector(false); });

$('btn-start').onclick = () => { started = true; playing = true; $('intro').classList.add('gone'); };
ui.play.onclick = () => {
  if (!started) return $('btn-start').click();
  if (t >= T_END) t = 0;
  playing = !playing;
};
ui.dir.onclick = () => setDirector(!director);
$('btn-top').onclick = () => {
  setDirector(false); setFocus(null);
  cam.focus.copy(FINAL_FOCUS); controls.target.copy(FINAL_FOCUS);
  camera.position.set(FINAL_FOCUS.x - 60, 1100, 220);
};
$('btn-info').onclick = () => $('info').classList.toggle('hidden');
$('info-close').onclick = () => $('info').classList.add('hidden');
$('btn-reset').onclick = () => { t = 0; playing = started; capIdx = -2; setDirector(true); };
ui.scrub.max = T_END;
ui.scrub.oninput = () => { t = +ui.scrub.value; if (!started) $('btn-start').click(); };
for (const btn of document.querySelectorAll('#speed button')) {
  btn.onclick = () => {
    speedMul = +btn.dataset.s;
    document.querySelectorAll('#speed button').forEach((x) => x.classList.toggle('on', x === btn));
  };
}
addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); ui.play.click(); } });

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h); composer.setSize(w, h); labelRenderer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  U.uPx.value = (h * renderer.getPixelRatio()) / (2 * Math.tan((camera.fov * Math.PI) / 360));
}
addEventListener('resize', resize);
resize();

// ───────── 每帧 ─────────
const PHASE = ['三维', '跌落中', '', '已成画'];
function updateWorld() {
  U.uT.value = t;
  const R = frontR(t);
  sheetU.uR.value = R;
  sheet.scale.setScalar(Math.max(R, 1e-4)); sheet.visible = R > 0;
  front.scale.setScalar(Math.max(R, 1e-4)); front.visible = R > 0;
  front.material.uniforms.uAmp.value = 0.5 * (1 - smooth(T_END - 3, T_END, t) * 0.7);

  foilMat.opacity = 1 - smooth(0.15, 1.0, t);
  foil.visible = foilMat.opacity > 0.01;
  const fk = smooth(0, 0.35, t);
  field.scale.setScalar(1 + fk * 5); field.material.uniforms.uAmp.value = 0.6 * (1 - fk); field.visible = fk < 1;

  for (const b of BODIES) {
    const st = bodyState(b, t, b.st);
    b.holder.position.set(st.x, st.y, st.z);
    b.holder.visible = st.phase < 3;
    b.mesh.rotation.y = (2 * Math.PI * Math.min(t, b.tContact)) / b.rot;
    const flat = st.phase >= 2;
    const heat = st.phase === 2 ? 1 : st.phase === 3 ? Math.exp(-(t - b.tDone) / 0.5) : 0;
    const rd = b.r * b.S * Math.sqrt(st.f);
    b.disc.visible = flat && st.f > 1e-5;
    b.disc.position.set(st.x, 0, st.z);
    b.disc.scale.setScalar(Math.max(rd * 1.25, 1e-4));
    b.disc.material.uniforms.uHeat.value = heat;
    if (b.ringDisc) {
      b.ringDisc.visible = b.disc.visible;
      b.ringDisc.position.copy(b.disc.position);
      b.ringDisc.scale.setScalar(Math.max(rd * 2.1 * 1.25, 1e-4));
      b.ringDisc.material.uniforms.uHeat.value = heat;
      b.ringU.uCenter.value.set(st.x, st.y, st.z);
    }
    b.anchor.position.set(st.x, flat ? 0 : st.y + b.sgn * b.r * 0.2, st.z);
    b.labelEl.classList.toggle('flat', st.phase === 3);
    const cls = 'p' + st.phase + (focusId === b.id ? ' focus' : '');
    if (b.btn.className !== cls) b.btn.className = cls;
    const txt = st.phase === 2 ? `${Math.round(st.f * 100)}%` : PHASE[st.phase];
    if (b.em.textContent !== txt) b.em.textContent = txt;
  }
  const sun = body('sun');
  U.uSunPos.value.set(sun.st.x, Math.max(sun.st.y, 0), sun.st.z);
  corona.position.copy(sun.holder.position);
  corona.material.opacity = 1 - sun.st.p; corona.visible = sun.st.p < 1;
  flakeU.uGrow.value = smooth(earth.tDone - 0.1, earth.tDone + 0.9, t);
}

function updateHUD(rate) {
  const h = Math.floor(t), m = Math.floor((t - h) * 60);
  ui.t.textContent = `T+ ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  ui.r.textContent = `${(frontR(t) / AU).toFixed(2)} AU`;
  const beta = frontV(t) / C;
  ui.v.textContent = `${beta.toFixed(3)} c`;
  ui.vbar.style.width = `${beta * 100}%`;
  ui.rate.textContent = playing ? `${(rate * 60).toFixed(0)} 分钟 / 秒` : '已暂停';
  if (document.activeElement !== ui.scrub) ui.scrub.value = t;
  ui.play.textContent = playing ? '暂停' : t >= T_END ? '重播' : '播放';

  let idx = -1;
  for (let i = 0; i < captions.length; i++) if (t >= captions[i][0]) idx = i;
  if (idx !== capIdx) {
    capIdx = idx;
    if (idx >= 0 && started) { ui.cap.textContent = captions[idx][1]; ui.cap.classList.add('show'); capShownAt = performance.now(); }
    else ui.cap.classList.remove('show');
  } else if (performance.now() - capShownAt > 9000) ui.cap.classList.remove('show');
}

const lerpAngle = (a, b, k) => a + (((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) * k;
const clock = new THREE.Clock();

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  U.uTime.value += dt;
  foil.rotation.x += dt * 0.35; foil.rotation.y += dt * 0.5;

  for (const b of BODIES) bodyState(b, t, b.st);   // 让镜头参数使用当前时刻的状态
  shotParams(t, sp);
  const rate = sp.rate * speedMul;
  if (playing) {
    t += rate * dt;
    if (t >= T_END) { t = T_END; playing = false; }
  }
  updateWorld();

  if (director) {
    shotParams(t, sp);
    const k = 1 - Math.exp(-dt * 2.2);
    cam.focus.lerp(sp.focus, 1 - Math.exp(-dt * 3.2));
    cam.dist += (sp.dist - cam.dist) * k;
    cam.el += (sp.el - cam.el) * k;
    cam.az = lerpAngle(cam.az, sp.az + U.uTime.value * 0.025, k * 0.7);
    const ce = Math.cos(cam.el);
    camera.position.set(cam.focus.x + cam.dist * ce * Math.cos(cam.az), cam.focus.y + cam.dist * Math.sin(cam.el), cam.focus.z + cam.dist * ce * Math.sin(cam.az));
    controls.target.copy(cam.focus);
    camera.lookAt(cam.focus);
  } else {
    if (focusId) {
      const st = body(focusId).st;
      tmpV.set(st.x, st.phase >= 2 ? 0 : st.y, st.z).sub(cam.focus);
      cam.focus.add(tmpV); camera.position.add(tmpV); controls.target.copy(cam.focus);
    }
    controls.update();
  }

  sky.position.copy(camera.position);
  corona.scale.setScalar(body('sun').r * 9 * (1 + 0.03 * Math.sin(U.uTime.value * 1.7)));
  updateHUD(rate);
  composer.render();
  labelRenderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// 初始机位：贴近二向箔
shotParams(0, sp);
cam.focus.copy(sp.focus);
camera.position.set(-2.1, 1.0, -2.6);
updateWorld();
frame();

// 调试入口
window.__foil = { BODIES, shots, setT: (x) => { t = x; }, getT: () => t };
