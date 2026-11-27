/**
 * Main menu and pause menu. The input-device switch is rendered only on the
 * main menu. Settings here are the mid-game-safe set and write through to
 * the settings store immediately (localStorage), so the next presented frame
 * already sees them.
 */

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function volumeLabel(value) {
  return `${Math.round(Number(value) * 100)}%`;
}

export function createMenus(root, { settings, t, buildId, onPlay, onResume, onRestart, onQuit }) {
  let screen = 'main';
  let settingsReturn = 'main';
  let statusText = '';
  let padTimer = 0;

  function stopPadTimer() {
    if (!padTimer) return;
    clearInterval(padTimer);
    padTimer = 0;
  }

  function updatePadStatus() {
    const node = root.querySelector('[data-pad]');
    if (!node) return;
    let label = null;
    if (typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function') {
      for (const pad of navigator.getGamepads()) {
        if (pad) {
          label = pad.id;
          break;
        }
      }
    }
    node.textContent = label ? `Connected: ${label}` : 'No gamepad detected.';
  }

  function syncPadTimer() {
    if (screen === 'main') {
      updatePadStatus();
      if (!padTimer) padTimer = setInterval(updatePadStatus, 500);
    } else {
      stopPadTimer();
    }
  }

  function settingsFields() {
    const current = settings.get();
    const shake = current.cameraShake ? 'checked' : '';
    return `
      <form data-settings="1">
        <label>FPS cap
          <select name="fpsCap">
            <option value="30" ${current.fpsCap === 30 ? 'selected' : ''}>30</option>
            <option value="60" ${current.fpsCap === 60 ? 'selected' : ''}>60</option>
          </select>
        </label>
        <label>Master
          <span><input type="range" name="master" min="0" max="1" step="0.05" value="${current.master}">
          <span data-for="master">${volumeLabel(current.master)}</span></span>
        </label>
        <label>Music
          <span><input type="range" name="music" min="0" max="1" step="0.05" value="${current.music}">
          <span data-for="music">${volumeLabel(current.music)}</span></span>
        </label>
        <label>SFX
          <span><input type="range" name="sfx" min="0" max="1" step="0.05" value="${current.sfx}">
          <span data-for="sfx">${volumeLabel(current.sfx)}</span></span>
        </label>
        <label>Mouse sensitivity
          <span><input type="range" name="mouseSensitivity" min="0.2" max="2" step="0.05" value="${current.mouseSensitivity}">
          <span data-for="mouseSensitivity">${Number(current.mouseSensitivity).toFixed(2)}</span></span>
        </label>
        <label class="check">Camera shake
          <input type="checkbox" name="cameraShake" ${shake}>
        </label>
        <label>Render scale
          <select name="renderScale">
            ${[0.5, 0.75, 1].map((scale) => `
              <option value="${scale}" ${current.renderScale === scale ? 'selected' : ''}>${scale.toFixed(2)}</option>
            `).join('')}
          </select>
        </label>
        <button type="button" class="menu" data-action="back">Back</button>
      </form>
    `;
  }

  function render() {
    root.classList.toggle('is-open', screen !== 'hidden');
    root.classList.toggle('is-pause', screen === 'pause' || (screen === 'settings' && settingsReturn === 'pause'));
    if (screen === 'hidden') {
      root.innerHTML = '';
      stopPadTimer();
      return;
    }

    let body = '';
    if (screen === 'main') {
      const device = settings.get().inputDevice;
      body = `
        <h1>Ember Over Tide</h1>
        <p class="sub">M0 test build</p>
        <div class="menu-actions">
          <button type="button" class="menu" data-action="play">Play</button>
          <button type="button" class="menu" data-action="settings">Settings</button>
          <button type="button" class="menu" data-action="credits">Credits</button>
        </div>
        <fieldset>
          <legend>Input</legend>
          <label class="choice"><input type="radio" name="inputDevice" value="keyboard" ${device !== 'gamepad' ? 'checked' : ''}> Keyboard + mouse</label>
          <label class="choice"><input type="radio" name="inputDevice" value="gamepad" ${device === 'gamepad' ? 'checked' : ''}> Gamepad</label>
          <p class="fine" data-pad>No gamepad detected.</p>
          <p class="fine">Placeholder. Left stick moves the test capsule. The full layout comes later.</p>
        </fieldset>
        <p class="status" data-status>${escapeHtml(statusText)}</p>
        <p class="build">Build ${escapeHtml(buildId)}</p>
      `;
    } else if (screen === 'settings') {
      body = `
        <h2>Settings</h2>
        <p class="fine">Safe to change mid-game. Saved on this browser.</p>
        ${settingsFields()}
      `;
    } else if (screen === 'credits') {
      body = `
        <h2>Credits</h2>
        <p>${escapeHtml(t('credits.body'))}</p>
        <button type="button" class="menu" data-action="back">Back</button>
      `;
    } else if (screen === 'pause') {
      body = `
        <h2>Paused</h2>
        <div class="menu-actions">
          <button type="button" class="menu" data-action="resume">Resume</button>
          <button type="button" class="menu" data-action="settings">Settings</button>
          <button type="button" class="menu" data-action="restart">Restart</button>
          <button type="button" class="menu" data-action="quit">Quit</button>
        </div>
        <p class="fine">P resumes</p>
      `;
    }

    root.innerHTML = `<div class="panel">${body}</div>`;
    root.querySelector('button')?.focus();
    syncPadTimer();
  }

  function commitForm(form) {
    if (!form?.dataset.settings) return;
    settings.update({
      fpsCap: Number(form.elements.fpsCap.value),
      master: Number(form.elements.master.value),
      music: Number(form.elements.music.value),
      sfx: Number(form.elements.sfx.value),
      mouseSensitivity: Number(form.elements.mouseSensitivity.value),
      cameraShake: form.elements.cameraShake.checked,
      renderScale: Number(form.elements.renderScale.value),
    });
    for (const range of form.querySelectorAll('input[type="range"]')) {
      const out = form.querySelector(`[data-for="${range.name}"]`);
      if (!out) continue;
      out.textContent = range.name === 'mouseSensitivity'
        ? Number(range.value).toFixed(2)
        : volumeLabel(range.value);
    }
  }

  root.addEventListener('submit', (event) => event.preventDefault());
  root.addEventListener('input', (event) => {
    const form = event.target?.form;
    if (form) commitForm(form);
  });
  root.addEventListener('change', (event) => {
    const target = event.target;
    if (target?.name === 'inputDevice') {
      settings.update({ inputDevice: target.value === 'gamepad' ? 'gamepad' : 'keyboard' });
      return;
    }
    if (target?.form) commitForm(target.form);
  });
  root.addEventListener('click', (event) => {
    const action = event.target?.closest?.('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'play') onPlay();
    else if (action === 'settings') {
      settingsReturn = screen === 'pause' ? 'pause' : 'main';
      screen = 'settings';
      render();
    } else if (action === 'credits') {
      settingsReturn = 'main';
      screen = 'credits';
      render();
    } else if (action === 'back') {
      screen = settingsReturn === 'pause' ? 'pause' : 'main';
      render();
    } else if (action === 'resume') onResume();
    else if (action === 'restart') onRestart();
    else if (action === 'quit') onQuit();
  });

  return {
    showMain() {
      screen = 'main';
      settingsReturn = 'main';
      render();
    },
    showPause() {
      screen = 'pause';
      settingsReturn = 'pause';
      render();
    },
    hide() {
      screen = 'hidden';
      render();
    },
    setStatus(text) {
      statusText = text;
      const node = root.querySelector('[data-status]');
      if (node) node.textContent = text;
    },
    screen() {
      return screen;
    },
  };
}
