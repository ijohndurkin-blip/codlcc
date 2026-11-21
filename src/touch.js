// On-screen controls for phones and tablets: floating move stick (left), drag-to-aim (right),
// and action buttons. Uses Pointer Events so every finger is tracked independently.
const $ = (id) => document.getElementById(id);

export class TouchControls {
  constructor({ player, onPause }) {
    this.player = player;
    this.onPause = onPause;
    this.root = $('touch');
    this.lookSens = 0.0048;
    this.stick = { id: null, ox: 0, oy: 0 };
    this.looks = new Map(); // pointerId -> last {x,y}
    this.state = {};
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
    const capture = (el, e) => { try { capture(el, e); } catch (err) { /* pointer already gone */ } };

    // --- move stick (appears wherever your left thumb lands) ---
    const zone = $('tz-stick'), base = $('stick-base'), knob = $('stick-knob');
    const R = 56;
    zone.addEventListener('pointerdown', (e) => {
      stop(e);
      if (this.stick.id !== null) return;
      capture(zone, e);
      this.stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY };
      base.style.left = `${e.clientX}px`; base.style.top = `${e.clientY}px`;
      base.classList.add('on'); knob.style.transform = 'translate(-50%, -50%)';
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stick.id) return;
      stop(e);
      let dx = e.clientX - this.stick.ox, dy = e.clientY - this.stick.oy;
      const len = Math.hypot(dx, dy);
      if (len > R) { dx *= R / len; dy *= R / len; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      const m = Math.hypot(dx, dy) / R;
      this.player.touchMove.x = m < 0.15 ? 0 : dx / R;
      this.player.touchMove.y = m < 0.15 ? 0 : dy / R;
    });
    const endStick = (e) => {
      if (e.pointerId !== this.stick.id) return;
      this.stick.id = null;
      this.player.touchMove.x = 0; this.player.touchMove.y = 0;
      base.classList.remove('on');
    };
    zone.addEventListener('pointerup', endStick);
    zone.addEventListener('pointercancel', endStick);

    // --- drag to aim (right side, and while holding FIRE) ---
    const lookStart = (e) => { this.looks.set(e.pointerId, { x: e.clientX, y: e.clientY }); };
    const lookMove = (e) => {
      const last = this.looks.get(e.pointerId);
      if (!last) return;
      const dx = e.clientX - last.x, dy = e.clientY - last.y;
      last.x = e.clientX; last.y = e.clientY;
      this.player.look(dx, dy, this.lookSens * this.player.sensitivityScale);
    };
    const lookEnd = (e) => { this.looks.delete(e.pointerId); };
    const look = $('tz-look');
    look.addEventListener('pointerdown', (e) => { stop(e); capture(look, e); lookStart(e); });
    look.addEventListener('pointermove', (e) => { stop(e); lookMove(e); });
    look.addEventListener('pointerup', lookEnd);
    look.addEventListener('pointercancel', lookEnd);

    // --- buttons ---
    const btn = (id, down, up, drag = false) => {
      const el = $(id);
      el.addEventListener('pointerdown', (e) => {
        stop(e); capture(el, e); el.classList.add('down');
        if (drag) lookStart(e);
        down();
      });
      if (drag) el.addEventListener('pointermove', (e) => { stop(e); lookMove(e); });
      const end = (e) => { el.classList.remove('down'); if (drag) lookEnd(e); if (up) up(); };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    };
    const P = this.player;
    btn('tb-fire', () => P.fire(), null, true);
    btn('tb-scope', () => { P.adsHeld = !P.adsHeld; });
    btn('tb-crouch', () => { P.crouching = !P.crouching; });
    btn('tb-reload', () => P.startReload());
    btn('tb-swap', () => P.cycleWeapon());
    btn('tb-breath', () => { P.keys.ShiftLeft = true; }, () => { P.keys.ShiftLeft = false; });
    btn('tb-zin', () => { P.zoom = Math.min(P.W.maxZoom, P.zoom + 1); });
    btn('tb-zout', () => { P.zoom = Math.max(3, P.zoom - 1); });
    btn('tb-pause', () => this.onPause());

    // stop the page from scrolling / pinch-zooming underneath the game
    this.root.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  }

  show(on) {
    this.root.classList.toggle('hidden', !on);
    if (!on) this.release();
  }

  release() {
    const P = this.player;
    P.touchMove.x = 0; P.touchMove.y = 0; P.keys.ShiftLeft = false;
    this.stick.id = null; this.looks.clear();
    $('stick-base').classList.remove('on');
  }

  // reflect player state on the buttons (only touches the DOM when something changed)
  sync() {
    const P = this.player;
    const scoped = P.ads > 0.5 || P.adsHeld;
    const s = {
      scope: P.adsHeld, crouch: P.crouching, scoped,
      swap: Object.keys(P.unlocked).length > 1,
      reload: P.reloadT > 0,
    };
    const set = (key, fn) => { if (this.state[key] !== s[key]) { this.state[key] = s[key]; fn(s[key]); } };
    set('scope', (v) => $('tb-scope').classList.toggle('active', v));
    set('crouch', (v) => $('tb-crouch').classList.toggle('active', v));
    set('scoped', (v) => { for (const id of ['tb-breath', 'tb-zin', 'tb-zout']) $(id).classList.toggle('hidden', !v); });
    set('swap', (v) => $('tb-swap').classList.toggle('hidden', !v));
    set('reload', (v) => $('tb-reload').classList.toggle('active', v));
  }
}
