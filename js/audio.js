// audio.js -- procedural WebAudio. No files, just vibes.
'use strict';

const SFX = (() => {
  let ctx = null, master = null, musicGain = null;
  let muted = E.store.get('ts_mute') === '1';
  let lastShot = 0;
  let musicTimer = null, musicStep = 0;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.22;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.35;
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
    const len = Math.max(1, (dur * ctx.sampleRate) | 0);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start();
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

  // dumb little bass loop so the silence doesn't feel broken
  const BASSLINE = [110, 110, 0, 110, 131, 0, 98, 0, 110, 110, 0, 110, 147, 0, 131, 0];
  function musicTick() {
    if (!ctx || muted) return;
    const f = BASSLINE[musicStep % BASSLINE.length];
    musicStep++;
    if (f) {
      const t0 = ctx.currentTime;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.5, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.16);
      o.connect(g); g.connect(musicGain);
      o.start(t0); o.stop(t0 + 0.2);
      if (musicStep % 4 === 0) noise(0.03, 0.05, 5000);
    }
  }
  function startMusic() {
    if (musicTimer) return;
    musicTimer = setInterval(musicTick, 140);
  }
  function stopMusic() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  }

  function play(name) { if (!ctx || muted) return; (fx[name] || (() => {}))(); }
  function toggleMute() {
    muted = !muted;
    E.store.set('ts_mute', muted ? '1' : '0');
    if (master) master.gain.value = muted ? 0 : 0.22;
    return muted;
  }

  return { init, play, toggleMute, get muted() { return muted; }, startMusic, stopMusic };
})();
