# Ремонтная лавка — mobile web repair game

A phone-first web game (three.js r128, no build step): the hero runs a small street kiosk that repairs old electronics.
Neighbours come to the window, orders come over the internet on the shop computer, gadgets are taken apart on the bench,
mended and then actually used (a Pocket Pal runner, a Pixel Pet, a brick phone with messages and calls). Over it runs an
investigation: where did Гриша, the kiosk's previous master, go — with side stories, choices and five endings.

All UI text is Russian. The user writes in Russian; answer in Russian.

Published as a claude.ai artifact: https://claude.ai/artifact/EpTHpcWGE7GJLc3VuK8o9Q — publish `game/index.html` to that
URL to update it (supporting files go in `files`; files left out stay as they are).

## Layout

- `game/index.html` — the whole game: styles, HUD, scenes (street window, bench, computer), story UI, time of day, audio.
- `game/story.js` — the investigation: beats, talks, clues, deductions, endings (`RetroStory({...})`).
- `game/pocket-pal.js`, `game/pixel-pet.js`, `game/brick-phone.js` — the gadget apps (`{ key(id, down), tick(dt), draw(g, w, h) }`).
- `game/pixfont.js` — pixel fonts for the gadget screens (made by `game/tools/pixfont.py`).
- Art: `*.webp` next to the page. Scenes are 941×1672 portrait pictures drawn with cover scaling (`coverMap()`).
  - Window scene: `street*.webp` behind, `kiosk*.webp` in front with the window cut out (hole ≈ 145–821 × 213–953),
    the roller shutter built from `shutter_slats/bar/sign.webp` and drawn under the room.
  - Bench: `workshop*.webp`; computer: `pc*.webp` (screen 158–777 × 419–881).
  - People: `people/<name>/<pose>.webp`.
- `game/tools/` — art scripts:
  - `relight_kiosk.py` — day and night from one painting;
  - `align_ref.py` + `warp_flow.py` + `light_transfer.py` — take the light of a drawn reference and put it on the painting.

  Day/night pictures must line up with the base picture to the pixel, or things "swim" while one fades into another.
  That was a real complaint, so make variants from one painting rather than drawing them separately.

## Time of day

- `S.clock` is in game minutes: +1 per real second, +30 per finished order.
- `DAYLOOK` holds the keyframes and tints. `dayNight()` gives the day and night weights; evening is the base picture.
- `drawMix()` adds pictures up by weight.
- The kiosk closes by itself at 23:00 and opens at 6:00; there is also a button.
- TEMP: tapping the clock opens a time tool (hour, ±1 h, speed ×10/×60). It is marked `TEMP` in index.html; remove it on request.

## Testing

- `game/tools/playtest/serve.py` serves the game like the artifact host does at http://localhost:8765/.
- `#test` in the URL exposes hooks on `window.__retro`: state, now, line/adv/pick, pull/fix/power, ff, skip, case…
- `lib.js` / `storylib.js` are Playwright helpers; `hours.js` takes screenshots at several hours.
  - Needs `npm i playwright` and `npx playwright install chromium`.
- Saves are in localStorage `retro-repair-v2`.

## Commits

Commit messages describe the change in plain words, in English.

## Next: sound and music (asked for, not done yet)

The game has only small synthesized effects (`sfx` in index.html: tick, pop, bell, coin…), no music, no ambience. The
user wants music and sounds generated in Genspark (genspark.ai) through their browser. Ready prompts:

- Music (1.5–2 min, seamless loop, no vocals):
  - day: `cozy lo-fi hip hop, warm Rhodes piano, soft vinyl crackle, relaxed 80 bpm, sunny morning in a small repair shop, seamless loop, no vocals`
  - evening: `mellow lo-fi jazz, muted trumpet, brushed drums, golden sunset mood, nostalgic, 75 bpm, seamless loop, no vocals`
  - night: `calm late-night lo-fi, soft synth pads, gentle rain texture, slow 65 bpm, mysterious but cozy, detective mood, seamless loop, no vocals`
- Ambience (1 min loops):
  - `quiet city street ambience, distant traffic, birds, people walking, daytime`
  - `night city street ambience, light rain on pavement, distant cars, calm`
  - `small workshop room tone, clock ticking, faint fridge hum`
- Effects (0.5–2 s):
  - `metal roller shutter rolling down` / `metal roller shutter rolling up`
  - `small precision screwdriver turning a tiny screw`
  - `tiny metal screw dropping on wooden desk`
  - `soldering iron touching solder, short sizzle`
  - `paper note unfolding`
  - `old CRT computer keyboard clicks`

Hook them up so the music cross-fades with the time of day (`dayNight()`), the ambience follows the scene, and the sound
button mutes everything. Keep the gadgets' 8-bit beeps synthesized.
