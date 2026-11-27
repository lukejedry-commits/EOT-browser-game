import { describe, expect, it } from 'vitest';
import {
  SUBTITLES,
  angelOpacity,
  createSubtitleState,
  requestBark,
  shownLine,
  stepSubtitles,
} from '../src/config/subtitles.js';

const angelEnd = SUBTITLES.fadeInMs + SUBTITLES.angelHoldMs + SUBTITLES.fadeOutMs;
const replyStart = angelEnd + SUBTITLES.replyDelayMs;

describe('subtitle timing', () => {
  it('fades the angel line in, holds it, then fades it out', () => {
    expect(angelOpacity(0)).toBe(0);
    expect(angelOpacity(SUBTITLES.fadeInMs / 2)).toBeCloseTo(0.5);
    expect(angelOpacity(SUBTITLES.fadeInMs)).toBe(1);
    expect(angelOpacity(SUBTITLES.fadeInMs + SUBTITLES.angelHoldMs)).toBe(1);
    expect(angelOpacity(angelEnd - SUBTITLES.fadeOutMs / 2)).toBeCloseTo(0.5);
    expect(angelOpacity(angelEnd)).toBe(0);
    expect(angelOpacity(angelEnd + 10)).toBe(0);
  });

  it('starts the whispered reply one second after the angel line and holds 2.5 s', () => {
    const state = createSubtitleState();
    stepSubtitles(state, replyStart - 1);
    expect(shownLine(state).id).toBeNull();
    stepSubtitles(state, 1);
    expect(shownLine(state).id).toBe('cell_korrath_01');
    stepSubtitles(state, SUBTITLES.replyHoldMs - 1);
    expect(shownLine(state).id).toBe('cell_korrath_01');
    stepSubtitles(state, 1);
    expect(shownLine(state).id).toBeNull();
  });

  it('replaces a bark instead of queueing, and drops barks during a QTE', () => {
    const state = createSubtitleState();
    expect(requestBark(state, 'bark_hurt')).toBe(true);
    expect(shownLine(state).id).toBe('bark_hurt');
    expect(requestBark(state, 'bark_low_hp')).toBe(true);
    expect(shownLine(state).id).toBe('bark_low_hp');
    stepSubtitles(state, SUBTITLES.barkHoldMs);
    expect(shownLine(state).id).toBe('cell_angel_01');

    state.qte = true;
    expect(requestBark(state, 'bark_wave_start')).toBe(false);
    expect(state.barkId).toBeNull();
  });
});
