import { describe, expect, it } from 'vitest';
import {
  DROP_VALUES,
  GATE_SOLVED_BURST,
  MAIN_URNS,
  SHOP,
  createWallet,
  redOrbSources,
  redOrbsForDrop,
  totalRedOrbs,
} from '../src/config/economy.js';
import { createCombatClock } from '../src/config/combat.js';
import { loadRapier } from '../src/physics/world.js';
import { createRoute } from '../src/scenes/route.js';

describe('red orb sources', () => {
  it('sums every source to 1,200 and gives respawns no red orbs', () => {
    const sources = redOrbSources();
    expect(totalRedOrbs(sources)).toBe(1200);
    expect(sources.find((source) => source.id === 'arena-priests').red).toBe(10 * DROP_VALUES.priest);
    expect(sources.find((source) => source.id === 'crank-first-wave').red).toBe(115);
    expect(sources.find((source) => source.id === 'gate-solved').red).toBe(GATE_SOLVED_BURST);
    expect(MAIN_URNS.reduce((sum, urn) => sum + urn.value, 0)).toBe(235);
    expect(redOrbsForDrop('priest-respawn')).toBe(0);
    expect(redOrbsForDrop('priest-summon')).toBe(0);
    expect(sources.find((source) => source.id === 'priest-respawn').red).toBe(0);
    expect(sources.find((source) => source.id === 'priest-summon').red).toBe(0);
  });

  it('sells the brazier list and raises the charge tier only after the purchase', () => {
    const wallet = createWallet(2000);
    expect(wallet.chargeTier()).toBe(1);
    expect(wallet.canBuy('charge3')).toBe(false);
    expect(wallet.buy('charge2')).toBe(true);
    expect(wallet.chargeTier()).toBe(2);
    expect(wallet.orbs()).toBe(2000 - 250);
    expect(wallet.buy('charge3')).toBe(true);
    expect(wallet.chargeTier()).toBe(3);
    expect(wallet.buy('light5')).toBe(true);
    expect(wallet.lightCount()).toBe(5);
    expect(wallet.buy('wrath')).toBe(true);
    expect(wallet.wrathCost()).toBe(45);
    expect(wallet.buy('hp')).toBe(true);
    expect(wallet.maxHp()).toBe(125);
    expect(SHOP).toHaveLength(5);
    const clock = createCombatClock(undefined, { lightCount: () => wallet.lightCount() });
    clock.startLight();
    for (let i = 0; i < 4; i += 1) {
      clock.step(200);
      clock.startLight();
    }
    expect(clock.moveId()).toBe('light5');
  });
});

describe('urns and checkpoints', () => {
  it('keeps orbs and broken urns when the checkpoint reloads', async () => {
    const R = await loadRapier();
    const route = createRoute(R, { startingOrbs: 80 });
    const saved = route.captureState();
    route.place({ x: 1.2, y: 1.05, z: 36.7 });
    route.step(16, {
      input: { isDown: () => false },
      settings: { quality: 'high', inputDevice: 'keyboard' },
      events: [{ kind: 'mouse', button: 0, pressed: true, time: 16, shift: false, alt: false }],
    });
    expect(route.orbs()).toBe(80 + 60);
    route.restoreState(saved);
    expect(route.orbs()).toBe(80 + 60);
    expect(route.captureState().player.z).toBeCloseTo(saved.player.z, 1);
    route.dispose();
  }, 20000);
});
