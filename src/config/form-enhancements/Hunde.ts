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
    // Geschlecht: kein Zwang, "unbekannt" ist semantisch akzeptabel
    // Impfstatus: sinnvoll mit Vorauswahl "unbekannt", aber nicht erzwungen
    // Geburtsdatum: historisch, kein Default
    // Kastriert: bool ohne Vorbelegung — User entscheidet
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
