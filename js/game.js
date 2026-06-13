// game.js -- core loop, entities, collisions, spawning, progression.
'use strict';

const Game = (() => {
  // ---------- canvas ----------
  let cv, ctx, W = 0, H = 0, DPR = 1;

  // ---------- run state ----------
  const G = {
    state: 'title', // title | run | levelup | chest | pause | over | win
    time: 0, kills: 0, coins: 0, level: 1, xp: 0, xpNext: 6,
    player: null, P: null,
    enemies: [], projs: [], eprojs: [], gems: [], pickups: [], parts: [], texts: [], beams: [], zones: [], rings: [], agents: [],
    grid: new E.Grid(96),
    cam: { x: 0, y: 0, sx: 0, sy: 0, shake: 0 },
    frameMark: 0,
    cardFreezeT: 0, // boss title card briefly freezes the sim
    testMode: false,
  };

  let enemyId = 1;
  let spawnAcc = 0, eliteT = 28, contactT = 0, sepFrame = 0;
  let bossesSpawned = [], levelQueue = 0;
  let buffT = 0, buffName = '';
  let bestTime = +(E.store.get('ts_best') || 0);
  let bank = +(E.store.get('ts_bank') || 0);
  let metaRanks = JSON.parse(E.store.get('ts_meta') || '{}');
  // bestiary: enemy types the player has already met, across all runs
  let seenEnemies = JSON.parse(E.store.get('ts_seen') || '{}');
  // auto-pick: bonus type to grab silently once the build is complete
  let autoPick = E.store.get('ts_autopick') || '';

  function saveBank() {
    E.store.set('ts_bank', bank);
    E.store.set('ts_best', bestTime);
  }
  // move this run's credits into the bank exactly once (death, win, quit, tab close)
  function bankRunCoins() {
    if (G.coins > 0) { bank += G.coins; G.coins = 0; saveBank(); }
  }

  const keys = {};
  // floating touch joystick: first touch sets the origin, drag to steer
  const joy = { active: false, id: -1, ox: 0, oy: 0, mx: 0, my: 0 };

  // ---------- pools ----------
  const projPool = new E.Pool(() => ({}));
  const gemPool = new E.Pool(() => ({}));
  const partPool = new E.Pool(() => ({}));
  const textPool = new E.Pool(() => ({}));
  const enemyPool = new E.Pool(() => ({}));

  // white flash variants of sprites, generated lazily
  const whiteCache = new Map();
  function whiteOf(spr) {
    let w = whiteCache.get(spr);
    if (!w) {
      w = document.createElement('canvas');
      w.width = spr.width; w.height = spr.height;
      const g = w.getContext('2d');
      g.drawImage(spr, 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, w.width, w.height);
      whiteCache.set(spr, w);
    }
    return w;
  }

  // pre-rendered thought cloud for CoT zones
  const cloudSpr = (() => {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(190,210,255,0.55)';
    [[22, 36, 14], [38, 30, 13], [44, 42, 10], [26, 22, 10]].forEach(([x, y, r]) => {
      g.beginPath(); g.arc(x, y, r, 0, E.TAU); g.fill();
    });
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.font = 'bold 11px monospace';
    g.fillText('...', 26, 38);
    return c;
  })();

  // ---------- player / stats ----------
  function newPlayer() {
    return {
      x: 0, y: 0, hp: 100, moving: false, faceX: 1, faceY: 0,
      anim: 0, hurtFlash: 0, invulnT: 0, revivalUsed: false,
      slowT: 0, projGraceT: 0,
      weapons: [], passives: {},
    };
  }

  function metaBonus(stat) {
    let v = 0;
    for (const id in DATA.META) {
      const m = DATA.META[id];
      if (m.stat === stat) v += (metaRanks[id] || 0) * m.per;
    }
    return v;
  }

  function recomputeStats() {
    const p = G.player;
    const P = {
      might: 1 + metaBonus('might'), area: 1, cooldown: 1, projSpeed: 1, amount: 0,
      magnet: 90, luck: 1 + metaBonus('luck'), growth: 1 + metaBonus('growth'),
      armor: 0, regen: 0, speed: 185 * (1 + metaBonus('speed')),
      maxhp: 100 + metaBonus('maxhp'), revival: metaBonus('revival'),
    };
    for (const id in p.passives) {
      const def = DATA.PASSIVES[id], lv = p.passives[id];
      if (def.stat === 'magnet') P.magnet *= 1 + def.per * lv;
      else if (def.stat === 'cooldown') P.cooldown *= 1 + def.per * lv;
      else P[def.stat] += def.per * lv;
    }
    if (buffT > 0) { P.might *= 2.5; P.cooldown *= 0.5; }
    P.cooldown = Math.max(0.25, P.cooldown);
    G.P = P;
  }

  // ---------- run lifecycle ----------
  function startRun() {
    G.state = 'run';
    G.time = 0; G.kills = 0; G.coins = 0; G.level = 1; G.xp = 0; G.xpNext = 6;
    G.enemies.length = 0; G.projs.length = 0; G.eprojs.length = 0; G.gems.length = 0; G.pickups.length = 0;
    G.parts.length = 0; G.texts.length = 0; G.beams.length = 0; G.zones.length = 0; G.rings.length = 0; G.agents.length = 0;
    G.cardFreezeT = 0;
    G.player = newPlayer();
    spawnAcc = 0; eliteT = 28; contactT = 0; levelQueue = 0;
    bossesSpawned = []; buffT = 0;
    recomputeStats();
    G.player.hp = G.P.maxhp;
    addWeapon('tokenStream');
    UI.hideAll(); UI.showHud(true);
    UI.banner('SURVIVE THE SLOP. 15:00 TO AGI.');
    SFX.init(); SFX.resumeAll(); SFX.startMusic('run');
  }

  function endRun(won) {
    G.state = won ? 'win' : 'over';
    SFX.stopMusic();
    SFX.play(won ? 'win' : 'death');
    const earned = G.coins;
    if (G.time > bestTime) bestTime = G.time;
    bankRunCoins();
    UI.showHud(false);
    const stats = { time: G.time, kills: G.kills, level: G.level, earned, won };
    if (won) UI.showWin(stats); else UI.showOver(stats);
  }

  function quitToTitle() {
    bankRunCoins(); // rage quitting should not also rage quit your credits
    G.state = 'title';
    SFX.resumeAll(); // may arrive here from pause with the clock suspended
    SFX.startMusic('menu');
    UI.hideAll(); UI.showHud(false);
    UI.showTitle();
  }

  // ---------- weapons / passives / levels ----------
  function addWeapon(id) {
    const w = { id, lv: 1, t: 0, evolved: false, evoId: null, angle: 0, auraR: 0 };
    WeaponSys.computeStats(w);
    G.player.weapons.push(w);
    UI.dirtyIcons();
    return w;
  }

  function upgradeChoicePool() {
    const p = G.player, pool = [];
    for (const w of p.weapons) {
      if (!w.evolved && w.lv < DATA.WEAPONS[w.id].maxLv) pool.push({ type: 'weapon', id: w.id, wt: 3 });
    }
    if (p.weapons.length < DATA.MAX_WEAPONS) {
      for (const id in DATA.WEAPONS) {
        if (!p.weapons.some(w => w.id === id)) pool.push({ type: 'weapon', id, wt: 1, isNew: true });
      }
    }
    const pCount = Object.keys(p.passives).length;
    for (const id in DATA.PASSIVES) {
      const lv = p.passives[id] || 0;
      if (lv > 0 && lv < DATA.PASSIVES[id].maxLv) pool.push({ type: 'passive', id, wt: 3 });
      else if (lv === 0 && pCount < DATA.MAX_PASSIVES) pool.push({ type: 'passive', id, wt: 1, isNew: true });
    }
    return pool;
  }

  function rollChoices() {
    const pool = upgradeChoicePool();
    const n = 3 + (Math.random() < (G.P.luck - 1) * 0.5 ? 1 : 0);
    const out = [];
    while (out.length < n && pool.length) {
      let total = 0;
      for (const c of pool) total += c.wt;
      let r = Math.random() * total, idx = 0;
      for (let i = 0; i < pool.length; i++) { r -= pool[i].wt; if (r <= 0) { idx = i; break; } }
      out.push(pool.splice(idx, 1)[0]);
    }
    if (!out.length) {
      out.push({ type: 'bonus', id: 'coffee' }, { type: 'bonus', id: 'credits' });
    }
    return out;
  }

  function applyChoice(c) {
    const p = G.player;
    if (c.type === 'weapon') {
      const w = p.weapons.find(w => w.id === c.id);
      if (w) { w.lv++; WeaponSys.computeStats(w); }
      else addWeapon(c.id);
    } else if (c.type === 'passive') {
      p.passives[c.id] = (p.passives[c.id] || 0) + 1;
      recomputeStats();
    } else if (c.id === 'coffee') {
      p.hp = Math.min(G.P.maxhp, p.hp + 30);
    } else if (c.id === 'credits') {
      G.coins += 10;
    }
    UI.dirtyIcons();
  }

  function openLevelUp() {
    levelQueue--;
    const choices = rollChoices();
    if (G.testMode) { applyChoice(E.choice(choices)); return; }
    // build complete + auto-pick set: grab the chosen bonus without a modal
    if (autoPick && choices.every(c => c.type === 'bonus')) {
      const c = choices.find(c => c.id === autoPick) || choices[0];
      applyChoice(c);
      addText(G.player.x, G.player.y - 34, DATA.BONUS[c.id].icon + ' auto-picked', '#aee3ff');
      SFX.play('pickup');
      if (levelQueue > 0) openLevelUp();
      return;
    }
    G.state = 'levelup';
    SFX.play('levelup');
    UI.showLevelup(choices, c => {
      applyChoice(c);
      G.state = 'run';
      if (levelQueue > 0) openLevelUp();
    });
  }

  function setAutoPick(id) {
    autoPick = id || '';
    E.store.set('ts_autopick', autoPick);
  }

  function gainXp(v) {
    G.xp += v * G.P.growth;
    while (G.xp >= G.xpNext) {
      G.xp -= G.xpNext;
      G.level++;
      G.xpNext = Math.floor(6 + (G.level - 1) * 7 + Math.pow(G.level - 1, 1.8) * 1.3);
      levelQueue++;
    }
    if (levelQueue > 0 && G.state === 'run') openLevelUp();
  }

  // ---------- evolution / chest ----------
  // recipe-driven: host weapon maxed + every component in needs satisfied
  function evolutionCandidates() {
    const p = G.player;
    const out = [];
    for (const r of DATA.RECIPES) {
      const w = p.weapons.find(x => x.id === r.weapon);
      if (!w || w.evolved || w.lv < DATA.WEAPONS[r.weapon].maxLv) continue;
      const ok = r.needs.every(n => n.type === 'passive'
        ? (p.passives[n.id] || 0) >= (n.lv || 1)
        : p.weapons.some(x => x.id === n.id && x.lv >= (n.lv || DATA.WEAPONS[n.id].maxLv)));
      if (ok) out.push({ w, evo: r.evo });
    }
    return out;
  }

  // a chest rolls a count of upgrade levels: base EV ~1.5, capped at 5,
  // exponentially rarer for more, luck pushes it up. Levels go into weapons
  // and passives we ALREADY own first; a brand-new weapon/passive only
  // appears once everything owned is maxed or the roll outgrows the levels
  // our owned kit can still absorb.
  function rollChestUpgrades() {
    const p = G.player;
    const q = E.clamp(0.33 + (G.P.luck - 1) * 0.25, 0, 0.85);
    let n = 1;
    while (n < 5 && Math.random() < q) n++;
    // working copies so several rolls resolve correctly within one chest
    const wlv = {}; for (const w of p.weapons) if (!w.evolved) wlv[w.id] = w.lv;
    const plv = {}; for (const id in p.passives) plv[id] = p.passives[id];
    let nW = p.weapons.length, nP = Object.keys(p.passives).length;
    const out = [];
    for (let i = 0; i < n; i++) {
      const owned = [];
      for (const id in wlv) if (wlv[id] < DATA.WEAPONS[id].maxLv) owned.push({ type: 'weapon', id });
      for (const id in plv) if (plv[id] < DATA.PASSIVES[id].maxLv) owned.push({ type: 'passive', id });
      let pick = null;
      if (owned.length) {
        pick = E.choice(owned);
      } else {
        const fresh = [];
        if (nW < DATA.MAX_WEAPONS) for (const id in DATA.WEAPONS)
          if (!(id in wlv) && !p.weapons.some(w => w.id === id)) fresh.push({ type: 'weapon', id, isNew: true });
        if (nP < DATA.MAX_PASSIVES) for (const id in DATA.PASSIVES)
          if (!(id in plv)) fresh.push({ type: 'passive', id, isNew: true });
        if (fresh.length) pick = E.choice(fresh);
      }
      if (!pick) break; // nothing left to give
      out.push(pick);
      if (pick.type === 'weapon') { if (pick.isNew) nW++; wlv[pick.id] = (wlv[pick.id] || 0) + 1; }
      else { if (pick.isNew) nP++; plv[pick.id] = (plv[pick.id] || 0) + 1; }
    }
    return out;
  }

  function openChest() {
    const cands = evolutionCandidates();
    const result = { coins: E.randi(4, 10) };
    if (cands.length) {
      const c = E.choice(cands);
      c.w.evolved = true;
      c.w.evoId = c.evo;
      WeaponSys.computeStats(c.w);
      result.evo = c.evo;
      SFX.play('evolve');
      G.shake(8);
    } else {
      result.upgrades = rollChestUpgrades();
      if (!result.upgrades.length) result.coins += 10;
      else for (const c of result.upgrades) applyChoice(c);
      const big = result.upgrades.length;
      SFX.play(big >= 3 ? 'evolve' : 'chest');
      if (big >= 3) G.shake(4 + big * 2);
    }
    G.coins += result.coins;
    UI.dirtyIcons();
    if (G.testMode) return;
    G.state = 'chest';
    UI.showChest(result, () => { G.state = 'run'; });
  }

  // ---------- spawning ----------
  // HP of a 1x "basic" enemy over time. Tracks the power curve of a single
  // stage-appropriate non-evo weapon (lv1 ~7 DPS at 0:00, maxed ~60 DPS by
  // ~10:00) so one such weapon kills a basic enemy in roughly 2-5s at any
  // stage. Evolutions are what break this treadmill -- that's the point.
  const BASE_HP0 = 18.75; // basicHpAt(0); reference for XP scaling
  function basicHpAt() {
    const m = G.time / 60;
    // x0.75 vs the original curve -> ~25% lower TTK at every stage
    return (25 + 195 * Math.min(m / 10, 1) + 4 * Math.max(0, m - 10)) * 0.75;
  }
  function timeDmgScale() { return 1 + (G.time / 60) * 0.09; }
  // the slop gets faster as the internet degrades (mild: +18% by 15:00)
  function timeSpeedScale() { return 1 + Math.min(G.time / 60, 15) * 0.012; }

  function spawnEnemy(type, x, y, elite) {
    const def = DATA.ENEMIES[type];
    const e = enemyPool.get();
    e.id = enemyId++;
    e.type = type; e.def = def;
    e.x = x; e.y = y;
    e.hp = e.maxhp = def.hp * basicHpAt() * (elite ? 4 : 1);
    e.spd = def.spd * E.rand(0.9, 1.1) * timeSpeedScale();
    e.r = def.r * (elite ? 1.45 : 1);
    e.dmg = def.dmg * timeDmgScale() * (elite ? 1.5 : 1);
    e.elite = !!elite; e.boss = !!def.boss;
    e.flash = 0; e.kbx = 0; e.kby = 0; e.slowT = 0; e.wobble = E.rand(E.TAU);
    e.dashT = 0; e.spawnT = 0; e._mark = 0;
    e.abilT = 3; e.abil2T = 8; e.telegraphT = 0; e.chargeT = 0; e.cvx = 0; e.cvy = 0; e.enraged = false;
    e.spr = SPR.enemies[def.spr];
    G.enemies.push(e);
    if (def.lore && !seenEnemies[type] && !G.testMode) {
      seenEnemies[type] = 1;
      E.store.set('ts_seen', JSON.stringify(seenEnemies));
      UI.bestiary(type, def);
    }
    return e;
  }

  function spawnPosAroundPlayer() {
    const a = E.rand(E.TAU);
    const R = Math.hypot(W, H) / 2 + 70;
    return [G.player.x + Math.cos(a) * R, G.player.y + Math.sin(a) * R];
  }

  function pickWaveType() {
    const wave = DATA.WAVES[Math.min((G.time / 60) | 0, DATA.WAVES.length - 1)];
    let total = 0;
    for (const t in wave.types) total += wave.types[t];
    let r = Math.random() * total;
    for (const t in wave.types) { r -= wave.types[t]; if (r <= 0) return t; }
    return Object.keys(wave.types)[0];
  }

  function updateSpawning(dt) {
    const wave = DATA.WAVES[Math.min((G.time / 60) | 0, DATA.WAVES.length - 1)];
    const deficit = wave.target - G.enemies.length;
    if (deficit > 0) {
      spawnAcc += dt * E.clamp(deficit * 0.5, 2, 24);
      let burst = 0;
      while (spawnAcc >= 1 && burst < 6) {
        spawnAcc--; burst++;
        const [x, y] = spawnPosAroundPlayer();
        spawnEnemy(pickWaveType(), x, y, false);
      }
    }
    // elites (minibosses)
    eliteT -= dt;
    if (eliteT <= 0) {
      eliteT = 45;
      const [x, y] = spawnPosAroundPlayer();
      const e = spawnEnemy(pickWaveType(), x, y, true);
      e.dropsChest = true;
      UI.titleCard('ELITE ' + e.def.name.toUpperCase(), E.choice(DATA.ELITE_SUBS), 'elite');
      SFX.play('elite');
    }
    // bosses
    for (const b of DATA.BOSSES) {
      if (G.time >= b.t && !bossesSpawned.includes(b.type)) {
        bossesSpawned.push(b.type);
        const [x, y] = spawnPosAroundPlayer();
        spawnEnemy(b.type, x, y, false);
        UI.titleCard(b.title, b.sub, 'boss');
        SFX.play('boss');
        G.shake(10);
        G.cardFreezeT = 2.0; // hold the slam; the world holds its breath
      }
    }
    // clippy summons minions
    for (const e of G.enemies) {
      if (e.type === 'clippy') {
        e.spawnT -= dt;
        if (e.spawnT <= 0) {
          e.spawnT = e.enraged ? 2.2 : 4;
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * E.TAU;
            spawnEnemy('clip', e.x + Math.cos(a) * 70, e.y + Math.sin(a) * 70, false);
          }
        }
      }
    }
  }

  // ---------- boss abilities ----------
  // each boss has a kit beyond walking at you: telegraphed charges, summons,
  // projectile volleys, and an enrage. returns the boss's speed this frame.
  function bossAbilities(e, dt, sp) {
    const p = G.player;
    e.abilT -= dt;
    e.abil2T -= dt;
    if (e.type === 'gpuBoss') {
      // winds up (blinking, frozen), then rams at 5x speed
      if (e.telegraphT > 0) {
        e.telegraphT -= dt;
        e.flash = 0.04;
        if (e.telegraphT <= 0) {
          const a = E.ang(e.x, e.y, p.x, p.y);
          e.chargeT = 0.8;
          e.cvx = Math.cos(a) * e.spd * 5;
          e.cvy = Math.sin(a) * e.spd * 5;
          SFX.play('elite');
        }
      } else if (e.abilT <= 0) {
        e.abilT = 6;
        e.telegraphT = 0.7;
        addText(e.x, e.y - 64, '!!', '#ff4455', 26);
      }
      // summons scalper bots
      if (e.abil2T <= 0) {
        e.abil2T = 10;
        for (let i = 0; i < 3; i++) spawnEnemy('scam', e.x + E.rand(-50, 50), e.y + E.rand(-50, 50), false);
        addText(e.x, e.y - 60, 'SCALPERS DEPLOYED', '#ffd84d');
      }
    } else if (e.type === 'scraperBoss') {
      // dash (existing) + radial web volley that slows the player
      e.dashT -= dt;
      if (e.dashT <= 0) e.dashT = 4.2;
      if (e.dashT < 1) sp *= 2.8;
      if (e.abilT <= 0) {
        e.abilT = 5;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * E.TAU + G.time;
          fireEnemyProj(e.x, e.y, Math.cos(a) * 190, Math.sin(a) * 190, 10, 'web');
        }
        SFX.play('shot');
      }
    } else if (e.type === 'clippy') {
      if (!e.enraged && e.hp < e.maxhp * 0.35) {
        e.enraged = true;
        e.spd *= 1.55;
        UI.titleCard('CLIPPY IS DONE HELPING', 'it no longer looks like you are trying to survive', 'elite');
        SFX.play('boss');
        G.shake(8);
      }
      // ring of paperclip shards
      if (e.abilT <= 0) {
        e.abilT = e.enraged ? 4.5 : 7;
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * E.TAU;
          fireEnemyProj(e.x, e.y, Math.cos(a) * 230, Math.sin(a) * 230, 14, 'shard');
        }
        addText(e.x, e.y - 72, "it looks like you're DYING", '#cfd8ea');
        SFX.play('shot');
      }
    }
    return sp;
  }

  const eprojPool = new E.Pool(() => ({}));
  function fireEnemyProj(x, y, vx, vy, dmg, kind) {
    if (G.eprojs.length > 120) return;
    const pr = eprojPool.get();
    pr.x = x; pr.y = y; pr.vx = vx; pr.vy = vy;
    pr.dmg = dmg * timeDmgScale(); pr.kind = kind;
    pr.r = 10; pr.life = 3.2; pr.rot = E.rand(E.TAU);
    G.eprojs.push(pr);
  }

  // ---------- combat ----------
  function hitEnemy(e, d, opts = {}) {
    if (e.hp <= 0) return;
    if (opts.crit) d *= 1; // crit dmg already applied by caller; flag is for display
    e.hp -= d;
    e.flash = 0.09;
    if (!opts.noKb) {
      const kb = (opts.kb || 70) / (e.boss ? 8 : e.elite ? 3 : 1);
      const a = E.ang(G.player.x, G.player.y, e.x, e.y);
      e.kbx += Math.cos(a) * kb;
      e.kby += Math.sin(a) * kb;
    }
    if (!opts.quiet || opts.crit) addDmgText(e.x, e.y - e.r, d, opts.crit);
    if (e.hp <= 0) killEnemy(e);
  }

  function aoe(x, y, r, d, opts = {}) {
    const cands = G.grid.query(x, y, r + 40);
    for (const e of cands) {
      if (E.dist2(x, y, e.x, e.y) < (r + e.r) * (r + e.r)) hitEnemy(e, d, opts);
    }
  }

  function killEnemy(e) {
    G.kills++;
    spark(e.x, e.y, e.boss ? '#ffd84d' : '#8ab4ff', e.boss ? 26 : 7);
    if (Math.random() < 0.25) SFX.play('hit');
    // drops: chests come from elites ONLY (about 20 a run); bosses pay out
    // a frontier model card + credits instead
    // XP scales sublinearly with enemy toughness so under-leveled players
    // can still climb out, but late levels still cost more than early ones
    const xpGrow = Math.pow(basicHpAt() / BASE_HP0, 0.6);
    let xpv = e.def.xp * xpGrow * 2 * (e.elite ? 4 : 1);
    dropGem(e.x, e.y, Math.max(1, Math.round(xpv)));
    if (e.boss) {
      G.coins += 25;
      G.shake(12);
      SFX.play('explode');
      dropPickup(e.x - 24, e.y, 'modelcard');
    } else if (e.elite) {
      if (e.dropsChest) dropPickup(e.x + 20, e.y, 'chest');
      if (Math.random() < 0.09 + (G.P.luck - 1) * 0.12) dropPickup(e.x - 20, e.y, 'modelcard');
    } else {
      const r = Math.random();
      if (r < 0.024) dropPickup(e.x, e.y, 'coin');                                  // credits
      else if (r < 0.048) dropPickup(e.x, e.y, E.choice(['magnet', 'bomb', 'vpn'])); // utility, much more common
      else if (r < 0.0488) dropPickup(e.x, e.y, 'modelcard');                       // rare frontier model
      else if (r < 0.0518) dropPickup(e.x, e.y, 'cookie');                          // rare crumb of healing
      else if (r < 0.0525) dropPickup(e.x, e.y, 'coffee');                          // rarer bigger heal
    }
    if (e.def.splits && !e.mini) {
      for (let i = 0; i < 2; i++) spawnEnemy('slopMini', e.x + E.rand(-14, 14), e.y + E.rand(-14, 14), false);
    }
    if (e.def.final) { removeEnemy(e); endRun(true); return; }
    removeEnemy(e);
  }

  function removeEnemy(e) {
    const i = G.enemies.indexOf(e);
    if (i >= 0) { G.enemies[i] = G.enemies[G.enemies.length - 1]; G.enemies.pop(); enemyPool.put(e); }
  }

  function damagePlayer(raw) {
    const p = G.player;
    if (p.invulnT > 0) return;
    const d = Math.max(1, raw - G.P.armor);
    p.hp -= d;
    p.hurtFlash = 0.25;
    UI.vignette();
    SFX.play('hurt');
    G.shake(4);
    if (p.hp <= 0) {
      if (G.P.revival > 0 && !p.revivalUsed) {
        p.revivalUsed = true;
        p.hp = G.P.maxhp;
        p.invulnT = 3;
        aoe(p.x, p.y, 9999, 500, { kb: 300 });
        UI.banner('CHECKPOINT RESTORED. rm -rf ./slop');
        SFX.play('evolve');
        G.shake(14);
      } else {
        endRun(false);
      }
    }
  }

  // ---------- drops / pickups ----------
  function dropGem(x, y, v) {
    if (G.gems.length > 550) {
      const g = G.gems[(Math.random() * 60) | 0];
      if (g) { g.v += v; g.spr = gemSprite(g.v); return; }
    }
    const g = gemPool.get();
    g.x = x; g.y = y; g.v = v; g.vac = false; g.spr = gemSprite(v);
    G.gems.push(g);
  }
  function gemSprite(v) { return SPR.gems[v >= 100 ? 100 : v >= 25 ? 25 : v >= 5 ? 5 : 1]; }

  function dropPickup(x, y, kind) {
    const sprMap = { chest: SPR.chest, coffee: SPR.coffee, cookie: SPR.cookie, magnet: SPR.magnet, bomb: SPR.bomb, vpn: SPR.vpn, coin: SPR.coin, modelcard: SPR.modelcard };
    G.pickups.push({ x, y, kind, spr: sprMap[kind], bob: E.rand(E.TAU) });
  }

  function collectPickup(pk) {
    const p = G.player;
    switch (pk.kind) {
      case 'chest': openChest(); break;
      case 'coffee': p.hp = Math.min(G.P.maxhp, p.hp + 30); addText(p.x, p.y - 30, '+30 HP', '#54ff8e'); SFX.play('pickup'); break;
      case 'cookie': p.hp = Math.min(G.P.maxhp, p.hp + 10); addText(p.x, p.y - 30, 'cookie accepted (+10 HP)', '#d9a45c'); SFX.play('pickup'); break;
      case 'magnet': for (const g of G.gems) g.vac = true; addText(p.x, p.y - 30, 'DATA HOOVERED', '#39d7ff'); SFX.play('pickup'); break;
      case 'bomb': aoe(p.x, p.y, 9999, 600 * G.P.might, { kb: 250 }); G.shake(10); addText(p.x, p.y - 30, 'sudo rm -rf ./slop', '#ff5d5d'); SFX.play('explode'); break;
      case 'vpn': p.invulnT = 8; addText(p.x, p.y - 30, 'VPN ON (untouchable)', '#aee3ff'); SFX.play('pickup'); break;
      case 'coin': { const c = E.randi(2, 5); G.coins += c; addText(p.x, p.y - 30, '+' + c + ' credits', '#37e07a'); SFX.play('coin'); break; }
      case 'modelcard': {
        buffT = 20;
        buffName = E.choice(DATA.FRONTIER_CARDS);
        UI.banner('FRONTIER MODEL DEPLOYED: ' + buffName + ' (20s of pure SOTA)');
        SFX.play('evolve');
        G.shake(6);
        break;
      }
    }
  }

  function vacuumGems(x, y, r) {
    const r2 = r * r;
    for (const g of G.gems) if (!g.vac && E.dist2(x, y, g.x, g.y) < r2) g.vac = true;
  }

  // ---------- fx ----------
  function spark(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      if (G.parts.length > 500) return;
      const pt = partPool.get();
      const a = E.rand(E.TAU), v = E.rand(40, 240);
      pt.x = x; pt.y = y; pt.vx = Math.cos(a) * v; pt.vy = Math.sin(a) * v;
      pt.life = pt.maxLife = E.rand(0.25, 0.6);
      pt.color = color; pt.size = E.rand(2, 5);
      G.parts.push(pt);
    }
  }

  // expanding shockwave ring (purely visual)
  function ring(x, y, r, color, life) {
    if (G.rings.length > 40) return;
    G.rings.push({ x, y, r0: r * 0.25, r, life: life || 0.4, maxLife: life || 0.4, color });
  }

  function addText(x, y, str, color, size) {
    if (G.texts.length > 90) return;
    const t = textPool.get();
    t.x = x; t.y = y; t.str = str; t.color = color || '#fff';
    t.life = t.maxLife = 0.8; t.size = size || 15;
    G.texts.push(t);
  }

  function addDmgText(x, y, d, crit) {
    if (!crit && (G.texts.length > 60 || Math.random() < 0.45)) return;
    if (G.texts.length > 90) return;
    const t = textPool.get();
    t.x = x + E.rand(-8, 8); t.y = y;
    t.str = crit ? (Math.round(d) + '!! ' + E.choice(['skull', 'RATIO', 'L', 'COOKED'])) : String(Math.round(d));
    t.color = crit ? '#ffd84d' : '#ffffff';
    t.life = t.maxLife = crit ? 1 : 0.6;
    t.size = crit ? 20 : 13;
    G.texts.push(t);
  }

  function addBeam(x1, y1, x2, y2, color, width) {
    G.beams.push({ x1, y1, x2, y2, color, w: width, life: 0.16, maxLife: 0.16 });
  }

  function addZone(z) {
    z.tickT = 0; z.maxLife = z.life;
    G.zones.push(z);
  }

  function shake(m) { G.cam.shake = Math.min(16, G.cam.shake + m); }

  // ---------- queries ----------
  function nearestEnemy(x, y, maxR) {
    let best = null, bd = maxR * maxR;
    // broadphase via grid first, fall back to linear scan for big ranges
    if (maxR <= 400) {
      const cands = G.grid.query(x, y, maxR);
      for (const e of cands) {
        const d = E.dist2(x, y, e.x, e.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (best) return best;
    }
    for (const e of G.enemies) {
      const d = E.dist2(x, y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  const topBuf = [];
  function topEnemies(n, range) {
    topBuf.length = 0;
    const r2 = range * range;
    const px = G.player.x, py = G.player.y;
    for (const e of G.enemies) {
      if (E.dist2(px, py, e.x, e.y) < r2) topBuf.push(e);
    }
    topBuf.sort((a, b) => b.hp - a.hp);
    if (topBuf.length > n) topBuf.length = n;
    return topBuf;
  }

  function randomVisibleEnemy() {
    if (!G.enemies.length) return null;
    for (let tries = 0; tries < 6; tries++) {
      const e = E.choice(G.enemies);
      if (Math.abs(e.x - G.player.x) < W / 2 + 40 && Math.abs(e.y - G.player.y) < H / 2 + 40) return e;
    }
    return null;
  }

  // ---------- update ----------
  function update(dt) {
    // boss title card: freeze the whole sim so the slam lands, then resume
    if (G.cardFreezeT > 0) {
      G.cardFreezeT -= dt;
      G.cam.x = G.player.x - W / 2; G.cam.y = G.player.y - H / 2;
      UI.updateHud(G);
      return;
    }
    G.time += dt;
    G.frameMark++;
    const p = G.player;
    recomputeStats();
    if (buffT > 0) buffT -= dt;

    // input / movement (keys are digital, joystick is analog)
    let mx = 0, my = 0;
    if (keys.a || keys.arrowleft) mx -= 1;
    if (keys.d || keys.arrowright) mx += 1;
    if (keys.w || keys.arrowup) my -= 1;
    if (keys.s || keys.arrowdown) my += 1;
    if (joy.active && (joy.mx || joy.my)) { mx = joy.mx; my = joy.my; }
    let mag = Math.hypot(mx, my);
    if (mag > 1) { mx /= mag; my /= mag; mag = 1; }
    p.moving = mag > 0.01;
    if (p.moving) {
      const webbed = p.slowT > 0 ? 0.55 : 1; // scraper webs gum up your shoes
      p.x += mx * G.P.speed * webbed * dt;
      p.y += my * G.P.speed * webbed * dt;
      p.faceX = mx / mag; p.faceY = my / mag;
      p.anim += dt * 9 * Math.max(0.5, mag);
    }
    if (p.invulnT > 0) p.invulnT -= dt;
    if (p.hurtFlash > 0) p.hurtFlash -= dt;
    if (p.slowT > 0) p.slowT -= dt;
    if (p.projGraceT > 0) p.projGraceT -= dt;
    if (G.P.regen > 0) p.hp = Math.min(G.P.maxhp, p.hp + G.P.regen * dt);

    updateSpawning(dt);

    // rebuild spatial hash
    G.grid.clear();
    for (const e of G.enemies) G.grid.insert(e);

    // weapons
    for (const w of p.weapons) WeaponSys.update(G, w, dt);

    // agents (turrets / claude)
    for (let i = G.agents.length - 1; i >= 0; i--) {
      const a = G.agents[i];
      WeaponSys.updateAgent(G, a, dt);
      if (a.life <= 0) { G.agents.splice(i, 1); }
    }

    // projectiles + collision
    for (let i = G.projs.length - 1; i >= 0; i--) {
      const pr = G.projs[i];
      if (!WeaponSys.updateProj(G, pr, dt)) { releaseProj(i); continue; }
      const cands = G.grid.query(pr.x, pr.y, pr.r + 26);
      let dead = false;
      for (const e of cands) {
        const rr = pr.r + e.r;
        if (E.dist2(pr.x, pr.y, e.x, e.y) >= rr * rr) continue;
        if (pr.rehit) {
          if (!pr.hitAt) pr.hitAt = new Map();
          const last = pr.hitAt.get(e.id);
          if (last !== undefined && G.time - last < pr.rehit) continue;
          pr.hitAt.set(e.id, G.time);
        }
        hitEnemy(e, pr.dmg, { crit: pr.crit, kb: 60 });
        if (pr.healOnCrit && pr.crit) p.hp = Math.min(G.P.maxhp, p.hp + 1);
        if (pr.kind === 'fall') { dead = true; break; }
        if (pr.pierce < 9000) {
          if (pr.pierce <= 0) { dead = true; break; }
          pr.pierce--;
        }
      }
      if (dead) releaseProj(i);
    }

    // enemy projectiles (webs, paperclip shards)
    for (let i = G.eprojs.length - 1; i >= 0; i--) {
      const pr = G.eprojs[i];
      pr.life -= dt;
      pr.x += pr.vx * dt; pr.y += pr.vy * dt;
      pr.rot += dt * 4;
      let dead = pr.life <= 0;
      if (!dead && p.projGraceT <= 0 && p.invulnT <= 0 &&
          E.dist2(pr.x, pr.y, p.x, p.y) < (pr.r + 13) * (pr.r + 13)) {
        damagePlayer(pr.dmg);
        if (pr.kind === 'web') { p.slowT = 1.6; addText(p.x, p.y - 30, 'WEBBED', '#cfd8ea'); }
        p.projGraceT = 0.5;
        dead = true;
      }
      if (dead) {
        eprojPool.put(pr);
        G.eprojs[i] = G.eprojs[G.eprojs.length - 1];
        G.eprojs.pop();
      }
    }
    if (G.state !== 'run') return; // a web volley can be lethal

    // zones (chain of thought)
    for (let i = G.zones.length - 1; i >= 0; i--) {
      const z = G.zones[i];
      z.life -= dt; z.tickT -= dt;
      if (z.tickT <= 0) {
        z.tickT = 0.45;
        aoe(z.x, z.y, z.r, z.dmg, { noKb: true, quiet: true });
      }
      if (z.life <= 0) {
        if (z.explode) {
          aoe(z.x, z.y, z.explode.r, z.explode.dmg, { kb: 110 });
          spark(z.x, z.y, '#7df9ff', 9);
          if (Math.random() < 0.3) SFX.play('hit');
        }
        G.zones.splice(i, 1);
      }
    }

    // enemies
    sepFrame = (sepFrame + 1) % 3;
    let touching = 0;
    for (let i = 0; i < G.enemies.length; i++) {
      const e = G.enemies[i];
      if (e.flash > 0) e.flash -= dt;
      let sp = e.spd * (e.slowT > 0 ? 0.5 : 1);
      if (e.slowT > 0) e.slowT -= dt;
      if (e.boss) sp = bossAbilities(e, dt, sp);
      if (e.chargeT > 0) {
        // mid-charge: barrel along the locked direction
        e.chargeT -= dt;
        e.x += e.cvx * dt + e.kbx * dt;
        e.y += e.cvy * dt + e.kby * dt;
      } else if (e.telegraphT > 0) {
        // winding up: hold still and look menacing
      } else {
        let a = E.ang(e.x, e.y, p.x, p.y);
        if (e.def.wiggle) a += Math.sin(G.time * 4 + e.wobble) * 0.6;
        e.x += Math.cos(a) * sp * dt + e.kbx * dt;
        e.y += Math.sin(a) * sp * dt + e.kby * dt;
      }
      e.kbx *= Math.pow(0.002, dt); e.kby *= Math.pow(0.002, dt);
      // cheap separation, 1/3 of enemies per frame
      if (i % 3 === sepFrame && !e.boss) {
        const cands = G.grid.query(e.x, e.y, 26);
        for (const o of cands) {
          if (o === e) continue;
          const d2 = E.dist2(e.x, e.y, o.x, o.y);
          const min = (e.r + o.r) * 0.7;
          if (d2 > 0.01 && d2 < min * min) {
            const d = Math.sqrt(d2), push = (min - d) * 0.5;
            e.x += (e.x - o.x) / d * push;
            e.y += (e.y - o.y) / d * push;
          }
        }
      }
      const pr = e.r + 14;
      if (E.dist2(e.x, e.y, p.x, p.y) < pr * pr) touching = Math.max(touching, e.dmg);
    }
    contactT -= dt;
    if (touching > 0 && contactT <= 0) {
      contactT = 0.25; // i-frames: short. dodge better.
      damagePlayer(touching);
      if (G.state !== 'run') return; // died
    }

    // gems
    const magR2 = G.P.magnet * G.P.magnet;
    for (let i = G.gems.length - 1; i >= 0; i--) {
      const g = G.gems[i];
      if (!g.vac && E.dist2(g.x, g.y, p.x, p.y) < magR2) g.vac = true;
      if (g.vac) {
        const a = E.ang(g.x, g.y, p.x, p.y);
        const sp = 620;
        g.x += Math.cos(a) * sp * dt;
        g.y += Math.sin(a) * sp * dt;
        if (E.dist2(g.x, g.y, p.x, p.y) < 26 * 26) {
          SFX.play('pickup');
          const v = g.v;
          G.gems[i] = G.gems[G.gems.length - 1]; G.gems.pop(); gemPool.put(g);
          gainXp(v);
          if (G.state !== 'run') break; // level up opened
          continue;
        }
      }
    }

    // pickups
    for (let i = G.pickups.length - 1; i >= 0; i--) {
      const pk = G.pickups[i];
      if (E.dist2(pk.x, pk.y, p.x, p.y) < 34 * 34) {
        G.pickups.splice(i, 1);
        collectPickup(pk);
        if (G.state !== 'run') break;
      }
    }

    // particles
    for (let i = G.parts.length - 1; i >= 0; i--) {
      const pt = G.parts[i];
      pt.life -= dt;
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      pt.vx *= 0.92; pt.vy *= 0.92;
      if (pt.life <= 0) { G.parts[i] = G.parts[G.parts.length - 1]; G.parts.pop(); partPool.put(pt); }
    }

    // texts
    for (let i = G.texts.length - 1; i >= 0; i--) {
      const t = G.texts[i];
      t.life -= dt; t.y -= 36 * dt;
      if (t.life <= 0) { G.texts[i] = G.texts[G.texts.length - 1]; G.texts.pop(); textPool.put(t); }
    }

    // beams
    for (let i = G.beams.length - 1; i >= 0; i--) {
      const b = G.beams[i];
      b.life -= dt;
      if (b.life <= 0) G.beams.splice(i, 1);
    }

    // shockwave rings
    for (let i = G.rings.length - 1; i >= 0; i--) {
      const rg = G.rings[i];
      rg.life -= dt;
      if (rg.life <= 0) { G.rings[i] = G.rings[G.rings.length - 1]; G.rings.pop(); }
    }

    // camera
    G.cam.x = p.x - W / 2;
    G.cam.y = p.y - H / 2;
    if (G.cam.shake > 0) {
      G.cam.shake *= Math.pow(0.001, dt);
      G.cam.sx = E.rand(-G.cam.shake, G.cam.shake);
      G.cam.sy = E.rand(-G.cam.shake, G.cam.shake);
      if (G.cam.shake < 0.3) G.cam.shake = 0;
    } else { G.cam.sx = 0; G.cam.sy = 0; }

    UI.updateHud(G);
  }

  function releaseProj(i) {
    const pr = G.projs[i];
    if (pr.hitAt) pr.hitAt.clear();
    pr.tgt = null;
    G.projs[i] = G.projs[G.projs.length - 1];
    G.projs.pop();
    projPool.put(pr);
  }

  function fireProj(props) {
    if (G.projs.length > 700) return null;
    const pr = projPool.get();
    pr.x = 0; pr.y = 0; pr.vx = 0; pr.vy = 0; pr.dmg = 0; pr.r = 8; pr.pierce = 0; pr.life = 1;
    pr.kind = 'straight'; pr.spr = null; pr.rot = 0; pr.spin = false; pr.crit = false;
    pr.wobA = 0; pr.seek = false; pr.tgt = null; pr.phase = 0; pr.outT = 0; pr.ty = 0;
    pr.aoeR = 0; pr.rehit = 0; pr.healOnCrit = false;
    Object.assign(pr, props);
    G.projs.push(pr);
    return pr;
  }

  // ---------- render ----------
  function render() {
    if (!ctx) return;
    const camX = G.cam.x + G.cam.sx, camY = G.cam.y + G.cam.sy;
    // bg tiles
    const ts = 256;
    const ox = -((camX % ts) + ts) % ts, oy = -((camY % ts) + ts) % ts;
    for (let x = ox - ts; x < W + ts; x += ts)
      for (let y = oy - ts; y < H + ts; y += ts)
        ctx.drawImage(SPR.bgTile, x, y);

    if (G.state === 'title') return;
    const p = G.player;
    if (!p) return;

    ctx.save();
    ctx.translate(-camX, -camY);

    // zones
    for (const z of G.zones) {
      const a = E.clamp(z.life / z.maxLife, 0, 1);
      ctx.globalAlpha = 0.25 + a * 0.45;
      const s = z.r * 2.2;
      ctx.drawImage(cloudSpr, z.x - s / 2, z.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;

    // gems (outlined sprites, gentle pulse so loot reads as loot)
    for (const g of G.gems) {
      const pu = 1 + Math.sin(G.time * 6 + g.x * 0.1) * 0.12;
      const gw = g.spr.width * pu, gh = g.spr.height * pu;
      ctx.drawImage(g.spr, g.x - gw / 2, g.y - gh / 2, gw, gh);
    }
    // pickups: additive glow halo + outlined sprite
    if (G.pickups.length) {
      ctx.globalCompositeOperation = 'lighter';
      for (const pk of G.pickups) {
        const glow = pk.kind === 'modelcard' ? SPR.glowPink : (pk.kind === 'chest' ? SPR.glowGold : SPR.glowCyan);
        const ga = 0.55 + Math.sin(G.time * 5 + pk.bob) * 0.3;
        ctx.globalAlpha = ga;
        ctx.drawImage(glow, pk.x - glow.width / 2, pk.y - glow.height / 2);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    for (const pk of G.pickups) {
      const bob = Math.sin(G.time * 4 + pk.bob) * 4;
      const s = pk.spr;
      if (pk.kind === 'chest' || pk.kind === 'modelcard') {
        ctx.save();
        ctx.translate(pk.x, pk.y + bob);
        ctx.rotate(Math.sin(G.time * 3 + pk.bob) * 0.12);
        ctx.drawImage(s, -s.width / 2, -s.height / 2);
        ctx.restore();
      } else {
        ctx.drawImage(s, pk.x - s.width / 2, pk.y - s.height / 2 + bob);
      }
    }

    // context window aura
    for (const w of p.weapons) {
      if ((w.id === 'contextWindow') && w.auraR > 0) {
        const evolved = w.evolved;
        ctx.strokeStyle = evolved ? 'rgba(255,216,77,0.55)' : 'rgba(57,215,255,0.4)';
        ctx.fillStyle = evolved ? 'rgba(255,216,77,0.06)' : 'rgba(57,215,255,0.05)';
        ctx.lineWidth = 2 + Math.sin(G.time * 5) * 1;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.arc(p.x, p.y, w.auraR, 0, E.TAU);
        ctx.fill(); ctx.stroke();
        ctx.setLineDash([]);
      }
      // embedding orbs
      if (w.id === 'embeddings' && w.orbs) {
        for (let i = 0; i < w.orbs.length; i += 3) {
          const ox2 = w.orbs[i], oy2 = w.orbs[i + 1], oa = w.orbs[i + 2];
          ctx.save();
          ctx.translate(ox2, oy2);
          ctx.rotate(oa + Math.PI / 2);
          ctx.drawImage(SPR.orb, -SPR.orb.width / 2, -SPR.orb.height / 2);
          ctx.restore();
        }
      }
    }

    // agents
    for (const a of G.agents) {
      if (a.kind === 'turret') {
        ctx.drawImage(SPR.turret, a.x - SPR.turret.width / 2, a.y - SPR.turret.height / 2);
      } else {
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.spinA);
        ctx.drawImage(SPR.claudeBuddy, -SPR.claudeBuddy.width / 2, -SPR.claudeBuddy.height / 2);
        ctx.restore();
      }
    }

    // enemies
    for (const e of G.enemies) {
      const s = e.flash > 0 ? whiteOf(e.spr) : e.spr;
      let alpha = 1;
      if (e.def.flicker) alpha = 0.55 + Math.sin(G.time * 17 + e.wobble) * 0.45;
      if (alpha < 1) ctx.globalAlpha = Math.max(0.15, alpha);
      const sc = e.elite ? 1.45 : 1;
      const sw = s.width * sc, sh = s.height * sc;
      ctx.drawImage(s, e.x - sw / 2, e.y - sh / 2, sw, sh);
      if (alpha < 1) ctx.globalAlpha = 1;
      if (e.boss || e.elite) {
        // mini hp bar
        const w2 = e.r * 1.6, pct = E.clamp(e.hp / e.maxhp, 0, 1);
        const barY = e.y - sh / 2 - 10;
        ctx.fillStyle = '#000';
        ctx.fillRect(e.x - w2 / 2, barY, w2, 5);
        ctx.fillStyle = e.boss ? '#ff3344' : '#ffd84d';
        ctx.fillRect(e.x - w2 / 2, barY, w2 * pct, 5);
      }
    }

    // player
    {
      const frame = SPR.player[p.moving ? ((p.anim | 0) % 2) : 0];
      const blink = p.invulnT > 0 && ((G.time * 12) | 0) % 2 === 0;
      if (!blink) {
        if (buffT > 0) {
          ctx.strokeStyle = 'hsl(' + ((G.time * 300) % 360) + ',100%,60%)';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(p.x, p.y, 30 + Math.sin(G.time * 10) * 4, 0, E.TAU); ctx.stroke();
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        if (p.faceX < 0) ctx.scale(-1, 1);
        const s = p.hurtFlash > 0 ? whiteOf(frame) : frame;
        ctx.drawImage(s, -frame.width / 2, -frame.height / 2);
        ctx.restore();
      }
    }

    // projectiles
    for (const pr of G.projs) {
      if (!pr.spr) continue;
      if (pr.kind === 'flame') {
        const lifeFrac = E.clamp(pr.life / 0.9, 0, 1);
        ctx.globalAlpha = 0.4 + lifeFrac * 0.6;
        const sc = 1.6 - lifeFrac * 0.8;
        ctx.drawImage(pr.spr, pr.x - pr.spr.width * sc / 2, pr.y - pr.spr.height * sc / 2, pr.spr.width * sc, pr.spr.height * sc);
        ctx.globalAlpha = 1;
      } else if (pr.spin) {
        ctx.save();
        ctx.translate(pr.x, pr.y);
        ctx.rotate(G.time * 12 + pr.phase * 3);
        ctx.drawImage(pr.spr, -pr.spr.width / 2, -pr.spr.height / 2);
        ctx.restore();
      } else if (pr.rot) {
        ctx.save();
        ctx.translate(pr.x, pr.y);
        ctx.rotate(pr.rot);
        ctx.drawImage(pr.spr, -pr.spr.width / 2, -pr.spr.height / 2);
        ctx.restore();
      } else {
        ctx.drawImage(pr.spr, pr.x - pr.spr.width / 2, pr.y - pr.spr.height / 2);
      }
    }

    // enemy projectiles
    for (const pr of G.eprojs) {
      const s = pr.kind === 'web' ? SPR.web : SPR.enemies.clip;
      ctx.save();
      ctx.translate(pr.x, pr.y);
      ctx.rotate(pr.rot);
      ctx.drawImage(s, -s.width / 2, -s.height / 2);
      ctx.restore();
    }

    // shockwave rings (expanding, fading)
    for (const rg of G.rings) {
      const f = 1 - rg.life / rg.maxLife;
      const rad = rg.r0 + (rg.r - rg.r0) * f;
      ctx.globalAlpha = (1 - f) * 0.85;
      ctx.strokeStyle = rg.color;
      ctx.lineWidth = 7 * (1 - f) + 1.5;
      ctx.beginPath(); ctx.arc(rg.x, rg.y, rad, 0, E.TAU); ctx.stroke();
      ctx.globalAlpha = (1 - f) * 0.18;
      ctx.fillStyle = rg.color;
      ctx.beginPath(); ctx.arc(rg.x, rg.y, rad, 0, E.TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // beams
    for (const b of G.beams) {
      const a = b.life / b.maxLife;
      ctx.globalAlpha = a;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.w + 4;
      ctx.globalAlpha = a * 0.3;
      ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
      ctx.globalAlpha = a;
      ctx.lineWidth = b.w;
      ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // particles
    for (const pt of G.parts) {
      ctx.globalAlpha = E.clamp(pt.life / pt.maxLife, 0, 1);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;

    // floating texts
    ctx.textAlign = 'center';
    for (const t of G.texts) {
      ctx.globalAlpha = E.clamp(t.life / t.maxLife * 1.5, 0, 1);
      ctx.font = '900 ' + t.size + 'px Impact, sans-serif';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.strokeText(t.str, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    // boss bar (drawn via DOM)
    let boss = null;
    for (const e of G.enemies) if (e.boss) { boss = e; break; }
    UI.bossBar(boss ? { name: e2name(boss), pct: boss.hp / boss.maxhp } : null);
  }
  function e2name(e) { return e.def.name; }

  // ---------- main loop ----------
  let lastTs = 0;
  function loop(ts) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;
    if (G.state === 'run') update(dt);
    render();
  }

  // ---------- input ----------
  function initInput() {
    window.addEventListener('keydown', ev => {
      const k = ev.key.toLowerCase();
      keys[k] = true;
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) ev.preventDefault();
      if (k === 'm') { const m = SFX.toggleMute(); UI.banner(m ? 'muted (silence is golden)' : 'unmuted (bass returns)'); UI.syncMuteBtn(); }
      if ((k === 'p' || k === 'escape')) togglePause();
      SFX.init();
      if (G.state === 'title') SFX.startMusic('menu');
    });
    // browsers only allow audio after a gesture: first click/tap on the
    // title screen kicks off the menu track
    window.addEventListener('pointerdown', () => {
      SFX.init();
      if (G.state === 'title') SFX.startMusic('menu');
    });
    window.addEventListener('keyup', ev => { keys[ev.key.toLowerCase()] = false; });
    window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
    initTouch();
  }

  function togglePause() {
    if (G.state === 'run') { G.state = 'pause'; UI.showPause(); SFX.pauseAll(); }
    else if (G.state === 'pause') { G.state = 'run'; UI.hidePause(); SFX.resumeAll(); }
  }

  function initTouch() {
    const JOY_MAX = 60, DEAD = 10;
    cv.addEventListener('touchstart', ev => {
      SFX.init();
      if (!joy.active) {
        const t = ev.changedTouches[0];
        joy.active = true; joy.id = t.identifier;
        joy.ox = t.clientX; joy.oy = t.clientY;
        joy.mx = 0; joy.my = 0;
        UI.joystick(joy.ox, joy.oy, joy.ox, joy.oy, true);
      }
      ev.preventDefault();
    }, { passive: false });
    cv.addEventListener('touchmove', ev => {
      for (const t of ev.changedTouches) {
        if (joy.active && t.identifier === joy.id) {
          let dx = t.clientX - joy.ox, dy = t.clientY - joy.oy;
          const d = Math.hypot(dx, dy);
          if (d > JOY_MAX) { dx *= JOY_MAX / d; dy *= JOY_MAX / d; }
          joy.mx = d > DEAD ? dx / JOY_MAX : 0;
          joy.my = d > DEAD ? dy / JOY_MAX : 0;
          UI.joystick(joy.ox, joy.oy, joy.ox + dx, joy.oy + dy, true);
        }
      }
      ev.preventDefault();
    }, { passive: false });
    const release = ev => {
      for (const t of ev.changedTouches) {
        if (joy.active && t.identifier === joy.id) {
          joy.active = false; joy.mx = 0; joy.my = 0;
          UI.joystick(0, 0, 0, 0, false);
        }
      }
    };
    cv.addEventListener('touchend', release);
    cv.addEventListener('touchcancel', release);
  }

  function resize() {
    DPR = Math.min(1.5, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * DPR; cv.height = H * DPR;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx = cv.getContext('2d');
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }

  // ---------- meta shop ----------
  function buyMeta(id) {
    const m = DATA.META[id];
    const rank = metaRanks[id] || 0;
    if (rank >= m.max) return false;
    const cost = m.cost(rank);
    if (bank < cost) return false;
    bank -= cost;
    metaRanks[id] = rank + 1;
    E.store.set('ts_bank', bank);
    E.store.set('ts_meta', JSON.stringify(metaRanks));
    SFX.play('coin');
    return true;
  }

  // ---------- smoke test (?test=1) ----------
  function smokeTest() {
    const out = [];
    try {
      G.testMode = true;
      startRun();
      // grant + max everything, then evolve
      for (const id in DATA.PASSIVES) G.player.passives[id] = DATA.PASSIVES[id].maxLv;
      recomputeStats();
      for (const id in DATA.WEAPONS) {
        let w = G.player.weapons.find(x => x.id === id) || addWeapon(id);
        w.lv = DATA.WEAPONS[id].maxLv;
        WeaponSys.computeStats(w);
      }
      for (const w of G.player.weapons) {
        w.evolved = true; w.evoId = DATA.WEAPONS[w.id].evo;
        WeaponSys.computeStats(w);
      }
      // exercise the touch joystick path (synthetic touch events)
      try {
        const mk = (x, y) => new Touch({ identifier: 7, target: cv, clientX: x, clientY: y });
        const x0 = G.player.x;
        cv.dispatchEvent(new TouchEvent('touchstart', { changedTouches: [mk(200, 300)], cancelable: true }));
        cv.dispatchEvent(new TouchEvent('touchmove', { changedTouches: [mk(260, 300)], cancelable: true }));
        for (let i = 0; i < 30; i++) update(1 / 60);
        cv.dispatchEvent(new TouchEvent('touchend', { changedTouches: [mk(260, 300)] }));
        out.push(G.player.x > x0 + 50 ? 'TOUCH_OK' : 'TOUCH_NOMOVE');
      } catch (err2) { out.push('TOUCH_FAIL ' + err2.message); }
      // one of each enemy
      for (const type in DATA.ENEMIES) spawnEnemy(type, G.player.x + E.rand(-300, 300), G.player.y + E.rand(-300, 300), false);
      keys.d = true;
      for (let i = 0; i < 900; i++) {
        update(1 / 60);
        if (i === 300) { G.time = 301; }      // trigger gpu boss
        if (i === 450) { G.time = 601; }      // trigger scraper
        if (i === 600) { G.time = 901; }      // trigger clippy
        if (G.state !== 'run') break;
      }
      keys.d = false;
      gainXp(500);
      openChest();
      render();
      // kill everything via bombs until clippy dies or cap
      for (let i = 0; i < 200 && G.state === 'run'; i++) {
        aoe(G.player.x, G.player.y, 99999, 5000, {});
        update(1 / 60);
      }
      out.push('SMOKE_OK state=' + G.state + ' kills=' + G.kills + ' level=' + G.level);
    } catch (err) {
      out.push('SMOKE_FAIL ' + err.message + ' :: ' + (err.stack || '').split('\n')[1]);
    }
    const el = document.getElementById('errlog');
    if (el) el.textContent += ' ' + out.join(' ');
  }

  // ---------- boot ----------
  function boot() {
    cv = document.getElementById('cv');
    resize();
    window.addEventListener('resize', resize);
    initInput();
    UI.init({
      startRun, quitToTitle, buyMeta, togglePause, setAutoPick,
      getBank: () => bank, getBest: () => bestTime, getMeta: () => metaRanks,
      getAutoPick: () => autoPick, getSeen: () => seenEnemies,
      resume: () => { G.state = 'run'; SFX.resumeAll(); },
    });
    // tab closed / backgrounded mid-run: bank what was earned so far
    window.addEventListener('pagehide', () => {
      if (['run', 'pause', 'levelup', 'chest'].includes(G.state)) bankRunCoins();
    });
    UI.showTitle();
    requestAnimationFrame(loop);
    if (location.search.includes('test=1')) setTimeout(smokeTest, 100);
    if (location.search.includes('demo=1')) setTimeout(demoScene, 100);
    if (location.search.includes('bestiary=1')) setTimeout(() => {
      let i = 0;
      for (const t in DATA.ENEMIES) if (DATA.ENEMIES[t].lore && i++ % 3) seenEnemies[t] = 1;
      document.querySelector('.bestiarybtn').click();
    }, 120);
  }

  // ?demo=1 -- jump into a staged mid-run scene (for screenshots / quick look)
  function demoScene() {
    startRun();
    G.time = 312;
    applyChoice({ type: 'weapon', id: 'contextWindow' });
    applyChoice({ type: 'weapon', id: 'embeddings' });
    applyChoice({ type: 'weapon', id: 'chainOfThought' });
    applyChoice({ type: 'passive', id: 'gpuCluster' });
    applyChoice({ type: 'passive', id: 'webCrawler' });
    for (const w of G.player.weapons) { w.lv = 4; WeaponSys.computeStats(w); }
    G.level = 9; G.kills = 312; G.coins = 87;
    G.xp = 10; G.xpNext = 99999; // hold level-ups so the scene stays visible
    for (let i = 0; i < 50; i++) {
      const a = E.rand(E.TAU), d = E.rand(160, 520);
      spawnEnemy(E.choice(['spam', 'markov', 'captcha', 'slop', 'scam']),
        G.player.x + Math.cos(a) * d, G.player.y + Math.sin(a) * d, false);
    }
    spawnEnemy('gpuBoss', G.player.x + 380, G.player.y - 120, false);
    for (let i = 0; i < 14; i++) dropGem(G.player.x + E.rand(-300, 300), G.player.y + E.rand(-300, 300), E.choice([1, 1, 5, 25]));
    dropPickup(G.player.x - 160, G.player.y + 120, 'chest');
    // &cards=1: pop a deterministic level-up to inspect recipe footers
    if (location.search.includes('cards=1')) {
      const ts = G.player.weapons.find(w => w.id === 'tokenStream');
      ts.lv = 7; WeaponSys.computeStats(ts);
      G.state = 'levelup';
      UI.showLevelup([
        { type: 'weapon', id: 'tokenStream' },
        { type: 'passive', id: 'gpuCluster' },
        { type: 'weapon', id: 'rag', isNew: true },
        { type: 'passive', id: 'kvCache', isNew: true },
      ], () => { G.state = 'run'; });
    }
    // &haul=N: preview a multi-upgrade chest reveal
    const hm = location.search.match(/haul=(\d)/);
    if (hm) {
      const pairs = [
        { type: 'passive', id: 'gpuCluster' }, { type: 'weapon', id: 'rag' },
        { type: 'weapon', id: 'embeddings', isNew: true }, { type: 'passive', id: 'kvCache', isNew: true },
        { type: 'weapon', id: 'temperature', isNew: true },
      ];
      UI.showChest({ coins: 7, upgrades: pairs.slice(0, +hm[1]) }, () => { G.state = 'run'; });
    }
  }

  // public API (used by WeaponSys + UI)
  Object.assign(G, {
    boot, startRun, quitToTitle,
    nearestEnemy, topEnemies, randomVisibleEnemy,
    fireProj, addBeam, addZone, hitEnemy, aoe, spark, ring, addText, shake,
    vacuumGems, announce: t => UI.banner(t),
    get buffT() { return buffT; },
  });
  return G;
})();

window.addEventListener('DOMContentLoaded', () => Game.boot());
