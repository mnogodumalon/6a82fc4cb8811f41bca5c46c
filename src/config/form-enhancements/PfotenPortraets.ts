import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'hund',
    'besitzer',
    'buchung',
    'erstellungsdatum',
    'widmung',
    'besondere_erlebnisse',
    'zusatztext',
  ],
  defaults: {
    'erstellungsdatum': { kind: 'today' },
  },
  computed: {
  },
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
