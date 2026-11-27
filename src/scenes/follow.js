import * as THREE from 'three';
import { sampleGamepadStick, yawDeltaFromPixels } from '../core/input.js';

export const MOVE_SPEED = 5.5;
const LOOK_DIST = 7.2;
const LOOK_HEIGHT = 3.15;
const LOOK_RATE = 7;

export function readMoveAxes(input, settings) {
  let fwd = 0;
  let strafe = 0;
  if (input.isDown('KeyW') || input.isDown('ArrowUp')) fwd += 1;
  if (input.isDown('KeyS') || input.isDown('ArrowDown')) fwd -= 1;
  if (input.isDown('KeyD') || input.isDown('ArrowRight')) strafe += 1;
  if (input.isDown('KeyA') || input.isDown('ArrowLeft')) strafe -= 1;

  if (settings.inputDevice === 'gamepad') {
    const stick = sampleGamepadStick();
    if (stick) {
      strafe += stick.x;
      fwd += -stick.y;
    }
  }

  const mag = Math.hypot(fwd, strafe);
  if (mag > 1) {
    fwd /= mag;
    strafe /= mag;
  }
  return { fwd, strafe };
}

/** Camera-relative XZ velocity. Yaw 0 looks down -Z, with the camera sitting on +Z. */
export function cameraRelativeVelocity(yaw, fwd, strafe, speed = MOVE_SPEED) {
  const forwardX = -Math.sin(yaw);
  const forwardZ = -Math.cos(yaw);
  const rightX = Math.cos(yaw);
  const rightZ = -Math.sin(yaw);
  return {
    x: (forwardX * fwd + rightX * strafe) * speed,
    z: (forwardZ * fwd + rightZ * strafe) * speed,
  };
}

export function createFollowCamera(camera) {
  const desired = new THREE.Vector3();
  let yaw = 0;
  let ready = false;

  return {
    get yaw() {
      return yaw;
    },
    set yaw(value) {
      yaw = value;
    },
    addPointer(dx, sensitivity) {
      yaw += yawDeltaFromPixels(dx, sensitivity);
    },
    update(target, dtSec) {
      desired.set(
        target.x + Math.sin(yaw) * LOOK_DIST,
        target.y + LOOK_HEIGHT,
        target.z + Math.cos(yaw) * LOOK_DIST,
      );
      if (!ready || dtSec <= 0) {
        camera.position.copy(desired);
        ready = true;
      } else {
        const blend = 1 - Math.exp(-LOOK_RATE * dtSec);
        camera.position.lerp(desired, blend);
      }
      camera.lookAt(target.x, target.y + 0.9, target.z);
    },
    reset() {
      yaw = 0;
      ready = false;
    },
  };
}
