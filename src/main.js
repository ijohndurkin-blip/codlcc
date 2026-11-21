import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { buildTextures, setAnisotropy } from './textures.js';
import { buildWorld, LAYOUT } from './world.js';
import { CarSystem } from './cars.js';
import { Civilians } from './civilians.js';
import { Effects } from './effects.js';
import { AudioEngine } from './audio.js';
import { Player, WEAPONS, ORDER } from './player.js';
import { Enemies } from './enemies.js';
import { SOLDIER_DETAIL } from './soldier.js';
import { applyLowMaterials } from './lowmat.js';
import { UI } from './ui.js';
import { TouchControls } from './touch.js';

const $ = (id) => document.getElementById(id);
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
const progress = async (pct, text) => { $('load-fill').style.width = pct + '%'; $('load-text').textContent = text; await nextFrame(); };

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, desat: { value: 0 }, hurt: { value: 0 }, slowmo: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, desat, hurt, slowmo; varying vec2 vUv;
    float rand(vec2 co){ return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv; vec2 d = uv - 0.5;
      float ca = 0.0012 + slowmo * 0.006 + hurt * 0.003;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + d * ca).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - d * ca).b;
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, col * vec3(0.9, 1.0, 1.08), smoothstep(0.55, 0.0, l) * 0.7);
      col = mix(col, col * vec3(1.07, 1.0, 0.9), smoothstep(0.35, 1.0, l) * 0.5);
      col = (col - 0.5) * 1.07 + 0.5;
      col = mix(col, vec3(l), clamp(desat, 0.0, 1.0));
      col = mix(col, col * vec3(1.35, 0.55, 0.5), hurt * 0.45);
      float v = smoothstep(0.9, 0.28, length(d * vec2(1.0, 0.85)));
      col *= mix(0.5, 1.0, v);
      col += (rand(uv * (time + 1.0)) - 0.5) * 0.03;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

async function boot() {
  const isTouch = matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && !matchMedia('(pointer: fine)').matches);
  document.body.classList.toggle('touch', isTouch);
  const fsEl = document.documentElement;
  const fsSupported = !!(fsEl.requestFullscreen || fsEl.webkitRequestFullscreen);
  if (!fsSupported) document.body.classList.add('no-fs');
  await progress(5, 'Starting renderer…');
  const canvas = $('game');
  // phones render straight to the screen on LOW, so give the default framebuffer its own (cheap, on-tile) MSAA
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: isTouch, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  setAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 1500);
  camera.rotation.order = 'YXZ';
  const vmScene = new THREE.Scene();
  const vmCamera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.01, 10);

  // ---------- sky & light ----------
  await progress(12, 'Painting the Merseyside sky…');
  const sunDir = new THREE.Vector3(-0.8, 0.24, 0.55).normalize();
  const sky = new Sky(); sky.scale.setScalar(4000);
  const su = sky.material.uniforms;
  su.turbidity.value = 7; su.rayleigh.value = 1.4; su.mieCoefficient.value = 0.006; su.mieDirectionalG.value = 0.86;
  su.sunPosition.value.copy(sunDir);
  scene.add(sky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const sky2 = new Sky(); sky2.scale.setScalar(1000); Object.assign(sky2.material.uniforms.turbidity, { value: 7 });
  sky2.material.uniforms.rayleigh.value = 1.4; sky2.material.uniforms.sunPosition.value.copy(sunDir);
  envScene.add(sky2);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshBasicMaterial({ color: 0x3a3a36 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -5; envScene.add(ground);
  const envTex = pmrem.fromScene(envScene, 0.02).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.55;
  vmScene.environment = envTex;
  scene.fog = new THREE.FogExp2(0xb9b4ab, 0.0042);

  // procedural cloud layer
  const cloudMat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, sunDir: { value: sunDir } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      uniform float time; uniform vec3 sunDir; varying vec3 vDir;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), f.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), f.x), f.y); }
      float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < OCT; i++){ v += a*noise(p); p = p*2.03 + 1.7; a *= 0.5; } return v; }
      void main(){
        vec3 d = normalize(vDir);
        if (d.y < 0.0) discard;
        vec2 uv = d.xz / (d.y + 0.08) * 1.3 + vec2(time*0.006, time*0.002);
        float n = fbm(uv);
        float cov = smoothstep(0.46, 0.8, n);
        float sh = fbm(uv + sunDir.xz * 0.12);
        float lit = clamp(0.75 + (n - sh) * 4.0, 0.35, 1.35);
        float sunAmt = pow(max(dot(d, sunDir), 0.0), 8.0);
        vec3 col = mix(vec3(0.42,0.45,0.52), vec3(1.05,1.0,0.94), lit) * 2.2 + vec3(2.4,1.5,0.8) * sunAmt * (1.0 - cov * 0.5);
        float fade = smoothstep(0.0, 0.22, d.y);
        gl_FragColor = vec4(col, cov * fade * 0.92);
      }`,
    transparent: true, depthWrite: false, side: THREE.BackSide, fog: false, defines: { OCT: 6 },
  });
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(1300, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), cloudMat);
  clouds.renderOrder = -1;
  scene.add(clouds);

  const sun = new THREE.DirectionalLight(0xffe2bd, 3.2);
  sun.position.copy(sunDir).multiplyScalar(140).add(new THREE.Vector3(0, 0, -12));
  sun.target.position.set(0, 0, -12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const sc = sun.shadow.camera; sc.left = -75; sc.right = 75; sc.top = 60; sc.bottom = -60; sc.near = 20; sc.far = 320;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; sun.shadow.radius = 2;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0xc4d4ea, 0x4a4238, 0.55));
  const vmSun = new THREE.DirectionalLight(0xffe2bd, 2.2); vmSun.position.set(-1, 1, 1);
  vmScene.add(vmSun, new THREE.HemisphereLight(0xc4d4ea, 0x4a4238, 0.6));

  // ---------- content ----------
  await progress(22, 'Laying tarmac on Brewster St…');
  const T = buildTextures();
  await progress(48, 'Building Liverpool Car Centre…');
  const world = buildWorld(scene, T, renderer);
  await progress(66, 'Parking the stock…');
  await progress(78, 'Briefing the troops…');
  const fx = new Effects(scene);
  const audio = new AudioEngine();
  audio.lowPower = isTouch;
  const carSys = new CarSystem(scene, T, fx, audio);
  const carGroup = carSys.group, cars = carSys.cars;
  const ui = new UI();
  const player = new Player({ camera, vmScene, vmCamera, audio, T, canvas });
  const enemies = new Enemies({ scene, T, audio, effects: fx, cars, player });
  const civ = new Civilians({ scene, world, carSys, audio, enemies, fx });
  // nobody takes cover where the valeter is washing the Corsa
  enemies.covers = enemies.covers.filter((c) => !(c.z === LAYOUT.lanes.a3 && c.x < -23.8));

  // ---------- post ----------
  await progress(88, 'Calibrating optics…');
  const rt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, window.innerWidth, window.innerHeight);
  gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1, scale: 1.2, samples: 12 });
  gtao.blendIntensity = 0.85;
  gtao.enabled = false;
  composer.addPass(gtao);
  const vmPass = new RenderPass(vmScene, vmCamera); vmPass.clear = false; vmPass.clearDepth = true;
  composer.addPass(vmPass);
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.32, 0.55, 0.88);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);

  // ---------- graphics quality ----------
  const G_render = { direct: false, frame: 0, matT: 0 };
  let skyCube = null;
  function bakeSky() {
    if (skyCube) return skyCube;
    const rt = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
    const cc = new THREE.CubeCamera(1, 5000, rt);
    const bake = new THREE.Scene();
    sky.visible = true; clouds.visible = true;
    bake.add(sky, clouds);
    cc.update(renderer, bake);
    scene.add(sky, clouds);
    skyCube = rt.texture;
    return skyCube;
  }
  const QUALITY = ['LOW', 'MEDIUM', 'HIGH', 'ULTRA'];
  let quality = isTouch ? 'LOW' : 'HIGH';
  try { quality = localStorage.getItem(isTouch ? 'lcc_gfx_touch' : 'lcc_gfx') || quality; } catch (e) { /* ignore */ }
  if (!QUALITY.includes(quality)) quality = 'HIGH';
  function applyQuality() {
    const dpr = window.devicePixelRatio;
    const pr = quality === 'LOW' ? Math.min(dpr, 1) * (isTouch ? 0.75 : 1) : quality === 'MEDIUM' ? Math.min(dpr, isTouch ? 1.25 : 1) : quality === 'HIGH' ? Math.min(dpr, 1.5) : Math.min(dpr, 2);
    renderer.setPixelRatio(pr); composer.setPixelRatio(pr);
    renderer.setSize(window.innerWidth, window.innerHeight); composer.setSize(window.innerWidth, window.innerHeight);
    const sm = quality === 'LOW' ? 1024 : quality === 'MEDIUM' ? 2048 : 4096;
    const oct = quality === 'LOW' ? 3 : quality === 'MEDIUM' ? 4 : 6;
    if (cloudMat.defines.OCT !== oct) { cloudMat.defines.OCT = oct; cloudMat.needsUpdate = true; }
    if (sun.shadow.mapSize.x !== sm) { sun.shadow.mapSize.set(sm, sm); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    bloom.enabled = quality === 'HIGH' || quality === 'ULTRA';
    // LOW = phone mode: no post-processing chain, no real-time shadows, no flash lights, cheaper paint
    const low = quality === 'LOW';
    G_render.direct = low;
    applyLowMaterials(scene, low);
    applyLowMaterials(vmScene, low);
    // LOW: bake sky + clouds into a cube map once instead of shading them every frame
    if (low) { scene.background = bakeSky(); sky.visible = false; clouds.visible = false; }
    else { scene.background = null; sky.visible = true; clouds.visible = true; }
    SOLDIER_DETAIL.low = low;
    sun.castShadow = !low;
    fx.setLowPower(low);
    scene.traverse((o) => {
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of mats) {
        if (!m.isMeshPhysicalMaterial) continue;
        if (m.userData.cc === undefined) m.userData.cc = m.clearcoat;
        m.clearcoat = low ? 0 : m.userData.cc;
      }
    });
    gtao.enabled = quality === 'ULTRA';
    $('btn-gfx').textContent = `GRAPHICS: ${quality}`;
    try { localStorage.setItem(isTouch ? 'lcc_gfx_touch' : 'lcc_gfx', quality); } catch (e) { /* ignore */ }
  }
  $('btn-gfx').onclick = () => { quality = QUALITY[(QUALITY.indexOf(quality) + 1) % QUALITY.length]; applyQuality(); };
  applyQuality();

  // warm up shaders
  renderer.compile(scene, camera);
  composer.render();
  await progress(100, 'Ready.');

  // ---------- game state ----------
  const G = {
    state: 'menu', score: 0, kills: 0, headshots: 0, shots: 0, hits: 0, longest: 0, streak: 0, wave: 0,
    timeScale: 1, slowT: 0, lastKeh: 0, time: 0, heartbeatT: 0, rangeT: 0, range: 0, waveTimer: null,
  };
  const raycaster = new THREE.Raycaster(); raycaster.far = 600;
  const shootTargets = [world.group, carGroup, civ.group, ...enemies.shootables()];
  let best = { score: 0, wave: 0 };
  try { best = JSON.parse(localStorage.getItem('lcc_best') || '{"score":0,"wave":0}'); } catch (e) { /* ignore */ }
  const showBest = () => { $('best-score').textContent = best.score.toLocaleString('en-GB'); $('best-wave').textContent = best.wave; };
  showBest();

  const SPOTTER = ['Target down.', 'Boss shot, la!', "He's not getting a test drive.", 'Good kill.', "That's one less on the forecourt.", 'Sound. Next.', 'Dropped him.'];
  const sayRadio = (who, text, ms) => { audio.radio(); ui.subtitle(`<b>${who}:</b> ${text}`, ms); };

  // ---------- shooting ----------
  const tmpN = new THREE.Vector3();
  const findCar = (o) => { let c = o; while (c && !c.userData.isCar) c = c.parent; return c; };
  player.onShoot = (origin, dir, muzzle, scoped, W = { power: 1, pierce: 0 }) => {
    G.shots++;
    raycaster.set(origin, dir);
    const hits = raycaster.intersectObjects(shootTargets, true);
    let end = origin.clone().addScaledVector(dir, 400);
    let throughGlass = false, pierce = W.pierce || 0, kills = 0, counted = false, stopped = false;
    const seen = new Set();
    const stopHere = (h) => { end = h.point.clone(); return pierce-- <= 0; };
    for (const h of hits) {
      const o = h.object, ud = o.userData;
      if (!o.visible || ud.broken) continue;
      const normal = h.face ? tmpN.copy(h.face.normal).transformDirection(o.matrixWorld).clone() : dir.clone().negate();
      if (ud.glassPane) {
        ud.broken = true; o.visible = false;
        fx.glass(h.point, dir, 70); audio.impact('glass', h.point);
        throughGlass = true;
        continue;
      }
      if (ud.roofSign) {
        const car = carSys.carFromSign(h.instanceId);
        if (car && car.userData.sign && !car.userData.sign.off) {
          carSys.knockSign(car, dir);
          G.score += 25; ui.points([['+25 SIGN SHOT OFF', false]]); ui.hitmarker(false);
        }
        continue;
      }
      if (ud.carPart) {
        const car = findCar(o);
        if (!car) continue;
        const res = carSys.hit(car, ud.carPart, h.point, normal, dir, W.power);
        if (ud.carPart === 'glass') { throughGlass = true; continue; }
        if (res.penetrate && !stopHere(h)) continue;
        end = h.point.clone();
        stopped = true;
        break;
      }
      if (ud.soldier) {
        const s = ud.soldier;
        if (seen.has(s)) continue; seen.add(s);
        const res = enemies.damage(s, ud.part, dir, h.point, W.power);
        if (!res.already) {
          if (!counted) { G.hits++; counted = true; }
          if (res.killed) {
            kills++;
            registerKill(s, { headshot: res.headshot, dist: origin.distanceTo(h.point), throughGlass });
          } else {
            ui.hitmarker(false); audio.hitmarker(false);
            ui.points([['+10 HIT', false]]); G.score += 10;
          }
        }
        if (stopHere(h)) break;
        continue;
      }
      if (ud.civilian) {
        const c = ud.civilian;
        if (seen.has(c)) continue; seen.add(c);
        fx.blood(h.point, dir, ud.part === 'head');
        audio.impact('flesh', h.point);
        if (c.alive) {
          const headshot = ud.part === 'head';
          c.die(dir, headshot);
          if (!counted) { G.hits++; counted = true; }
          kills++;
          civilianKilled(c, { headshot, dist: origin.distanceTo(h.point) });
        }
        if (stopHere(h)) break;
        continue;
      }
      end = h.point.clone();
      if (ud.truck) {
        const boom = enemies.hitTruck(ud.truck, ud.part, h.point, normal);
        fx.decal(h.point, normal, 1);
        if (boom) { G.hits++; ui.hitmarker(false); }
        if (W.pierceWorld) continue;
      } else {
        fx.impactDust(h.point, normal);
        fx.decal(h.point, normal, W.power >= 3 ? 2 : 1.2);
        audio.impact('dirt', h.point);
        // the railgun goes straight through walls, it only stops when it hits the ground
        if (W.pierceWorld && normal.y < 0.7) continue;
      }
      stopped = true;
      break;
    }
    if (W.explosive && (stopped || pierce < (W.pierce || 0))) explosiveRound(end, W.explosive);
    if (kills >= 2) { G.score += 100 * (kills - 1); setTimeout(() => ui.points([[`+${100 * (kills - 1)} COLLATERAL x${kills}`, true]]), 300); }
    if (W.rail) {
      const col = W.explosive ? 0xffa040 : 0x55c8ff;
      fx.tracer(muzzle, end, { trail: true, life: 1.4, width: 0.07, color: col });
      fx.tracer(muzzle, end, { trail: true, life: 0.5, width: 0.16, color: col });
      fx.flashLight(muzzle, 30, 0.15, col);
    }
    fx.tracer(muzzle, end, { trail: true, life: 0.7, width: W.power >= 3 ? 0.04 : 0.022, color: 0xdfe8ff });
    fx.tracer(muzzle, end, { color: 0xffe2a8, width: W.power >= 3 ? 0.05 : 0.03, speed: 900, len: 8 });
    fx.muzzle(muzzle, dir, true);
    fx.flashLight(muzzle, W.power >= 3 ? 35 : 20, 0.07);
  };

  function explosiveRound(pos, radius) {
    fx.grenadeBlast(pos.clone());
    audio.explosion(pos.clone(), false);
    for (const c of carSys.all) {
      const d = c.position.distanceTo(pos);
      if (d < radius + 1.5) { carSys.alarm(c, 1); carSys.damage(c, d < radius * 0.6 ? 6 : 3); }
    }
    blastAt(pos, radius, true);
  }

  const RIFLE_LINES = {
    fifty: 'had a .50 cal stashed away. It\'s yours now.',
    he: 'was sitting on a crate of explosive .50 cal rounds. Load up.',
    rail: 'had an XR-9 railgun in the back. It goes through walls.',
    gold: 'had the GOLDEN RAILGUN. Explosive rail rounds. Absolute scenes.',
  };
  const WHO = { craig: 'Craig', kev: 'Kev Jones', mech: 'the Merton Garages mechanic', val: 'the valeter' };
  function civilianKilled(c, { headshot = false, dist = 0 } = {}) {
    G.kills++;
    civ.personKilled(c);
    const pts = 500 + (headshot ? 50 : 0);
    G.score += pts;
    ui.points([[`+500 ${c.name} DOWN`, true], ...(headshot ? [['+50 HEADSHOT', false]] : [])]);
    ui.hitmarker(true); audio.hitmarker(true, headshot);
    const now = performance.now();
    if (now - G.lastKeh > 350) { audio.keh(); G.lastKeh = now; }
    ui.kehPop();
    const nice = { craig: 'Craig', kev: 'Kev Jones', mech: 'Merton Garages mechanic', val: 'Valeter' }[c.id] || c.name;
    ui.feed(`<span class="you">YOU</span> ⌖ ${nice} ${headshot ? '<span class="hs">HEADSHOT</span> ' : ''}<span class="keh">"Keh"</span>`);
    if (c.upgrades) {
      setTimeout(() => {
        const got = player.unlockNext();
        if (!got) { ui.banner('MAXED OUT', 'YOU ALREADY HAVE THE GOLDEN RAILGUN', 2500); return; }
        const W = WEAPONS[got], key = ORDER.indexOf(got) + 1;
        audio.stinger();
        ui.banner('RIFLE UPGRADE', `${W.name} · PRESS [${key}] OR [Q] TO SWAP`, 4000);
        const who = WHO[c.id];
        sayRadio('HQ', `${who[0].toUpperCase()}${who.slice(1)} ${RIFLE_LINES[got]}`, 4200);
      }, 900);
    }
  }
  civ.onKilledInBlast = (c) => civilianKilled(c);
  civ.onSay = (who, text, ms) => ui.subtitle(`<b>${who}:</b> ${text}`, ms);

  function blastAt(pos, radius, fromCar) {
    for (const s of enemies.soldiers) {
      if (s.alive && s.root.position.distanceTo(pos) < radius) enemies.kill(s, new THREE.Vector3().subVectors(s.root.position, pos).normalize().add(new THREE.Vector3(0, 0.5, 0)), false, true);
    }
    for (const c of civ.blast(pos, radius)) { c.die(new THREE.Vector3().subVectors(c.root.position, pos).normalize(), false); civilianKilled(c); }
    const d = camera.position.distanceTo(pos);
    player.shake = Math.max(player.shake, 2.5 * Math.max(0, 1 - d / 80));
    for (const p of world.glassPanes) if (!p.userData.broken && p.position.distanceTo(pos) < (fromCar ? 9 : 30) && Math.random() < 0.6) {
      p.userData.broken = true; p.visible = false; fx.glass(p.position, new THREE.Vector3(0, 0, 1), 30);
    }
  }
  carSys.onExplode = (pos, car) => {
    blastAt(pos, 5.5, true);
    if (G.state === 'playing') { G.score += 150; ui.points([['+150 VEHICLE DESTROYED', true]]); }
  };

  function registerKill(s, { headshot = false, dist = 0, throughGlass = false, explosive = false } = {}) {
    G.kills++; G.streak++;
    if (headshot) G.headshots++;
    if (dist > G.longest) G.longest = dist;
    const lines = [];
    let pts = 100; lines.push([`+100 ${s ? s.kind.toUpperCase() : 'PASSENGER'} KILLED`, true]);
    if (headshot) { pts += 50; lines.push(['+50 HEADSHOT', false]); }
    if (dist > 48) { pts += 25; lines.push([`+25 LONGSHOT ${dist.toFixed(0)}m`, false]); }
    if (throughGlass) { pts += 25; lines.push(['+25 THROUGH THE GLASS', false]); }
    if (explosive) { pts += 50; lines.push(['+50 EXPLOSIVE', false]); }
    if (G.streak % 5 === 0) { pts += 250; lines.push([`+250 ${G.streak} KILL STREAK`, false]); }
    G.score += pts;
    ui.points(lines);
    ui.hitmarker(true); audio.hitmarker(true, headshot);
    const now = performance.now();
    if (now - G.lastKeh > 350) { audio.keh(); G.lastKeh = now; }
    ui.kehPop();
    const name = s ? s.kind[0].toUpperCase() + s.kind.slice(1) : 'Passenger';
    ui.feed(`<span class="you">YOU</span> ⌖ ${name} ${headshot ? '<span class="hs">HEADSHOT</span> ' : ''}${explosive ? '<span class="hs">💥</span> ' : ''}<span class="keh">"Keh"</span>`);
    if (Math.random() < 0.28) setTimeout(() => sayRadio('Spotter', SPOTTER[Math.floor(Math.random() * SPOTTER.length)], 2200), 700);
    if (enemies.remaining === 0 && enemies.active) {
      G.slowT = 1.6;
      ui.banner('FINAL KILL', 'KEH.', 1800);
    }
  }

  enemies.onKill = (s, info) => {
    if (info.explosive) registerKill(s, { explosive: true, dist: s ? camera.position.distanceTo(s.root.position) : 0 });
  };
  enemies.onExplosion = (pos) => {
    const d = camera.position.distanceTo(pos);
    player.shake = Math.max(player.shake, 3 * Math.max(0, 1 - d / 80));
    for (const c of carSys.all) {
      const cd = c.position.distanceTo(pos);
      if (cd < 14) carSys.alarm(c, 0.9);
      if (cd < 7) carSys.damage(c, cd < 4 ? 8 : 4);
    }
    for (const c of civ.blast(pos, 8.5)) { c.die(new THREE.Vector3().subVectors(c.root.position, pos).normalize(), false); civilianKilled(c); }
    for (const p of world.glassPanes) if (!p.userData.broken && p.position.distanceTo(pos) < 30 && Math.random() < 0.5) {
      p.userData.broken = true; p.visible = false; fx.glass(p.position, new THREE.Vector3(0, 0, 1), 30);
    }
  };
  enemies.onEnemyFire = (s) => { s.lastFired = performance.now(); };
  enemies.onMessage = (m) => sayRadio('HQ', m, 3200);
  enemies.onGrenade = () => sayRadio('Spotter', 'GRENADE! Move!', 1800);
  enemies.onWaveComplete = (n) => {
    const bonus = 500 * n;
    G.score += bonus;
    audio.stinger();
    ui.banner(`WAVE ${n} SURVIVED`, `+${bonus} BONUS`, 3500);
    setTimeout(() => sayRadio('HQ', n % 2 ? 'Nice work. More hostiles regrouping on the Strand — stay sharp.' : 'Forecourt is clear. Brew up, they\'re coming back.', 3800), 1500);
    player.health = 100;
    G.waveTimer = setTimeout(() => startWave(n + 1), 7000);
  };
  player.onHurt = (amt, from) => {
    G.streak = 0;
    if (!from) return;
    const dx = from.x - player.pos.x, dz = from.z - player.pos.z;
    const right = dx * Math.cos(player.yaw) - dz * Math.sin(player.yaw);
    const fwd = -dx * Math.sin(player.yaw) - dz * Math.cos(player.yaw);
    ui.damageFrom(Math.atan2(right, fwd));
  };

  function startWave(n) {
    if (G.state !== 'playing' && G.state !== 'paused') return;
    G.wave = n;
    enemies.startWave(n);
    civ.onWaveStart(n);
    ui.banner(`WAVE ${n}`, n === 1 ? 'DEFEND THE FORECOURT' : n % 3 === 0 ? 'ENEMY SNIPERS SPOTTED' : 'HOSTILES INBOUND', 2800);
  }

  // ---------- flow ----------
  const screens = (name) => {
    for (const id of ['loading', 'menu', 'pause', 'gameover', 'record']) $(id).classList.toggle('hidden', id !== name);
    ui.show(name === 'hud' || name === 'pause');
    document.body.classList.toggle('playing', name === 'hud');
    if (touch) touch.show(isTouch && name === 'hud');
  };
  let touch = null;
  const isFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  function setFullscreen(on) {
    try {
      if (on && !isFull()) {
        const p = fsEl.requestFullscreen ? fsEl.requestFullscreen({ navigationUI: 'hide' }) : fsEl.webkitRequestFullscreen();
        if (p && p.then) p.then(() => { try { screen.orientation?.lock?.('landscape').catch(() => {}); } catch (e) { /* ignore */ } }).catch(() => {});
      } else if (!on && isFull()) {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      }
    } catch (e) { /* ignore */ }
  }
  const toggleFullscreen = () => setFullscreen(!isFull());
  const fsLabel = () => { for (const id of ['btn-fs', 'btn-fs2']) $(id).textContent = isFull() ? '⛶ EXIT FULL SCREEN' : '⛶ FULL SCREEN'; };
  document.addEventListener('fullscreenchange', fsLabel);
  document.addEventListener('webkitfullscreenchange', fsLabel);
  $('btn-fs').onclick = toggleFullscreen;
  $('btn-fs2').onclick = toggleFullscreen;
  window.addEventListener('keydown', (e) => { if (e.code === 'KeyF' && G.state !== 'menu' || e.code === 'KeyF' && document.activeElement === document.body) toggleFullscreen(); });

  function pauseGame() {
    if (G.state !== 'playing') return;
    G.state = 'paused'; screens('pause');
    if (!isTouch) document.exitPointerLock?.();
  }
  function resumeGame() {
    if (isTouch) { G.state = 'playing'; screens('hud'); }
    else lock();
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

  function lock() {
    try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ }
  }

  function deploy() {
    audio.init();
    audio.stopMusic();
    clearTimeout(G.waveTimer);
    Object.assign(G, { score: 0, kills: 0, headshots: 0, shots: 0, hits: 0, longest: 0, streak: 0, wave: 0, slowT: 0 });
    enemies.reset();
    fx.clearPersistent();
    civ.reset();
    carSys.reset();
    for (const p of world.glassPanes) { p.visible = true; p.userData.broken = false; }
    player.reset();
    player.enabled = true;
    G.state = 'playing';
    screens('hud');
    if (isTouch) {
      setFullscreen(true);
      audio.primeSpeech();
    } else lock();
    ui.setScore(0);
    ui.stamp(['OPERATION: FORECOURT', `Day 1 — ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`, 'Brewster St, Bootle, Merseyside', 'Rooftop overwatch — opposite Liverpool Car Centre']);
    setTimeout(() => sayRadio('HQ', 'Iranian troops have taken Liverpool Car Centre. You\'re our only eyes on that forecourt.', 4200), 1200);
    setTimeout(() => sayRadio('HQ', isTouch
      ? 'Hold that roof. Tap <b>SCOPE</b>, then <b>FIRE</b>. Hit <b>CROUCH</b> to get your head down.'
      : 'Hold that roof. Hold <b>RMB</b> to scope, <b>SHIFT</b> to steady, <b>C</b> to get your head down.', 4500), 5600);
    G.waveTimer = setTimeout(() => startWave(1), 7500);
  }

  function gameOver() {
    G.state = 'over';
    player.enabled = false;
    enemies.active = false;
    clearTimeout(G.waveTimer);
    document.exitPointerLock?.();
    const acc = G.shots ? Math.round((G.hits / G.shots) * 100) : 0;
    $('go-stats').innerHTML = `SCORE <b>${G.score.toLocaleString('en-GB')}</b><br/>WAVE REACHED <b>${G.wave}</b><br/>KILLS <b>${G.kills}</b> · HEADSHOTS <b>${G.headshots}</b><br/>ACCURACY <b>${acc}%</b> · LONGEST SHOT <b>${G.longest.toFixed(0)} m</b><br/>"KEH"s SAID <b>${G.kills}</b>`;
    if (G.score > best.score || G.wave > best.wave) {
      best = { score: Math.max(best.score, G.score), wave: Math.max(best.wave, G.wave) };
      try { localStorage.setItem('lcc_best', JSON.stringify(best)); } catch (e) { /* ignore */ }
      showBest();
    }
    setTimeout(() => screens('gameover'), 1600);
    ui.banner('YOU WERE KILLED', '', 1600);
  }

  function toMenu() {
    G.state = 'menu';
    player.enabled = false;
    clearTimeout(G.waveTimer);
    enemies.reset();
    screens('menu');
    audio.startMusic();
  }

  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === canvas;
    if (!locked && G.state === 'playing') { G.state = 'paused'; screens('pause'); }
    else if (locked && G.state === 'paused') { G.state = 'playing'; screens('hud'); }
  });
  canvas.addEventListener('click', () => { if (!isTouch && G.state === 'playing' && document.pointerLockElement !== canvas) lock(); });
  $('btn-deploy').onclick = deploy;
  $('btn-again').onclick = deploy;
  $('btn-menu').onclick = toMenu;
  $('btn-resume').onclick = resumeGame;
  $('btn-quit').onclick = toMenu;
  $('sens').oninput = (e) => { player.sensitivity = 0.0022 * parseFloat(e.target.value); player.sensitivityScale = parseFloat(e.target.value); };
  touch = new TouchControls({ player, onPause: pauseGame });
  $('tb-fs').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); toggleFullscreen(); });

  // ---------- keh recording ----------
  const SRC = (n) => ({ recorded: 'YOUR RECORDING ✔', file: `${n}.mp3` })[audio.clipSource(n)] || 'built-in (text-to-speech)';
  const kehStatus = () => {
    $('keh-status').textContent = `Keh: ${SRC('keh')} · Craig: ${SRC('craig')} · MOT: ${SRC('mot')}`;
    $('btn-clearkeh').classList.toggle('hidden', !['keh', 'craig', 'mot'].some((n) => audio.clipSource(n) === 'recorded'));
  };
  let recMode = 'keh';
  const REC = {
    keh: { title: 'RECORD YOUR KEH', text: 'Hit record and say <b>"Keh"</b>. It plays every time you drop someone.', secs: 1.5 },
    craig: { title: "RECORD CRAIG'S SHOUT", text: 'Hit record and do your best wee Scottish <b>"Get yourself away!"</b>. Craig shouts it from the showroom door.', secs: 2.5 },
    mot: { title: "RECORD THE MECHANIC", text: 'Hit record and shout <b>"M-O-T done!"</b>. The Merton Garages mechanic yells it while waving the paper.', secs: 2 },
  };
  const openRec = (mode) => {
    recMode = mode; audio.init();
    $('rec-title').textContent = REC[mode].title; $('rec-text').innerHTML = REC[mode].text;
    $('rec-go').textContent = `● RECORD (${REC[mode].secs}s)`;
    $('record').classList.remove('hidden'); $('rec-msg').textContent = '';
  };
  $('btn-testkeh').onclick = () => { audio.init(); setTimeout(() => { audio.keh(); kehStatus(); }, 150); ui.kehPop(); };
  $('btn-testcraig').onclick = () => { audio.init(); setTimeout(() => { audio.say('craig'); kehStatus(); }, 150); };
  $('btn-testmot').onclick = () => { audio.init(); setTimeout(() => { audio.say('mot'); kehStatus(); }, 150); };
  $('btn-record-mot').onclick = () => openRec('mot');
  $('btn-clearkeh').onclick = () => { for (const n of ['keh', 'craig', 'mot']) audio.clearRecordedClip(n); setTimeout(kehStatus, 300); };
  $('btn-record').onclick = () => openRec('keh');
  $('btn-record-craig').onclick = () => openRec('craig');
  $('rec-close').onclick = () => { $('record').classList.add('hidden'); kehStatus(); };
  $('rec-go').onclick = async () => {
    const msg = $('rec-msg');
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { msg.textContent = `Recording is not supported in this browser — drop a ${recMode}.mp3 in /public instead.`; return; }
    try {
      const mode = recMode;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      const actx = audio.ctx, an = actx.createAnalyser(); an.fftSize = 512;
      const srcNode = actx.createMediaStreamSource(stream); srcNode.connect(an);
      const data = new Uint8Array(an.fftSize);
      let live = true;
      const meter = () => { if (!live) return; an.getByteTimeDomainData(data); let m = 0; for (const v of data) m = Math.max(m, Math.abs(v - 128)); $('rec-level').style.width = `${Math.min(100, m * 1.2)}%`; requestAnimationFrame(meter); };
      meter();
      rec.onstop = async () => {
        live = false; $('rec-level').style.width = '0%';
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        try {
          await audio.setRecordedClip(mode, blob);
          msg.textContent = { keh: 'Saved! That\'s your Keh now.', craig: 'Saved! That\'s Craig now.', mot: 'Saved! That\'s the mechanic now.' }[mode];
          if (mode === 'keh') audio.keh(); else audio.say(mode);
          kehStatus();
        } catch (e) { msg.textContent = 'Could not decode the recording — try again.'; }
      };
      msg.textContent = { keh: 'Recording… say "Keh"!', craig: 'Recording… "Get yourself away!"', mot: 'Recording… "M-O-T done!"' }[mode];
      rec.start();
      setTimeout(() => rec.stop(), REC[mode].secs * 1000);
    } catch (e) { msg.textContent = 'Microphone permission denied.'; }
  };

  // ---------- resize ----------
  window.addEventListener('resize', () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h); composer.setSize(w, h); gtao.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    vmCamera.aspect = w / h; vmCamera.updateProjectionMatrix();
  });

  // ---------- loop ----------
  const clock = new THREE.Clock();
  let menuT = 0;
  const lookTarget = new THREE.Vector3();
  function frame() {
    requestAnimationFrame(frame);
    const raw = Math.min(0.05, clock.getDelta());
    if (G.slowT > 0) { G.slowT -= raw; G.timeScale = 0.22; } else G.timeScale = 1;
    const paused = G.state === 'paused';
    const dt = paused ? 0 : raw * G.timeScale;
    G.time += dt;
    world.update(dt, G.time);

    if (G.state === 'menu') {
      menuT += raw;
      const a = menuT * 0.045;
      camera.position.set(Math.sin(a) * 26, 4.5 + Math.sin(a * 0.7) * 2.5, 6 + Math.cos(a * 0.8) * 3);
      lookTarget.set(Math.sin(a + 0.4) * 8, 2, -22);
      camera.fov = 55; camera.updateProjectionMatrix();
      camera.lookAt(lookTarget);
      player.rifle.visible = false;
    } else if (G.state === 'playing' || G.state === 'over') {
      player.update(dt);
      enemies.update(dt);
      civ.update(dt, G.state === 'playing' && G.wave > 0);
      if (G.state === 'playing' && player.dead) gameOver();
      // HUD
      G.rangeT -= raw;
      if (player.ads > 0.88 && G.rangeT <= 0) {
        G.rangeT = 0.15;
        const o = new THREE.Vector3(), d = new THREE.Vector3();
        camera.getWorldPosition(o); camera.getWorldDirection(d);
        raycaster.set(o, d);
        const h = raycaster.intersectObjects(shootTargets, true).find((x) => x.object.visible && !x.object.userData.broken);
        G.range = h ? h.distance : 0;
      }
      ui.updatePlayer(player, G.range);
      ui.setScore(G.score); ui.setStreak(G.streak);
      ui.setWave(Math.max(1, G.wave), enemies.remaining);
      G_render.frame++;
      if (!isTouch || G_render.frame % 3 === 0) { ui.drawMinimap(player, enemies, cars, civ); ui.drawCompass(player.yaw); }
      if (isTouch) touch.sync();
      // grenade warning
      let gAng = null, gd = 9;
      for (const g of enemies.grenades) {
        const p = g.mesh.position;
        const d = Math.hypot(p.x - player.pos.x, p.z - player.pos.z);
        if (d < gd && p.z > LAYOUT.parapetZ - 1) {
          gd = d;
          const dx = p.x - player.pos.x, dz = p.z - player.pos.z;
          gAng = Math.atan2(dx * Math.cos(player.yaw) - dz * Math.sin(player.yaw), -dx * Math.sin(player.yaw) - dz * Math.cos(player.yaw));
        }
      }
      ui.grenadeIndicator(gAng);
      // heartbeat
      if (player.health < 35 && !player.dead) { G.heartbeatT -= raw; if (G.heartbeatT <= 0) { audio.heartbeat(); G.heartbeatT = 0.85; } }
    }

    carSys.update(dt);
    if (G.state === 'menu') civ.update(dt, true);
    fx.update(dt);
    // audio listener
    audio.listener.pos.copy(camera.position);
    audio.listener.right.set(Math.cos(camera.rotation.y), 0, -Math.sin(camera.rotation.y));

    grade.uniforms.time.value = G.time;
    cloudMat.uniforms.time.value += raw;
    grade.uniforms.slowmo.value += ((G.slowT > 0 ? 1 : 0) - grade.uniforms.slowmo.value) * Math.min(1, raw * 6);
    grade.uniforms.desat.value = grade.uniforms.slowmo.value * 0.45 + (G.state === 'playing' ? Math.max(0, (40 - player.health) / 60) : 0) + (paused ? 0.6 : 0);
    grade.uniforms.hurt.value = G.state === 'playing' ? Math.max(0, 1 - player.sinceHurt * 2) * 0.6 : 0;
    if (G_render.direct) {
      // new soldiers / cars / swapped materials pick up the cheap materials too
      G_render.matT -= raw;
      if (G_render.matT <= 0) { G_render.matT = 1; applyLowMaterials(scene, true); }
      renderer.setRenderTarget(null);
      renderer.autoClear = true;
      renderer.render(scene, camera);
      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.render(vmScene, vmCamera);
      renderer.autoClear = true;
    } else composer.render();
  }

  screens('menu');
  frame();
  // music needs a gesture
  const startMusicOnce = () => { audio.init(); if (G.state === 'menu') audio.startMusic(); kehStatus(); window.removeEventListener('pointerdown', startMusicOnce); };
  window.addEventListener('pointerdown', startMusicOnce);
  kehStatus();
  window.__lcc = { G, player, enemies, camera, scene, deploy, startWave, fx, renderer, carSys, civ, touch, isTouch };
}

boot().catch((e) => {
  console.error(e);
  $('load-text').textContent = 'Failed to start: ' + e.message + ' (WebGL2 required)';
});
