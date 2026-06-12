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

  // ---------------------------------------------------------------- handlers
  const H = {};

  // ---- TOKEN STREAM / CHATGPT ----
  H.tokenStream = (G, w, dt) => {
    w.t -= dt;
    if (w.t > 0) return;
    const evolved = w.evolved;
    const e = G.nearestEnemy(G.player.x, G.player.y, 640);
    if (!e) { w.t = 0.1; return; }
    if (evolved) {
      w.t = cd(G, 0.13);
      const n = 1 + ((G.P.amount / 2) | 0);
      for (let i = 0; i < n; i++) fireToken(G, w, e, E.rand(-0.22, 0.22), dmg(G, w.s.dmg + 5, w), 2 + w.s.pierce);
    } else {
      w.t = cd(G, w.s.cd);
      const n = cnt(G, w.s.count);
      for (let i = 0; i < n; i++) fireToken(G, w, e, (i - (n - 1) / 2) * 0.11, dmg(G, w.s.dmg, w), w.s.pierce);
    }
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
  H.attention = (G, w, dt) => {
    w.t -= dt;
    if (w.t > 0) return;
    const evolved = w.evolved;
    w.t = cd(G, evolved ? w.s.cd * 0.55 : w.s.cd);
    const n = cnt(G, w.s.count) + (evolved ? 2 : 0);
    const range = area(G, w.s.range);
    const targets = G.topEnemies(n, range);
    if (!targets.length) { w.t = 0.15; return; }
    const d = dmg(G, evolved ? w.s.dmg * 1.7 : w.s.dmg, w);
    for (const e of targets) {
      G.addBeam(G.player.x, G.player.y - 10, e.x, e.y, evolved ? '#ffd84d' : '#ff5db1', evolved ? 5 : 3);
      if (evolved) {
        // evolved beams pierce everything along the line
        beamPierce(G, G.player.x, G.player.y, e.x, e.y, d);
      } else {
        G.hitEnemy(e, d, { crit: critRoll(G), kb: 60 });
      }
    }
    SFX.play('hit');
  };
  function beamPierce(G, x1, y1, x2, y2, d) {
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const steps = Math.ceil(len / 70);
    const mark = ++G.frameMark;
    for (let i = 0; i <= steps; i++) {
      const x = x1 + (x2 - x1) * i / steps, y = y1 + (y2 - y1) * i / steps;
      const cands = G.grid.query(x, y, 40);
      for (const e of cands) {
        if (e._mark === mark) continue;
        if (E.dist2(x, y, e.x, e.y) < (40 + e.r) * (40 + e.r)) {
          e._mark = mark;
          G.hitEnemy(e, d, { kb: 40 });
        }
      }
    }
  }

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
        G.hitEnemy(e, d, { noKb: true, quiet: true });
        if (evolved) e.slowT = 0.45; // it remembers you. you move slower now.
        hitAny = true;
      }
    }
    if (evolved) G.vacuumGems(G.player.x, G.player.y, r); // 1M context ingests everything
    if (hitAny) SFX.play('hit');
  };

  // ---- CHAIN OF THOUGHT / DEEPSEEK-R1 ----
  H.chainOfThought = (G, w, dt) => {
    const evolved = w.evolved;
    w.t -= dt;
    const p = G.player;
    if (w.t <= 0 && (p.moving || evolved)) {
      w.t = w.s.drop;
      G.addZone({
        x: p.x, y: p.y - 6,
        r: area(G, w.s.radius) * (evolved ? 1.25 : 1),
        life: evolved ? w.s.life * 2.2 : w.s.life,
        dmg: dmg(G, evolved ? w.s.dmg * 1.5 : w.s.dmg, w),
        explode: evolved ? { r: area(G, w.s.radius) * 2.6, dmg: dmg(G, w.s.dmg * 4, w) } : null,
        kind: 'thought',
      });
    }
  };

  // ---- RAG / PERPLEXITY ----
  H.rag = (G, w, dt) => {
    w.t -= dt;
    if (w.t > 0) return;
    w.t = cd(G, w.s.cd);
    const evolved = w.evolved;
    const n = cnt(G, w.s.count) + (evolved ? 2 : 0);
    const e = G.nearestEnemy(G.player.x, G.player.y, 700);
    const baseA = e ? E.ang(G.player.x, G.player.y, e.x, e.y) : E.rand(E.TAU);
    const v = spd(G, w.s.speed);
    for (let i = 0; i < n; i++) {
      const a = baseA + (i - (n - 1) / 2) * 0.5;
      G.fireProj({
        x: G.player.x, y: G.player.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        dmg: dmg(G, evolved ? w.s.dmg * 1.8 : w.s.dmg, w), r: 12, pierce: 9999, life: 5,
        kind: 'boomerang', phase: 0, outT: w.s.range + (evolved ? 0.2 : 0),
        spr: SPR.doc, spin: true, seek: evolved,
        rehit: 0.4,
      });
    }
    SFX.play('shot');
  };

  // ---- EMBEDDINGS / LLAMA ----
  H.embeddings = (G, w, dt) => {
    const evolved = w.evolved;
    const rs = w.s.rotSpeed * (evolved ? 1.5 : 1);
    w.angle = (w.angle + rs * dt) % E.TAU;
    const n = cnt(G, w.s.count) + (evolved ? 3 : 0);
    const baseR = area(G, w.s.radius);
    const d = dmg(G, evolved ? w.s.dmg * 1.7 : w.s.dmg, w);
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
        G.fireProj({
          x: p.x + p.faceX * 14, y: p.y + p.faceY * 14,
          vx: Math.cos(a) * v, vy: Math.sin(a) * v,
          dmg: dmg(G, w.s.dmg, w), r: 11, pierce: 9999, life: range / v,
          kind: 'flame', spr: SPR.flame[(Math.random() * 2) | 0], rehit: 0.3,
        });
      }
    }
    if (evolved) {
      // GROK: chaos lightning on random enemies, forever
      w.boltT = (w.boltT || 0) - dt;
      if (w.boltT <= 0) {
        w.boltT = cd(G, 0.24);
        const e = G.randomVisibleEnemy();
        if (e) {
          G.addBeam(e.x, e.y - 400, e.x, e.y, '#ffe94d', 4);
          G.aoe(e.x, e.y, 48, dmg(G, 30, w), { kb: 80 });
          G.spark(e.x, e.y, '#ffe94d', 8);
          SFX.play('hit');
        }
      }
    }
  };

  // ---- GRADIENT DESCENT / GEMINI ----
  H.gradientDescent = (G, w, dt) => {
    w.t -= dt;
    if (w.t > 0) return;
    w.t = cd(G, w.s.cd);
    const evolved = w.evolved;
    const n = cnt(G, w.s.count) + (evolved ? 2 : 0);
    let fired = false;
    for (let i = 0; i < n; i++) {
      const e = G.randomVisibleEnemy();
      if (!e) break;
      fired = true;
      if (evolved) {
        // GEMINI: instant TPU beam from orbit
        G.addBeam(e.x, e.y - 520, e.x, e.y, '#7baaf7', 9);
        G.aoe(e.x, e.y, area(G, w.s.radius * 1.5), dmg(G, w.s.dmg * 1.8, w), { kb: 100 });
        G.spark(e.x, e.y, '#7baaf7', 10);
      } else {
        G.fireProj({
          x: e.x + E.rand(-20, 20), y: e.y - 420, vx: 0, vy: 620,
          dmg: dmg(G, w.s.dmg, w), r: 10, pierce: 0, life: 2,
          kind: 'fall', ty: e.y, aoeR: area(G, w.s.radius), spr: SPR.gdOrb,
        });
      }
    }
    if (fired) SFX.play(evolved ? 'hit' : 'shot');
  };

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
    if (evolved && !G.agents.some(a => a.kind === 'claude')) {
      G.agents.push({ kind: 'claude', x: G.player.x, y: G.player.y, life: Infinity, cd: 0, spinA: 0, w });
      G.announce('\u2733\uFE0F agent spawned. it is cooking.');
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
    } else if (a.kind === 'claude') {
      // agentic behavior: chase nearest enemy, spin-to-win
      const e = G.nearestEnemy(a.x, a.y, 9999);
      if (e) {
        const ang = E.ang(a.x, a.y, e.x, e.y);
        a.x += Math.cos(ang) * 250 * dt;
        a.y += Math.sin(ang) * 250 * dt;
      } else {
        a.x += (G.player.x - a.x) * dt * 2;
        a.y += (G.player.y - a.y) * dt * 2;
      }
      a.spinA += dt * 9;
      a.cd -= dt;
      if (a.cd <= 0) {
        a.cd = 0.3 * G.P.cooldown;
        G.aoe(a.x, a.y, 46, dmg(G, a.w.s.dmg * 2.2, a.w), { kb: 60, quiet: true });
      }
    }
  }

  // ---- HALLUCINATION / CONSTITUTIONAL AI ----
  H.hallucination = (G, w, dt) => {
    w.t -= dt;
    if (w.t > 0) return;
    w.t = cd(G, w.s.cd);
    const evolved = w.evolved;
    const n = cnt(G, w.s.count) + (evolved ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const a = E.rand(E.TAU);
      const v = spd(G, w.s.speed);
      const crit = Math.random() < w.s.critCh + (G.P.luck - 1) * 0.3;
      G.fireProj({
        x: G.player.x, y: G.player.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        dmg: dmg(G, evolved ? w.s.dmg * 1.6 : w.s.dmg, w) * (crit ? 3 : 1), crit,
        r: 10, pierce: evolved ? 2 : 1, life: 2.2,
        kind: 'wobble', wobA: E.rand(E.TAU), spr: SPR.halluc,
        seek: evolved, healOnCrit: evolved,
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
        p.wobA += dt * 7;
        const s = Math.sin(p.wobA) * 130;
        const a = Math.atan2(p.vy, p.vx) + Math.PI / 2;
        p.x += Math.cos(a) * s * dt;
        p.y += Math.sin(a) * s * dt;
        if (p.seek) steer(G, p, dt, 5);
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
    G.aoe(p.x, p.y, p.aoeR || 50, p.dmg, { kb: 90 });
    G.spark(p.x, p.y, '#c07fff', 8);
    G.shake(2);
    SFX.play('hit');
  }

  function update(G, w, dt) {
    const h = H[w.id];
    if (h) h(G, w, dt);
  }

  return { computeStats, update, updateAgent, updateProj };
})();
