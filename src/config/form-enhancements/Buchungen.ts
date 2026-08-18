import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'hund',
    'besitzer',
    { row: ['anreise', 'abreise'] },
    'platz',
    'status',
    'preis_gesamt',
    'zahlungsstatus',
    'interne_notizen',
  ],
  defaults: {
    anreise: { kind: 'today' },
    abreise: { kind: 'todayOffset', days: 3 },
    status: { kind: 'lookup', key: 'geplant', label: 'Geplant' },
    zahlungsstatus: { kind: 'lookup', key: 'offen', label: 'Offen' },
  },
  computed: {
    '_buchung_dauer_nächte': { kind: 'dateDiff', from: 'anreise', to: 'abreise', unit: 'days' },
  },
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
