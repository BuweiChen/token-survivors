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
          burnColor: '#54ff8e',
          onHit: glaze ? () => { G.player.hp = Math.min(G.P.maxhp, G.player.hp + 1); } : null,
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
  H.attention = (G, w, dt) => {
    w.t -= dt;
    if (w.t > 0) return;
    const evolved = w.evolved;
    w.t = cd(G, evolved ? w.s.cd * 0.55 : w.s.cd);
    const n = cnt(G, w.s.count) + (evolved ? 2 : 0);
    const range = area(G, w.s.range) * (evolved ? 1.4 : 1);
    const targets = G.topEnemies(n, range);
    if (!targets.length) { w.t = 0.15; return; }
    const d = dmg(G, evolved ? w.s.dmg * 2.2 : w.s.dmg, w);
    for (const e of targets) {
      G.addBeam(G.player.x, G.player.y - 10, e.x, e.y, evolved ? '#ffd84d' : '#ff5db1', evolved ? 6 : 3);
      if (evolved) {
        // Opus 4.8: attention weights -> it attends to what MATTERS. Bonus
        // damage scales with the target's max HP, executing the big threats.
        const focus = d + Math.min(e.maxhp * 0.02, 90);
        beamPierce(G, G.player.x, G.player.y, e.x, e.y, focus);
        G.ring(e.x, e.y, 26, '#ffd84d', 0.2);
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
  H.chainOfThought = (G, w, dt) => {
    const evolved = w.evolved;
    w.t -= dt;
    const p = G.player;
    if (w.t > 0) return;
    w.t = cd(G, w.s.cd);
    // Chain of Thought: a bolt that leaps enemy-to-enemy, one reasoning step
    // per jump. DeepSeek-R1 reasons deeper -- many more jumps, each hitting
    // harder than the last (escalating confidence). No detonations, no shake.
    const start = G.nearestEnemy(p.x, p.y, 560);
    if (!start) { w.t = 0.12; return; }
    const jumps = w.s.chains + (evolved ? 6 : 0);
    const range = area(G, w.s.range) * (evolved ? 1.5 : 1);
    const range2 = range * range;
    const growth = evolved ? 1.12 : 1;
    let d = dmg(G, evolved ? w.s.dmg * 1.5 : w.s.dmg, w);
    const mark = ++G.frameMark;
    let cur = start, px = p.x, py = p.y;
    for (let j = 0; j <= jumps && cur; j++) {
      cur._mark = mark;
      G.addBeam(px, py, cur.x, cur.y, evolved ? '#7df9ff' : '#9ad0ff', evolved ? 4 : 3);
      G.hitEnemy(cur, d, { kb: 30, quiet: true });
      G.spark(cur.x, cur.y, evolved ? '#7df9ff' : '#9ad0ff', 3);
      px = cur.x; py = cur.y;
      d *= growth;
      const cands = G.grid.query(px, py, range);
      let best = null, bd = range2;
      for (const e of cands) {
        if (e._mark === mark || e.hp <= 0) continue;
        const dd = E.dist2(px, py, e.x, e.y);
        if (dd < bd) { bd = dd; best = e; }
      }
      cur = best;
    }
    SFX.play('hit');
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
      w.herdT = (w.herdT || 0) - dt;
      const cap = 2 + ((G.P.amount / 2) | 0);
      const herd = G.agents.filter(a => a.kind === 'llama' && a.w === w);
      if (w.herdT <= 0 && herd.length < cap) {
        w.herdT = 2.8;
        const a = E.rand(E.TAU);
        G.agents.push({ kind: 'llama', x: G.player.x + Math.cos(a) * baseR, y: G.player.y + Math.sin(a) * baseR, life: 14, cd: 0, w });
        G.announce('the herd grows. (open weights)');
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
    } else if (a.kind === 'llama') {
      // a freed fork: wanders toward the nearest enemy and gores it
      const e = G.nearestEnemy(a.x, a.y, 9999);
      if (e) {
        const ang = E.ang(a.x, a.y, e.x, e.y);
        a.fx = Math.cos(ang);
        a.x += Math.cos(ang) * 200 * dt;
        a.y += Math.sin(ang) * 200 * dt;
      }
      a.cd -= dt;
      if (a.cd <= 0) { a.cd = 0.5; G.aoe(a.x, a.y, 34, dmg(G, a.w.s.dmg * 1.3, a.w), { kb: 90, quiet: true }); }
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

  // ---- HALLUCINATION / CONSTITUTIONAL AI ----
  H.hallucination = (G, w, dt) => {
    w.t -= dt;
    if (w.t > 0) return;
    w.t = cd(G, w.s.cd);
    const evolved = w.evolved;
    const n = cnt(G, w.s.count) + (evolved ? 2 : 0);
    // Constitutional AI: the base weapon is "confidently wrong" -- it sprays
    // in random directions. Aligned, every shot becomes confidently RIGHT:
    // it homes true on the nearest enemies, and crits "redeem" the target
    // with a constitutional pulse that heals you.
    const aimAt = evolved ? G.nearestEnemy(G.player.x, G.player.y, 9999) : null;
    for (let i = 0; i < n; i++) {
      const a = evolved && aimAt
        ? E.ang(G.player.x, G.player.y, aimAt.x, aimAt.y) + E.rand(-0.5, 0.5)
        : E.rand(E.TAU);
      const v = spd(G, w.s.speed) * (evolved ? 1.25 : 1);
      const crit = Math.random() < w.s.critCh + (G.P.luck - 1) * 0.3 + (evolved ? 0.1 : 0);
      G.fireProj({
        x: G.player.x, y: G.player.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        dmg: dmg(G, evolved ? w.s.dmg * 1.7 : w.s.dmg, w) * (crit ? 3 : 1), crit,
        r: 10, pierce: evolved ? 3 : 1, life: 2.4,
        kind: 'wobble', wobA: E.rand(E.TAU), spr: SPR.halluc,
        seek: evolved, alignedSeek: evolved, healOnCrit: evolved,
        onHit: (evolved && crit) ? (en) => {
          // redemption: a constitutional pulse on the crit's target
          G.aoe(en.x, en.y, 62, dmg(G, w.s.dmg * 1.0, w), { kb: 70 });
          G.ring(en.x, en.y, 62, '#b347ff', 0.3);
        } : null,
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
