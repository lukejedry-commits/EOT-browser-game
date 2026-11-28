import { describe, expect, it } from 'vitest';
import { horizontalReach, verticalReach, MOVEMENT, deriveJump } from '../src/config/movement.js';
import {
  COLONNADE_GAP,
  RUBBLE_VISIBLE_HEIGHT,
  TIDE_BLOCKERS,
  THRESHOLD_HEIGHT,
  WEDGED_OPENING,
  resolveGatePush,
} from '../src/scenes/level-data.js';
import { aimSnap } from '../src/camera/aim.js';
import { updateMoveLatch } from '../src/camera/basis.js';
import { CAMERA_BLEND_MS, blendShots, selectZone } from '../src/camera/zones.js';
import { createMotorState, hurtboxHeight, stepBodyPose, stepJump } from '../src/player/motor.js';

const basisA = { forward: { x: 0, z: -1 }, right: { x: 1, z: 0 } };
const basisB = { forward: { x: 1, z: 0 }, right: { x: 0, z: 1 } };

describe('route reach and the Tide Gate', () => {
  it('keeps blockers above jump reach and the crawl opening at 1.4 m', () => {
    const reach = verticalReach(MOVEMENT, 1 + MOVEMENT.airJumps);
    expect(reach).toBeCloseTo(2.7, 5);
    for (const blocker of TIDE_BLOCKERS) {
      expect(blocker.maxY).toBeGreaterThan(reach);
      expect(blocker.visibleHeight).toBeGreaterThanOrEqual(2);
    }
    expect(RUBBLE_VISIBLE_HEIGHT).toBeGreaterThanOrEqual(2);
    expect(WEDGED_OPENING).toBe(1.4);
    expect(WEDGED_OPENING).toBeGreaterThanOrEqual(MOVEMENT.crawlOpening);
    expect(MOVEMENT.standHeight).toBeGreaterThan(WEDGED_OPENING);
    expect(MOVEMENT.crouchHeight).toBeLessThanOrEqual(WEDGED_OPENING);
  });

  it('sizes the colonnade gap and the threshold ledge from the jump math', () => {
    expect(horizontalReach(MOVEMENT, 1)).toBeLessThan(COLONNADE_GAP);
    expect(horizontalReach(MOVEMENT, 2)).toBeGreaterThan(COLONNADE_GAP);
    expect(verticalReach(MOVEMENT, 1)).toBeLessThan(THRESHOLD_HEIGHT);
    expect(verticalReach(MOVEMENT, 2)).toBeGreaterThan(THRESHOLD_HEIGHT);
    const derived = deriveJump();
    expect(derived.jumpSpeed).toBeCloseTo(derived.riseGravity * MOVEMENT.jumpApexTime, 6);
    expect(derived.jumpApex ?? MOVEMENT.jumpApex).toBeDefined();
  });

  it('shoves only while the gate is not wedged', () => {
    const inside = { x: 0, y: 1, z: 81 };
    expect(resolveGatePush({ wedged: false, position: inside }).shoved).toBe(true);
    expect(resolveGatePush({ wedged: true, position: inside }).shoved).toBe(false);
    expect(resolveGatePush({ wedged: false, position: { x: 0, y: 1, z: 70 } }).shoved).toBe(false);
  });
});

describe('camera latch, blend, and aim', () => {
  it('keeps the old basis until the direction changes', () => {
    const held = { fwd: 1, strafe: 0 };
    const first = updateMoveLatch(null, basisA, basisA, held, false);
    const cut = updateMoveLatch(first.latch, basisA, basisB, held, true);
    expect(cut.basis).toEqual(basisA);
    const still = updateMoveLatch(cut.latch, basisA, basisB, held, false);
    expect(still.basis).toEqual(basisA);
    const turned = updateMoveLatch(still.latch, basisA, basisB, { fwd: 1, strafe: 1 }, false);
    expect(turned.basis).toEqual(basisB);
    const released = updateMoveLatch(cut.latch, basisA, basisB, { fwd: 0, strafe: 0 }, false);
    expect(released.latch).toBeNull();
  });

  it('blends over 500 ms and stays in the current zone while it still contains the point', () => {
    const zones = [
      { id: 'a', priority: 0, bounds: { minX: 0, maxX: 10, minY: 0, maxY: 4, minZ: 0, maxZ: 10 } },
      { id: 'b', priority: 0, bounds: { minX: 8, maxX: 20, minY: 0, maxY: 4, minZ: 0, maxZ: 10 } },
      { id: 'c', priority: 2, bounds: { minX: 9, maxX: 12, minY: 0, maxY: 4, minZ: 0, maxZ: 4 } },
    ];
    expect(selectZone(zones, { x: 9, y: 1, z: 8 }, 'a').id).toBe('a');
    expect(selectZone(zones, { x: 15, y: 1, z: 5 }, 'a').id).toBe('b');
    expect(selectZone(zones, { x: 10, y: 1, z: 2 }, 'a').id).toBe('c');
    const from = { position: { x: 0, y: 0, z: 0 }, lookAt: { x: 0, y: 0, z: 1 }, fov: 40 };
    const to = { position: { x: 10, y: 0, z: 0 }, lookAt: { x: 0, y: 0, z: 2 }, fov: 60 };
    expect(blendShots(from, to, 0).position.x).toBe(0);
    expect(blendShots(from, to, CAMERA_BLEND_MS).position.x).toBe(10);
    expect(blendShots(from, to, CAMERA_BLEND_MS / 2).t).toBeCloseTo(0.5, 5);
  });

  it('snaps facing at most 45 degrees toward the nearest enemy inside 4 m', () => {
    const origin = { x: 0, z: 0 };
    const near = aimSnap(0, origin, [{ x: 0.5, z: 3 }], null);
    expect(near).toBeCloseTo(Math.atan2(0.5, 3), 5);
    const far = aimSnap(0, origin, [{ x: 0, z: 5 }], null);
    expect(far).toBe(0);
    const wide = aimSnap(0, origin, [{ x: 3, z: 1 }], null);
    expect(wide).toBe(0);
  });
});

describe('jump timing and crouch stand-up', () => {
  it('reaches the 1.6 m apex at 0.35 s by derivation', () => {
    const derived = deriveJump();
    expect(derived.jumpSpeed * MOVEMENT.jumpApexTime - 0.5 * derived.riseGravity * MOVEMENT.jumpApexTime ** 2)
      .toBeCloseTo(MOVEMENT.jumpApex, 5);
  });

  it('allows a coyote jump at 100 ms and a buffered jump at 120 ms', () => {
    const coyote = createMotorState();
    stepJump(coyote, { grounded: true, jumpEdge: false, posY: 1 }, 16);
    stepJump(coyote, { grounded: false, jumpEdge: false, posY: 1 }, 100);
    const jumped = stepJump(coyote, { grounded: false, jumpEdge: true, posY: 1, timeMs: 120 }, 0);
    expect(jumped.some((event) => event.type === 'jump')).toBe(true);
    expect(coyote.airJumpsLeft).toBe(1);

    const late = createMotorState();
    stepJump(late, { grounded: true, jumpEdge: false, posY: 1 }, 16);
    stepJump(late, { grounded: false, jumpEdge: false, posY: 1 }, 101);
    const missed = stepJump(late, { grounded: false, jumpEdge: true, posY: 1 }, 0);
    expect(missed.some((event) => event.type === 'jump')).toBe(false);

    const buffered = createMotorState();
    stepJump(buffered, { grounded: true, jumpEdge: false, posY: 1 }, 16);
    stepJump(buffered, { grounded: false, jumpEdge: false, posY: 1 }, 200);
    stepJump(buffered, { grounded: false, jumpEdge: true, posY: 1 }, 16);
    stepJump(buffered, { grounded: false, jumpEdge: false, posY: 1 }, 100);
    const landed = stepJump(buffered, { grounded: true, jumpEdge: false, posY: 1, timeMs: 140 }, 0);
    expect(landed.some((event) => event.type === 'jump')).toBe(true);
  });

  it('stands from Space immediately and from an attack after 100 ms', () => {
    const crouched = createMotorState();
    crouched.crouching = true;
    const jumped = stepBodyPose(crouched, { jump: true, headroom: true }, 16);
    expect(jumped.jump).toBe(true);
    expect(crouched.crouching).toBe(false);

    const low = createMotorState();
    low.crouching = true;
    stepBodyPose(low, { attack: true, headroom: true }, 16);
    expect(low.crouching).toBe(true);
    stepBodyPose(low, { headroom: true }, 100);
    expect(low.crouching).toBe(false);

    const blocked = createMotorState();
    blocked.crouching = true;
    stepBodyPose(blocked, { jump: true, headroom: false }, 16);
    expect(blocked.crouching).toBe(true);
    expect(hurtboxHeight(blocked)).toBe(MOVEMENT.crouchHeight);
  });
});

describe('crouch toggle (Luke bug 2)', () => {
  it('a second Shift tap stands back up when there is headroom', () => {
    const s = createMotorState();
    stepBodyPose(s, { toggle: true, headroom: true }, 16);
    expect(s.crouching).toBe(true);
    stepBodyPose(s, { toggle: true, headroom: true }, 16);
    expect(s.crouching).toBe(false);
  });
  it('stays crouched under a low ceiling', () => {
    const s = createMotorState();
    s.crouching = true;
    stepBodyPose(s, { toggle: true, headroom: false }, 16);
    expect(s.crouching).toBe(true);
  });
});
