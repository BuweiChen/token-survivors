// ui.js -- all DOM UI: title, HUD, level-ups, chests, pause, end screens.
// Intentionally unhinged styling. The jank is the point. Performance is not.
'use strict';

const UI = (() => {
  let api = null;
  let root, hud, screens = {};
  let hpFill, hpText, xpFill, timerEl, killsEl, coinsEl, levelEl, iconRow, bannerBox, bossBox, bossFill, bossName, vign;
  let joyBase, joyKnob, muteBtn, tcardBox, bestiaryBox;
  const IS_TOUCH = 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
  let iconsDirty = true;
  let lastHp = -1, lastXp = -1, lastTime = -1, lastKills = -1, lastCoins = -1, lastLevel = -1;

  function h(tag, cls, html, parent) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (html !== undefined && html !== null) el.innerHTML = html;
    if (parent) parent.appendChild(el);
    return el;
  }

  const fmtTime = t => {
    const m = (t / 60) | 0, s = (t % 60) | 0;
    return m + ':' + String(s).padStart(2, '0');
  };

  // ---------------- init ----------------
  function init(gameApi) {
    api = gameApi;
    root = document.getElementById('ui');

    // vignette + banner + joystick live outside screens
    vign = h('div', 'vignette', '', root);
    bannerBox = h('div', 'bannerbox', '', root);
    joyBase = h('div', 'joybase hidden', '', root);
    joyKnob = h('div', 'joyknob hidden', '', root);
    tcardBox = h('div', 'tcardbox', '', root);
    bestiaryBox = h('div', 'bestiarybox', '', root);

    buildHud();
    buildTitle();
    buildLevelup();
    buildChest();
    buildPause();
    buildEnd('over');
    buildEnd('win');
  }

  // ---------------- HUD ----------------
  function buildHud() {
    hud = h('div', 'hud hidden', '', root);
    const xpBar = h('div', 'xpbar', '', hud);
    xpFill = h('div', 'xpfill', '', xpBar);
    levelEl = h('div', 'hudlevel', 'LV 1', hud);

    const topleft = h('div', 'topleft', '', hud);
    const hpBar = h('div', 'hpbar', '', topleft);
    hpFill = h('div', 'hpfill', '', hpBar);
    hpText = h('div', 'hptext', '', hpBar);
    iconRow = h('div', 'iconrow', '', topleft);

    timerEl = h('div', 'timer', '0:00', hud);

    const topright = h('div', 'topright', '', hud);
    killsEl = h('div', 'stat', '\uD83D\uDC80 0', topright);
    coinsEl = h('div', 'stat', '\uD83E\uDE99 0', topright);
    if (!IS_TOUCH) h('div', 'stat hint', '[M]ute [P]ause', topright);
    const btns = h('div', 'hudbtns', '', topright);
    const pauseBtn = h('button', 'hudbtn', '\u23F8\uFE0F', btns);
    pauseBtn.onclick = () => api.togglePause();
    muteBtn = h('button', 'hudbtn', '', btns);
    syncMuteBtn();
    muteBtn.onclick = () => { SFX.toggleMute(); syncMuteBtn(); };

    bossBox = h('div', 'bossbox hidden', '', hud);
    bossName = h('div', 'bossname', '', bossBox);
    const bb = h('div', 'bossbar', '', bossBox);
    bossFill = h('div', 'bossfill', '', bb);
  }

  function showHud(on) { hud.classList.toggle('hidden', !on); }
  function dirtyIcons() { iconsDirty = true; }
  function syncMuteBtn() { if (muteBtn) muteBtn.textContent = SFX.muted ? '\uD83D\uDD07' : '\uD83D\uDD0A'; }

  // floating joystick visuals (driven by game.js touch handlers)
  function joystick(bx, by, kx, ky, show) {
    joyBase.classList.toggle('hidden', !show);
    joyKnob.classList.toggle('hidden', !show);
    if (show) {
      joyBase.style.transform = 'translate(' + (bx - 55) + 'px,' + (by - 55) + 'px)';
      joyKnob.style.transform = 'translate(' + (kx - 24) + 'px,' + (ky - 24) + 'px)';
    }
  }

  function updateHud(G) {
    const hpPct = Math.max(0, G.player.hp / G.P.maxhp);
    if (Math.abs(hpPct - lastHp) > 0.002) {
      lastHp = hpPct;
      hpFill.style.width = (hpPct * 100) + '%';
      hpText.textContent = Math.ceil(G.player.hp) + '/' + Math.round(G.P.maxhp);
    }
    const xpPct = Math.min(1, G.xp / G.xpNext);
    if (Math.abs(xpPct - lastXp) > 0.004) { lastXp = xpPct; xpFill.style.width = (xpPct * 100) + '%'; }
    const tSec = G.time | 0;
    if (tSec !== lastTime) { lastTime = tSec; timerEl.textContent = fmtTime(tSec); }
    if (G.kills !== lastKills) { lastKills = G.kills; killsEl.textContent = '\uD83D\uDC80 ' + G.kills; }
    if (G.coins !== lastCoins) { lastCoins = G.coins; coinsEl.textContent = '\uD83E\uDE99 ' + G.coins; }
    if (G.level !== lastLevel) { lastLevel = G.level; levelEl.textContent = 'LV ' + G.level; }
    if (iconsDirty) {
      iconsDirty = false;
      let html = '';
      for (const w of G.player.weapons) {
        const def = DATA.WEAPONS[w.id];
        const icon = w.evolved ? DATA.EVOLUTIONS[w.evoId].icon : def.icon;
        const lv = w.evolved ? 'MAX' : w.lv;
        html += '<span class="wicon' + (w.evolved ? ' evo' : '') + '" title="' + (w.evolved ? DATA.EVOLUTIONS[w.evoId].name : def.name) + '">' + icon + '<i>' + lv + '</i></span>';
      }
      for (const id in G.player.passives) {
        html += '<span class="wicon pass" title="' + DATA.PASSIVES[id].name + '">' + DATA.PASSIVES[id].icon + '<i>' + G.player.passives[id] + '</i></span>';
      }
      iconRow.innerHTML = html;
    }
  }

  function bossBar(info) {
    if (!info) { bossBox.classList.add('hidden'); return; }
    bossBox.classList.remove('hidden');
    bossName.textContent = info.name;
    bossFill.style.width = (Math.max(0, info.pct) * 100) + '%';
  }

  // ---------------- banner ----------------
  const bannerQueue = [];
  let bannerBusy = false;
  function banner(text) {
    bannerQueue.push(text);
    pumpBanner();
  }
  function pumpBanner() {
    if (bannerBusy || !bannerQueue.length) return;
    bannerBusy = true;
    const el = h('div', 'banner', bannerQueue.shift(), bannerBox);
    setTimeout(() => { el.classList.add('out'); }, 2600);
    setTimeout(() => { el.remove(); bannerBusy = false; pumpBanner(); }, 3100);
  }

  // ---------------- title cards (bosses slam, elites slide) ----------------
  function titleCard(title, sub, kind) {
    const card = h('div', 'tcard ' + kind, '', tcardBox);
    if (kind === 'boss') {
      h('div', 'tbar top', '', card);
      h('div', 'tbar bot', '', card);
    }
    h('div', 'ttitle', title, card);
    if (sub) h('div', 'tsub', sub, card);
    const life = kind === 'boss' ? 3000 : 1800;
    setTimeout(() => card.classList.add('out'), life - 400);
    setTimeout(() => card.remove(), life);
  }

  // ---------------- bestiary (first encounter, ever) ----------------
  const bestQueue = [];
  let bestBusy = false;
  function bestiary(type, def) {
    bestQueue.push(def);
    pumpBestiary();
  }
  function pumpBestiary() {
    if (bestBusy || !bestQueue.length) return;
    bestBusy = true;
    const def = bestQueue.shift();
    const toast = h('div', 'besttoast', '', bestiaryBox);
    h('div', 'bhead', E.choice(DATA.BESTIARY_HEADERS), toast);
    const row = h('div', 'brow', '', toast);
    const spr = SPR.enemies[def.spr];
    const c = document.createElement('canvas');
    c.width = spr.width; c.height = spr.height;
    c.getContext('2d').drawImage(spr, 0, 0);
    c.className = 'bspr';
    row.appendChild(c);
    const info = h('div', 'binfo', '', row);
    h('div', 'bname', def.name, info);
    h('div', 'blore', def.lore, info);
    h('div', 'bstats', 'HP ' + def.hp + ' / SPD ' + def.spd + ' / DMG ' + def.dmg, info);
    if (def.tip) h('div', 'btip', '>> ' + def.tip, info);
    SFX.play('bestiary');
    setTimeout(() => toast.classList.add('out'), 5600);
    setTimeout(() => { toast.remove(); bestBusy = false; pumpBestiary(); }, 6000);
  }

  // ---------------- screens ----------------
  function showScreen(name) {
    for (const k in screens) screens[k].classList.toggle('hidden', k !== name);
  }
  function hideAll() {
    for (const k in screens) screens[k].classList.add('hidden');
  }

  // ---------------- title ----------------
  let shopBox, bankEl, bestEl;
  function buildTitle() {
    const s = h('div', 'screen title hidden', '', root);
    screens.title = s;
    h('div', 'sticker s1', '\uD83D\uDD25', s);
    h('div', 'sticker s2', '\uD83D\uDC80', s);
    h('div', 'sticker s3', '\uD83E\uDDE0', s);
    h('div', 'sticker s4', '\uD83D\uDCC9', s);
    h('div', 'logo', 'TOKEN<br>SURVIVORS', s);
    h('div', 'subtitle', 'a 100% organic free-range LLM-themed bullet heaven', s);
    const start = h('button', 'bigbtn start', '\u25B6 START RUN (free tier)', s);
    start.onclick = () => { SFX.init(); api.startRun(); };
    h('div', 'controls', (IS_TOUCH
      ? 'Touch and drag anywhere to move. Everything else is automatic.'
      : 'WASD to move. Everything else is automatic.') +
      '<br>Survive 15:00. Defeat what awaits at the end.', s);

    const shopWrap = h('div', 'shopwrap', '', s);
    h('div', 'shoptitle', '\uD83C\uDFD7\uFE0F PRETRAINING (permanent upgrades)', shopWrap);
    bankEl = h('div', 'bank', '', shopWrap);
    shopBox = h('div', 'shop', '', shopWrap);
    bestEl = h('div', 'best', '', s);
    const marq = h('div', 'marquee', '', s);
    h('span', null, DATA.MARQUEE + ' ' + DATA.MARQUEE, marq);
  }

  function renderShop() {
    const ranks = api.getMeta();
    bankEl.innerHTML = '\uD83E\uDE99 ' + api.getBank() + ' compute credits';
    shopBox.innerHTML = '';
    for (const id in DATA.META) {
      const m = DATA.META[id];
      const rank = ranks[id] || 0;
      const maxed = rank >= m.max;
      const cost = maxed ? null : m.cost(rank);
      const card = h('div', 'shopitem' + (maxed ? ' maxed' : ''), '', shopBox);
      h('div', 'shopicon', m.icon, card);
      h('div', 'shopname', m.name, card);
      h('div', 'shopdesc', m.desc, card);
      h('div', 'shoprank', '\u25B0'.repeat(rank) + '\u25B1'.repeat(m.max - rank), card);
      const btn = h('button', 'shopbtn', maxed ? 'MAXED' : '\uD83E\uDE99 ' + cost, card);
      if (!maxed) btn.onclick = () => { if (api.buyMeta(id)) renderShop(); else btn.classList.add('nope'); setTimeout(() => btn.classList.remove('nope'), 300); };
      else btn.disabled = true;
    }
  }

  function showTitle() {
    showScreen('title');
    renderShop();
    const best = api.getBest();
    bestEl.textContent = best > 0 ? ('best run: ' + fmtTime(best) + ' (impressive, almost)') : 'no runs yet. the slop awaits.';
  }

  // ---------------- level up ----------------
  let lvHeader, lvCards, lvCb;
  function buildLevelup() {
    const s = h('div', 'screen modal hidden', '', root);
    screens.levelup = s;
    const box = h('div', 'modalbox', '', s);
    lvHeader = h('div', 'modalheader', '', box);
    lvCards = h('div', 'cards', '', box);
  }

  function cardHtml(c) {
    if (c.type === 'weapon') {
      const def = DATA.WEAPONS[c.id];
      const w = Game.player.weapons.find(x => x.id === c.id);
      const lv = w ? w.lv : 0;
      const next = lv + 1;
      const tag = lv === 0 ? '<span class="tag new">NEW!</span>' : '<span class="tag">LV ' + lv + ' \u2192 ' + next + '</span>';
      const detail = lv === 0 ? def.desc : def.lvlDesc[lv - 1];
      const evoHint = '<div class="evohint">evolves with ' + DATA.PASSIVES[def.evolvesWith].icon + ' ' + DATA.PASSIVES[def.evolvesWith].name + '</div>';
      return '<div class="cicon">' + def.icon + '</div><div class="cname">' + def.name + '</div>' + tag +
        '<div class="cdesc">' + detail + '</div>' + (lv === 0 ? evoHint : '');
    }
    if (c.type === 'passive') {
      const def = DATA.PASSIVES[c.id];
      const lv = Game.player.passives[c.id] || 0;
      const tag = lv === 0 ? '<span class="tag new">NEW!</span>' : '<span class="tag">LV ' + lv + ' \u2192 ' + (lv + 1) + '</span>';
      return '<div class="cicon">' + def.icon + '</div><div class="cname">' + def.name + '</div>' + tag +
        '<div class="cdesc">' + (lv === 0 ? def.desc : def.fmt) + '</div>';
    }
    const def = DATA.BONUS[c.id];
    return '<div class="cicon">' + def.icon + '</div><div class="cname">' + def.name + '</div><div class="cdesc">' + def.desc + '</div>';
  }

  function showLevelup(choices, cb) {
    lvCb = cb;
    lvHeader.textContent = E.choice(DATA.LEVELUP_HEADERS);
    lvCards.innerHTML = '';
    choices.forEach((c, i) => {
      const card = h('div', 'card', cardHtml(c), lvCards);
      card.style.setProperty('--rot', (E.rand(-3, 3)) + 'deg');
      card.style.animationDelay = (i * 0.07) + 's';
      const pick = () => {
        screens.levelup.classList.add('hidden');
        const f = lvCb; lvCb = null;
        if (f) f(c);
      };
      card.onclick = pick;
      // build complete: offer to stop asking and grab this bonus forever
      if (c.type === 'bonus') {
        const auto = h('button', 'autobtn', 'ALWAYS PICK THIS (stop asking)', card);
        auto.onclick = ev => {
          ev.stopPropagation();
          api.setAutoPick(c.id);
          banner('auto-pick ON: ' + DATA.BONUS[c.id].name + ' (change it in pause menu)');
          pick();
        };
      }
    });
    showScreen('levelup');
  }

  // ---------------- chest ----------------
  let chestBox, chestCb;
  function buildChest() {
    const s = h('div', 'screen modal hidden', '', root);
    screens.chest = s;
    chestBox = h('div', 'modalbox chestbox', '', s);
  }

  function showChest(result, cb) {
    chestCb = cb;
    chestBox.innerHTML = '';
    h('div', 'modalheader', '\uD83D\uDCE6 MODEL DROP', chestBox);
    const spinner = h('div', 'chestspin', '\uD83D\uDCE6', chestBox);
    const reveal = h('div', 'chestreveal hidden', '', chestBox);

    if (result.evo) {
      const evo = DATA.EVOLUTIONS[result.evo];
      h('div', 'evocard', '<div class="cicon big">' + evo.icon + '</div><div class="evoname">' + evo.name + '</div>' +
        '<div class="evotag">\u2B50 FRONTIER MODEL UNLOCKED \u2B50</div><div class="cdesc">' + evo.flavor + '</div>', reveal);
    } else if (result.upgrades && result.upgrades.length) {
      const list = h('div', 'chestlist', '', reveal);
      for (const c of result.upgrades) {
        const def = c.type === 'weapon' ? DATA.WEAPONS[c.id] : c.type === 'passive' ? DATA.PASSIVES[c.id] : DATA.BONUS[c.id];
        h('div', 'chestitem', def.icon + ' ' + def.name + (c.isNew ? ' <span class="tag new">NEW!</span>' : ' \u2B06'), list);
      }
    } else {
      h('div', 'chestitem', 'just vibes in this one', reveal);
    }
    h('div', 'chestcoins', '+\uD83E\uDE99 ' + result.coins + ' credits', reveal);
    const btn = h('button', 'bigbtn small hidden', result.evo ? 'LFG \uD83D\uDE80' : 'GG', reveal);
    btn.onclick = () => {
      screens.chest.classList.add('hidden');
      const f = chestCb; chestCb = null;
      if (f) f();
    };

    showScreen('chest');
    setTimeout(() => {
      spinner.classList.add('hidden');
      reveal.classList.remove('hidden');
      btn.classList.remove('hidden');
      if (result.evo) banner(DATA.EVOLUTIONS[result.evo].announce);
    }, result.evo ? 1400 : 900);
  }

  // ---------------- pause ----------------
  let pauseRecipes, pauseAuto;
  function buildPause() {
    const s = h('div', 'screen modal hidden', '', root);
    screens.pause = s;
    const box = h('div', 'modalbox', '', s);
    h('div', 'modalheader', '\u23F8 PAUSED (touching grass)', box);
    pauseRecipes = h('div', 'recipes', '', box);
    pauseAuto = h('div', 'autorow', '', box);
    const row = h('div', 'btnrow', '', box);
    const res = h('button', 'bigbtn small', 'RESUME', row);
    res.onclick = () => { screens.pause.classList.add('hidden'); api.resume(); };
    const quit = h('button', 'bigbtn small gray', 'RAGE QUIT', row);
    quit.onclick = () => api.quitToTitle();
  }

  function showPause() {
    let html = '<div class="rectitle">your build:</div>';
    for (const w of Game.player.weapons) {
      const def = DATA.WEAPONS[w.id];
      if (w.evolved) {
        const evo = DATA.EVOLUTIONS[w.evoId];
        html += '<div class="recipe done">' + evo.icon + ' <b>' + evo.name + '</b> (frontier model, GGs)</div>';
      } else {
        const pas = DATA.PASSIVES[def.evolvesWith];
        const has = (Game.player.passives[def.evolvesWith] || 0) > 0;
        const ready = w.lv >= def.maxLv && has;
        html += '<div class="recipe' + (ready ? ' ready' : '') + '">' + def.icon + ' ' + def.name + ' lv' + w.lv + '/' + def.maxLv +
          ' + ' + pas.icon + ' ' + pas.name + (has ? ' \u2714' : ' \u2718') +
          ' \u2192 ' + DATA.EVOLUTIONS[def.evo].icon + ' ' + DATA.EVOLUTIONS[def.evo].name +
          (ready ? ' <b>(OPEN A \uD83D\uDCE6 CHEST!)</b>' : '') + '</div>';
      }
    }
    pauseRecipes.innerHTML = html;
    pauseAuto.innerHTML = '';
    const ap = api.getAutoPick();
    if (ap) {
      pauseAuto.appendChild(document.createTextNode('auto-pick: ' + DATA.BONUS[ap].icon + ' ' + DATA.BONUS[ap].name + ' '));
      const off = h('button', 'autobtn inline', 'turn off', pauseAuto);
      off.onclick = () => { api.setAutoPick(''); showPause(); };
    }
    showScreen('pause');
  }
  function hidePause() { screens.pause.classList.add('hidden'); }

  // ---------------- end screens ----------------
  const endEls = {};
  function buildEnd(kind) {
    const s = h('div', 'screen modal hidden', '', root);
    screens[kind] = s;
    const box = h('div', 'modalbox endbox', '', s);
    const head = h('div', 'modalheader big', '', box);
    const sub = h('div', 'endsub', '', box);
    const stats = h('div', 'endstats', '', box);
    const row = h('div', 'btnrow', '', box);
    const retry = h('button', 'bigbtn small', 'RUN IT BACK', row);
    retry.onclick = () => api.startRun();
    const title = h('button', 'bigbtn small gray', 'TITLE', row);
    title.onclick = () => api.quitToTitle();
    endEls[kind] = { head, sub, stats };
  }

  function fillEnd(kind, stats) {
    const e = endEls[kind];
    if (kind === 'win') {
      e.head.innerHTML = '\uD83C\uDFC6 AGI ACHIEVED (internally)';
      e.sub.textContent = 'You defeated the Paperclip Maximizer. The slop has been aligned. You shipped to prod.';
    } else {
      e.head.innerHTML = '\uD83D\uDC80 YOU GOT RATE LIMITED';
      e.sub.textContent = E.choice(DATA.DEATH_LINES);
    }
    e.stats.innerHTML =
      '<div>\u23F1 survived: <b>' + fmtTime(stats.time) + '</b></div>' +
      '<div>\uD83D\uDCC8 level: <b>' + stats.level + '</b></div>' +
      '<div>\uD83D\uDC80 slop deleted: <b>' + stats.kills + '</b></div>' +
      '<div>\uD83E\uDE99 credits banked: <b>+' + stats.earned + '</b></div>';
    showScreen(kind);
  }
  const showOver = stats => fillEnd('over', stats);
  const showWin = stats => fillEnd('win', stats);

  // ---------------- vignette ----------------
  let vignT = null;
  function vignette() {
    vign.classList.add('on');
    if (vignT) clearTimeout(vignT);
    vignT = setTimeout(() => vign.classList.remove('on'), 220);
  }

  return {
    init, showTitle, hideAll, showHud, updateHud, dirtyIcons,
    showLevelup, showChest, showPause, hidePause, showOver, showWin,
    banner, bossBar, vignette, joystick, syncMuteBtn, titleCard, bestiary,
  };
})();
