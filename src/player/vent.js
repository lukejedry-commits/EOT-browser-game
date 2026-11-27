/**
 * Ember vent. Tier 1 never starts one. While it runs, attacks, blocks and
 * parries are locked, speed is halved, and damage is unchanged. The roll
 * stays locked until 0.25 s, and the first 0.25 s cannot be broken.
 */

import { COMBAT } from '../config/combat.js';

export function createVentState() {
  return { active: false, elapsed: 0, duration: 0, tier: 0 };
}

export function ventDuration(tier, config = COMBAT) {
  if (tier >= 3) return config.ventMs[3];
  if (tier === 2) return config.ventMs[2];
  return 0;
}

export function startVent(state, tier, config = COMBAT) {
  const duration = ventDuration(tier, config);
  if (duration <= 0) return false;
  state.active = true;
  state.elapsed = 0;
  state.duration = duration;
  state.tier = tier;
  return true;
}

export function stepVent(state, dtMs) {
  if (!state.active) return state;
  state.elapsed += dtMs;
  if (state.elapsed >= state.duration) state.active = false;
  return state;
}

export function ventBlocksCombat(state) {
  return state.active === true;
}

/** Roll stays locked until this instant, then it is allowed. */
export function ventAllowsRoll(state, config = COMBAT) {
  if (!state.active) return true;
  return state.elapsed >= config.ventRollMs;
}

export function ventUnbreakable(state, config = COMBAT) {
  return state.active === true && state.elapsed < config.ventRollMs;
}

export function ventSpeedScale(state, config = COMBAT) {
  return state.active ? config.ventMoveScale : 1;
}

/** Vent does not reduce damage taken. */
export function ventDamageScale() {
  return 1;
}
