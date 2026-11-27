import { describe, expect, it } from 'vitest';
import { loadDialogue, setDialogueTable, t } from '../src/core/dialogue.js';

describe('dialogue fallback', () => {
  it('returns the string for a known id and the id when it is missing', () => {
    setDialogueTable({
      'angel.cell.01': 'placeholder',
      'credits.body': 'placeholder',
    });
    expect(t('angel.cell.01')).toBe('placeholder');
    expect(t('credits.body')).toBe('placeholder');
    expect(t('missing.line')).toBe('missing.line');
  });

  it('falls back when the value is not a string', () => {
    setDialogueTable({ 'angel.cell.01': 12, empty: '' });
    expect(t('angel.cell.01')).toBe('angel.cell.01');
    expect(t('empty')).toBe('');
  });

  it('loads a table from fetch and still falls back afterwards', async () => {
    await loadDialogue('/data/dialogue.json', async () => ({
      ok: true,
      status: 200,
      json: async () => ({ 'angel.cell.01': 'placeholder' }),
    }));
    expect(t('angel.cell.01')).toBe('placeholder');
    expect(t('not.in.file')).toBe('not.in.file');
  });
});
