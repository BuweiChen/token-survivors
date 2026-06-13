// audio.js -- procedural WebAudio. No files, just vibes.
// SFX are one-shot synth blips. Music is a scheduled engine with two tracks:
// 'run' = phonk (808s, claps, cowbell lead with delay/slides/accents),
// 'menu' = slow moody lo-fi (pads, sparse arp, vinyl crackle).
'use strict';

const SFX = (() => {
  // NOTE: do NOT use DynamicsCompressorNode as the output stage -- Chrome
  // applies automatic makeup gain inside it, which silently undoes master
  // volume changes. We drive a tanh soft-clipper instead: loud, safe, and
  // the saturation suits phonk anyway.
  const VOL = 1.3; // master drive into the clipper
  let ctx = null, master = null, musicGain = null, melodyBus = null;
  let muted = E.store.get('ts_mute') === '1';
  let userPaused = false; // game pause: suspend the clock, don't auto-resume
  let lastShot = 0;

  function init() {
    if (ctx) {
      if (ctx.state === 'suspended' && !userPaused) ctx.resume();
      return;
    }
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
      // melody rides its own bus, hot, with a feedback delay for soul
      melodyBus = ctx.createGain();
      melodyBus.gain.value = 1.5;
      melodyBus.connect(musicGain);
      const dly = ctx.createDelay(1);
      dly.delayTime.value = (60 / 142 / 4) * 3; // dotted-8th-ish echo
      const fb = ctx.createGain(); fb.gain.value = 0.35;
      const wet = ctx.createGain(); wet.gain.value = 0.3;
      melodyBus.connect(dly); dly.connect(fb); fb.connect(dly);
      dly.connect(wet); wet.connect(musicGain);
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

  // ============================ MUSIC ENGINE ============================
  const RUN_STEP = 60 / 142 / 4;   // phonk, 142 BPM 16ths
  const MENU_STEP = 60 / 84 / 4;   // lo-fi, 84 BPM 16ths
  const LOOP = 64;                 // 4 bars
  let schedTimer = null, nextT = 0, step = 0, loopCount = 0;
  let musicKind = null, stepDur = RUN_STEP;

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
      for (let i = 0; i < 256; i++) _dist[i] = Math.tanh(((i / 128) - 1) * 3);
    }
    return _dist;
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

  function kick(t, vol = 1.4) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(165, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.connect(g); g.connect(musicGain);
    o.start(t); o.stop(t + 0.32);
    if (vol > 1) nz(t, 0.03, 0.4, 3000, 'highpass'); // click
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
    g.gain.setValueAtTime(0.5, t);
    g.gain.setValueAtTime(0.5, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(sh); sh.connect(lp); lp.connect(g); g.connect(musicGain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // the lead voice. cowbell-ish timbre but treated like a singer:
  // portamento from the previous note, vibrato, velocity, delay echo.
  function lead(t, note, vol = 1.0, slideFrom = 0) {
    const f0 = midi(note);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f0 * 2.2; bp.Q.value = 1.1;
    bp.connect(g); g.connect(melodyBus);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.5;
    const lfoG = ctx.createGain(); lfoG.gain.value = f0 * 0.012;
    lfo.connect(lfoG);
    for (const mul of [1, 1.5]) {
      const o = ctx.createOscillator(); o.type = 'square';
      if (slideFrom) {
        o.frequency.setValueAtTime(midi(slideFrom) * mul, t);
        o.frequency.exponentialRampToValueAtTime(f0 * mul, t + 0.07);
      } else {
        o.frequency.setValueAtTime(f0 * mul, t);
      }
      lfoG.connect(o.frequency);
      o.connect(bp);
      o.start(t); o.stop(t + 0.36);
    }
    lfo.start(t); lfo.stop(t + 0.36);
  }

  // ---------------- RUN TRACK: phonk in C minor ----------------
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
  let lastMelNote = 0;

  function scheduleRun(s, t) {
    const bar = (s / 16) | 0, st = s % 16;
    if (st === 0 || st === 7 || st === 10) kick(t);
    if (st === 4 || st === 12) clap(t);
    if (st % 2 === 0) hat(t, 0.035, 0.25);
    if (st === 14) hat(t, 0.09, 0.18);
    if (bar === 3 && st === 15) { hat(t, 0.03, 0.2); hat(t + stepDur / 2, 0.03, 0.2); }
    const b = BASS_RIFFS[loopCount % 2][st];
    if (b >= 0) bass808(t, b, stepDur * 2.4);
    // lead melody on all bars; lines rotate + re-pair every loop
    const half = bar < 2 ? 0 : 1;
    const line = MELODIES[(loopCount * 2 + half) % MELODIES.length];
    if (st % 2 === 0) {
      const m = line[(bar % 2) * 8 + st / 2];
      if (m > 0) {
        const accent = st % 8 === 0 ? 1.3 : st % 4 === 0 ? 1.05 : 0.85;
        const swing = st % 4 === 2 ? stepDur * 0.16 : 0;       // lazy off-8ths
        const human = (Math.random() - 0.5) * 0.012;           // not a robot
        const slide = lastMelNote && Math.abs(m - lastMelNote) <= 5 && Math.random() < 0.5 ? lastMelNote : 0;
        lead(t + swing + human, m, accent, slide);
        lastMelNote = m;
        if (st % 8 === 0) lead(t + stepDur * 0.75, m + 12, 0.45);
      }
    } else if (Math.random() < 0.12) {
      const m = line[(bar % 2) * 8 + ((st - 1) / 2)];
      if (m > 0) lead(t, m - 12, 0.35);
    }
  }

  // ---------------- MENU TRACK: slow lo-fi in C minor ----------------
  const MENU_CHORDS = [
    [48, 55, 58, 63, 67],  // Cm9
    [44, 51, 56, 60, 63],  // Abmaj7
    [46, 53, 58, 62, 65],  // Bb9-ish
    [43, 50, 55, 58, 62],  // Gm7(add4)
  ];
  const MENU_ARP = [72, 75, 79, 75, 70, 75, 72, 67];

  function pad(t, notes, dur) {
    for (const n of notes) {
      const o = ctx.createOscillator(); o.type = 'triangle';
      o.frequency.value = midi(n);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.10, t + dur * 0.25);
      g.gain.setValueAtTime(0.10, t + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(musicGain);
      o.start(t); o.stop(t + dur + 0.05);
    }
  }

  function scheduleMenu(s, t) {
    const bar = (s / 16) | 0, st = s % 16;
    const chord = MENU_CHORDS[bar];
    if (st === 0) {
      pad(t, chord, 16 * stepDur);
      kick(t, 0.6);
    }
    if (st === 8) kick(t, 0.45);
    if (st === 4 || st === 12) hat(t, 0.05, 0.10);
    // sparse sine arp through the melody delay (dreamy)
    if (st % 2 === 0 && Math.random() < 0.7) {
      const n = MENU_ARP[(bar * 8 + st / 2) % MENU_ARP.length] + (Math.random() < 0.15 ? 12 : 0);
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.value = midi(n);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      o.connect(g); g.connect(melodyBus);
      o.start(t); o.stop(t + 0.55);
    }
    // vinyl crackle
    if (Math.random() < 0.25) nz(t + Math.random() * stepDur, 0.015, 0.06, 4000, 'highpass');
  }

  // ---------------- scheduler ----------------
  function startMusic(kind = 'run') {
    if (!ctx) return;
    if (musicKind === kind && schedTimer) return;
    stopMusic();
    musicKind = kind;
    stepDur = kind === 'menu' ? MENU_STEP : RUN_STEP;
    nextT = ctx.currentTime + 0.06;
    step = 0; loopCount = 0; lastMelNote = 0;
    schedTimer = setInterval(() => {
      if (!ctx) return;
      while (nextT < ctx.currentTime + 0.12) {
        if (!muted) (musicKind === 'menu' ? scheduleMenu : scheduleRun)(step, nextT);
        nextT += stepDur;
        step = (step + 1) % LOOP;
        if (step === 0) loopCount++;
      }
    }, 30);
  }
  function stopMusic() {
    if (schedTimer) { clearInterval(schedTimer); schedTimer = null; }
    musicKind = null;
  }

  // game pause: freeze the whole audio clock (music + echoes resume exactly)
  function pauseAll() {
    userPaused = true;
    if (ctx && ctx.state === 'running') ctx.suspend();
  }
  function resumeAll() {
    userPaused = false;
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function play(name) { if (!ctx || muted) return; (fx[name] || (() => {}))(); }
  function toggleMute() {
    muted = !muted;
    E.store.set('ts_mute', muted ? '1' : '0');
    if (master) master.gain.value = muted ? 0 : VOL;
    return muted;
  }

  return { init, play, toggleMute, get muted() { return muted; }, startMusic, stopMusic, pauseAll, resumeAll };
})();
