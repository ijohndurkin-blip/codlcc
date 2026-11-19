import * as THREE from 'three';
import { makeCar } from './cars.js';
import { LAYOUT, groundHeight } from './world.js';

const V3 = THREE.Vector3;
const HIT_MAT = new THREE.MeshBasicMaterial({ visible: false });
const DOOR = new V3(-5.6, 0, -29.0);

function nameTag(text, color = '#9fe870') {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 10, 256, 44);
  ctx.fillStyle = color; ctx.font = '700 30px Rajdhani, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 33);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, sizeAttenuation: false, transparent: true, depthWrite: false }));
  s.scale.set(0.055, 0.014, 1); s.raycast = () => {};
  return s;
}

const POSES = {
  stand: { shRx: 0.05, shRz: -0.12, elR: -0.15, shLx: 0.05, shLz: 0.12, elL: -0.15, spineX: 0, hipsY: 0.95, knee: 0.04 },
  walk: { shRx: 0, shRz: -0.1, elR: -0.3, shLx: 0, shLz: 0.1, elL: -0.3, spineX: 0.06, hipsY: 0.94, knee: 0.1 },
  shout: { shRx: -2.75, shRz: -0.2, elR: -0.7, shLx: -0.3, shLz: 0.75, elL: -1.9, spineX: -0.12, hipsY: 0.95, knee: 0.05 },
  chat: { shRx: -0.6, shRz: -0.3, elR: -1.2, shLx: -0.3, shLz: 0.2, elL: -0.9, spineX: 0.02, hipsY: 0.95, knee: 0.05 },
  wave: { shRx: -3.0, shRz: -0.15, elR: -0.15, shLx: 0.05, shLz: 0.15, elL: -0.2, spineX: -0.05, hipsY: 0.95, knee: 0.04 },
  wash: { shRx: -0.85, shRz: 0.25, elR: -0.55, shLx: -1.15, shLz: -0.3, elL: -0.5, spineX: 0.12, hipsY: 0.9, knee: 0.25 },
  cower: { shRx: -2.4, shRz: 0.5, elR: -2.2, shLx: -2.4, shLz: -0.5, elL: -2.2, spineX: 0.6, hipsY: 0.6, knee: 1.3 },
};

export class Person {
  constructor(scene, o) {
    this.scene = scene; this.name = o.name; this.id = o.id;
    const root = this.root = new THREE.Group();
    const tilt = this.tilt = new THREE.Group(); root.add(tilt);
    const hips = this.hips = new THREE.Group(); hips.position.y = 0.95; tilt.add(hips);
    const s = (c, r = 0.85, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
    const skin = s(o.skin || 0xd9a487, 0.38);  // a shiny baldy head
    const top = s(o.top), legs = s(o.legs), shoes = s(o.shoes, 0.5);
    const sleeves = o.sleeves === 'skin' ? skin : o.sleeves ? s(o.sleeves) : top;
    const b = o.bulk || 1;
    const mk = (geo, mat, parent, x, y, z, part, cast = true) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast;
      m.userData.civilian = this; m.userData.part = part; parent.add(m); return m;
    };
    const grp = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.order = 'ZYX'; parent.add(g); return g; };
    mk(new THREE.BoxGeometry(0.36, 0.2, 0.22), legs, hips, 0, 0, 0, 'torso');
    const spine = this.spine = grp(hips, 0, 0.08, 0);
    mk(new THREE.BoxGeometry(0.42 * b, 0.5, 0.25 * (0.6 + 0.4 * b)), top, spine, 0, 0.27, 0, 'torso');
    if (b > 1.2) {
      // bodybuilder: pecs, traps, delts
      for (const x of [-1, 1]) {
        mk(new THREE.SphereGeometry(0.13, 12, 8), top, spine, x * 0.12, 0.38, 0.1, 'torso').scale.set(1.1, 0.75, 0.6);
        mk(new THREE.SphereGeometry(0.12, 12, 8), sleeves, spine, x * (0.25 + (b - 1) * 0.13), 0.47, 0, 'torso');
      }
      mk(new THREE.SphereGeometry(0.17, 12, 8), skin, spine, 0, 0.5, -0.03, 'torso').scale.set(1.5, 0.55, 0.8);
    } else {
      mk(new THREE.SphereGeometry(0.2, 14, 10), top, spine, 0, 0.16, 0.06, 'torso').scale.set(1.05, 0.9, 0.75); // a bit of a belly
    }
    if (o.backText) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 200;
      const ctx = c.getContext('2d'); ctx.fillStyle = '#' + new THREE.Color(o.top).getHexString(); ctx.fillRect(0, 0, 256, 200);
      ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '800 52px Arial, sans-serif'; ctx.fillText(o.backText[0], 128, 70);
      ctx.font = '700 40px Arial, sans-serif'; ctx.fillText(o.backText[1], 128, 130);
      ctx.fillStyle = '#e8c020'; ctx.fillRect(20, 165, 216, 10);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const back = mk(new THREE.PlaneGeometry(0.38, 0.3), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 }), spine, 0, 0.33, -0.128, 'torso', false);
      back.rotation.y = Math.PI;
      const badge = mk(new THREE.PlaneGeometry(0.1, 0.08), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 }), spine, 0.11, 0.42, 0.128, 'torso', false);
      // reflective strips on the legs
      this.strips = true;
    }
    if (o.shirtFront) {
      mk(new THREE.BoxGeometry(0.11, 0.42, 0.02), s(o.shirtFront, 0.7), spine, 0, 0.3, 0.13, 'torso', false);
      mk(new THREE.BoxGeometry(0.045, 0.34, 0.025), s(o.tie, 0.6), spine, 0, 0.3, 0.145, 'torso', false);
    }
    if (o.hood) mk(new THREE.TorusGeometry(0.12, 0.05, 8, 14, Math.PI), top, spine, 0, 0.53, -0.08, 'torso').rotation.set(-0.3, 0, Math.PI);
    mk(new THREE.BoxGeometry(0.52, 0.66, 0.36), HIT_MAT, spine, 0, 0.27, 0, 'torso');
    const neck = this.neck = grp(spine, 0, 0.55, 0);
    mk(new THREE.CylinderGeometry(0.055, 0.06, 0.08, 10), skin, neck, 0, 0.0, 0, 'head');
    const head = mk(new THREE.SphereGeometry(0.118, 20, 14), skin, neck, 0, 0.13, 0.01, 'head');
    head.scale.set(0.95, 1.05, 1);
    for (const x of [-1, 1]) mk(new THREE.SphereGeometry(0.03, 8, 6), skin, neck, x * 0.112, 0.12, 0, 'head', false).scale.set(0.5, 1, 0.8);
    mk(new THREE.BoxGeometry(0.03, 0.045, 0.04), skin, neck, 0, 0.11, 0.125, 'head', false);
    for (const x of [-1, 1]) mk(new THREE.BoxGeometry(0.04, 0.012, 0.01), s(0x3a2a20), neck, x * 0.04, 0.16, 0.115, 'head', false);
    if (o.hair) mk(new THREE.SphereGeometry(0.123, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), s(o.hair, 1), neck, 0, 0.14, 0.0, 'head', false);
    if (o.beard) mk(new THREE.SphereGeometry(0.1, 12, 8, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), s(o.beard, 1), neck, 0, 0.13, 0.025, 'head', false);
    mk(new THREE.SphereGeometry(0.16, 8, 6), HIT_MAT, neck, 0, 0.13, 0, 'head');
    const arm = (side) => {
      const sh = grp(spine, side * (0.25 + (b - 1) * 0.15), 0.47, 0);
      mk(new THREE.CapsuleGeometry(0.06 * b, 0.18, 4, 8), sleeves, sh, 0, -0.13, 0, 'limb');
      const el = grp(sh, 0, -0.27, 0);
      mk(new THREE.CapsuleGeometry(0.052 * (1 + (b - 1) * 0.7), 0.16, 4, 8), sleeves, el, 0, -0.12, 0, 'limb');
      mk(new THREE.SphereGeometry(0.048, 8, 6), skin, el, 0, -0.26, 0, 'limb', false);
      return { sh, el };
    };
    const L = arm(1), R = arm(-1);
    this.shL = L.sh; this.elL = L.el; this.shR = R.sh; this.elR = R.el;
    const leg = (side) => {
      const hp = grp(hips, side * 0.1, -0.06, 0);
      mk(new THREE.CapsuleGeometry(0.08, 0.28, 4, 8), legs, hp, 0, -0.22, 0, 'limb');
      const kn = grp(hp, 0, -0.44, 0);
      mk(new THREE.CapsuleGeometry(0.066, 0.3, 4, 8), legs, kn, 0, -0.21, 0, 'limb');
      mk(new THREE.BoxGeometry(0.12, 0.09, 0.27), shoes, kn, 0, -0.43, 0.05, 'limb', false);
      if (o.backText) mk(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 10), s(0xd8dde2, 0.2, 0.8), kn, 0, -0.25, 0, 'limb', false);
      return { hp, kn };
    };
    const LL = leg(1), RL = leg(-1);
    this.hipL = LL.hp; this.knL = LL.kn; this.hipR = RL.hp; this.knR = RL.kn;
    if (o.paper) {
      this.paper = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.3), new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.6, side: THREE.DoubleSide, emissive: 0x333333 }));
      this.paper.position.set(0, -0.36, 0.02); this.paper.raycast = () => {}; this.paper.visible = false;
      this.elR.add(this.paper);
    }
    if (o.lance) {
      const lance = this.lance = new THREE.Group();
      lance.position.set(-0.05, 0.22, 0.32); lance.rotation.x = 0.55;
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.95, 6), s(0x2a2a2a, 0.4, 0.6));
      rod.rotation.x = Math.PI / 2; rod.position.z = 0.35; rod.raycast = () => {}; lance.add(rod);
      const gunB = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.18), s(0xe8c020, 0.5)); gunB.position.set(0, -0.05, -0.1); gunB.raycast = () => {}; lance.add(gunB);
      this.lanceTip = new THREE.Object3D(); this.lanceTip.position.z = 0.83; lance.add(this.lanceTip);
      this.spine.add(lance);
    }
    this.tag = nameTag(o.name); this.tag.position.set(0, 2.35, 0); root.add(this.tag);
    root.scale.setScalar(o.scale || 0.85);
    this.cur = { ...POSES.stand }; this.target = POSES.stand;
    this.phase = 0; this.speed = 0; this.alive = true; this.dying = false; this.t = 0;
    scene.add(root);
  }

  setPose(n) { this.target = POSES[n]; this.poseName = n; }

  faceTowards(x, z, dt, rate = 8) {
    const want = Math.atan2(x - this.root.position.x, z - this.root.position.z);
    let d = want - this.root.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    this.root.rotation.y += d * Math.min(1, dt * rate);
  }

  // walk towards (x,z); returns true when arrived
  walkTo(x, z, dt, speed = 1.5) {
    const p = this.root.position, dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
    if (d < 0.12) { this.speed = 0; return true; }
    const st = Math.min(d, speed * dt);
    p.x += dx / d * st; p.z += dz / d * st;
    p.y = (p.z < -29.05 && p.x > -24 && p.x < 22) ? 0.2 : groundHeight(p.x, p.z);
    this.faceTowards(x, z, dt, 10);
    this.speed = speed; this.setPose('walk');
    return false;
  }

  die(dir, headshot) {
    if (this.dying) return;
    this.alive = false; this.dying = true; this.t = 0; this.headshot = headshot;
    const fwd = new V3(Math.sin(this.root.rotation.y), 0, Math.cos(this.root.rotation.y));
    const flat = new V3(dir.x, 0, dir.z).normalize();
    this.fallSign = fwd.dot(flat) > 0 ? 1 : -1;
    this.vel = flat.multiplyScalar(headshot ? 0.6 : 1.8);
    this.angVel = 0;
    this.tag.visible = false;
  }

  update(dt) {
    this.t += dt;
    if (this.dying) {
      if (this.headshot && this.t < 0.3) {
        this.hips.position.y += (0.5 - this.hips.position.y) * Math.min(1, dt * 10);
      } else {
        this.angVel += dt * 9;
        this.tilt.rotation.x += this.angVel * dt * this.fallSign;
        if (Math.abs(this.tilt.rotation.x) >= Math.PI / 2) { this.tilt.rotation.x = Math.PI / 2 * this.fallSign; this.angVel *= -0.25; }
        this.tilt.position.y = 0.14 * Math.abs(this.tilt.rotation.x) / (Math.PI / 2);
        const e = Math.min(1, dt * 5);
        this.hips.position.y += (0.95 - this.hips.position.y) * e;
        this.shL.rotation.x += (-2.5 * this.fallSign - this.shL.rotation.x) * e;
        this.shR.rotation.x += (-2.1 * this.fallSign - this.shR.rotation.x) * e;
        this.shL.rotation.z += (0.8 - this.shL.rotation.z) * e;
        this.shR.rotation.z += (-0.8 - this.shR.rotation.z) * e;
        this.knL.rotation.x += (0.4 - this.knL.rotation.x) * e;
        this.knR.rotation.x += (0.1 - this.knR.rotation.x) * e;
        this.hipL.rotation.x += (0 - this.hipL.rotation.x) * e;
        this.hipR.rotation.x += (0 - this.hipR.rotation.x) * e;
      }
      const p = this.root.position;
      p.x += this.vel.x * dt; p.z += this.vel.z * dt;
      this.vel.multiplyScalar(Math.max(0, 1 - dt * 4));
      return;
    }
    const c = this.cur, tg = this.target, k = Math.min(1, dt * 8);
    for (const key in tg) c[key] += (tg[key] - c[key]) * k;
    let swing = 0;
    if (this.speed > 0.1) { this.phase += dt * this.speed * 3.2; swing = Math.sin(this.phase) * 0.55; }
    const shake = this.poseName === 'shout' ? Math.sin(this.t * 22) * 0.25 : 0;
    const waveZ = this.poseName === 'wave' ? Math.sin(this.t * 9) * 0.35 : 0;
    this.spine.rotation.y = this.poseName === 'wash' ? Math.sin(this.t * 1.6) * 0.4 : 0;
    const gest = this.poseName === 'chat' ? Math.sin(this.t * 3) * 0.35 : 0;
    this.hips.position.y = c.hipsY + (this.speed > 0.1 ? Math.abs(Math.cos(this.phase)) * 0.035 : 0);
    this.spine.rotation.x = c.spineX;
    this.shR.rotation.set(c.shRx - swing * 0.6 + shake + gest, 0, c.shRz + waveZ);
    this.shL.rotation.set(c.shLx + swing * 0.6, 0, c.shLz);
    this.elR.rotation.x = c.elR + shake * 0.6; this.elL.rotation.x = c.elL;
    this.hipL.rotation.x = swing - (this.poseName === 'cower' ? 1.2 : 0);
    this.hipR.rotation.x = -swing - (this.poseName === 'cower' ? 1.2 : 0);
    this.knL.rotation.x = c.knee + (this.speed > 0.1 ? Math.max(0, -Math.sin(this.phase + 0.6)) * 1.0 : 0);
    this.knR.rotation.x = c.knee + (this.speed > 0.1 ? Math.max(0, Math.sin(this.phase + 0.6)) * 1.0 : 0);
    this.neck.rotation.x = this.poseName === 'shout' ? -0.25 : 0;
  }

  revive(x, y, z) {
    this.alive = true; this.dying = false; this.t = 0;
    this.tilt.rotation.set(0, 0, 0); this.tilt.position.set(0, 0, 0);
    this.hips.position.y = 0.95; this.tag.visible = true;
    this.root.position.set(x, y, z);
    this.cur = { ...POSES.stand }; this.setPose('stand');
    if (!this.root.parent) this.scene.add(this.root);
  }
}

// grid path through the forecourt (same rules as the hostiles use)
function path(from, to) {
  const inside = (z) => z < -9.3;
  if (!inside(from.z) && !inside(to.z)) return [to.clone()];
  let best = LAYOUT.columns[0], bd = Infinity;
  for (const c of LAYOUT.columns) { const d = Math.abs(from.x - c) + Math.abs(to.x - c); if (d < bd) { bd = d; best = c; } }
  return [
    new V3(best, 0, inside(from.z) ? from.z : LAYOUT.lanes.pave),
    new V3(best, 0, inside(to.z) ? to.z : LAYOUT.lanes.pave),
    to.clone(),
  ];
}

// ------------------------------------------------------------------ the cast
const KERB = -4.1;
const SWERVE = 0.5;

export class Civilians {
  constructor({ scene, world, carSys, audio, enemies, fx }) {
    this.scene = scene; this.carSys = carSys; this.audio = audio; this.enemies = enemies; this.fx = fx;
    this.group = new THREE.Group(); scene.add(this.group);
    this.onSay = null;
    this.onKilledInBlast = null;

    // automatic sliding showroom door
    const glassMat = world.materials.glass;
    this.doors = [-1, 1].map((side) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 2.25), glassMat);
      m.position.set(DOOR.x + side * 0.4, 0.35 + 1.125, -29.1);
      m.userData.penetrable = true; m.userData.glassPane = true; m.renderOrder = 2;
      m.userData.closedX = m.position.x; m.userData.side = side;
      world.group.add(m); world.glassPanes.push(m);
      return m;
    });
    this.doorOpen = 0;

    this.craig = new Person(this.group, { id: 'craig', name: 'CRAIG', top: 0x1d2a48, legs: 0x2b2d33, shoes: 0x111111, shirtFront: 0xf4f4f4, tie: 0x7a1020, scale: 0.84, skin: 0xe2ad8f });
    this.kev = new Person(this.group, { id: 'kev', name: 'KEV JONES', top: 0x5b6068, legs: 0x2f4a78, shoes: 0xf2f2f2, hood: true, scale: 0.86, skin: 0xd9a080, beard: 0x5a4a3a });
    this.mech = new Person(this.group, { id: 'mech', name: 'MERTON GARAGES', top: 0x1d3466, legs: 0x1d3466, shoes: 0x161616, scale: 0.95, skin: 0xd8a184, hair: 0x4a3524, backText: ['MERTON', 'GARAGES'], paper: true });
    this.val = new Person(this.group, { id: 'val', name: 'VALETER', top: 0x101010, legs: 0x3c3f44, shoes: 0x1a1a1a, sleeves: 'skin', bulk: 1.55, scale: 1.02, skin: 0xb97a55, hair: 0x1b1410, lance: true });
    for (const p of [this.craig, this.kev, this.mech]) p.upgrades = true;

    // the valeter's white Corsa outside the open shutter
    this.corsa = makeCar('hatch', 0xf3f4f5, { plain: true });
    this.corsa.position.set(-27.0, 0.14, -27.75); this.corsa.rotation.y = 0;
    carSys.addStatic(this.corsa);
    this.valSpots = [
      { x: -23.9, z: -27.5 }, { x: -26.2, z: -26.3 }, { x: -28.4, z: -26.35 }, { x: -30.0, z: -27.6 },
    ];
    this.motSpots = [4, 24];
    this.reset();
  }

  get people() { return [this.craig, this.kev, this.mech, this.val]; }

  reset() {
    this.craigState = 'inside'; this.craigT = 14 + Math.random() * 10; this.craigShouted = false;
    this.craig.revive(-8.8, 0.2, -33.6); this.craig.root.rotation.y = Math.PI * 0.85;
    this.removeKev(); this.removeMech();
    this.motCars = [];
    this.kerbCars = new Set();
    this.nextEvent = 'kev'; this.eventT = 20 + Math.random() * 8;
    this.val.revive(this.valSpots[1].x, 0.13, this.valSpots[1].z);
    this.valState = 'wash'; this.valT = 6; this.valSpot = 1;
  }

  removeKev() {
    if (this.bmw) { this.kerbCars && this.kerbCars.delete(this.bmw); this.carSys.removeDynamic(this.bmw); this.bmw = null; }
    this.kevState = 'away';
    this.kev.root.removeFromParent();
  }

  removeMech() {
    if (this.x6) { this.kerbCars && this.kerbCars.delete(this.x6); this.carSys.removeDynamic(this.x6); this.x6 = null; }
    this.mechState = 'away';
    this.mech.root.removeFromParent();
    if (this.mech.paper) this.mech.paper.visible = false;
  }

  get eventRunning() { return this.kevState !== 'away' || this.mechState !== 'away'; }

  eventDone(which) {
    this.nextEvent = which === 'kev' ? 'mech' : 'kev';
    this.eventT = 22 + Math.random() * 18;
  }

  onWaveStart() {
    if (!this.craig.alive) { this.craig.revive(-8.8, 0.2, -33.6); this.craigState = 'inside'; this.craigT = 10 + Math.random() * 8; }
    if (!this.val.alive) { const sp = this.valSpots[1]; this.val.revive(sp.x, 0.13, sp.z); this.valState = 'wash'; this.valT = 5; this.valSpot = 1; }
    if (this.kevState !== 'away' && (!this.kev.alive || this.kevState === 'dead')) { this.removeKev(); this.eventDone('kev'); }
    if (this.mechState !== 'away' && (!this.mech.alive || this.mechState === 'dead')) {
      // if he died mid-MOT, leave the car where it ended up
      if (this.motCar) { this.motCar.userData.driven = false; this.motCar = null; }
      this.removeMech(); this.eventDone('mech');
    }
  }

  say(who, text, ms = 2600) { if (this.onSay) this.onSay(who, text, ms); }

  // ---------------- update ----------------
  update(dt, active) {
    this.updateDoor(dt);
    this.updateCraig(dt, active);
    if (!this.eventRunning && active) {
      this.eventT -= dt;
      if (this.eventT <= 0) { if (this.nextEvent === 'kev') this.spawnBmw(); else this.spawnX6(); }
    }
    this.updateKev(dt);
    this.updateMech(dt);
    this.updateValeter(dt);
    for (const c of this.kerbCars) {
      if (c.userData.destroyed || c.userData.flying) continue;
      c.position.z += (KERB - c.position.z) * Math.min(1, dt * 2);
      c.rotation.y += (0 - c.rotation.y) * Math.min(1, dt * 2);
    }
    for (const p of this.people) if (p.root.parent) p.update(dt);
  }

  updateDoor(dt) {
    let near = false;
    const check = (p) => { if (Math.hypot(p.x - DOOR.x, p.z - DOOR.z) < 2.8) near = true; };
    for (const p of this.people) if (p.root.parent && p.alive) check(p.root.position);
    for (const s of this.enemies.soldiers) if (s.alive) check(s.root.position);
    this.doorOpen += ((near ? 1 : 0) - this.doorOpen) * Math.min(1, dt * 5);
    for (const d of this.doors) d.position.x = d.userData.closedX + d.userData.side * 0.76 * this.doorOpen;
  }

  // ---------------- vehicles ----------------
  kerbObstacles(except) {
    const xs = [];
    for (const c of this.kerbCars) if (c !== except && c.parent && !c.userData.flying) xs.push(c.position.x);
    return xs;
  }

  // drive along the far kerb (+x), pulling out round anything parked. Returns true on arrival at stopX.
  drive(car, st, dt) {
    const p = car.position;
    let step, d = 0;
    if (st.stopX !== null && st.stopX !== undefined) {
      d = st.stopX - p.x;
      const v = Math.min(13, Math.sqrt(Math.max(0, 2 * 4.5 * d)) + 0.4);
      step = Math.min(d, v * dt);
    } else {
      st.v = Math.min(15, (st.v || 3) + dt * 4);
      step = st.v * dt;
    }
    p.x += step;
    const obs = this.kerbObstacles(car);
    const parking = st.stopX != null && d < 4;
    const swerve = !parking && obs.some((ox) => (ox - p.x) < 9 && (ox - p.x) > -5.5);
    const tz = swerve ? SWERVE : KERB;
    const dz = (tz - p.z) * Math.min(1, dt * (parking ? 2.5 : 1.6));
    p.z += dz;
    p.y = 0;
    const want = Math.atan2(-dz, Math.max(0.02, step));
    car.rotation.y += (want - car.rotation.y) * Math.min(1, dt * 6);
    if (st.stopX != null && d < 0.05) { car.rotation.y = 0; return true; }
    return false;
  }

  // steer a car along waypoints (used for pulling a car off the forecourt)
  steer(car, st, dt) {
    const wp = st.wps[0];
    if (!wp) return true;
    const p = car.position;
    const dx = wp.x - p.x, dz = wp.z - p.z, dist = Math.hypot(dx, dz);
    if (dist < 1.1) { st.wps.shift(); return !st.wps.length; }
    const want = Math.atan2(-dz, dx);
    let diff = want - car.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
    car.rotation.y += THREE.MathUtils.clamp(diff, -2.2 * dt, 2.2 * dt);
    const sp = Math.abs(diff) > 0.8 ? 1.8 : 3.6;
    p.x += Math.cos(car.rotation.y) * sp * dt;
    p.z += -Math.sin(car.rotation.y) * sp * dt;
    p.y += ((p.z > -5.05 ? 0 : 0.14) - p.y) * Math.min(1, dt * 6);
    car.rotation.x *= 0.9; car.rotation.z *= 0.9;
    return false;
  }

  // someone sat inside a car that just got blown up
  checkCarBlast(person, car, state) {
    if (car && car.userData.destroyed && person.alive && !person.root.parent) {
      person.revive(car.position.x, 0, car.position.z); this.group.add(person.root); person.tag.visible = false;
      person.die(new V3(0, 0, 1), false);
      if (this.onKilledInBlast) this.onKilledInBlast(person);
      return 'dead';
    }
    return state;
  }

  follow(p, dt, speed) {
    const wp = p.path && p.path[0];
    if (!wp) return true;
    if (p.walkTo(wp.x, wp.z, dt, speed)) p.path.shift();
    return !p.path.length;
  }

  // ---------------- Craig ----------------
  updateCraig(dt, active) {
    const c = this.craig;
    if (!c.alive) return;
    const home = { x: -8.8, z: -33.6 }, inDoor = { x: DOOR.x, z: -30.6 }, outDoor = { x: DOOR.x, z: -28.0 };
    switch (this.craigState) {
      case 'inside':
        c.speed = 0; c.setPose('stand');
        if (active) this.craigT -= dt;
        if (this.craigT <= 0) this.craigState = 'toDoor';
        break;
      case 'toDoor':
        if (c.walkTo(inDoor.x, inDoor.z, dt, 1.3)) this.craigState = 'out';
        break;
      case 'out':
        if (c.walkTo(outDoor.x, outDoor.z, dt, 1.2)) { this.craigState = 'shout'; this.craigT = 3.2; this.craigShouted = false; }
        break;
      case 'shout': {
        c.speed = 0;
        const target = this.kevState === 'meeting' ? this.kev.root.position : (this.nearestSoldier(c.root.position) || new V3(0, 0, 10));
        c.faceTowards(target.x, target.z, dt, 6);
        c.setPose('shout');
        if (!this.craigShouted && this.craigT < 2.9) {
          this.craigShouted = true;
          this.audio.say('craig', c.root.position);
          this.say('CRAIG', 'Get yourself away!', 2400);
        }
        this.craigT -= dt;
        if (this.craigT <= 0) {
          if (this.kevState === 'meeting') { this.craigState = 'chat'; this.craigT = 7; } else this.craigState = 'back';
        }
        break;
      }
      case 'chat':
        c.speed = 0; c.setPose('chat');
        c.faceTowards(this.kev.root.position.x, this.kev.root.position.z, dt, 6);
        this.craigT -= dt;
        if (this.craigT <= 0 || this.kevState !== 'meeting') this.craigState = 'back';
        break;
      case 'back':
        if (c.walkTo(inDoor.x, inDoor.z, dt, 1.4)) this.craigState = 'home';
        break;
      case 'home':
        if (c.walkTo(home.x, home.z, dt, 1.4)) { this.craigState = 'inside'; this.craigT = 25 + Math.random() * 20; }
        break;
      default: break;
    }
  }

  nearestSoldier(p) {
    let best = null, bd = 1e9;
    for (const s of this.enemies.soldiers) { if (!s.alive) continue; const d = s.root.position.distanceToSquared(p); if (d < bd) { bd = d; best = s.root.position; } }
    return best;
  }

  // ---------------- Kev Jones ----------------
  spawnBmw() {
    const b = this.bmw = makeCar('saloon', 0xa9cbe8, { plain: true, kidney: true });
    b.position.set(-160, 0, KERB); b.rotation.y = 0;
    this.carSys.addDynamic(b);
    this.bmwDrive = { stopX: 11 };
    this.kevState = 'driving'; this.kevSaid = false;
    this.say('HQ', 'Civvy vehicle inbound — pale blue 3 Series. That\'ll be Kev Jones, the trader.', 3200);
  }

  updateKev(dt) {
    const k = this.kev, park = 11;
    switch (this.kevState) {
      case 'driving': {
        if (this.bmw.userData.destroyed) break;
        if (this.drive(this.bmw, this.bmwDrive, dt)) {
          this.kerbCars.add(this.bmw);
          this.kevState = 'walkIn';
          k.revive(park + 0.4, 0, KERB + 1.25);
          this.group.add(k.root);
          k.path = [new V3(park - 2.9, 0, KERB + 1.25), new V3(park - 2.9, 0, LAYOUT.lanes.pave), ...path(new V3(park - 2.9, 0, LAYOUT.lanes.pave), new V3(-4.5, 0, -27.8))];
          this.say('KEV JONES', 'Alright Craig! What\'s the best you can do on the stock, mate?', 3200);
        }
        break;
      }
      case 'walkIn':
        if (!k.alive) break;
        if (this.follow(k, dt, 1.6)) {
          this.kevState = 'meeting'; this.kevT = 12;
          if (this.craig.alive && (this.craigState === 'inside' || this.craigState === 'home')) this.craigState = 'toDoor';
        }
        break;
      case 'meeting':
        if (!k.alive) break;
        k.speed = 0; k.setPose('chat');
        k.faceTowards(DOOR.x, -28.0, dt, 6);
        this.kevT -= dt;
        if (this.kevT < 5 && !this.kevSaid) { this.kevSaid = true; this.say('KEV JONES', 'Go on then, I\'ll have three of them. Cash.', 2600); }
        if (this.kevT <= 0) {
          this.kevState = 'walkOut';
          k.path = [...path(k.root.position, new V3(park - 2.9, 0, LAYOUT.lanes.pave)), new V3(park - 2.9, 0, KERB + 1.25), new V3(park + 0.4, 0, KERB + 1.25)];
        }
        break;
      case 'walkOut':
        if (!k.alive) break;
        if (this.follow(k, dt, 1.7)) { k.root.removeFromParent(); this.kevState = 'leaving'; this.kerbCars.delete(this.bmw); this.bmwDrive = { stopX: null, v: 2 }; }
        break;
      case 'leaving':
        if (this.bmw.userData.destroyed) break;
        this.drive(this.bmw, this.bmwDrive, dt);
        if (this.bmw.position.x > 170) { this.removeKev(); this.eventDone('kev'); }
        break;
      default: break;
    }
    if (this.kevState === 'driving' || this.kevState === 'leaving') this.kevState = this.checkCarBlast(k, this.bmw, this.kevState);
  }

  // ---------------- the Merton Garages mechanic ----------------
  spawnX6() {
    const x = this.x6 = makeCar('x6', 0x0b0c0e, { plain: true, kidney: true });
    x.position.set(-160, 0, KERB); x.rotation.y = 0;
    this.carSys.addDynamic(x);
    this.x6Drive = { stopX: -11 };
    this.mechState = 'arriving';
    this.say('HQ', 'Black X6 pulling up. Overalls — looks like the mechanic from Merton Garages.', 3200);
  }

  pickMotCar() {
    const cands = this.carSys.cars.filter((c) => c.row === 0 && !c.car.userData.destroyed && !c.car.userData.driven && c.x > -9 && c.x < 7);
    cands.sort((a, b) => Math.abs(a.x + 1) - Math.abs(b.x + 1));
    return cands[0] ? cands[0].car : null;
  }

  updateMech(dt) {
    const m = this.mech, PARK = -11, pave = LAYOUT.lanes.pave;
    const inDoor = new V3(DOOR.x, 0, -30.6), inside = new V3(-7.6, 0, -32.2), outDoor = new V3(DOOR.x, 0, -27.8);
    switch (this.mechState) {
      case 'arriving':
        if (this.x6.userData.destroyed) break;
        if (this.drive(this.x6, this.x6Drive, dt)) {
          this.kerbCars.add(this.x6);
          m.revive(PARK + 0.3, 0, KERB + 1.3); this.group.add(m.root);
          m.path = [new V3(PARK - 3.2, 0, KERB + 1.3), new V3(PARK - 3.2, 0, pave), ...path(new V3(PARK - 3.2, 0, pave), outDoor), inDoor, inside];
          this.mechState = 'toShowroom';
        }
        break;
      case 'toShowroom':
        if (!m.alive) break;
        if (this.follow(m, dt, 1.7)) { this.mechState = 'inside1'; this.mechT = 4; m.setPose('stand'); m.speed = 0; }
        break;
      case 'inside1':
        if (!m.alive) break;
        this.mechT -= dt;
        if (this.mechT <= 0) {
          this.motCar = this.pickMotCar();
          this.motX = this.motSpots.find((x) => ![...this.kerbCars].some((c) => Math.abs(c.position.x - x) < 5));
          if (this.motCar && this.motX !== undefined) {
            const c = this.motCar;
            m.path = [inDoor, outDoor, ...path(outDoor, new V3(c.position.x, 0, LAYOUT.lanes.a1)), new V3(c.position.x - 0.6, 0, -14.4)];
            this.mechState = 'toCar';
          } else {
            // nothing to drive: just do the paperwork at the door
            this.motCar = null;
            m.path = [inDoor, outDoor];
            this.mechState = 'toCar';
          }
        }
        break;
      case 'toCar':
        if (!m.alive) break;
        if (this.follow(m, dt, 1.7)) {
          if (this.motCar) {
            m.root.removeFromParent();
            const c = this.motCar;
            c.userData.driven = true;
            c.rotation.x = 0; c.rotation.z = 0;
            this.motDrive = { wps: [new V3(c.position.x + Math.cos(c.rotation.y) * 2.5, 0, c.position.z - Math.sin(c.rotation.y) * 2.5), new V3(-1, 0, -10.6), new V3(-1, 0, -6.6), new V3(this.motX - 5, 0, KERB + 0.3)], phase: 'steer' };
            this.mechState = 'drivingMot';
          } else { this.startMotWave(m.root.position.clone()); }
        }
        break;
      case 'drivingMot': {
        const c = this.motCar;
        if (c.userData.destroyed) { this.mechState = this.checkCarBlast(m, c, this.mechState); break; }
        if (this.motDrive.phase === 'steer') {
          if (this.steer(c, this.motDrive, dt)) { this.motDrive = { phase: 'kerb', stopX: this.motX }; }
        } else if (this.drive(c, this.motDrive, dt)) {
          this.kerbCars.add(c);
          this.motCars.push(c);
          m.revive(c.position.x + 0.3, 0, KERB + 1.3); this.group.add(m.root);
          m.root.rotation.y = 0;
          this.startMotWave();
        }
        break;
      }
      case 'motWave':
        if (!m.alive) break;
        m.speed = 0; m.setPose('wave');
        m.faceTowards(0, 10, dt, 5);
        this.mechT -= dt;
        if (!this.mechSaid && this.mechT < 3.1) {
          this.mechSaid = true;
          this.audio.say('mot', m.root.position);
          this.say('MECHANIC (MERTON GARAGES)', 'M-O-T DONE!', 2600);
        }
        if (this.mechT <= 0) {
          m.paper.visible = false;
          const here = m.root.position.clone();
          const start = here.z > -9 ? [new V3(here.x + 3.2, 0, here.z), new V3(here.x + 3.2, 0, pave)] : [];
          const from = start.length ? start[start.length - 1] : here;
          m.path = [...start, ...(here.z > -9 ? path(from, outDoor) : []), outDoor, inDoor, inside];
          this.mechState = 'toShowroom2';
        }
        break;
      case 'toShowroom2':
        if (!m.alive) break;
        if (this.follow(m, dt, 1.7)) { this.mechState = 'inside2'; this.mechT = 3; m.speed = 0; m.setPose('stand'); }
        break;
      case 'inside2':
        if (!m.alive) break;
        this.mechT -= dt;
        if (this.mechT <= 0) {
          m.path = [inDoor, outDoor, ...path(outDoor, new V3(PARK - 3.2, 0, pave)), new V3(PARK - 3.2, 0, KERB + 1.3), new V3(PARK + 0.3, 0, KERB + 1.3)];
          this.mechState = 'toX6';
        }
        break;
      case 'toX6':
        if (!m.alive) break;
        if (this.x6.userData.destroyed) { m.setPose('cower'); m.speed = 0; break; }
        if (this.follow(m, dt, 1.8)) {
          m.root.removeFromParent();
          this.kerbCars.delete(this.x6);
          this.x6Drive = { stopX: null, v: 2 };
          this.mechState = 'leaving';
        }
        break;
      case 'leaving':
        if (this.x6.userData.destroyed) break;
        this.drive(this.x6, this.x6Drive, dt);
        if (this.x6.position.x > 170) { this.removeMech(); this.eventDone('mech'); }
        break;
      default: break;
    }
    if (this.mechState === 'arriving' || this.mechState === 'leaving') this.mechState = this.checkCarBlast(m, this.x6, this.mechState);
  }

  startMotWave() {
    this.mechState = 'motWave'; this.mechT = 3.6; this.mechSaid = false;
    if (this.mech.paper) this.mech.paper.visible = true;
  }

  // ---------------- the valeter ----------------
  updateValeter(dt) {
    const v = this.val;
    if (!this.washSound && this.audio.ctx) this.washSound = this.audio.washLoop();
    const corsaOk = !this.corsa.userData.destroyed;
    const washing = v.alive && corsaOk && this.valState === 'wash';
    if (this.washSound) this.washSound.set(v.root.position, washing);
    if (!v.alive) return;
    if (!corsaOk) { v.speed = 0; v.setPose('cower'); return; }
    const sp = this.valSpots[this.valSpot];
    const cp = this.corsa.position;
    if (this.valState === 'wash') {
      v.speed = 0; v.setPose('wash');
      v.faceTowards(cp.x, cp.z, dt, 4);
      this.valT -= dt;
      // spray
      if (v.lanceTip && this.fx) {
        const tip = v.lanceTip.getWorldPosition(new V3());
        const dir = new V3(0, 0, 1).applyQuaternion(v.lanceTip.getWorldQuaternion(new THREE.Quaternion()));
        for (let i = 0; i < 2; i++) {
          this.fx.spawn(this.fx.norm, { pos: tip, vel: dir.clone().multiplyScalar(7 + Math.random() * 3).add(new V3((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.8)), size0: 0.04, size1: 0.45, life: 0.35 + Math.random() * 0.2, alpha: 0.55, color: 0xe8f4ff, drag: 2.5, grav: 3 });
        }
      }
      if (this.valT <= 0) { this.valState = 'move'; this.valSpot = (this.valSpot + 1 + Math.floor(Math.random() * 2)) % this.valSpots.length; }
    } else {
      if (v.walkTo(sp.x, sp.z, dt, 1.2)) { this.valState = 'wash'; this.valT = 6 + Math.random() * 4; }
    }
  }

  // anyone caught in a blast
  blast(pos, radius) {
    const out = [];
    for (const p of this.people) if (p.alive && p.root.parent && p.root.position.distanceTo(pos) < radius) out.push(p);
    return out;
  }
}
