// sprites.js -- all pixel art, generated procedurally onto offscreen canvases.
// Art is authored as ASCII pattern strings, rendered at SCALE px per art-pixel.
'use strict';

const SPR = (() => {
  const SCALE = 3;

  function pat(rows, map, scale = SCALE) {
    const h = rows.length, w = Math.max(...rows.map(r => r.length));
    const c = document.createElement('canvas');
    c.width = w * scale; c.height = h * scale;
    const g = c.getContext('2d');
    for (let y = 0; y < h; y++) for (let x = 0; x < rows[y].length; x++) {
      const col = map[rows[y][x]];
      if (col) { g.fillStyle = col; g.fillRect(x * scale, y * scale, scale, scale); }
    }
    return c;
  }

  // ---------- PLAYER: little AI agent robot, 2 walk frames ----------
  const P_MAP = {
    o: '#ffb347', // antenna glow
    g: '#3d4458', // dark body
    b: '#5b6480', // body
    h: '#e8ecf5', // face plate
    e: '#23d7ff', // eyes
    m: '#1b1e2b', // outline-ish
    l: '#2c3245', // legs
    s: '#ff5db1', // cheek
  };
  const player0 = pat([
    '......o.........',
    '......m.........',
    '....mmmmmm......',
    '...mbbbbbbm.....',
    '...mbhhhhbm.....',
    '...mbhehebm.....',
    '...mbhhhhbm.....',
    '...mbhshsbm.....',
    '...mbbbbbbm.....',
    '....mggggm......',
    '...mbggggbm.....',
    '...mbggggbm.....',
    '....mggggm......',
    '....ml..lm......',
    '....ll..ll......',
    '...ll....ll.....',
  ], P_MAP);
  const player1 = pat([
    '.......o........',
    '......m.........',
    '....mmmmmm......',
    '...mbbbbbbm.....',
    '...mbhhhhbm.....',
    '...mbhehebm.....',
    '...mbhhhhbm.....',
    '...mbhshsbm.....',
    '...mbbbbbbm.....',
    '....mggggm......',
    '...mbggggbm.....',
    '...mbggggbm.....',
    '....mggggm......',
    '....ll..ml......',
    '...ll....ll.....',
    '....l....l......',
  ], P_MAP);

  // ---------- ENEMIES ----------
  // spam bot: angry envelope
  const spam = pat([
    '..............',
    '.mmmmmmmmmmmm.',
    '.mwwwwwwwwwwm.',
    '.mwm......mwm.',
    '.mwwm....mwwm.',
    '.mw.wm..mw.wm.',
    '.mw..wmmw..wm.',
    '.mwrr.ww.rrwm.',
    '.mwrr....rrwm.',
    '.mwwwwwwwwwwm.',
    '.mmmmmmmmmmmm.',
    '..............',
  ], { m: '#7a3030', w: '#e8d8c8', r: '#ff2222' });

  // markov chain: green wiggly chain links
  const markov = pat([
    '..mmm.....',
    '.mgggm....',
    '.mg.gmmm..',
    '.mgggmggm.',
    '..mmmg.gm.',
    '..mgggggm.',
    '.mg.gmmm..',
    '.mgggm....',
    '..mmm.....',
  ], { m: '#1e5c2e', g: '#52e07a' });

  // captcha: select-all-traffic-lights tile
  const captcha = pat([
    'mmmmmmmmmmmmmm',
    'mwwwwwwwwwwwwm',
    'mwggwwggwwrrwm',
    'mwggwwggwwrrwm',
    'mwwwwwwwwwwwwm',
    'mwggwwrrwwggwm',
    'mwggwwrrwwggwm',
    'mwwwwwwwwwwwwm',
    'mwbbwwwwwwwwwm',
    'mwbvwwccccccwm',
    'mwbbwwwwwwwwwm',
    'mwwwwwwwwwwwwm',
    'mmmmmmmmmmmmmm',
  ], { m: '#3a6ea5', w: '#f4f4f4', g: '#9aa7b0', r: '#cf3b3b', b: '#3a6ea5', v: '#ffffff', c: '#c8c8c8' });

  // slop blob: melting beige goo with dead smile
  const slop = pat([
    '....pppp....',
    '..pppppppp..',
    '.pppPPPPppp.',
    '.ppPmPPmPpp.',
    '.ppPPPPPPpp.',
    'pppPmmmmPppp',
    'ppppPPPPpppp',
    '.pppppppppp.',
    '..pp.pp.pp..',
    '..p...p..p..',
  ], { p: '#d9a86c', P: '#f3cf9b', m: '#5b3a1e' });

  // scam bot: crypto coin with $ eyes
  const scam = pat([
    '...mmmmmm...',
    '..mggggggm..',
    '.mgyyyyyygm.',
    '.mgydyydygm.',
    '.mgyyyyyygm.',
    '.mgyydddyym.',
    '.mgydyyyygm.',
    '.mgyyyddygm.',
    '.mgydddyygm.',
    '.mgyyyyyygm.',
    '..mggggggm..',
    '...mmmmmm...',
  ], { m: '#6b5310', g: '#c9a227', y: '#ffd84d', d: '#8a6d12' });

  // deepfake: glitchy purple copy of the player
  const deepfake = pat([
    '......o.........',
    '......m.........',
    '....mmmmmm......',
    '...mbbbbbbm.....',
    '...mbhhhhbm.....',
    '...mbhehebm.....',
    '...mbhhthbm.....',
    '...mbhshsbm.....',
    '...mbbtbbbm.....',
    '....mggggm......',
    '...mbgtgggm.....',
    '...mbggggbm.....',
    '....mggggm......',
    '....ml..lm......',
    '....ll..ll......',
    '...ll....ll.....',
  ], { o: '#ff47ff', m: '#240b2e', b: '#7a3f96', h: '#d8b6e8', e: '#ff1f5a', s: '#ff1f5a', g: '#4a2360', l: '#341744', t: '#00ffd0' });

  // paywall: brick wall with lock
  const paywall = pat([
    'mmmmmmmmmmmmmm',
    'mrrrmrrrmrrrrm',
    'mrrrmrrrmrrrrm',
    'mmmmmmmmmmmmmm',
    'mrrmrryyrrmrrm',
    'mrrmryllyrmrrm',
    'mmmmmyllymmmmm',
    'mrrrmyyyymrrrm',
    'mrrrmrrrrmrrrm',
    'mmmmmmmmmmmmmm',
    'mrrmrrrmrrmrrm',
    'mrrmrrrmrrmrrm',
    'mmmmmmmmmmmmmm',
  ], { m: '#4a2c20', r: '#a14f38', y: '#ffd84d', l: '#3a2c10' });

  // prompt injector: purple syringe
  const injector = pat([
    '..........mm..',
    '.........mppm.',
    '........mppm..',
    '...mmmmmppm...',
    '..mvvvvvpm....',
    '..mvNvNvm.....',
    '..mvvvvvm.....',
    '...mmmmm......',
    '..mm..........',
    '.mm...........',
  ], { m: '#2b0f3a', p: '#b95cff', v: '#e2c4ff', N: '#7a2bd0' });

  // BOSS: GPU Shortage -- a giant green GPU card with two fans
  const gpuBoss = pat([
    'mmmmmmmmmmmmmmmmmmmmmm',
    'mggggggggggggggggggggm',
    'mgGGGGGGGGGGGGGGGGGGgm',
    'mgGffffGGGGGGffffGGGgm',
    'mgGfwwfGGGGGGfwwfGGGgm',
    'mgGfwwfGGeeGGfwwfGGGgm',
    'mgGffffGGeeGGffffGGGgm',
    'mgGGGGGGGGGGGGGGGGGGgm',
    'mgGyyGyyGyyGyyGyyGGGgm',
    'mggggggggggggggggggggm',
    'mmmm.mmm.mmm.mmm.mmmmm',
  ], { m: '#0c2a14', g: '#1f5c2f', G: '#2e8a47', f: '#123820', w: '#9be8b0', e: '#ff3b3b', y: '#ffd84d' }, 4);

  // BOSS: The Scraper -- black widow spider with an antenna
  const scraperBoss = pat([
    '..l..........l..',
    '.l.l........l.l.',
    '.l..l..oo..l..l.',
    'l...lmmmmmml...l',
    'l..mmbbbbbbmm..l',
    '.lmbbrbbbbrbbml.',
    '.lmbbbbbbbbbbml.',
    'l.mbbbrbbrbbbm.l',
    'l..mbbbbbbbbm..l',
    '.l..mmbbbbmm..l.',
    '.l.l..mmmm..l.l.',
    '..l..l....l..l..',
  ], { l: '#222230', m: '#08080d', b: '#1b1b26', r: '#ff2244', o: '#ffb347' }, 4);

  // FINAL BOSS: CLIPPY, the Paperclip Maximizer
  const clippy = pat([
    '....ssssss....',
    '...ss....ss...',
    '..ss......ss..',
    '..ss......ss..',
    '..ss.WW.WWss..',
    '..ss.WeKWeKs..',
    '..ss.WW.WWss..',
    '..ss......ss..',
    '.sSss.....ss..',
    '.sS.ss....ss..',
    '.sS..s....ss..',
    '.sS.......ss..',
    '.sSsssssssS...',
    '..sssssssS....',
  ], { s: '#aab4c8', S: '#7f8aa3', W: '#ffffff', e: '#1b1e2b', K: '#1b1e2b' }, 5);

  // clippy minion: lil paperclip
  const clip = pat([
    '.sss.',
    's...s',
    's.s.s',
    's.s.s',
    's.ss.',
    's....',
    '.sss.',
  ], { s: '#c4cde0' });

  // outline a sprite: stamp its silhouette in 8 directions, tint, redraw on top.
  // makes friendly drops pop against the enemy/projectile noise.
  function outlined(spr, color, px = 2) {
    const c = document.createElement('canvas');
    c.width = spr.width + px * 2; c.height = spr.height + px * 2;
    const g = c.getContext('2d');
    for (const [dx, dy] of [[-px, 0], [px, 0], [0, -px], [0, px], [-px, -px], [px, -px], [-px, px], [px, px]])
      g.drawImage(spr, px + dx, px + dy);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'source-over';
    g.drawImage(spr, px, px);
    return c;
  }

  // soft radial glow blob, drawn additively under pickups
  function glowSprite(r, color) {
    const c = document.createElement('canvas');
    c.width = c.height = r * 2;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(r, r, 2, r, r, r);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, r * 2, r * 2);
    return c;
  }

  // ---------- PICKUPS ----------
  const gemColors = { 1: '#39d7ff', 5: '#54ff8e', 25: '#d06bff', 100: '#ffd84d' };
  function gem(col) {
    return pat([
      '..g..',
      '.ggg.',
      'ggWgg',
      '.ggg.',
      '..g..',
    ], { g: col, W: '#ffffff' });
  }
  const gems = {
    1: outlined(gem(gemColors[1]), 'rgba(255,255,255,0.9)', 1),
    5: outlined(gem(gemColors[5]), 'rgba(255,255,255,0.9)', 1),
    25: outlined(gem(gemColors[25]), 'rgba(255,255,255,0.9)', 1),
    100: outlined(gem(gemColors[100]), 'rgba(255,255,255,0.95)', 2),
  };

  const coin = pat([
    '.ggg.',
    'gyyyg',
    'gydyg',
    'gyyyg',
    '.ggg.',
  ], { g: '#0f7a3a', y: '#37e07a', d: '#0c5c2c' });

  // browser cookie: rare tiny heal from normal enemies
  const cookie = pat([
    '.bbbb.',
    'bbcbbb',
    'bbbbcb',
    'bcbbbb',
    'bbbcbb',
    '.bbbb.',
  ], { b: '#d9a45c', c: '#5b3a1e' });

  const coffee = pat([
    '.w.w..',
    'w.w...',
    'mmmmm.',
    'mccmms',
    'mccmms',
    'mccmm.',
    '.mmm..',
  ], { m: '#e8ecf5', c: '#6b4226', w: '#cccccc', s: '#e8ecf5' });

  const magnet = pat([
    'rr..bb',
    'rr..bb',
    'rr..bb',
    'rrrrbb',
    '.rrrr.',
  ], { r: '#ff4444', b: '#4488ff' });

  const bomb = pat([
    '...ss.',
    '..s...',
    '.mmm..',
    'mmmmm.',
    'mmwmm.',
    'mmmmm.',
    '.mmm..',
  ], { m: '#23262f', w: '#e8ecf5', s: '#ffb347' });

  const vpn = pat([
    '.bbbb.',
    'bbwwbb',
    'bwbbwb',
    'bwbbwb',
    '.bwwb.',
    '..bb..',
  ], { b: '#3a6ea5', w: '#aee3ff' });

  // chest: a cardboard MODEL DROP box with tape
  const chest = pat([
    '.mmmmmmmmmm.',
    'mccccttccccm',
    'mccccttccccm',
    'mmmmmmmmmmmm',
    'mccccttccccm',
    'mcAccttccIcm',
    'mccccttccccm',
    'mccccttccccm',
    'mmmmmmmmmmmm',
  ], { m: '#6b4226', c: '#b07a45', t: '#d8c060', A: '#3d2510', I: '#3d2510' });

  // model card: holographic rare card
  const modelcard = pat([
    'mmmmmmm',
    'mhhhhgm',
    'mhWWhgm',
    'mhWWhgm',
    'mhhhhgm',
    'mgggggm',
    'mmmmmmm',
  ], { m: '#2b2b40', h: '#7df9ff', g: '#ff7df9', W: '#ffffff' });

  // ---------- PROJECTILE / WEAPON BITS ----------
  const doc = pat([
    'wwwww.',
    'wllllw',
    'wwwwww',
    'wllllw',
    'wwwwww',
    'wlllww',
    'wwwwww',
  ], { w: '#f0f0e8', l: '#7a8aa0' });

  const orb = pat([
    '.cc.',
    'cCCc',
    'cCCc',
    '.cc.',
  ], { c: '#23d7ff', C: '#b0f4ff' });

  const flame0 = pat([
    '..r..',
    '.rro.',
    'rooyr',
    '.oyo.',
  ], { r: '#ff4422', o: '#ff9933', y: '#ffe066' });
  const flame1 = pat([
    '.r.r.',
    '.oro.',
    'royor',
    '.oyo.',
  ], { r: '#ff4422', o: '#ff9933', y: '#ffe066' });

  // GROK: cold, unhinged dark-blue/violet flames
  const dflame0 = pat([
    '..b..',
    '.bbv.',
    'bvvcb',
    '.vcv.',
  ], { b: '#1a1f8c', v: '#5b2ed6', c: '#48d0ff' });
  const dflame1 = pat([
    '.b.b.',
    '.vbv.',
    'bvcvb',
    '.vcv.',
  ], { b: '#1a1f8c', v: '#5b2ed6', c: '#48d0ff' });
  // ground residue patch (drawn scaled, additive)
  const emberPatch = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(16, 16, 2, 16, 16, 16);
    grad.addColorStop(0, 'rgba(90,46,214,0.9)');
    grad.addColorStop(0.6, 'rgba(40,30,160,0.5)');
    grad.addColorStop(1, 'rgba(20,20,80,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
    return c;
  })();

  const gdOrb = pat([
    '.pp.',
    'pPPp',
    'pPWp',
    '.pp.',
  ], { p: '#8a3fd0', P: '#c07fff', W: '#ffffff' });

  const halluc = pat([
    '.m.m.',
    'mqqqm',
    '.qWq.',
    'mqqqm',
    '.m.m.',
  ], { m: '#ff47b8', q: '#b347ff', W: '#ffffff' });

  const turret = pat([
    '..mm..',
    '.mssm.',
    'msyysm',
    '.mssm.',
    '..mm..',
    '.m..m.',
    'mm..mm',
  ], { m: '#2c3245', s: '#8a93ad', y: '#ffd84d' });

  // claude buddy: little orange starburst agent (it's an asterisk with a face)
  const claudeBuddy = pat([
    '..o..o..',
    '.oo..oo.',
    '..oooo..',
    'oooBBooo',
    'oooBBooo',
    '..oooo..',
    '.oo..oo.',
    '..o..o..',
  ], { o: '#e07b39', B: '#1b1e2b' });

  // LLaMA fork: a friendly llama (side view), green collar + green outline
  // so it clearly reads as on your team. ears, snout, upright neck, fluffy
  // body, tail, four legs.
  const llama = pat([
    '......b.b.',
    '......bbb.',
    '......bbe.',
    '.....bbb..',
    '....bb....',
    '...bbb....',
    '.bbbbbbb..',
    'bbbbbbbbb.',
    'bbbbbbbbb.',
    'b.bb.bb...',
    'l.ll.ll...',
  ], { b: '#f3e3c0', e: '#1b1e2b', l: '#b89a66' });

  // llama spit glob
  const spit = pat([
    '.gg.',
    'gGGg',
    'gGGg',
    '.gg.',
  ], { g: '#3ca85a', G: '#9bf0ad' });

  // Cursor caret: a text-editor I-beam
  const caret = pat([
    'w.w',
    '.w.',
    '.w.',
    '.w.',
    '.w.',
    '.w.',
    'w.w',
  ], { w: '#aef0ff' });

  // floating heart (ChatGPT glaze heal)
  const heart = pat([
    '.h.h.',
    'hhhhh',
    'hhhhh',
    '.hhh.',
    '..h..',
  ], { h: '#ff79c6' });

  // scraper web shot
  const web = pat([
    'w..w..w',
    '.w.w.w.',
    '..www..',
    'wwwwwww',
    '..www..',
    '.w.w.w.',
    'w..w..w',
  ], { w: '#cfd8ea' });

  const lightning = pat([
    '...yy.',
    '..yy..',
    '.yyyy.',
    '...yy.',
    '..yy..',
    '.yy...',
  ], { y: '#ffe94d' });

  // ---------- TOKEN PROJECTILES: tiny word capsules ----------
  const TOKEN_WORDS = ['the', 'a', 'is', 'an', 'of', 'to', 'ok', 'lol', 'AI', 'gm', 'sus', 'no', 'yes', 'bro'];
  const CRIT_WORDS = ['AGI', 'based', '\uD83D\uDC80', 'ratio'];
  const tokenCache = {};
  function token(word, crit) {
    const key = word + (crit ? '!' : '');
    if (tokenCache[key]) return tokenCache[key];
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    g.font = 'bold 11px monospace';
    const tw = Math.ceil(g.measureText(word).width);
    c.width = tw + 10; c.height = 18;
    const g2 = c.getContext('2d');
    g2.fillStyle = crit ? '#ff3366' : '#1f2a44';
    g2.strokeStyle = crit ? '#ffd84d' : '#39d7ff';
    g2.lineWidth = 2;
    roundRect(g2, 1, 1, c.width - 2, c.height - 2, 5);
    g2.fill(); g2.stroke();
    g2.font = 'bold 11px monospace';
    g2.fillStyle = crit ? '#fff' : '#aee3ff';
    g2.textAlign = 'center'; g2.textBaseline = 'middle';
    g2.fillText(word, c.width / 2, c.height / 2 + 1);
    tokenCache[key] = c;
    return c;
  }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  // pre-warm token cache
  TOKEN_WORDS.forEach(w => token(w, false));
  CRIT_WORDS.forEach(w => token(w, true));

  // ---------- BACKGROUND TILE: the latent space ----------
  function makeBgTile() {
    const s = 256;
    const c = document.createElement('canvas');
    c.width = s; c.height = s;
    const g = c.getContext('2d');
    g.fillStyle = '#0d0f1a';
    g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(60,80,140,0.13)';
    g.lineWidth = 1;
    for (let i = 0; i <= s; i += 64) {
      g.beginPath(); g.moveTo(i + .5, 0); g.lineTo(i + .5, s); g.stroke();
      g.beginPath(); g.moveTo(0, i + .5); g.lineTo(s, i + .5); g.stroke();
    }
    g.font = '10px monospace';
    for (let i = 0; i < 26; i++) {
      const x = E.hashNoise(i, 7) * s, y = E.hashNoise(i, 13) * s;
      const r = E.hashNoise(i, 21);
      if (r < 0.55) {
        g.fillStyle = 'rgba(90,120,200,0.16)';
        g.fillText(r < 0.27 ? '0' : '1', x, y);
      } else if (r < 0.8) {
        g.fillStyle = 'rgba(120,150,255,0.10)';
        g.fillRect(x, y, 2, 2);
      } else {
        g.fillStyle = 'rgba(255,180,80,0.08)';
        g.fillText(E.choice(['404', 'nan', 'null', '</>', 'TODO', ';;', 'segv']), x, y);
      }
    }
    return c;
  }

  return {
    SCALE,
    player: [player0, player1],
    enemies: { spam, markov, captcha, slop, scam, deepfake, paywall, injector, gpuBoss, scraperBoss, clippy, clip },
    gems,
    coin: outlined(coin, '#eafff2', 2),
    coffee: outlined(coffee, '#fff', 2),
    cookie: outlined(cookie, '#fff0d8', 2),
    magnet: outlined(magnet, '#fff', 2),
    bomb: outlined(bomb, '#ffd84d', 2),
    vpn: outlined(vpn, '#eaf6ff', 2),
    chest: outlined(chest, '#ffd84d', 2),
    modelcard: outlined(modelcard, '#ff7df9', 2),
    glowGold: glowSprite(34, 'rgba(255,216,77,0.55)'),
    glowCyan: glowSprite(24, 'rgba(120,230,255,0.45)'),
    glowPink: glowSprite(34, 'rgba(255,125,249,0.55)'),
    doc, orb, flame: [flame0, flame1], dflame: [dflame0, dflame1], emberPatch, gdOrb, halluc, turret, claudeBuddy, lightning, web,
    llama: outlined(llama, '#3ce06a', 2),
    heart: outlined(heart, '#fff0f6', 1),
    caret: outlined(caret, '#1b3a6b', 1),
    spit,
    token, TOKEN_WORDS, CRIT_WORDS,
    bgTile: makeBgTile(),
  };
})();
