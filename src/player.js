import * as THREE from 'three';
import { LAYOUT } from './world.js';

const BASE_FOV = 72;
export const WEAPONS = {
  l115: { name: 'L115 .338 BOLT-ACTION', mag: 5, cycle: 1.05, reload: 2.4, maxZoom: 12, recoil: 0.035, hipRecoil: 0.09, bolt: true, power: 1, pierce: 0, heavy: false },
  fifty: { name: '.50 CAL ANTI-MATERIEL', mag: 8, cycle: 0.3, reload: 2.8, maxZoom: 16, recoil: 0.06, hipRecoil: 0.14, bolt: false, power: 3, pierce: 3, heavy: true },
};

export class Player {
  constructor({ camera, vmScene, vmCamera, audio, T, canvas }) {
    this.camera = camera; this.vmScene = vmScene; this.vmCamera = vmCamera; this.audio = audio; this.canvas = canvas;
    this.pos = new THREE.Vector3(0, LAYOUT.roofY, 9.7);
    this.yaw = 0; this.pitch = -0.12;
    this.crouch = 0; this.crouching = false;
    this.ads = 0; this.adsHeld = false;
    this.zoom = 6;
    this.breath = 1; this.holdingBreath = false; this.breathLock = 0;
    this.weapon = 'l115'; this.unlocked = { l115: true }; this.ammoBy = { l115: 5, fifty: 8 }; this.switchT = 0;
    this.ammo = 5; this.reloadT = 0; this.boltT = 0;
    this.health = 100; this.sinceHurt = 99;
    this.keys = {};
    this.recoil = 0; this.recoilYaw = 0; this.shake = 0;
    this.swayT = 0; this.vmSway = new THREE.Vector2();
    this.moving = 0; this.time = 0;
    this.enabled = false; this.dead = false;
    this.onShoot = null; this.onHurt = null;
    this.sensitivity = 0.0022;
    this.buildViewmodel(T);
    this.bindInput();
  }

  // ---------------- viewmodel ----------------
  buildViewmodel(T) {
    const s = (o) => new THREE.MeshStandardMaterial(o);
    const tan = s({ color: 0x7c6d50, roughness: 0.65, metalness: 0.1 });
    const black = s({ color: 0x16171a, roughness: 0.35, metalness: 0.85 });
    const steel = s({ color: 0x3a3d42, roughness: 0.25, metalness: 1 });
    const glove = s({ color: 0x26241f, roughness: 0.85 });
    const sleeve = s({ map: T.woodland, roughness: 0.95 });
    const lens = new THREE.MeshPhysicalMaterial({ color: 0x0a1a2a, roughness: 0, metalness: 0.5, clearcoat: 1, envMapIntensity: 3 });
    const rifle = this.rifle = new THREE.Group();
    const handParts = [];
    const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, parent = rifle) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); parent.add(m); return m;
    };
    const cyl = (r, l, seg = 20) => { const g = new THREE.CylinderGeometry(r, r, l, seg); g.rotateX(Math.PI / 2); return g; };
    // chassis / stock
    add(new THREE.BoxGeometry(0.055, 0.065, 0.42), tan, 0, -0.005, -0.33);
    add(new THREE.BoxGeometry(0.05, 0.07, 0.36), black, 0, 0, 0.0);
    add(new THREE.BoxGeometry(0.045, 0.13, 0.26), tan, 0, -0.03, 0.34);
    add(new THREE.BoxGeometry(0.05, 0.035, 0.2), tan, 0, 0.045, 0.32);
    add(new THREE.BoxGeometry(0.055, 0.15, 0.03), black, 0, -0.035, 0.48);
    add(new THREE.BoxGeometry(0.035, 0.11, 0.05), tan, 0, -0.08, 0.13, 0.35);
    add(new THREE.BoxGeometry(0.04, 0.09, 0.08), black, 0, -0.07, -0.02);
    add(new THREE.TorusGeometry(0.03, 0.005, 6, 12, Math.PI), black, 0, -0.045, 0.06, 0, Math.PI / 2, Math.PI);
    // barrel
    add(cyl(0.012, 0.72), steel, 0, 0.01, -0.75);
    add(cyl(0.02, 0.09, 8), black, 0, 0.01, -1.12);
    this.vmMuzzle = new THREE.Object3D(); this.vmMuzzle.position.set(0, 0.01, -1.18); rifle.add(this.vmMuzzle);
    // bipod folded
    add(new THREE.BoxGeometry(0.012, 0.012, 0.22), black, 0.02, -0.05, -0.42);
    add(new THREE.BoxGeometry(0.012, 0.012, 0.22), black, -0.02, -0.05, -0.42);
    // scope
    const sy = 0.075;
    add(cyl(0.018, 0.3), black, 0, sy, -0.02);
    add(new THREE.CylinderGeometry(0.03, 0.019, 0.07, 24).rotateX(Math.PI / 2), black, 0, sy, -0.2);
    add(cyl(0.03, 0.06), black, 0, sy, -0.255);
    add(cyl(0.026, 0.07), black, 0, sy, 0.15);
    add(new THREE.CircleGeometry(0.026, 24), lens, 0, sy, -0.2855, 0, Math.PI);
    add(new THREE.CircleGeometry(0.022, 24), lens, 0, sy, 0.186);
    add(new THREE.CylinderGeometry(0.012, 0.012, 0.025, 12), black, 0, sy + 0.025, -0.02);
    add(new THREE.CylinderGeometry(0.012, 0.012, 0.025, 12), black, 0.025, sy, -0.02, 0, 0, Math.PI / 2);
    for (const z of [-0.09, 0.06]) add(new THREE.BoxGeometry(0.03, 0.05, 0.02), black, 0, 0.045, z);
    // magazine
    this.vmMag = add(new THREE.BoxGeometry(0.035, 0.08, 0.09), black, 0, -0.065, -0.07);
    // bolt
    const bolt = this.vmBolt = new THREE.Group(); bolt.position.set(0.028, 0.012, 0.09); rifle.add(bolt);
    add(new THREE.CylinderGeometry(0.006, 0.006, 0.07, 8), steel, 0.03, 0, 0, 0, 0, Math.PI / 2, bolt);
    add(new THREE.SphereGeometry(0.014, 12, 8), black, 0.066, -0.004, 0, 0, 0, 0, bolt);
    // hands + sleeves
    const limb = (a, b, r0, r1, mat) => {
      const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
      const len = A.distanceTo(B);
      const g = new THREE.CylinderGeometry(r0, r1, len, 12);
      const m = new THREE.Mesh(g, mat);
      m.position.copy(A).add(B).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
      rifle.add(m); handParts.push(m); return m;
    };
    const hand = (...args) => { const m = add(...args); handParts.push(m); return m; };
    // left hand cupping the fore-end, forearm running back to the bottom-left of the screen
    hand(new THREE.BoxGeometry(0.07, 0.045, 0.11), glove, 0, -0.06, -0.42, 0.1, 0, 0);
    hand(new THREE.BoxGeometry(0.02, 0.05, 0.08), glove, 0.035, -0.035, -0.42);
    limb([-0.01, -0.075, -0.38], [-0.06, -0.13, -0.27], 0.033, 0.036, glove);
    limb([-0.06, -0.13, -0.27], [-0.2, -0.32, 0.02], 0.042, 0.05, sleeve);
    // right hand on the grip
    hand(new THREE.BoxGeometry(0.06, 0.1, 0.07), glove, 0.005, -0.09, 0.13, 0.35);
    hand(new THREE.BoxGeometry(0.02, 0.02, 0.06), glove, 0.0, -0.05, 0.075);
    limb([0.01, -0.13, 0.16], [0.05, -0.17, 0.27], 0.034, 0.038, glove);
    limb([0.05, -0.17, 0.27], [0.16, -0.36, 0.5], 0.046, 0.054, sleeve);
    rifle.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; } });
    this.vmCamera.add(rifle);
    this.vmScene.add(this.vmCamera);
    // muzzle flash for viewmodel
    const fl = document.createElement('canvas'); fl.width = fl.height = 128;
    const c = fl.getContext('2d'); const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,230,1)'); g.addColorStop(0.3, 'rgba(255,200,90,0.8)'); g.addColorStop(1, 'rgba(255,120,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    const ft = new THREE.CanvasTexture(fl); ft.colorSpace = THREE.SRGBColorSpace;
    this.vmFlash = new THREE.Sprite(new THREE.SpriteMaterial({ map: ft, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    this.vmFlash.position.copy(this.vmMuzzle.position); this.vmFlash.scale.setScalar(0.001);
    rifle.add(this.vmFlash);
    this.vmLight = new THREE.PointLight(0xffb060, 0, 3); this.vmLight.position.set(0, 0, -1); rifle.add(this.vmLight);
    this.flashT = 0;
    this.models = { l115: { group: rifle, muzzle: this.vmMuzzle, bolt: this.vmBolt, mag: this.vmMag, flash: this.vmFlash, light: this.vmLight } };

    // ---- the .50 cal ----
    const fifty = new THREE.Group();
    const gun = s({ color: 0x23262a, roughness: 0.45, metalness: 0.7 });
    const od = s({ color: 0x4a4f3a, roughness: 0.7, metalness: 0.1 });
    const fadd = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => add(geo, mat, x, y, z, rx, ry, rz, fifty);
    fadd(new THREE.BoxGeometry(0.075, 0.1, 0.55), gun, 0, -0.005, -0.02);
    fadd(new THREE.BoxGeometry(0.08, 0.075, 0.48), od, 0, -0.01, -0.5);
    for (let i = 0; i < 7; i++) fadd(new THREE.BoxGeometry(0.084, 0.012, 0.03), gun, 0, 0.03, -0.32 - i * 0.055);
    fadd(cyl(0.019, 0.62), steel, 0, 0.012, -0.98);
    fadd(new THREE.BoxGeometry(0.075, 0.055, 0.13), gun, 0, 0.012, -1.33);
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) fadd(new THREE.BoxGeometry(0.01, 0.035, 0.018), black, sx * 0.039, 0.012, -1.29 - i * 0.035);
    fadd(new THREE.BoxGeometry(0.06, 0.15, 0.3), od, 0, -0.035, 0.4);
    fadd(new THREE.BoxGeometry(0.06, 0.04, 0.2), gun, 0, 0.05, 0.38);
    fadd(new THREE.BoxGeometry(0.066, 0.17, 0.035), black, 0, -0.04, 0.56);
    fadd(new THREE.BoxGeometry(0.04, 0.12, 0.055), gun, 0, -0.09, 0.13, 0.35);
    const fmag = fadd(new THREE.BoxGeometry(0.06, 0.13, 0.13), gun, 0, -0.1, -0.07);
    fadd(cyl(0.022, 0.36), black, 0, 0.075, -0.02);
    fadd(new THREE.CylinderGeometry(0.04, 0.023, 0.08, 24).rotateX(Math.PI / 2), black, 0, 0.075, -0.24);
    fadd(cyl(0.04, 0.07), black, 0, 0.075, -0.3);
    fadd(cyl(0.03, 0.07), black, 0, 0.075, 0.18);
    fadd(new THREE.CircleGeometry(0.035, 24), lens, 0, 0.075, -0.3355, 0, Math.PI);
    fadd(new THREE.CylinderGeometry(0.016, 0.016, 0.03, 12), black, 0, 0.105, -0.02);
    fadd(new THREE.CylinderGeometry(0.016, 0.016, 0.03, 12), black, 0.03, 0.075, -0.02, 0, 0, Math.PI / 2);
    for (const z of [-0.12, 0.08]) fadd(new THREE.BoxGeometry(0.04, 0.05, 0.025), black, 0, 0.045, z);
    for (const sx of [-1, 1]) fadd(new THREE.BoxGeometry(0.014, 0.014, 0.3), black, sx * 0.025, -0.06, -0.6);
    const fbolt = new THREE.Group(); fbolt.position.set(0.04, 0.02, 0.05); fifty.add(fbolt);
    add(new THREE.BoxGeometry(0.03, 0.02, 0.03), steel, 0.015, 0, 0, 0, 0, 0, fbolt);
    for (const h of handParts) fifty.add(h.clone());
    const fMuzzle = new THREE.Object3D(); fMuzzle.position.set(0, 0.012, -1.42); fifty.add(fMuzzle);
    const fFlash = this.vmFlash.clone(); fFlash.material = this.vmFlash.material.clone(); fFlash.position.copy(fMuzzle.position); fifty.add(fFlash);
    const fLight = new THREE.PointLight(0xffb060, 0, 3); fLight.position.set(0, 0, -1.2); fifty.add(fLight);
    fifty.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
    fifty.visible = false;
    this.vmCamera.add(fifty);
    this.models.fifty = { group: fifty, muzzle: fMuzzle, bolt: fbolt, mag: fmag, flash: fFlash, light: fLight, magY: -0.1 };
    this.models.l115.magY = -0.065;
  }

  get W() { return WEAPONS[this.weapon]; }

  setModel(name) {
    for (const k in this.models) this.models[k].group.visible = false;
    const m = this.models[name];
    this.rifle = m.group; this.vmMuzzle = m.muzzle; this.vmBolt = m.bolt; this.vmMag = m.mag; this.vmFlash = m.flash; this.vmLight = m.light;
  }

  switchWeapon(name) {
    if (!this.unlocked[name] || this.weapon === name || this.switchT > 0 || this.dead) return;
    this.ammoBy[this.weapon] = this.ammo;
    this.switchT = 0.6; this.switchTo = name;
    this.reloadT = 0; this.boltT = 0;
    this.audio.dryFire();
  }

  unlock(name) {
    this.unlocked[name] = true;
    this.ammoBy[name] = WEAPONS[name].mag;
    this.switchWeapon(name);
  }

  // ---------------- input ----------------
  bindInput() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (!this.enabled) return;
      if (e.code === 'KeyR') this.startReload();
      if (e.code === 'Digit1') this.switchWeapon('l115');
      if (e.code === 'Digit2') this.switchWeapon('fifty');
      if (e.code === 'KeyQ') this.switchWeapon(this.weapon === 'l115' ? 'fifty' : 'l115');
      if (e.code === 'KeyC' || e.code === 'ControlLeft') this.crouching = !this.crouching;
      if (e.code === 'Space') this.crouching = false;
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    document.addEventListener('mousemove', (e) => {
      if (!this.enabled || document.pointerLockElement !== this.canvas) return;
      const zoomScale = 1 - this.ads * (1 - 1 / this.zoom) * 0.92;
      const sx = e.movementX * this.sensitivity * zoomScale, sy = e.movementY * this.sensitivity * zoomScale;
      this.yaw -= sx; this.pitch -= sy;
      this.pitch = Math.max(-1.3, Math.min(1.0, this.pitch));
      this.vmSway.x = Math.max(-0.04, Math.min(0.04, this.vmSway.x - e.movementX * 0.00012));
      this.vmSway.y = Math.max(-0.04, Math.min(0.04, this.vmSway.y + e.movementY * 0.00012));
    });
    document.addEventListener('mousedown', (e) => {
      if (!this.enabled || document.pointerLockElement !== this.canvas) return;
      if (e.button === 0) this.fire();
      if (e.button === 2) this.adsHeld = true;
    });
    document.addEventListener('mouseup', (e) => { if (e.button === 2) this.adsHeld = false; });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('wheel', (e) => {
      if (!this.enabled || this.ads < 0.5) return;
      this.zoom = Math.max(3, Math.min(this.W.maxZoom, this.zoom - Math.sign(e.deltaY) * 1));
    }, { passive: true });
  }

  reset() {
    this.weapon = 'l115'; this.unlocked = { l115: true }; this.ammoBy = { l115: 5, fifty: 8 }; this.switchT = 0;
    this.setModel('l115'); this.zoom = 6;
    this.health = 100; this.ammo = 5; this.reloadT = 0; this.boltT = 0; this.dead = false;
    this.ads = 0; this.adsHeld = false; this.crouching = false; this.crouch = 0; this.breath = 1;
    this.pos.set(0, LAYOUT.roofY, 9.7); this.yaw = 0; this.pitch = -0.16; this.sinceHurt = 99;
  }

  get canFire() { return this.boltT <= 0 && this.reloadT <= 0 && this.ammo > 0 && !this.dead; }

  fire() {
    if (this.dead) return;
    if (this.reloadT > 0 || this.boltT > 0 || this.switchT > 0) return;
    const W = this.W;
    if (this.ammo <= 0) { this.audio.dryFire(); this.startReload(); return; }
    this.ammo--;
    this.audio.sniperShot(W.heavy);
    const origin = new THREE.Vector3(), dir = new THREE.Vector3();
    this.camera.getWorldPosition(origin);
    this.camera.getWorldDirection(dir);
    const scoped = this.ads > 0.9;
    if (!scoped) {
      // hip fire is wild
      const spread = 0.06 * (1 - this.ads);
      dir.x += (Math.random() - 0.5) * spread; dir.y += (Math.random() - 0.5) * spread; dir.z += (Math.random() - 0.5) * spread;
      dir.normalize();
    }
    const muzzle = scoped
      ? origin.clone().add(new THREE.Vector3(0, -0.12, 0)).addScaledVector(dir, 0.8)
      : origin.clone().add(new THREE.Vector3(Math.cos(this.yaw) * 0.22, -0.2, -Math.sin(this.yaw) * 0.22)).addScaledVector(dir, 1.0);
    this.recoil += scoped ? W.recoil : W.hipRecoil;
    this.recoilYaw += (Math.random() - 0.5) * 0.02;
    this.shake = W.heavy ? 1.1 : 0.6;
    this.flashT = 0.05;
    this.boltT = W.cycle;
    if (this.ammo > 0 && W.bolt) this.audio.bolt(0.35);
    if (this.onShoot) this.onShoot(origin, dir, muzzle, scoped, W);
    if (this.ammo === 0) setTimeout(() => this.startReload(), 1000);
  }

  startReload() {
    if (this.reloadT > 0 || this.ammo === this.W.mag || this.dead || this.switchT > 0) return;
    this.reloadT = this.W.reload;
    this.boltT = 0;
    this.audio.reload();
  }

  hurt(amount, fromPos) {
    if (this.dead) return;
    this.health -= amount;
    this.sinceHurt = 0;
    this.recoil += 0.02; this.recoilYaw += (Math.random() - 0.5) * 0.03;
    this.shake = Math.max(this.shake, 0.4);
    this.audio.playerHurt();
    if (this.onHurt) this.onHurt(amount, fromPos);
    if (this.health <= 0) { this.health = 0; this.dead = true; }
  }

  // ---------------- update ----------------
  update(dt) {
    this.time += dt;
    const k = this.keys;
    // movement along the rooftop
    let mx = 0, mz = 0;
    if (this.enabled && !this.dead) {
      if (k.KeyW) mz -= 1; if (k.KeyS) mz += 1; if (k.KeyA) mx -= 1; if (k.KeyD) mx += 1;
    }
    const sprint = k.ShiftLeft && this.ads < 0.2 && !this.crouching;
    const speed = this.crouching ? 1.4 : sprint ? 4.6 : 2.7;
    if (mx || mz) {
      const len = Math.hypot(mx, mz); mx /= len; mz /= len;
      const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
      this.pos.x += (mx * c + mz * s) * speed * dt;
      this.pos.z += (-mx * s + mz * c) * speed * dt;
      this.moving = Math.min(1, this.moving + dt * 6);
    } else this.moving = Math.max(0, this.moving - dt * 6);
    this.pos.x = Math.max(-16, Math.min(16, this.pos.x));
    this.pos.z = Math.max(9.42, Math.min(15.5, this.pos.z));

    // ADS
    const wantAds = this.adsHeld && this.reloadT <= 0 && this.switchT <= 0 && !this.dead && this.enabled;
    this.ads += ((wantAds ? 1 : 0) - this.ads) * Math.min(1, dt * 11);
    if (Math.abs(this.ads - (wantAds ? 1 : 0)) < 0.002) this.ads = wantAds ? 1 : 0;
    this.crouch += ((this.crouching ? 1 : 0) - this.crouch) * Math.min(1, dt * 8);

    // breath
    const wantHold = k.ShiftLeft && this.ads > 0.9 && this.breathLock <= 0;
    if (wantHold && !this.holdingBreath && this.breath > 0.1) { this.holdingBreath = true; this.audio.breath(true); }
    if (this.holdingBreath && (!wantHold || this.breath <= 0)) {
      this.holdingBreath = false; this.audio.breath(false);
      if (this.breath <= 0) this.breathLock = 2.2;
    }
    if (this.holdingBreath) this.breath = Math.max(0, this.breath - dt / 4.5);
    else this.breath = Math.min(1, this.breath + dt / 3);
    this.breathLock = Math.max(0, this.breathLock - dt);

    // timers
    if (this.boltT > 0) this.boltT -= dt;
    if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0) { this.ammo = this.W.mag; this.reloadT = 0; } }
    if (this.switchT > 0) {
      const before = this.switchT;
      this.switchT -= dt;
      if (before > 0.3 && this.switchT <= 0.3) {
        this.weapon = this.switchTo; this.setModel(this.weapon);
        this.ammo = this.ammoBy[this.weapon];
        this.zoom = Math.min(this.zoom, this.W.maxZoom);
      }
      if (this.switchT < 0) this.switchT = 0;
    }
    this.sinceHurt += dt;
    if (this.sinceHurt > 4 && this.health < 100 && !this.dead) this.health = Math.min(100, this.health + 28 * dt);

    // recoil recovery
    this.recoil *= Math.max(0, 1 - dt * 7);
    this.recoilYaw *= Math.max(0, 1 - dt * 7);
    this.shake *= Math.max(0, 1 - dt * 6);

    // scope sway
    this.swayT += dt;
    let amp = 0.0042 * (6 / this.zoom + 0.6) * (this.crouching ? 0.7 : 1);
    if (this.holdingBreath) amp *= 0.08;
    if (this.breathLock > 0) amp *= 2.2;
    amp *= 0.4 + 0.6 * this.ads;
    amp *= 1 + this.moving * 2;
    const swX = (Math.sin(this.swayT * 0.9) + Math.sin(this.swayT * 1.7 + 1) * 0.5) * amp;
    const swY = (Math.sin(this.swayT * 1.3 + 2) * 0.8 + Math.cos(this.swayT * 0.7) * 0.4) * amp;
    const sh = this.shake * 0.01;

    // camera
    const eye = THREE.MathUtils.lerp(1.72, 0.76, this.crouch) + Math.sin(this.time * 9) * 0.02 * this.moving;
    this.camera.position.set(this.pos.x, this.pos.y + eye, this.pos.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch + this.recoil + swY + (Math.random() - 0.5) * sh, this.yaw + this.recoilYaw + swX + (Math.random() - 0.5) * sh, 0);
    const fov = THREE.MathUtils.lerp(BASE_FOV - (sprint ? -6 : 0), BASE_FOV / this.zoom, Math.pow(this.ads, 2));
    if (Math.abs(this.camera.fov - fov) > 0.01) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }

    this.updateViewmodel(dt, sprint);
  }

  updateViewmodel(dt, sprint) {
    const r = this.rifle, a = this.ads, t = this.time;
    this.vmSway.multiplyScalar(Math.max(0, 1 - dt * 8));
    const hip = new THREE.Vector3(0.235, -0.235, -0.56), adsP = new THREE.Vector3(0, -0.075, -0.24);
    const p = hip.lerp(adsP, a);
    const bobA = (1 - a * 0.9) * this.moving * (sprint ? 2 : 1);
    p.x += Math.sin(t * 8) * 0.01 * bobA + this.vmSway.x * (1 - a);
    p.y += Math.abs(Math.cos(t * 8)) * 0.012 * bobA + Math.sin(t * 1.6) * 0.003 * (1 - a) + this.vmSway.y * (1 - a);
    p.z += this.recoil * 1.2;
    let rx = this.recoil * 2.2, ry = sprint ? 0.6 : 0, rz = sprint ? 0.3 : 0;
    p.y -= this.crouch * 0.01;
    // bolt cycle
    let boltSlide = 0, boltLift = 0;
    if (this.boltT > 0 && this.W.bolt) {
      const bt = 1.05 - this.boltT;
      const ph = (bt - 0.3) / 0.6;
      if (ph > 0 && ph < 1) {
        boltLift = Math.sin(Math.min(1, ph * 3) * Math.PI / 2) * (ph < 0.75 ? 1 : (1 - ph) * 4);
        boltSlide = Math.sin(Math.min(1, Math.max(0, (ph - 0.2) / 0.55)) * Math.PI) * 0.09;
        rz += 0.15 * Math.sin(ph * Math.PI); p.y -= 0.02 * Math.sin(ph * Math.PI) * (1 - a * 0.7);
      }
    }
    this.vmBolt.rotation.x = 0; this.vmBolt.rotation.z = boltLift * 1.2;
    this.vmBolt.position.z = 0.09 + boltSlide;
    // reload
    const magY = this.models[this.weapon].magY;
    if (this.switchT > 0) { const sw = Math.sin((this.switchT / 0.6) * Math.PI); p.y -= 0.35 * sw; rx -= 0.6 * sw; }
    if (this.reloadT > 0) {
      const R = this.W.reload, rt = R - this.reloadT, ph = rt / R;
      const s = Math.sin(Math.min(1, ph * 1.3) * Math.PI);
      rz += 0.6 * s; rx += 0.25 * s; p.y -= 0.08 * s; p.x -= 0.05 * s;
      const magOut = ph > 0.1 && ph < 0.55 ? Math.sin(((ph - 0.1) / 0.45) * Math.PI) : 0;
      this.vmMag.position.y = magY - magOut * 0.35;
    } else this.vmMag.position.y = magY;
    r.position.copy(p);
    r.rotation.set(rx, ry + 0.035 * (1 - a) + this.vmSway.x * 2 * (1 - a), rz);
    // flash
    if (this.flashT > 0) {
      this.flashT -= dt;
      this.vmFlash.scale.setScalar(0.35 + Math.random() * 0.2); this.vmFlash.material.rotation = Math.random() * 6;
      this.vmLight.intensity = 8;
    } else { this.vmFlash.scale.setScalar(0.0001); this.vmLight.intensity = 0; }
    r.visible = a < 0.88;
  }
}
