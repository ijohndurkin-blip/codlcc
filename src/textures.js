import * as THREE from 'three';

// ---------- helpers ----------
let seed = 1337;
export function rand() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}
export function setSeed(s) { seed = s; }

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

let maxAniso = 8;
export function setAnisotropy(a) { maxAniso = a; }

function toTex(c, repeat = [1, 1], srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  t.needsUpdate = true;
  return t;
}

// tileable fbm value noise -> Float32Array [0..1]
export function noise(w, h, cells = 8, octaves = 5, persistence = 0.5) {
  const out = new Float32Array(w * h);
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const cx = cells * (1 << o), cy = Math.max(1, Math.round(cells * (h / w)) * (1 << o));
    const grid = new Float32Array(cx * cy);
    for (let i = 0; i < grid.length; i++) grid[i] = rand();
    for (let y = 0; y < h; y++) {
      const gy = (y / h) * cy, y0 = Math.floor(gy), fy = gy - y0;
      const sy = fy * fy * (3 - 2 * fy);
      const r0 = (y0 % cy) * cx, r1 = ((y0 + 1) % cy) * cx;
      for (let x = 0; x < w; x++) {
        const gx = (x / w) * cx, x0 = Math.floor(gx), fx = gx - x0;
        const sx = fx * fx * (3 - 2 * fx);
        const x1 = (x0 + 1) % cx, xx0 = x0 % cx;
        const a = grid[r0 + xx0], b = grid[r0 + x1], c = grid[r1 + xx0], d = grid[r1 + x1];
        out[y * w + x] += amp * (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy);
      }
    }
    total += amp;
    amp *= persistence;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

// height (Float32Array) -> normal map canvas
function normalCanvas(hgt, w, h, strength = 2) {
  const c = canvas(w, h), ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const l = hgt[y * w + ((x - 1 + w) % w)], r = hgt[y * w + ((x + 1) % w)];
      const u = hgt[((y - 1 + h) % h) * w + x], d = hgt[((y + 1) % h) * w + x];
      let nx = (l - r) * strength, ny = (d - u) * strength, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const i = (y * w + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function fromHeightColor(w, h, fn) {
  // fn(x,y) => [r,g,b,height]
  const c = canvas(w, h), ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const hgt = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, g, b, hh] = fn(x, y);
    const i = (y * w + x) * 4;
    img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    hgt[y * w + x] = hh;
  }
  ctx.putImageData(img, 0, 0);
  return { c, hgt };
}

const clamp255 = (v) => Math.max(0, Math.min(255, v));

// ---------- texture factory ----------
export function buildTextures() {
  const T = {};

  // ASPHALT (road)
  {
    const s = 512, n = noise(s, s, 16, 6), n2 = noise(s, s, 3, 3);
    const { c, hgt } = fromHeightColor(s, s, (x, y) => {
      const i = y * s + x;
      const speck = rand();
      let v = 52 + n[i] * 40 + (n2[i] - 0.5) * 26;
      if (speck > 0.985) v += 50; else if (speck < 0.02) v -= 25;
      return [clamp255(v), clamp255(v + 1), clamp255(v + 4), n[i] + (speck > 0.97 ? 0.3 : 0)];
    });
    T.asphalt = toTex(c, [1, 1]);
    T.asphaltN = toTex(normalCanvas(hgt, s, s, 3), [1, 1], false);
  }

  // FORECOURT tarmac with stains & patching
  {
    const s = 512, n = noise(s, s, 12, 6), stain = noise(s, s, 2, 4, 0.6), patch = noise(s, s, 4, 2);
    const { c, hgt } = fromHeightColor(s, s, (x, y) => {
      const i = y * s + x;
      const sp = rand();
      let v = 70 + n[i] * 36;
      if (stain[i] > 0.62) v -= (stain[i] - 0.62) * 140;
      if (patch[i] > 0.68) v -= 12;
      if (sp > 0.99) v += 40;
      return [clamp255(v), clamp255(v), clamp255(v + 3), n[i]];
    });
    T.tarmac = toTex(c);
    T.tarmacN = toTex(normalCanvas(hgt, s, s, 2.5), [1, 1], false);
  }

  // PAVING slabs (4x4 slabs 0.6m each => tile = 2.4m)
  {
    const s = 512, n = noise(s, s, 16, 5), slab = s / 4;
    const tint = [];
    for (let i = 0; i < 16; i++) tint.push((rand() - 0.5) * 22);
    const { c, hgt } = fromHeightColor(s, s, (x, y) => {
      const sx = Math.floor(x / slab), sy = Math.floor(y / slab);
      const lx = x % slab, ly = y % slab;
      const joint = lx < 3 || ly < 3;
      let v = 150 + tint[(sy * 4 + sx) % 16] + n[y * s + x] * 30;
      if (joint) v = 85;
      return [clamp255(v), clamp255(v - 2), clamp255(v - 6), joint ? 0 : 0.6 + n[y * s + x] * 0.2];
    });
    T.paving = toTex(c);
    T.pavingN = toTex(normalCanvas(hgt, s, s, 4), [1, 1], false);
  }

  // BRICK
  {
    const s = 512, n = noise(s, s, 32, 4), bw = 64, bh = s / 24;
    const tints = [];
    for (let i = 0; i < 400; i++) tints.push([rand(), rand()]);
    const { c, hgt } = fromHeightColor(s, s, (x, y) => {
      const row = Math.floor(y / bh);
      const off = (row % 2) * (bw / 2);
      const col = Math.floor((x + off) / bw);
      const lx = (x + off) % bw, ly = y - row * bh;
      const mortar = lx < 4 || ly < 3;
      const t = tints[(row * 9 + col) % 400];
      const nn = n[y * s + x];
      if (mortar) {
        const m = 150 + nn * 30;
        return [m, m - 6, m - 14, 0];
      }
      const dark = t[1] > 0.85 ? -40 : 0;
      const r = 128 + t[0] * 50 + nn * 30 + dark, g = 52 + t[0] * 18 + nn * 15 + dark * 0.5, b = 40 + t[0] * 12 + nn * 10 + dark * 0.4;
      return [clamp255(r), clamp255(g), clamp255(b), 0.7 + nn * 0.3];
    });
    T.brick = toTex(c);
    T.brickN = toTex(normalCanvas(hgt, s, s, 5), [1, 1], false);
  }

  // CORRUGATED cladding (vertical ribs) - neutral grey, tinted by material colour
  {
    const w = 256, h = 256, n = noise(w, h, 4, 4), streak = noise(w, h, 24, 2);
    const { c, hgt } = fromHeightColor(w, h, (x, y) => {
      const rib = Math.pow(Math.abs(Math.sin((x / w) * Math.PI * 8)), 0.6);
      const dirt = (n[y * w + x] - 0.5) * 30 - Math.max(0, streak[y * w + Math.floor(x / 4) * 4] - 0.6) * 60 * (y / h);
      const v = 205 + rib * 25 + dirt;
      return [clamp255(v), clamp255(v), clamp255(v), rib];
    });
    T.corr = toTex(c);
    T.corrN = toTex(normalCanvas(hgt, w, h, 6), [1, 1], false);
  }

  // ROOF corrugated sheets (light grey with moss/grime)
  {
    const w = 256, h = 256, n = noise(w, h, 6, 5), moss = noise(w, h, 3, 4);
    const { c, hgt } = fromHeightColor(w, h, (x, y) => {
      const rib = Math.pow(Math.abs(Math.sin((x / w) * Math.PI * 10)), 0.5);
      let r = 200 + n[y * w + x] * 40, g = r, b = r - 4;
      const m = moss[y * w + x];
      if (m > 0.6) { const k = (m - 0.6) * 2.5; r -= 60 * k; g -= 40 * k; b -= 70 * k; }
      r -= (1 - rib) * 20; g -= (1 - rib) * 20; b -= (1 - rib) * 20;
      return [clamp255(r), clamp255(g), clamp255(b), rib];
    });
    T.roof = toTex(c);
    T.roofN = toTex(normalCanvas(hgt, w, h, 5), [1, 1], false);
  }

  // GRASS
  {
    const s = 256, n = noise(s, s, 8, 6), n2 = noise(s, s, 2, 3);
    const { c, hgt } = fromHeightColor(s, s, (x, y) => {
      const i = y * s + x, sp = rand();
      const dry = n2[i];
      const r = 60 + n[i] * 40 + dry * 50 + sp * 15, g = 78 + n[i] * 50 + dry * 20 + sp * 20, b = 34 + n[i] * 15;
      return [clamp255(r), clamp255(g), clamp255(b), n[i] + sp * 0.4];
    });
    T.grass = toTex(c);
    T.grassN = toTex(normalCanvas(hgt, s, s, 3), [1, 1], false);
  }

  // BALLAST
  {
    const s = 256, n = noise(s, s, 48, 3);
    const { c, hgt } = fromHeightColor(s, s, (x, y) => {
      const i = y * s + x, v = 70 + n[i] * 90 + rand() * 20;
      return [clamp255(v + 8), clamp255(v), clamp255(v - 6), n[i]];
    });
    T.ballast = toTex(c);
    T.ballastN = toTex(normalCanvas(hgt, s, s, 6), [1, 1], false);
  }

  // CONCRETE
  {
    const s = 256, n = noise(s, s, 6, 6), n2 = noise(s, s, 32, 2);
    const { c, hgt } = fromHeightColor(s, s, (x, y) => {
      const i = y * s + x, v = 150 + n[i] * 50 + n2[i] * 20;
      return [clamp255(v), clamp255(v - 2), clamp255(v - 6), n2[i]];
    });
    T.concrete = toTex(c);
    T.concreteN = toTex(normalCanvas(hgt, s, s, 2), [1, 1], false);
  }

  // ROOF FELT / gravel (player's rooftop)
  {
    const s = 256, n = noise(s, s, 64, 2), n2 = noise(s, s, 4, 4);
    const { c, hgt } = fromHeightColor(s, s, (x, y) => {
      const i = y * s + x, v = 55 + n[i] * 45 + n2[i] * 25;
      return [clamp255(v), clamp255(v), clamp255(v + 2), n[i]];
    });
    T.felt = toTex(c);
    T.feltN = toTex(normalCanvas(hgt, s, s, 4), [1, 1], false);
  }

  // CAMO (desert) for hostiles
  {
    const s = 256, a = noise(s, s, 6, 3, 0.55), b = noise(s, s, 8, 3, 0.55), d = noise(s, s, 12, 2);
    const { c } = fromHeightColor(s, s, (x, y) => {
      const i = y * s + x;
      let col = [176, 156, 118];
      if (a[i] > 0.55) col = [128, 104, 72];
      if (b[i] > 0.6) col = [92, 88, 60];
      if (d[i] > 0.7) col = [196, 182, 150];
      const g = rand() * 10;
      return [col[0] - g, col[1] - g, col[2] - g, 0];
    });
    T.camo = toTex(c);
  }

  // CAMO (woodland) for player's sleeves
  {
    const s = 128, a = noise(s, s, 4, 3), b = noise(s, s, 6, 3), d = noise(s, s, 8, 2);
    const { c } = fromHeightColor(s, s, (x, y) => {
      const i = y * s + x;
      let col = [96, 100, 70];
      if (a[i] > 0.55) col = [60, 70, 44];
      if (b[i] > 0.6) col = [110, 86, 58];
      if (d[i] > 0.68) col = [32, 30, 26];
      return [...col, 0];
    });
    T.woodland = toTex(c);
  }

  // WINDOW GRID for distant buildings
  {
    const w = 256, h = 256;
    const c = canvas(w, h), ctx = c.getContext('2d');
    ctx.fillStyle = '#8c8a86'; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const lit = rand();
      ctx.fillStyle = lit > 0.85 ? '#d8c8a0' : lit > 0.4 ? '#2a3038' : '#3d4a58';
      ctx.fillRect(x * 32 + 6, y * 32 + 6, 20, 20);
    }
    T.windows = toTex(c);
  }

  // CRACKED GLASS
  {
    const s = 256, c = canvas(s, s), ctx = c.getContext('2d');
    ctx.fillStyle = '#2b3138'; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(230,240,250,0.85)';
    for (let k = 0; k < 3; k++) {
      const cx = 40 + rand() * 176, cy = 40 + rand() * 176;
      for (let i = 0; i < 14; i++) {
        ctx.lineWidth = 0.5 + rand() * 1.5;
        ctx.beginPath(); ctx.moveTo(cx, cy);
        let x = cx, y = cy; const ang = rand() * Math.PI * 2;
        for (let j = 0; j < 6; j++) { x += Math.cos(ang + (rand() - 0.5)) * 25; y += Math.sin(ang + (rand() - 0.5)) * 25; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      for (let r = 10; r < 60; r += 14) { ctx.beginPath(); ctx.arc(cx, cy, r + rand() * 6, 0, Math.PI * 2); ctx.stroke(); }
    }
    T.crackedGlass = toTex(c);
  }

  return T;
}

// ---------- signage ----------
export function signTexture() {
  const w = 2048, h = 256, c = canvas(w, h), ctx = c.getContext('2d');
  ctx.fillStyle = '#f4f6f8'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#d8dee6'; ctx.fillRect(0, h - 14, w, 14);
  ctx.textBaseline = 'middle';
  ctx.font = '700 150px "Arial Rounded MT Bold", "Trebuchet MS", Arial, sans-serif';
  ctx.fillStyle = '#1f3f8f';
  const left = 'Liverpool', right = 'Centre';
  const lw = ctx.measureText(left).width, rw = ctx.measureText(right).width;
  ctx.font = 'italic 800 150px "Trebuchet MS", Arial, sans-serif';
  const cw = ctx.measureText('Car').width;
  const ovalW = cw + 120, total = lw + ovalW + rw + 80;
  let x = (w - total) / 2;
  ctx.font = '700 150px "Trebuchet MS", Arial, sans-serif';
  ctx.fillStyle = '#1f3f8f'; ctx.fillText(left, x, h / 2 + 6);
  x += lw + 40;
  ctx.fillStyle = '#1f3f8f';
  ctx.beginPath(); ctx.ellipse(x + ovalW / 2, h / 2, ovalW / 2, h / 2 - 18, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.font = 'italic 800 150px "Trebuchet MS", Arial, sans-serif';
  ctx.fillText('Car', x + 60, h / 2 + 6);
  x += ovalW + 40;
  ctx.fillStyle = '#1f3f8f'; ctx.font = '700 150px "Trebuchet MS", Arial, sans-serif';
  ctx.fillText(right, x, h / 2 + 6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso;
  return t;
}

export function poleSignTexture() {
  const w = 256, h = 1024, c = canvas(w, h), ctx = c.getContext('2d');
  ctx.fillStyle = '#f4f6f8'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#1f3f8f'; ctx.fillRect(0, 0, w, 24); ctx.fillRect(0, h - 24, w, 24);
  ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '700 92px "Trebuchet MS", Arial, sans-serif'; ctx.fillStyle = '#1f3f8f';
  ctx.fillText('Liverpool', -250, 0);
  ctx.beginPath(); ctx.ellipse(40, 0, 130, 90, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'italic 800 100px "Trebuchet MS", Arial, sans-serif'; ctx.fillText('Car', 40, 4);
  ctx.fillStyle = '#1f3f8f'; ctx.font = '700 92px "Trebuchet MS", Arial, sans-serif'; ctx.fillText('Centre', 320, 0);
  ctx.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso;
  return t;
}

export function flagTexture(text) {
  const w = 128, h = 512, c = canvas(w, h), ctx = c.getContext('2d');
  ctx.fillStyle = '#18203a'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#2f7fd8'; ctx.fillRect(0, 0, 18, h);
  ctx.fillStyle = '#fff'; ctx.fillRect(28, 20, 72, 72);
  ctx.fillStyle = '#18203a'; ctx.font = '900 60px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('£', 64, 58);
  ctx.save(); ctx.translate(70, 300); ctx.rotate(Math.PI / 2);
  ctx.fillStyle = '#ffffff'; ctx.font = '800 46px "Trebuchet MS", Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 0);
  ctx.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function priceTexture(price) {
  const w = 128, h = 96, c = canvas(w, h), ctx = c.getContext('2d');
  ctx.fillStyle = '#ff4d6d'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff'; ctx.fillRect(6, 6, w - 12, h - 12);
  ctx.fillStyle = '#e0123a'; ctx.font = '900 34px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('£' + price, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- particle sprites ----------
export function radialTexture(stops, size = 128) {
  const c = canvas(size, size), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function smokeTexture() {
  const s = 128, n = noise(s, s, 4, 4), c = canvas(s, s), ctx = c.getContext('2d');
  const img = ctx.createImageData(s, s);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const dx = (x - s / 2) / (s / 2), dy = (y - s / 2) / (s / 2);
    const d = Math.sqrt(dx * dx + dy * dy);
    const a = Math.max(0, 1 - d) * (0.4 + n[y * s + x] * 0.9);
    const i = (y * s + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
    img.data[i + 3] = clamp255(a * a * 255 * 1.4);
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
