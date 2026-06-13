// audio.js -- procedural WebAudio. No files, just vibes.
// SFX are one-shot synth blips. Music is a scheduled engine with two tracks:
// 'run' = generic bumpy EDM (four-on-the-floor, offbeat bass, one stab/bar),
// 'menu' = slow moody lo-fi (pads, sparse arp, vinyl crackle).
'use strict';

const SFX = (() => {
  // NOTE: do NOT use DynamicsCompressorNode as the output stage -- Chrome
  // applies automatic makeup gain inside it, which silently undoes master
  // volume changes. We drive a tanh soft-clipper instead: loud, safe, and
  // the saturation suits phonk anyway.
  const VOL = 1.1; // master drive into the clipper
  let ctx = null, master = null, musicGain = null, melodyBus = null, dlyRef = null;
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
      for (let i = 0; i < 1024; i++) curve[i] = Math.tanh(((i / 511.5) - 1) * 1.5);
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
      melodyBus.gain.value = 0.8;
      melodyBus.connect(musicGain);
      dlyRef = ctx.createDelay(1);
      const dly = dlyRef;
      dly.delayTime.value = (60 / 126 / 4) * 3; // dotted-8th-ish echo
      const fb = ctx.createGain(); fb.gain.value = 0.25;
      const wet = ctx.createGain(); wet.gain.value = 0.18;
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
    zap() { tone(1400 + Math.random() * 400, 0.05, 'sawtooth', 0.16, -700); noise(0.03, 0.08, 5000); },
    explode() { noise(0.35, 0.55, 700); tone(80, 0.3, 'sine', 0.6, -40); },
    death() { tone(440, 0.9, 'sawtooth', 0.55, -400); noise(0.6, 0.4, 400); },
    win() { [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.22, 'square', 0.35, 0, i * 0.13)); },
  };

  // ============================ MUSIC ENGINE ============================
  const RUN_STEP = 60 / 126 / 4;   // EDM, 126 BPM 16ths
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

  function kick(t, vol = 1.0) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(165, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.connect(g); g.connect(musicGain);
    o.start(t); o.stop(t + 0.32);
    if (vol >= 1) nz(t, 0.03, 0.28, 3000, 'highpass'); // click
  }

  function clap(t) {
    nz(t, 0.04, 0.45, 1700, 'bandpass');
    nz(t + 0.02, 0.05, 0.4, 1500, 'bandpass');
    nz(t + 0.045, 0.22, 0.4, 1800, 'bandpass');
  }

  const hat = (t, dur, vol) => nz(t, dur, vol, 7500, 'highpass');

  // the lead voice: a warm synth pluck, not a pipe. triangle fundamental
  // + quiet sine an octave up, through a lowpass. NO fifth partial -- a
  // square at 1.5x f0 is how you get "metal pipe falling down stairs".
  // portamento from the previous note, late-onset vibrato, velocity.
  function lead(t, note, vol = 1.0, slideFrom = 0) {
    const f0 = midi(note);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015); // soft attack, no click
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = f0 * 3.2; lp.Q.value = 0.7;
    lp.connect(g); g.connect(melodyBus);
    // vibrato fades in after the attack, like a player would
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5;
    const lfoG = ctx.createGain();
    lfoG.gain.setValueAtTime(0, t);
    lfoG.gain.linearRampToValueAtTime(f0 * 0.006, t + 0.18);
    lfo.connect(lfoG);
    const voices = [['triangle', 1, 1], ['sine', 2, 0.25]];
    for (const [type, mul, vmix] of voices) {
      const o = ctx.createOscillator(); o.type = type;
      const og = ctx.createGain(); og.gain.value = vmix;
      if (slideFrom) {
        o.frequency.setValueAtTime(midi(slideFrom) * mul, t);
        o.frequency.exponentialRampToValueAtTime(f0 * mul, t + 0.05);
      } else {
        o.frequency.setValueAtTime(f0 * mul, t);
      }
      lfoG.connect(o.frequency);
      o.connect(og); og.connect(lp);
      o.start(t); o.stop(t + 0.65);
    }
    lfo.start(t); lfo.stop(t + 0.65);
  }

  // ---------------- RUN TRACK: generic bumpy EDM in A minor ----------------
  // four-on-the-floor kick, offbeat bass pulse (the bump), claps on 2 and 4,
  // one chord stab per bar, and a tiny motif every other loop. that's it.
  const PROG = [
    { bass: 33, chord: [57, 60, 64] },  // Am
    { bass: 29, chord: [53, 57, 60] },  // F
    { bass: 36, chord: [48, 52, 55] },  // C
    { bass: 31, chord: [55, 59, 62] },  // G
  ];
  // sparse pentatonic motif, bars 3-4 only: {bar: {step: note}}
  const MOTIF = { 2: { 0: 69, 6: 72 }, 3: { 0: 76, 6: 72, 12: 69 } };

  function bassPulse(t, note) {
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(midi(note), t);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 480;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.4, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(lp); lp.connect(g); g.connect(musicGain);
    o.start(t); o.stop(t + 0.24);
  }

  function stab(t, notes) {
    for (const n of notes) {
      const o = ctx.createOscillator(); o.type = 'triangle';
      o.frequency.value = midi(n);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(g); g.connect(melodyBus);
      o.start(t); o.stop(t + 0.34);
    }
  }

  function scheduleRun(s, t) {
    const bar = (s / 16) | 0, st = s % 16;
    const pg = PROG[bar];
    if (st % 4 === 0) kick(t, 1.0);
    if (st === 4 || st === 12) clap(t);
    if (st % 4 === 2) {
      hat(t, 0.07, 0.16);
      bassPulse(t, pg.bass);
    }
    if (st === 8) stab(t, pg.chord);
    if (loopCount % 2 === 0 && MOTIF[bar] && MOTIF[bar][st] !== undefined) {
      lead(t, MOTIF[bar][st], 0.32);
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
      g.gain.linearRampToValueAtTime(0.07, t + dur * 0.25);
      g.gain.setValueAtTime(0.07, t + dur * 0.7);
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
      kick(t, 0.45);
    }
    if (st === 8) kick(t, 0.32);
    if (st === 4 || st === 12) hat(t, 0.05, 0.07);
    // sparse sine arp through the melody delay (dreamy)
    if (st % 2 === 0 && Math.random() < 0.7) {
      const n = MENU_ARP[(bar * 8 + st / 2) % MENU_ARP.length] + (Math.random() < 0.15 ? 12 : 0);
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.value = midi(n);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.28, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      o.connect(g); g.connect(melodyBus);
      o.start(t); o.stop(t + 0.55);
    }
    // vinyl crackle
    if (Math.random() < 0.2) nz(t + Math.random() * stepDur, 0.015, 0.04, 4000, 'highpass');
  }

  // ---------------- scheduler ----------------
  function startMusic(kind = 'run') {
    if (!ctx) return;
    if (musicKind === kind && schedTimer) return;
    stopMusic();
    musicKind = kind;
    stepDur = kind === 'menu' ? MENU_STEP : RUN_STEP;
    if (dlyRef) dlyRef.delayTime.value = stepDur * 3;
    nextT = ctx.currentTime + 0.06;
    step = 0; loopCount = 0;
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
