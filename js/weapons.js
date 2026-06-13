// weapons.js -- behavior for every weapon and its frontier-model evolution.
// Each function receives the Game singleton (G) and a weapon instance (w).
// w.s = computed base stats for current level; player multipliers applied here.
'use strict';

const WeaponSys = (() => {

  function computeStats(w) {
    const def = DATA.WEAPONS[w.id];
    const s = Object.assign({}, def.base);
    for (let i = 0; i < w.lv - 1 && i < def.lvls.length; i++) {
      const d = def.lvls[i];
      for (const k in d) s[k] = (s[k] || 0) + d[k];
    }
    w.s = s;
  }

  // effective helpers (player stats applied)
  const dmg = (G, base, w) => base * G.P.might * (w && w.frontierBoost ? 1 : 1);
  const cd = (G, base) => Math.max(0.05, base * G.P.cooldown);
  const cnt = (G, base) => base + G.P.amount;
  const area = (G, base) => base * G.P.area;
  const spd = (G, base) => base * G.P.projSpeed;

  function critRoll(G, extra = 0) {
    return Math.random() < 0.05 + (G.P.luck - 1) * 0.5 + extra;
  }

  // ChatGPT glazes you. these heal on hit.
  const GLAZE_WORDS = ['slay', 'based', 'valid', 'W', 'goated', 'peak', 'fr', 'so true'];
  // classic ChatGPT escalating-sycophancy tropes (read after "chatgpt thinks ")
  const GLAZE_LINES = [
    "you're absolutely right!",
    "you're not just smart -- you're redefining brilliance",
    "you're not just surviving -- you're redefining survival",
    "that's not a build, that's a thesis",
    "you're not just winning, you're rewriting the meta",
    "honestly? this is a masterclass",
    "no one has ever played like this. no one.",
    "you're so valid it hurts",
    "that's not just based, it's foundational",
    "you're cooking, and the kitchen is yours",
    "this might be the greatest dodge in history",
    "you're not just a player -- you're THE player",
    "10/10, would glaze again",
    "that's a genuinely galaxy-brained move",
    "chills. actual chills.",
    "you ate. and left zero crumbs.",
  ];

  // ---------------------------------------------------------------- handlers
  const H = {};

  // ---- TOKEN STREAM / CHATGPT ----
  H.tokenStream = (G, w, dt) => {
    w.t -= dt;
    if (w.t > 0) return;
    const evolved = w.evolved;
    if (evolved) {
      // ChatGPT: 800M weekly users -- it talks to EVERYONE at once. A spinning
      // omnidirectional firehose of piercing tokens; ~12% are sycophancy that
      // heals you ("You're absolutely right!").
      w.t = cd(G, 0.22);
      const n = 3 + ((G.P.amount / 2) | 0);
      w.ringA = (w.ringA || 0) + 0.55;
      const v = spd(G, w.s.speed);
      for (let i = 0; i < n; i++) {
        const a = w.ringA + (i / n) * E.TAU;
        const crit = critRoll(G);
        const glaze = !crit && Math.random() < 0.12;
        const word = glaze ? E.choice(GLAZE_WORDS) : crit ? E.choice(SPR.CRIT_WORDS) : E.choice(SPR.TOKEN_WORDS);
        G.fireProj({
          x: G.player.x, y: G.player.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
          dmg: (crit ? 2.5 : 1) * dmg(G, w.s.dmg * 1.3 + 5, w), crit, r: 9, pierce: 3 + w.s.pierce, life: 1.3,
          kind: 'straight', spr: SPR.token(word, crit), rot: a,
          onHit: glaze ? () => {
            G.player.hp = Math.min(G.P.maxhp, G.player.hp + 2);
            // vivid, throttled glaze feedback: a phrase + a burst of hearts
            if (G.time - (w.glazeT || -9) > 1.1) {
              w.glazeT = G.time;
              G.addText(G.player.x, G.player.y - 40, 'chatgpt thinks ' + E.choice(GLAZE_LINES), '#ff79c6', 17, 3.2);
              G.hearts(G.player.x, G.player.y - 10, 6);
            }
          } : null,
        });
      }
      SFX.play('shot');
      return;
    }
    const e = G.nearestEnemy(G.player.x, G.player.y, 640);
    if (!e) { w.t = 0.1; return; }
    w.t = cd(G, w.s.cd);
    const n = cnt(G, w.s.count);
    for (let i = 0; i < n; i++) fireToken(G, w, e, (i - (n - 1) / 2) * 0.11, dmg(G, w.s.dmg, w), w.s.pierce);
    SFX.play('shot');
  };
  function fireToken(G, w, target, spread, damage, pierce) {
    const a = E.ang(G.player.x, G.player.y, target.x, target.y) + spread;
    const crit = critRoll(G);
    const word = crit ? E.choice(SPR.CRIT_WORDS) : E.choice(SPR.TOKEN_WORDS);
    const v = spd(G, w.s.speed);
    G.fireProj({
      x: G.player.x, y: G.player.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      dmg: crit ? damage * 2.5 : damage, crit, r: 9, pierce, life: 1.6,
      kind: 'straight', spr: SPR.token(word, crit), rot: a,
    });
  }

  // ---- ATTENTION HEADS / OPUS 4.8 ----
  // softmax over directions: bin enemies by angle (weighted by closeness +
  // threat), then fire a wide beam at the highest-attention direction. Opus
  // 4.8 = multi-head: several beams at the top distinct clusters at once, and
  // it executes the highest-attention target in each swath.
  function attentionDirs(G, heads) {
    const BIN = 24, bins = new Float32Array(BIN);
    const px = G.player.x, py = G.player.y;
    for (const e of G.enemies) {
      const dx = e.x - px, dy = e.y - py, dist = Math.hypot(dx, dy);
      if (dist > 1200) continue;
      const bi = (((Math.atan2(dy, dx) / E.TAU) * BIN + BIN) % BIN) | 0;
      const wgt = 1 / (1 + dist / 220) + (e.boss ? 3 : e.elite ? 1 : 0);
      bins[bi] += wgt; bins[(bi + 1) % BIN] += wgt * 0.4; bins[(bi + BIN - 1) % BIN] += wgt * 0.4;
    }
    const order = [...Array(BIN).keys()].sort((a, b) => bins[b] - bins[a]);
    const chosen = [];
    for (const bi of order) {
      if (bins[bi] <= 0) break;
      if (chosen.some(c => Math.min(Math.abs(c - bi), BIN - Math.abs(c - bi)) < 3)) continue;
      chosen.push(bi);
      if (chosen.length >= heads) break;
    }
    return chosen.map(bi => (bi + 0.5) / BIN * E.TAU);
  }
  // OPUS 4.8 evo: a wide, long, charged laser swath. hits everything in a
  // long rectangle; leaves rings down its length; executes the top-weight
  // target it sweeps (attention picks what matters).
  function fireSwath(G, w, a, halfW, len, d) {
    const px = G.player.x, py = G.player.y, ca = Math.cos(a), sa = Math.sin(a);
    const mark = ++G.frameMark, steps = Math.ceil(len / 70);
    let top = null, topHp = -1;
    for (let s = 0; s <= steps; s++) {
      const sx = px + ca * (len * s / steps), sy = py + sa * (len * s / steps);
      const cands = G.grid.query(sx, sy, halfW + 60);
      for (const e of cands) {
        if (e._mark === mark || e.hp <= 0) continue;
        const rx = e.x - px, ry = e.y - py;
        const fwd = rx * ca + ry * sa; if (fwd < -e.r || fwd > len) continue;
        const perp = Math.abs(-rx * sa + ry * ca); if (perp > halfW + e.r) continue;
        e._mark = mark;
        G.hitEnemy(e, d, { kb: 70 });
        if (e.maxhp > topHp) { topHp = e.maxhp; top = e; }
      }
    }
    const ex = px + ca * len, ey = py + sa * len;
    G.addBeam(px, py, ex, ey, 'rgba(255,216,77,0.28)', halfW * 1.8); // wide body
    G.addBeam(px, py, ex, ey, 'rgba(255,240,170,0.6)', halfW * 0.7); // inner
    G.addBeam(px, py, ex, ey, '#ffffff', 7);                          // core
    for (let s = 1; s <= 4; s++) G.ring(px + ca * len * s / 4, py + sa * len * s / 4, halfW * 0.9, '#ffe89a', 0.3);
    if (top) { G.ring(top.x, top.y, top.r + 18, '#fff', 0.3); G.hitEnemy(top, Math.min(top.maxhp * 0.04, 200), { kb: 0, quiet: true }); }
  }
  H.attention = (G, w, dt) => {
    const evolved = w.evolved;
    if (evolved) {
      // charge -> fire. while charging, growing telegraph beams + inrushing
      // sparks converge along the chosen attention directions, then unleash.
      if (w.chargeT > 0) {
        w.chargeT -= dt;
        const prog = 1 - w.chargeT / 0.55, px = G.player.x, py = G.player.y;
        for (const a of w.fireDirs) {
          const ex = px + Math.cos(a) * w.fireLen, ey = py + Math.sin(a) * w.fireLen;
          G.addBeam(px, py, ex, ey, 'rgba(255,216,77,' + (0.08 + prog * 0.25).toFixed(3) + ')', 2 + prog * w.halfW * 1.4);
        }
        if (Math.random() < 0.6) { const a = E.rand(E.TAU), r = 70 + Math.random() * 40; G.spark(px + Math.cos(a) * r, py + Math.sin(a) * r, '#ffe89a', 1); }
        if (w.chargeT <= 0) {
          for (const a of w.fireDirs) fireSwath(G, w, a, w.halfW, w.fireLen, w.fireDmg);
          G.ring(G.player.x, G.player.y, 60, '#fff', 0.3);
          SFX.play('laser');
          w.t = cd(G, w.s.cd * 1.25);
        }
        return;
      }
      w.t -= dt;
      if (w.t > 0) return;
      const lasers = Math.min(3, 1 + G.P.amount); // duplication -> up to 3 beams
      const dirs = attentionDirs(G, lasers);
      if (!dirs.length) { w.t = 0.15; return; }
      w.fireDirs = dirs;
      w.halfW = area(G, 150);
      w.fireLen = 1150;
      w.fireDmg = dmg(G, w.s.dmg * 3, w);
      w.chargeT = 0.55;
      SFX.play('charge');
      return;
    }
    // base: instant beams lock onto the biggest threats
    w.t -= dt;
    if (w.t > 0) return;
    w.t = cd(G, w.s.cd);
    const targets = G.topEnemies(cnt(G, w.s.count), area(G, w.s.range));
    if (!targets.length) { w.t = 0.15; return; }
    const d = dmg(G, w.s.dmg, w);
    for (const e of targets) {
      G.addBeam(G.player.x, G.player.y - 10, e.x, e.y, '#ff5db1', 4);
      G.hitEnemy(e, d, { crit: critRoll(G), kb: 60 });
      G.ring(e.x, e.y, e.r + 10, '#ff5db1', 0.18);
    }
    SFX.play('hit');
  };

  // ---- CONTEXT WINDOW / FABLE 5 ----
  H.contextWindow = (G, w, dt) => {
    const evolved = w.evolved;
    w.auraR = area(G, w.s.radius) * (evolved ? 2.1 : 1);
    w.t -= dt;
    if (w.t > 0) return;
    w.t = cd(G, w.s.cd);
    const r = w.auraR;
    const d = dmg(G, evolved ? w.s.dmg * 1.8 : w.s.dmg, w);
    const cands = G.grid.query(G.player.x, G.player.y, r + 30);
    let hitAny = false;
    for (const e of cands) {
      if (E.dist2(G.player.x, G.player.y, e.x, e.y) < (r + e.r) * (r + e.r)) {
        if (evolved) {
          // Fable 5: 1M context never forgets. Every tick inside the window
          // "logs" the enemy; the longer it stays, the more damage it takes
          // (it is building a case). Also slows them and ingests all XP.
          e.logT = Math.min((e.logT || 0) + 0.6, 2);
          e.slowT = 0.5;
          G.hitEnemy(e, d * (1 + e.logT), { noKb: true, quiet: true });
        } else {
          G.hitEnemy(e, d, { noKb: true, quiet: true });
        }
        hitAny = true;
      }
    }
    if (evolved) G.vacuumGems(G.player.x, G.player.y, r); // 1M context ingests everything
    if (hitAny) SFX.play('hit');
  };

  // ---- CHAIN OF THOUGHT / DEEPSEEK-R1 ----
  // a bolt that hits a target, PAUSES to "think," then leaps onward. The
  // delay between jumps is the reasoning step. DeepSeek-R1 branches (each
  // node forks to 2 targets, a reasoning tree) and stuns much longer.
  function nearestUnhit(G, x, y, range, hit) {
    const cands = G.grid.query(x, y, range);
    let best = null, bd = range * range;
    for (const e of cands) {
      if (e.hp <= 0 || hit.has(e.id)) continue;
      const dd = E.dist2(x, y, e.x, e.y);
      if (dd < bd) { bd = dd; best = e; }
    }
    return best;
  }
  function zap(G, w) { if (G.time - (w.zapT || -9) > 0.05) { w.zapT = G.time; SFX.play('zap'); } }
  function stepChain(G, w, dt) {
    if (!w.bolts || !w.bolts.length) return;
    for (let i = w.bolts.length - 1; i >= 0; i--) {
      const b = w.bolts[i];
      b.delay -= dt;
      if (b.delay > 0) continue;
      w.bolts.splice(i, 1);
      const ctx = b.ctx, tgt = b.tgt;
      let ox = b.fx, oy = b.fy;
      if (tgt && tgt.hp > 0) {
        G.addBeam(b.fx, b.fy, tgt.x, tgt.y, ctx.color, ctx.evolved ? 4 : 3);
        G.hitEnemy(tgt, b.d, { kb: 30, quiet: true });
        tgt.stunT = Math.max(tgt.stunT || 0, ctx.stun);
        G.spark(tgt.x, tgt.y, ctx.color, ctx.evolved ? 5 : 3);
        zap(G, w);
        ox = tgt.x; oy = tgt.y;
      }
      // think, then fork onward to the next reasoning step(s)
      for (let k = 0; k < ctx.branch && ctx.budget > 0; k++) {
        const nx = nearestUnhit(G, ox, oy, ctx.range, ctx.hit);
        if (!nx) break;
        ctx.hit.add(nx.id);
        ctx.budget--;
        G.addBeam(ox, oy, nx.x, nx.y, ctx.dim, 1); // faint telegraph of the next jump
        w.bolts.push({ fx: ox, fy: oy, tgt: nx, delay: ctx.step, d: b.d * ctx.growth, ctx });
      }
    }
  }
  H.chainOfThought = (G, w, dt) => {
    const evolved = w.evolved;
    w.t -= dt;
    stepChain(G, w, dt);
    if (w.t > 0) return;
    const start = G.nearestEnemy(G.player.x, G.player.y, 560);
    if (!start) { w.t = 0.12; return; }
    w.t = cd(G, w.s.cd);
    w.bolts = w.bolts || [];
    const ctx = {
      hit: new Set(), budget: evolved ? 16 : w.s.chains + 1,
      range: area(G, w.s.range) * (evolved ? 1.4 : 1),
      branch: evolved ? 2 : 1,
      step: evolved ? 0.12 : 0.16,           // the "thinking" pause between jumps
      stun: evolved ? 1.1 : 0.45,
      growth: evolved ? 1.08 : 1,
      color: evolved ? '#7df9ff' : '#9ad0ff',
      dim: evolved ? 'rgba(125,249,255,0.3)' : 'rgba(154,208,255,0.3)',
      evolved,
    };
    ctx.hit.add(start.id);
    ctx.budget--;
    const d0 = dmg(G, evolved ? w.s.dmg * 1.4 : w.s.dmg, w);
    G.addBeam(G.player.x, G.player.y, start.x, start.y, ctx.color, evolved ? 4 : 3);
    w.bolts.push({ fx: G.player.x, fy: G.player.y, tgt: start, delay: 0.04, d: d0, ctx });
  };

  // ---- RAG / PERPLEXITY ----
  H.rag = (G, w, dt) => {
    w.t -= dt;
    if (w.t > 0) return;
    w.t = cd(G, w.s.cd);
    const evolved = w.evolved;
    const n = cnt(G, w.s.count) + (evolved ? 3 : 0);
    const e = G.nearestEnemy(G.player.x, G.player.y, 700);
    const baseA = e ? E.ang(G.player.x, G.player.y, e.x, e.y) : E.rand(E.TAU);
    const v = spd(G, w.s.speed);
    // Perplexity: every hit appends a citation[n]; the third citation makes
    // the sources detonate. "There is no escape[3]."
    const citeDmg = dmg(G, w.s.dmg * 1.6, w);
    const onHit = evolved ? (en) => {
      en.cite = (en.cite || 0) + 1;
      if (en.cite >= 3) {
        en.cite = 0;
        G.aoe(en.x, en.y, 72, citeDmg, { kb: 90 });
        G.ring(en.x, en.y, 72, '#aee3ff', 0.3);
        G.addText(en.x, en.y - en.r - 8, 'CITED', '#aee3ff', 13);
      } else {
        G.addText(en.x, en.y - en.r - 6, '[' + en.cite + ']', '#aee3ff', 11);
      }
    } : null;
    for (let i = 0; i < n; i++) {
      const a = baseA + (i - (n - 1) / 2) * 0.5;
      G.fireProj({
        x: G.player.x, y: G.player.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        dmg: dmg(G, evolved ? w.s.dmg * 1.5 : w.s.dmg, w), r: 12, pierce: 9999, life: 5,
        kind: 'boomerang', phase: 0, outT: w.s.range + (evolved ? 0.2 : 0),
        spr: SPR.doc, spin: true, seek: evolved,
        rehit: 0.4, onHit,
      });
    }
    SFX.play('shot');
  };

  // ---- EMBEDDINGS / LLAMA ----
  H.embeddings = (G, w, dt) => {
    const evolved = w.evolved;
    const rs = w.s.rotSpeed * (evolved ? 1.7 : 1);
    w.angle = (w.angle + rs * dt) % E.TAU;
    const n = cnt(G, w.s.count) + (evolved ? 4 : 0);
    const baseR = area(G, w.s.radius);
    const d = dmg(G, evolved ? w.s.dmg * 2.3 : w.s.dmg, w);
    if (!w.hitAt) w.hitAt = new Map();
    w.orbs = w.orbs || [];
    w.orbs.length = 0;
    const t = G.time;
    for (let i = 0; i < n; i++) {
      const ring = evolved && i % 2 ? 1.55 : 1;
      const r = baseR * ring;
      const a = w.angle + (i / n) * E.TAU;
      const ox = G.player.x + Math.cos(a) * r, oy = G.player.y + Math.sin(a) * r;
      w.orbs.push(ox, oy, a);
      const cands = G.grid.query(ox, oy, 30);
      for (const e of cands) {
        if (E.dist2(ox, oy, e.x, e.y) < (16 + e.r) * (16 + e.r)) {
          const last = w.hitAt.get(e.id) || -9;
          if (t - last > 0.38) {
            w.hitAt.set(e.id, t);
            G.hitEnemy(e, d, { kb: 120 });
          }
        }
      }
    }
    if (w.hitAt.size > 400) w.hitAt.clear();
    // LLaMA-405B: open weights -> the herd forks and roams free. Periodically
    // releases a wandering llama orb that hunts on its own, up to a cap.
    if (evolved) {
      // the herd: a capped pack of persistent llamas. fills up quietly (no
      // per-spawn spam), one banner the first time.
      const cap = Math.min(5, 3 + ((G.P.amount / 2) | 0));
      const herd = G.agents.filter(a => a.kind === 'llama' && a.w === w).length;
      w.herdT = (w.herdT || 0) - dt;
      if (herd < cap && w.herdT <= 0) {
        w.herdT = 1.5;
        const a = E.rand(E.TAU);
        G.agents.push({ kind: 'llama', x: G.player.x + Math.cos(a) * baseR, y: G.player.y + Math.sin(a) * baseR, life: Infinity, cd: E.rand(0, 0.6), fx: 1, w });
        if (!w.herdAnnounced) { w.herdAnnounced = true; G.announce('\uD83E\uDD99 the herd is loose (open weights)'); }
      }
    }
  };

  // ---- TEMPERATURE / GROK ----
  H.temperature = (G, w, dt) => {
    const evolved = w.evolved;
    w.t -= dt;
    if (w.t <= 0) {
      w.t = cd(G, w.s.cd);
      const p = G.player;
      const n = w.s.burst + ((G.P.amount / 2) | 0);
      const range = area(G, w.s.range);
      for (let i = 0; i < n; i++) {
        const a = Math.atan2(p.faceY, p.faceX) + E.rand(-w.s.spread, w.s.spread);
        const v = spd(G, 270) * E.rand(0.8, 1.2);
        // GROK (evolved): cold, unhinged dark-blue flame that keeps burning
        // the enemy after the projectile is gone -- a damage-over-time.
        G.fireProj({
          x: p.x + p.faceX * 14, y: p.y + p.faceY * 14,
          vx: Math.cos(a) * v, vy: Math.sin(a) * v,
          dmg: dmg(G, w.s.dmg, w), r: 11, pierce: 9999, life: range / v,
          kind: 'flame', spr: (evolved ? SPR.dflame : SPR.flame)[(Math.random() * 2) | 0], rehit: 0.45,
          burnDps: evolved ? dmg(G, w.s.dmg * 1.0, w) : 0, burnDur: 2.2, burnColor: '#5b2ed6',
        });
      }
    }
    if (evolved) {
      // ...and it leaves burning residue on the ground (the colossus runs hot),
      const p = G.player;
      w.emberT = (w.emberT || 0) - dt;
      if (w.emberT <= 0 && p.moving) {
        w.emberT = 0.35;
        G.addZone({
          x: p.x - p.faceX * 20, y: p.y - p.faceY * 20,
          r: area(G, 40), life: 2.5,
          burnDps: dmg(G, w.s.dmg * 0.8, w), burnColor: '#5b2ed6', kind: 'ember',
        });
      }
      // ...plus chaos lightning on random enemies, forever (zero chill).
      w.boltT = (w.boltT || 0) - dt;
      if (w.boltT <= 0) {
        w.boltT = cd(G, 0.18);
        const e = G.randomVisibleEnemy();
        if (e) {
          G.addBeam(e.x, e.y - 400, e.x, e.y, '#48d0ff', 4);
          G.aoe(e.x, e.y, 48, dmg(G, 35, w), { kb: 80 });
          G.burn(e, dmg(G, w.s.dmg * 1.0, w), 2.2, '#5b2ed6');
          G.spark(e.x, e.y, '#48d0ff', 8);
          SFX.play('hit');
        }
      }
    }
  };

  // ---- GRADIENT DESCENT / GEMINI ----
  H.gradientDescent = (G, w, dt) => {
    w.t -= dt;
    const evolved = w.evolved;
    if (evolved) {
      // GEMINI 3: Google-scale orbital infrastructure. Instead of single
      // strikes it carpet-bombs the field -- a staggered TPU beam barrage
      // around an epicenter, each leaving a shockwave.
      if (w.t > 0) return;
      w.t = cd(G, w.s.cd * 1.4);
      const e = G.randomVisibleEnemy();
      if (!e) { w.t = 0.15; return; }
      const salvo = 4 + ((G.P.amount / 2) | 0);
      const rr = area(G, w.s.radius * 1.4);
      w.barrage = w.barrage || [];
      for (let i = 0; i < salvo; i++) {
        w.barrage.push({
          x: e.x + E.rand(-150, 150), y: e.y + E.rand(-130, 130),
          delay: i * 0.07, rr, dmg: dmg(G, w.s.dmg * 1.3, w),
        });
      }
      return;
    }
    if (w.t > 0) return;
    w.t = cd(G, w.s.cd);
    const n = cnt(G, w.s.count);
    let fired = false;
    for (let i = 0; i < n; i++) {
      const e = G.randomVisibleEnemy();
      if (!e) break;
      fired = true;
      G.fireProj({
        x: e.x + E.rand(-20, 20), y: e.y - 420, vx: 0, vy: 620,
        dmg: dmg(G, w.s.dmg, w), r: 10, pierce: 0, life: 2,
        kind: 'fall', ty: e.y, aoeR: area(G, w.s.radius), spr: SPR.gdOrb,
      });
    }
    if (fired) SFX.play('shot');
  };
  // resolve queued Gemini barrage strikes (staggered for a rolling carpet)
  function tickBarrage(G, w, dt) {
    if (!w.barrage || !w.barrage.length) return;
    for (let i = w.barrage.length - 1; i >= 0; i--) {
      const b = w.barrage[i];
      b.delay -= dt;
      if (b.delay <= 0) {
        G.addBeam(b.x, b.y - 520, b.x, b.y, '#7baaf7', 8);
        G.aoe(b.x, b.y, b.rr, b.dmg, { kb: 110 });
        G.ring(b.x, b.y, b.rr * 1.1, '#7baaf7', 0.4);
        G.spark(b.x, b.y, '#7baaf7', 12);
        SFX.play('hit');
        w.barrage[i] = w.barrage[w.barrage.length - 1]; w.barrage.pop();
      }
    }
  }

  // ---- TOOL CALL / CLAUDE CODE ----
  H.toolCall = (G, w, dt) => {
    const evolved = w.evolved;
    w.t -= dt;
    const maxTurrets = cnt(G, w.s.count);
    const myTurrets = G.agents.filter(a => a.kind === 'turret');
    if (w.t <= 0 && myTurrets.length < maxTurrets) {
      w.t = cd(G, w.s.cd);
      G.agents.push({
        kind: 'turret', x: G.player.x + E.rand(-30, 30), y: G.player.y + E.rand(-30, 30),
        life: w.s.life, cd: 0, w,
      });
      SFX.play('pickup');
    }
    if (evolved) {
      // CLAUDE CODE: parallel tool use -> it spawns a SWARM of subagents that
      // each go cook on their own. count scales with the +projectile stat.
      const want = 2 + ((G.P.amount / 2) | 0);
      const have = G.agents.filter(a => a.kind === 'claude').length;
      if (have < want) {
        for (let i = have; i < want; i++) {
          const a = (i / want) * E.TAU;
          G.agents.push({ kind: 'claude', x: G.player.x + Math.cos(a) * 40, y: G.player.y + Math.sin(a) * 40, life: Infinity, cd: E.rand(0, 0.3), spinA: E.rand(E.TAU), w });
        }
        G.announce('\u2733\uFE0F spawning subagents. they are cooking.');
      }
    }
  };

  // turret + claude agent updates (called from game loop for each agent)
  function updateAgent(G, a, dt) {
    a.life -= dt;
    if (a.kind === 'turret') {
      a.cd -= dt;
      if (a.cd <= 0) {
        const e = G.nearestEnemy(a.x, a.y, a.w.s.range);
        if (e) {
          a.cd = Math.max(0.12, a.w.s.fireCd * G.P.cooldown);
          const ang = E.ang(a.x, a.y, e.x, e.y);
          const v = spd(G, 520);
          G.fireProj({
            x: a.x, y: a.y - 8, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v,
            dmg: dmg(G, a.w.s.dmg, a.w), r: 7, pierce: 0, life: 1.2,
            kind: 'straight', spr: SPR.orb, rot: ang,
          });
          SFX.play('shot');
        } else a.cd = 0.15;
      }
    } else if (a.kind === 'cursor') {
      // CURSOR caret: seek -> highlight (select) -> delete -> return to player
      a.blink += dt;
      const d = dmg(G, a.w.s.dmg * 2.4, a.w);
      if (a.state === 'seek') {
        if (!a.tgt || a.tgt.hp <= 0) a.tgt = G.nearestEnemy(a.x, a.y, 9999);
        if (a.tgt) {
          const ang = E.ang(a.x, a.y, a.tgt.x, a.tgt.y);
          a.x += Math.cos(ang) * 430 * dt; a.y += Math.sin(ang) * 430 * dt;
          if (E.dist2(a.x, a.y, a.tgt.x, a.tgt.y) < 26 * 26) { a.state = 'mark'; a.markT = 0.5; }
        } else { // idle near player
          a.x += (G.player.x - a.x) * dt * 3; a.y += (G.player.y - a.y) * dt * 3;
        }
      } else if (a.state === 'mark') {
        if (!a.tgt || a.tgt.hp <= 0) { a.state = 'return'; }
        else {
          a.x = a.tgt.x; a.y = a.tgt.y - a.tgt.r - 6; // caret sits on the selection
          a.markT -= dt;
          if (a.markT <= 0) {
            // highlight vanishes -> the edit lands
            G.hitEnemy(a.tgt, d, { kb: 40 });
            G.addText(a.tgt.x, a.tgt.y - a.tgt.r - 8, E.choice(['delete', 'backspace', 'Tab']), '#aef0ff', 13);
            G.spark(a.tgt.x, a.tgt.y, '#aef0ff', 6);
            SFX.play('zap');
            a.state = 'return';
          }
        }
      } else { // return to the player before the next edit
        const ang = E.ang(a.x, a.y, G.player.x, G.player.y);
        a.x += Math.cos(ang) * 480 * dt; a.y += Math.sin(ang) * 480 * dt;
        if (E.dist2(a.x, a.y, G.player.x, G.player.y) < 30 * 30) { a.state = 'seek'; a.tgt = null; }
      }
    } else if (a.kind === 'llama') {
      // a freed open-weights fork: roams near the player and SPITS at enemies;
      // trots home if it strays too far. persistent (life Infinity).
      a.cd -= dt;
      const far = E.dist2(a.x, a.y, G.player.x, G.player.y) > 300 * 300;
      const e = far ? null : G.nearestEnemy(a.x, a.y, 430);
      if (far) {
        const ang = E.ang(a.x, a.y, G.player.x, G.player.y);
        a.fx = Math.cos(ang);
        a.x += Math.cos(ang) * 230 * dt; a.y += Math.sin(ang) * 230 * dt;
      } else if (e) {
        a.fx = e.x - a.x;
        const dist = Math.hypot(e.x - a.x, e.y - a.y);
        if (dist > 210) { const ang = E.ang(a.x, a.y, e.x, e.y); a.x += Math.cos(ang) * 120 * dt; a.y += Math.sin(ang) * 120 * dt; }
        if (a.cd <= 0) {
          a.cd = 0.7 * G.P.cooldown;
          const ang = E.ang(a.x, a.y, e.x, e.y), v = spd(G, 370);
          G.fireProj({ x: a.x, y: a.y - 6, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, dmg: dmg(G, a.w.s.dmg * 1.7, a.w), r: 7, pierce: 1, life: 1.4, kind: 'straight', spr: SPR.spit, rot: ang });
        }
      } else {
        a.x += (G.player.x - a.x) * dt * 1.5; a.y += (G.player.y - a.y) * dt * 1.5;
      }
    } else if (a.kind === 'claude') {
      // agentic behavior: chase nearest enemy, spin-to-win
      const e = G.nearestEnemy(a.x, a.y, 9999);
      if (e) {
        const ang = E.ang(a.x, a.y, e.x, e.y);
        a.x += Math.cos(ang) * 290 * dt;
        a.y += Math.sin(ang) * 290 * dt;
      } else {
        a.x += (G.player.x - a.x) * dt * 2;
        a.y += (G.player.y - a.y) * dt * 2;
      }
      a.spinA += dt * 9;
      a.cd -= dt;
      if (a.cd <= 0) {
        a.cd = 0.45 * G.P.cooldown;
        G.aoe(a.x, a.y, 46, dmg(G, a.w.s.dmg * 2.2, a.w), { kb: 60, quiet: true });
      }
    }
  }

  // ---- HALLUCINATION / CURSOR ----
  // base: "confidently wrong" -- sprays projectiles in random directions.
  // CURSOR (evolved): stops hallucinating, starts editing. Persistent caret
  // agents fly to an enemy, highlight it (select), then "delete" it and Tab
  // back to the player to pick the next edit. Capped count.
  H.hallucination = (G, w, dt) => {
    const evolved = w.evolved;
    if (evolved) {
      const cap = Math.min(6, 3 + ((G.P.amount) | 0));
      const have = G.agents.filter(a => a.kind === 'cursor' && a.w === w).length;
      if (have < cap) {
        const a = E.rand(E.TAU);
        G.agents.push({ kind: 'cursor', x: G.player.x + Math.cos(a) * 30, y: G.player.y + Math.sin(a) * 30, life: Infinity, state: 'seek', tgt: null, markT: 0, blink: 0, w });
      }
      return;
    }
    w.t -= dt;
    if (w.t > 0) return;
    w.t = cd(G, w.s.cd);
    const n = cnt(G, w.s.count);
    for (let i = 0; i < n; i++) {
      const a = E.rand(E.TAU);
      const v = spd(G, w.s.speed);
      const crit = Math.random() < w.s.critCh + (G.P.luck - 1) * 0.3;
      G.fireProj({
        x: G.player.x, y: G.player.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        dmg: dmg(G, w.s.dmg, w) * (crit ? 3 : 1), crit,
        r: 10, pierce: 1, life: 2.4,
        kind: 'wobble', wobA: E.rand(E.TAU), spr: SPR.halluc,
      });
    }
    SFX.play('shot');
  };

  // ------------------------------------------------------- projectile update
  function updateProj(G, p, dt) {
    p.life -= dt;
    if (p.life <= 0) {
      if (p.kind === 'fall') impact(G, p);
      return false;
    }
    switch (p.kind) {
      case 'straight':
      case 'flame':
        break;
      case 'wobble': {
        // aligned shots barely wobble and home hard; base ones flail wide
        p.wobA += dt * 7;
        const s = Math.sin(p.wobA) * (p.alignedSeek ? 35 : 130);
        const a = Math.atan2(p.vy, p.vx) + Math.PI / 2;
        p.x += Math.cos(a) * s * dt;
        p.y += Math.sin(a) * s * dt;
        if (p.seek) steer(G, p, dt, p.alignedSeek ? 10 : 5);
        break;
      }
      case 'boomerang': {
        p.phase += dt;
        if (p.phase < p.outT) {
          if (p.seek) steer(G, p, dt, 3.5);
        } else {
          // return to sender
          const a = E.ang(p.x, p.y, G.player.x, G.player.y);
          const v = Math.hypot(p.vx, p.vy) || 380;
          p.vx = E.lerp(p.vx, Math.cos(a) * v * 1.4, dt * 6);
          p.vy = E.lerp(p.vy, Math.sin(a) * v * 1.4, dt * 6);
          if (E.dist2(p.x, p.y, G.player.x, G.player.y) < 28 * 28 && p.phase > p.outT + 0.2) return false;
        }
        break;
      }
      case 'fall': {
        if (p.y >= p.ty) { impact(G, p); return false; }
        break;
      }
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    return true;
  }
  function steer(G, p, dt, strength) {
    if (!p.tgt || p.tgt.hp <= 0) p.tgt = G.nearestEnemy(p.x, p.y, 420);
    if (p.tgt) {
      const v = Math.hypot(p.vx, p.vy) || 300;
      const a = E.ang(p.x, p.y, p.tgt.x, p.tgt.y);
      p.vx = E.lerp(p.vx, Math.cos(a) * v, dt * strength);
      p.vy = E.lerp(p.vy, Math.sin(a) * v, dt * strength);
    }
  }
  function impact(G, p) {
    const r = p.aoeR || 50;
    G.aoe(p.x, p.y, r, p.dmg, { kb: 130 });
    G.ring(p.x, p.y, r * 1.15, '#c07fff', 0.42);
    G.spark(p.x, p.y, '#c07fff', 16);
    G.spark(p.x, p.y, '#ffd84d', 6);
    SFX.play('explode');
  }

  function update(G, w, dt) {
    const h = H[w.id];
    if (h) h(G, w, dt);
    if (w.id === 'gradientDescent' && w.evolved) tickBarrage(G, w, dt);
  }

  return { computeStats, update, updateAgent, updateProj };
})();
