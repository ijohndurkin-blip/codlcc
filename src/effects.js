import * as THREE from 'three';
import { radialTexture, smokeTexture } from './textures.js';

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.tex = {
      smoke: smokeTexture(),
      fire: radialTexture([[0, 'rgba(255,250,220,1)'], [0.25, 'rgba(255,190,80,0.9)'], [0.6, 'rgba(255,90,20,0.35)'], [1, 'rgba(120,20,0,0)']]),
      spark: radialTexture([[0, 'rgba(255,255,240,1)'], [0.3, 'rgba(255,210,120,0.8)'], [1, 'rgba(255,120,20,0)']], 64),
      flash: radialTexture([[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,230,160,0.9)'], [0.5, 'rgba(255,160,60,0.3)'], [1, 'rgba(255,100,0,0)']]),
      dot: radialTexture([[0, 'rgba(255,255,255,1)'], [0.5, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']], 32),
    };
    this.add = this.makePool(260, THREE.AdditiveBlending);
    this.norm = this.makePool(320, THREE.NormalBlending);
    this.emitters = [];

    // tracers
    this.tracers = [];
    const tg = new THREE.BoxGeometry(1, 1, 1); tg.translate(0, 0, 0.5);
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: 0xffd080, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.visible = false; m.frustumCulled = false; m.raycast = () => {};
      this.group.add(m);
      this.tracers.push({ mesh: m, life: 0, max: 0, speed: 0, len: 0, from: new THREE.Vector3(), dir: new THREE.Vector3(), dist: 0, travelled: 0, width: 0.02, trail: false });
    }

    // bullet holes
    this.decals = [];
    this.decalIdx = 0;
    const dg = new THREE.CircleGeometry(0.05, 10);
    const dm = new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 1, polygonOffset: true, polygonOffsetFactor: -4, transparent: true, opacity: 0.9, depthWrite: false });
    for (let i = 0; i < 90; i++) {
      const d = new THREE.Mesh(dg, dm); d.visible = false; d.raycast = () => {};
      this.group.add(d); this.decals.push(d);
    }

    // flash lights
    this.lights = [];
    for (let i = 0; i < 3; i++) {
      const l = new THREE.PointLight(0xffb060, 0, 30, 2);
      this.group.add(l); this.lights.push({ light: l, life: 0, max: 1, peak: 0 });
    }
    this.lightIdx = 0;
  }

  makePool(n, blending) {
    const pool = [];
    for (let i = 0; i < n; i++) {
      const mat = new THREE.SpriteMaterial({ map: this.tex.smoke, transparent: true, depthWrite: false, blending, fog: true });
      const s = new THREE.Sprite(mat); s.visible = false; s.raycast = () => {};
      this.group.add(s);
      pool.push({ s, active: false, vel: new THREE.Vector3(), life: 0, max: 1, s0: 1, s1: 1, a0: 1, grav: 0, drag: 0, rot: 0, idx: i });
    }
    pool.next = 0;
    return pool;
  }

  spawn(pool, o) {
    let p = null;
    for (let k = 0; k < pool.length; k++) {
      const c = pool[(pool.next + k) % pool.length];
      if (!c.active) { p = c; pool.next = (pool.next + k + 1) % pool.length; break; }
    }
    if (!p) { p = pool[pool.next]; pool.next = (pool.next + 1) % pool.length; }
    p.active = true; p.s.visible = true;
    p.s.position.copy(o.pos);
    p.vel.copy(o.vel || new THREE.Vector3());
    p.life = 0; p.max = o.life || 1;
    p.s0 = o.size0 ?? 0.3; p.s1 = o.size1 ?? p.s0;
    p.a0 = o.alpha ?? 1;
    p.grav = o.grav ?? 0; p.drag = o.drag ?? 0;
    p.rot = o.rot ?? (Math.random() - 0.5) * 2;
    p.s.material.map = this.tex[o.tex || 'smoke'];
    p.s.material.color.set(o.color ?? 0xffffff);
    const boost = o.intensity ?? (pool === this.add ? ({ fire: 3.2, flash: 4, spark: 3 })[o.tex] || 1 : 1);
    if (boost !== 1) p.s.material.color.multiplyScalar(boost);
    p.s.material.rotation = Math.random() * Math.PI * 2;
    p.s.material.opacity = p.a0;
    p.s.scale.setScalar(p.s0);
    return p;
  }

  flashLight(pos, intensity, life, color = 0xffb060, dist = 30) {
    const L = this.lights[this.lightIdx++ % this.lights.length];
    L.light.position.copy(pos); L.light.color.set(color); L.light.distance = dist;
    L.peak = intensity; L.life = 0; L.max = life; L.light.intensity = intensity;
  }

  tracer(from, to, { color = 0xffc870, width = 0.025, speed = 600, len = 4, trail = false, life = 0.5 } = {}) {
    const t = this.tracers.find((x) => x.life <= 0) || this.tracers[0];
    t.from.copy(from); t.dir.subVectors(to, from); t.dist = t.dir.length(); t.dir.normalize();
    t.speed = speed; t.len = len; t.travelled = 0; t.trail = trail; t.width = width;
    t.life = life; t.max = life;
    t.mesh.material.color.set(color); t.mesh.material.opacity = 1;
    t.mesh.visible = true;
    t.mesh.position.copy(from);
    t.mesh.lookAt(to);
    t.mesh.scale.set(width, width, 0.01);
  }

  decal(point, normal, size = 1) {
    const d = this.decals[this.decalIdx++ % this.decals.length];
    d.visible = true;
    d.position.copy(point).addScaledVector(normal, 0.012);
    d.lookAt(point.clone().add(normal));
    d.scale.setScalar(size * (0.7 + Math.random() * 0.6));
    return d;
  }

  // ---------- presets ----------
  muzzle(pos, dir, big = false) {
    this.spawn(this.add, { pos, tex: 'flash', size0: big ? 0.9 : 0.35, size1: big ? 1.4 : 0.6, life: 0.06, alpha: 1 });
    this.spawn(this.add, { pos: pos.clone().addScaledVector(dir, big ? 0.35 : 0.15), tex: 'flash', size0: big ? 0.6 : 0.25, size1: 0.2, life: 0.05, color: 0xffd080 });
    for (let i = 0; i < (big ? 6 : 2); i++) {
      this.spawn(this.norm, { pos, vel: dir.clone().multiplyScalar(1 + Math.random() * 2).add(new THREE.Vector3(0, 0.4, 0)), size0: 0.15, size1: big ? 1.2 : 0.6, life: 0.8 + Math.random(), alpha: 0.25, color: 0xd8d4cc, drag: 2 });
    }
  }

  impactDust(point, normal, color = 0xb0a898) {
    for (let i = 0; i < 6; i++) {
      const v = normal.clone().multiplyScalar(1 + Math.random() * 2.5).add(new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random() * 1.5, (Math.random() - 0.5) * 1.5));
      this.spawn(this.norm, { pos: point, vel: v, size0: 0.08, size1: 0.6 + Math.random() * 0.5, life: 0.7 + Math.random() * 0.6, alpha: 0.6, color, drag: 3, grav: -0.3 });
    }
    for (let i = 0; i < 5; i++) {
      const v = normal.clone().multiplyScalar(2).add(new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4));
      this.spawn(this.norm, { pos: point, vel: v, tex: 'dot', size0: 0.035, size1: 0.03, life: 0.6, color: 0x44403a, grav: 9.8 });
    }
  }

  sparks(point, normal, n = 10) {
    for (let i = 0; i < n; i++) {
      const v = normal.clone().multiplyScalar(2 + Math.random() * 3).add(new THREE.Vector3((Math.random() - 0.5) * 5, Math.random() * 4, (Math.random() - 0.5) * 5));
      this.spawn(this.add, { pos: point, vel: v, tex: 'spark', size0: 0.07, size1: 0.02, life: 0.25 + Math.random() * 0.3, grav: 9.8, color: 0xffd9a0 });
    }
    this.spawn(this.add, { pos: point, tex: 'flash', size0: 0.25, size1: 0.5, life: 0.06 });
  }

  blood(point, dir, heavy = false) {
    const n = heavy ? 14 : 8;
    for (let i = 0; i < n; i++) {
      const v = dir.clone().multiplyScalar(1 + Math.random() * 3).add(new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random() * 1.2, (Math.random() - 0.5) * 1.5));
      this.spawn(this.norm, { pos: point, vel: v, size0: 0.1, size1: heavy ? 0.9 : 0.55, life: 0.5 + Math.random() * 0.5, alpha: 0.75, color: 0x6a0808, drag: 3, grav: 1.5 });
    }
  }

  glass(point, dir, n = 40) {
    for (let i = 0; i < n; i++) {
      const v = dir.clone().multiplyScalar(1 + Math.random() * 3).add(new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3));
      const p = point.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 2, 0));
      this.spawn(this.add, { pos: p, vel: v, tex: 'dot', size0: 0.06, size1: 0.04, life: 0.8 + Math.random() * 0.6, grav: 9.8, color: 0xbfe0ff, alpha: 0.9 });
    }
  }

  explosion(pos) {
    this.flashLight(pos.clone().add(new THREE.Vector3(0, 2, 0)), 400, 0.9, 0xffa040, 80);
    for (let i = 0; i < 34; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 9, Math.random() * 9 + 2, (Math.random() - 0.5) * 9);
      this.spawn(this.add, { pos: pos.clone().add(new THREE.Vector3(0, 1, 0)), vel: v, tex: 'fire', size0: 2.5 + Math.random() * 2.5, size1: 6 + Math.random() * 5, life: 0.7 + Math.random() * 0.8, drag: 3.5, grav: -2, intensity: 4 });
    }
    for (let i = 0; i < 40; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 7, Math.random() * 7 + 2, (Math.random() - 0.5) * 7);
      this.spawn(this.norm, { pos: pos.clone().add(new THREE.Vector3(0, 1.5, 0)), vel: v, size0: 1, size1: 10 + Math.random() * 6, life: 4 + Math.random() * 3, alpha: 0.55, color: 0x2a2624, drag: 1.4, grav: -1.4 });
    }
    for (let i = 0; i < 50; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 30, Math.random() * 18 + 4, (Math.random() - 0.5) * 30);
      this.spawn(this.add, { pos: pos.clone().add(new THREE.Vector3(0, 1, 0)), vel: v, tex: 'spark', size0: 0.25, size1: 0.1, life: 0.8 + Math.random() * 1.2, grav: 12, color: 0xffc070 });
    }
    this.spawn(this.add, { pos: pos.clone().add(new THREE.Vector3(0, 1.5, 0)), tex: 'flash', size0: 4, size1: 16, life: 0.25 });
  }

  addFire(pos, duration, scale = 1) {
    this.emitters.push({ pos: pos.clone(), until: duration, t: 0, acc: 0, scale });
  }

  grenadeBlast(pos) {
    this.flashLight(pos.clone().add(new THREE.Vector3(0, 1, 0)), 150, 0.4, 0xffc070, 30);
    for (let i = 0; i < 18; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 6 + 1, (Math.random() - 0.5) * 8);
      this.spawn(this.add, { pos, vel: v, tex: 'fire', size0: 0.6, size1: 2.2, life: 0.35 + Math.random() * 0.3, drag: 4 });
      this.spawn(this.norm, { pos, vel: v.multiplyScalar(0.6), size0: 0.8, size1: 4.5, life: 1.8 + Math.random() * 1.5, alpha: 0.75, color: 0x5a5550, drag: 2, grav: -0.8 });
    }
  }

  update(dt) {
    for (const pool of [this.add, this.norm]) {
      for (const p of pool) {
        if (!p.active) continue;
        p.life += dt;
        const k = p.life / p.max;
        if (k >= 1) { p.active = false; p.s.visible = false; continue; }
        p.vel.y -= p.grav * dt;
        if (p.drag) p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt));
        p.s.position.addScaledVector(p.vel, dt);
        if (p.s.position.y < 0.02 && p.grav > 0) { p.s.position.y = 0.02; p.vel.set(p.vel.x * 0.3, Math.abs(p.vel.y) * 0.2, p.vel.z * 0.3); }
        p.s.scale.setScalar(p.s0 + (p.s1 - p.s0) * Math.sqrt(k));
        p.s.material.opacity = p.a0 * (1 - k) * Math.min(1, k * 12 + 0.3);
        p.s.material.rotation += p.rot * dt;
      }
    }
    for (const t of this.tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      if (t.trail) {
        // persistent vapour trail that fades
        t.mesh.position.copy(t.from);
        t.mesh.scale.set(t.width * (1 + (1 - t.life / t.max) * 2), t.width * (1 + (1 - t.life / t.max) * 2), t.dist);
        t.mesh.material.opacity = Math.max(0, t.life / t.max) * 0.35;
      } else {
        t.travelled += t.speed * dt;
        const head = Math.min(t.dist, t.travelled);
        const tail = Math.max(0, head - t.len);
        t.mesh.position.copy(t.from).addScaledVector(t.dir, tail);
        t.mesh.scale.set(t.width, t.width, Math.max(0.01, head - tail));
        if (t.travelled - t.len > t.dist) t.life = 0;
      }
      if (t.life <= 0) t.mesh.visible = false;
    }
    for (const L of this.lights) {
      if (L.life >= L.max) { L.light.intensity = 0; continue; }
      L.life += dt;
      L.light.intensity = L.peak * Math.pow(Math.max(0, 1 - L.life / L.max), 2);
    }
    for (let i = this.emitters.length - 1; i >= 0; i--) {
      const e = this.emitters[i];
      e.t += dt; e.acc += dt;
      const s = e.scale * Math.max(0.2, 1 - e.t / e.until);
      while (e.acc > 0.05) {
        e.acc -= 0.05;
        const jitter = new THREE.Vector3((Math.random() - 0.5) * 2 * s, 0, (Math.random() - 0.5) * 2 * s);
        if (e.t < e.until * 0.7) this.spawn(this.add, { pos: e.pos.clone().add(jitter), vel: new THREE.Vector3(0, 2 + Math.random() * 2, 0), tex: 'fire', size0: 1.2 * s, size1: 0.3, life: 0.6 + Math.random() * 0.4, alpha: 0.9 });
        this.spawn(this.norm, { pos: e.pos.clone().add(jitter).add(new THREE.Vector3(0, 1.5, 0)), vel: new THREE.Vector3(0.6, 2.5 + Math.random(), 0.2), size0: 1 * s, size1: 6 * s, life: 4 + Math.random() * 2, alpha: 0.5, color: 0x1e1c1b, drag: 0.2 });
      }
      if (e.t > e.until) this.emitters.splice(i, 1);
    }
  }

  clearPersistent() { this.emitters.length = 0; }
}
