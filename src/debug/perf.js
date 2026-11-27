/**
 * `?perf=1` overlay. Records presented-frame times, renderer.info, the physics
 * step, and JS heap (Chrome only) and shows a JSON report stamped with the
 * build id for Luke to paste back.
 */

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[index];
}

function heapUsed() {
  const memory = performance.memory;
  if (!memory || typeof memory.usedJSHeapSize !== 'number') return null;
  return memory.usedJSHeapSize;
}

export function createPerfOverlay(root, { buildId }) {
  root.hidden = false;
  root.innerHTML = `
    <div class="perf-panel">
      <p class="perf-title">perf <span data-field="scene"></span></p>
      <dl>
        <dt>fps</dt><dd data-field="fps">–</dd>
        <dt>frame ms</dt><dd data-field="frame">–</dd>
        <dt>step ms</dt><dd data-field="step">–</dd>
        <dt>draws</dt><dd data-field="draws">–</dd>
        <dt>tris</dt><dd data-field="tris">–</dd>
        <dt>heap</dt><dd data-field="heap">–</dd>
      </dl>
      <pre data-field="json"></pre>
      <button type="button" data-copy>Copy JSON</button>
    </div>
  `;

  const fields = {};
  for (const node of root.querySelectorAll('[data-field]')) {
    fields[node.dataset.field] = node;
  }

  const frames = [];
  let lastNow = null;
  let lastStep = 0;
  let lastDraws = 0;
  let lastTris = 0;
  let lastScene = '';
  let lastCap = 30;
  let lastDom = 0;

  function report() {
    const sorted = [...frames].sort((a, b) => a - b);
    const last = frames.length ? frames[frames.length - 1] : 0;
    const sum = frames.reduce((total, value) => total + value, 0);
    const avg = frames.length ? sum / frames.length : 0;
    return {
      buildId,
      scene: lastScene,
      fpsCap: lastCap,
      fps: avg > 0 ? Math.round((1000 / avg) * 10) / 10 : 0,
      frameMs: Math.round(last * 100) / 100,
      frameMsP95: Math.round(percentile(sorted, 0.95) * 100) / 100,
      frameMsP99: Math.round(percentile(sorted, 0.99) * 100) / 100,
      physicsStepMs: Math.round(lastStep * 1000) / 1000,
      drawCalls: lastDraws,
      triangles: lastTris,
      jsHeapUsed: heapUsed(),
      samples: frames.length,
    };
  }

  function paint(now) {
    if (now - lastDom < 200) return;
    lastDom = now;
    const data = report();
    fields.scene.textContent = data.scene || '';
    fields.fps.textContent = data.fps ? data.fps.toFixed(1) : '–';
    fields.frame.textContent = data.samples ? data.frameMs.toFixed(2) : '–';
    fields.step.textContent = data.physicsStepMs.toFixed(3);
    fields.draws.textContent = String(data.drawCalls);
    fields.tris.textContent = String(data.triangles);
    fields.heap.textContent = data.jsHeapUsed == null
      ? 'n/a'
      : `${(data.jsHeapUsed / (1024 * 1024)).toFixed(1)} MB`;
    fields.json.textContent = JSON.stringify(data, null, 2);
  }

  root.querySelector('[data-copy]').addEventListener('click', async () => {
    const text = JSON.stringify(report(), null, 2);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      fields.json.textContent = text;
    }
  });

  return {
    sample({ now, renderer, stepMs, settings, scene }) {
      if (lastNow != null) {
        const ms = now - lastNow;
        if (ms > 0 && ms < 1000) {
          frames.push(ms);
          if (frames.length > 600) frames.shift();
        }
      }
      const cap = settings?.fpsCap ?? lastCap;
      if (cap !== lastCap) {
        frames.length = 0;
        lastNow = null;
        lastCap = cap;
      }
      lastNow = now;
      lastStep = stepMs || 0;
      lastScene = scene || '';
      const info = renderer?.info?.render;
      lastDraws = info?.calls ?? 0;
      lastTris = info?.triangles ?? 0;
      paint(now);
    },
    report,
  };
}
