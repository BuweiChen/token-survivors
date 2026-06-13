// audio.js -- procedural WebAudio. No files, just vibes.
// SFX are one-shot synth blips; music is a scheduled phonk loop (808 kicks
// with pitch drop, halftime claps, hat rolls, distorted sub riff, cowbell).
'use strict';

const SFX = (() => {
  // NOTE: do NOT use DynamicsCompressorNode as the output stage -- Chrome
  // applies automatic makeup gain inside it, which silently undoes master
  // volume changes. We drive a tanh soft-clipper instead: loud, safe, and
  // the saturation suits phonk anyway.
  const VOL = 1.3; // master drive into the clipper
  let ctx = null, master = null, musicGain = null;
  let muted = E.store.get('ts_mute') === '1';
  let lastShot = 0;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const clip = ctx.createWaveShaper();
      const curve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) curve[i] = Math.tanh(((i / 511.5) - 1) * 2.2);
      clip.curve = curve;
      clip.oversample = '2x';
      clip.connect(ctx.destination);
      master = ctx.createGain();
      master.gain.value = muted ? 0 : VOL;
      master.connect(clip);
      musicGain = ctx.createGain();
      musicGain.gain.value = 1.0;
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
    shot() { const n = performance.now(); if (n - lastShot < 70) return; lastShot = n; tone(620 + Math.random() * 120, 0.06, 'square', 0.18, -300); },
    hit() { noise(0.05, 0.15, 2200); },
    hurt() { tone(160, 0.18, 'sawtooth', 0.55, -80); noise(0.12, 0.3, 600); },
    pickup() { tone(880, 0.07, 'square', 0.22, 240); },
    coin() { tone(1175, 0.05, 'square', 0.18); tone(1568, 0.09, 'square', 0.18, 0, 0.05); },
    levelup() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 'square', 0.35, 0, i * 0.07)); },
    chest() { [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.14, 'triangle', 0.42, 0, i * 0.08)); },
    evolve() { [262, 330, 392, 523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.2, 'sawtooth', 0.28, 0, i * 0.06)); noise(0.5, 0.18, 800); },
    boss() { tone(110, 0.5, 'sawtooth', 0.55, -30); tone(116, 0.5, 'sawtooth', 0.55, -30); },
    elite() { tone(220, 0.18, 'sawtooth', 0.35, -40); tone(233, 0.18, 'sawtooth', 0.35, -40, 0.12); },
    bestiary() { tone(660, 0.08, 'square', 0.25); tone(880, 0.1, 'square', 0.25, 0, 0.08); },
    explode() { noise(0.35, 0.55, 700); tone(80, 0.3, 'sine', 0.6, -40); },
    death() { tone(440, 0.9, 'sawtooth', 0.55, -400); noise(0.6, 0.4, 400); },
    win() { [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.22, 'square', 0.35, 0, i * 0.13)); },
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
    g.gain.setValueAtTime(1.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.connect(g); g.connect(musicGain);
    o.start(t); o.stop(t + 0.32);
    nz(t, 0.03, 0.4, 3000, 'highpass'); // click
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
    nz(t, 0.04, 0.6, 1700, 'bandpass');
    nz(t + 0.02, 0.05, 0.55, 1500, 'bandpass');
    nz(t + 0.045, 0.22, 0.55, 1800, 'bandpass');
  }

  const hat = (t, dur, vol) => nz(t, dur, vol, 7500, 'highpass');

  function bass808(t, note, dur) {
    const o = ctx.createOscillator(); o.type = 'square';
    o.frequency.setValueAtTime(midi(note), t);
    const sh = ctx.createWaveShaper(); sh.curve = distCurve();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.55, t);
    g.gain.setValueAtTime(0.55, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(sh); sh.connect(lp); lp.connect(g); g.connect(musicGain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // the phonk cowbell: two detuned squares through a wide-ish bandpass.
  // Q kept low -- a tight band guts the level and buries it under the 808.
  function cowbell(t, note, vol = 0.9) {
    const f0 = midi(note);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f0 * 2.2; bp.Q.value = 1.2;
    bp.connect(g); g.connect(musicGain);
    for (const mul of [1, 1.5]) {
      const o = ctx.createOscillator(); o.type = 'square';
      o.frequency.value = f0 * mul;
      o.connect(bp);
      o.start(t); o.stop(t + 0.24);
    }
  }

  // C minor. two alternating sub riffs; four cowbell lines (16 8th-notes =
  // 2 bars each, 0 = rest) that rotate and re-pair every loop so no two
  // consecutive loops play the same 4 bars.
  const BASS_RIFFS = [
    [36, -1, -1, -1, -1, -1, 39, -1, 31, -1, -1, -1, 34, -1, 38, -1],
    [36, -1, -1, 36, -1, -1, 39, -1, 31, -1, 31, -1, 34, -1, 41, -1],
  ];
  const MELODIES = [
    [63, 63, 67, 63, 60, 58, 63, 60, 67, 65, 63, 58, 60, 63, 58, 55], // the OG line
    [70, 67, 65, 63, 65, 63, 60, 58, 63, 65, 67, 70, 72, 70, 67, 65], // high answer
    [60, 0, 63, 0, 58, 0, 55, 0, 60, 0, 63, 65, 63, 0, 58, 0],        // sparse + dark
    [60, 63, 67, 72, 70, 67, 63, 60, 58, 62, 65, 70, 67, 63, 60, 55], // arp run
  ];
  let loopCount = 0;

  function scheduleStep(s, t) {
    const bar = (s / 16) | 0, st = s % 16;
    if (st === 0 || st === 7 || st === 10) kick(t);
    if (st === 4 || st === 12) clap(t);
    if (st % 2 === 0) hat(t, 0.035, 0.25);
    if (st === 14) hat(t, 0.09, 0.18); // open-ish
    if (bar === 3 && st === 15) { hat(t, 0.03, 0.2); hat(t + STEP / 2, 0.03, 0.2); } // roll into loop
    const b = BASS_RIFFS[loopCount % 2][st];
    if (b >= 0) bass808(t, b, STEP * 2.4);
    // melody rides ALL bars: two 2-bar lines per loop, rotating pairing
    const half = bar < 2 ? 0 : 1;
    const line = MELODIES[(loopCount * 2 + half) % MELODIES.length];
    if (st % 2 === 0) {
      const m = line[(bar % 2) * 8 + st / 2];
      if (m > 0) {
        cowbell(t, m);
        // octave echo on downbeats for width
        if (st % 8 === 0) cowbell(t + STEP * 0.75, m + 12, 0.4);
      }
    } else if (Math.random() < 0.12) {
      // ghost notes on off-16ths: never the same loop twice
      const m = line[(bar % 2) * 8 + ((st - 1) / 2)];
      if (m > 0) cowbell(t, m - 12, 0.3);
    }
  }

  function startMusic() {
    if (schedTimer || !ctx) return;
    nextT = ctx.currentTime + 0.06;
    step = 0;
    loopCount = 0;
    schedTimer = setInterval(() => {
      if (!ctx) return;
      while (nextT < ctx.currentTime + 0.12) {
        if (!muted) scheduleStep(step, nextT);
        nextT += STEP;
        step = (step + 1) % LOOP;
        if (step === 0) loopCount++;
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
