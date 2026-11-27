/**
 * Checkpoint stub. Later milestones store HP, MP, upgrades, and puzzle state.
 * `save` copies the plain object; `restore` returns a copy so callers can
 * mutate the result without touching the slot.
 */
function clone(value) {
  if (value == null) return null;
  return JSON.parse(JSON.stringify(value));
}

export function createCheckpoint() {
  let slot = null;
  return {
    save(state) {
      slot = clone(state);
    },
    restore() {
      return clone(slot);
    },
  };
}

export const checkpoint = createCheckpoint();
