import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'hund',
    'besitzer',
    'platz',
    { row: ['anreise', 'abreise'] },
    'status',
    'zahlungsstatus',
    'preis_gesamt',
    'interne_notizen',
  ],
  defaults: {
    'status': { kind: 'lookup', key: 'geplant', label: 'Geplant' },
    'zahlungsstatus': { kind: 'lookup', key: 'offen', label: 'Offen' },
  },
  computed: {
    'anzahl_naechte': { kind: 'dateDiff', from: 'anreise', to: 'abreise', unit: 'days' },
    '_buchung_dauer_nächte': { kind: 'dateDiff', from: 'anreise', to: 'abreise', unit: 'days' },
  },
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
