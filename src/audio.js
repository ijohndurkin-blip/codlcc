import * as THREE from 'three';

const KEH_KEY = 'lcc_keh_recording_v1';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.kehBuffer = null;
    this.listener = { pos: new THREE.Vector3(), right: new THREE.Vector3(1, 0, 0) };
    this.music = null;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.25;
    this.master.connect(comp); comp.connect(ctx.destination);
    // reverb
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(2.8, 2.6);
    this.reverbGain = ctx.createGain(); this.reverbGain.gain.value = 0.55;
    this.reverb.connect(this.reverbGain); this.reverbGain.connect(this.master);
    // white noise buffer
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.ambience();
    this.loadKeh();
  }

  impulse(sec, decay) {
    const ctx = this.ctx, len = ctx.sampleRate * sec;
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        // early reflections off the buildings + diffuse tail
        const er = (i % Math.floor(ctx.sampleRate * (0.031 + c * 0.007)) < 30) ? 0.6 : 0;
        d[i] = ((Math.random() * 2 - 1) + er * (Math.random() - 0.5)) * Math.pow(1 - t, decay);
      }
    }
    return b;
  }

  // ---------- primitives ----------
  out(pan = 0, wet = 0.3) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) { p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); p.connect(this.master); }
    else g.connect(this.master);
    if (wet > 0) { const s = ctx.createGain(); s.gain.value = wet; g.connect(s); s.connect(this.reverb); }
    return g;
  }

  noiseBurst(dest, t, dur, { type = 'lowpass', freq = 1000, q = 1, gain = 1, attack = 0.002, curve = 3, freqEnd = null } = {}) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.setTargetAtTime(0.0001, t + attack, dur / curve);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.5);
  }

  tone(dest, t, dur, { type = 'sine', freq = 440, freqEnd = null, gain = 0.5, attack = 0.003 } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
  }

  spatial(pos) {
    const L = this.listener;
    const to = new THREE.Vector3().subVectors(pos, L.pos);
    const d = to.length();
    to.normalize();
    return { dist: d, pan: to.dot(L.right) * 0.85, gain: 1 / (1 + d / 18) };
  }

  // ---------- weapons ----------
  sniperShot(heavy = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.out(0, heavy ? 1.2 : 0.9);
    if (heavy) {
      this.noiseBurst(o, t, 0.9, { type: 'lowpass', freq: 600, freqEnd: 70, gain: 1.6, curve: 4 });
      this.tone(o, t, 0.6, { freq: 70, freqEnd: 25, gain: 1.4 });
    }
    this.noiseBurst(o, t, 0.07, { type: 'highpass', freq: 1800, gain: 1.4 });
    this.noiseBurst(o, t, 0.55, { type: 'lowpass', freq: 900, freqEnd: 120, gain: 1.6, curve: 4 });
    this.tone(o, t, 0.4, { freq: 110, freqEnd: 35, gain: 1.2 });
    // slap-back echo off the showroom
    const echo = this.out(-0.2, 0.6);
    this.noiseBurst(echo, t + 0.28, 0.5, { type: 'lowpass', freq: 700, freqEnd: 150, gain: 0.35 });
    this.noiseBurst(echo, t + 0.55, 0.6, { type: 'lowpass', freq: 500, freqEnd: 120, gain: 0.18 });
  }

  click(o, t, freq, gain = 0.5, dur = 0.025) { this.noiseBurst(o, t, dur, { type: 'bandpass', freq, q: 6, gain }); this.tone(o, t, dur, { type: 'square', freq: freq * 0.7, gain: gain * 0.08 }); }

  bolt(delay = 0.25) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay, o = this.out(0.25, 0.1);
    this.click(o, t, 2600, 0.6);
    this.noiseBurst(o, t + 0.1, 0.09, { type: 'bandpass', freq: 3500, q: 2, gain: 0.25 });
    this.click(o, t + 0.2, 1700, 0.7);
    this.noiseBurst(o, t + 0.32, 0.08, { type: 'bandpass', freq: 3000, q: 2, gain: 0.25 });
    this.click(o, t + 0.42, 2100, 0.7);
    this.click(o, t + 0.55, 3200, 0.5);
    // brass hitting the roof
    this.tone(o, t + 0.5, 0.12, { freq: 4200, gain: 0.05 });
    this.tone(o, t + 0.62, 0.1, { freq: 3800, gain: 0.04 });
  }

  reload() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.out(0.2, 0.1);
    this.click(o, t + 0.2, 1500, 0.6);
    this.noiseBurst(o, t + 0.25, 0.15, { type: 'bandpass', freq: 900, gain: 0.3 });
    this.click(o, t + 1.2, 1200, 0.9);
    this.click(o, t + 1.28, 2200, 0.5);
    this.bolt(1.6);
  }

  dryFire() { if (!this.ctx) return; const t = this.ctx.currentTime; this.click(this.out(0.2, 0), t, 2800, 0.5); }

  enemyShot(pos, heavy = false) {
    if (!this.ctx) return;
    const s = this.spatial(pos), t = this.ctx.currentTime + s.dist / 343;
    const o = this.out(s.pan, 0.7);
    const g = s.gain * (heavy ? 0.9 : 0.75);
    this.noiseBurst(o, t, 0.06, { type: 'bandpass', freq: 2200, q: 0.8, gain: g * 1.1 });
    this.noiseBurst(o, t, 0.25, { type: 'lowpass', freq: 700, freqEnd: 150, gain: g * 0.9 });
  }

  whiz(pan = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.out(pan, 0.1);
    this.noiseBurst(o, t, 0.13, { type: 'bandpass', freq: 5200, freqEnd: 1800, q: 4, gain: 0.5, attack: 0.03, curve: 2 });
    this.noiseBurst(o, t, 0.02, { type: 'highpass', freq: 3000, gain: 0.5 });
  }

  impact(kind, pos) {
    if (!this.ctx) return;
    const s = this.spatial(pos), t = this.ctx.currentTime + s.dist / 343, o = this.out(s.pan, 0.4);
    const g = Math.min(1, s.gain * 2.2);
    if (kind === 'metal') {
      this.tone(o, t, 0.35, { freq: 1900 + Math.random() * 900, gain: 0.18 * g });
      this.tone(o, t, 0.25, { freq: 3100 + Math.random() * 600, gain: 0.08 * g });
      this.noiseBurst(o, t, 0.05, { type: 'highpass', freq: 2500, gain: 0.5 * g });
    } else if (kind === 'glass') {
      for (let i = 0; i < 14; i++) this.tone(o, t + Math.random() * 0.45, 0.05 + Math.random() * 0.1, { freq: 3000 + Math.random() * 5000, gain: 0.1 * g });
      this.noiseBurst(o, t, 0.4, { type: 'highpass', freq: 4000, gain: 0.6 * g });
    } else if (kind === 'flesh') {
      this.noiseBurst(o, t, 0.12, { type: 'lowpass', freq: 500, gain: 0.9 * g });
    } else {
      this.noiseBurst(o, t, 0.12, { type: 'lowpass', freq: 1600, gain: 0.6 * g });
    }
  }

  hitmarker(kill = false, headshot = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.out(0, 0);
    this.tone(o, t, 0.05, { type: 'square', freq: 2400, gain: 0.08 });
    if (headshot) {
      this.tone(o, t + 0.01, 0.35, { freq: 1350, gain: 0.25 });
      this.tone(o, t + 0.01, 0.25, { freq: 2700, gain: 0.1 });
    } else if (kill) this.tone(o, t + 0.02, 0.15, { type: 'triangle', freq: 900, gain: 0.15 });
  }

  explosion(pos, big = true) {
    if (!this.ctx) return;
    const s = this.spatial(pos), t = this.ctx.currentTime + s.dist / 343, o = this.out(s.pan, 1.2);
    const g = Math.min(1.5, s.gain * 3);
    this.noiseBurst(o, t, big ? 2.5 : 1.2, { type: 'lowpass', freq: 1200, freqEnd: 60, gain: 1.6 * g, curve: 3 });
    this.tone(o, t, big ? 1.4 : 0.7, { freq: 70, freqEnd: 25, gain: 1.4 * g });
    this.noiseBurst(o, t, 0.15, { type: 'highpass', freq: 1500, gain: 0.8 * g });
    if (big) for (let i = 0; i < 10; i++) this.noiseBurst(o, t + 0.4 + Math.random() * 1.5, 0.06, { type: 'bandpass', freq: 2000 + Math.random() * 2000, gain: 0.2 * g });
  }

  grenadeClink(pos) {
    if (!this.ctx) return;
    const s = this.spatial(pos), t = this.ctx.currentTime, o = this.out(s.pan, 0.2);
    this.tone(o, t, 0.12, { freq: 2600, gain: 0.25 });
    this.tone(o, t + 0.25, 0.1, { freq: 2400, gain: 0.15 });
  }

  carAlarm(pos, dur = 7) {
    if (!this.ctx) return;
    const ctx = this.ctx, s = this.spatial(pos), t = ctx.currentTime;
    const o = this.out(s.pan, 0.5);
    const osc = ctx.createOscillator(); osc.type = 'square';
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2500;
    const g = ctx.createGain(); g.gain.value = 0.06 * Math.min(1, s.gain * 2.5);
    for (let k = 0; k < dur / 0.3; k++) osc.frequency.setValueAtTime(k % 2 ? 1450 : 980, t + k * 0.3);
    g.gain.setValueAtTime(g.gain.value, t + dur - 0.1); g.gain.linearRampToValueAtTime(0, t + dur);
    osc.connect(f); f.connect(g); g.connect(o);
    osc.start(t); osc.stop(t + dur);
  }

  playerHurt() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.out(0, 0.1);
    this.noiseBurst(o, t, 0.15, { type: 'lowpass', freq: 400, gain: 0.8 });
    this.tone(o, t, 0.2, { freq: 90, freqEnd: 50, gain: 0.4 });
  }

  heartbeat() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.out(0, 0);
    this.tone(o, t, 0.15, { freq: 55, freqEnd: 40, gain: 0.5 });
    this.tone(o, t + 0.22, 0.15, { freq: 50, freqEnd: 38, gain: 0.35 });
  }

  breath(inhale) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.out(0, 0);
    this.noiseBurst(o, t, inhale ? 0.5 : 0.8, { type: 'bandpass', freq: inhale ? 900 : 600, q: 0.7, gain: 0.12, attack: 0.15, curve: 2 });
  }

  radio() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.out(0, 0);
    this.noiseBurst(o, t, 0.12, { type: 'bandpass', freq: 2200, q: 1, gain: 0.25 });
    this.tone(o, t + 0.05, 0.08, { type: 'square', freq: 1200, gain: 0.04 });
  }

  stinger() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.out(0, 0.8);
    [220, 277, 330, 440].forEach((f, i) => this.tone(o, t + i * 0.08, 2.2, { type: 'sawtooth', freq: f, gain: 0.04, attack: 0.05 }));
    this.tone(o, t, 1.8, { freq: 55, gain: 0.4 });
  }

  // engine loop for trucks
  engine() {
    if (!this.ctx) return { set() {}, stop() {} };
    const ctx = this.ctx;
    const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 38;
    const osc2 = ctx.createOscillator(); osc2.type = 'square'; osc2.frequency.value = 19;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260;
    const g = ctx.createGain(); g.gain.value = 0;
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    osc.connect(f); osc2.connect(f); f.connect(g);
    if (p) { g.connect(p); p.connect(this.master); } else g.connect(this.master);
    osc.start(); osc2.start();
    return {
      set: (pos, rpm) => {
        const s = this.spatial(pos);
        g.gain.setTargetAtTime(0.35 * s.gain, ctx.currentTime, 0.1);
        if (p) p.pan.setTargetAtTime(s.pan, ctx.currentTime, 0.1);
        osc.frequency.setTargetAtTime(30 + rpm * 40, ctx.currentTime, 0.2);
        osc2.frequency.setTargetAtTime(15 + rpm * 20, ctx.currentTime, 0.2);
      },
      stop: () => { g.gain.setTargetAtTime(0, ctx.currentTime, 0.3); osc.stop(ctx.currentTime + 1.5); osc2.stop(ctx.currentTime + 1.5); },
    };
  }

  ambience() {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 4, b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let last = 0;
      for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    }
    const src = ctx.createBufferSource(); src.buffer = b; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    const g = ctx.createGain(); g.gain.value = 0.22;
    src.connect(f); f.connect(g); g.connect(this.master); src.start();
  }

  startMusic() {
    if (!this.ctx || this.music) return;
    const ctx = this.ctx;
    const bus = ctx.createGain(); bus.gain.value = 0;
    bus.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 3);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 2;
    bus.connect(f); f.connect(this.master);
    const wet = ctx.createGain(); wet.gain.value = 0.6; f.connect(wet); wet.connect(this.reverb);
    const chords = [[110, 130.8, 164.8], [87.3, 110, 130.8], [98, 123.5, 146.8], [82.4, 103.8, 123.5]];
    let step = 0, stopped = false;
    const play = () => {
      if (stopped) return;
      const t = ctx.currentTime, ch = chords[step % chords.length];
      ch.forEach((fr) => [-6, 6].forEach((det) => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.detune.value = det;
        const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06, t + 1.2); g.gain.linearRampToValueAtTime(0, t + 4.2);
        o.connect(g); g.connect(bus); o.start(t); o.stop(t + 4.3);
      }));
      // pulsing low drum
      for (let k = 0; k < 4; k++) this.tone(bus, t + k, 0.5, { freq: 55, freqEnd: 35, gain: 0.5 });
      this.noiseBurst(bus, t + 2, 0.3, { type: 'lowpass', freq: 300, gain: 0.4 });
      step++;
    };
    play();
    const id = setInterval(play, 4000);
    this.music = { stop: () => { stopped = true; clearInterval(id); bus.gain.setTargetAtTime(0, ctx.currentTime, 0.8); this.music = null; } };
  }
  stopMusic() { if (this.music) this.music.stop(); }

  // ---------- voice clips: "keh" (you) and "craig" ----------
  clipKey(name) { return name === 'keh' ? KEH_KEY : `lcc_clip_${name}_v1`; }

  async loadClip(name) {
    this.clips = this.clips || {};
    const c = this.clips[name] = { buffer: null, source: 'speech' };
    try {
      const saved = localStorage.getItem(this.clipKey(name));
      if (saved) {
        c.buffer = await this.ctx.decodeAudioData(await (await fetch(saved)).arrayBuffer());
        c.source = 'recorded';
        return;
      }
    } catch (e) { /* ignore */ }
    try {
      const r = await fetch(`/${name}.mp3`);
      if (r.ok && (r.headers.get('content-type') || '').includes('audio')) {
        c.buffer = await this.ctx.decodeAudioData(await r.arrayBuffer());
        c.source = 'file';
      }
    } catch (e) { /* ignore */ }
  }

  async loadKeh() { await Promise.all([this.loadClip('keh'), this.loadClip('craig'), this.loadClip('mot')]); }

  clipSource(name) { return (this.clips && this.clips[name] && this.clips[name].source) || 'speech'; }
  get kehSource() { return this.clipSource('keh'); }

  async setRecordedClip(name, blob) {
    this.init();
    const ab = await blob.arrayBuffer();
    this.clips = this.clips || {};
    this.clips[name] = { buffer: await this.ctx.decodeAudioData(ab.slice(0)), source: 'recorded' };
    try {
      const url = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
      localStorage.setItem(this.clipKey(name), url);
    } catch (e) { /* storage may be unavailable */ }
  }

  clearRecordedClip(name) {
    try { localStorage.removeItem(this.clipKey(name)); } catch (e) { /* ignore */ }
    if (this.clips) this.clips[name] = { buffer: null, source: 'speech' };
    if (this.ctx) this.loadClip(name);
  }

  speak(text, { pitch = 1, rate = 1, prefer = [] } = {}) {
    if (!('speechSynthesis' in window)) return false;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const voices = speechSynthesis.getVoices();
      let v = null;
      for (const re of prefer) { v = voices.find((x) => re.test(x.name) || re.test(x.lang)); if (v) break; }
      if (v) u.voice = v;
      u.pitch = pitch; u.rate = rate; u.volume = 1;
      speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  }

  // iOS / Android only allow speech after a user gesture: call this from a tap
  primeSpeech() {
    if (!('speechSynthesis' in window)) return;
    try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) { /* ignore */ }
  }

  playClip(name, gain = 1.4) {
    const c = this.clips && this.clips[name];
    if (!c || !c.buffer || !this.ctx) return false;
    const src = this.ctx.createBufferSource(); src.buffer = c.buffer;
    const g = this.ctx.createGain(); g.gain.value = gain;
    src.connect(g); g.connect(this.master); src.start();
    return true;
  }

  keh() {
    if (this.playClip('keh')) return;
    if (this.speak('Keh!', { pitch: 0.85, rate: 1.15, prefer: [/en-GB.*(male|daniel|george|arthur)/i, /daniel|george|arthur/i, /en-GB/i] })) return;
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.out(0, 0.1);
    this.noiseBurst(o, t, 0.04, { type: 'bandpass', freq: 2500, q: 2, gain: 0.8 });
    this.tone(o, t + 0.04, 0.18, { type: 'sawtooth', freq: 140, freqEnd: 110, gain: 0.25 });
  }

  // characters' lines
  say(name, pos) {
    if (name === 'craig') {
      const g = pos ? Math.max(0.7, this.spatial(pos).gain * 2.2) : 1.4;
      if (this.playClip('craig', g)) return;
      // Scottish-ish: prefer a Scottish voice (e.g. "Fiona" on macOS), otherwise en-GB; spelt the way he says it
      this.speak('Get yersel away!', { pitch: 1.25, rate: 1.05, prefer: [/fiona|scot|en-?scotland|en-GB-SCT/i, /en-GB/i] });
    } else if (name === 'mot') {
      const g = pos ? Math.max(0.7, this.spatial(pos).gain * 2.2) : 1.4;
      if (this.playClip('mot', g)) return;
      this.speak('M. O. T. done!', { pitch: 0.95, rate: 0.95, prefer: [/en-GB.*(male|daniel|george|arthur)/i, /daniel|george|arthur/i, /en-GB/i] });
    }
  }

  railShot() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.out(0, 1.0);
    this.tone(o, t, 0.25, { type: 'sawtooth', freq: 300, freqEnd: 4000, gain: 0.25 });
    this.noiseBurst(o, t + 0.02, 0.08, { type: 'highpass', freq: 2000, gain: 1.4 });
    this.noiseBurst(o, t + 0.02, 0.9, { type: 'lowpass', freq: 900, freqEnd: 90, gain: 1.3, curve: 4 });
    this.tone(o, t + 0.02, 0.8, { freq: 90, freqEnd: 30, gain: 1.2 });
    this.tone(o, t + 0.1, 0.6, { type: 'sine', freq: 3200, freqEnd: 1200, gain: 0.08 });
  }

  // looping jet-wash hiss, positional
  washLoop() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 0.7;
    const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 5000;
    const g = ctx.createGain(); g.gain.value = 0;
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    src.connect(f); f.connect(f2); f2.connect(g);
    if (p) { g.connect(p); p.connect(this.master); } else g.connect(this.master);
    src.start();
    return {
      set: (pos, on) => {
        const s = this.spatial(pos);
        g.gain.setTargetAtTime(on ? 0.22 * s.gain : 0, ctx.currentTime, 0.15);
        if (p) p.pan.setTargetAtTime(s.pan, ctx.currentTime, 0.1);
      },
    };
  }

  tyrePop(pos) {
    if (!this.ctx) return;
    const s = this.spatial(pos), t = this.ctx.currentTime + s.dist / 343, o = this.out(s.pan, 0.5);
    const g = Math.min(1, s.gain * 2.5);
    this.noiseBurst(o, t, 0.08, { type: 'lowpass', freq: 2500, gain: 1.0 * g });
    this.noiseBurst(o, t + 0.05, 1.4, { type: 'highpass', freq: 3500, gain: 0.25 * g, attack: 0.05, curve: 2 });
  }
}
