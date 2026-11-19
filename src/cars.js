import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rand, priceTexture } from './textures.js';
import { LAYOUT } from './world.js';
import { mergeStatic } from './merge.js';

const TYPES = {
  hatch: { L: 4.05, W: 1.76, wb: 2.5, wr: 0.31, b: 0.26, hoodY: 0.82, cowlX: 0.72, cowlY: 0.95, roofFX: -0.12, roofY: 1.45, roofRX: -1.45, glassRX: -1.9, beltY: 0.99 },
  suv: { L: 4.45, W: 1.84, wb: 2.66, wr: 0.35, b: 0.34, hoodY: 1.0, cowlX: 0.88, cowlY: 1.1, roofFX: 0.0, roofY: 1.68, roofRX: -1.72, glassRX: -2.08, beltY: 1.14 },
  saloon: { L: 4.6, W: 1.8, wb: 2.75, wr: 0.31, b: 0.25, hoodY: 0.8, cowlX: 0.95, cowlY: 0.93, roofFX: 0.12, roofY: 1.41, roofRX: -1.05, glassRX: -1.65, beltY: 0.99 },
};

const geoCache = {};
function geos(type) {
  if (geoCache[type]) return geoCache[type];
  const p = TYPES[type];
  const L2 = p.L / 2, ax = p.wb / 2, ar = p.wr + 0.07, ay = p.b;

  const s = new THREE.Shape();
  s.moveTo(-L2 + 0.06, ay);
  s.lineTo(-ax - ar, ay);
  s.absarc(-ax, ay, ar, Math.PI, 0, true);
  s.lineTo(ax - ar, ay);
  s.absarc(ax, ay, ar, Math.PI, 0, true);
  s.lineTo(L2 - 0.08, ay);
  s.quadraticCurveTo(L2 + 0.02, ay + 0.04, L2, ay + 0.3);
  s.quadraticCurveTo(L2 - 0.02, p.hoodY, L2 - 0.4, p.hoodY + 0.05);
  s.lineTo(p.cowlX, p.cowlY);
  s.lineTo(p.glassRX, p.beltY);
  s.lineTo(-L2 + 0.12, p.beltY);
  s.quadraticCurveTo(-L2 - 0.02, p.beltY - 0.02, -L2, p.beltY - 0.3);
  s.lineTo(-L2 + 0.06, ay);
  const bevel = 0.07;
  const body = new THREE.ExtrudeGeometry(s, { depth: p.W - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: 0.06, bevelSegments: 4, curveSegments: 10 });
  body.translate(0, 0, -(p.W - bevel * 2) / 2);
  body.computeVertexNormals();

  const gs = new THREE.Shape();
  gs.moveTo(p.cowlX + 0.02, p.cowlY - 0.02);
  gs.lineTo(p.roofFX, p.roofY);
  gs.lineTo(p.roofRX, p.roofY + 0.01);
  gs.lineTo(p.glassRX, p.beltY - 0.02);
  gs.lineTo(p.cowlX + 0.02, p.cowlY - 0.02);
  const gw = p.W * 0.82;
  const glass = new THREE.ExtrudeGeometry(gs, { depth: gw, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 2 });
  glass.translate(0, 0, -gw / 2);

  const rs = new THREE.Shape();
  rs.moveTo(p.roofFX - 0.05, p.roofY - 0.01);
  rs.lineTo(p.roofRX + 0.04, p.roofY);
  rs.lineTo(p.roofRX + 0.08, p.roofY + 0.07);
  rs.lineTo(p.roofFX - 0.1, p.roofY + 0.06);
  const rw = p.W * 0.84;
  const roof = new THREE.ExtrudeGeometry(rs, { depth: rw, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 3 });
  roof.translate(0, 0, -rw / 2);

  const tyre = new THREE.CylinderGeometry(p.wr, p.wr, 0.24, 22); tyre.rotateX(Math.PI / 2);
  const rim = new THREE.CylinderGeometry(p.wr * 0.64, p.wr * 0.64, 0.25, 18); rim.rotateX(Math.PI / 2);
  const pillar = new THREE.BoxGeometry(0.1, p.roofY - p.beltY, p.W * 0.845);
  geoCache[type] = { body, glass, roof, tyre, rim, pillar, p };
  return geoCache[type];
}

const matCache = {};
function paint(hex) {
  if (!matCache[hex]) {
    matCache[hex] = new THREE.MeshPhysicalMaterial({
      color: hex, metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.3,
    });
  }
  return matCache[hex];
}
const shared = {};
function sharedMats() {
  if (shared.glass) return shared;
  shared.glass = new THREE.MeshPhysicalMaterial({ color: 0x0c1218, roughness: 0.03, metalness: 0.1, clearcoat: 1, envMapIntensity: 2 });
  shared.tyre = new THREE.MeshStandardMaterial({ color: 0x1a1a1b, roughness: 0.85 });
  shared.rim = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.25, metalness: 1 });
  shared.black = new THREE.MeshStandardMaterial({ color: 0x0e0f10, roughness: 0.5, metalness: 0.2 });
  shared.head = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, metalness: 0.5, emissive: 0x9aa8b8, emissiveIntensity: 0.4 });
  shared.tail = new THREE.MeshStandardMaterial({ color: 0x8a0a0a, roughness: 0.2, emissive: 0x500000, emissiveIntensity: 0.6 });
  shared.plateW = new THREE.MeshStandardMaterial({ color: 0xf6f6f2, roughness: 0.4 });
  shared.plateY = new THREE.MeshStandardMaterial({ color: 0xf2c418, roughness: 0.4 });
  shared.board = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  shared.boardTop = new THREE.MeshStandardMaterial({ color: 0x2f6fd8, roughness: 0.5 });
  shared.priceTex = [4995, 6495, 7995, 8995, 9495, 10995, 12495, 13995, 5995, 11495].map((p) => new THREE.MeshBasicMaterial({ map: priceTexture(p.toLocaleString('en-GB')) }));
  return shared;
}

export function makeCar(type = 'hatch', color = 0x1d1f22) {
  const S = sharedMats();
  const g = geos(type), p = g.p;
  const car = new THREE.Group();
  const add = (geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true; car.add(m); return m;
  };
  const pm = paint(color);
  const body = add(g.body, pm); body.userData.carPart = 'body';
  const glass = add(g.glass, S.glass); glass.userData.carPart = 'glass';
  add(g.roof, pm).userData.carPart = 'body';
  const bx = (p.roofFX + p.roofRX) / 2 + 0.1;
  add(g.pillar, S.black, bx, (p.roofY + p.beltY) / 2, 0).userData.carPart = 'body';
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const t = add(g.tyre, S.tyre, sx * p.wb / 2, p.wr, sz * (p.W / 2 - 0.13)); t.userData.carPart = 'tyre';
    add(g.rim, S.rim, sx * p.wb / 2, p.wr, sz * (p.W / 2 - 0.12)).userData.carPart = 'tyre';
  }
  // lights, grille, plates
  const L2 = p.L / 2;
  const indMat = new THREE.MeshStandardMaterial({ color: 0xff8a1a, emissive: 0xff7a00, emissiveIntensity: 0, roughness: 0.3 });
  for (const sz of [-1, 1]) {
    add(new THREE.BoxGeometry(0.1, 0.11, 0.36), S.head, L2 - 0.12, p.hoodY - 0.08, sz * (p.W / 2 - 0.28));
    add(new THREE.BoxGeometry(0.08, 0.12, 0.3), S.tail, -L2 + 0.05, p.beltY - 0.14, sz * (p.W / 2 - 0.24));
    add(new THREE.BoxGeometry(0.06, 0.05, 0.12), indMat, L2 - 0.1, p.hoodY - 0.2, sz * (p.W / 2 - 0.12));
    add(new THREE.BoxGeometry(0.06, 0.05, 0.12), indMat, -L2 + 0.06, p.beltY - 0.3, sz * (p.W / 2 - 0.12));
    // mirrors
    add(new THREE.BoxGeometry(0.16, 0.11, 0.18), pm, p.cowlX - 0.15, p.cowlY + 0.08, sz * (p.W / 2 + 0.05));
  }
  add(new THREE.BoxGeometry(0.06, 0.2, p.W * 0.5), S.black, L2 - 0.02, p.b + 0.28, 0);
  add(new THREE.BoxGeometry(0.03, 0.11, 0.52), S.plateW, L2 + 0.03, p.b + 0.1, 0);
  add(new THREE.BoxGeometry(0.03, 0.11, 0.52), S.plateY, -L2 - 0.0, p.beltY - 0.4, 0);

  // price sticker on windscreen
  {
    const dx = p.roofFX - p.cowlX, dy = p.roofY - p.cowlY;
    const nx = dy, ny = -dx, nl = Math.hypot(nx, ny);
    const holder = new THREE.Group();
    holder.position.set(p.cowlX + dx * 0.3 + (nx / nl) * 0.075, p.cowlY + dy * 0.3 + (ny / nl) * 0.075, p.W * 0.18);
    holder.rotation.z = Math.atan2(ny, nx);
    const st = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.26), S.priceTex[Math.floor(rand() * S.priceTex.length)]);
    st.rotation.y = Math.PI / 2;
    holder.add(st); car.add(holder);
    st.raycast = () => {};
  }
  // roof price board (A-frame)
  if (rand() < 0.8) {
    const rb = new THREE.Group();
    rb.position.set((p.roofFX + p.roofRX) / 2, p.roofY + 0.2, 0);
    for (const s of [-1, 1]) {
      const pl = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.75), S.board);
      pl.position.x = s * 0.07; pl.rotation.z = s * 0.38; pl.castShadow = true; rb.add(pl);
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.08, 0.76), S.boardTop);
      top.position.set(s * 0.025, 0.12, 0); top.rotation.z = s * 0.38; rb.add(top);
    }
    car.add(rb);
  }

  mergeByMaterial(car, glass);
  car.userData = { isCar: true, glass, indMat, alarm: 0, type, len: p.L, wid: p.W, height: p.roofY };
  return car;
}

// collapse a car's many small meshes into one mesh per material (big draw-call saving)
function mergeByMaterial(car, keep) {
  car.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(car.matrixWorld).invert();
  const buckets = new Map();
  const remove = [];
  car.traverse((o) => {
    if (!o.isMesh || o === keep || o.raycast !== THREE.Mesh.prototype.raycast) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (!buckets.has(o.material)) buckets.set(o.material, { geos: [], part: o.userData.carPart || 'body' });
    buckets.get(o.material).geos.push(g);
    remove.push(o);
  });
  for (const o of remove) o.parent.remove(o);
  for (const [mat, b] of buckets) {
    const m = new THREE.Mesh(mergeGeometries(b.geos), mat);
    m.castShadow = true; m.receiveShadow = true;
    m.userData.carPart = b.part === 'glass' ? 'body' : b.part;
    car.add(m);
  }
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

export function placeCars(scene) {
  const group = new THREE.Group(); scene.add(group);
  const cars = [];
  const gaps = LAYOUT.columns;
  LAYOUT.rows.forEach((rz, ri) => {
    for (let x = -26.5; x <= 26.6; x += 3.0) {
      if (gaps.some((g) => Math.abs(g - x) < 2.1)) continue;
      if (rand() < 0.06) continue; // the odd empty bay
      const car = makeCar(pickType(), pickColor());
      const face = ri === 2 ? Math.PI / 2 : -Math.PI / 2;
      car.rotation.y = face + 0.35 * (ri === 2 ? -1 : 1) + (rand() - 0.5) * 0.05;
      car.position.set(x + (rand() - 0.5) * 0.2, 0.14, rz + (rand() - 0.5) * 0.2);
      group.add(car);
      cars.push({ car, row: ri, x: car.position.x, z: car.position.z });
    }
  });
  // a few cars on display inside the showroom
  [[-19, -35], [-10, -34.5], [3, -35], [12, -34.2]].forEach(([x, z], i) => {
    const car = makeCar(['saloon', 'suv', 'hatch', 'suv'][i], [0xe9ebec, 0x1e63d4, 0xb3141c, 0x111214][i]);
    car.rotation.y = -Math.PI / 2 + 0.5 * (i % 2 ? 1 : -1);
    car.position.set(x, 0.2, z);
    group.add(car);
  });
  // traffic parked on the near side + far side of road
  [[-46, 3.6, Math.PI], [-28, 3.6, Math.PI], [24, 3.6, Math.PI], [-52, -3.6, 0]].forEach(([x, z, r]) => {
    const car = makeCar(pickType(), pickColor());
    car.rotation.y = r; car.position.set(x, 0, z); group.add(car);
  });
  // merge every car into shared per-material meshes; keep each car's glass + indicator lamps
  // separate (glass cracks, indicators flash on alarm). Hits on merged parts resolve by proximity.
  const all = [];
  group.children.forEach((c) => all.push(c));
  const keepers = new Set();
  for (const car of all) {
    keepers.add(car.userData.glass);
    car.traverse((o) => { if (o.isMesh && o.material === car.userData.indMat) keepers.add(o); });
  }
  const merged = new THREE.Group(); group.add(merged);
  mergeStatic(group, (o) => keepers.has(o), merged);
  merged.children.forEach((m) => { if (!m.userData.carPart) m.userData.carPart = 'body'; });
  group.userData.allCars = all;
  return { group, cars };
}

export function nearestCar(group, point) {
  let best = null, bd = Infinity;
  for (const c of group.userData.allCars) {
    const d = c.position.distanceToSquared(point);
    if (d < bd) { bd = d; best = c; }
  }
  return bd < 9 ? best : null;
}
