import { lookupLabel } from '@/i18n';

// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export type AttachmentType = 'file' | 'note' | 'url' | 'json';
export interface Attachment {
  id: string;
  type: AttachmentType;
  label: string | null;
  value: string | null;
  active: boolean;
  createdat?: string | null;
  updatedat?: string | null;
}

export interface AttachmentInput {
  type: AttachmentType;
  label?: string;
  value: string;
  active?: boolean;
}

export interface Besitzer {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    vorname?: string;
    nachname?: string;
    telefon?: string;
    email?: string;
    strasse?: string;
    hausnummer?: string;
    plz?: string;
    ort?: string;
    notizen?: string;
  };
}

export interface Hunde {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    name?: string;
    rasse?: string;
    geburtsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    geschlecht?: LookupValue;
    gewicht_kg?: number;
    kastriert?: boolean;
    impfstatus?: LookupValue;
    impfausweis_foto?: string;
    fuetterungshinweise?: string;
    medikamente?: string;
    tierarzt_name?: string;
    tierarzt_telefon?: string;
    besitzer?: string; // applookup -> URL zu 'Besitzer' Record
    foto?: string;
  };
}

export interface Buchungen {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    hund?: string; // applookup -> URL zu 'Hunde' Record
    besitzer?: string; // applookup -> URL zu 'Besitzer' Record
    anreise?: string; // Format: YYYY-MM-DD oder ISO String
    abreise?: string; // Format: YYYY-MM-DD oder ISO String
    platz?: LookupValue;
    status?: LookupValue;
    preis_gesamt?: number;
    zahlungsstatus?: LookupValue;
    interne_notizen?: string;
  };
}

export interface Buchungsanfragen {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    anfrage_vorname?: string;
    anfrage_nachname?: string;
    anfrage_telefon?: string;
    anfrage_email?: string;
    hund_name?: string;
    hund_rasse?: string;
    hund_groesse?: LookupValue;
    wunsch_anreise?: string; // Format: YYYY-MM-DD oder ISO String
    wunsch_abreise?: string; // Format: YYYY-MM-DD oder ISO String
    nachricht?: string;
    anfrage_status?: LookupValue;
  };
}

export interface Website {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    unternehmensname?: string;
    slogan?: string;
    beschreibung?: string;
    leistungen?: string;
    anzahl_plaetze?: number;
    oeffnungszeiten?: string;
    website_telefon?: string;
    website_email?: string;
    website_url?: string;
    website_strasse?: string;
    website_hausnummer?: string;
    website_plz?: string;
    website_ort?: string;
    standort?: GeoLocation; // { lat, long, info }
    logo?: string;
    titelbild?: string;
    galerie_bilder?: string;
    instagram?: string;
    facebook?: string;
  };
}

export interface PfotenPortraets {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    hund?: string; // applookup -> URL zu 'Hunde' Record
    besitzer?: string; // applookup -> URL zu 'Besitzer' Record
    buchung?: string; // applookup -> URL zu 'Buchungen' Record
    widmung?: string;
    besondere_erlebnisse?: string;
    hund_foto?: string;
    erstellungsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    zusatztext?: string;
  };
}

export const APP_IDS = {
  BESITZER: '6a82fc1d74b3e71c1357a140',
  HUNDE: '6a82fc2393a7a2a067a822a8',
  BUCHUNGEN: '6a82fc243717e89f4af1d40b',
  BUCHUNGSANFRAGEN: '6a82fc24697b17036d3beda7',
  WEBSITE: '6a82fc25bab73072b0e86e2b',
  PFOTEN_PORTRAETS: '6a82fc25f34247fcfe6ed8ae',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'hunde': {
    geschlecht: [{ key: "maennlich", get label() { return lookupLabel('hunde', 'geschlecht', "maennlich") ?? "Männlich"; } }, { key: "weiblich", get label() { return lookupLabel('hunde', 'geschlecht', "weiblich") ?? "Weiblich"; } }, { key: "unbekannt", get label() { return lookupLabel('hunde', 'geschlecht', "unbekannt") ?? "Unbekannt"; } }],
    impfstatus: [{ key: "vollstaendig", get label() { return lookupLabel('hunde', 'impfstatus', "vollstaendig") ?? "Vollständig geimpft"; } }, { key: "teilweise", get label() { return lookupLabel('hunde', 'impfstatus', "teilweise") ?? "Teilweise geimpft"; } }, { key: "nicht_geimpft", get label() { return lookupLabel('hunde', 'impfstatus', "nicht_geimpft") ?? "Nicht geimpft"; } }, { key: "unbekannt", get label() { return lookupLabel('hunde', 'impfstatus', "unbekannt") ?? "Unbekannt"; } }],
  },
  'buchungen': {
    platz: [{ key: "platz_1", get label() { return lookupLabel('buchungen', 'platz', "platz_1") ?? "Platz 1"; } }, { key: "platz_2", get label() { return lookupLabel('buchungen', 'platz', "platz_2") ?? "Platz 2"; } }, { key: "platz_3", get label() { return lookupLabel('buchungen', 'platz', "platz_3") ?? "Platz 3"; } }, { key: "platz_4", get label() { return lookupLabel('buchungen', 'platz', "platz_4") ?? "Platz 4"; } }, { key: "platz_5", get label() { return lookupLabel('buchungen', 'platz', "platz_5") ?? "Platz 5"; } }, { key: "platz_6", get label() { return lookupLabel('buchungen', 'platz', "platz_6") ?? "Platz 6"; } }, { key: "platz_7", get label() { return lookupLabel('buchungen', 'platz', "platz_7") ?? "Platz 7"; } }, { key: "platz_8", get label() { return lookupLabel('buchungen', 'platz', "platz_8") ?? "Platz 8"; } }, { key: "platz_9", get label() { return lookupLabel('buchungen', 'platz', "platz_9") ?? "Platz 9"; } }, { key: "platz_10", get label() { return lookupLabel('buchungen', 'platz', "platz_10") ?? "Platz 10"; } }, { key: "platz_11", get label() { return lookupLabel('buchungen', 'platz', "platz_11") ?? "Platz 11"; } }, { key: "platz_12", get label() { return lookupLabel('buchungen', 'platz', "platz_12") ?? "Platz 12"; } }],
    status: [{ key: "geplant", get label() { return lookupLabel('buchungen', 'status', "geplant") ?? "Geplant"; } }, { key: "anwesend", get label() { return lookupLabel('buchungen', 'status', "anwesend") ?? "Anwesend"; } }, { key: "abgereist", get label() { return lookupLabel('buchungen', 'status', "abgereist") ?? "Abgereist"; } }, { key: "storniert", get label() { return lookupLabel('buchungen', 'status', "storniert") ?? "Storniert"; } }],
    zahlungsstatus: [{ key: "offen", get label() { return lookupLabel('buchungen', 'zahlungsstatus', "offen") ?? "Offen"; } }, { key: "teilweise", get label() { return lookupLabel('buchungen', 'zahlungsstatus', "teilweise") ?? "Teilweise bezahlt"; } }, { key: "bezahlt", get label() { return lookupLabel('buchungen', 'zahlungsstatus', "bezahlt") ?? "Bezahlt"; } }],
  },
  'buchungsanfragen': {
    hund_groesse: [{ key: "klein", get label() { return lookupLabel('buchungsanfragen', 'hund_groesse', "klein") ?? "Klein (bis 10 kg)"; } }, { key: "mittel", get label() { return lookupLabel('buchungsanfragen', 'hund_groesse', "mittel") ?? "Mittel (10–25 kg)"; } }, { key: "gross", get label() { return lookupLabel('buchungsanfragen', 'hund_groesse', "gross") ?? "Groß (über 25 kg)"; } }],
    anfrage_status: [{ key: "offen", get label() { return lookupLabel('buchungsanfragen', 'anfrage_status', "offen") ?? "Offen"; } }, { key: "bestaetigt", get label() { return lookupLabel('buchungsanfragen', 'anfrage_status', "bestaetigt") ?? "Bestätigt"; } }, { key: "abgelehnt", get label() { return lookupLabel('buchungsanfragen', 'anfrage_status', "abgelehnt") ?? "Abgelehnt"; } }],
  },
};

// Optimistic LookupValue writes: never re-type a label — resolve the schema
// option instead (its label is a locale-aware getter; falls back to the key).
// WRONG: status: { key: 'offen', label: 'Offen' }   (frozen in one language)
// RIGHT: status: lookupOption('<appKey>', 'status', 'offen')
export function lookupOption(app: string, field: string, key: string): LookupValue {
  return LOOKUP_OPTIONS[app]?.[field]?.find(o => o.key === key) ?? { key, label: key };
}

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'besitzer': {
    'vorname': 'string/text',
    'nachname': 'string/text',
    'telefon': 'string/tel',
    'email': 'string/email',
    'strasse': 'string/text',
    'hausnummer': 'string/text',
    'plz': 'string/text',
    'ort': 'string/text',
    'notizen': 'string/textarea',
  },
  'hunde': {
    'name': 'string/text',
    'rasse': 'string/text',
    'geburtsdatum': 'date/date',
    'geschlecht': 'lookup/radio',
    'gewicht_kg': 'number',
    'kastriert': 'bool',
    'impfstatus': 'lookup/select',
    'impfausweis_foto': 'file',
    'fuetterungshinweise': 'string/textarea',
    'medikamente': 'string/textarea',
    'tierarzt_name': 'string/text',
    'tierarzt_telefon': 'string/tel',
    'besitzer': 'applookup/select',
    'foto': 'file',
  },
  'buchungen': {
    'hund': 'applookup/select',
    'besitzer': 'applookup/select',
    'anreise': 'date/date',
    'abreise': 'date/date',
    'platz': 'lookup/select',
    'status': 'lookup/select',
    'preis_gesamt': 'number',
    'zahlungsstatus': 'lookup/radio',
    'interne_notizen': 'string/textarea',
  },
  'buchungsanfragen': {
    'anfrage_vorname': 'string/text',
    'anfrage_nachname': 'string/text',
    'anfrage_telefon': 'string/tel',
    'anfrage_email': 'string/email',
    'hund_name': 'string/text',
    'hund_rasse': 'string/text',
    'hund_groesse': 'lookup/radio',
    'wunsch_anreise': 'date/date',
    'wunsch_abreise': 'date/date',
    'nachricht': 'string/textarea',
    'anfrage_status': 'lookup/select',
  },
  'website': {
    'unternehmensname': 'string/text',
    'slogan': 'string/text',
    'beschreibung': 'string/textarea',
    'leistungen': 'string/textarea',
    'anzahl_plaetze': 'number',
    'oeffnungszeiten': 'string/textarea',
    'website_telefon': 'string/tel',
    'website_email': 'string/email',
    'website_url': 'string/url',
    'website_strasse': 'string/text',
    'website_hausnummer': 'string/text',
    'website_plz': 'string/text',
    'website_ort': 'string/text',
    'standort': 'geo',
    'logo': 'file',
    'titelbild': 'file',
    'galerie_bilder': 'file',
    'instagram': 'string/url',
    'facebook': 'string/url',
  },
  'pfoten_portraets': {
    'hund': 'applookup/select',
    'besitzer': 'applookup/select',
    'buchung': 'applookup/select',
    'widmung': 'string/textarea',
    'besondere_erlebnisse': 'string/textarea',
    'hund_foto': 'file',
    'erstellungsdatum': 'date/date',
    'zusatztext': 'string/textarea',
  },
};

export const HUB_TOPOLOGY: Record<string, { field: string; entity: string }[]> = {
  'besitzer': [
    { field: 'besitzer', entity: 'hunde' },
    { field: 'besitzer', entity: 'buchungen' },
    { field: 'besitzer', entity: 'pfoten_portraets' },
  ],
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateBesitzer = StripLookup<Besitzer['fields']>;
export type CreateHunde = StripLookup<Hunde['fields']>;
export type CreateBuchungen = StripLookup<Buchungen['fields']>;
export type CreateBuchungsanfragen = StripLookup<Buchungsanfragen['fields']>;
export type CreateWebsite = StripLookup<Website['fields']>;
export type CreatePfotenPortraets = StripLookup<PfotenPortraets['fields']>;