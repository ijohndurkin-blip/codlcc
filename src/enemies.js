import * as THREE from 'three';
import { Soldier } from './soldier.js';
import { LAYOUT, groundHeight } from './world.js';

const V3 = THREE.Vector3;
const STATS = {
  rifleman: { hp: 1, speed: 4.3, acc: 0.062, dmg: 9, burst: [3, 6], interval: 0.13 },
  rusher: { hp: 1, speed: 5.6, acc: 0.05, dmg: 8, burst: [3, 5], interval: 0.12 },
  heavy: { hp: 3, speed: 2.1, acc: 0.042, dmg: 7, burst: [10, 18], interval: 0.085 },
  sniper: { hp: 1, speed: 2.5, acc: 1, dmg: 55, burst: [1, 1], interval: 1 },
};
const BRICK_ROOF_Y = 8.6;

// ------------------------------------------------------------------ trucks
class Truck {
  constructor(scene, audio, stopX, passengers) {
    this.audio = audio;
    this.group = new THREE.Group();
    this.passengers = passengers;
    this.stopX = stopX;
    this.state = 'arrive';
    this.speed = 15;
    this.unloadT = 0.6;
    this.fuelHits = 0;
    this.age = 0;
    const g = this.group;
    g.position.set(-150, 0, LAYOUT.lanes.road);
    const s = (o) => new THREE.MeshStandardMaterial(o);
    this.mats = {
      body: s({ color: 0xa8956a, roughness: 0.7, metalness: 0.2 }),
      canvas: s({ color: 0x6d6a4a, roughness: 1 }),
      black: s({ color: 0x151515, roughness: 0.8 }),
      glass: new THREE.MeshPhysicalMaterial({ color: 0x0d1418, roughness: 0.05, metalness: 0.2, clearcoat: 1 }),
      red: s({ color: 0xb01c14, roughness: 0.5, metalness: 0.3 }),
      light: s({ color: 0xffffff, emissive: 0xffe0a0, emissiveIntensity: 1.5 }),
    };
    const M = this.mats;
    const add = (geo, mat, x, y, z, part = 'body') => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
      m.castShadow = true; m.receiveShadow = true;
      m.userData.truck = this; m.userData.part = part;
      g.add(m); return m;
    };
    add(new THREE.BoxGeometry(7, 0.3, 1.1), M.black, 0, 0.85, 0);
    add(new THREE.BoxGeometry(1.9, 1.7, 2.4), M.body, 2.4, 2.0, 0);
    add(new THREE.BoxGeometry(1.2, 1.0, 2.3), M.body, 3.85, 1.55, 0);
    add(new THREE.BoxGeometry(0.06, 0.7, 2.1), M.glass, 3.36, 2.45, 0);
    for (const z of [-1.21, 1.21]) add(new THREE.BoxGeometry(1.0, 0.6, 0.04), M.glass, 2.6, 2.45, z);
    add(new THREE.BoxGeometry(0.1, 0.6, 1.6), M.black, 4.45, 1.45, 0);
    for (const z of [-0.85, 0.85]) add(new THREE.BoxGeometry(0.08, 0.2, 0.3), M.light, 4.5, 1.75, z);
    add(new THREE.BoxGeometry(4.6, 0.3, 2.45), M.body, -1.15, 1.25, 0);
    for (const z of [-1.2, 1.2]) add(new THREE.BoxGeometry(4.6, 0.65, 0.08), M.body, -1.15, 1.72, z);
    const canopy = new THREE.CylinderGeometry(1.24, 1.24, 4.6, 18, 1, false, 0, Math.PI);
    canopy.rotateZ(Math.PI / 2); canopy.rotateX(Math.PI / 2);
    const cm = add(canopy, M.canvas, -1.15, 2.05, 0);
    cm.rotation.x = -Math.PI / 2;
    add(new THREE.BoxGeometry(4.6, 0.02, 2.46), M.canvas, -1.15, 2.05, 0);
    const wheel = new THREE.CylinderGeometry(0.52, 0.52, 0.4, 18); wheel.rotateX(Math.PI / 2);
    for (const x of [3.2, -1.0, -2.3]) for (const z of [-1.05, 1.05]) add(wheel, M.black, x, 0.52, z);
    // fuel tank + red jerry cans on the side facing the sniper (+z)
    const tank = new THREE.CylinderGeometry(0.32, 0.32, 1.1, 16); tank.rotateZ(Math.PI / 2);
    add(tank, M.body, 1.1, 0.95, 1.2, 'fuel');
    for (const x of [-0.2, 0.3]) add(new THREE.BoxGeometry(0.42, 0.55, 0.2), M.red, x, 1.75, 1.33, 'fuel');
    scene.add(g);
    this.engine = audio.engine();
  }

  get x() { return this.group.position.x; }

  update(dt, mgr) {
    this.age += dt;
    const p = this.group.position;
    if (this.state === 'arrive') {
      const d = this.stopX - p.x;
      const v = Math.min(15, Math.sqrt(Math.max(0, 2 * 5.5 * d)) + 0.5);
      p.x += Math.min(d, v * dt);
      this.engine.set(p, v / 15);
      if (d < 0.05) { this.state = 'unload'; }
    } else if (this.state === 'unload') {
      this.engine.set(p, 0.1);
      this.unloadT -= dt;
      if (this.unloadT <= 0 && this.passengers.length) {
        this.unloadT = 0.5;
        const kind = this.passengers.shift();
        mgr.spawnSoldier(kind, new V3(p.x - 4.0, 0, LAYOUT.lanes.road + (Math.random() - 0.5) * 0.8), 'truck');
      }
      if (!this.passengers.length) this.state = 'parked';
    } else if (this.state === 'parked') {
      this.engine.set(p, 0.05);
    } else if (this.state === 'leave') {
      this.speed = Math.min(16, (this.speed || 0) + dt * 4);
      p.x += this.speed * dt;
      this.engine.set(p, this.speed / 16);
      if (p.x > 160) this.state = 'gone';
    }
  }

  burn() {
    const char = new THREE.MeshStandardMaterial({ color: 0x1a1816, roughness: 1 });
    this.group.traverse((o) => { if (o.isMesh) o.material = char; });
    this.group.rotation.z = 0.04; this.group.position.y = -0.1;
    this.state = 'destroyed';
    this.engine.stop();
  }

  dispose(scene) { scene.remove(this.group); if (this.state !== 'destroyed') this.engine.stop(); }
}

// ------------------------------------------------------------------ manager
export class Enemies {
  constructor({ scene, T, audio, effects, cars, player }) {
    this.scene = scene; this.T = T; this.audio = audio; this.fx = effects; this.player = player;
    this.group = new THREE.Group(); scene.add(this.group);
    this.truckGroup = new THREE.Group(); scene.add(this.truckGroup);
    this.soldiers = []; this.trucks = []; this.grenades = [];
    this.onKill = null; this.onWaveComplete = null; this.onGrenade = null; this.onMessage = null;
    this.wave = 0; this.active = false;
    // cover points behind cars (from the sniper's point of view)
    const aisle = [LAYOUT.lanes.a1, LAYOUT.lanes.a2, LAYOUT.lanes.a3];
    this.covers = cars.map((c) => ({ x: c.x, z: aisle[c.row], occ: null, car: c.car }));
    this.tmp = new V3();
  }

  // ---------------- waves ----------------
  startWave(n) {
    this.wave = n; this.active = true; this.time = 0;
    // clear bodies and old vehicles
    for (const s of this.soldiers) if (!s.alive) s.dispose();
    this.soldiers = this.soldiers.filter((s) => s.alive);
    for (const t of this.trucks) {
      if (t.state === 'destroyed' && t.wreckWaves++ >= 1) { t.dispose(this.truckGroup); t.state = 'gone'; }
      else if (t.state === 'parked') t.state = 'leave';
    }
    this.trucks = this.trucks.filter((t) => t.state !== 'gone');
    for (const c of this.covers) c.occ = null;

    const total = Math.min(42, 4 + n * 3);
    const heavies = n >= 4 ? Math.min(4, n - 3) : 0;
    const snipers = n >= 3 ? Math.min(3, Math.floor((n - 1) / 2)) : 0;
    const rushers = n >= 2 ? Math.min(6, n) : 0;
    const riflemen = Math.max(2, total - heavies - snipers - rushers);
    const pool = [];
    for (let i = 0; i < riflemen; i++) pool.push('rifleman');
    for (let i = 0; i < rushers; i++) pool.push('rusher');
    for (let i = 0; i < heavies; i++) pool.push('heavy');
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    this.pool = pool;
    this.snipersPending = snipers;
    this.truckT = 1.5; this.footT = 7; this.sniperT = 10;
    this.maxAlive = Math.min(14, 5 + n);
    this.totalThisWave = pool.length + snipers;
  }

  get remaining() {
    let n = this.pool ? this.pool.length : 0;
    n += this.snipersPending || 0;
    for (const t of this.trucks) n += t.passengers.length;
    for (const s of this.soldiers) if (s.alive) n++;
    return n;
  }

  get aliveCount() { let n = 0; for (const s of this.soldiers) if (s.alive) n++; return n; }

  pickStopX() {
    const options = [-15, 3, 19, -6];
    const free = options.filter((x) => !this.trucks.some((t) => t.state !== 'gone' && t.state !== 'leave' && Math.abs(t.stopX - x) < 8));
    return free.length ? free[Math.floor(Math.random() * free.length)] : null;
  }

  spawnTruck() {
    const stopX = this.pickStopX();
    if (stopX === null) return false;
    const pass = this.pool.splice(0, Math.min(6, this.pool.length));
    const t = new Truck(this.truckGroup, this.audio, stopX, pass);
    t.wreckWaves = 0;
    this.trucks.push(t);
    if (this.onMessage) this.onMessage('Enemy transport inbound — from the left!');
    return true;
  }

  spawnSoldier(kind, pos, from) {
    const s = new Soldier(kind, this.T, this.group);
    const st = STATS[kind];
    s.hp = st.hp; s.stats = st;
    s.root.position.copy(pos);
    s.root.position.y = groundHeight(pos.x, pos.z);
    s.ai = { state: 'idle', t: 0, path: [], burst: 0, fireT: 0, wounded: false };
    this.soldiers.push(s);

    if (kind === 'sniper') {
      s.roofY = BRICK_ROOF_Y;
      s.onRoof = true;
      s.root.position.y = BRICK_ROOF_Y;
      const z = -14.5 - Math.random() * 12;
      s.root.position.set(37, BRICK_ROOF_Y, z);
      this.goTo(s, [new V3(30.9, 0, z)], 'snipeHide');
      return s;
    }
    if (from === 'door') {
      s.root.position.set(-5.8, 0.2, -33);
      this.goTo(s, [new V3(-5.8, 0, LAYOUT.lanes.a3)], null);
    }
    const start = s.ai.path.length ? s.ai.path[s.ai.path.length - 1] : s.root.position;
    if (kind === 'rusher') {
      const tx = THREE.MathUtils.clamp(start.x + (Math.random() - 0.5) * 14, -14, 14);
      const path = this.path(start, new V3(tx, 0, LAYOUT.lanes.nearRoad));
      this.goTo(s, path, 'rushThrow', true);
    } else {
      const cover = this.pickCover(start);
      if (cover) {
        cover.occ = s; s.cover = cover;
        this.goTo(s, this.path(start, new V3(cover.x, 0, cover.z)), 'cover', true);
      } else {
        this.goTo(s, [new V3(s.root.position.x, 0, LAYOUT.lanes.pave)], 'cover', true);
      }
    }
    return s;
  }

  goTo(s, path, then, append = false) {
    if (append && s.ai.path.length) s.ai.path.push(...path);
    else s.ai.path = path.slice();
    s.ai.state = 'move'; s.ai.then = then;
  }

  pickCover(from) {
    const free = this.covers.filter((c) => !c.occ);
    if (!free.length) return null;
    // prefer moderately close covers with some randomness
    free.sort((a, b) => (Math.hypot(a.x - from.x, a.z - from.z) + Math.random() * 20) - (Math.hypot(b.x - from.x, b.z - from.z) + Math.random() * 20));
    return free[0];
  }

  // grid path through the forecourt aisles + gaps between rows
  path(from, to) {
    const inside = (z) => z < -9.3;
    if (!inside(from.z) && !inside(to.z)) return [to.clone()];
    if (Math.abs(from.z - to.z) < 0.6 && inside(from.z)) return [to.clone()];
    let best = LAYOUT.columns[0], bd = Infinity;
    for (const c of LAYOUT.columns) { const d = Math.abs(from.x - c) + Math.abs(to.x - c); if (d < bd) { bd = d; best = c; } }
    const pts = [];
    if (!inside(from.z)) pts.push(new V3(best, 0, LAYOUT.lanes.pave));
    else pts.push(new V3(best, 0, from.z));
    if (!inside(to.z)) pts.push(new V3(best, 0, LAYOUT.lanes.pave));
    else pts.push(new V3(best, 0, to.z));
    pts.push(to.clone());
    return pts;
  }

  // ---------------- damage ----------------
  damage(s, part, dir, point, power = 1) {
    if (!s.alive) { this.fx.blood(point, dir); return { killed: false, already: true }; }
    const headshot = part === 'head';
    let dmg = headshot ? 99 : part === 'torso' ? 1 : 0.6;
    if (s.kind === 'heavy' && part === 'torso') dmg = 1;
    if (power >= 3) dmg = 99; // .50 cal: anything it touches goes down
    s.hp -= dmg;
    this.fx.blood(point, dir, headshot);
    this.audio.impact('flesh', point);
    if (s.hp <= 0) {
      this.kill(s, dir, headshot, false);
      return { killed: true, headshot };
    }
    // wounded: flinch + slow down
    s.ai.wounded = true;
    if (s.ai.state === 'cover') { s.ai.state = 'peek'; s.ai.t = 0.2; s.ai.burst = 0; }
    return { killed: false, headshot: false };
  }

  kill(s, dir, headshot, explosive) {
    if (!s.alive) return;
    s.die(dir, headshot);
    if (s.cover) { s.cover.occ = null; s.cover = null; }
    if (this.onKill) this.onKill(s, { headshot, explosive });
  }

  hitTruck(t, part, point, normal) {
    if (part === 'fuel' && t.state !== 'destroyed') {
      t.fuelHits++;
      this.fx.sparks(point, normal, 8);
      this.fx.addFire(point, 0.8, 0.3);
      setTimeout(() => this.explodeTruck(t), 450);
      return true;
    }
    this.fx.sparks(point, normal);
    this.audio.impact('metal', point);
    return false;
  }

  explodeTruck(t) {
    if (t.state === 'destroyed' || t.state === 'gone') return;
    const pos = t.group.position.clone();
    this.fx.explosion(pos);
    this.audio.explosion(pos);
    t.burn();
    this.fx.addFire(pos.clone().add(new V3(1.5, 1.2, 0)), 30, 1.2);
    this.fx.addFire(pos.clone().add(new V3(-1.5, 1.6, 0)), 22, 1.0);
    // passengers still inside die
    const inside = t.passengers.length;
    t.passengers.length = 0;
    for (const s of this.soldiers) {
      if (!s.alive) continue;
      const d = s.root.position.distanceTo(pos);
      if (d < 8.5) this.kill(s, new V3().subVectors(s.root.position, pos).normalize().add(new V3(0, 0.5, 0)), false, true);
    }
    if (inside && this.onKill) for (let i = 0; i < inside; i++) this.onKill(null, { explosive: true, inTruck: true });
    if (this.onExplosion) this.onExplosion(pos);
  }

  // ---------------- update ----------------
  update(dt) {
    const P = this.player;
    const eye = P.camera.position;
    if (this.active) {
      this.time += dt;
      this.truckT -= dt; this.footT -= dt; this.sniperT -= dt;
      const alive = this.aliveCount;
      const arriving = this.trucks.filter((t) => t.state === 'arrive' || t.state === 'unload').length;
      if (this.truckT <= 0 && this.pool.length >= 3 && arriving === 0 && alive < this.maxAlive - 2) {
        if (this.spawnTruck()) this.truckT = 22 - Math.min(10, this.wave);
        else this.truckT = 3;
      }
      if (this.footT <= 0 && this.pool.length && alive < this.maxAlive && (arriving === 0 || this.pool.length > 6)) {
        this.footT = Math.max(2.5, 6 - this.wave * 0.3) + Math.random() * 2;
        const kind = this.pool.shift();
        const r = Math.random();
        if (r < 0.4) this.spawnSoldier(kind, new V3(-5.8, 0, -33), 'door');
        else if (r < 0.7) this.spawnSoldier(kind, new V3(-70, 0, LAYOUT.lanes.pave), 'street');
        else this.spawnSoldier(kind, new V3(65, 0, LAYOUT.lanes.pave), 'street');
      }
      if (this.sniperT <= 0 && this.snipersPending > 0) {
        this.snipersPending--; this.sniperT = 16;
        this.spawnSoldier('sniper', new V3(), 'roof');
        if (this.onMessage) this.onMessage('SNIPER on the red-brick rooftop! Watch for the glint.');
      }
      if (this.remaining === 0) {
        this.active = false;
        if (this.onWaveComplete) this.onWaveComplete(this.wave);
      }
    }

    for (const t of this.trucks) t.update(dt, this);
    for (let i = this.trucks.length - 1; i >= 0; i--) if (this.trucks[i].state === 'gone') { this.trucks[i].dispose(this.truckGroup); this.trucks.splice(i, 1); }

    let bodies = 0;
    for (let i = this.soldiers.length - 1; i >= 0; i--) {
      const s = this.soldiers[i];
      if (s.alive) { this.think(s, dt, eye); s.update(dt); continue; }
      bodies++;
      if (bodies > 12 || s.sinking) {
        // oldest bodies sink away
        s.sinking = true;
        s.root.position.y -= dt * 0.25;
        if (s.root.position.y < -0.6) { s.dispose(); this.soldiers.splice(i, 1); }
      } else if (s.deadTime < 6) s.update(dt);
    }
    this.updateGrenades(dt);
  }

  think(s, dt, eye) {
    const ai = s.ai, st = s.stats, p = s.root.position;
    ai.t -= dt;
    const slow = ai.wounded ? 0.6 : 1;
    switch (ai.state) {
      case 'move': {
        const wp = ai.path[0];
        if (!wp) { this.arrive(s); break; }
        const dx = wp.x - p.x, dz = wp.z - p.z, d = Math.hypot(dx, dz);
        const sp = st.speed * slow;
        if (d < 0.2) { ai.path.shift(); if (!ai.path.length) this.arrive(s); break; }
        const step = Math.min(d, sp * dt);
        p.x += (dx / d) * step; p.z += (dz / d) * step;
        if (!s.onRoof) p.y += (groundHeight(p.x, p.z) - p.y) * Math.min(1, dt * 10);
        s.faceTowards(wp.x, wp.z, dt, 10);
        s.speed = sp;
        s.setPose(s.kind === 'heavy' ? 'stand' : 'run');
        break;
      }
      case 'cover': {
        s.speed = 0; s.setPose('kneel');
        s.faceTowards(eye.x, eye.z, dt, 3);
        if (ai.t <= 0) { ai.state = 'peek'; ai.t = 0.55 + Math.random() * 0.4; ai.burst = 0; }
        break;
      }
      case 'peek': {
        s.speed = 0; s.setPose('aim');
        s.faceTowards(eye.x, eye.z, dt, 8);
        if (ai.t <= 0) {
          if (ai.burst === 0) ai.burst = st.burst[0] + Math.floor(Math.random() * (st.burst[1] - st.burst[0] + 1));
          ai.fireT -= dt;
          if (ai.fireT <= 0 && ai.burst > 0) { this.enemyFire(s, eye); ai.burst--; ai.fireT = st.interval * (0.8 + Math.random() * 0.4); }
          if (ai.burst <= 0) {
            ai.burst = 0;
            if (Math.random() < 0.3 && s.cover) {
              const nc = this.pickCover(p);
              if (nc) { s.cover.occ = null; nc.occ = s; s.cover = nc; this.goTo(s, this.path(p, new V3(nc.x, 0, nc.z)), 'cover'); break; }
            }
            ai.state = 'cover'; ai.t = 1.6 + Math.random() * 2.6 - Math.min(1, this.wave * 0.08);
          }
        }
        break;
      }
      case 'rushThrow': {
        s.speed = 0;
        s.faceTowards(eye.x, eye.z, dt, 8);
        if (ai.t <= 0) {
          if (!ai.thrown || ai.thrown < 1) { s.setPose('throw'); ai.thrown = 1; ai.t = 0.45; }
          else if (ai.thrown === 1) { this.throwGrenade(s); ai.thrown = 2; ai.t = 0.6; }
          else { s.setPose('aim'); ai.state = 'peek'; ai.t = 0.4; ai.burst = 0; ai.after = 'rushThrow'; ai.thrown = 0; }
        }
        if (ai.state === 'peek') ai.nextThrow = 5;
        break;
      }
      case 'snipeHide': {
        s.speed = 0; s.setPose('kneel');
        s.faceTowards(eye.x, eye.z, dt, 3);
        if (ai.t <= 0) { ai.state = 'snipeAim'; ai.t = 2.6 - Math.min(1, this.wave * 0.06); s.glint.visible = true; }
        break;
      }
      case 'snipeAim': {
        s.speed = 0; s.setPose('aim');
        s.faceTowards(eye.x, eye.z, dt, 6);
        const k = 1 - Math.max(0, ai.t) / 2.6;
        s.glint.scale.setScalar(0.3 + k * 1.4 + Math.sin(performance.now() * 0.02) * 0.15);
        s.glint.material.opacity = 0.6 + k * 0.4;
        if (ai.t <= 0) {
          this.enemyFire(s, eye);
          s.glint.scale.setScalar(0.01);
          ai.state = 'snipeHide'; ai.t = 3 + Math.random() * 3;
        }
        break;
      }
      default: break;
    }
    // rushers return to throwing after a burst
    if (ai.state === 'cover' && s.kind === 'rusher' && !s.cover) { ai.state = 'rushThrow'; ai.t = 3 + Math.random() * 2; ai.thrown = 0; }
  }

  arrive(s) {
    const ai = s.ai;
    s.speed = 0;
    const then = ai.then;
    if (then === 'cover') { ai.state = 'cover'; ai.t = 0.6 + Math.random() * 1.5; }
    else if (then === 'rushThrow') { ai.state = 'rushThrow'; ai.t = 0.3; ai.thrown = 0; }
    else if (then === 'snipeHide') { ai.state = 'snipeHide'; ai.t = 1.5 + Math.random(); }
    else {
      // came out of the showroom: find cover now
      const cover = s.kind !== 'rusher' ? this.pickCover(s.root.position) : null;
      if (cover) { cover.occ = s; s.cover = cover; this.goTo(s, this.path(s.root.position, new V3(cover.x, 0, cover.z)), 'cover'); }
      else if (s.kind === 'rusher') this.goTo(s, this.path(s.root.position, new V3(THREE.MathUtils.clamp(s.root.position.x, -14, 14), 0, LAYOUT.lanes.nearRoad)), 'rushThrow');
      else { ai.state = 'cover'; ai.t = 1; }
    }
  }

  enemyFire(s, eye) {
    const P = this.player;
    const muzzle = s.muzzleWorld(new V3());
    const dir = new V3().subVectors(eye, muzzle).normalize();
    this.fx.muzzle(muzzle, dir, s.kind === 'sniper');
    if (s.kind === 'sniper') this.fx.flashLight(muzzle, 30, 0.08);
    this.audio.enemyShot(muzzle, s.kind === 'heavy');
    const st = s.stats;
    const dist = muzzle.distanceTo(eye);
    const exposed = P.crouch < 0.6 || (s.onRoof && P.crouch < 0.9 && Math.random() < 0.3);
    let chance = st.acc * (1 + this.wave * 0.06) * (P.moving > 0.5 ? 0.6 : 1) * THREE.MathUtils.clamp(45 / dist, 0.5, 1.4);
    if (s.kind === 'sniper') chance = P.moving > 0.5 ? 0.35 : 0.9;
    const hit = exposed && Math.random() < chance;
    let end;
    if (!exposed) {
      // rounds slam into the parapet
      end = new V3(eye.x + (Math.random() - 0.5) * 2.5, LAYOUT.roofY + 0.35 + Math.random() * 0.5, LAYOUT.parapetZ - 0.01);
      if (Math.random() < 0.6) {
        this.fx.impactDust(end, new V3(0, 0.3, -1), 0x9a6a50);
        this.audio.impact('dirt', end);
      }
      if (Math.random() < 0.15) this.audio.whiz((Math.random() - 0.5));
    } else if (hit) {
      end = eye.clone().add(new V3(0, -0.3, 0));
      P.hurt(st.dmg * (s.kind === 'sniper' ? 1 : 0.9 + Math.random() * 0.3), muzzle);
    } else {
      const miss = new V3((Math.random() - 0.5), (Math.random() - 0.3), (Math.random() - 0.5)).normalize().multiplyScalar(0.6 + Math.random() * 1.6);
      end = eye.clone().add(miss).addScaledVector(dir, 12);
      const right = new V3(Math.cos(P.yaw), 0, -Math.sin(P.yaw));
      if (Math.random() < 0.55) this.audio.whiz(miss.dot(right));
    }
    this.fx.tracer(muzzle, end, { color: s.kind === 'sniper' ? 0xffffff : 0xffb050, width: s.kind === 'sniper' ? 0.03 : 0.02, speed: 400, len: 3 });
    if (this.onEnemyFire) this.onEnemyFire(s);
  }

  // ---------------- grenades ----------------
  throwGrenade(s) {
    const P = this.player;
    const from = s.neck.localToWorld(new V3(0.2, 0.3, 0));
    const target = new V3(P.pos.x + (Math.random() - 0.5) * 3, LAYOUT.roofY + 0.08, Math.max(9.8, P.pos.z + (Math.random() - 0.5) * 2.5));
    const T = 1.25;
    const vel = new V3().subVectors(target, from).divideScalar(T); vel.y += 0.5 * 9.8 * T;
    const mesh = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshStandardMaterial({ color: 0x3d4a2a, roughness: 0.6 }));
    body.scale.y = 1.25; mesh.add(body);
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, 0.02), new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.8 }));
    lever.position.set(0.04, 0.06, 0); mesh.add(lever);
    mesh.position.copy(from); mesh.castShadow = true;
    this.scene.add(mesh);
    this.grenades.push({ mesh, vel, fuse: 3.1, landed: false });
    if (this.onGrenade) this.onGrenade();
  }

  updateGrenades(dt) {
    const P = this.player;
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.fuse -= dt;
      const p = g.mesh.position;
      if (!g.landed) {
        g.vel.y -= 9.8 * dt;
        p.addScaledVector(g.vel, dt);
        g.mesh.rotation.x += dt * 10; g.mesh.rotation.z += dt * 7;
        const floor = p.z > LAYOUT.parapetZ + 0.3 && Math.abs(p.x) < 65 ? LAYOUT.roofY + 0.07 : groundHeight(p.x, p.z) + 0.07;
        if (p.y < floor && g.vel.y < 0) {
          p.y = floor;
          if (g.vel.length() > 2.5) { g.vel.y *= -0.3; g.vel.x *= 0.5; g.vel.z *= 0.5; this.audio.grenadeClink(p); }
          else { g.landed = true; }
        }
      }
      if (g.fuse <= 0) {
        this.fx.grenadeBlast(p.clone());
        this.audio.explosion(p.clone(), false);
        const d = p.distanceTo(new V3(P.pos.x, P.pos.y + 0.5, P.pos.z));
        if (d < 6.5) P.hurt(Math.round(95 * (1 - d / 6.5) + 5), p.clone());
        P.shake = Math.max(P.shake, 2.5 * Math.max(0, 1 - d / 20));
        this.scene.remove(g.mesh);
        this.grenades.splice(i, 1);
      }
    }
  }

  liveGrenades() { return this.grenades; }

  shootables() { return [this.group, this.truckGroup]; }

  reset() {
    for (const s of this.soldiers) s.dispose();
    this.soldiers = [];
    for (const t of this.trucks) t.dispose(this.truckGroup);
    this.trucks = [];
    for (const g of this.grenades) this.scene.remove(g.mesh);
    this.grenades = [];
    for (const c of this.covers) c.occ = null;
    this.active = false; this.pool = []; this.snipersPending = 0;
  }
}
