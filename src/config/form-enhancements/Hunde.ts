import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'name',
    { row: ['rasse', 'geschlecht'], cols: '1fr 1fr' },
    { row: ['geburtsdatum', 'gewicht_kg'], cols: '1fr 1fr' },
    'kastriert',
    'impfstatus',
    'fuetterungshinweise',
    'medikamente',
    { row: ['tierarzt_name', 'tierarzt_telefon'], cols: '2fr 1fr' },
    'besitzer',
  ],
  defaults: {},
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, { lookupKey: string }[]> = {};
