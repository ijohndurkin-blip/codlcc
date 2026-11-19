import { LAYOUT } from './world.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.el = {
      hud: $('hud'), score: $('score'), streak: $('streak'), wave: $('wave-label'), enemies: $('enemies-label'),
      ammo: $('ammo-count'), pips: $('ammo-pips'), reloadHint: $('reload-hint'), health: $('health-fill'), stance: $('stance'),
      dmg: $('damage-overlay'), dmgInd: $('dmg-indicators'), scope: $('scope'), cross: $('crosshair'), zoom: $('zoom-level'), range: $('range'),
      breath: $('breath-fill'), breathWrap: $('breath-wrap'), hit: $('hitmarker'), keh: $('keh-pop'), points: $('points'), feed: $('killfeed'),
      subtitle: $('subtitle'), banner: $('banner'), bannerMain: $('banner-main'), bannerSub: $('banner-sub'), stamp: $('intro-stamp'),
      grenade: $('grenade-ind'), minimap: $('minimap'), compass: $('compass'),
    };
    this.mm = this.el.minimap.getContext('2d');
    this.cp = this.el.compass.getContext('2d');
    this.subT = null; this.bannerT = null;
    // mil dots
    const g = document.getElementById('mildots');
    let s = '';
    for (let i = 1; i <= 4; i++) {
      s += `<circle cx="${i * 25}" cy="0" r="3"/><circle cx="${-i * 25}" cy="0" r="3"/><circle cx="0" cy="${i * 25}" r="3"/>`;
      s += `<circle cx="0" cy="${-i * 25}" r="3"/>`;
    }
    g.innerHTML = s;
    for (let i = 0; i < 5; i++) this.el.pips.appendChild(document.createElement('i'));
  }

  show(v) { this.el.hud.classList.toggle('hidden', !v); }

  setScore(n) { this.el.score.textContent = n.toLocaleString('en-GB'); }
  setStreak(n) { this.el.streak.textContent = n >= 2 ? `${n} KILL STREAK` : ''; }
  setWave(n, remaining) { this.el.wave.textContent = `WAVE ${n}`; this.el.enemies.textContent = `HOSTILES ${remaining}`; }

  updatePlayer(p, rangeM) {
    this.el.ammo.textContent = p.ammo;
    const W = p.W;
    if (this.el.pips.children.length !== W.mag) {
      this.el.pips.innerHTML = '';
      for (let i = 0; i < W.mag; i++) this.el.pips.appendChild(document.createElement('i'));
      document.getElementById('weapon-name').textContent = W.name;
    }
    [...this.el.pips.children].forEach((pip, i) => pip.classList.toggle('spent', i >= p.ammo));
    this.el.reloadHint.classList.toggle('hidden', !(p.ammo === 0 && p.reloadT <= 0));
    this.el.health.style.width = `${p.health}%`;
    this.el.health.style.background = p.health < 35 ? '#ff3b30' : '#eef2f0';
    this.el.stance.textContent = p.reloadT > 0 ? 'RELOADING' : p.crouch > 0.5 ? 'CROUCHED · IN COVER' : 'STANDING · EXPOSED';
    const scoped = p.ads > 0.88;
    this.el.scope.classList.toggle('hidden', !scoped);
    this.el.cross.style.opacity = scoped || p.ads > 0.2 ? 0 : 0.8;
    if (scoped) {
      this.el.zoom.textContent = `${p.zoom.toFixed(1)}x`;
      this.el.range.textContent = rangeM ? `${rangeM.toFixed(0)} m` : '— m';
      this.el.breath.style.width = `${p.breath * 100}%`;
      this.el.breath.style.background = p.breathLock > 0 ? '#ff6a5a' : '#bfe9ff';
    }
    const hurt = Math.max(0, 1 - p.health / 100);
    this.el.dmg.style.opacity = Math.min(1, hurt * 1.2 + (p.sinceHurt < 0.25 ? 0.3 : 0));
  }

  hitmarker(kill) {
    const h = this.el.hit;
    h.classList.toggle('kill', kill);
    h.classList.remove('show'); void h.offsetWidth; h.classList.add('show');
  }

  kehPop() {
    const k = this.el.keh;
    k.classList.remove('show'); void k.offsetWidth; k.classList.add('show');
  }

  points(lines) {
    const wrap = document.createElement('div');
    lines.forEach(([t, big]) => { const d = document.createElement('div'); d.className = 'pt' + (big ? ' big' : ''); d.textContent = t; wrap.appendChild(d); });
    this.el.points.innerHTML = ''; this.el.points.appendChild(wrap);
  }

  feed(html) {
    const d = document.createElement('div'); d.className = 'kf'; d.innerHTML = html;
    this.el.feed.prepend(d);
    while (this.el.feed.children.length > 6) this.el.feed.lastChild.remove();
    setTimeout(() => d.remove(), 4600);
  }

  damageFrom(angle) {
    const d = document.createElement('div'); d.className = 'dmg-ind';
    d.style.transform = `rotate(${angle}rad)`;
    this.el.dmgInd.appendChild(d);
    setTimeout(() => { d.style.opacity = 0; }, 700);
    setTimeout(() => d.remove(), 1400);
  }

  subtitle(html, ms = 3500) {
    this.el.subtitle.innerHTML = html;
    this.el.subtitle.classList.add('show');
    clearTimeout(this.subT);
    this.subT = setTimeout(() => this.el.subtitle.classList.remove('show'), ms);
  }

  banner(main, sub = '', ms = 3000) {
    this.el.bannerMain.textContent = main; this.el.bannerSub.textContent = sub;
    this.el.banner.classList.add('show');
    clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => this.el.banner.classList.remove('show'), ms);
  }

  async stamp(lines) {
    const el = this.el.stamp;
    el.textContent = ''; el.style.opacity = 1;
    for (const line of lines) {
      for (const ch of line) { el.textContent += ch; await new Promise((r) => setTimeout(r, 38)); }
      el.textContent += '\n';
      await new Promise((r) => setTimeout(r, 250));
    }
    setTimeout(() => { el.style.transition = 'opacity 1.5s'; el.style.opacity = 0; }, 2500);
  }

  grenadeIndicator(angle) {
    if (angle === null) { this.el.grenade.classList.add('hidden'); return; }
    this.el.grenade.classList.remove('hidden');
    this.el.grenade.querySelector('.gi-arrow').style.transform = `rotate(${angle}rad)`;
  }

  // ---------- minimap ----------
  drawMinimap(player, enemies, cars, civ) {
    const c = this.mm, W = 200, H = 200, S = 2.3;
    const px = player.pos.x, pz = player.pos.z, yaw = player.yaw;
    const sin = Math.sin(yaw), cos = Math.cos(yaw);
    const ox = W / 2, oy = H * 0.78;
    const map = (x, z) => {
      const dx = x - px, dz = z - pz;
      const r = dx * cos - dz * sin;          // right
      const f = -dx * sin - dz * cos;          // forward
      return [ox + r * S, oy - f * S];
    };
    c.clearRect(0, 0, W, H);
    c.save();
    c.beginPath(); c.rect(0, 0, W, H); c.clip();
    const poly = (pts, fill, stroke) => {
      c.beginPath(); pts.forEach(([x, z], i) => { const [a, b] = map(x, z); if (i) c.lineTo(a, b); else c.moveTo(a, b); }); c.closePath();
      if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.stroke(); }
    };
    poly([[-200, -5], [200, -5], [200, 5], [-200, 5]], 'rgba(60,64,70,0.9)');
    poly([[-30, -29], [30, -29], [30, -9], [-30, -9]], 'rgba(90,96,100,0.75)', 'rgba(150,170,255,0.6)');
    poly([[-24, -41], [22, -41], [22, -29], [-24, -29]], 'rgba(120,140,170,0.85)');
    poly([[22, -41], [30, -41], [30, -28.4], [22, -28.4]], 'rgba(150,160,170,0.85)');
    poly([[30, -44], [48, -44], [48, -12], [30, -12]], 'rgba(150,70,55,0.85)');
    poly([[-65, 9], [65, 9], [65, 25], [-65, 25]], 'rgba(120,60,50,0.6)');
    c.fillStyle = 'rgba(200,200,210,0.7)';
    for (const cc of cars) { const [a, b] = map(cc.x, cc.z); c.fillRect(a - 2, b - 2, 4, 4); }
    const now = performance.now();
    for (const t of enemies.trucks) {
      if (t.state === 'gone') continue;
      const [a, b] = map(t.group.position.x, t.group.position.z);
      c.fillStyle = t.state === 'destroyed' ? 'rgba(40,40,40,0.9)' : 'rgba(255,90,60,0.9)';
      c.fillRect(a - 8, b - 3, 16, 6);
    }
    for (const s of enemies.soldiers) {
      if (!s.alive) continue;
      const recent = s.lastFired && now - s.lastFired < 2500;
      if (!recent) continue;
      const [a, b] = map(s.root.position.x, s.root.position.z);
      c.fillStyle = '#ff3b30'; c.beginPath(); c.arc(a, b, 4, 0, Math.PI * 2); c.fill();
    }
    for (const g of enemies.grenades) {
      const [a, b] = map(g.mesh.position.x, g.mesh.position.z);
      c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(a, b, 3, 0, Math.PI * 2); c.fill();
    }
    if (civ) for (const p of civ.people) {
      if (!p.alive || !p.root.parent) continue;
      const [a, b] = map(p.root.position.x, p.root.position.z);
      c.fillStyle = '#4fc3ff'; c.beginPath(); c.arc(a, b, 3.5, 0, Math.PI * 2); c.fill();
    }
    if (civ && civ.bmw) { const [a, b] = map(civ.bmw.position.x, civ.bmw.position.z); c.fillStyle = '#a9cbe8'; c.fillRect(a - 5, b - 2.5, 10, 5); }
    // player
    c.fillStyle = '#9fe870';
    c.beginPath(); c.moveTo(ox, oy - 8); c.lineTo(ox + 6, oy + 6); c.lineTo(ox, oy + 3); c.lineTo(ox - 6, oy + 6); c.closePath(); c.fill();
    // view cone
    c.fillStyle = 'rgba(159,232,112,0.12)';
    const fovHalf = (player.camera.fov * player.camera.aspect * Math.PI / 180) / 2;
    c.beginPath(); c.moveTo(ox, oy); c.lineTo(ox - Math.tan(fovHalf) * 200, oy - 200); c.lineTo(ox + Math.tan(fovHalf) * 200, oy - 200); c.closePath(); c.fill();
    c.restore();
  }

  drawCompass(yaw) {
    const c = this.cp, W = 460, H = 38;
    c.clearRect(0, 0, W, H);
    let heading = (-yaw * 180 / Math.PI) % 360; if (heading < 0) heading += 360;
    // showroom direction = North
    const ppd = 3.2;
    c.font = '600 15px Rajdhani, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const labels = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    for (let d = Math.floor(heading - 75); d <= heading + 75; d++) {
      const dd = ((d % 360) + 360) % 360;
      const x = W / 2 + (d - heading) * ppd;
      const fade = 1 - Math.abs(x - W / 2) / (W / 2);
      c.globalAlpha = Math.max(0, fade);
      if (dd % 15 === 0) {
        c.fillStyle = '#eef2f0';
        if (labels[dd] !== undefined) { c.fillStyle = dd === 0 ? '#9fe870' : '#eef2f0'; c.fillText(labels[dd], x, 12); }
        else c.fillText(String(dd), x, 12);
        c.fillRect(x - 0.5, 24, 1, 10);
      } else if (dd % 5 === 0) { c.fillStyle = 'rgba(238,242,240,0.6)'; c.fillRect(x - 0.5, 28, 1, 6); }
    }
    c.globalAlpha = 1; c.fillStyle = '#9fe870'; c.beginPath(); c.moveTo(W / 2, 36); c.lineTo(W / 2 - 5, 30); c.lineTo(W / 2 + 5, 30); c.fill();
  }
}

export { LAYOUT };
