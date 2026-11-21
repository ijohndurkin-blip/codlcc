import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rand, signTexture, poleSignTexture, flagTexture } from './textures.js';
import { mergeStatic } from './merge.js';

// Layout (metres). +x = right as seen from the sniper, -z = towards the showroom.
// Road (A5038 / Brewster St) z -5..5, forecourt z -9..-29, showroom front z = -29.
// Sniper rooftop across the road at y = 7.5, parapet at z = 9.
export const LAYOUT = {
  roadZ: [-5, 5],
  forecourt: { x0: -30, x1: 30, z0: -29, z1: -9 },
  roofY: 7.5,
  parapetZ: 9.0,
  lanes: { road: -2.0, nearRoad: 0.9, pave: -7.4, a1: -15.3, a2: -21.3, a3: -27.8 },
  columns: [-29.2, -21.5, -1, 17, 28.4],
  rows: [-12.4, -18.3, -24.4],
};

export function groundHeight(x, z) {
  if (z > -5.05 && z < 5.05) return 0;
  return 0.13;
}

export function boxGeo(w, h, d, tile = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (tile) {
    const uv = g.attributes.uv;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * dims[f][0] / tile, uv.getY(k) * dims[f][1] / tile);
    }
  }
  return g;
}

function planeGeo(w, h, tile = 0) {
  const g = new THREE.PlaneGeometry(w, h);
  if (tile) {
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * h / tile);
  }
  return g;
}

export function buildWorld(scene, T, renderer) {
  const world = {
    group: new THREE.Group(),   // shootable static geometry
    decor: new THREE.Group(),   // non-shootable decor
    flags: [],
    glassPanes: [],
    update: null,
  };
  scene.add(world.group, world.decor);
  const G = world.group;

  const std = (o) => new THREE.MeshStandardMaterial(o);
  const M = {
    asphalt: std({ map: T.asphalt, normalMap: T.asphaltN, roughnessMap: T.asphalt, roughness: 2.3, color: 0xffffff }),
    redTarmac: std({ map: T.asphalt, normalMap: T.asphaltN, roughness: 0.9, color: 0xc0675a }),
    tarmac: std({ map: T.tarmac, normalMap: T.tarmacN, roughnessMap: T.tarmac, roughness: 2.0 }),
    paving: std({ map: T.paving, normalMap: T.pavingN, roughness: 0.9 }),
    kerb: std({ map: T.concrete, normalMap: T.concreteN, roughness: 0.85, color: 0xd8d4cc }),
    brick: std({ map: T.brick, normalMap: T.brickN, roughness: 0.9 }),
    darkBrick: std({ map: T.brick, normalMap: T.brickN, roughness: 0.9, color: 0x9a8070 }),
    cladBlue: std({ map: T.corr, normalMap: T.corrN, roughness: 0.55, metalness: 0.35, color: 0x7b90ab }),
    cladGrey: std({ map: T.corr, normalMap: T.corrN, roughness: 0.5, metalness: 0.35, color: 0xa3adb8 }),
    cladDark: std({ map: T.corr, normalMap: T.corrN, roughness: 0.6, metalness: 0.3, color: 0x58708f }),
    roof: std({ map: T.roof, normalMap: T.roofN, roughness: 0.7, metalness: 0.2, color: 0xe2e2de }),
    grass: std({ map: T.grass, normalMap: T.grassN, roughness: 1 }),
    ballast: std({ map: T.ballast, normalMap: T.ballastN, roughness: 1 }),
    concrete: std({ map: T.concrete, normalMap: T.concreteN, roughness: 0.9 }),
    cream: std({ map: T.concrete, normalMap: T.concreteN, roughness: 0.8, color: 0xf0e6cc }),
    felt: std({ map: T.felt, normalMap: T.feltN, roughness: 1 }),
    white: std({ color: 0xf2f2f0, roughness: 0.4, metalness: 0.1 }),
    frame: std({ color: 0xe8e8e8, roughness: 0.35, metalness: 0.3 }),
    darkMetal: std({ color: 0x2b2e33, roughness: 0.45, metalness: 0.8 }),
    steel: std({ color: 0x8c9196, roughness: 0.35, metalness: 0.9 }),
    blueBar: std({ color: 0x1f4fd0, roughness: 0.35, metalness: 0.4 }),
    poleBlue: std({ color: 0x2846a8, roughness: 0.4, metalness: 0.5 }),
    rail: std({ color: 0x6c6560, roughness: 0.35, metalness: 0.9 }),
    sleeper: std({ map: T.concrete, roughness: 0.9, color: 0x8a8580 }),
    window: new THREE.MeshPhysicalMaterial({ color: 0x1a232c, roughness: 0.05, metalness: 0.1, clearcoat: 1, envMapIntensity: 1.6 }),
    distant: std({ map: T.windows, roughness: 0.8 }),
    slate: std({ color: 0x3b3f46, roughness: 0.7, metalness: 0.1 }),
    marking: std({ color: 0xf4f4ee, roughness: 0.6 }),
    yellow: std({ color: 0xe8c020, roughness: 0.6 }),
    shutter: std({ map: T.corr, normalMap: T.corrN, roughness: 0.6, metalness: 0.5, color: 0x9a9ea4 }),
    interiorFloor: std({ color: 0xd9dcdf, roughness: 0.15, metalness: 0.05 }),
    interiorWall: std({ color: 0xeeeeea, roughness: 0.8, emissive: 0x2a2a28 }),
    ceilingLight: std({ color: 0xffffff, emissive: 0xfff4e0, emissiveIntensity: 2.2 }),
    sandbag: std({ map: T.camo, roughness: 1, color: 0xb0a080 }),
    crate: std({ color: 0x4d5a36, roughness: 0.8 }),
  };
  M.glass = new THREE.MeshPhysicalMaterial({
    color: 0xa8c4d8, roughness: 0.03, metalness: 0.0, transparent: true, opacity: 0.32,
    envMapIntensity: 1.8, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide,
  });
  // horizontal-ribbed cladding for fascias
  const corrH = T.corr.clone(); corrH.center.set(0.5, 0.5); corrH.rotation = Math.PI / 2; corrH.needsUpdate = true;
  const corrHN = T.corrN.clone(); corrHN.center.set(0.5, 0.5); corrHN.rotation = Math.PI / 2; corrHN.needsUpdate = true;
  M.fascia = std({ map: corrH, normalMap: corrHN, roughness: 0.5, metalness: 0.4, color: 0x8193ad });
  world.materials = M;

  function add(geo, mat, x, y, z, parent = G, opts = {}) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = opts.cast !== false;
    m.receiveShadow = true;
    if (opts.ry) m.rotation.y = opts.ry;
    if (opts.rx) m.rotation.x = opts.rx;
    if (opts.rz) m.rotation.z = opts.rz;
    parent.add(m);
    return m;
  }
  const box = (w, h, d, mat, x, y, z, tile = 2, parent, opts) => add(boxGeo(w, h, d, tile), mat, x, y, z, parent, opts);

  // ================= GROUND & ROAD =================
  const ground = add(planeGeo(900, 900, 6), M.grass, 0, -0.05, -200, G, { cast: false, rx: -Math.PI / 2 });
  // road
  add(planeGeo(500, 10, 5), M.asphalt, 0, 0, 0, G, { cast: false, rx: -Math.PI / 2 });
  // red tarmac patches (bus lane / junction areas like the street view)
  add(planeGeo(16, 10, 5), M.redTarmac, -36, 0.004, 0, G, { cast: false, rx: -Math.PI / 2 });
  add(planeGeo(22, 4.6, 5), M.redTarmac, 42, 0.004, -2.6, G, { cast: false, rx: -Math.PI / 2 });
  // markings
  const dash = new THREE.PlaneGeometry(3, 0.12);
  for (let x = -240; x < 240; x += 7.5) add(dash, M.marking, x, 0.008, 0, world.decor, { cast: false, rx: -Math.PI / 2 });
  add(new THREE.PlaneGeometry(500, 0.1), M.marking, 0, 0.008, -4.6, world.decor, { cast: false, rx: -Math.PI / 2 });
  add(new THREE.PlaneGeometry(500, 0.1), M.marking, 0, 0.008, 4.6, world.decor, { cast: false, rx: -Math.PI / 2 });
  // double yellow lines on the near side
  add(new THREE.PlaneGeometry(500, 0.08), M.yellow, 0, 0.009, 4.38, world.decor, { cast: false, rx: -Math.PI / 2 });
  add(new THREE.PlaneGeometry(500, 0.08), M.yellow, 0, 0.009, 4.22, world.decor, { cast: false, rx: -Math.PI / 2 });
  // "A5038" painted text
  {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const ctx = c.getContext('2d'); ctx.fillStyle = 'rgba(0,0,0,0)'; ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = '#f0f0ea'; ctx.font = '700 110px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('A5038', 256, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.6, depthWrite: false });
    add(new THREE.PlaneGeometry(4, 1.6), mat, -14, 0.01, 2.4, world.decor, { cast: false, rx: -Math.PI / 2 });
    add(new THREE.PlaneGeometry(4, 1.6), mat, 30, 0.01, -2.4, world.decor, { cast: false, rx: -Math.PI / 2, rz: Math.PI });
  }

  // kerbs + pavements
  box(500, 0.13, 0.3, M.kerb, 0, 0.065, -5.15, 1, G, { cast: false });
  box(500, 0.13, 0.3, M.kerb, 0, 0.065, 5.15, 1, G, { cast: false });
  box(500, 0.12, 3.7, M.paving, 0, 0.06, -7.15, 2.4, G, { cast: false });
  box(500, 0.12, 3.7, M.paving, 0, 0.06, 7.15, 2.4, G, { cast: false });

  // ================= FORECOURT =================
  const F = LAYOUT.forecourt;
  box(F.x1 - F.x0, 0.14, F.z1 - F.z0, M.tarmac, 0, 0.07, (F.z0 + F.z1) / 2, 7, G, { cast: false });
  // painted bay lines (faded)
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d0, roughness: 0.8, transparent: true, opacity: 0.55 });
  for (let x = -28; x <= 28; x += 3) {
    add(new THREE.PlaneGeometry(0.08, 4.4), lineMat, x + 1.5, 0.145, -18.3, world.decor, { cast: false, rx: -Math.PI / 2, rz: 0.35 });
  }
  // blue hoop barriers along the pavement edge
  {
    const hoop = new THREE.TorusGeometry(0.42, 0.03, 8, 20, Math.PI);
    const leg = new THREE.CylinderGeometry(0.03, 0.03, 0.55, 8);
    const gaps = LAYOUT.columns;
    for (let x = -28.6; x <= 28.6; x += 2.2) {
      if (gaps.some((g) => Math.abs(g - x) < 1.7)) continue;
      const g = new THREE.Group(); g.position.set(x, 0.12, -9.25);
      const h = new THREE.Mesh(hoop, M.blueBar); h.position.y = 0.55; h.castShadow = true; g.add(h);
      const l1 = new THREE.Mesh(leg, M.blueBar); l1.position.set(-0.42, 0.27, 0); g.add(l1);
      const l2 = l1.clone(); l2.position.x = 0.42; g.add(l2);
      G.add(g);
    }
  }

  // ================= SHOWROOM =================
  const SX0 = -24, SX1 = 22, SZF = -29, SZB = -41;
  const SW = SX1 - SX0, SCX = (SX0 + SX1) / 2;
  box(SW, 0.2, 12, M.interiorFloor, SCX, 0.1, -35, 4, G, { cast: false });
  box(SW, 0.35, 0.3, M.cladDark, SCX, 0.18, SZF - 0.15, 1.5);
  // interior
  box(SW, 3.0, 0.2, M.interiorWall, SCX, 1.5, SZB + 0.3, 3);
  box(SW, 0.1, 12, M.interiorWall, SCX, 3.05, -35, 3, G, { cast: false });
  for (let x = SX0 + 3; x < SX1 - 1; x += 4) for (let z = -31.5; z > -40; z -= 3.5) {
    add(new THREE.PlaneGeometry(1.6, 0.5), M.ceilingLight, x, 2.99, z, world.decor, { cast: false, rx: Math.PI / 2 });
  }
  // office partitions inside
  box(6, 2.8, 0.12, M.interiorWall, -16, 1.4, -37, 3);
  box(0.12, 2.8, 4, M.interiorWall, -13, 1.4, -39, 3);
  // glazing: panes between mullions
  const paneW = 1.6, glassH = 2.25, glassY0 = 0.35;
  for (let x = SX0; x < SX1 - 0.01; x += paneW) {
    const cx = x + paneW / 2;
    // door opening
    const isDoor = cx > -7.2 && cx < -4.4;
    if (!isDoor) {
      const pane = add(new THREE.PlaneGeometry(paneW - 0.08, glassH), M.glass, cx, glassY0 + glassH / 2, SZF - 0.05, G, { cast: false });
      pane.userData.penetrable = true; pane.userData.glassPane = true; pane.renderOrder = 2;
      world.glassPanes.push(pane);
    }
    box(0.08, 2.65, 0.12, M.frame, x, 1.67, SZF - 0.04, 1);
  }
  box(SW, 0.08, 0.14, M.frame, SCX, glassY0 + glassH + 0.04, SZF - 0.04, 1);
  // upper clerestory band
  for (let x = SX0; x < SX1 - 0.01; x += paneW) {
    const p = add(new THREE.PlaneGeometry(paneW - 0.08, 0.36), M.window, x + paneW / 2, 2.83, SZF - 0.05, G, { cast: false });
    p.userData.penetrable = false;
  }
  // fascia + sign
  box(SW + 0.6, 1.2, 0.4, M.fascia, SCX, 3.6, SZF - 0.1, 3);
  const sign = add(new THREE.PlaneGeometry(17, 1.06), new THREE.MeshStandardMaterial({ map: signTexture(), roughness: 0.35, emissive: 0x222222, emissiveMap: null }), -2.5, 3.6, SZF + 0.11, G, { cast: false });
  sign.userData.isSign = true;
  // side + back walls
  box(0.3, 4.2, 12, M.cladDark, SX0, 2.1, -35, 3);
  box(SW, 4.2, 0.3, M.cladGrey, SCX, 2.1, SZB, 3);
  // pitched roof
  const slopeLen = Math.hypot(6.3, 1.1), slopeA = Math.atan2(1.1, 6.3);
  box(SW + 0.8, 0.08, slopeLen, M.roof, SCX, 4.75, -31.85, 1.6, G, { rx: slopeA });
  box(SW + 0.8, 0.08, slopeLen, M.roof, SCX, 4.75, -38.15, 1.6, G, { rx: -slopeA });
  box(SW + 0.8, 0.14, 0.4, M.frame, SCX, 5.32, -35, 1);
  // gable ends
  {
    const shape = new THREE.Shape([new THREE.Vector2(-6, 0), new THREE.Vector2(6, 0), new THREE.Vector2(0, 1.1)]);
    const gg = new THREE.ShapeGeometry(shape);
    const gm = add(gg, M.cladDark, SX0 - 0.15, 4.2, -35, G, { ry: -Math.PI / 2 });
    gm.material = M.cladDark.clone(); gm.material.side = THREE.DoubleSide;
  }

  // TALL BLOCK at the right end (two storey, grey cladding)
  box(8.2, 7.4, 12.6, M.cladGrey, 26, 3.7, -34.7, 3);
  box(8.4, 0.25, 12.8, M.frame, 26, 7.45, -34.7, 1);
  for (let i = 0; i < 3; i++) {
    box(1.2, 0.9, 0.1, M.window, 23.2 + i * 2.6, 5.6, -28.36, 1, G, { cast: false });
    box(1.35, 1.05, 0.06, M.frame, 23.2 + i * 2.6, 5.6, -28.4, 1, G, { cast: false });
  }
  // lower glazing on tall block
  for (let x = 22.1; x < 29.8; x += paneW) {
    const p = add(new THREE.PlaneGeometry(paneW - 0.08, 2.4), M.window, x + paneW / 2, 1.6, -28.38, G, { cast: false });
    box(0.08, 2.6, 0.1, M.frame, x, 1.6, -28.36, 1);
  }
  box(8.2, 0.9, 0.3, M.fascia, 26, 3.4, -28.3, 3);

  // LEFT LOW UNIT
  box(6.5, 3.3, 14, M.cladBlue, -27.3, 1.65, -36, 3);
  box(6.8, 0.2, 14.3, M.frame, -27.3, 3.38, -36, 1);
  // shutter rolled up: open valeting bay
  box(4.2, 2.7, 0.08, new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.9 }), -27.3, 1.45, -28.94, 1.5, G, { cast: false });
  add(new THREE.CylinderGeometry(0.28, 0.28, 4.5, 14), M.shutter, -27.3, 2.95, -28.85, G, { rz: Math.PI / 2 });
  box(0.12, 2.8, 0.14, M.frame, -29.45, 1.4, -28.95, 1); box(0.12, 2.8, 0.14, M.frame, -25.15, 1.4, -28.95, 1);
  box(0.9, 0.5, 0.5, new THREE.MeshStandardMaterial({ color: 0xe8c020, roughness: 0.5 }), -29.85, 0.4, -28.45, 1); // pressure washer unit

  // ================= RED BRICK BUILDING =================
  const BX0 = 30, BX1 = 48, BZ0 = -44, BZ1 = -12, BH = 8.6;
  box(BX1 - BX0, BH, BZ1 - BZ0, M.brick, (BX0 + BX1) / 2, BH / 2, (BZ0 + BZ1) / 2, 1.8);
  // cream bands
  box(BX1 - BX0 + 0.12, 0.45, BZ1 - BZ0 + 0.12, M.cream, (BX0 + BX1) / 2, 5.55, (BZ0 + BZ1) / 2, 2);
  box(BX1 - BX0 + 0.16, 0.25, BZ1 - BZ0 + 0.16, M.cream, (BX0 + BX1) / 2, BH + 0.05, (BZ0 + BZ1) / 2, 2);
  // roof parapet (sniper perch)
  box(0.35, 1.0, BZ1 - BZ0, M.brick, BX0 + 0.18, BH + 0.5, (BZ0 + BZ1) / 2, 1.8);
  box(BX1 - BX0, 1.0, 0.35, M.brick, (BX0 + BX1) / 2, BH + 0.5, BZ1 - 0.18, 1.8);
  box(0.5, 0.08, BZ1 - BZ0 + 0.2, M.cream, BX0 + 0.18, BH + 1.04, (BZ0 + BZ1) / 2, 2);
  box(BX1 - BX0 - 0.4, 0.05, BZ1 - BZ0 - 0.4, M.felt, (BX0 + BX1) / 2, BH + 0.03, (BZ0 + BZ1) / 2, 3, G, { cast: false });
  // upper hipped roof block
  box(8, 2.6, 9, M.brick, 38, BH + 1.3, -34, 1.8);
  {
    const cone = new THREE.ConeGeometry(6.4, 2.4, 4, 1);
    const r = add(cone, M.slate, 38, BH + 2.6 + 1.2, -34, G, { ry: Math.PI / 4 });
    r.scale.set(1, 1, 1.12);
  }
  // windows on the side facing the forecourt (x = 30) and the road (z = -12)
  const win = (x, y, z, ry) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry;
    const f = new THREE.Mesh(boxGeo(1.5, 1.5, 0.08), M.frame); f.receiveShadow = true; g.add(f);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(1.32, 1.32), M.window); gl.position.z = 0.05; g.add(gl);
    const bar = new THREE.Mesh(boxGeo(0.06, 1.32, 0.04), M.frame); bar.position.z = 0.07; g.add(bar);
    const sill = new THREE.Mesh(boxGeo(1.7, 0.1, 0.25), M.cream); sill.position.set(0, -0.8, 0.1); g.add(sill);
    G.add(g);
  };
  for (let z = -15; z > -42; z -= 3.4) { win(BX0 - 0.03, 2.2, z, -Math.PI / 2); win(BX0 - 0.03, 7.0, z, -Math.PI / 2); }
  for (let x = 33; x < 47; x += 3.4) { win(x, 2.2, BZ1 + 0.03, 0); win(x, 7.0, BZ1 + 0.03, 0); }

  // ================= NEIGHBOURING BUILDINGS (far side) =================
  box(34, 6.5, 22, M.cladGrey, -48, 3.25, -24, 3);   // warehouse left
  box(34.4, 0.3, 22.4, M.frame, -48, 6.6, -24, 1);
  for (let i = 0; i < 3; i++) box(4.5, 4.2, 0.1, M.shutter, -58 + i * 8, 2.1, -12.97, 1.5, G, { cast: false });
  box(34, 1, 0.3, M.fascia, -48, 5.4, -12.9, 3);
  box(40, 10.5, 30, M.darkBrick, 70, 5.25, -28, 1.8);   // terrace right
  for (let x = 54; x < 88; x += 3.4) { win(x, 2.4, -12.97, 0); win(x, 6.2, -12.97, 0); }

  // ================= RAILWAY CUTTING & EMBANKMENT =================
  box(150, 3.2, 0.6, M.concrete, 0, 1.0, -42.6, 3);                      // retaining wall
  box(150, 0.4, 7, M.ballast, 0, 0.0, -47, 2, G, { cast: false });         // ballast bed
  {
    const sleeperGeo = boxGeo(2.6, 0.12, 0.25, 1);
    const sl = new THREE.InstancedMesh(sleeperGeo, M.sleeper, 2 * 230);
    const m4 = new THREE.Matrix4(); let k = 0;
    for (const tz of [-45.2, -48.6]) for (let x = -74; x < 74; x += 0.65) { m4.makeTranslation(x, 0.25, tz); sl.setMatrixAt(k++, m4); }
    sl.count = k; sl.receiveShadow = true; G.add(sl);
    for (const tz of [-45.2, -48.6]) for (const off of [-0.72, 0.72]) box(148, 0.14, 0.08, M.rail, 0, 0.36, tz + off, 1, G, { cast: false });
  }
  // embankment slope
  {
    const len = Math.hypot(12, 7.5), a = Math.atan2(7.5, 12);
    const e = add(planeGeo(200, len, 6), M.grass, 0, 3.75, -57.5, G, { cast: false, rx: -Math.PI / 2 + a });
  }
  box(200, 0.5, 200, M.grass, 0, 7.3, -163.5, 6, G, { cast: false });

  // ================= SNIPER'S BUILDING (across the road) =================
  const RY = LAYOUT.roofY, PZ = LAYOUT.parapetZ;
  box(130, RY, 16, M.brick, 0, RY / 2, PZ + 8, 1.8);
  box(130, 0.06, 15.4, M.felt, 0, RY + 0.03, PZ + 8.2, 3, G, { cast: false });
  box(130, 0.85, 0.32, M.brick, 0, RY + 0.425, PZ + 0.16, 1.8);                // parapet
  box(130, 0.1, 0.46, M.kerb, 0, RY + 0.9, PZ + 0.16, 1);                       // coping
  box(130, 1.05, 0.32, M.brick, 0, RY + 0.525, PZ + 16, 1.8);
  // shopfronts (ground floor facing road)
  const shops = ['BREWSTER NEWS', 'CHIPPY', 'BARBERS', 'OFF LICENCE', 'TAXIS', 'LAUNDERETTE', 'BOOKIES', 'CAFE'];
  for (let i = 0; i < 16; i++) {
    const x = -60 + i * 8 + 4;
    const sc = document.createElement('canvas'); sc.width = 512; sc.height = 96;
    const ctx = sc.getContext('2d');
    const hue = [210, 0, 120, 30, 280, 50][i % 6];
    ctx.fillStyle = `hsl(${hue},45%,28%)`; ctx.fillRect(0, 0, 512, 96);
    ctx.fillStyle = '#fff'; ctx.font = '700 52px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(shops[i % shops.length], 256, 50);
    const st = new THREE.CanvasTexture(sc); st.colorSpace = THREE.SRGBColorSpace;
    add(new THREE.PlaneGeometry(7.4, 0.9), new THREE.MeshStandardMaterial({ map: st, roughness: 0.5 }), x, 3.4, PZ - 0.02, G, { cast: false, ry: Math.PI });
    const shut = i % 3 === 1;
    add(new THREE.PlaneGeometry(6.6, 2.6), shut ? M.shutter : M.window, x, 1.5, PZ - 0.02, G, { cast: false, ry: Math.PI });
    win(x - 2, 5.3, PZ - 0.04, Math.PI); win(x + 2, 5.3, PZ - 0.04, Math.PI);
  }
  // rooftop clutter
  box(1.6, 1.0, 1.0, M.steel, -10, RY + 0.5, 14.5, 1);
  box(1.6, 1.0, 1.0, M.steel, 11, RY + 0.5, 15.5, 1);
  box(2.5, 2.4, 2.5, M.brick, -16, RY + 1.2, 18, 1.8);         // stair housing
  box(0.9, 2, 0.06, M.darkMetal, -16, RY + 1.0, 16.74, 1);
  {
    // sandbags on the parapet
    const bagGeo = new THREE.SphereGeometry(0.5, 12, 8); bagGeo.scale(1, 0.32, 0.55);
    for (const sx of [-7, -4.8, 4.8, 7]) for (let l = 0; l < 2; l++) for (let j = 0; j < 2; j++) {
      const b = add(bagGeo, M.sandbag, sx + j * 0.95 + l * 0.45 - 0.5, RY + 1.07 + l * 0.27, PZ + 0.18, G, { ry: (rand() - 0.5) * 0.3 });
    }
    // ammo crate + a brew
    box(1.0, 0.45, 0.5, M.crate, 1.8, RY + 0.23, PZ + 1.4, 1);
    const mug = add(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 14), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }), -1.6, RY + 1.0, PZ + 0.1, world.decor);
    const tea = add(new THREE.CircleGeometry(0.04, 14), new THREE.MeshStandardMaterial({ color: 0x8a5a32, roughness: 0.1 }), -1.6, RY + 1.051, PZ + 0.1, world.decor, { rx: -Math.PI / 2 });
  }

  // ================= STREET FURNITURE =================
  const lampPole = new THREE.CylinderGeometry(0.07, 0.1, 8, 10);
  const lampArm = boxGeo(1.6, 0.08, 0.12);
  const lampHead = boxGeo(0.7, 0.12, 0.3);
  const lampGlow = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe6b0, emissiveIntensity: 0.6 });
  for (let x = -120; x <= 120; x += 26) {
    for (const side of [-1, 1]) {
      const z = side * 5.6, xx = x + (side > 0 ? 13 : 0);
      if (side > 0 && Math.abs(xx) < 10) continue; // keep sniper sightline clear
      add(lampPole, M.darkMetal, xx, 4, z);
      add(lampArm, M.darkMetal, xx, 7.9, z - side * 0.7, G, { ry: Math.PI / 2 });
      add(lampHead, lampGlow, xx, 7.82, z - side * 1.4, G, { ry: Math.PI / 2 });
    }
  }
  // floodlight on the forecourt
  add(new THREE.CylinderGeometry(0.1, 0.16, 9, 10), M.poleBlue, -4.5, 4.5, -9.8);
  box(1.6, 0.12, 0.12, M.darkMetal, -4.5, 9, -9.8, 1);
  for (const dx of [-0.6, 0.6]) add(boxGeo(0.5, 0.35, 0.3), M.darkMetal, -4.5 + dx, 9.15, -9.75, G, { rx: -0.5 });
  // pole sign
  add(new THREE.CylinderGeometry(0.12, 0.14, 8, 10), M.poleBlue, 29, 4, -9.9);
  {
    const s = add(boxGeo(0.9, 3.4, 0.2), new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.4 }), 29.55, 6.0, -9.9);
    const face = new THREE.MeshStandardMaterial({ map: poleSignTexture(), roughness: 0.4, emissive: 0x181818 });
    add(new THREE.PlaneGeometry(0.86, 3.36), face, 29.55, 6.0, -9.79, G, { cast: false });
  }
  // bins & bollards
  for (const [x, z] of [[-12, 6.0], [16, 6.2], [-33, -6.2]]) add(new THREE.CylinderGeometry(0.3, 0.26, 0.95, 14), new THREE.MeshStandardMaterial({ color: 0x1c3a26, roughness: 0.6 }), x, 0.6, z);

  // ================= FEATHER FLAGS =================
  {
    const texts = ['FINANCE', 'QUALITY CARS', 'PART EX', 'FINANCE', 'SALE', 'QUALITY CARS', 'PART EX', 'SALE', 'FINANCE'];
    const xs = [-26.5, -19.5, -13, -7.5, 1.5, 7.5, 13.5, 20, 25.5];
    xs.forEach((x, i) => {
      const pole = add(new THREE.CylinderGeometry(0.025, 0.035, 4.6, 6), M.steel, x, 2.4, -9.65, world.decor);
      const geo = new THREE.PlaneGeometry(0.75, 3.2, 6, 18);
      geo.translate(0.375, 0, 0);
      const mat = new THREE.MeshStandardMaterial({ map: flagTexture(texts[i]), side: THREE.DoubleSide, roughness: 0.8 });
      const flag = new THREE.Mesh(geo, mat);
      flag.position.set(x + 0.03, 2.9, -9.65);
      flag.rotation.y = -0.6 + (rand() - 0.5) * 0.4;
      flag.castShadow = true;
      world.decor.add(flag);
      world.flags.push({ mesh: flag, base: geo.attributes.position.array.slice(), phase: rand() * 10 });
    });
  }

  // ================= TREES =================
  {
    const leafGeos = [], trunkGeos = [];
    const tmpCol = new THREE.Color();
    const tree = (x, y, z, s) => {
      const tg = new THREE.CylinderGeometry(0.18 * s, 0.3 * s, 4 * s, 7);
      tg.translate(x, y + 2 * s, z); trunkGeos.push(tg);
      const blobs = 5 + Math.floor(rand() * 4);
      for (let i = 0; i < blobs; i++) {
        const r = (1.6 + rand() * 1.4) * s;
        let g = new THREE.IcosahedronGeometry(r, 3);
        g.deleteAttribute('normal'); g.deleteAttribute('uv');
        g = mergeVertices(g);
        const p = g.attributes.position;
        const cols = new Float32Array(p.count * 3);
        const hue = 0.2 + rand() * 0.08, base = 0.18 + rand() * 0.08;
        for (let v = 0; v < p.count; v++) {
          const px = p.getX(v), py = p.getY(v), pz = p.getZ(v);
          const nn = Math.sin(px * 3.1 + pz * 2.3) * Math.cos(py * 2.7 + px) * 0.18 + Math.sin(pz * 7 + py * 5) * 0.06;
          p.setXYZ(v, px * (1 + nn), py * (1 + nn) * 0.85, pz * (1 + nn));
          const shade = THREE.MathUtils.clamp(0.55 + (py / r) * 0.35 + nn, 0.25, 1.1);
          tmpCol.setHSL(hue + nn * 0.05, 0.45, base * shade * 1.6);
          cols[v * 3] = tmpCol.r; cols[v * 3 + 1] = tmpCol.g; cols[v * 3 + 2] = tmpCol.b;
        }
        g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
        const a = rand() * Math.PI * 2, d = rand() * 1.8 * s;
        g.translate(x + Math.cos(a) * d, y + (3.6 + rand() * 2.6) * s, z + Math.sin(a) * d);
        g.computeVertexNormals();
        leafGeos.push(g);
      }
    };
    tree(-24, 0, -45.5, 1.25);   // the big bushy one behind the showroom
    tree(-31, 0, -44, 0.9);
    for (let x = -90; x < 90; x += 7 + rand() * 6) tree(x, 7.4, -62 - rand() * 8, 0.9 + rand() * 0.6);
    for (let x = -100; x < 100; x += 10 + rand() * 8) tree(x, 7.4, -80 - rand() * 20, 1 + rand() * 0.6);
    tree(52, 0, -10, 0.8);
    tree(-70, 0, 26, 1.1); tree(-40, 0, 28, 1); tree(45, 0, 30, 1.2);
    const leaves = new THREE.Mesh(mergeGeometries(leafGeos), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    leaves.castShadow = true; leaves.receiveShadow = true;
    const trunks = new THREE.Mesh(mergeGeometries(trunkGeos), new THREE.MeshStandardMaterial({ color: 0x4a3c30, roughness: 1 }));
    trunks.castShadow = true;
    world.decor.add(leaves, trunks);
  }

  // ================= DISTANT CITY =================
  {
    const blocks = [];
    for (let i = 0; i < 40; i++) {
      const x = -260 + rand() * 520, z = -120 - rand() * 220;
      const w = 12 + rand() * 25, d = 12 + rand() * 20, h = 10 + rand() * (rand() > 0.85 ? 55 : 20);
      const m = add(boxGeo(w, h, d, 8), M.distant, x, 7 + h / 2, z, world.decor, { cast: false });
    }
    for (let i = 0; i < 24; i++) {
      const x = -250 + rand() * 500, z = 40 + rand() * 120;
      const h = 8 + rand() * 18;
      add(boxGeo(14 + rand() * 20, h, 12 + rand() * 12, 8), M.distant, x, h / 2, z, world.decor, { cast: false });
    }
  }

  // ================= update (flags) =================
  world.update = (dt, t) => {
    for (const f of world.flags) {
      const pos = f.mesh.geometry.attributes.position;
      const b = f.base;
      for (let i = 0; i < pos.count; i++) {
        const x = b[i * 3], y = b[i * 3 + 1];
        const k = x / 0.75;
        pos.setZ(i, Math.sin(t * 4.5 + f.phase + x * 4 + y * 0.9) * 0.14 * k + Math.sin(t * 2.1 + y) * 0.05 * k);
      }
      pos.needsUpdate = true;
      f.mesh.geometry.computeVertexNormals();
    }
  };

  // collapse static geometry into a handful of draw calls
  const flagMeshes = new Set(world.flags.map((f) => f.mesh));
  mergeStatic(G, (o) => o.userData.glassPane || o === ground);
  mergeStatic(world.decor, (o) => flagMeshes.has(o) || o.geometry.attributes.color);
  return world;
}
