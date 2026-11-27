# Ember Over Tide

God of War (2005)-style third-person browser slice. This repo is at milestone **M1**: a graybox of the slice route, Korrath's controller, and fixed camera zones. Combat damage is still a stub.

`BUILD_ID` is `m1-3`. It is drawn in the corner and on the main menu. The fixed shots sit in open air and look at Korrath. `tests/camera-sight.test.js` checks that each route sample sits inside the frame with clear space around it, and that the Tide Gate shot can see the gate, crank, idol, drag marks, and rubble. The opening line fades in, holds, and fades out on its own.

## Run

```bash
npm i
npm run dev
```

Open [http://localhost:5173/EOT-browser-game/](http://localhost:5173/EOT-browser-game/). The Vite `base` is `/EOT-browser-game/`, so the site is not at `/`.

```bash
npm test
npm run build
npm run preview
```

Preview serves the production build at [http://localhost:4173/EOT-browser-game/](http://localhost:4173/EOT-browser-game/).

GitHub Actions runs the tests and the build on every pull request. A push to `main` deploys `dist/` to GitHub Pages only after those steps pass.

## Controls

The camera is fixed. The mouse does not orbit it.

- **WASD** moves relative to the active camera. A cut keeps the old direction until you release the keys or change direction.
- **Space** jumps. A second press in the air is the double jump.
- **Tap Left Shift** (release within 0.25 s, with nothing else pressed) toggles crouch. A longer hold charges a heavy.
- **Left Shift + left mouse** releases the charged heavy. Charge time is how long Shift was held. Tiers are under 0.3 s, 0.3–0.8 s, and 0.8–1.4 s (then it holds at max). Charging stops at `player.unlockedChargeTier`, which is 1 in normal play, so a tier-1 release never vents. `?tiers=2` or `?tiers=3` unlocks higher tiers for testing. While charging, move speed is halved and block is unavailable. Shift+Space, right mouse, or a hit cancels it.
- **Right mouse** tap parries, hold blocks.
- **Left Shift + Space** dodge-rolls. The hurtbox drops to crouch height for the roll.
- **R** Ember Wrath, **F** grab / interact, **P** pause. E and Q are unbound. Ctrl and Alt are not bound.
- Leaving the tab pauses. Coming back stays paused until Resume.

The same list is on the Controls screen. `?input=1` logs raw events and the charge level. Optional `altHeavy` in `src/config/keymap.js` also treats Alt+click as heavy; it is off, and plain right mouse always blocks.

## Assets

M1 does not download art. Planned CC0 sources are in `CREDITS.md` and `public/data/credits.json` (`status: "planned"` vs `"in build"`). Mixamo clips must be baked into the character GLBs. Do not ship a raw animation folder. When breakables arrive, Tide Gate rubble breaks at any heavy charge level.

## Settings

FPS cap, master / music / SFX volume, mouse sensitivity, camera shake, and render scale are safe to change while paused. They are stored in `localStorage` under `eot.settings.v1` and apply on the next frame. Volumes and camera shake are stored for later milestones; nothing plays audio in M0, and nothing requests a shake yet.

FPS cap choices are **30** and **60**. The simulation always steps at 60 Hz. The cap only drops rendered frames, so 30 fps runs two physics steps per presented frame.

On a first visit, with nothing saved:

- **30** if the machine looks like the target Chromebook (4 GB `deviceMemory`, or 2 hardware threads, or neither API exists).
- **60** on a desktop (more memory and more than 2 threads).

Choosing a cap overrides that and survives a reload. The rule is in `src/core/settings.js` (`isWeakHardware`).

Quality is Low, Medium, or High. Render scale lives under Advanced and stays `0.50`, `0.75`, or `1.00`. Low defaults to 0.75. Medium and High default to 1.0. It is the WebGL pixel ratio, not multiplied by `devicePixelRatio`.

## Perf flags

- `?perf=1` shows fps, frame ms, physics step ms, draw calls, triangles, and JS heap when the browser exposes it, plus a JSON blob stamped with the build id.
- `?perf=1&stress=1` loads the stress scene instead of the graybox: about 50k triangles, 70 draw calls, 6 wandering capsule bodies, and 12 dynamic debris boxes.
- `?cam=debug` draws the camera zones and the active camera name.
- `?input=1` logs key and mouse events plus the heavy charge level.

Example: [http://localhost:5173/EOT-browser-game/?perf=1&stress=1](http://localhost:5173/EOT-browser-game/?perf=1&stress=1)

The same JSON is `window.__EOT__.perfReport()` in the devtools console. Switching the fps cap clears the frame-time window so the averages match the cap you just chose.

## Story lines

Spoken and on-screen story text comes from string ids in `public/data/dialogue.json` through `t(id)` in `src/core/dialogue.js`. A missing id returns the id. M0 only has placeholder copy.

## Layout

`src/core/loop.js` and `src/core/time.js` (fixed step), `src/core/input.js`, `src/core/settings.js`, `src/core/checkpoint.js`, `src/core/dialogue.js`, `src/ui/menus.js`, `src/physics/world.js`, `src/scenes/graybox.js`, `src/scenes/stress.js`, `src/debug/perf.js`.
