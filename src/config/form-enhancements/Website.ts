import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'unternehmensname',
    'slogan',
    'beschreibung',
    'leistungen',
    'anzahl_plaetze',
    'oeffnungszeiten',
    'website_telefon',
    'website_email',
    'website_url',
    { row: ['website_strasse', 'website_hausnummer'], cols: '2fr 1fr' },
    { row: ['website_plz', 'website_ort'], cols: '1fr 2fr' },
    'instagram',
    'facebook',
  ],
  defaults: {},
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};

export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
