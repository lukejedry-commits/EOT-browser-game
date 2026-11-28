/**
 * Red-orb economy for the two braziers. Every red-orb source is listed here
 * so the slice total can be checked exactly.
 *
 * Arena before B1: 10 Priests, 2 Guards, 2 Diviners, and a 50 burst.
 * Between the braziers: the crank's first wave, the gate-solved burst, and
 * the main-path urns. Optional urns sit off that path.
 * Priests that respawn at the crank, and priests the boss summons, drop
 * health and MP only.
 */

export const ORB_COLORS = {
  soul: 0xff4a1a,
  health: 0x9ccf3a,
  mp: 0x6a6cff,
};

export const DROP_VALUES = {
  priest: 25,
  guard: 60,
  diviner: 40,
};

export const ARENA_CLEAR = {
  priests: 10,
  guards: 2,
  diviners: 2,
  burst: 50,
};

/** First crank turn: 3 Drowned Priests and 1 Diviner. */
export const CRANK_FIRST_WAVE = {
  priests: 3,
  diviners: 1,
};

export const GATE_SOLVED_BURST = 200;

export const MAIN_URNS = [
  { id: 'lip', value: 60, x: 1.2, y: 0.42, z: 36.7 },
  { id: 'gate-mouth', value: 50, x: 6.2, y: 1.45, z: 64.6 },
  { id: 'crawl-exit', value: 60, x: 0.4, y: 0.42, z: 82.7 },
  { id: 'b2-side', value: 65, x: -2.5, y: 0.42, z: 84.2 },
];

export const OPTIONAL_URNS = [
  { id: 'A', value: 50, x: 9.15, y: 2.42, z: 78.7 },
  { id: 'B', value: 50, x: 0.2, y: 0.38, z: 20.5 },
  { id: 'C', value: 50, x: -4, y: 0.42, z: 87.2 },
];

export const BRAZIERS = [
  { id: 'B1', x: 10.2, y: 0.55, z: 63.4, light: 'b1' },
  { id: 'B2', x: -4, y: 0.55, z: 84.2, light: 'b2' },
];

export const CORAL_WALL = { x: -4, y: 1.15, z: 85.7, w: 3.2, h: 2.3, d: 0.45 };

export const SHOP = [
  { id: 'charge2', name: 'Ember Charge II', cost: 250, needs: null },
  { id: 'charge3', name: 'Ember Charge III', cost: 350, needs: 'charge2' },
  { id: 'light5', name: '5th light hit', cost: 300, needs: null },
  { id: 'wrath', name: 'Cheaper Ember Wrath', cost: 300, needs: null },
  { id: 'hp', name: '+25 HP', cost: 400, needs: null },
];

export const BASE_HP = 100;
export const HP_BONUS = 25;
export const WRATH_MP = 60;
export const WRATH_MP_CHEAP = 45;
export const ORB_POOL = 30;

export function redOrbsForDrop(kind) {
  if (kind === 'priest-respawn' || kind === 'priest-summon') return 0;
  if (kind === 'priest') return DROP_VALUES.priest;
  if (kind === 'guard') return DROP_VALUES.guard;
  if (kind === 'diviner') return DROP_VALUES.diviner;
  return 0;
}

export function otherDropsFor(kind) {
  if (kind === 'priest-respawn' || kind === 'priest-summon') {
    return { health: 1, mp: 1, red: 0 };
  }
  return { health: 0, mp: 0, red: redOrbsForDrop(kind) };
}

function waveValue(counts) {
  return (counts.priests ?? 0) * DROP_VALUES.priest
    + (counts.guards ?? 0) * DROP_VALUES.guard
    + (counts.diviners ?? 0) * DROP_VALUES.diviner;
}

export function redOrbSources() {
  const urns = [...MAIN_URNS, ...OPTIONAL_URNS].map((urn) => ({
    id: `urn-${urn.id}`,
    red: urn.value,
  }));
  return [
    { id: 'arena-priests', red: ARENA_CLEAR.priests * DROP_VALUES.priest },
    { id: 'arena-guards', red: ARENA_CLEAR.guards * DROP_VALUES.guard },
    { id: 'arena-diviners', red: ARENA_CLEAR.diviners * DROP_VALUES.diviner },
    { id: 'arena-burst', red: ARENA_CLEAR.burst },
    { id: 'crank-first-wave', red: waveValue(CRANK_FIRST_WAVE) },
    { id: 'gate-solved', red: GATE_SOLVED_BURST },
    ...urns,
    { id: 'priest-respawn', red: redOrbsForDrop('priest-respawn') },
    { id: 'priest-summon', red: redOrbsForDrop('priest-summon') },
  ];
}

export function totalRedOrbs(sources = redOrbSources()) {
  return sources.reduce((sum, source) => sum + source.red, 0);
}

export function createWallet(startingOrbs = 0) {
  const owned = new Set();
  let orbs = Math.max(0, startingOrbs | 0);
  return {
    orbs() { return orbs; },
    grant(amount) {
      orbs += Math.max(0, amount | 0);
      return orbs;
    },
    owns(id) { return owned.has(id); },
    chargeTier() {
      if (owned.has('charge3')) return 3;
      if (owned.has('charge2')) return 2;
      return 1;
    },
    lightCount() { return owned.has('light5') ? 5 : 4; },
    maxHp() { return BASE_HP + (owned.has('hp') ? HP_BONUS : 0); },
    wrathCost() { return owned.has('wrath') ? WRATH_MP_CHEAP : WRATH_MP; },
    canBuy(id) {
      const item = SHOP.find((entry) => entry.id === id);
      if (!item || owned.has(id)) return false;
      if (item.needs && !owned.has(item.needs)) return false;
      return orbs >= item.cost;
    },
    buy(id) {
      if (!this.canBuy(id)) return false;
      const item = SHOP.find((entry) => entry.id === id);
      orbs -= item.cost;
      owned.add(id);
      return true;
    },
    snapshot() {
      return { orbs, owned: [...owned] };
    },
    restore(snapshot) {
      orbs = Math.max(0, snapshot?.orbs ?? 0);
      owned.clear();
      for (const id of snapshot?.owned ?? []) owned.add(id);
    },
  };
}
