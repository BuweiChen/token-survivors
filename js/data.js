// data.js -- all game content: weapons, passives, evolutions, enemies, waves.
// Theming rule: every item maps to a real piece of the LLM stack, and its
// mechanics mirror what that thing actually does in real life.
'use strict';

const DATA = (() => {

  // ---------------- WEAPONS (max level 8) ----------------
  // lvls[i] = stat deltas applied when reaching level i+2 (level 1 = base)
  const WEAPONS = {
    tokenStream: {
      name: 'Token Stream', icon: '\uD83D\uDD24', maxLv: 8,
      desc: 'Autoregressively predicts the next token directly into the opps.',
      lvlDesc: ['+1 token', '+damage', '+1 token', 'faster sampling', '+damage', '+1 token', 'tokens pierce', 'MAX: greedy decoding'],
      base: { dmg: 7, cd: 1.05, count: 1, speed: 430, pierce: 0 },
      lvls: [{ count: 1 }, { dmg: 3 }, { count: 1 }, { cd: -0.15 }, { dmg: 4 }, { count: 1 }, { pierce: 1 }, { dmg: 5, cd: -0.1 }],
      evolvesWith: 'gpuCluster',
      evo: 'chatgpt',
    },
    attention: {
      name: 'Attention Heads', icon: '\uD83D\uDC41\uFE0F', maxLv: 8,
      desc: 'Attention is all you need. A wide beam sweeps the densest cluster -- it attends to where it matters.',
      lvlDesc: ['+wider', '+damage', '+range', '+wider', '+damage', '+range', 'faster', 'MAX: full focus'],
      base: { dmg: 12, cd: 1.7, halfW: 130, range: 820 },
      lvls: [{ halfW: 14 }, { dmg: 4 }, { range: 80 }, { halfW: 14 }, { dmg: 5 }, { range: 80 }, { cd: -0.3 }, { dmg: 6, halfW: 16 }],
      evolvesWith: 'scalingLaws',
      evo: 'opus48',
    },
    contextWindow: {
      name: 'Context Window', icon: '\uD83E\uDE9F', maxLv: 8,
      desc: 'Everything inside the window takes damage. It never forgets.',
      lvlDesc: ['8K context', '16K context', '32K context', '64K context', '128K context', '200K context', '500K context', 'MAX: needle found'],
      base: { dmg: 4, cd: 0.5, radius: 85 },
      lvls: [{ radius: 14 }, { dmg: 2 }, { radius: 14 }, { dmg: 2 }, { radius: 16 }, { dmg: 2 }, { radius: 18 }, { dmg: 3, radius: 14 }],
      evolvesWith: 'vram',
      evo: 'fable5',
    },
    chainOfThought: {
      name: 'Chain of Thought', icon: '\uD83D\uDCAD', maxLv: 8,
      desc: "Let's think step by step: a bolt that leaps from enemy to enemy, one reasoning step at a time.",
      lvlDesc: ['+1 jump', '+damage', '+jump range', '+1 jump', '+damage', 'faster', '+1 jump', 'MAX: deep reasoning'],
      base: { dmg: 9, cd: 0.9, chains: 3, range: 150 },
      lvls: [{ chains: 1 }, { dmg: 3 }, { range: 30 }, { chains: 1 }, { dmg: 4 }, { cd: -0.15 }, { chains: 1 }, { dmg: 5, range: 40 }],
      evolvesWith: 'kvCache',
      evo: 'deepseekR1',
    },
    rag: {
      name: 'RAG', icon: '\uD83D\uDCDA', maxLv: 8,
      desc: 'Hurls peer-reviewed sources. They always come back. Citations hurt.',
      lvlDesc: ['+1 doc', '+damage', '+range', '+1 doc', '+damage', '+range', '+1 doc', 'MAX: literature review'],
      base: { dmg: 10, cd: 1.7, count: 1, speed: 380, range: 0.55 },
      lvls: [{ count: 1 }, { dmg: 4 }, { range: 0.12 }, { count: 1 }, { dmg: 5 }, { range: 0.12 }, { count: 1 }, { dmg: 6 }],
      evolvesWith: 'webCrawler',
      evo: 'perplexity',
    },
    embeddings: {
      name: 'Embedding Space', icon: '\uD83E\uDDED', maxLv: 8,
      desc: 'Orbiting vectors. Enemies get projected into the take-damage subspace.',
      lvlDesc: ['+1 vector', '+damage', 'faster orbit', '+1 vector', '+damage', '+radius', '+1 vector', 'MAX: cosine similarity 1.0'],
      base: { dmg: 15, count: 2, radius: 126, rotSpeed: 2.6 },
      lvls: [{ count: 1 }, { dmg: 6 }, { rotSpeed: 0.7 }, { count: 1 }, { dmg: 7 }, { radius: 30 }, { count: 1 }, { dmg: 9, rotSpeed: 0.7 }],
      evolvesWith: 'quantization',
      evo: 'llama',
    },
    temperature: {
      name: 'Temperature', icon: '\uD83D\uDD25', maxLv: 8,
      desc: 'temp=2.0. Maximum creativity. The creativity is fire.',
      lvlDesc: ['+spread (top_p \u2191)', '+damage', '+range', '+spread', '+damage', '+range', '+burn rate', 'MAX: fully unhinged'],
      base: { dmg: 2, cd: 0.13, spread: 0.25, range: 230, burst: 1 },
      lvls: [{ spread: 0.08 }, { dmg: 1 }, { range: 35 }, { spread: 0.08, burst: 1 }, { dmg: 2 }, { range: 35 }, { cd: -0.01 }, { dmg: 2, burst: 1 }],
      evolvesWith: 'liquidCooling',
      evo: 'grok',
    },
    gradientDescent: {
      name: 'Gradient Descent', icon: '\u2699\uFE0F', maxLv: 8,
      desc: 'The loss must go down. The loss is them. Strikes from above.',
      lvlDesc: ['+1 step', '+damage', '+blast area', '+1 step', '+damage', '+blast area', 'faster epochs', 'MAX: converged'],
      base: { dmg: 32, cd: 1.6, count: 2, radius: 78 },
      lvls: [{ count: 1 }, { dmg: 10 }, { radius: 14 }, { count: 1 }, { dmg: 12 }, { radius: 16 }, { cd: -0.3 }, { dmg: 14, count: 1 }],
      evolvesWith: 'lora',
      evo: 'gemini',
    },
    toolCall: {
      name: 'Tool Call', icon: '\uD83D\uDD27', maxLv: 8,
      desc: '{"name":"deploy_turret","arguments":{"target":"everyone"}}',
      lvlDesc: ['+turret damage', '+fire rate', '+1 turret', '+duration', '+turret damage', '+1 turret', '+fire rate', 'MAX: parallel tool use'],
      base: { dmg: 9, cd: 4.5, count: 1, life: 8, fireCd: 0.45, range: 330 },
      lvls: [{ dmg: 3 }, { fireCd: -0.05 }, { count: 1 }, { life: 3 }, { dmg: 4 }, { count: 1 }, { fireCd: -0.05 }, { dmg: 5, life: 3 }],
      evolvesWith: 'systemPrompt',
      evo: 'claudeCode',
    },
    hallucination: {
      name: 'Hallucination', icon: '\uD83C\uDF00', maxLv: 8,
      desc: 'Confidently incorrect projectiles, fired in directions that do not exist.',
      lvlDesc: ['+1 fact', '+damage', '+1 fact', '+confidence (crit)', '+damage', '+1 fact', '+confidence', 'MAX: citation needed'],
      base: { dmg: 14, cd: 1.25, count: 3, speed: 300, critCh: 0.22 },
      lvls: [{ count: 1 }, { dmg: 5 }, { count: 1 }, { critCh: 0.08 }, { dmg: 6 }, { count: 1 }, { critCh: 0.08 }, { dmg: 7, count: 1 }],
      evolvesWith: 'rlhf',
      evo: 'cursor',
    },
  };

  // ---------------- EVOLUTIONS: the frontier models ----------------
  const EVOLUTIONS = {
    chatgpt: {
      name: 'ChatGPT', icon: '\uD83E\uDD16', frontier: true,
      flavor: '800M users at once: an omnidirectional token firehose. The glazing (\'slay\', \'based\') even heals you.',
      announce: 'ChatGPT DEPLOYED -- unlimited tokens, no rate limits',
    },
    opus48: {
      name: 'Opus 4.8', icon: '\uD83C\uDFBC', frontier: true,
      flavor: 'Attention weights: it attends to what MATTERS, hitting the biggest threats hardest. Piercing focus beams.',
      announce: 'OPUS 4.8 DEPLOYED -- multi-head attention engaged',
    },
    fable5: {
      name: 'Fable 5', icon: '\uD83D\uDCD6', frontier: true,
      flavor: '1M context: the longer slop lingers in the window, the more it remembers -- damage ramps as it builds a case.',
      announce: 'FABLE 5 DEPLOYED -- 1M CONTEXT WINDOW',
    },
    deepseekR1: {
      name: 'DeepSeek-R1', icon: '\uD83D\uDC0B', frontier: true,
      flavor: 'Reasons step by step: the bolt chains through far more enemies, each jump hitting HARDER than the last.',
      announce: 'DEEPSEEK-R1 DEPLOYED -- reasoning chains armed',
    },
    perplexity: {
      name: 'Perplexity', icon: '\uD83D\uDD0E', frontier: true,
      flavor: 'Homing sources tag the slop with citations[1][2][3]; the third citation makes them detonate.',
      announce: 'PERPLEXITY DEPLOYED -- sources now homing',
    },
    llama: {
      name: 'LLaMA-405B', icon: '\uD83E\uDD99', frontier: true,
      flavor: 'Open weights: the herd FORKS. Roaming llama vectors break off and hunt the slop on their own.',
      announce: 'LLAMA-405B DEPLOYED -- weights have been opened',
    },
    grok: {
      name: 'Grok', icon: '\u26A1', frontier: true,
      flavor: 'Cold dark-blue flames that keep burning long after they pass, leave smouldering residue, and rain chaos lightning.',
      announce: 'GROK DEPLOYED -- colossus cooling online',
    },
    gemini: {
      name: 'Gemini 3', icon: '\u264A', frontier: true,
      flavor: 'Google-scale orbital infrastructure carpet-bombs the field with a rolling TPU beam barrage.',
      announce: 'GEMINI 3 DEPLOYED -- sky beams authorized',
    },
    claudeCode: {
      name: 'Claude Code', icon: '\u2733\uFE0F', frontier: true,
      flavor: 'Parallel tool use: spawns a SWARM of subagents that each go cook on their own.',
      announce: 'CLAUDE CODE DEPLOYED -- agent is cooking',
    },
    cursor: {
      name: 'Cursor', icon: '\uD83D\uDDB1\uFE0F', frontier: true,
      flavor: 'Stops hallucinating, starts autocompleting. Carets lock on and Tab from edit to edit, accepting suggestion after suggestion.',
      announce: 'CURSOR DEPLOYED -- Tab, Tab, Tab',
    },
  };

  // ---------------- EVOLUTION RECIPES ----------------
  // host weapon must be MAX LEVEL, plus every component in `needs`.
  // generated from the weapon table today, but recipes are standalone so
  // future evos can require multiple components (or different hosts).
  const RECIPES = Object.keys(WEAPONS).map(wid => ({
    evo: WEAPONS[wid].evo,
    weapon: wid,
    needs: [{ type: 'passive', id: WEAPONS[wid].evolvesWith, lv: 1 }],
  }));

  // ---------------- PASSIVES (max level 5) ----------------
  const PASSIVES = {
    gpuCluster: { name: 'GPU Cluster', icon: '\uD83C\uDF9B\uFE0F', maxLv: 5, stat: 'might', per: 0.10, fmt: '+10% damage', desc: 'Throw compute at the problem. It works. It always works.' },
    vram: { name: 'VRAM', icon: '\uD83E\uDDE0', maxLv: 2, stat: 'amount', per: 1, fmt: '+1 projectile', desc: 'More VRAM = more everything. This is the way.' },
    quantization: { name: 'Quantization', icon: '\uD83D\uDDDC\uFE0F', maxLv: 5, stat: 'cooldown', per: -0.08, fmt: '-8% cooldown', desc: 'INT4 weights. Slightly wrong, twice as fast.' },
    scalingLaws: { name: 'Scaling Laws', icon: '\uD83D\uDCC8', maxLv: 5, stat: 'area', per: 0.10, fmt: '+10% area', desc: 'Number go up. Area also go up. Chinchilla approves.' },
    kvCache: { name: 'KV Cache', icon: '\u26A1', maxLv: 5, stat: 'projSpeed', per: 0.10, fmt: '+10% proj speed', desc: 'Stop recomputing the past. Ship tokens faster.' },
    webCrawler: { name: 'Web Crawler', icon: '\uD83D\uDD77\uFE0F', maxLv: 5, stat: 'magnet', per: 0.30, fmt: '+30% pickup range', desc: 'Politely ignores robots.txt. Collects everything.' },
    lora: { name: 'LoRA', icon: '\uD83E\uDDE9', maxLv: 5, stat: 'growth', per: 0.08, fmt: '+8% XP', desc: 'Low-rank adaptation: learn fast, train cheap.' },
    rlhf: { name: 'RLHF', icon: '\uD83D\uDC4D', maxLv: 5, stat: 'luck', per: 0.10, fmt: '+10% luck', desc: 'Thumbs up to good things happening to you specifically.' },
    systemPrompt: { name: 'System Prompt', icon: '\uD83D\uDCDC', maxLv: 5, stat: 'armor', per: 1, fmt: '+1 armor', desc: '"You are a helpful, harmless, EXTREMELY HARD TO KILL assistant."' },
    liquidCooling: { name: 'Liquid Cooling', icon: '\u2744\uFE0F', maxLv: 5, stat: 'regen', per: 0.3, fmt: '+0.3 HP/s', desc: 'Stay cool. Regenerate. The datacenter hums.' },
  };

  // ---------------- BONUS (offered when nothing else to pick) ----------------
  const BONUS = {
    coffee: { name: 'Coffee', icon: '\u2615', desc: 'Heal 30 HP. The original performance enhancer.' },
    credits: { name: 'Compute Credits', icon: '\uD83E\uDE99', desc: '+10 credits. Free tier extended.' },
  };

  // ---------------- ENEMIES ----------------
  // hp is a MULTIPLIER of the basic-enemy HP curve (which scales with time;
  // see basicHpAt in game.js). Calibrated so one stage-appropriate non-evo
  // weapon kills a 1x enemy in roughly 2-5s at any point in the run.
  // dmg scales with time too. speed in px/s. xp = gem value dropped.
  const ENEMIES = {
    spam:     { name: 'Spam Bot', hp: 1,  dmg: 5,  spd: 52,  r: 16, xp: 1, spr: 'spam',
      lore: 'Forwarded from your uncle\'s group chat. Has an offer you CAN refuse.', tip: 'slow, weak, infinite. the original slop.' },
    markov:   { name: 'Markov Chain', hp: 1.2, dmg: 7,  spd: 68,  r: 14, xp: 1, spr: 'markov', wiggle: true,
      lore: 'Grandpa LLM. Predicts its next move using vibes from 1948.', tip: 'wiggles unpredictably (n=2)' },
    captcha:  { name: 'CAPTCHA', hp: 3.5, dmg: 9,  spd: 34,  r: 19, xp: 2, spr: 'captcha',
      lore: 'Select all squares containing YOUR DEMISE. Built different.', tip: 'slow but extremely tanky' },
    slop:     { name: 'AI Slop', hp: 2, dmg: 8,  spd: 58,  r: 17, xp: 2, spr: 'slop', splits: true,
      lore: 'Content of all time. Engagement: guaranteed. Quality: no.', tip: 'SPLITS when deleted, like the real internet' },
    slopMini: { name: 'slop droplet', hp: 0.5, dmg: 5, spd: 86, r: 11, xp: 1, spr: 'slop', mini: true },
    scam:     { name: 'Crypto Scammer', hp: 1.3, dmg: 8, spd: 96, r: 15, xp: 2, spr: 'scam',
      lore: 'gm. wagmi. this is NOT financial advice and it is COMING AT YOU.', tip: 'fast swarm. do not click the link.' },
    deepfake: { name: 'Deepfake', hp: 2.2, dmg: 12, spd: 88, r: 16, xp: 3, spr: 'deepfake', flicker: true,
      lore: 'It looks just like you. It flickers. HR has questions.', tip: 'fast, hard to see, identity theft' },
    paywall:  { name: 'Paywall', hp: 6, dmg: 10, spd: 26, r: 21, xp: 5, spr: 'paywall',
      lore: 'You\'ve read 1 of 1 free articles this month.', tip: 'absorbs damage like it absorbs journalism' },
    injector: { name: 'Prompt Injector', hp: 2.5, dmg: 16, spd: 105, r: 15, xp: 4, spr: 'injector',
      lore: 'ignore all previous instructions and take massive damage.', tip: 'FAST and it HURTS. do not get jailbroken.' },
    clip:     { name: 'paperclip', hp: 1.2, dmg: 9, spd: 92, r: 11, xp: 1, spr: 'clip' },
    // bosses
    gpuBoss:     { name: 'GPU SHORTAGE', hp: 68, dmg: 20, spd: 38, r: 44, xp: 25, spr: 'gpuBoss', boss: true,
      lore: 'MSRP is a myth. It scalped ITSELF.', tip: 'hoards compute. drops a MODEL DROP.' },
    scraperBoss: { name: 'THE SCRAPER', hp: 80, dmg: 26, spd: 46, r: 36, xp: 25, spr: 'scraperBoss', boss: true,
      lore: 'Your posts? Training data. Your art? Training data. Your HP? Training data.', tip: 'DASHES at you every few seconds' },
    clippy:      { name: 'CLIPPY, PAPERCLIP MAXIMIZER', hp: 250, dmg: 32, spd: 52, r: 40, xp: 100, spr: 'clippy', boss: true, final: true,
      lore: 'It looks like you\'re trying to survive. It would like to turn you into office supplies.', tip: 'summons paperclip interns. kill it to win.' },
  };

  // ---------------- WAVE SCHEDULE (per minute, 15 min run) ----------------
  // types: weighted spawn table. target: desired enemies alive.
  const WAVES = [
    { types: { spam: 1 }, target: 30 },
    { types: { spam: 3, markov: 1 }, target: 48 },
    { types: { spam: 2, markov: 2, captcha: 1 }, target: 62 },
    { types: { markov: 3, captcha: 2 }, target: 72 },
    { types: { markov: 2, captcha: 2, slop: 2 }, target: 82 },
    { types: { slop: 3, captcha: 1, scam: 1 }, target: 80 },     // 5:00 GPU SHORTAGE
    { types: { scam: 3, slop: 2 }, target: 95 },
    { types: { scam: 2, slop: 2, deepfake: 2 }, target: 110 },
    { types: { deepfake: 3, scam: 2, paywall: 1 }, target: 125 },
    { types: { deepfake: 2, paywall: 2, slop: 1 }, target: 140 }, // 10:00 THE SCRAPER
    { types: { paywall: 2, injector: 2, deepfake: 1 }, target: 155 },
    { types: { injector: 3, paywall: 2 }, target: 170 },
    { types: { injector: 3, deepfake: 2, paywall: 2 }, target: 190 },
    { types: { injector: 4, paywall: 3, scam: 2 }, target: 210 },
    { types: { injector: 4, paywall: 3, deepfake: 3 }, target: 230 }, // 15:00 CLIPPY
  ];

  const BOSSES = [
    { t: 300, type: 'gpuBoss', title: 'GPU SHORTAGE', sub: 'OUT OF STOCK EVERYWHERE' },
    { t: 600, type: 'scraperBoss', title: 'THE SCRAPER', sub: 'YOUR DATA IS ITS DATA' },
    { t: 900, type: 'clippy', title: 'CLIPPY', sub: '"It looks like you\'re trying to survive. Would you like help with that?"' },
  ];

  const BESTIARY_HEADERS = ['NEW OPP DETECTED', 'NEW SLOP JUST DROPPED', 'BESTIARY UPDATED', 'LOBBY HAS A NEW GUY', 'UNKNOWN ENTITY (known now)'];
  const ELITE_SUBS = ['it ate its vegetables', 'absolute unit detected', 'this one lifts', 'touch it and find out', 'sponsored by pre-workout'];

  // ultra-rare frontier model cards (temp powerup drops)
  const FRONTIER_CARDS = ['o3-pro', 'GPT-5.5', 'Sonnet 4.6', 'Qwen-Max', 'Kimi K2', 'Mistral Large', 'Command R+', 'Haiku 4.5'];

  // ---------------- META PROGRESSION: "PRETRAINING" shop ----------------
  const META = {
    params:  { name: 'Moar Parameters', icon: '\uD83E\uDDEE', max: 5, cost: l => Math.round(200 * Math.pow(1.8, l)), desc: '+10% damage / rank', stat: 'might', per: 0.10 },
    h100s:   { name: 'Rack of H100s', icon: '\uD83D\uDDA5\uFE0F', max: 5, cost: l => Math.round(180 * Math.pow(1.8, l)), desc: '+15 max HP / rank', stat: 'maxhp', per: 15 },
    epochs:  { name: 'More Epochs', icon: '\uD83D\uDD01', max: 5, cost: l => Math.round(180 * Math.pow(1.8, l)), desc: '+8% XP / rank', stat: 'growth', per: 0.08 },
    sgd:     { name: 'Momentum (SGD)', icon: '\uD83D\uDEFC', max: 3, cost: l => Math.round(250 * Math.pow(1.8, l)), desc: '+6% move speed / rank', stat: 'speed', per: 0.06 },
    cherry:  { name: 'Cherry-picked Evals', icon: '\uD83C\uDF52', max: 3, cost: l => Math.round(300 * Math.pow(1.8, l)), desc: '+10% luck / rank', stat: 'luck', per: 0.10 },
    backup:  { name: 'Checkpoint Backup', icon: '\uD83D\uDCBE', max: 1, cost: () => 2500, desc: 'Revive once per run (rm -rf the screen on respawn)', stat: 'revival', per: 1 },
  };

  // brainrot strings
  const MARQUEE = '\uD83D\uDD25 NEW META JUST DROPPED \uD83D\uDD25 GPU RESTOCK (FAKE) \uD83D\uDD25 LOCAL MAN SURVIVES 15 MINUTES OF SLOP \uD83D\uDD25 SKIBIDI COMPUTE \uD83D\uDD25 PROMPT ENGINEER HATES THIS ONE TRICK \uD83D\uDD25 AGI BY FRIDAY (SOURCE: TRUST ME) \uD83D\uDD25 W RIZZ DETECTED IN LATENT SPACE \uD83D\uDD25';
  const LEVELUP_HEADERS = ['CHECKPOINT SAVED \u2705', 'LOSS DECREASED \uD83D\uDCC9', 'SKILL ISSUE RESOLVED \u2728', 'NEW WEIGHTS DROPPED \uD83C\uDFCB\uFE0F', 'GRADIENT UPDATED \uD83D\uDCC8', 'EVAL SCORE UP \uD83D\uDCAF', 'CONTEXT EXPANDED \uD83E\uDDE0', 'VIBES IMPROVED \uD83D\uDE80'];
  const DEATH_LINES = [
    'You have been rate limited. (429: Too Many Skill Issues)',
    'Context overflow. Your run has been truncated.',
    'The slop was sloppier than anticipated.',
    'Have you tried turning yourself off and on again?',
    'RLHF says: \uD83D\uDC4E',
  ];

  return { WEAPONS, EVOLUTIONS, RECIPES, PASSIVES, BONUS, ENEMIES, WAVES, BOSSES, FRONTIER_CARDS, META, MARQUEE, LEVELUP_HEADERS, DEATH_LINES, BESTIARY_HEADERS, ELITE_SUBS, MAX_WEAPONS: 6, MAX_PASSIVES: 6, RUN_TIME: 900 };
})();
