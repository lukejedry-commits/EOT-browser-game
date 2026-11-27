import * as THREE from 'three';
import { BUILD_ID } from './core/build.js';
import { checkpoint } from './core/checkpoint.js';
import { loadDialogue, t } from './core/dialogue.js';
import { attachInput, createInputBuffer, pointerDelta } from './core/input.js';
import { createLoop } from './core/loop.js';
import { createSettingsStore } from './core/settings.js';
import { createPerfOverlay } from './debug/perf.js';
import { loadRapier } from './physics/world.js';
import { createGraybox } from './scenes/graybox.js';
import { createStressScene } from './scenes/stress.js';
import { createMenus } from './ui/menus.js';
import './style.css';

const params = new URLSearchParams(location.search);
const perfEnabled = params.get('perf') === '1';
const stressEnabled = params.get('stress') === '1';

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
    if (!sceneApi) return 0;
    return sceneApi.step(dtMs, {
      input,
      settings: settings.get(),
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
    if (document.pointerLockElement) document.exitPointerLock();
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
    sceneApi = stressEnabled ? createStressScene(R) : createGraybox(R);
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

const menus = createMenus(ui, {
  settings,
  t,
  buildId: BUILD_ID,
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

canvas.addEventListener('click', () => {
  if (mode !== 'play') return;
  canvas.requestPointerLock?.();
});

window.__EOT__ = {
  buildId: BUILD_ID,
  mode: () => mode,
  pose: () => sceneApi?.captureState() ?? null,
  perfReport: () => perf?.report() ?? null,
};

loadDialogue(`${import.meta.env.BASE_URL}data/dialogue.json`)
  .catch((error) => {
    console.error(error);
  })
  .finally(() => {
    menus.showMain();
  });
