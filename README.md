# Ember Over Tide

God of War (2005)-style third-person browser slice. This repo is at milestone **M0**: menus, a fixed-step loop, a Rapier graybox, and a perf scene. No combat yet.

`BUILD_ID` is `m0-1`. It is drawn in the corner and on the main menu.

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

- **WASD** or arrow keys move the capsule. Movement is camera-relative.
- **Click** the view to look around. Mouse sensitivity is in Settings.
- **P** pauses. The pause menu is Resume, Settings, Restart, Quit.
- Leaving the tab pauses. Coming back stays paused until Resume.
- **Restart** restores the checkpoint saved when Play started (player pose; later HP, MP, upgrades, and puzzle state). It does not reload the page.
- **Quit** returns to the main menu.

The input device switch (keyboard + mouse, or gamepad) is on the main menu only. Gamepad support is a placeholder: when Gamepad is selected, the left stick moves the capsule. The combat button layout is not in this milestone. WASD still works in either mode.

## Settings

FPS cap, master / music / SFX volume, mouse sensitivity, camera shake, and render scale are safe to change while paused. They are stored in `localStorage` under `eot.settings.v1` and apply on the next frame. Volumes and camera shake are stored for later milestones; nothing plays audio in M0, and nothing requests a shake yet.

FPS cap choices are **30** and **60**. The simulation always steps at 60 Hz. The cap only drops rendered frames, so 30 fps runs two physics steps per presented frame.

On a first visit, with nothing saved:

- **30** if the machine looks like the target Chromebook (4 GB `deviceMemory`, or 2 hardware threads, or neither API exists).
- **60** on a desktop (more memory and more than 2 threads).

Choosing a cap overrides that and survives a reload. The rule is in `src/core/settings.js` (`isWeakHardware`).

Render scale options are `0.50`, `0.75`, and `1.00`. It is the WebGL pixel ratio, not multiplied by `devicePixelRatio`, so 1.0 is one rendering pixel per CSS pixel.

## Perf flags

- `?perf=1` shows fps, frame ms, physics step ms, draw calls, triangles, and JS heap when the browser exposes it, plus a JSON blob stamped with the build id.
- `?perf=1&stress=1` loads the stress scene instead of the graybox: about 50k triangles, 70 draw calls, 6 wandering capsule bodies, and 12 dynamic debris boxes.

Example: [http://localhost:5173/EOT-browser-game/?perf=1&stress=1](http://localhost:5173/EOT-browser-game/?perf=1&stress=1)

The same JSON is `window.__EOT__.perfReport()` in the devtools console. Switching the fps cap clears the frame-time window so the averages match the cap you just chose.

## Story lines

Spoken and on-screen story text comes from string ids in `public/data/dialogue.json` through `t(id)` in `src/core/dialogue.js`. A missing id returns the id. M0 only has placeholder copy.

## Layout

`src/core/loop.js` and `src/core/time.js` (fixed step), `src/core/input.js`, `src/core/settings.js`, `src/core/checkpoint.js`, `src/core/dialogue.js`, `src/ui/menus.js`, `src/physics/world.js`, `src/scenes/graybox.js`, `src/scenes/stress.js`, `src/debug/perf.js`.
