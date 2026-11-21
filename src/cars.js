import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rand, priceTexture } from './textures.js';
import { LAYOUT } from './world.js';

const TYPES = {
  hatch: { L: 4.05, W: 1.76, wb: 2.5, wr: 0.31, b: 0.26, hoodY: 0.82, cowlX: 0.72, cowlY: 0.95, roofFX: -0.12, roofY: 1.45, roofRX: -1.45, glassRX: -1.9, beltY: 0.99 },
  suv: { L: 4.45, W: 1.84, wb: 2.66, wr: 0.35, b: 0.34, hoodY: 1.0, cowlX: 0.88, cowlY: 1.1, roofFX: 0.0, roofY: 1.68, roofRX: -1.72, glassRX: -2.08, beltY: 1.14 },
  x6: { L: 4.9, W: 1.95, wb: 2.93, wr: 0.39, b: 0.4, hoodY: 1.06, cowlX: 0.95, cowlY: 1.16, roofFX: 0.05, roofY: 1.66, roofRX: -0.95, glassRX: -2.15, beltY: 1.16 },
  saloon: { L: 4.6, W: 1.8, wb: 2.75, wr: 0.31, b: 0.25, hoodY: 0.8, cowlX: 0.95, cowlY: 0.93, roofFX: 0.12, roofY: 1.41, roofRX: -1.05, glassRX: -1.65, beltY: 0.99 },
};

const V3 = THREE.Vector3;
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

// ---------- shared materials ----------
const matCache = {};
function paint(hex) {
  if (!matCache[hex]) {
    matCache[hex] = new THREE.MeshPhysicalMaterial({ color: hex, metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.3 });
  }
  return matCache[hex];
}
const S = {};
function sharedMats() {
  if (S.glass) return S;
  S.glass = new THREE.MeshPhysicalMaterial({ color: 0x0c1218, roughness: 0.03, metalness: 0.1, clearcoat: 1, envMapIntensity: 2 });
  S.trim = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.45 });
  S.char = new THREE.MeshStandardMaterial({ color: 0x161412, roughness: 1, metalness: 0.2 });
  S.charTrim = new THREE.MeshStandardMaterial({ color: 0x0c0b0a, roughness: 1 });
  S.sign = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 });
  S.priceTex = [4995, 6495, 7995, 8995, 9495, 10995, 12495, 13995, 5995, 11495].map((p) => new THREE.MeshBasicMaterial({ map: priceTexture(p.toLocaleString('en-GB')) }));
  return S;
}

const tmpColor = new THREE.Color();
function prep(geo, matrix, hex) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
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
    parts.push(prep(new THREE.BoxGeometry(0.03, 0.3, 0.75), M4(s * 0.07, 0, 0, 0, 0, s * 0.38), 0xffffff));
    parts.push(prep(new THREE.BoxGeometry(0.035, 0.08, 0.76), M4(s * 0.025, 0.12, 0, 0, 0, s * 0.38), 0x2f6fd8));
  }
  SIGN_GEO = mergeGeometries(parts);
  return SIGN_GEO;
}

// Build one car as 4 meshes: paint, glass, trim (vertex-coloured), indicator lamps.
export function makeCar(type = 'hatch', color = 0x1d1f22, opts = {}) {
  sharedMats();
  const g = geos(type), p = g.p, L2 = p.L / 2;
  const car = new THREE.Group();
  car.rotation.order = 'YXZ';
  const paintG = [], trimG = [], indG = [];
  paintG.push(prep(g.body, M4()), prep(g.roof, M4()));
  for (const sz of [-1, 1]) paintG.push(prep(new THREE.BoxGeometry(0.16, 0.11, 0.18), M4(p.cowlX - 0.15, p.cowlY + 0.08, sz * (p.W / 2 + 0.05))));
  trimG.push(prep(g.pillar, M4((p.roofFX + p.roofRX) / 2 + 0.1, (p.roofY + p.beltY) / 2, 0), 0x0e0f10));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    trimG.push(prep(g.tyre, M4(sx * p.wb / 2, p.wr, sz * (p.W / 2 - 0.13)), 0x19191a));
    trimG.push(prep(g.rim, M4(sx * p.wb / 2, p.wr, sz * (p.W / 2 - 0.12)), 0xc8ccd0));
  }
  for (const sz of [-1, 1]) {
    trimG.push(prep(new THREE.BoxGeometry(0.1, 0.11, 0.36), M4(L2 - 0.12, p.hoodY - 0.08, sz * (p.W / 2 - 0.28)), 0xeef2f6));
    trimG.push(prep(new THREE.BoxGeometry(0.08, 0.12, 0.3), M4(-L2 + 0.05, p.beltY - 0.14, sz * (p.W / 2 - 0.24)), 0x9a0c0c));
    indG.push(prep(new THREE.BoxGeometry(0.06, 0.05, 0.12), M4(L2 - 0.1, p.hoodY - 0.2, sz * (p.W / 2 - 0.12))));
    indG.push(prep(new THREE.BoxGeometry(0.06, 0.05, 0.12), M4(-L2 + 0.06, p.beltY - 0.3, sz * (p.W / 2 - 0.12))));
  }
  if (opts.kidney) {
    // twin "kidney" grille + chrome surrounds
    for (const sz of [-1, 1]) {
      trimG.push(prep(new THREE.BoxGeometry(0.05, 0.17, 0.24), M4(L2 + 0.005, p.b + 0.42, sz * 0.15), 0xd0d4d8));
      trimG.push(prep(new THREE.BoxGeometry(0.05, 0.13, 0.2), M4(L2 + 0.02, p.b + 0.42, sz * 0.15), 0x08090a));
    }
  } else {
    trimG.push(prep(new THREE.BoxGeometry(0.06, 0.2, p.W * 0.5), M4(L2 - 0.02, p.b + 0.28, 0), 0x0e0f10));
  }
  trimG.push(prep(new THREE.BoxGeometry(0.03, 0.11, 0.52), M4(L2 + 0.03, p.b + 0.1, 0), 0xf6f6f2));
  trimG.push(prep(new THREE.BoxGeometry(0.03, 0.11, 0.52), M4(-L2, p.beltY - 0.4, 0), 0xf2c418));

  const indMat = new THREE.MeshStandardMaterial({ color: 0xff8a1a, emissive: 0xff7a00, emissiveIntensity: 0, roughness: 0.3 });
  const mk = (geo, mat, part, cast = true) => {
    const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true;
    m.userData.carPart = part; car.add(m); return m;
  };
  const paintMesh = mk(mergeGeometries(paintG), paint(color), 'body');
  const glass = mk(g.glass, S.glass, 'glass', false);
  const trimMesh = mk(mergeGeometries(trimG), S.trim, 'trim');
  const indMesh = mk(mergeGeometries(indG), indMat, 'body', false);
  indMesh.visible = false; // only drawn while the alarm is flashing

  // windscreen price sticker + roof A-board are drawn instanced by CarSystem
  let sticker = null, sign = null;
  if (!opts.plain) {
    const dx = p.roofFX - p.cowlX, dy = p.roofY - p.cowlY;
    const nx = dy, ny = -dx, nl = Math.hypot(nx, ny);
    const holder = M4(p.cowlX + dx * 0.3 + (nx / nl) * 0.075, p.cowlY + dy * 0.3 + (ny / nl) * 0.075, p.W * 0.18, 0, 0, Math.atan2(ny, nx));
    sticker = { tex: Math.floor(rand() * 10), local: holder.multiply(M4(0, 0, 0, 0, Math.PI / 2, 0)) };
    if (rand() < 0.8) sign = { local: M4((p.roofFX + p.roofRX) / 2, p.roofY + 0.2, 0) };
  }

  car.userData = {
    isCar: true, type, p, glass, paintMesh, trimMesh, indMesh, indMat, paintMat: paint(color),
    sticker, sign, alarm: 0, hp: 10, glassHits: 0, tyres: {}, tilt: { pitch: 0, roll: 0, drop: 0 },
    len: p.L, wid: p.W, height: p.roofY,
  };
  return car;
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
      const car = makeCar(['saloon', 'suv', 'hatch', 'suv'][i], [0xe9ebec, 0x1e63d4, 0xb3141c, 0x111214][i]);
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

    // instanced roof boards + windscreen stickers
    const withSign = this.all.filter((c) => c.userData.sign);
    this.signMesh = new THREE.InstancedMesh(signGeo(), S.sign, withSign.length);
    this.signMesh.castShadow = true; this.signMesh.userData.roofSign = true;
    this.signOwners = [];
    withSign.forEach((c, i) => { c.userData.sign.mesh = this.signMesh; c.userData.sign.id = i; this.signOwners[i] = c; });
    group.add(this.signMesh);
    this.stickerMeshes = S.priceTex.map((mat, t) => {
      const owners = this.all.filter((c) => c.userData.sticker && c.userData.sticker.tex === t);
      const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.34, 0.26), mat, Math.max(1, owners.length));
      im.count = owners.length; im.raycast = () => {};
      owners.forEach((c, i) => { c.userData.sticker.mesh = im; c.userData.sticker.id = i; });
      group.add(im);
      return im;
    });
    for (const c of this.all) {
      c.userData.orig = { pos: c.position.clone(), rotY: c.rotation.y };
      this.syncInstances(c);
    }
  }

  add(car) { this.group.add(car); this.all.push(car); }

  addStatic(car) {
    this.add(car);
    car.userData.orig = { pos: car.position.clone(), rotY: car.rotation.y };
    this.syncInstances(car);
  }

  addDynamic(car) {
    this.group.add(car); this.all.push(car);
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
    if (u.sticker && u.sticker.mesh) {
      const hide = u.glassHits >= 2 || u.destroyed;
      u.sticker.mesh.setMatrixAt(u.sticker.id, hide ? ZERO : m.multiplyMatrices(car.matrixWorld, u.sticker.local));
      u.sticker.mesh.instanceMatrix.needsUpdate = true;
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
