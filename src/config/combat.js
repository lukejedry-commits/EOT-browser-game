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
};

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
