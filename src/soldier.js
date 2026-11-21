import * as THREE from 'three';
import { groundHeight } from './world.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// phones: skip tiny details on newly spawned soldiers
export const SOLDIER_DETAIL = { low: false };

let M = null;
const HIT_MAT = new THREE.MeshBasicMaterial({ visible: false });
const noRay = () => {};

function mats(T) {
  if (M) return M;
  const s = (o) => new THREE.MeshStandardMaterial(o);
  const flag = document.createElement('canvas'); flag.width = 24; flag.height = 18;
  const fc = flag.getContext('2d');
  fc.fillStyle = '#239f40'; fc.fillRect(0, 0, 24, 6); fc.fillStyle = '#fff'; fc.fillRect(0, 6, 24, 6); fc.fillStyle = '#da0000'; fc.fillRect(0, 12, 24, 6);
  const ft = new THREE.CanvasTexture(flag); ft.colorSpace = THREE.SRGBColorSpace;
  M = {
    camo: s({ map: T.camo, roughness: 0.95 }),
    camoDark: s({ map: T.camo, roughness: 0.95, color: 0x8a8a78 }),
    vest: s({ color: 0x6b6446, roughness: 0.9 }),
    vestHeavy: s({ color: 0x2f3229, roughness: 0.6, metalness: 0.3 }),
    pouch: s({ color: 0x5a5438, roughness: 0.95 }),
    skins: [0xc89a78, 0xb08060, 0xa47454, 0xd3a888].map((c) => s({ color: c, roughness: 0.7 })),
    helmet: s({ color: 0x777256, roughness: 0.75 }),
    helmetHeavy: s({ color: 0x24261f, roughness: 0.5, metalness: 0.3 }),
    visor: s({ color: 0x0a0c0e, roughness: 0.05, metalness: 0.8 }),
    glove: s({ color: 0x1d1c1a, roughness: 0.8 }),
    boot: s({ color: 0x4a3a2a, roughness: 0.8 }),
    scarf: s({ color: 0x4e5a3e, roughness: 1 }),
    gunMetal: s({ color: 0x1c1d1f, roughness: 0.4, metalness: 0.85 }),
    wood: s({ color: 0x6a3a1e, roughness: 0.55 }),
    flag: s({ map: ft, roughness: 0.8 }),
    glint: new THREE.SpriteMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
  };
  return M;
}

const G = {};
function geos() {
  if (G.head) return G;
  G.pelvis = new THREE.BoxGeometry(0.36, 0.2, 0.22);
  G.torso = new THREE.BoxGeometry(0.4, 0.52, 0.24);
  G.vest = new THREE.BoxGeometry(0.45, 0.42, 0.31);
  G.pouch = new THREE.BoxGeometry(0.09, 0.12, 0.06);
  G.head = new THREE.SphereGeometry(0.115, 16, 12);
  G.helmet = new THREE.SphereGeometry(0.142, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
  G.boonie = new THREE.CylinderGeometry(0.2, 0.2, 0.02, 16);
  G.scarf = new THREE.CylinderGeometry(0.1, 0.12, 0.1, 12);
  G.upper = new THREE.CapsuleGeometry(0.058, 0.2, 4, 8);
  G.fore = new THREE.CapsuleGeometry(0.05, 0.18, 4, 8);
  G.hand = new THREE.SphereGeometry(0.05, 8, 6);
  G.thigh = new THREE.CapsuleGeometry(0.078, 0.3, 4, 8);
  G.shin = new THREE.CapsuleGeometry(0.064, 0.3, 4, 8);
  G.boot = new THREE.BoxGeometry(0.12, 0.11, 0.27);
  G.patch = new THREE.PlaneGeometry(0.08, 0.06);
  G.visor = new THREE.BoxGeometry(0.2, 0.07, 0.05);
  G.headHit = new THREE.SphereGeometry(0.175, 8, 6);
  G.torsoHit = new THREE.BoxGeometry(0.52, 0.66, 0.38);
  // rifle parts
  G.receiver = new THREE.BoxGeometry(0.05, 0.08, 0.36);
  G.barrel = new THREE.CylinderGeometry(0.012, 0.012, 0.42, 6); G.barrel.rotateX(Math.PI / 2);
  G.longBarrel = new THREE.CylinderGeometry(0.013, 0.013, 0.7, 6); G.longBarrel.rotateX(Math.PI / 2);
  G.handguard = new THREE.BoxGeometry(0.055, 0.06, 0.2);
  G.stock = new THREE.BoxGeometry(0.04, 0.1, 0.28);
  G.mag = new THREE.BoxGeometry(0.035, 0.18, 0.07);
  G.scope = new THREE.CylinderGeometry(0.025, 0.025, 0.28, 8); G.scope.rotateX(Math.PI / 2);
  return G;
}

const POSES = {
  stand: { hipsY: 0.95, spineX: 0.05, neckX: 0, shRx: -0.5, shRy: 0.3, shRz: 0, elR: -1.5, shLx: -0.9, shLy: -0.5, shLz: 0, elL: -0.9, hipLx: 0, knL: 0.05, hipRx: 0, knR: 0.05, gunAim: 0 },
  aim: { hipsY: 0.95, spineX: -0.08, neckX: 0.1, shRx: -1.0, shRy: 0.35, shRz: 0, elR: -1.4, shLx: -1.45, shLy: -0.5, shLz: 0, elL: -0.35, hipLx: -0.15, knL: 0.2, hipRx: 0.15, knR: 0.1, gunAim: 1 },
  kneel: { hipsY: 0.55, spineX: 0.42, neckX: 0.25, shRx: -0.6, shRy: 0.3, shRz: 0, elR: -1.5, shLx: -1.0, shLy: -0.5, shLz: 0, elL: -0.9, hipLx: -1.45, knL: 1.45, hipRx: 0.05, knR: 1.5, gunAim: 0 },
  kneelAim: { hipsY: 0.58, spineX: -0.05, neckX: 0.1, shRx: -1.0, shRy: 0.35, shRz: 0, elR: -1.4, shLx: -1.45, shLy: -0.5, shLz: 0, elL: -0.35, hipLx: -1.45, knL: 1.45, hipRx: 0.05, knR: 1.5, gunAim: 1 },
  run: { hipsY: 0.93, spineX: 0.28, neckX: -0.15, shRx: -0.5, shRy: 0.3, shRz: 0, elR: -1.5, shLx: -0.9, shLy: -0.5, shLz: 0, elL: -0.9, hipLx: 0, knL: 0.3, hipRx: 0, knR: 0.3, gunAim: 0 },
  throw: { hipsY: 0.95, spineX: -0.15, neckX: 0.1, shRx: -2.6, shRy: 0, shRz: 0.3, elR: -0.6, shLx: -1.2, shLy: -0.3, shLz: 0, elL: -0.3, hipLx: -0.4, knL: 0.3, hipRx: 0.3, knR: 0.2, gunAim: 0 },
};

export class Soldier {
  constructor(kind, T, scene) {
    this.kind = kind;
    const m = mats(T), g = geos();
    this.scene = scene;
    const root = this.root = new THREE.Group();
    const tilt = this.tilt = new THREE.Group(); root.add(tilt);
    const hips = this.hips = new THREE.Group(); hips.position.y = 0.95; tilt.add(hips);
    const heavy = kind === 'heavy';
    const skin = m.skins[Math.floor(Math.random() * m.skins.length)];
    const camo = heavy ? m.camoDark : m.camo;
    this.meshes = [];

    const mk = (geo, mat, parent, x, y, z, part) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z); mesh.castShadow = true;
      mesh.userData.soldier = this; mesh.userData.part = part;
      parent.add(mesh); this.meshes.push(mesh);
      return mesh;
    };
    const grp = (parent, x, y, z, order = 'XYZ') => { const o = new THREE.Group(); o.position.set(x, y, z); o.rotation.order = order; parent.add(o); return o; };

    mk(g.pelvis, camo, hips, 0, 0, 0, 'torso');
    const spine = this.spine = grp(hips, 0, 0.08, 0);
    mk(g.torso, camo, spine, 0, 0.27, 0, 'torso');
    mk(g.vest, heavy ? m.vestHeavy : m.vest, spine, 0, 0.28, 0, 'torso');
    if (!SOLDIER_DETAIL.low) mk(g.pouch, m.pouch, spine, 0, 0.2, 0.17, 'torso').scale.set(3, 1, 1);
    mk(g.torsoHit, HIT_MAT, spine, 0, 0.27, 0, 'torso');

    const neck = this.neck = grp(spine, 0, 0.55, 0);
    if (!SOLDIER_DETAIL.low) mk(g.scarf, m.scarf, neck, 0, 0.0, 0, 'head');
    const head = mk(g.head, skin, neck, 0, 0.13, 0.01, 'head');
    if (kind === 'sniper') {
      mk(g.boonie, m.camo, neck, 0, 0.21, 0, 'head');
      mk(new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), m.camo, neck, 0, 0.17, 0, 'head');
    } else {
      mk(g.helmet, heavy ? m.helmetHeavy : m.helmet, neck, 0, 0.15, 0, 'head');
    }
    if (heavy) mk(g.visor, m.visor, neck, 0, 0.14, 0.11, 'head');
    mk(g.headHit, HIT_MAT, neck, 0, 0.14, 0, 'head');

    const arm = (side) => {
      const sh = grp(spine, side * 0.25, 0.48, 0, 'ZYX');
      mk(g.upper, camo, sh, 0, -0.14, 0, 'limb');
      if (side > 0 && !SOLDIER_DETAIL.low) { const p = mk(g.patch, m.flag, sh, 0.063, -0.08, 0, 'limb'); p.rotation.y = Math.PI / 2; }
      const el = grp(sh, 0, -0.29, 0);
      mk(g.fore, camo, el, 0, -0.13, 0, 'limb');
      if (!SOLDIER_DETAIL.low) mk(g.hand, m.glove, el, 0, -0.28, 0, 'limb');
      return { sh, el };
    };
    const L = arm(1), R = arm(-1);
    this.shL = L.sh; this.elL = L.el; this.shR = R.sh; this.elR = R.el;

    const leg = (side) => {
      const hp = grp(hips, side * 0.1, -0.06, 0, 'ZYX');
      mk(g.thigh, camo, hp, 0, -0.22, 0, 'limb');
      const kn = grp(hp, 0, -0.44, 0);
      mk(g.shin, camo, kn, 0, -0.21, 0, 'limb');
      mk(g.boot, m.boot, kn, 0, -0.42, 0.05, 'limb');
      return { hp, kn };
    };
    const LL = leg(1), RL = leg(-1);
    this.hipL = LL.hp; this.knL = LL.kn; this.hipR = RL.hp; this.knR = RL.kn;

    // rifle
    const gun = this.gun = grp(spine, -0.08, 0.45, 0.16);
    const gm = (geo, mat, x, y, z, rx = 0) => { const mm = new THREE.Mesh(geo, mat); mm.position.set(x, y, z); mm.rotation.x = rx; mm.castShadow = true; mm.raycast = noRay; gun.add(mm); };
    gm(g.receiver, m.gunMetal, 0, 0, 0.05);
    gm(kind === 'sniper' ? g.longBarrel : g.barrel, m.gunMetal, 0, 0.02, kind === 'sniper' ? 0.55 : 0.43);
    gm(g.handguard, heavy ? m.gunMetal : m.wood, 0, 0.0, 0.3);
    gm(g.stock, heavy ? m.gunMetal : m.wood, 0, -0.03, -0.25);
    if (kind === 'sniper') gm(g.scope, m.gunMetal, 0, 0.08, 0.1);
    else gm(g.mag, m.gunMetal, 0, -0.11, 0.12, 0.35);
    if (heavy) { const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 12), m.gunMetal); drum.rotation.z = Math.PI / 2; drum.position.set(0, -0.1, 0.1); drum.raycast = noRay; gun.add(drum); }
    // collapse the rifle into one mesh per material (5-6 draw calls -> 2)
    {
      const byMat = new Map();
      for (const c of [...gun.children]) {
        if (!c.isMesh) continue;
        c.updateMatrix();
        let geo = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone();
        for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
        geo.applyMatrix4(c.matrix);
        if (!byMat.has(c.material)) byMat.set(c.material, []);
        byMat.get(c.material).push(geo);
        gun.remove(c);
      }
      for (const [mat, list] of byMat) {
        const mm = new THREE.Mesh(mergeGeometries(list), mat);
        mm.castShadow = true; mm.raycast = noRay; gun.add(mm);
      }
    }
    this.muzzle = grp(gun, 0, 0.02, kind === 'sniper' ? 0.92 : 0.66);

    if (kind === 'sniper') {
      this.glint = new THREE.Sprite(m.glint.clone());
      this.glint.position.set(0, 0.08, 0.26); this.glint.scale.setScalar(0.01);
      this.glint.raycast = noRay;
      gun.add(this.glint);
    }

    // only the big parts cast shadows (saves a lot of shadow-pass draw calls)
    const shadowGeos = new Set([g.torso, g.vest, g.helmet, g.thigh, g.shin, g.upper, g.head]);
    root.traverse((o) => { if (o.isMesh && !shadowGeos.has(o.geometry)) o.castShadow = false; });
    gun.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    if (heavy) root.scale.setScalar(1.1);
    this.cur = { ...POSES.stand };
    this.target = POSES.stand;
    this.phase = Math.random() * 10;
    this.speed = 0;
    this.alive = true;
    this.dying = false;
    this.deadTime = 0;
    scene.add(root);
  }

  setPose(name) { this.target = POSES[name]; }

  get position() { return this.root.position; }

  faceTowards(x, z, dt, rate = 8) {
    const want = Math.atan2(x - this.root.position.x, z - this.root.position.z);
    let d = want - this.root.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.root.rotation.y += d * Math.min(1, dt * rate);
  }

  headWorld(out = new THREE.Vector3()) { return this.neck.localToWorld(out.set(0, 0.14, 0)); }
  muzzleWorld(out = new THREE.Vector3()) { return this.muzzle.getWorldPosition(out); }

  die(dir, headshot) {
    if (this.dying) return;
    this.alive = false; this.dying = true; this.deadTime = 0;
    this.headshot = headshot;
    const fwd = new THREE.Vector3(Math.sin(this.root.rotation.y), 0, Math.cos(this.root.rotation.y));
    // fall away from the shot
    const flat = new THREE.Vector3(dir.x, 0, dir.z).normalize();
    this.fallSign = fwd.dot(flat) > 0 ? 1 : -1;
    this.vel = flat.multiplyScalar(headshot ? 0.8 : 2.2);
    this.vel.y = this.onRoof ? 0.5 : 0;
    this.vy = this.vel.y;
    this.angVel = 0;
    this.collapse = headshot ? 1 : 0;
    this.limbRand = [Math.random(), Math.random(), Math.random(), Math.random()];
    // drop rifle
    const gun = this.gun;
    gun.updateWorldMatrix(true, false);
    const wp = new THREE.Vector3(), wq = new THREE.Quaternion();
    gun.matrixWorld.decompose(wp, wq, new THREE.Vector3());
    this.scene.add(gun); gun.position.copy(wp); gun.quaternion.copy(wq);
    if (this.root.scale.x !== 1) gun.scale.setScalar(this.root.scale.x);
    this.gunVel = new THREE.Vector3(flat.x * 1.5 + (Math.random() - 0.5), 1.5, flat.z * 1.5 + (Math.random() - 0.5));
    this.gunSpin = new THREE.Vector3(Math.random() * 6 - 3, Math.random() * 6 - 3, Math.random() * 6 - 3);
    if (this.glint) this.glint.visible = false;
  }

  floorY() {
    const p = this.root.position;
    if (this.roofY !== undefined && p.x > 30.2 && p.x < 48 && p.z > -44 && p.z < -12) return this.roofY;
    return groundHeight(p.x, p.z);
  }

  update(dt) {
    const c = this.cur, t = this.target;
    if (this.dying) { this.updateDeath(dt); return; }
    const k = Math.min(1, dt * 9);
    for (const key in t) c[key] += (t[key] - c[key]) * k;

    // locomotion cycle
    let swing = 0, bob = 0;
    if (this.speed > 0.1) {
      this.phase += dt * this.speed * 2.6;
      const amp = Math.min(0.8, 0.25 + this.speed * 0.13);
      swing = Math.sin(this.phase) * amp;
      bob = Math.abs(Math.cos(this.phase)) * 0.05;
    }
    this.hips.position.y = c.hipsY + bob;
    this.spine.rotation.x = c.spineX;
    this.neck.rotation.x = c.neckX;
    this.shR.rotation.set(c.shRx + swing * 0.15, c.shRy, c.shRz);
    this.shL.rotation.set(c.shLx - swing * 0.15, c.shLy, c.shLz);
    this.elR.rotation.x = c.elR; this.elL.rotation.x = c.elL;
    this.hipL.rotation.x = c.hipLx + swing;
    this.hipR.rotation.x = c.hipRx - swing;
    this.knL.rotation.x = c.knL + (this.speed > 0.1 ? Math.max(0, -Math.sin(this.phase + 0.6)) * 1.1 : 0);
    this.knR.rotation.x = c.knR + (this.speed > 0.1 ? Math.max(0, Math.sin(this.phase + 0.6)) * 1.1 : 0);
    // gun: low-ready vs shouldered
    const a = c.gunAim;
    this.gun.position.set(-0.08 + 0.03 * (1 - a), 0.25 + 0.21 * a, 0.25 - 0.09 * a);
    this.gun.rotation.set(0.7 * (1 - a), 0.35 * (1 - a), 0);
  }

  updateDeath(dt) {
    this.deadTime += dt;
    const r = this.root;
    // collapse (headshot: knees buckle first)
    if (this.collapse > 0 && this.deadTime < 0.35) {
      this.hips.position.y += (0.45 - this.hips.position.y) * Math.min(1, dt * 10);
      this.knL.rotation.x += (1.6 - this.knL.rotation.x) * Math.min(1, dt * 10);
      this.knR.rotation.x += (1.4 - this.knR.rotation.x) * Math.min(1, dt * 10);
      this.hipL.rotation.x += (-1.2 - this.hipL.rotation.x) * Math.min(1, dt * 10);
      this.hipR.rotation.x += (-1.0 - this.hipR.rotation.x) * Math.min(1, dt * 10);
    } else {
      this.angVel += dt * 9;
      const target = (Math.PI / 2) * this.fallSign;
      this.tilt.rotation.x += this.angVel * dt * this.fallSign;
      if (Math.abs(this.tilt.rotation.x) >= Math.PI / 2) { this.tilt.rotation.x = target; this.angVel *= -0.25; }
      const prog = Math.abs(this.tilt.rotation.x) / (Math.PI / 2);
      this.tilt.position.y = 0.14 * prog;
      const ease = Math.min(1, dt * 5);
      this.hips.position.y += (0.95 - this.hips.position.y) * ease;
      this.hipL.rotation.x += (0.15 * this.fallSign - this.hipL.rotation.x) * ease;
      this.hipR.rotation.x += (-0.1 - this.hipR.rotation.x) * ease;
      this.knL.rotation.x += (0.3 + this.limbRand[0] * 0.5 - this.knL.rotation.x) * ease;
      this.knR.rotation.x += (0.1 + this.limbRand[1] * 0.3 - this.knR.rotation.x) * ease;
      this.shL.rotation.x += (-2.4 * this.fallSign - this.shL.rotation.x) * ease;
      this.shL.rotation.z += (0.9 * this.limbRand[2] - this.shL.rotation.z) * ease;
      this.shR.rotation.x += (-2.0 * this.fallSign - this.shR.rotation.x) * ease;
      this.shR.rotation.z += (-0.9 * this.limbRand[3] - this.shR.rotation.z) * ease;
      this.elL.rotation.x += (-0.3 - this.elL.rotation.x) * ease;
      this.elR.rotation.x += (-0.5 - this.elR.rotation.x) * ease;
      this.spine.rotation.x += (0 - this.spine.rotation.x) * ease;
      this.neck.rotation.x += (-0.3 * this.fallSign - this.neck.rotation.x) * ease;
    }
    // slide + gravity (bodies can fall off the roof)
    r.position.x += this.vel.x * dt; r.position.z += this.vel.z * dt;
    this.vel.x *= Math.max(0, 1 - dt * 4); this.vel.z *= Math.max(0, 1 - dt * 4);
    const floor = this.floorY();
    if (r.position.y > floor + 0.001 || this.vy > 0) {
      this.vy -= 9.8 * dt;
      r.position.y += this.vy * dt;
      if (r.position.y < floor) { r.position.y = floor; this.vy = 0; }
    } else r.position.y = floor;

    // dropped rifle
    if (this.gunVel) {
      const gp = this.gun.position;
      this.gunVel.y -= 9.8 * dt;
      gp.addScaledVector(this.gunVel, dt);
      this.gun.rotation.x += this.gunSpin.x * dt; this.gun.rotation.y += this.gunSpin.y * dt; this.gun.rotation.z += this.gunSpin.z * dt;
      const gf = (this.roofY !== undefined && gp.x > 30.2 && gp.x < 48 && gp.z > -44 && gp.z < -12) ? this.roofY + 0.04 : groundHeight(gp.x, gp.z) + 0.04;
      if (gp.y < gf) {
        gp.y = gf; this.gunVel.multiplyScalar(0.3); this.gunVel.y = Math.abs(this.gunVel.y) * 0.2; this.gunSpin.multiplyScalar(0.4);
        this.gun.rotation.x = THREE.MathUtils.lerp(this.gun.rotation.x, 0, 0.5);
        this.gun.rotation.z = THREE.MathUtils.lerp(this.gun.rotation.z, Math.PI / 2, 0.5);
        if (this.gunVel.length() < 0.2) this.gunVel = null;
      }
    }
  }

  dispose() {
    this.scene.remove(this.root);
    this.scene.remove(this.gun);
  }
}
