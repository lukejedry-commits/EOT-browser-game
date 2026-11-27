import { describe, expect, it } from 'vitest';
import { createCheckpoint } from '../src/core/checkpoint.js';

describe('checkpoint stub', () => {
  it('saves and restores a copy of the slot', () => {
    const checkpoint = createCheckpoint();
    expect(checkpoint.restore()).toBeNull();

    checkpoint.save({
      hp: 80,
      mp: 40,
      upgrades: ['hp25'],
      puzzle: { rubbleBroken: true, idolS: 0.25 },
    });

    const first = checkpoint.restore();
    first.hp = 10;
    first.puzzle.idolS = 1;

    expect(checkpoint.restore()).toEqual({
      hp: 80,
      mp: 40,
      upgrades: ['hp25'],
      puzzle: { rubbleBroken: true, idolS: 0.25 },
    });
  });
});
