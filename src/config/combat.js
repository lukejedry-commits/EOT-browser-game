/**
 * Heavy-charge numbers (Mechanics). Damage is recorded for later;
 * M1 does not apply it. Glow stays ember to deep red, never white.
 */

export const COMBAT = {
  crouchTapMs: 250,
  tier2Ms: 300,
  tier3Ms: 800,
  maxChargeMs: 1400,
  chargeMoveScale: 0.5,
  tiers: {
    1: { damage: 22, knockback: 4, hitStopMs: 110, mpScale: 1, shockwave: 0, stagger: false },
    2: { damage: 33, knockback: 6, hitStopMs: 130, mpScale: 1.5, shockwave: 0, stagger: false, breaksGuardAnySide: true },
    3: { damage: 45, knockback: 8, hitStopMs: 150, mpScale: 2, shockwave: 2, stagger: true, bossStagger: false },
  },
  glowEmber: 0xff7a1a,
  glowMax: 0x6e1208,
  ventMs: { 2: 400, 3: 600 },
  autoVentMs: 2000,
  ventRollMs: 250,
  ventMoveScale: 0.5,
};

/**
 * Hit windows are milliseconds of elapsed time, never animation events.
 * A charged heavy enters at contact minus 150 ms, from any charge tier.
 */
export const FRAMES = {
  light: [
    { id: 'light1', startup: 120, active: 100, recovery: 130 },
    { id: 'light2', startup: 120, active: 100, recovery: 130 },
    { id: 'light3', startup: 120, active: 100, recovery: 130 },
    { id: 'light4', startup: 150, active: 200, recovery: 250 },
  ],
  heavy: { id: 'heavy', startup: 450, active: 120, recovery: 350 },
  heavyEnterBeforeContact: 150,
  parry: { id: 'parry', startup: 0, active: 150, recovery: 100 },
  grab: { id: 'grab', startup: 100, active: 150, recovery: 0 },
  roll: { total: 450, iframeStart: 80, iframeEnd: 320 },
  airKick: { id: 'airKick', startup: 0, active: 80, recovery: 0 },
};

export function chargedHeavyElapsed(frames = FRAMES) {
  return frames.heavy.startup - frames.heavyEnterBeforeContact;
}

export function phaseAt(move, elapsed) {
  if (!move) return 'idle';
  if (elapsed < move.startup) return 'startup';
  if (elapsed < move.startup + move.active) return 'active';
  if (elapsed < move.startup + move.active + (move.recovery ?? 0)) return 'recovery';
  return 'done';
}

export function rollHasIFrame(elapsed, frames = FRAMES) {
  return elapsed >= frames.roll.iframeStart && elapsed < frames.roll.iframeEnd;
}

/** Attack clock. The active window is whatever phaseAt says at this elapsed time. */
export function createCombatClock(frames = FRAMES) {
  let move = null;
  let elapsed = 0;
  let chain = 0;

  function begin(next, at = 0) {
    move = next;
    elapsed = at;
  }

  return {
    startLight() {
      const open = move != null && phaseAt(move, elapsed) !== 'done';
      const index = open ? chain : 0;
      begin(frames.light[index]);
      chain = (index + 1) % frames.light.length;
    },
    startHeavy(charged) {
      begin(frames.heavy, charged ? chargedHeavyElapsed(frames) : 0);
      chain = 0;
    },
    startParry() {
      begin(frames.parry);
      chain = 0;
    },
    startGrab() {
      begin(frames.grab);
      chain = 0;
    },
    startAirKick() {
      begin(frames.airKick);
    },
    step(dtMs) {
      if (!move) return 'idle';
      elapsed += dtMs;
      const phase = phaseAt(move, elapsed);
      if (phase === 'done') move = null;
      return phase;
    },
    phase() {
      return phaseAt(move, elapsed);
    },
    moveId() {
      return move ? move.id : null;
    },
    elapsed() {
      return elapsed;
    },
    hitActive() {
      return phaseAt(move, elapsed) === 'active';
    },
  };
}

/** T1 under 0.3 s, T2 from 0.3 s, T3 from 0.8 s and held after 1.4 s. */
export function chargeTier(chargeMs) {
  const ms = Math.max(0, chargeMs);
  if (ms < COMBAT.tier2Ms) return 1;
  if (ms < COMBAT.tier3Ms) return 2;
  return 3;
}

export function charge01(chargeMs, maxChargeMs = COMBAT.maxChargeMs) {
  if (maxChargeMs <= 0) return 0;
  return Math.min(1, Math.max(0, chargeMs / maxChargeMs));
}

export function chargeGlow(amount) {
  const t = Math.min(1, Math.max(0, amount));
  const from = COMBAT.glowEmber;
  const to = COMBAT.glowMax;
  const channel = (shift) => {
    const a = (from >> shift) & 255;
    const b = (to >> shift) & 255;
    return Math.round(a + (b - a) * t);
  };
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}
