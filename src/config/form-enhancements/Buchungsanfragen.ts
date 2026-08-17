import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [{ row: ['anfrage_vorname', 'anfrage_nachname'] }, 'anfrage_telefon', 'anfrage_email', 'hund_name', 'hund_rasse', 'hund_groesse', { row: ['wunsch_anreise', 'wunsch_abreise'] }, 'nachricht', 'anfrage_status'],
  defaults: {
    wunsch_anreise: { kind: 'today' },
    wunsch_abreise: { kind: 'todayOffset', days: 3 },
    anfrage_status: { kind: 'lookup', key: 'offen', label: 'Offen' },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
