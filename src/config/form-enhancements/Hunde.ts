import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'name',
    { row: ['rasse', 'geschlecht'] },
    { row: ['geburtsdatum', 'gewicht_kg'] },
    { row: ['kastriert', 'impfstatus'] },
    'fuetterungshinweise',
    'medikamente',
    'tierarzt_name',
    'tierarzt_telefon',
    'besitzer',
  ],
  defaults: {
    impfstatus: { kind: 'lookup', key: 'unbekannt', label: 'Unbekannt' },
    kastriert: { kind: 'literal', value: false },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
