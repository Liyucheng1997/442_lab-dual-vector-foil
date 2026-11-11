// ───────── 物理模型（单位：1 AU = 10 场景单位，时间 = 小时）─────────
export const AU = 10;
export const C_AU = 7.2146;            // 光速：AU / 小时（1 AU = 499 光秒）
export const C = C_AU * AU;            // 场景单位 / 小时
export const A = 0.5 * AU;             // 二维平面前沿的固有加速度 0.5 AU/h² ≈ 5772 m/s²
export const G = 2.0 * AU;             // 坍缩区内三维空间向平面跌落的固有加速度
export const T_END = 21;

// 相对论性匀加速（双曲运动）：速度永远逼近但不超过光速
export const frontR = (t) => (t <= 0 ? 0 : ((C * C) / A) * (Math.sqrt(1 + ((A * t) / C) ** 2) - 1));
export const frontV = (t) => (t <= 0 ? 0 : (A * t) / Math.sqrt(1 + ((A * t) / C) ** 2));
export const tHit = (d) => (C / A) * Math.sqrt(((d * A) / (C * C) + 1) ** 2 - 1);
export const tFall = (h) => (h <= 0 ? 0 : (C / G) * Math.sqrt(((h * G) / (C * C) + 1) ** 2 - 1));
export const drop = (tau) => (tau <= 0 ? 0 : ((C * C) / G) * (Math.sqrt(1 + ((G * tau) / C) ** 2) - 1));

// 二向箔位于原点，二维平面为 y = 0。太阳在 22 AU 外、平面上方 3 AU，黄道面相对平面倾斜 9°
export const SUN_POS = [220, 30, 0];
const EPS = (9 * Math.PI) / 180;
export function eclToWorld(x, yE, z, out) {
  out[0] = SUN_POS[0] + x;
  out[1] = SUN_POS[1] + yE * Math.cos(EPS) + z * Math.sin(EPS);
  out[2] = SUN_POS[2] + z * Math.cos(EPS) - yE * Math.sin(EPS);
  return out;
}

// a: 轨道半长轴(AU)  period: 公转周期(天)  th: 初始相位(度)  r: 显示半径  rot: 自转周期(小时)
// flat: 二维化耗时(小时)  S: 二维半径 / 三维半径   layers: 由内到外的圈层颜色与边界（半径占比）
export const BODIES = [
  { id: 'sun', name: '太阳', a: 0, period: 1, th: 0, r: 1.2, rot: 609, tilt: 7, flat: 1.6, S: 2.6, feature: true,
    surf: { type: 3, c1: '#ff7a14', c2: '#fff0b0', c3: '#ff3b00', cut: [4, 3, 1.6] },
    layers: { cols: ['#fff6d8', '#ffd27a', '#ffab3d', '#ff7a1a', '#ffcf70'], b: [0.25, 0.7, 0.9, 0.97], kind: 1 } },
  { id: 'mercury', name: '水星', a: 0.387, period: 88, th: 280, r: 0.16, rot: 1408, tilt: 0, flat: 0.4, S: 3,
    surf: { type: 0, c1: '#9a928b', c2: '#5b554f', c3: '#000000', cut: [3, 1.5, 0.5] },
    layers: { cols: ['#f3e2b3', '#d9b36a', '#8a7f78', '#6f6862', '#9a938c'], b: [0.55, 0.82, 0.93, 0.98], surf: '#5b554f' } },
  { id: 'venus', name: '金星', a: 0.723, period: 224.7, th: 60, r: 0.3, rot: 5832, tilt: 177, flat: 0.5, S: 3.2,
    surf: { type: 2, c1: '#e8cf93', c2: '#c9a15a', c3: '#f4e6bd', bands: 5, atm: '#f0d9a0', cut: [3, 1.5, 0.5] },
    layers: { cols: ['#f7e3a6', '#e0a050', '#b5562c', '#7a5a40', '#e6c98a'], b: [0.2, 0.52, 0.93, 0.97], surf: '#c9a15a' } },
  { id: 'earth', name: '地球', a: 1.0, period: 365.25, th: 170, r: 0.32, rot: 23.93, tilt: 23.4, flat: 0.5, S: 3.2, feature: true,
    surf: { type: 1, c1: '#0b3a78', c2: '#3f7a3a', c3: '#a58a5c', atm: '#5aa0ff', cut: [3, 1.4, 0.4] },
    layers: { cols: ['#fff1c2', '#ffb347', '#b4502b', '#6b5a4a', '#1f5fae'], b: [0.19, 0.55, 0.93, 0.965], surf: '#3f7a3a' } },
  { id: 'moon', name: '月球', parent: 'earth', a: 0.15, period: 27.3, th: 40, r: 0.09, rot: 655, tilt: 6, flat: 0.3, S: 3,
    surf: { type: 0, c1: '#aaa69f', c2: '#66625d', c3: '#000000', cut: [2.5, 1.3, 0.5] },
    layers: { cols: ['#d9c08a', '#8f8a84', '#77726c', '#6a6661', '#a8a49e'], b: [0.2, 0.6, 0.9, 0.97], surf: '#66625d' } },
  { id: 'mars', name: '火星', a: 1.524, period: 687, th: 200, r: 0.2, rot: 24.62, tilt: 25.2, flat: 0.4, S: 3.2,
    surf: { type: 0, c1: '#c8683c', c2: '#7d3a20', c3: '#f2ede6', cut: [3, 1.3, 0.4] },
    layers: { cols: ['#f0d79a', '#c98a4a', '#a34a28', '#8a3d22', '#c8683c'], b: [0.25, 0.5, 0.92, 0.97], surf: '#7d3a20' } },
  { id: 'jupiter', name: '木星', a: 5.203, period: 4332.6, th: 150, r: 1.1, rot: 9.93, tilt: 3.1, flat: 0.7, S: 3.2, feature: true,
    surf: { type: 2, c1: '#e3cfa8', c2: '#a8683c', c3: '#f3ead6', bands: 9, spot: 1, atm: '#f0d6b0', cut: [2.2, 1.8, 1.6] },
    layers: { cols: ['#d9d4c8', '#7c8fa8', '#b98a5a', '#d9b88a', '#f0e2c4'], b: [0.15, 0.78, 0.93, 0.975], surf: '#a8683c' } },
  { id: 'saturn', name: '土星', a: 9.583, period: 10759, th: 195, r: 0.95, rot: 10.66, tilt: 26.7, flat: 0.7, S: 3.2, feature: true, rings: true,
    surf: { type: 2, c1: '#ead9a8', c2: '#c9a868', c3: '#f6ecd0', bands: 7, atm: '#f3e3b8', cut: [2.2, 1.9, 1.5] },
    layers: { cols: ['#d6d0c2', '#8494a8', '#c4a36a', '#e0c891', '#f3e6c0'], b: [0.2, 0.6, 0.92, 0.975], surf: '#c9a868' } },
  { id: 'uranus', name: '天王星', a: 19.19, period: 30688, th: 20, r: 0.6, rot: 17.24, tilt: 97.8, flat: 0.6, S: 3.2, feature: true,
    surf: { type: 2, c1: '#9fdde4', c2: '#86cdd6', c3: '#c9f1f2', bands: 3, atm: '#b8f0f4', cut: [1.2, 2.2, 2.6] },
    layers: { cols: ['#bdb6a8', '#5f7f95', '#6fb7c4', '#9fdde4', '#c9f1f2'], b: [0.2, 0.7, 0.93, 0.975], surf: '#86cdd6' } },
  { id: 'neptune', name: '海王星', a: 30.07, period: 60182, th: 172, r: 0.58, rot: 16.11, tilt: 28.3, flat: 0.6, S: 3.2, feature: true,
    surf: { type: 2, c1: '#3f6fd8', c2: '#2a4fb0', c3: '#8fb4ff', bands: 4, atm: '#7aa8ff', cut: [1.0, 1.8, 3.0] },
    layers: { cols: ['#b9b2a6', '#4f6f96', '#3f6fd0', '#4f86e8', '#9cc0ff'], b: [0.22, 0.72, 0.93, 0.975], surf: '#2a4fb0' } },
  { id: 'pluto', name: '冥王星', a: 39.48, period: 90560, th: 330, r: 0.12, rot: 153.3, tilt: 122, flat: 0.4, S: 3, feature: true,
    surf: { type: 0, c1: '#d9cdb8', c2: '#8a6f5a', c3: '#000000', cut: [2, 1.6, 1.4] },
    layers: { cols: ['#8a8078', '#a89b8c', '#cfc6b8', '#d9cdb8', '#e8dcc8'], b: [0.55, 0.85, 0.93, 0.97], surf: '#8a6f5a' } },
];

const byId = Object.fromEntries(BODIES.map((b) => [b.id, b]));
const tmp = [0, 0, 0];

// 天体在未受扰动时的位置（真实开普勒角速度）
export function orbitPos(b, t, out) {
  const th = (b.th * Math.PI) / 180 + (2 * Math.PI * t) / (b.period * 24);
  const R = b.a * AU;
  let x = R * Math.cos(th), z = R * Math.sin(th);
  if (b.parent) {
    const p = byId[b.parent];
    const pt = Math.min(t, p.tHit ?? Infinity);
    const pth = (p.th * Math.PI) / 180 + (2 * Math.PI * pt) / (p.period * 24);
    x += p.a * AU * Math.cos(pth); z += p.a * AU * Math.sin(pth);
  }
  return eclToWorld(x, 0, z, out);
}

// 预计算每个天体的时间表
for (const b of BODIES) {
  let th = 0;
  for (let i = 0; i < 3; i++) { orbitPos(b, th, tmp); th = tHit(Math.hypot(tmp[0], tmp[1], tmp[2])); }
  b.tHit = th;
  orbitPos(b, th, tmp);
  b.pHit = [...tmp];
  b.sgn = tmp[1] >= 0 ? 1 : -1;
  b.h0 = Math.abs(tmp[1]);
  b.tContact = th + tFall(Math.max(b.h0 - b.r, 0));
  b.tDone = b.tContact + b.flat;
}

// 任意时刻 t 的天体状态（纯函数，可来回拖动时间轴）
// phase: 0 三维  1 跌落  2 二维化中  3 已成画
export function bodyState(b, t, s) {
  if (t < b.tHit) {
    orbitPos(b, t, tmp);
    s.x = tmp[0]; s.y = tmp[1]; s.z = tmp[2]; s.phase = 0; s.p = 0; s.f = 0;
    return s;
  }
  s.x = b.pHit[0]; s.z = b.pHit[2];
  if (t < b.tContact) {
    s.y = b.sgn * Math.max(b.h0 - drop(t - b.tHit), b.r);
    s.phase = 1; s.p = 0; s.f = 0;
    return s;
  }
  const p = Math.min((t - b.tContact) / b.flat, 1);
  const pe = p * p * (3 - 2 * p);
  const startH = Math.min(b.h0, b.r);
  const d = (b.r - startH) + (b.r + startH) * pe;      // 已没入平面的深度
  s.y = b.sgn * (b.r - d);
  s.f = (d * d * (3 * b.r - d)) / (4 * b.r ** 3);      // 已没入的体积占比（球冠体积）
  s.p = p; s.phase = p >= 1 ? 3 : 2;
  return s;
}

export const body = (id) => byId[id];
