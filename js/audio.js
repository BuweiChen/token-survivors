// audio.js -- procedural WebAudio. No files, just vibes.
// SFX are one-shot synth blips; music is a scheduled phonk loop (808 kicks
// with pitch drop, halftime claps, hat rolls, distorted sub riff, cowbell).
'use strict';

const SFX = (() => {
  const VOL = 0.65; // master level; a compressor downstream stops clipping
  let ctx = null, master = null, musicGain = null;
  let muted = E.store.get('ts_mute') === '1';
  let lastShot = 0;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 18; comp.ratio.value = 8;
      comp.attack.value = 0.003; comp.release.value = 0.2;
      comp.connect(ctx.destination);
      master = ctx.createGain();
      master.gain.value = muted ? 0 : VOL;
      master.connect(comp);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.5;
      musicGain.connect(master);
    } catch (e) { /* no audio, no problem */ }
  }

  function tone(freq, dur, type = 'square', vol = 0.5, slide = 0, delay = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol = 0.4, freq = 1000) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf();
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  const fx = {
    shot() { const n = performance.now(); if (n - lastShot < 70) return; lastShot = n; tone(620 + Math.random() * 120, 0.06, 'square', 0.12, -300); },
    hit() { noise(0.05, 0.10, 2200); },
    hurt() { tone(160, 0.18, 'sawtooth', 0.4, -80); noise(0.12, 0.2, 600); },
    pickup() { tone(880, 0.07, 'square', 0.15, 240); },
    coin() { tone(1175, 0.05, 'square', 0.12); tone(1568, 0.09, 'square', 0.12, 0, 0.05); },
    levelup() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 'square', 0.25, 0, i * 0.07)); },
    chest() { [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.14, 'triangle', 0.3, 0, i * 0.08)); },
    evolve() { [262, 330, 392, 523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.2, 'sawtooth', 0.18, 0, i * 0.06)); noise(0.5, 0.12, 800); },
    boss() { tone(110, 0.5, 'sawtooth', 0.4, -30); tone(116, 0.5, 'sawtooth', 0.4, -30); },
    elite() { tone(220, 0.18, 'sawtooth', 0.25, -40); tone(233, 0.18, 'sawtooth', 0.25, -40, 0.12); },
    bestiary() { tone(660, 0.08, 'square', 0.18); tone(880, 0.1, 'square', 0.18, 0, 0.08); },
    explode() { noise(0.35, 0.4, 700); tone(80, 0.3, 'sine', 0.5, -40); },
    death() { tone(440, 0.9, 'sawtooth', 0.4, -400); noise(0.6, 0.3, 400); },
    win() { [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.22, 'square', 0.25, 0, i * 0.13)); },
  };

  // ============================ PHONK ENGINE ============================
  const BPM = 142;
  const STEP = 60 / BPM / 4;       // 16th notes
  const LOOP = 64;                 // 4 bars
  let schedTimer = null, nextT = 0, step = 0;

  const midi = n => 440 * Math.pow(2, (n - 69) / 12);

  let _noiseBuf = null;
  function noiseBuf() {
    if (!_noiseBuf) {
      _noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = _noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return _noiseBuf;
  }

  let _dist = null;
  function distCurve() {
    if (!_dist) {
      _dist = new Float32Array(256);
      for (let i = 0; i < 256; i++) {
        const x = (i / 128) - 1;
        _dist[i] = Math.tanh(x * 3);
      }
    }
    return _dist;
  }

  function kick(t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(165, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(1.1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.connect(g); g.connect(musicGain);
    o.start(t); o.stop(t + 0.32);
    nz(t, 0.03, 0.3, 3000, 'highpass'); // click
  }

  function nz(t, dur, vol, freq, type) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf();
    src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(musicGain);
    src.start(t); src.stop(t + dur + 0.02);
  }

  function clap(t) {
    nz(t, 0.04, 0.45, 1700, 'bandpass');
    nz(t + 0.02, 0.05, 0.4, 1500, 'bandpass');
    nz(t + 0.045, 0.22, 0.4, 1800, 'bandpass');
  }

  const hat = (t, dur, vol) => nz(t, dur, vol, 7500, 'highpass');

  function bass808(t, note, dur) {
    const o = ctx.createOscillator(); o.type = 'square';
    o.frequency.setValueAtTime(midi(note), t);
    const sh = ctx.createWaveShaper(); sh.curve = distCurve();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.setValueAtTime(0.5, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(sh); sh.connect(lp); lp.connect(g); g.connect(musicGain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // the phonk cowbell: two detuned squares through a tight bandpass
  function cowbell(t, note, vol = 0.26) {
    const f0 = midi(note);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.20);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f0 * 2.4; bp.Q.value = 2.5;
    bp.connect(g); g.connect(musicGain);
    for (const mul of [1, 1.5]) {
      const o = ctx.createOscillator(); o.type = 'square';
      o.frequency.value = f0 * mul;
      o.connect(bp);
      o.start(t); o.stop(t + 0.22);
    }
  }

  // C minor. sub riff repeats per bar; cowbell melody rides bars 3-4.
  const BASS_RIFF = [36, -1, -1, -1, -1, -1, 39, -1, 31, -1, -1, -1, 34, -1, 38, -1];
  const MELODY = [63, 63, 67, 63, 60, 58, 63, 60, 67, 65, 63, 58, 60, 63, 58, 55]; // 8ths, 2 bars

  function scheduleStep(s, t) {
    const bar = (s / 16) | 0, st = s % 16;
    if (st === 0 || st === 7 || st === 10) kick(t);
    if (st === 4 || st === 12) clap(t);
    if (st % 2 === 0) hat(t, 0.035, 0.16);
    if (st === 14) hat(t, 0.09, 0.12); // open-ish
    if (bar === 3 && st === 15) { hat(t, 0.03, 0.14); hat(t + STEP / 2, 0.03, 0.14); } // roll into loop
    const b = BASS_RIFF[st];
    if (b >= 0) bass808(t, b, STEP * 2.4);
    if (bar >= 2 && st % 2 === 0) {
      const m = MELODY[(bar - 2) * 8 + st / 2];
      if (m > 0) cowbell(t, m);
    }
  }

  function startMusic() {
    if (schedTimer || !ctx) return;
    nextT = ctx.currentTime + 0.06;
    step = 0;
    schedTimer = setInterval(() => {
      if (!ctx) return;
      while (nextT < ctx.currentTime + 0.12) {
        if (!muted) scheduleStep(step, nextT);
        nextT += STEP;
        step = (step + 1) % LOOP;
      }
    }, 30);
  }
  function stopMusic() {
    if (schedTimer) { clearInterval(schedTimer); schedTimer = null; }
  }

  function play(name) { if (!ctx || muted) return; (fx[name] || (() => {}))(); }
  function toggleMute() {
    muted = !muted;
    E.store.set('ts_mute', muted ? '1' : '0');
    if (master) master.gain.value = muted ? 0 : VOL;
    return muted;
  }

  return { init, play, toggleMute, get muted() { return muted; }, startMusic, stopMusic };
})();
