import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'name',
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
    'besitzer',
  ],
  defaults: {
    'impfstatus': { kind: 'lookup', key: 'vollstaendig', label: 'Vollständig geimpft' },
    'kastriert': { kind: 'literal', value: true },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};

export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
