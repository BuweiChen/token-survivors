# TOKEN SURVIVORS

## ▶ Play now: https://buweichen.github.io/token-survivors

An LLM-themed Vampire Survivors style bullet heaven for the browser.
You are a tiny AI agent. The internet's slop is coming for you. Survive 15
minutes, build a frontier-model arsenal, and defeat the Paperclip Maximizer.

## Run it locally

No build step, no dependencies. Either:

- double-click `index.html` (works from file:// in Chrome), or
- serve it: `python3 -m http.server 8000` then open http://localhost:8000

## Controls

- Desktop: WASD (or arrows) to move. That's it. All weapons auto-fire.
  P / Esc: pause. M: mute.
- Mobile (Chrome/Android, iOS Safari): touch and drag anywhere -- a floating
  joystick appears under your finger. On-screen pause/mute buttons live in
  the top-right HUD. The UI reflows for small screens.

## The theme (everything maps to the real LLM stack)

Weapons are LLM components whose mechanics mirror the real thing:

| Weapon | Mechanic | + Passive | Evolution |
|---|---|---|---|
| Token Stream | fires tokens at nearest enemy | GPU Cluster | ChatGPT (omnidirectional firehose; glazing heals you) |
| Attention Heads | beams lock onto the BIGGEST threats | Scaling Laws | Opus 4.8 (focus beams; bonus dmg vs high-HP) |
| Context Window | damage aura, grows 8K -> 500K | VRAM | Fable 5 (1M ctx: lingering enemies take ramping dmg) |
| Chain of Thought | damaging reasoning trail behind you | KV Cache | DeepSeek-R1 (trails ponder, then HUGE detonations) |
| RAG | boomerang documents | Web Crawler | Perplexity (citations[1][2][3] detonate at 3) |
| Embedding Space | orbiting vectors | Quantization | LLaMA-405B (the herd forks: roaming llama orbs) |
| Temperature | flamethrower, spread = top_p | Liquid Cooling | Grok (dark-blue flames burn + ground residue + lightning) |
| Gradient Descent | strikes fall on random enemies | LoRA | Gemini 3 (orbital carpet-bomb barrage) |
| Tool Call | deploys turrets | System Prompt | Claude Code (swarm of subagents) |
| Hallucination | random projectiles, "confidently wrong" crits | RLHF | Constitutional AI (homes true; crits redeem + heal) |

Passives: GPU Cluster (damage), VRAM (+projectiles), Quantization (cooldown),
Scaling Laws (area), KV Cache (proj speed), Web Crawler (magnet), LoRA (XP),
RLHF (luck), System Prompt (armor), Liquid Cooling (regen).

Evolutions (frontier models) come ONLY from chests ("MODEL DROP" boxes), and
chests come ONLY from elite minibosses (one every ~45s, about 20 a run). A
chest always evolves an eligible weapon first; otherwise it levels up what
you have. Bosses pay out a frontier model card + credits instead. Check the
pause screen for your evolution recipes.

Bosses have real kits: GPU Shortage does a telegraphed ram and summons
scalpers, The Scraper dashes and fires slowing web volleys, and Clippy rings
you with paperclip shards, swarms minions, and enrages at low HP.

Once your build is complete, level-ups only offer coffee/credits -- hit
"ALWAYS PICK THIS" on a card and the game stops asking (toggle it off in the
pause menu).

Ultra-rare "model card" drops deploy a random frontier model for 10 seconds
of double damage and faster everything.

Enemies: spam bots, markov chains, CAPTCHAs, AI slop (it splits), crypto
scammers, deepfakes (they mimic you and flicker), paywalls, prompt injectors.
All enemy HP scales with time on a curve matched to single-weapon power: one
stage-appropriate non-evo weapon kills a basic enemy in ~2-5s at any point
in the run (enemy `hp` in data.js is a multiplier of that curve). Enemies
also creep faster (+18% by 15:00) and hit harder over time. Evolutions are
what break the treadmill.
Bosses: GPU Shortage (5:00), The Scraper (10:00), and at 15:00 -- CLIPPY, the
Paperclip Maximizer. "It looks like you're trying to survive."

First encounters: the first time you ever meet an enemy type (persisted
across runs in localStorage) a bestiary toast slides in with its sprite,
lore, and stats. Bosses get a full title-card slam; elites get a smaller one.

Healing: regen passive, rare coffee (+30), and very rare cookies (+10) that
normal enemies drop ("cookie accepted").

Meta progression: kills drop compute credits; spend them on the title screen
in the PRETRAINING shop (permanent ranks: parameters, H100s, epochs,
momentum, cherry-picked evals, checkpoint backup = one revive). Rank costs
grow exponentially (x1.8 per rank); buying out the whole shop is a long-term
goal on the order of 40 completed runs. The shop is
not cosmetic: an unpretrained run is a genuine longshot -- winning without
any purchases takes a lucky build. Evolutions are tuned to feel like real
power spikes; base weapon levels are deliberately modest.

## Tech

- Vanilla JS + Canvas 2D, zero dependencies, plain script files (no modules)
- All pixel art generated procedurally at boot (ASCII pattern -> canvas)
- All audio synthesized with WebAudio (no asset files at all)
- Object pools + spatial hash grid for hundreds of enemies at 60fps
- Source is pure ASCII; emoji/unicode are emitted via escape sequences

## Smoke test

Open `index.html?test=1` -- it grants every weapon/passive/evolution, spawns
every enemy type and boss, fast-forwards the run, and writes SMOKE_OK (or the
failure) into the bottom-left #errlog element.
