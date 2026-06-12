# TOKEN SURVIVORS

An LLM-themed Vampire Survivors style bullet heaven for the browser.
You are a tiny AI agent. The internet's slop is coming for you. Survive 15
minutes, build a frontier-model arsenal, and defeat the Paperclip Maximizer.

## Run it

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
| Token Stream | fires tokens at nearest enemy | GPU Cluster | ChatGPT (token firehose) |
| Attention Heads | beams lock onto the BIGGEST threats | Scaling Laws | Opus 4.8 (piercing multi-head) |
| Context Window | damage aura, grows 8K -> 500K | VRAM | Fable 5 (1M ctx: huge, slows, ingests XP) |
| Chain of Thought | damaging reasoning trail behind you | KV Cache | DeepSeek-R1 (trail persists + detonates) |
| RAG | boomerang documents | Web Crawler | Perplexity (homing citations) |
| Embedding Space | orbiting vectors | Quantization | LLaMA-405B (double ring, faster) |
| Temperature | flamethrower, spread = top_p | Liquid Cooling | Grok (chaos lightning storm) |
| Gradient Descent | strikes fall on random enemies | LoRA | Gemini 3 (orbital TPU beams) |
| Tool Call | deploys turrets | System Prompt | Claude Code (autonomous agent buddy) |
| Hallucination | random projectiles, "confidently wrong" crits | RLHF | Constitutional AI (aligned + homing) |

Passives: GPU Cluster (damage), VRAM (+projectiles), Quantization (cooldown),
Scaling Laws (area), KV Cache (proj speed), Web Crawler (magnet), LoRA (XP),
RLHF (luck), System Prompt (armor), Liquid Cooling (regen).

Evolutions (frontier models) come from chests ("MODEL DROP" boxes) dropped by
elites and bosses, once a weapon is max level and you own its paired passive.
Check the pause screen for your evolution recipes.

Ultra-rare "model card" drops deploy a random frontier model for 10 seconds
of double damage and faster everything.

Enemies: spam bots, markov chains, CAPTCHAs, AI slop (it splits), crypto
scammers, deepfakes (they mimic you and flicker), paywalls, prompt injectors.
Bosses: GPU Shortage (5:00), The Scraper (10:00), and at 15:00 -- CLIPPY, the
Paperclip Maximizer. "It looks like you're trying to survive."

Meta progression: kills drop compute credits; spend them on the title screen
in the PRETRAINING shop (permanent ranks: parameters, H100s, epochs,
momentum, cherry-picked evals, checkpoint backup = one revive).

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
