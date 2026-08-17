import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'name',
    'besitzer',
    'rasse',
    'geburtsdatum',
    'geschlecht',
    'gewicht_kg',
    'kastriert',
    'impfstatus',
    'fuetterungshinweise',
    'medikamente',
    'tierarzt_name',
    'tierarzt_telefon',
  ],
  defaults: {
    'impfstatus': { kind: 'lookup', key: 'unbekannt', label: 'Unbekannt' },
  },
  computed: {
  },
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
