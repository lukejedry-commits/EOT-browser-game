/**
 * On-screen line timing. The angel line and the cell's white-gold light
 * share one opacity curve. Barks replace whatever is showing and never queue.
 */

export const SUBTITLES = {
  fadeInMs: 300,
  angelHoldMs: 4000,
  fadeOutMs: 600,
  replyDelayMs: 1000,
  replyHoldMs: 2500,
  barkHoldMs: 1500,
  hintMoveMs: 3000,
  hintFadeMs: 500,
  angelId: 'cell_angel_01',
  replyId: 'cell_korrath_01',
};

export function angelSpan(config = SUBTITLES) {
  return {
    fadeInEnd: config.fadeInMs,
    holdEnd: config.fadeInMs + config.angelHoldMs,
    fadeOutEnd: config.fadeInMs + config.angelHoldMs + config.fadeOutMs,
  };
}

export function createSubtitleState() {
  return {
    elapsed: 0,
    barkId: null,
    barkElapsed: 0,
    qte: false,
  };
}

/** Opacity of the angel line and its light. 0 before and after the line. */
export function angelOpacity(elapsed, config = SUBTITLES) {
  const span = angelSpan(config);
  if (elapsed < 0 || elapsed >= span.fadeOutEnd) return 0;
  if (elapsed < span.fadeInEnd) return elapsed / config.fadeInMs;
  if (elapsed < span.holdEnd) return 1;
  return 1 - (elapsed - span.holdEnd) / config.fadeOutMs;
}

/**
 * What the subtitle line should show. A bark replaces the scripted line.
 * During a QTE the bark is dropped and not stored.
 */
export function requestBark(state, id) {
  if (state.qte || !id) return false;
  state.barkId = id;
  state.barkElapsed = 0;
  return true;
}

export function stepSubtitles(state, dtMs, config = SUBTITLES) {
  state.elapsed += dtMs;
  if (state.barkId) {
    state.barkElapsed += dtMs;
    if (state.barkElapsed >= config.barkHoldMs) {
      state.barkId = null;
      state.barkElapsed = 0;
    }
  }
  return shownLine(state, config);
}

export function shownLine(state, config = SUBTITLES) {
  if (state.barkId && !state.qte) {
    return { id: state.barkId, opacity: 1, light: angelOpacity(state.elapsed, config) };
  }
  const span = angelSpan(config);
  const light = angelOpacity(state.elapsed, config);
  if (state.elapsed < span.fadeOutEnd) {
    return { id: config.angelId, opacity: light, light };
  }
  const replyStart = span.fadeOutEnd + config.replyDelayMs;
  const replyEnd = replyStart + config.replyHoldMs;
  if (state.elapsed >= replyStart && state.elapsed < replyEnd) {
    return { id: config.replyId, opacity: 1, light: 0 };
  }
  return { id: null, opacity: 0, light: 0 };
}

export function stepHint(moveMs, moving, dtMs, config = SUBTITLES) {
  const next = moveMs + (moving ? dtMs : 0);
  if (next <= config.hintMoveMs) return { moveMs: next, opacity: 1 };
  const fade = (next - config.hintMoveMs) / config.hintFadeMs;
  return { moveMs: next, opacity: Math.max(0, 1 - fade) };
}
