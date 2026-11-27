/**
 * All spoken or on-screen story lines come from string ids in
 * `public/data/dialogue.json`. `t(id)` returns the string, or the id itself
 * when the line is missing or not a string.
 */

let table = Object.create(null);

export function setDialogueTable(data) {
  table = data && typeof data === 'object' ? data : Object.create(null);
}

export function t(id) {
  const value = table[id];
  return typeof value === 'string' ? value : String(id);
}

export async function loadDialogue(url, fetchImpl = fetch) {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`dialogue load failed: ${response.status}`);
  }
  const data = await response.json();
  setDialogueTable(data);
  return data;
}
