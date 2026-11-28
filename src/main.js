import * as THREE from 'three';
import { BUILD_ID } from './core/build.js';
import { LIGHTING } from './config/lighting.js';
import { checkpoint } from './core/checkpoint.js';
import { loadDialogue, t } from './core/dialogue.js';
import { CONTROL_LINES } from './config/keymap.js';
import { attachInput, createInputBuffer, pointerDelta } from './core/input.js';
import { createLoop } from './core/loop.js';
import { createSettingsStore } from './core/settings.js';
import { createPerfOverlay } from './debug/perf.js';
import { loadRapier } from './physics/world.js';
import { createRoute } from './scenes/route.js';
import { createStressScene } from './scenes/stress.js';
import { createMenus } from './ui/menus.js';
import { createBrazierMenu } from './ui/brazier.js';
import './style.css';

const params = new URLSearchParams(location.search);
const perfEnabled = params.get('perf') === '1';
const stressEnabled = params.get('stress') === '1';
const camDebug = params.get('cam') === 'debug';
const inputDebug = params.get('input') === '1';
const tierQuery = Number(params.get('tiers'));
const unlockedChargeTier = tierQuery === 2 || tierQuery === 3 ? tierQuery : 1;
const orbQuery = Number(params.get('orbs'));
const startingOrbs = Number.isFinite(orbQuery) && orbQuery > 0 ? Math.floor(orbQuery) : 0;

const canvas = document.querySelector('#view');
const ui = document.querySelector('#ui');
const hint = document.querySelector('#hint');
const stamp = document.querySelector('#build-stamp');
stamp.textContent = BUILD_ID;

const settings = createSettingsStore(localStorage, navigator);
const input = createInputBuffer();

/** @type {'menu' | 'play' | 'pause'} */
let mode = 'menu';
let renderer = null;
let sceneApi = null;
let booting = false;
let lastStepMs = 0;
let lastEvents = [];

const perf = perfEnabled
  ? createPerfOverlay(document.querySelector('#perf'), { buildId: BUILD_ID })
  : null;

attachInput(input, window, {
  allowPointer: () => mode === 'play',
});

const loop = createLoop({
  isPaused: () => mode !== 'play',
  getFpsCap: () => settings.get().fpsCap,
  onResume(now) {
    // Drop edges that landed while the sim clock was frozen. Held keys still
    // update, but a press-and-release during pause does not become a later action.
    input.consumeUpTo(now);
  },
  onStep(dtMs, stepEnd) {
    const events = input.consumeUpTo(stepEnd);
    lastEvents = events;
    if (!sceneApi) return 0;
    return sceneApi.step(dtMs, {
      input,
      settings: settings.get(),
      events,
      pointer: pointerDelta(events),
    });
  },
  onFrame(alpha, now, info) {
    if (!sceneApi || !renderer) return;
    const paused = info.paused || mode !== 'play';
    sceneApi.present(alpha, paused ? 0 : info.frameDtMs, paused);
    renderer.render(sceneApi.scene, sceneApi.camera);
    if (info.steps > 0) lastStepMs = info.stepMs / info.steps;
    if (perf) {
      perf.sample({
        now,
        renderer,
        stepMs: lastStepMs,
        settings: settings.get(),
        scene: sceneApi.name,
      });
    }
    const cam = document.querySelector('#cam-readout');
    if (cam) {
      cam.hidden = !camDebug;
      cam.textContent = camDebug ? (sceneApi.cameraName || '') : '';
    }
    const prompt = document.querySelector('#prompt');
    if (prompt) {
      const text = sceneApi.prompt || '';
      const opacity = sceneApi.subtitleOpacity ?? (text ? 1 : 0);
      prompt.hidden = !text || opacity <= 0.02;
      prompt.textContent = text;
      prompt.style.opacity = String(opacity);
    }
    if (hint && mode === 'play') {
      const fade = sceneApi.hintOpacity ?? 1;
      hint.style.opacity = String(fade);
      hint.hidden = fade <= 0.02;
    }
    const action = document.querySelector('#action-readout');
    if (action) action.textContent = sceneApi.actionText || '';
    if (inputDebug) paintInput(lastEvents);
    if (mode === 'play' && sceneApi?.shopId) {
      mode = 'brazier';
      brazier.show(sceneApi.shopState());
    }
    lastEvents = [];
  },
});

function applySize() {
  if (!renderer) return;
  renderer.setPixelRatio(settings.get().renderScale);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  if (sceneApi) {
    sceneApi.camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
    sceneApi.camera.updateProjectionMatrix();
  }
}

function ensureRenderer() {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    stencil: false,
    powerPreference: 'default',
  });
  renderer.setClearColor(LIGHTING.background, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = false;
  applySize();
}

settings.subscribe(() => applySize());
window.addEventListener('resize', applySize);

function setMode(next) {
  mode = next;
  hint.hidden = next !== 'play';
  if (next === 'menu') {
    menus.showMain();
    return;
  }
  if (next === 'pause') {
    menus.showPause();
    sceneApi?.setDimmed(true);
    return;
  }
  menus.hide();
  sceneApi?.setDimmed(false);
}

async function play() {
  if (booting || mode === 'play') return;
  booting = true;
  menus.setStatus('Loading physics…');
  try {
    const R = await loadRapier();
    ensureRenderer();
    sceneApi?.dispose();
    sceneApi = stressEnabled ? createStressScene(R) : createRoute(R, { camDebug, unlockedChargeTier, startingOrbs });
    applySize();
    checkpoint.save(sceneApi.captureState());
    setMode('play');
    loop.start();
  } catch (error) {
    console.error(error);
    setMode('menu');
    menus.setStatus('Physics failed to start. See the console.');
  } finally {
    booting = false;
  }
}

function pause() {
  if (mode !== 'play') return;
  setMode('pause');
}

function resume() {
  if (mode !== 'pause') return;
  setMode('play');
}

function restart() {
  if (!sceneApi || mode === 'menu') return;
  const saved = checkpoint.restore();
  if (saved) sceneApi.restoreState(saved);
  setMode('play');
}

function quit() {
  loop.stop();
  sceneApi?.setDimmed(false);
  sceneApi?.dispose();
  sceneApi = null;
  renderer?.clear();
  setMode('menu');
}

const brazier = createBrazierMenu(document.querySelector('#app'), {
  onBuy(id) {
    sceneApi?.purchase(id);
    if (sceneApi?.shopState) brazier.show(sceneApi.shopState());
  },
  onClose() {
    sceneApi?.closeShop();
    brazier.hide();
    if (mode === 'brazier') setMode('play');
  },
});

const creditEntries = [];
const menus = createMenus(ui, {
  settings,
  t,
  buildId: BUILD_ID,
  controls: CONTROL_LINES,
  credits: creditEntries,
  onPlay: () => { play(); },
  onResume: resume,
  onRestart: restart,
  onQuit: quit,
});

const PLAY_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space',
]);

window.addEventListener('keydown', (event) => {
  if (mode === 'play' && PLAY_KEYS.has(event.code)) event.preventDefault();
  if (event.code !== 'KeyP' || event.repeat) return;
  if (mode !== 'play' && mode !== 'pause') return;
  event.preventDefault();
  if (mode === 'play') pause();
  else resume();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && mode === 'play') pause();
});

canvas.addEventListener('contextmenu', (event) => event.preventDefault());

const inputLog = [];
function paintInput(events) {
  const node = document.querySelector('#input-log');
  if (!node) return;
  for (const event of events) {
    inputLog.push(event.kind === 'key'
      ? `${event.code} ${event.pressed ? 'down' : 'up'} shift=${event.shift} alt=${event.alt}`
      : `${event.kind} btn=${event.button} alt=${event.alt}`);
  }
  while (inputLog.length > 8) inputLog.shift();
  const charge = sceneApi?.chargeLevel ? sceneApi.chargeLevel() : 0;
  node.hidden = false;
  const vents = sceneApi?.debugLines?.length ? `${sceneApi.debugLines.join('\n')}\n` : '';
  node.textContent = `tiers ${unlockedChargeTier}  charge ${charge.toFixed(2)}\n${vents}${inputLog.join('\n')}`;
}

window.__EOT__ = {
  buildId: BUILD_ID,
  mode: () => mode,
  pose: () => sceneApi?.captureState() ?? null,
  place: (position) => sceneApi?.place?.(position),
  cameraName: () => sceneApi?.cameraName ?? '',
  perfReport: () => perf?.report() ?? null,
};

fetch(`${import.meta.env.BASE_URL}data/credits.json`)
  .then((response) => response.json())
  .then((data) => {
    creditEntries.splice(0, creditEntries.length, ...(Array.isArray(data?.entries) ? data.entries : []));
  })
  .catch((error) => console.error(error));

loadDialogue(`${import.meta.env.BASE_URL}data/dialogue.json`)
  .catch((error) => {
    console.error(error);
  })
  .finally(() => {
    menus.showMain();
  });
