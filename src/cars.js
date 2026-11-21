import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rand } from './textures.js';
import { LAYOUT } from './world.js';

const TYPES = {
  hatch: { L: 4.2, W: 1.8, wb: 2.6, wr: 0.315, b: 0.27, hoodY: 0.84, cowlX: 0.78, cowlY: 0.97, roofFX: -0.08, roofY: 1.46, roofRX: -1.5, glassRX: -1.93, beltY: 1.0 },
  suv: { L: 4.45, W: 1.85, wb: 2.67, wr: 0.36, b: 0.36, hoodY: 1.02, cowlX: 0.9, cowlY: 1.12, roofFX: 0.02, roofY: 1.66, roofRX: -1.72, glassRX: -2.06, beltY: 1.15 },
  x6: { L: 4.9, W: 1.95, wb: 2.93, wr: 0.39, b: 0.4, hoodY: 1.06, cowlX: 0.95, cowlY: 1.16, roofFX: 0.05, roofY: 1.66, roofRX: -0.95, glassRX: -2.15, beltY: 1.16 },
  saloon: { L: 4.75, W: 1.83, wb: 2.8, wr: 0.32, b: 0.26, hoodY: 0.8, cowlX: 1.0, cowlY: 0.94, roofFX: 0.15, roofY: 1.43, roofRX: -1.0, glassRX: -1.65, beltY: 0.99 },
};
const V3 = THREE.Vector3;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// ---------- body shaping: round the corners in plan view, lean the sides in (tumblehome) ----------
function planF(x, p) {
  const L2 = p.L / 2, fr = 0.62, rr = 0.5;
  const e = x > 0 ? Math.max(0, x - (L2 - fr)) / fr : Math.max(0, -x - (L2 - rr)) / rr;
  return 1 - 0.2 * e * e;
}
function sideF(y, p) {
  const top = clamp01((y - (p.beltY - 0.32)) / 0.32);
  const bot = clamp01((p.b + 0.16 - y) / 0.16);
  return 1 - 0.055 * top - 0.05 * bot;
}
function glassF(y, p) { return 1 - 0.19 * clamp01((y - p.beltY) / (p.roofY - p.beltY)); }
// half-width of the body surface at (x, y)
function zSurf(x, y, p) { return (p.W / 2) * planF(x, p) * sideF(y, p); }
function zGlass(x, y, p) { return (p.W * 0.41) * planF(x, p) * glassF(y, p); }

function smoothShape(geo, fn) {
  let g = geo.clone();
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-4);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const v = fn(pos.getX(i), pos.getY(i), pos.getZ(i));
    pos.setXYZ(i, v[0], v[1], v[2]);
  }
  g.computeVertexNormals();
  return g.toNonIndexed();
}

// phones get lighter car meshes (fewer curve segments, simpler wheels)
export const CAR_DETAIL = { low: false };
const geoCache = {};
function geos(type) {
  const lo = CAR_DETAIL.low;
  const ck = type + (lo ? '-lo' : '');
  if (geoCache[ck]) return geoCache[ck];
  const p = TYPES[type];
  const L2 = p.L / 2, ax = p.wb / 2, ar = p.wr + 0.06, ay = p.b;
  const s = new THREE.Shape();
  s.moveTo(-L2 + 0.06, ay);
  s.lineTo(-ax - ar, ay);
  s.absarc(-ax, ay, ar, Math.PI, 0, true);
  s.lineTo(ax - ar, ay);
  s.absarc(ax, ay, ar, Math.PI, 0, true);
  s.lineTo(L2 - 0.1, ay);
  s.quadraticCurveTo(L2 + 0.03, ay + 0.02, L2 + 0.01, ay + 0.3);
  s.quadraticCurveTo(L2 - 0.01, p.hoodY - 0.02, L2 - 0.45, p.hoodY + 0.06);
  s.quadraticCurveTo((L2 - 0.45 + p.cowlX) / 2, p.hoodY + 0.12, p.cowlX, p.cowlY);
  s.lineTo(p.glassRX, p.beltY);
  s.lineTo(-L2 + 0.18, p.beltY);
  s.quadraticCurveTo(-L2 - 0.02, p.beltY - 0.01, -L2, p.beltY - 0.32);
  s.quadraticCurveTo(-L2 - 0.02, ay + 0.1, -L2 + 0.06, ay);
  const bevel = 0.09;
  const raw = new THREE.ExtrudeGeometry(s, { depth: p.W - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: 0.08, bevelSegments: lo ? 2 : 5, curveSegments: lo ? 6 : 14 });
  raw.translate(0, 0, -(p.W - bevel * 2) / 2);
  const hw = p.W / 2;
  const body = smoothShape(raw, (x, y, z) => {
    let nz = z * planF(x, p) * sideF(y, p);
    // crown the hood / boot / shoulders
    const crown = y > p.beltY - 0.25 ? 0.035 * (1 - Math.pow(z / hw, 2)) : 0;
    return [x, y + crown, nz];
  });

  const gs = new THREE.Shape();
  gs.moveTo(p.cowlX + 0.02, p.cowlY - 0.03);
  gs.quadraticCurveTo((p.cowlX + p.roofFX) / 2 - 0.05, (p.cowlY + p.roofY) / 2 + 0.06, p.roofFX, p.roofY);
  gs.lineTo(p.roofRX, p.roofY + 0.01);
  gs.quadraticCurveTo((p.roofRX + p.glassRX) / 2 - 0.08, (p.roofY + p.beltY) / 2 + 0.07, p.glassRX, p.beltY - 0.03);
  gs.lineTo(p.cowlX + 0.02, p.cowlY - 0.03);
  const gw = p.W * 0.82;
  const graw = new THREE.ExtrudeGeometry(gs, { depth: gw, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: lo ? 1 : 3, curveSegments: lo ? 4 : 10 });
  graw.translate(0, 0, -gw / 2);
  const glass = smoothShape(graw, (x, y, z) => [x, y, z * planF(x, p) * glassF(y, p)]);

  const rs = new THREE.Shape();
  rs.moveTo(p.roofFX - 0.04, p.roofY - 0.005);
  rs.lineTo(p.roofRX + 0.03, p.roofY + 0.005);
  rs.quadraticCurveTo(p.roofRX - 0.02, p.roofY + 0.05, p.roofRX + 0.1, p.roofY + 0.075);
  rs.lineTo(p.roofFX - 0.12, p.roofY + 0.07);
  rs.quadraticCurveTo(p.roofFX - 0.02, p.roofY + 0.05, p.roofFX - 0.04, p.roofY - 0.005);
  const rw = p.W * 0.84;
  const rraw = new THREE.ExtrudeGeometry(rs, { depth: rw, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: lo ? 1 : 4, curveSegments: lo ? 3 : 8 });
  rraw.translate(0, 0, -rw / 2);
  const roof = smoothShape(rraw, (x, y, z) => [x, y, z * planF(x, p) * glassF(p.roofY, p)]);

  // tyre: lathe with a rounded sidewall
  const tw = 0.23, r = p.wr;
  const prof = [[r * 0.66, -tw / 2], [r * 0.9, -tw / 2], [r * 0.98, -tw / 2 + 0.02], [r, -tw / 2 + 0.05], [r, tw / 2 - 0.05], [r * 0.98, tw / 2 - 0.02], [r * 0.9, tw / 2], [r * 0.66, tw / 2]];
  const tyre = new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a, b)), lo ? 12 : 28);
  tyre.rotateX(Math.PI / 2);
  geoCache[ck] = { body, glass, roof, tyre, p };
  return geoCache[ck];
}

// ---------- canvas textures for the forecourt dressing ----------
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
const MARKER = '"Segoe Print", "Bradley Hand", "Chalkboard SE", "Comic Sans MS", cursive';

function logo(ctx, cx, cy, size, ink = '#1f3f8f') {
  ctx.save();
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.font = `700 ${size}px "Trebuchet MS", Arial, sans-serif`;
  const a = ctx.measureText('Liverpool').width, cw = size * 1.75, b = ctx.measureText('Centre').width;
  let x = cx - (a + cw + b + size * 0.5) / 2;
  ctx.fillStyle = ink; ctx.fillText('Liverpool', x, cy); x += a + size * 0.25;
  ctx.beginPath(); ctx.ellipse(x + cw / 2, cy, cw / 2, size * 0.58, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `italic 800 ${size * 0.9}px "Trebuchet MS", Arial, sans-serif`; ctx.textAlign = 'center';
  ctx.fillText('Car', x + cw / 2, cy + 1); x += cw + size * 0.25;
  ctx.fillStyle = ink; ctx.textAlign = 'left'; ctx.font = `700 ${size}px "Trebuchet MS", Arial, sans-serif`;
  ctx.fillText('Centre', x, cy);
  ctx.restore();
}

function roofSignTexture() {
  const c = cv(512, 192), ctx = c.getContext('2d');
  ctx.fillStyle = '#f7f9fb'; ctx.fillRect(0, 0, 512, 192);
  const g = ctx.createLinearGradient(0, 96, 0, 192); g.addColorStop(0, '#d7e8f8'); g.addColorStop(1, '#b8d3ee');
  ctx.fillStyle = g; ctx.fillRect(0, 100, 512, 92);
  ctx.fillStyle = '#1f3f8f'; ctx.fillRect(0, 0, 512, 10);
  logo(ctx, 256, 146, 40);
  ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(0, 96, 512, 4);
  return tex(c);
}

function plateTexture(reg, rear) {
  const c = cv(256, 58), ctx = c.getContext('2d');
  ctx.fillStyle = rear ? '#f4c514' : '#f6f6f2'; ctx.fillRect(0, 0, 256, 58);
  ctx.fillStyle = '#1d3d9c'; ctx.fillRect(0, 0, 22, 58);
  ctx.fillStyle = '#f4c514'; ctx.font = '700 11px Arial'; ctx.textAlign = 'center'; ctx.fillText('UK', 11, 48);
  ctx.fillStyle = '#111'; ctx.font = '700 40px "Arial Narrow", Arial, sans-serif'; ctx.textBaseline = 'middle';
  ctx.fillText(reg, 140, 31);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, 254, 56);
  return tex(c);
}

function handPriceTexture(now, was) {
  const c = cv(512, 224), ctx = c.getContext('2d');
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const write = (txt, x, y, size, col) => {
    ctx.font = `700 ${size}px ${MARKER}`;
    ctx.lineWidth = size * 0.12; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.strokeText(txt, x, y);
    ctx.fillStyle = col; ctx.fillText(txt, x, y);
  };
  write('NOW', 150, 58, 58, '#ff5fae');
  write(`£${now}`, 250, 148, 104, '#ff5fae');
  if (was) {
    write(`£${was}`, 420, 58, 40, '#f8f2f6');
    ctx.strokeStyle = '#ff5fae'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(360, 64); ctx.lineTo(480, 50); ctx.stroke();
  }
  return tex(c);
}

function bannerTexture(text, bg = '#d8202a') {
  const c = cv(512, 128), ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.strokeRect(8, 8, 496, 112);
  ctx.fillStyle = '#fff'; ctx.font = '900 84px Arial Black, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 68);
  return tex(c);
}

function reducedTexture(was, now) {
  const c = cv(256, 200), ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 256, 200);
  ctx.fillStyle = '#e0182d'; ctx.fillRect(0, 0, 256, 58);
  ctx.fillStyle = '#fff'; ctx.font = '900 40px Arial Black, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('REDUCED!', 128, 31);
  ctx.fillStyle = '#e0182d'; ctx.font = `700 30px ${MARKER}`;
  ctx.fillText(`WAS £${was}`, 128, 92);
  ctx.strokeStyle = '#e0182d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(40, 96); ctx.lineTo(216, 88); ctx.stroke();
  ctx.font = `700 44px ${MARKER}`; ctx.fillText(`NOW £${now}`, 128, 152);
  ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, 252, 196);
  return tex(c);
}

function blobTexture() {
  const c = cv(128, 64), ctx = c.getContext('2d');
  const img = ctx.createImageData(128, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 128; x++) {
    const dx = Math.max(0, Math.abs(x - 63.5) - 40) / 24, dy = Math.max(0, Math.abs(y - 31.5) - 14) / 18;
    const d = Math.min(1, Math.hypot(dx, dy));
    const a = Math.pow(1 - d, 1.6) * 0.82;
    const i = (y * 128 + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 0; img.data[i + 3] = a * 255;
  }
  ctx.putImageData(img, 0, 0);
  return tex(c);
}

const fmt = (n) => n.toLocaleString('en-GB');
const LETTERS = 'ABCDEFGHJKLMNOPRSTVWXY';
const pick = (s) => s[Math.floor(rand() * s.length)];
function randomReg() {
  const age = ['07', '58', '61', '64', '15', '66', '18', '69', '21', '70'][Math.floor(rand() * 10)];
  return `${pick(LETTERS)}${pick(LETTERS)}${age} ${pick(LETTERS)}${pick(LETTERS)}${pick(LETTERS)}`;
}

// ---------- shared materials ----------
const matCache = {};
function paint(hex) {
  if (!matCache[hex]) {
    const c = new THREE.Color(hex), dark = c.r + c.g + c.b < 0.25;
    matCache[hex] = new THREE.MeshPhysicalMaterial({
      color: hex, metalness: dark ? 0.35 : 0.55, roughness: dark ? 0.24 : 0.3, clearcoat: 1, clearcoatRoughness: 0.035, envMapIntensity: 1.5,
    });
  }
  return matCache[hex];
}
const S = {};
function sharedMats() {
  if (S.glass) return S;
  S.glass = new THREE.MeshPhysicalMaterial({ color: 0x0b1117, roughness: 0.02, metalness: 0.15, clearcoat: 1, envMapIntensity: 2.4, transparent: true, opacity: 0.86 });
  S.trim = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.55 });
  S.char = new THREE.MeshStandardMaterial({ color: 0x161412, roughness: 1, metalness: 0.2 });
  S.charTrim = new THREE.MeshStandardMaterial({ color: 0x0c0b0a, roughness: 1 });
  S.sign = new THREE.MeshStandardMaterial({ map: roofSignTexture(), roughness: 0.45 });
  S.blob = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, toneMapped: false });
  // windscreen dressing, like the real forecourt: hand-written prices, DIESEL banners, REDUCED cards
  const now = [4995, 5495, 6495, 7495, 8995, 9995, 10995, 12495];
  const sb = (t, transparent = false) => new THREE.MeshBasicMaterial({ map: t, transparent, depthWrite: !transparent, side: THREE.DoubleSide });
  S.stickers = {
    hand: now.slice(0, 5).map((n, i) => sb(handPriceTexture(fmt(n), i % 2 ? fmt(n + 1000) : null), true)),
    reduced: [[7995, 6995], [9495, 8495], [11995, 10995]].map(([a, b]) => sb(reducedTexture(fmt(a), fmt(b)))),
    diesel: [sb(bannerTexture('DIESEL'))],
    sold: [sb(bannerTexture('SOLD', '#c4141f'))],
  };
  S.plates = Array.from({ length: 4 }, () => { const r = randomReg(); return [new THREE.MeshStandardMaterial({ map: plateTexture(r, false), roughness: 0.35 }), new THREE.MeshStandardMaterial({ map: plateTexture(r, true), roughness: 0.35 })]; });
  return S;
}

const tmpColor = new THREE.Color();
function prep(geo, matrix, hex) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k);
  g.clearGroups();
  g.applyMatrix4(matrix);
  if (hex !== undefined) {
    tmpColor.setHex(hex);
    const n = g.attributes.position.count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = tmpColor.r; c[i * 3 + 1] = tmpColor.g; c[i * 3 + 2] = tmpColor.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  }
  return g;
}
const M4 = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new V3(sx, sy, sz));

let SIGN_GEO = null;
function signGeo() {
  if (SIGN_GEO) return SIGN_GEO;
  const parts = [];
  for (const s of [-1, 1]) {
    const b = new THREE.BoxGeometry(0.025, 0.34, 0.9).toNonIndexed();
    b.applyMatrix4(M4(s * 0.07, 0, 0, 0, 0, s * 0.32));
    parts.push(b);
  }
  const cap = new THREE.BoxGeometry(0.12, 0.025, 0.9).toNonIndexed(); cap.applyMatrix4(M4(0, 0.165, 0));
  parts.push(cap);
  SIGN_GEO = mergeGeometries(parts);
  return SIGN_GEO;
}

const CHROME = 0xd6dade, BLACK = 0x0c0d0e, DARKGREY = 0x26282b, TYRE = 0x161617;
const GRILLES = ['trapezoid', 'bars', 'kidney', 'slots'];

// Build one car as 4 meshes: paint, glass, trim (vertex-coloured detail), indicator lamps.
export function makeCar(type = 'hatch', color = 0x1d1f22, opts = {}) {
  sharedMats();
  const g = geos(type), p = g.p, L2 = p.L / 2;
  const car = new THREE.Group();
  car.rotation.order = 'YXZ';
  const paintG = [], trimG = [], indG = [];
  const T = (geo, m, hex) => trimG.push(prep(geo, m, hex));
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  paintG.push(prep(g.body, M4()), prep(g.roof, M4()));
  const grille = opts.kidney ? 'kidney' : opts.grille || GRILLES[Math.floor(rand() * 3)];

  // wheels: rounded tyre, 5-spoke alloy, brake disc
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const wx = sx * p.wb / 2, wz = sz * (zSurf(wx, p.wr, p) - 0.14);
    T(g.tyre, M4(wx, p.wr, wz), TYRE);
    const face = wz + sz * 0.1;
    T(new THREE.CylinderGeometry(p.wr * 0.66, p.wr * 0.66, 0.16, 20), M4(wx, p.wr, wz, Math.PI / 2), 0x3a3c40);
    T(new THREE.CylinderGeometry(p.wr * 0.45, p.wr * 0.45, 0.02, 18), M4(wx, p.wr, face - sz * 0.05, Math.PI / 2), 0x6a6d70);
    T(new THREE.TorusGeometry(p.wr * 0.62, 0.022, 4, CAR_DETAIL.low ? 10 : 24), M4(wx, p.wr, face), CHROME);
    if (CAR_DETAIL.low) T(new THREE.CylinderGeometry(p.wr * 0.6, p.wr * 0.6, 0.02, 10), M4(wx, p.wr, face, Math.PI / 2), 0xaeb2b6);
    else for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + sx;
      T(box(0.05, p.wr * 0.56, 0.035), M4(wx + Math.cos(a) * p.wr * 0.3, p.wr + Math.sin(a) * p.wr * 0.3, face, 0, 0, a - Math.PI / 2), CHROME);
    }
    T(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12), M4(wx, p.wr, face, Math.PI / 2), 0x9a9da2);
  }

  // headlights (swept), DRL strip, tail lights (wrap-around)
  for (const sz of [-1, 1]) {
    // sit the lamps where the nose is still near-vertical, flush with the bodywork
    const hy = p.b + 0.3 + (p.hoodY - p.b - 0.3) * 0.5, hx = L2 - 0.11, hz = sz * (zSurf(hx, hy, p) - 0.27);
    T(box(0.12, 0.09, 0.36), M4(hx, hy, hz, 0, sz * 0.3, 0), 0xdfe6ee);
    T(box(0.03, 0.055, 0.1), M4(hx + 0.05, hy + 0.005, hz - sz * 0.07, 0, sz * 0.3, 0), 0x7f8690);
    T(box(0.02, 0.014, 0.3), M4(hx + 0.055, hy - 0.04, hz + sz * 0.02, 0, sz * 0.3, 0), 0xffffff);
    const tx = -L2 + 0.1, ty = p.beltY - 0.12, tz = sz * (zSurf(tx, ty, p) - 0.2);
    T(box(0.12, 0.12, 0.4), M4(tx, ty, tz, 0, -sz * 0.45, 0), 0xa3101a);
    T(box(0.03, 0.04, 0.3), M4(tx - 0.05, ty - 0.02, tz, 0, -sz * 0.45, 0), 0xe8e8e8);
    indG.push(prep(box(0.06, 0.04, 0.12), M4(L2 - 0.1, p.b + 0.2, sz * (zSurf(L2 - 0.1, p.b + 0.2, p) - 0.12))));
    indG.push(prep(box(0.06, 0.05, 0.12), M4(-L2 + 0.06, p.beltY - 0.32, sz * (zSurf(-L2 + 0.06, p.beltY - 0.3, p) - 0.12))));
    // mirrors (body colour) on a black arm
    const mx = p.cowlX - 0.12, my = p.cowlY + 0.07, mz = sz * (zSurf(p.cowlX, p.cowlY, p) + 0.09);
    paintG.push(prep(new THREE.SphereGeometry(1, 12, 8), M4(mx, my, mz, 0, sz * 0.2, 0, 0.09, 0.065, 0.12)));
    T(box(0.06, 0.03, 0.12), M4(mx + 0.02, my - 0.05, mz - sz * 0.07), BLACK);
    T(new THREE.CircleGeometry(1, 12), M4(mx - 0.085, my, mz, 0, -Math.PI / 2, 0, 0.055, 0.05, 1), 0x8a9aa8);
    // door handles + rubbing strip + black window trim + B pillar
    for (const hxx of type === 'hatch' ? [0.25] : [0.3, -0.75]) T(box(0.14, 0.03, 0.03), M4(hxx, p.beltY - 0.13, sz * (zSurf(hxx, p.beltY - 0.13, p) + 0.005)), CHROME);
    const bx = (p.roofFX + p.roofRX) / 2 + 0.1, my2 = (p.beltY + p.roofY) / 2;
    T(box(0.09, p.roofY - p.beltY, 0.03), M4(bx, my2, sz * (zGlass(bx, my2, p) + 0.01)), BLACK);
    const bl = p.cowlX - p.glassRX - 0.1;
    T(box(bl, 0.03, 0.02), M4((p.cowlX + p.glassRX) / 2, p.beltY + 0.005, sz * (zSurf(0, p.beltY, p) - 0.005)), grille === 'bars' ? CHROME : BLACK);
    T(box(p.wb - 0.75, 0.05, 0.02), M4(0, p.b + 0.12, sz * (zSurf(0, p.b + 0.12, p) + 0.002)), DARKGREY);
  }

  // front end: grille styles + lower intake + badge
  const fx = L2 - 0.02, gy = p.b + 0.36;
  if (grille === 'trapezoid') {
    T(box(0.06, 0.2, 0.72), M4(fx, gy, 0), BLACK);
    T(box(0.065, 0.025, 0.66), M4(fx + 0.005, gy + 0.11, 0), CHROME);
  } else if (grille === 'bars') {
    T(box(0.05, 0.24, 0.66), M4(fx, gy + 0.02, 0), CHROME);
    T(box(0.055, 0.19, 0.6), M4(fx + 0.004, gy + 0.02, 0), BLACK);
    for (let i = -1; i <= 1; i++) T(box(0.06, 0.02, 0.6), M4(fx + 0.008, gy + 0.02 + i * 0.055, 0), CHROME);
  } else if (grille === 'kidney') {
    for (const sz of [-1, 1]) {
      T(box(0.05, 0.19, 0.25), M4(fx + 0.005, gy + 0.04, sz * 0.16), CHROME);
      T(box(0.055, 0.15, 0.21), M4(fx + 0.012, gy + 0.04, sz * 0.16), BLACK);
    }
  }
  T(box(0.05, 0.12, p.W * 0.55), M4(L2 - 0.03, p.b + 0.12, 0), BLACK);
  for (const sz of [-1, 1]) T(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 12), M4(L2 - 0.03, p.b + 0.12, sz * p.W * 0.33, 0, 0, Math.PI / 2), 0xbfc4c9);
  T(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 16), M4(fx + 0.03, gy + (grille === 'kidney' ? 0.19 : 0.13), 0, 0, 0, Math.PI / 2), CHROME);
  T(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 16), M4(-L2 - 0.005, p.beltY - 0.15, 0, 0, 0, Math.PI / 2), CHROME);
  T(box(0.04, 0.1, p.W * 0.6), M4(-L2 + 0.02, p.b + 0.1, 0), BLACK); // rear diffuser

  // cabin seen through the glass: dark interior, seats, headrests, wheel
  T(box(p.L * 0.42, 0.34, p.W * 0.72), M4((p.cowlX + p.glassRX) / 2, p.beltY - 0.08, 0), 0x17181a);
  for (const sx of [0.05, -0.75]) for (const sz of [-1, 1]) T(box(0.1, 0.16, 0.24), M4(sx + (p.roofFX + p.roofRX) / 2, p.beltY + 0.24, sz * 0.36), 0x222326);
  T(new THREE.TorusGeometry(0.17, 0.025, 6, 16), M4(p.cowlX - 0.38, p.beltY + 0.1, 0.38, 0, Math.PI / 2 - 0.4, 0), BLACK);

  const indMat = new THREE.MeshStandardMaterial({ color: 0xff8a1a, emissive: 0xff7a00, emissiveIntensity: 0, roughness: 0.3 });
  indMat.userData.keepPBR = true; // flashes at runtime, keep the original
  const mk = (geo, mat, part, cast = true) => {
    const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true;
    m.userData.carPart = part; car.add(m); return m;
  };
  const paintMesh = mk(mergeGeometries(paintG), paint(color), 'body');
  const glass = mk(g.glass, S.glass, 'glass', false);
  glass.renderOrder = 1;
  const trimMesh = mk(mergeGeometries(trimG), S.trim, 'trim');
  const indMesh = mk(mergeGeometries(indG), indMat, 'body', false);
  indMesh.visible = false; // only drawn while the alarm is flashing

  // instanced extras (number plates, contact shadow, windscreen dressing, roof topper)
  const extras = [];
  const plate = Math.floor(rand() * 4);
  extras.push({ kind: 'plate', key: `plateF${plate}`, local: M4(L2 + 0.04, p.b + 0.1, 0, 0, Math.PI / 2, 0, 0.52, 0.112, 1) });
  extras.push({ kind: 'plate', key: `plateR${plate}`, local: M4(-L2 - 0.02, p.beltY - 0.4, 0, 0, -Math.PI / 2, 0, 0.52, 0.112, 1) });
  let sign = null;
  if (!opts.plain) {
    const dx = p.roofFX - p.cowlX, dy = p.roofY - p.cowlY;
    const nx = dy, ny = -dx, nl = Math.hypot(nx, ny);
    const fr = 0.42, wy = p.cowlY + dy * fr;
    const holder = M4(p.cowlX + dx * fr + (nx / nl) * 0.07, wy + (ny / nl) * 0.07, 0, 0, 0, Math.atan2(ny, nx)).multiply(M4(0, 0, 0, 0, Math.PI / 2, 0));
    const halfW = zGlass(p.cowlX + dx * fr, wy, p);
    const st = (key, u, v, w, h, rot = 0) => extras.push({ kind: 'sticker', key, local: holder.clone().multiply(M4(u, v, 0.004, 0, 0, rot, w, h, 1)) });
    const r = rand();
    const n = (k) => Math.floor(rand() * S.stickers[k].length);
    if (opts.showroom) st(`reduced${n('reduced')}`, halfW * 0.35, 0, 0.32, 0.25);
    else if (r < 0.45) st(`hand${n('hand')}`, 0, 0.02, Math.min(1.05, halfW * 1.75), 0.46);
    else if (r < 0.75) { st(`reduced${n('reduced')}`, -halfW * 0.4, 0.02, 0.3, 0.235); if (rand() < 0.5) st(`hand${n('hand')}`, halfW * 0.25, 0, 0.6, 0.26); }
    else if (r < 0.92) { st('diesel0', 0, 0.03, halfW * 1.5, 0.2, -0.26); st(`hand${n('hand')}`, halfW * 0.3, -0.12, 0.55, 0.24); }
    else st('sold0', 0, 0.02, halfW * 1.5, 0.2, -0.22);
    if (!opts.showroom && rand() < 0.85) sign = { local: M4((p.roofFX + p.roofRX) / 2 + 0.05, p.roofY + 0.24, 0) };
  }

  car.userData = {
    isCar: true, type, p, glass, paintMesh, trimMesh, indMesh, indMat, paintMat: paint(color),
    sign, extras, alarm: 0, hp: 10, glassHits: 0, tyres: {}, tilt: { pitch: 0, roll: 0, drop: 0 },
    len: p.L, wid: p.W, height: p.roofY,
  };
  return car;
}

const GEO_PLANE = new THREE.PlaneGeometry(1, 1);
function extraMaterial(key) {
  sharedMats();
  if (key.startsWith('plateF')) return S.plates[+key.slice(6)][0];
  if (key.startsWith('plateR')) return S.plates[+key.slice(6)][1];
  const m = key.match(/^([a-z]+)(\d+)$/);
  return S.stickers[m[1]][+m[2]];
}

const COLORS = [
  [0x111214, 18], [0x3a3d42, 16], [0x8d9299, 16], [0xe9ebec, 14], [0x1e63d4, 9], [0x1b2a6b, 8],
  [0xb3141c, 4], [0x5d6670, 8], [0x0f1b33, 5],
];
function pickColor() {
  const tot = COLORS.reduce((a, c) => a + c[1], 0);
  let r = rand() * tot;
  for (const [c, w] of COLORS) { if ((r -= w) < 0) return c; }
  return COLORS[0][0];
}
function pickType() { const r = rand(); return r < 0.55 ? 'hatch' : r < 0.85 ? 'suv' : 'saloon'; }

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new V3(), _s = new V3();

// ------------------------------------------------------------------ car system
export class CarSystem {
  constructor(scene, T, fx, audio) {
    this.scene = scene; this.fx = fx; this.audio = audio;
    sharedMats();
    this.cracked = new THREE.MeshStandardMaterial({ map: T.crackedGlass, roughness: 0.25, metalness: 0.3 });
    const group = this.group = new THREE.Group(); scene.add(group);
    this.cars = []; this.all = []; this.alarms = []; this.pieces = []; this.time = 0;
    this.onExplode = null;

    const gaps = LAYOUT.columns;
    LAYOUT.rows.forEach((rz, ri) => {
      for (let x = -26.5; x <= 26.6; x += 3.0) {
        if (gaps.some((g) => Math.abs(g - x) < 2.1)) continue;
        if (rand() < 0.06) continue;
        const car = makeCar(pickType(), pickColor());
        const face = ri === 2 ? Math.PI / 2 : -Math.PI / 2;
        car.rotation.y = face + 0.35 * (ri === 2 ? -1 : 1) + (rand() - 0.5) * 0.05;
        car.position.set(x + (rand() - 0.5) * 0.2, 0.14, rz + (rand() - 0.5) * 0.2);
        this.add(car);
        this.cars.push({ car, row: ri, x: car.position.x, z: car.position.z });
      }
    });
    // showroom display cars
    [[-19, -35], [-10, -34.5], [3, -35], [12, -34.2]].forEach(([x, z], i) => {
      const car = makeCar(['saloon', 'suv', 'hatch', 'suv'][i], [0xe9ebec, 0x1e63d4, 0xb3141c, 0x111214][i], { showroom: true });
      car.rotation.y = -Math.PI / 2 + 0.5 * (i % 2 ? 1 : -1);
      car.position.set(x, 0.2, z);
      car.userData.showroom = true;
      this.add(car);
    });
    // parked traffic on the near side
    [[-46, 3.6, Math.PI], [-28, 3.6, Math.PI], [24, 3.6, Math.PI]].forEach(([x, z, r]) => {
      const car = makeCar(pickType(), pickColor(), { plain: true });
      car.rotation.y = r; car.position.set(x, 0, z); this.add(car);
    });

    // instanced roof toppers
    const withSign = this.all.filter((c) => c.userData.sign);
    this.signMesh = new THREE.InstancedMesh(signGeo(), S.sign, withSign.length);
    this.signMesh.castShadow = true; this.signMesh.userData.roofSign = true;
    this.signOwners = [];
    withSign.forEach((c, i) => { c.userData.sign.mesh = this.signMesh; c.userData.sign.id = i; this.signOwners[i] = c; });
    group.add(this.signMesh);
    // instanced number plates + windscreen dressing (one draw call per texture)
    const byKey = new Map();
    for (const c of this.all) for (const e of c.userData.extras) {
      if (!byKey.has(e.key)) byKey.set(e.key, []);
      byKey.get(e.key).push([c, e]);
    }
    for (const [key, list] of byKey) {
      const im = new THREE.InstancedMesh(GEO_PLANE, extraMaterial(key), list.length);
      im.raycast = () => {}; im.frustumCulled = false;
      if (key.startsWith('hand')) im.renderOrder = 3;
      list.forEach(([c, e], i) => { e.mesh = im; e.id = i; });
      group.add(im);
    }
    // soft contact shadows under every car (sits them on the tarmac, even without real-time shadows)
    this.blobMesh = new THREE.InstancedMesh(GEO_PLANE, S.blob, this.all.length);
    this.blobMesh.raycast = () => {}; this.blobMesh.frustumCulled = false; this.blobMesh.renderOrder = -1;
    this.all.forEach((c, i) => { c.userData.blob = { mesh: this.blobMesh, id: i }; });
    group.add(this.blobMesh);
    for (const c of this.all) {
      c.userData.orig = { pos: c.position.clone(), rotY: c.rotation.y };
      this.syncInstances(c);
    }
  }

  // cars added after start-up (the Corsa, Kev's BMW, the X6) get their own plate/shadow meshes
  attachOwnExtras(car) {
    const u = car.userData;
    for (const e of u.extras) {
      const m = new THREE.Mesh(GEO_PLANE, extraMaterial(e.key));
      m.matrixAutoUpdate = false; m.matrix.copy(e.local); m.raycast = () => {};
      car.add(m); e.own = m;
    }
    const p = u.p;
    const blob = new THREE.Mesh(GEO_PLANE, S.blob);
    blob.matrixAutoUpdate = false; blob.matrix.copy(M4(0, 0.015, 0, -Math.PI / 2, 0, 0, p.L + 0.7, p.W + 0.55, 1));
    blob.raycast = () => {}; blob.renderOrder = -1;
    car.add(blob);
  }

  add(car) { this.group.add(car); this.all.push(car); }

  addStatic(car) {
    this.add(car);
    this.attachOwnExtras(car);
    car.userData.orig = { pos: car.position.clone(), rotY: car.rotation.y };
    this.syncInstances(car);
  }

  addDynamic(car) {
    this.group.add(car); this.all.push(car);
    this.attachOwnExtras(car);
    car.userData.dynamic = true;
    car.userData.orig = { pos: car.position.clone(), rotY: car.rotation.y };
  }

  removeDynamic(car) {
    this.group.remove(car);
    this.all = this.all.filter((c) => c !== car);
    this.alarms = this.alarms.filter((c) => c !== car);
    if (car.userData.fire) car.userData.fire.until = 0;
    if (car.userData.smoke) car.userData.smoke.until = 0;
    this.fx.detachDecals(car);
  }

  syncInstances(car) {
    const u = car.userData;
    car.updateMatrixWorld(true);
    const m = new THREE.Matrix4();
    if (u.sign && u.sign.mesh) {
      u.sign.mesh.setMatrixAt(u.sign.id, u.sign.off ? ZERO : m.multiplyMatrices(car.matrixWorld, u.sign.local));
      u.sign.mesh.instanceMatrix.needsUpdate = true;
      u.sign.mesh.boundingSphere = null;
    }
    for (const e of u.extras || []) {
      const hide = u.destroyed || (e.kind === 'sticker' && u.glassHits >= 2);
      if (e.own) { e.own.visible = !hide; continue; }
      if (!e.mesh) continue;
      e.mesh.setMatrixAt(e.id, hide ? ZERO : m.multiplyMatrices(car.matrixWorld, e.local));
      e.mesh.instanceMatrix.needsUpdate = true;
    }
    if (u.blob) {
      const base = u.driven ? (car.position.z > -5.05 && car.position.z < 5.05 ? 0 : 0.14) : (u.orig ? u.orig.pos.y : car.position.y);
      const lift = Math.max(0, car.position.y - base), k = Math.max(0.25, 1 - lift / 3);
      const p = u.p;
      _q.setFromEuler(_e.set(-Math.PI / 2, car.rotation.y, 0, 'YXZ'));
      m.compose(_v.set(car.position.x, base + 0.012, car.position.z), _q, _s.set((p.L + 0.7) * k, (p.W + 0.55) * k, 1));
      u.blob.mesh.setMatrixAt(u.blob.id, m);
      u.blob.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  carFromSign(instanceId) { return this.signOwners[instanceId]; }

  alarm(car, chance) {
    const u = car.userData;
    if (u.destroyed || u.alarm > 0 || Math.random() > chance) return;
    u.alarm = 7; this.alarms.push(car); u.indMesh.visible = true;
    this.audio.carAlarm(car.position, 7);
  }

  // A bullet hit on a car. Returns { penetrate } so the caller knows whether the round carries on.
  hit(car, part, point, normal, dir, power = 1) {
    const u = car.userData;
    if (part === 'glass') {
      u.glassHits++;
      if (u.glassHits === 1) { u.glass.material = this.cracked; this.fx.glass(point, dir, 16); }
      else if (u.glass.visible) {
        u.glass.visible = false;
        this.fx.glass(point, dir, 60);
        this.syncInstances(car);
      }
      this.audio.impact('glass', point);
      this.alarm(car, 0.6);
      return { penetrate: true };
    }
    // tyres
    const local = car.worldToLocal(point.clone());
    const p = u.p;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const key = `${sx}${sz}`;
      const cx = sx * p.wb / 2, cz = sz * (p.W / 2 - 0.13);
      if (Math.hypot(local.x - cx, local.y - p.wr) < p.wr + 0.06 && Math.abs(local.z - cz) < 0.25) {
        if (!u.tyres[key]) {
          u.tyres[key] = true;
          u.tilt.pitch -= sx * 0.045; u.tilt.roll += sz * 0.05; u.tilt.drop += 0.06;
          this.audio.tyrePop(point);
          this.fx.impactDust(point, new V3(0, 1, 0), 0x777777);
        }
        this.fx.sparks(point, normal, 4);
        this.alarm(car, 0.5);
        return { penetrate: false };
      }
    }
    this.fx.sparks(point, normal, 8);
    this.audio.impact('metal', point);
    if (!u.destroyed) this.fx.decal(point, normal, 0.8, car);
    this.alarm(car, 0.45);
    this.damage(car, power);
    return { penetrate: power >= 3 };
  }

  damage(car, amount) {
    const u = car.userData;
    if (u.destroyed) return;
    u.hp -= amount;
    if (u.hp <= 4 && !u.smoke) {
      u.smoke = this.fx.addFire(this.enginePos(car), 999, 0.35, true);
    }
    if (u.hp <= 0) this.explode(car);
  }

  enginePos(car) { const p = car.userData.p; return car.localToWorld(new V3(p.L / 2 - 0.6, p.hoodY + 0.1, 0)); }

  knockSign(car, dir) {
    const u = car.userData;
    if (!u.sign || u.sign.off) return;
    u.sign.off = true;
    car.updateMatrixWorld(true);
    const m = new THREE.Matrix4().multiplyMatrices(car.matrixWorld, u.sign.local);
    const piece = new THREE.Mesh(signGeo(), S.sign);
    m.decompose(piece.position, piece.quaternion, piece.scale);
    piece.castShadow = true; piece.raycast = () => {};
    this.scene.add(piece);
    this.pieces.push({ mesh: piece, vel: new V3(dir.x * 4 + (Math.random() - 0.5), 3 + Math.random() * 2, dir.z * 4 + (Math.random() - 0.5)), spin: new V3(Math.random() * 12 - 6, Math.random() * 12 - 6, Math.random() * 12 - 6), resting: false });
    if (this.pieces.length > 40) { const old = this.pieces.shift(); this.scene.remove(old.mesh); }
    this.syncInstances(car);
    this.audio.impact('metal', piece.position);
  }

  explode(car) {
    const u = car.userData;
    if (u.destroyed) return;
    u.destroyed = true; u.hp = 0;
    const pos = car.position.clone().add(new V3(0, 0.7, 0));
    this.fx.explosion(pos);
    this.audio.explosion(pos);
    u.paintMesh.material = S.char; u.trimMesh.material = S.charTrim;
    u.glass.visible = false; u.indMesh.visible = false; u.alarm = 0;
    if (u.smoke) { u.smoke.until = 0; u.smoke = null; }
    if (u.sign && !u.sign.off) this.knockSign(car, new V3((Math.random() - 0.5), 0, (Math.random() - 0.5)));
    this.syncInstances(car);
    u.flying = { vel: new V3((Math.random() - 0.5) * 3, 5.5 + Math.random() * 2.5, (Math.random() - 0.5) * 3), ang: new V3((Math.random() - 0.5) * 4, 0, (Math.random() - 0.5) * 3) };
    u.fire = this.fx.addFire(pos, 28, 0.9);
    if (this.onExplode) this.onExplode(pos, car);
    // chain reaction
    for (const other of this.all) {
      if (other === car || other.userData.destroyed) continue;
      const d = other.position.distanceTo(car.position);
      if (d < 5.5) setTimeout(() => { this.damage(other, d < 3.5 ? 7 : 4); this.alarm(other, 1); }, 250 + Math.random() * 400);
    }
  }

  update(dt) {
    this.time += dt;
    for (let i = this.alarms.length - 1; i >= 0; i--) {
      const c = this.alarms[i], u = c.userData;
      u.alarm -= dt;
      u.indMat.emissiveIntensity = (Math.floor(this.time * 3.3) % 2 && u.alarm > 0) ? 4 : 0;
      if (u.alarm <= 0) { u.indMat.emissiveIntensity = 0; u.indMesh.visible = false; this.alarms.splice(i, 1); }
    }
    for (const car of this.all) {
      const u = car.userData;
      let moved = false;
      if (u.flying) {
        const f = u.flying;
        f.vel.y -= 9.8 * dt;
        car.position.addScaledVector(f.vel, dt);
        car.rotation.x += f.ang.x * dt; car.rotation.z += f.ang.z * dt;
        const base = u.orig.pos.y;
        if (car.position.y <= base && f.vel.y < 0) {
          car.position.y = base;
          if (f.vel.y < -2.5) { f.vel.y *= -0.28; f.vel.x *= 0.5; f.vel.z *= 0.5; f.ang.multiplyScalar(0.5); this.audio.impact('metal', car.position); }
          else {
            u.flying = null;
            u.settle = { roll: Math.round(car.rotation.x / Math.PI) * Math.PI };
          }
        }
        moved = true;
      } else if (u.settle) {
        const s = u.settle, k = Math.min(1, dt * 4);
        car.rotation.x += (s.roll - car.rotation.x) * k;
        car.rotation.z += (0 - car.rotation.z) * k;
        const flipped = Math.abs(Math.cos(s.roll)) > 0.5 && Math.cos(s.roll) < 0;
        const ty = u.orig.pos.y + (flipped ? u.p.roofY + 0.08 : -0.12);
        car.position.y += (ty - car.position.y) * k;
        if (Math.abs(s.roll - car.rotation.x) < 0.002 && Math.abs(car.position.y - ty) < 0.002) u.settle = null;
        moved = true;
      } else if (!u.destroyed && !u.dynamic && !u.driven) {
        const t = u.tilt;
        const dz = t.pitch - car.rotation.z, dx = t.roll - car.rotation.x, dy = (u.orig.pos.y - t.drop) - car.position.y;
        if (Math.abs(dz) + Math.abs(dx) + Math.abs(dy) > 0.0005) {
          const k = Math.min(1, dt * 3);
          car.rotation.z += dz * k; car.rotation.x += dx * k; car.position.y += dy * k;
          moved = true;
        }
      }
      if (moved || u.driven) this.syncInstances(car);
      if (u.fire) u.fire.pos.copy(car.position).add(new V3(0, 0.8, 0));
      if (u.smoke) u.smoke.pos.copy(this.enginePos(car));
    }
    for (const pc of this.pieces) {
      if (pc.resting) continue;
      pc.vel.y -= 9.8 * dt;
      pc.mesh.position.addScaledVector(pc.vel, dt);
      pc.mesh.rotation.x += pc.spin.x * dt; pc.mesh.rotation.y += pc.spin.y * dt; pc.mesh.rotation.z += pc.spin.z * dt;
      const floor = pc.mesh.position.z > -5 && pc.mesh.position.z < 5 ? 0.12 : 0.26;
      if (pc.mesh.position.y < floor) {
        pc.mesh.position.y = floor;
        if (pc.vel.y < -2) { pc.vel.y *= -0.3; pc.vel.x *= 0.5; pc.vel.z *= 0.5; pc.spin.multiplyScalar(0.4); }
        else { pc.resting = true; pc.mesh.rotation.set(Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1), pc.mesh.rotation.y, 0); }
      }
    }
  }

  reset() {
    for (const pc of this.pieces) this.scene.remove(pc.mesh);
    this.pieces = []; this.alarms = [];
    for (const car of this.all) {
      const u = car.userData;
      this.fx.detachDecals(car);
      car.position.copy(u.orig.pos); car.rotation.set(0, u.orig.rotY, 0);
      u.paintMesh.material = u.paintMat; u.trimMesh.material = S.trim;
      u.glass.material = S.glass; u.glass.visible = true; u.indMesh.visible = false;
      u.indMat.emissiveIntensity = 0;
      Object.assign(u, { hp: 10, glassHits: 0, tyres: {}, tilt: { pitch: 0, roll: 0, drop: 0 }, destroyed: false, flying: null, settle: null, alarm: 0, smoke: null, fire: null, driven: false });
      if (u.sign) u.sign.off = false;
      this.syncInstances(car);
    }
  }
}
