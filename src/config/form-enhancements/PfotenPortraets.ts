import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'hund',
    'besitzer',
    'buchung',
    'widmung',
    'besondere_erlebnisse',
    'erstellungsdatum',
    'zusatztext',
  ],
  defaults: {
    'erstellungsdatum': { kind: 'today' },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};

export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
