import { useState, useMemo, useCallback } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { Besitzer, Hunde, Buchungen, Buchungsanfragen, Website, PfotenPortraets } from '@/types/app';
import { LivingAppsService, extractRecordId, cleanFieldsForApi } from '@/services/livingAppsService';
import { BesitzerDialog } from '@/components/dialogs/BesitzerDialog';
import { BesitzerViewDialog } from '@/components/dialogs/BesitzerViewDialog';
import { HundeDialog } from '@/components/dialogs/HundeDialog';
import { HundeViewDialog } from '@/components/dialogs/HundeViewDialog';
import { BuchungenDialog } from '@/components/dialogs/BuchungenDialog';
import { BuchungenViewDialog } from '@/components/dialogs/BuchungenViewDialog';
import { BuchungsanfragenDialog } from '@/components/dialogs/BuchungsanfragenDialog';
import { BuchungsanfragenViewDialog } from '@/components/dialogs/BuchungsanfragenViewDialog';
import { WebsiteDialog } from '@/components/dialogs/WebsiteDialog';
import { WebsiteViewDialog } from '@/components/dialogs/WebsiteViewDialog';
import { PfotenPortraetsDialog } from '@/components/dialogs/PfotenPortraetsDialog';
import { PfotenPortraetsViewDialog } from '@/components/dialogs/PfotenPortraetsViewDialog';
import { BulkEditDialog } from '@/components/dialogs/BulkEditDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageShell } from '@/components/PageShell';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { IconPencil, IconTrash, IconPlus, IconFilter, IconX, IconArrowsUpDown, IconArrowUp, IconArrowDown, IconSearch, IconCopy, IconFileText } from '@tabler/icons-react';
import { t, appLabel, fieldLabels, lookupLabel, dateFnsLocale, dateFormat } from '@/i18n';
import { format, parseISO } from 'date-fns';

function fmtDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), dateFormat(), { locale: dateFnsLocale() }); } catch { return d; }
}

// Field metadata per entity for bulk edit and column filters. `label` is the
// BUILD-language fallback only — getFieldMeta() re-labels every entry (and every
// lookup option) through the runtime catalog before anything renders it.
const BESITZER_FIELDS = [
  { key: 'vorname', label: 'Vorname', type: 'string/text' },
  { key: 'nachname', label: 'Nachname', type: 'string/text' },
  { key: 'telefon', label: 'Telefonnummer', type: 'string/tel' },
  { key: 'email', label: 'E-Mail-Adresse', type: 'string/email' },
  { key: 'strasse', label: 'Straße', type: 'string/text' },
  { key: 'hausnummer', label: 'Hausnummer', type: 'string/text' },
  { key: 'plz', label: 'Postleitzahl', type: 'string/text' },
  { key: 'ort', label: 'Ort', type: 'string/text' },
  { key: 'notizen', label: 'Notizen', type: 'string/textarea' },
];
const HUNDE_FIELDS = [
  { key: 'name', label: 'Name des Hundes', type: 'string/text' },
  { key: 'rasse', label: 'Rasse', type: 'string/text' },
  { key: 'geburtsdatum', label: 'Geburtsdatum', type: 'date/date' },
  { key: 'geschlecht', label: 'Geschlecht', type: 'lookup/radio', options: [{ key: 'maennlich', label: 'Männlich' }, { key: 'weiblich', label: 'Weiblich' }, { key: 'unbekannt', label: 'Unbekannt' }] },
  { key: 'gewicht_kg', label: 'Gewicht (kg)', type: 'number' },
  { key: 'kastriert', label: 'Kastriert / Sterilisiert', type: 'bool' },
  { key: 'impfstatus', label: 'Impfstatus', type: 'lookup/select', options: [{ key: 'vollstaendig', label: 'Vollständig geimpft' }, { key: 'teilweise', label: 'Teilweise geimpft' }, { key: 'nicht_geimpft', label: 'Nicht geimpft' }, { key: 'unbekannt', label: 'Unbekannt' }] },
  { key: 'impfausweis_foto', label: 'Impfausweis (Foto/Dokument)', type: 'file' },
  { key: 'fuetterungshinweise', label: 'Fütterungshinweise', type: 'string/textarea' },
  { key: 'medikamente', label: 'Medikamente & Besonderheiten', type: 'string/textarea' },
  { key: 'tierarzt_name', label: 'Tierarzt (Name & Praxis)', type: 'string/text' },
  { key: 'tierarzt_telefon', label: 'Tierarzt Telefon', type: 'string/tel' },
  { key: 'besitzer', label: 'Besitzer', type: 'applookup/select', targetEntity: 'besitzer', targetAppId: 'BESITZER', displayField: 'vorname' },
  { key: 'foto', label: 'Foto des Hundes', type: 'file' },
];
const BUCHUNGEN_FIELDS = [
  { key: 'hund', label: 'Hund', type: 'applookup/select', targetEntity: 'hunde', targetAppId: 'HUNDE', displayField: 'name' },
  { key: 'besitzer', label: 'Besitzer', type: 'applookup/select', targetEntity: 'besitzer', targetAppId: 'BESITZER', displayField: 'vorname' },
  { key: 'anreise', label: 'Anreisedatum', type: 'date/date' },
  { key: 'abreise', label: 'Abreisedatum', type: 'date/date' },
  { key: 'platz', label: 'Platznummer', type: 'lookup/select', options: [{ key: 'platz_1', label: 'Platz 1' }, { key: 'platz_2', label: 'Platz 2' }, { key: 'platz_3', label: 'Platz 3' }, { key: 'platz_4', label: 'Platz 4' }, { key: 'platz_5', label: 'Platz 5' }, { key: 'platz_6', label: 'Platz 6' }, { key: 'platz_7', label: 'Platz 7' }, { key: 'platz_8', label: 'Platz 8' }, { key: 'platz_9', label: 'Platz 9' }, { key: 'platz_10', label: 'Platz 10' }, { key: 'platz_11', label: 'Platz 11' }, { key: 'platz_12', label: 'Platz 12' }] },
  { key: 'status', label: 'Status', type: 'lookup/select', options: [{ key: 'geplant', label: 'Geplant' }, { key: 'anwesend', label: 'Anwesend' }, { key: 'abgereist', label: 'Abgereist' }, { key: 'storniert', label: 'Storniert' }] },
  { key: 'preis_gesamt', label: 'Gesamtpreis (€)', type: 'number' },
  { key: 'zahlungsstatus', label: 'Zahlungsstatus', type: 'lookup/radio', options: [{ key: 'offen', label: 'Offen' }, { key: 'teilweise', label: 'Teilweise bezahlt' }, { key: 'bezahlt', label: 'Bezahlt' }] },
  { key: 'interne_notizen', label: 'Interne Notizen', type: 'string/textarea' },
];
const BUCHUNGSANFRAGEN_FIELDS = [
  { key: 'anfrage_vorname', label: 'Vorname', type: 'string/text' },
  { key: 'anfrage_nachname', label: 'Nachname', type: 'string/text' },
  { key: 'anfrage_telefon', label: 'Telefonnummer', type: 'string/tel' },
  { key: 'anfrage_email', label: 'E-Mail-Adresse', type: 'string/email' },
  { key: 'hund_name', label: 'Name des Hundes', type: 'string/text' },
  { key: 'hund_rasse', label: 'Rasse des Hundes', type: 'string/text' },
  { key: 'hund_groesse', label: 'Größe des Hundes', type: 'lookup/radio', options: [{ key: 'klein', label: 'Klein (bis 10 kg)' }, { key: 'mittel', label: 'Mittel (10–25 kg)' }, { key: 'gross', label: 'Groß (über 25 kg)' }] },
  { key: 'wunsch_anreise', label: 'Gewünschte Anreise', type: 'date/date' },
  { key: 'wunsch_abreise', label: 'Gewünschte Abreise', type: 'date/date' },
  { key: 'nachricht', label: 'Nachricht / Besondere Wünsche', type: 'string/textarea' },
  { key: 'anfrage_status', label: 'Status der Anfrage', type: 'lookup/select', options: [{ key: 'offen', label: 'Offen' }, { key: 'bestaetigt', label: 'Bestätigt' }, { key: 'abgelehnt', label: 'Abgelehnt' }] },
];
const WEBSITE_FIELDS = [
  { key: 'unternehmensname', label: 'Unternehmensname', type: 'string/text' },
  { key: 'slogan', label: 'Slogan / Motto', type: 'string/text' },
  { key: 'beschreibung', label: 'Beschreibungstext (Über uns)', type: 'string/textarea' },
  { key: 'leistungen', label: 'Unsere Leistungen', type: 'string/textarea' },
  { key: 'anzahl_plaetze', label: 'Anzahl der Plätze', type: 'number' },
  { key: 'oeffnungszeiten', label: 'Öffnungszeiten', type: 'string/textarea' },
  { key: 'website_telefon', label: 'Telefonnummer (öffentlich)', type: 'string/tel' },
  { key: 'website_email', label: 'E-Mail-Adresse (öffentlich)', type: 'string/email' },
  { key: 'website_url', label: 'Website-Adresse', type: 'string/url' },
  { key: 'website_strasse', label: 'Straße', type: 'string/text' },
  { key: 'website_hausnummer', label: 'Hausnummer', type: 'string/text' },
  { key: 'website_plz', label: 'Postleitzahl', type: 'string/text' },
  { key: 'website_ort', label: 'Ort', type: 'string/text' },
  { key: 'standort', label: 'Standort auf der Karte', type: 'geo' },
  { key: 'logo', label: 'Logo', type: 'file' },
  { key: 'titelbild', label: 'Titelbild / Headerbild', type: 'file' },
  { key: 'galerie_bilder', label: 'Galeriebilder', type: 'file' },
  { key: 'instagram', label: 'Instagram-Profil (URL)', type: 'string/url' },
  { key: 'facebook', label: 'Facebook-Seite (URL)', type: 'string/url' },
];
const PFOTENPORTRAETS_FIELDS = [
  { key: 'hund', label: 'Hund', type: 'applookup/select', targetEntity: 'hunde', targetAppId: 'HUNDE', displayField: 'name' },
  { key: 'besitzer', label: 'Besitzer', type: 'applookup/select', targetEntity: 'besitzer', targetAppId: 'BESITZER', displayField: 'vorname' },
  { key: 'buchung', label: 'Zugehörige Buchung', type: 'applookup/select', targetEntity: 'buchungen', targetAppId: 'BUCHUNGEN', displayField: 'interne_notizen' },
  { key: 'widmung', label: 'Persönliche Widmung', type: 'string/textarea' },
  { key: 'besondere_erlebnisse', label: 'Besondere Erlebnisse während des Aufenthalts', type: 'string/textarea' },
  { key: 'hund_foto', label: 'Foto des Hundes', type: 'file' },
  { key: 'erstellungsdatum', label: 'Erstellungsdatum', type: 'date/date' },
  { key: 'zusatztext', label: 'Zusätzlicher Text / Anmerkungen', type: 'string/textarea' },
];

const ENTITY_TABS = [
  { key: 'besitzer', pascal: 'Besitzer' },
  { key: 'hunde', pascal: 'Hunde' },
  { key: 'buchungen', pascal: 'Buchungen' },
  { key: 'buchungsanfragen', pascal: 'Buchungsanfragen' },
  { key: 'website', pascal: 'Website' },
  { key: 'pfoten_portraets', pascal: 'PfotenPortraets' },
] as const;

type EntityKey = typeof ENTITY_TABS[number]['key'];

export default function AdminPage() {
  const data = useDashboardData();
  const { loading, error, fetchAll } = data;

  const [activeTab, setActiveTab] = useState<EntityKey>('besitzer');
  const [selectedIds, setSelectedIds] = useState<Record<EntityKey, Set<string>>>(() => ({
    'besitzer': new Set(),
    'hunde': new Set(),
    'buchungen': new Set(),
    'buchungsanfragen': new Set(),
    'website': new Set(),
    'pfoten_portraets': new Set(),
  }));
  const [filters, setFilters] = useState<Record<EntityKey, Record<string, string>>>(() => ({
    'besitzer': {},
    'hunde': {},
    'buchungen': {},
    'buchungsanfragen': {},
    'website': {},
    'pfoten_portraets': {},
  }));
  const [showFilters, setShowFilters] = useState(false);
  const [dialogState, setDialogState] = useState<{ entity: EntityKey; record: any } | null>(null);
  const [createEntity, setCreateEntity] = useState<EntityKey | null>(null);
  const [deleteTargets, setDeleteTargets] = useState<{ entity: EntityKey; ids: string[] } | null>(null);
  const [bulkEditOpen, setBulkEditOpen] = useState<EntityKey | null>(null);
  const [viewState, setViewState] = useState<{ entity: EntityKey; record: any } | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');

  const getRecords = useCallback((entity: EntityKey) => {
    switch (entity) {
      case 'besitzer': return (data as any).besitzer as Besitzer[] ?? [];
      case 'hunde': return (data as any).hunde as Hunde[] ?? [];
      case 'buchungen': return (data as any).buchungen as Buchungen[] ?? [];
      case 'buchungsanfragen': return (data as any).buchungsanfragen as Buchungsanfragen[] ?? [];
      case 'website': return (data as any).website as Website[] ?? [];
      case 'pfoten_portraets': return (data as any).pfotenPortraets as PfotenPortraets[] ?? [];
      default: return [];
    }
  }, [data]);

  const getLookupLists = useCallback((entity: EntityKey) => {
    const lists: Record<string, any[]> = {};
    switch (entity) {
      case 'hunde':
        lists.besitzerList = (data as any).besitzer ?? [];
        break;
      case 'buchungen':
        lists.hundeList = (data as any).hunde ?? [];
        lists.besitzerList = (data as any).besitzer ?? [];
        break;
      case 'pfoten_portraets':
        lists.hundeList = (data as any).hunde ?? [];
        lists.besitzerList = (data as any).besitzer ?? [];
        lists.buchungenList = (data as any).buchungen ?? [];
        break;
    }
    return lists;
  }, [data]);

  const getApplookupDisplay = useCallback((entity: EntityKey, fieldKey: string, url?: unknown) => {
    if (!url) return '—';
    const id = extractRecordId(url);
    if (!id) return '—';
    const lists = getLookupLists(entity);
    void fieldKey; // ensure used for noUnusedParameters
    if (entity === 'hunde' && fieldKey === 'besitzer') {
      const match = (lists.besitzerList ?? []).find((r: any) => r.record_id === id);
      return match?.fields.vorname ?? '—';
    }
    if (entity === 'buchungen' && fieldKey === 'hund') {
      const match = (lists.hundeList ?? []).find((r: any) => r.record_id === id);
      return match?.fields.name ?? '—';
    }
    if (entity === 'buchungen' && fieldKey === 'besitzer') {
      const match = (lists.besitzerList ?? []).find((r: any) => r.record_id === id);
      return match?.fields.vorname ?? '—';
    }
    if (entity === 'pfoten_portraets' && fieldKey === 'hund') {
      const match = (lists.hundeList ?? []).find((r: any) => r.record_id === id);
      return match?.fields.name ?? '—';
    }
    if (entity === 'pfoten_portraets' && fieldKey === 'besitzer') {
      const match = (lists.besitzerList ?? []).find((r: any) => r.record_id === id);
      return match?.fields.vorname ?? '—';
    }
    if (entity === 'pfoten_portraets' && fieldKey === 'buchung') {
      const match = (lists.buchungenList ?? []).find((r: any) => r.record_id === id);
      return match?.fields.interne_notizen ?? '—';
    }
    return String(url);
  }, [getLookupLists]);

  // An EntityKey IS the app key, so the runtime catalog can re-label the static
  // field metadata on every render (the tree remounts on a language switch).
  // Only display labels change here — keys, types and option keys stay as built.
  const getFieldMeta = useCallback((entity: EntityKey) => {
    const raw: any[] = (() => {
      switch (entity) {
        case 'besitzer': return BESITZER_FIELDS as any[];
        case 'hunde': return HUNDE_FIELDS as any[];
        case 'buchungen': return BUCHUNGEN_FIELDS as any[];
        case 'buchungsanfragen': return BUCHUNGSANFRAGEN_FIELDS as any[];
        case 'website': return WEBSITE_FIELDS as any[];
        case 'pfoten_portraets': return PFOTENPORTRAETS_FIELDS as any[];
        default: return [];
      }
    })();
    const labels = fieldLabels(entity);
    return raw.map((f: any) => ({
      ...f,
      label: labels[f.key] ?? f.label,
      ...(f.options
        ? { options: f.options.map((o: any) => ({ ...o, label: lookupLabel(entity, f.key, o.key) ?? o.label })) }
        : {}),
    }));
  }, []);

  const getFilteredRecords = useCallback((entity: EntityKey) => {
    const records = getRecords(entity);
    const s = search.toLowerCase();
    const searched = !s ? records : records.filter((r: any) => {
      return Object.values(r.fields).some((v: any) => {
        if (v == null) return false;
        if (Array.isArray(v)) return v.some((item: any) => typeof item === 'object' && item !== null && 'label' in item ? String((item as any).label).toLowerCase().includes(s) : String(item).toLowerCase().includes(s));
        if (typeof v === 'object' && 'label' in (v as any)) return String((v as any).label).toLowerCase().includes(s);
        return String(v).toLowerCase().includes(s);
      });
    });
    const entityFilters = filters[entity] ?? {};
    const fieldMeta = getFieldMeta(entity);
    return searched.filter((r: any) => {
      return fieldMeta.every((fm: any) => {
        const fv = entityFilters[fm.key];
        if (!fv || fv === '') return true;
        const val = r.fields?.[fm.key];
        if (fm.type === 'bool') {
          if (fv === 'true') return val === true;
          if (fv === 'false') return val !== true;
          return true;
        }
        if (fm.type === 'lookup/select' || fm.type === 'lookup/radio') {
          // The filter select carries the option KEY, which is locale-independent —
          // the record's own label is in the build language and must not be matched.
          const key = val && typeof val === 'object' && 'key' in val ? val.key : '';
          return String(key) === fv;
        }
        if (fm.type.includes('multiplelookup')) {
          if (!Array.isArray(val)) return false;
          return val.some((item: any) => String(lookupLabel(entity, fm.key, item?.key) ?? item?.label ?? '').toLowerCase().includes(fv.toLowerCase()));
        }
        if (fm.type.includes('applookup')) {
          const display = getApplookupDisplay(entity, fm.key, val);
          return String(display).toLowerCase().includes(fv.toLowerCase());
        }
        return String(val ?? '').toLowerCase().includes(fv.toLowerCase());
      });
    });
  }, [getRecords, filters, getFieldMeta, getApplookupDisplay, search]);

  function toggleSort(key: string) {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc');
      else { setSortKey(''); setSortDir('asc'); }
    } else { setSortKey(key); setSortDir('asc'); }
  }

  function sortRecords<T extends { fields: Record<string, any> }>(recs: T[]): T[] {
    if (!sortKey) return recs;
    return [...recs].sort((a, b) => {
      let va: any = a.fields[sortKey], vb: any = b.fields[sortKey];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'object' && 'label' in va) va = va.label;
      if (typeof vb === 'object' && 'label' in vb) vb = vb.label;
      if (typeof va === 'number' && typeof vb === 'number') return sortDir === 'asc' ? va - vb : vb - va;
      return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
  }

  const toggleSelect = useCallback((entity: EntityKey, id: string) => {
    setSelectedIds(prev => {
      const next = { ...prev, [entity]: new Set(prev[entity]) };
      if (next[entity].has(id)) next[entity].delete(id);
      else next[entity].add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((entity: EntityKey) => {
    const filtered = getFilteredRecords(entity);
    setSelectedIds(prev => {
      const allSelected = filtered.every((r: any) => prev[entity].has(r.record_id));
      const next = { ...prev, [entity]: new Set(prev[entity]) };
      if (allSelected) {
        filtered.forEach((r: any) => next[entity].delete(r.record_id));
      } else {
        filtered.forEach((r: any) => next[entity].add(r.record_id));
      }
      return next;
    });
  }, [getFilteredRecords]);

  const clearSelection = useCallback((entity: EntityKey) => {
    setSelectedIds(prev => ({ ...prev, [entity]: new Set() }));
  }, []);

  const getServiceMethods = useCallback((entity: EntityKey) => {
    switch (entity) {
      case 'besitzer': return {
        create: (fields: any) => LivingAppsService.createBesitzerEntry(fields),
        update: (id: string, fields: any) => LivingAppsService.updateBesitzerEntry(id, fields),
        remove: (id: string) => LivingAppsService.deleteBesitzerEntry(id),
      };
      case 'hunde': return {
        create: (fields: any) => LivingAppsService.createHundeEntry(fields),
        update: (id: string, fields: any) => LivingAppsService.updateHundeEntry(id, fields),
        remove: (id: string) => LivingAppsService.deleteHundeEntry(id),
      };
      case 'buchungen': return {
        create: (fields: any) => LivingAppsService.createBuchungenEntry(fields),
        update: (id: string, fields: any) => LivingAppsService.updateBuchungenEntry(id, fields),
        remove: (id: string) => LivingAppsService.deleteBuchungenEntry(id),
      };
      case 'buchungsanfragen': return {
        create: (fields: any) => LivingAppsService.createBuchungsanfragenEntry(fields),
        update: (id: string, fields: any) => LivingAppsService.updateBuchungsanfragenEntry(id, fields),
        remove: (id: string) => LivingAppsService.deleteBuchungsanfragenEntry(id),
      };
      case 'website': return {
        create: (fields: any) => LivingAppsService.createWebsiteEntry(fields),
        update: (id: string, fields: any) => LivingAppsService.updateWebsiteEntry(id, fields),
        remove: (id: string) => LivingAppsService.deleteWebsiteEntry(id),
      };
      case 'pfoten_portraets': return {
        create: (fields: any) => LivingAppsService.createPfotenPortraet(fields),
        update: (id: string, fields: any) => LivingAppsService.updatePfotenPortraet(id, fields),
        remove: (id: string) => LivingAppsService.deletePfotenPortraet(id),
      };
      default: return null;
    }
  }, []);

  async function handleCreate(entity: EntityKey, fields: any) {
    const svc = getServiceMethods(entity);
    if (!svc) return;
    await svc.create(fields);
    fetchAll();
    setCreateEntity(null);
  }

  async function handleUpdate(fields: any) {
    if (!dialogState) return;
    const svc = getServiceMethods(dialogState.entity);
    if (!svc) return;
    await svc.update(dialogState.record.record_id, fields);
    fetchAll();
    setDialogState(null);
  }

  async function handleBulkDelete() {
    if (!deleteTargets) return;
    const svc = getServiceMethods(deleteTargets.entity);
    if (!svc) return;
    setBulkLoading(true);
    try {
      for (const id of deleteTargets.ids) {
        await svc.remove(id);
      }
      clearSelection(deleteTargets.entity);
      fetchAll();
    } finally {
      setBulkLoading(false);
      setDeleteTargets(null);
    }
  }

  async function handleBulkClone() {
    const svc = getServiceMethods(activeTab);
    if (!svc) return;
    setBulkLoading(true);
    try {
      const records = getRecords(activeTab);
      const ids = Array.from(selectedIds[activeTab]);
      for (const id of ids) {
        const rec = records.find((r: any) => r.record_id === id);
        if (!rec) continue;
        const clean = cleanFieldsForApi(rec.fields, activeTab);
        await svc.create(clean as any);
      }
      clearSelection(activeTab);
      fetchAll();
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleBulkEdit(fieldKey: string, value: any) {
    if (!bulkEditOpen) return;
    const svc = getServiceMethods(bulkEditOpen);
    if (!svc) return;
    setBulkLoading(true);
    try {
      const ids = Array.from(selectedIds[bulkEditOpen]);
      for (const id of ids) {
        await svc.update(id, { [fieldKey]: value });
      }
      clearSelection(bulkEditOpen);
      fetchAll();
    } finally {
      setBulkLoading(false);
      setBulkEditOpen(null);
    }
  }

  function updateFilter(entity: EntityKey, fieldKey: string, value: string) {
    setFilters(prev => ({
      ...prev,
      [entity]: { ...prev[entity], [fieldKey]: value },
    }));
  }

  function clearEntityFilters(entity: EntityKey) {
    setFilters(prev => ({ ...prev, [entity]: {} }));
  }

  const activeFilterCount = useMemo(() => {
    const f = filters[activeTab] ?? {};
    return Object.values(f).filter(v => v && v !== '').length;
  }, [filters, activeTab]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <p className="text-destructive">{error.message}</p>
        <Button onClick={fetchAll}>{t('retry')}</Button>
      </div>
    );
  }

  const filtered = getFilteredRecords(activeTab);
  const sel = selectedIds[activeTab];
  const allFiltered = filtered.every((r: any) => sel.has(r.record_id)) && filtered.length > 0;
  const fieldMeta = getFieldMeta(activeTab);

  return (
    <PageShell
      title={t('admin')}
      subtitle={t('admin_subtitle')}
      action={
        <Button onClick={() => setCreateEntity(activeTab)} className="shrink-0">
          <IconPlus className="h-4 w-4 mr-2" /> {t('add')}
        </Button>
      }
    >
      <div className="flex gap-2 flex-wrap">
        {ENTITY_TABS.map(tab => {
          const count = getRecords(tab.key).length;
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSearch(''); setSortKey(''); setSortDir('asc'); fetchAll(); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {appLabel(tab.key)}
              <Badge variant="secondary" className="ml-1 text-xs">{count}</Badge>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="relative w-full max-w-sm">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('search')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(f => !f)} className="gap-2">
            <IconFilter className="h-4 w-4" />
            {t('filter')}
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1">{activeFilterCount}</Badge>
            )}
          </Button>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={() => clearEntityFilters(activeTab)}>
              {t('clear_filters')}
            </Button>
          )}
        </div>
        {sel.size > 0 && (
          <div className="flex items-center gap-2 flex-wrap bg-muted/60 rounded-lg px-3 py-1.5">
            <span className="text-sm font-medium">{sel.size} {t('selected')}</span>
            <Button variant="outline" size="sm" onClick={() => setBulkEditOpen(activeTab)}>
              <IconPencil className="h-3.5 w-3.5 sm:mr-1" /> <span className="hidden sm:inline">{t('bulk_edit')}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkClone()}>
              <IconCopy className="h-3.5 w-3.5 sm:mr-1" /> <span className="hidden sm:inline">{t('bulk_clone')}</span>
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setDeleteTargets({ entity: activeTab, ids: Array.from(sel) })}>
              <IconTrash className="h-3.5 w-3.5 sm:mr-1" /> <span className="hidden sm:inline">{t('bulk_delete')}</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => clearSelection(activeTab)}>
              <IconX className="h-3.5 w-3.5 sm:mr-1" /> <span className="hidden sm:inline">{t('deselect_all')}</span>
            </Button>
          </div>
        )}
      </div>

      {showFilters && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-4 rounded-lg border bg-muted/30">
          {fieldMeta.map((fm: any) => (
            <div key={fm.key} className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{fm.label}</label>
              {fm.type === 'bool' ? (
                <Select value={filters[activeTab]?.[fm.key] ?? ''} onValueChange={v => updateFilter(activeTab, fm.key, v === 'all' ? '' : v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t('all_values')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all_values')}</SelectItem>
                    <SelectItem value="true">{t('yes')}</SelectItem>
                    <SelectItem value="false">{t('no')}</SelectItem>
                  </SelectContent>
                </Select>
              ) : fm.type === 'lookup/select' || fm.type === 'lookup/radio' ? (
                <Select value={filters[activeTab]?.[fm.key] ?? ''} onValueChange={v => updateFilter(activeTab, fm.key, v === 'all' ? '' : v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t('all_values')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all_values')}</SelectItem>
                    {fm.options?.map((o: any) => (
                      <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  className="h-8 text-xs"
                  placeholder={`${t('filter')}...`}
                  value={filters[activeTab]?.[fm.key] ?? ''}
                  onChange={e => updateFilter(activeTab, fm.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-[27px] bg-card shadow-lg overflow-x-auto">
        <Table className="[&_tbody_td]:px-6 [&_tbody_td]:py-2 [&_tbody_td]:text-base [&_tbody_td]:font-medium [&_tbody_tr:first-child_td]:pt-6 [&_tbody_tr:last-child_td]:pb-10">
          <TableHeader className="bg-secondary">
            <TableRow className="border-b border-input">
              <TableHead className="w-10 px-6">
                <Checkbox
                  checked={allFiltered}
                  onCheckedChange={() => toggleSelectAll(activeTab)}
                />
              </TableHead>
              {fieldMeta.map((fm: any) => (
                <TableHead key={fm.key} className="uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort(fm.key)}>
                  <span className="inline-flex items-center gap-1">
                    {fm.label}
                    {sortKey === fm.key ? (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />) : <IconArrowsUpDown size={14} className="opacity-30" />}
                  </span>
                </TableHead>
              ))}
              <TableHead className="w-24 uppercase text-xs font-semibold text-secondary-foreground tracking-wider px-6">{t('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortRecords(filtered).map((record: any) => (
              <TableRow key={record.record_id} className={`transition-colors cursor-pointer ${sel.has(record.record_id) ? "bg-primary/5" : "hover:bg-muted/50"}`} onClick={(e) => { if ((e.target as HTMLElement).closest('button, [role="checkbox"]')) return; setViewState({ entity: activeTab, record }); }}>
                <TableCell>
                  <Checkbox
                    checked={sel.has(record.record_id)}
                    onCheckedChange={() => toggleSelect(activeTab, record.record_id)}
                  />
                </TableCell>
                {fieldMeta.map((fm: any) => {
                  const val = record.fields?.[fm.key];
                  if (fm.type === 'bool') {
                    return (
                      <TableCell key={fm.key}>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          val ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                        }`}>
                          {val ? t('yes') : t('no')}
                        </span>
                      </TableCell>
                    );
                  }
                  if (fm.type === 'lookup/select' || fm.type === 'lookup/radio') {
                    return <TableCell key={fm.key}><span className="inline-flex items-center bg-secondary border border-[#bfdbfe] text-[#2563eb] rounded-[10px] px-2 py-1 text-sm font-medium">{lookupLabel(activeTab, fm.key, val?.key) ?? val?.label ?? '—'}</span></TableCell>;
                  }
                  if (fm.type.startsWith('multiplelookup')) {
                    return <TableCell key={fm.key}>{Array.isArray(val) ? val.map((v: any) => lookupLabel(activeTab, fm.key, v?.key) ?? v?.label ?? v).join(', ') : '—'}</TableCell>;
                  }
                  if (fm.type.startsWith('multipleapplookup')) {
                    return (
                      <TableCell key={fm.key}>
                        {Array.isArray(val) && val.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {val.map((url: any, i: number) => (
                              <span key={i} className="inline-flex items-center bg-secondary border border-[#bfdbfe] text-[#2563eb] rounded-[10px] px-2 py-1 text-sm font-medium">{getApplookupDisplay(activeTab, fm.key, url)}</span>
                            ))}
                          </div>
                        ) : '—'}
                      </TableCell>
                    );
                  }
                  if (fm.type.startsWith('applookup')) {
                    return <TableCell key={fm.key}><span className="inline-flex items-center bg-secondary border border-[#bfdbfe] text-[#2563eb] rounded-[10px] px-2 py-1 text-sm font-medium">{getApplookupDisplay(activeTab, fm.key, val)}</span></TableCell>;
                  }
                  if (fm.type.includes('date')) {
                    return <TableCell key={fm.key} className="text-muted-foreground">{fmtDate(val)}</TableCell>;
                  }
                  if (fm.type.startsWith('file')) {
                    return (
                      <TableCell key={fm.key}>
                        {val ? (
                          <div className="relative h-8 w-8 rounded bg-muted overflow-hidden">
                            <img src={val} alt="" className="h-full w-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          </div>
                        ) : '—'}
                      </TableCell>
                    );
                  }
                  if (fm.type === 'string/textarea') {
                    return <TableCell key={fm.key} className="max-w-xs"><span className="truncate block">{val ?? '—'}</span></TableCell>;
                  }
                  if (fm.type === 'geo') {
                    return (
                      <TableCell key={fm.key} className="max-w-[200px]">
                        <span className="truncate block" title={val ? `${val.lat}, ${val.long}` : undefined}>
                          {val?.info ?? (val ? `${val.lat?.toFixed(4)}, ${val.long?.toFixed(4)}` : '—')}
                        </span>
                      </TableCell>
                    );
                  }
                  return <TableCell key={fm.key}>{val ?? '—'}</TableCell>;
                })}
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setDialogState({ entity: activeTab, record })}>
                      <IconPencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTargets({ entity: activeTab, ids: [record.record_id] })}>
                      <IconTrash className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={fieldMeta.length + 2} className="text-center py-16 text-muted-foreground">
                  {t('no_results')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {(createEntity === 'besitzer' || dialogState?.entity === 'besitzer') && (
        <BesitzerDialog
          open={createEntity === 'besitzer' || dialogState?.entity === 'besitzer'}
          onClose={() => { setCreateEntity(null); setDialogState(null); }}
          onSubmit={dialogState?.entity === 'besitzer' ? handleUpdate : (fields: any) => handleCreate('besitzer', fields)}
          defaultValues={dialogState?.entity === 'besitzer' ? dialogState.record?.fields : undefined}
          enablePhotoScan={AI_PHOTO_SCAN['Besitzer']}
          enablePhotoLocation={AI_PHOTO_LOCATION['Besitzer']}
        />
      )}
      {(createEntity === 'hunde' || dialogState?.entity === 'hunde') && (
        <HundeDialog
          open={createEntity === 'hunde' || dialogState?.entity === 'hunde'}
          onClose={() => { setCreateEntity(null); setDialogState(null); }}
          onSubmit={dialogState?.entity === 'hunde' ? handleUpdate : (fields: any) => handleCreate('hunde', fields)}
          defaultValues={dialogState?.entity === 'hunde' ? dialogState.record?.fields : undefined}
          besitzerList={(data as any).besitzer ?? []}
          enablePhotoScan={AI_PHOTO_SCAN['Hunde']}
          enablePhotoLocation={AI_PHOTO_LOCATION['Hunde']}
        />
      )}
      {(createEntity === 'buchungen' || dialogState?.entity === 'buchungen') && (
        <BuchungenDialog
          open={createEntity === 'buchungen' || dialogState?.entity === 'buchungen'}
          onClose={() => { setCreateEntity(null); setDialogState(null); }}
          onSubmit={dialogState?.entity === 'buchungen' ? handleUpdate : (fields: any) => handleCreate('buchungen', fields)}
          defaultValues={dialogState?.entity === 'buchungen' ? dialogState.record?.fields : undefined}
          hundeList={(data as any).hunde ?? []}
          besitzerList={(data as any).besitzer ?? []}
          enablePhotoScan={AI_PHOTO_SCAN['Buchungen']}
          enablePhotoLocation={AI_PHOTO_LOCATION['Buchungen']}
        />
      )}
      {(createEntity === 'buchungsanfragen' || dialogState?.entity === 'buchungsanfragen') && (
        <BuchungsanfragenDialog
          open={createEntity === 'buchungsanfragen' || dialogState?.entity === 'buchungsanfragen'}
          onClose={() => { setCreateEntity(null); setDialogState(null); }}
          onSubmit={dialogState?.entity === 'buchungsanfragen' ? handleUpdate : (fields: any) => handleCreate('buchungsanfragen', fields)}
          defaultValues={dialogState?.entity === 'buchungsanfragen' ? dialogState.record?.fields : undefined}
          enablePhotoScan={AI_PHOTO_SCAN['Buchungsanfragen']}
          enablePhotoLocation={AI_PHOTO_LOCATION['Buchungsanfragen']}
        />
      )}
      {(createEntity === 'website' || dialogState?.entity === 'website') && (
        <WebsiteDialog
          open={createEntity === 'website' || dialogState?.entity === 'website'}
          onClose={() => { setCreateEntity(null); setDialogState(null); }}
          onSubmit={dialogState?.entity === 'website' ? handleUpdate : (fields: any) => handleCreate('website', fields)}
          defaultValues={dialogState?.entity === 'website' ? dialogState.record?.fields : undefined}
          enablePhotoScan={AI_PHOTO_SCAN['Website']}
          enablePhotoLocation={AI_PHOTO_LOCATION['Website']}
        />
      )}
      {(createEntity === 'pfoten_portraets' || dialogState?.entity === 'pfoten_portraets') && (
        <PfotenPortraetsDialog
          open={createEntity === 'pfoten_portraets' || dialogState?.entity === 'pfoten_portraets'}
          onClose={() => { setCreateEntity(null); setDialogState(null); }}
          onSubmit={dialogState?.entity === 'pfoten_portraets' ? handleUpdate : (fields: any) => handleCreate('pfoten_portraets', fields)}
          defaultValues={dialogState?.entity === 'pfoten_portraets' ? dialogState.record?.fields : undefined}
          hundeList={(data as any).hunde ?? []}
          besitzerList={(data as any).besitzer ?? []}
          buchungenList={(data as any).buchungen ?? []}
          enablePhotoScan={AI_PHOTO_SCAN['PfotenPortraets']}
          enablePhotoLocation={AI_PHOTO_LOCATION['PfotenPortraets']}
        />
      )}
      {viewState?.entity === 'besitzer' && (
        <BesitzerViewDialog
          open={viewState?.entity === 'besitzer'}
          onClose={() => setViewState(null)}
          record={viewState?.record}
          onEdit={(r: any) => { setViewState(null); setDialogState({ entity: 'besitzer', record: r }); }}
        />
      )}
      {viewState?.entity === 'hunde' && (
        <HundeViewDialog
          open={viewState?.entity === 'hunde'}
          onClose={() => setViewState(null)}
          record={viewState?.record}
          onEdit={(r: any) => { setViewState(null); setDialogState({ entity: 'hunde', record: r }); }}
          besitzerList={(data as any).besitzer ?? []}
        />
      )}
      {viewState?.entity === 'buchungen' && (
        <BuchungenViewDialog
          open={viewState?.entity === 'buchungen'}
          onClose={() => setViewState(null)}
          record={viewState?.record}
          onEdit={(r: any) => { setViewState(null); setDialogState({ entity: 'buchungen', record: r }); }}
          hundeList={(data as any).hunde ?? []}
          besitzerList={(data as any).besitzer ?? []}
        />
      )}
      {viewState?.entity === 'buchungsanfragen' && (
        <BuchungsanfragenViewDialog
          open={viewState?.entity === 'buchungsanfragen'}
          onClose={() => setViewState(null)}
          record={viewState?.record}
          onEdit={(r: any) => { setViewState(null); setDialogState({ entity: 'buchungsanfragen', record: r }); }}
        />
      )}
      {viewState?.entity === 'website' && (
        <WebsiteViewDialog
          open={viewState?.entity === 'website'}
          onClose={() => setViewState(null)}
          record={viewState?.record}
          onEdit={(r: any) => { setViewState(null); setDialogState({ entity: 'website', record: r }); }}
        />
      )}
      {viewState?.entity === 'pfoten_portraets' && (
        <PfotenPortraetsViewDialog
          open={viewState?.entity === 'pfoten_portraets'}
          onClose={() => setViewState(null)}
          record={viewState?.record}
          onEdit={(r: any) => { setViewState(null); setDialogState({ entity: 'pfoten_portraets', record: r }); }}
          hundeList={(data as any).hunde ?? []}
          besitzerList={(data as any).besitzer ?? []}
          buchungenList={(data as any).buchungen ?? []}
        />
      )}

      <BulkEditDialog
        open={!!bulkEditOpen}
        onClose={() => setBulkEditOpen(null)}
        onApply={handleBulkEdit}
        fields={bulkEditOpen ? getFieldMeta(bulkEditOpen) : []}
        selectedCount={bulkEditOpen ? selectedIds[bulkEditOpen].size : 0}
        loading={bulkLoading}
        lookupLists={bulkEditOpen ? getLookupLists(bulkEditOpen) : {}}
      />

      <ConfirmDialog
        open={!!deleteTargets}
        onClose={() => setDeleteTargets(null)}
        onConfirm={handleBulkDelete}
        title={t('bulk_delete')}
        description={t('confirm_bulk_delete', { n: deleteTargets?.ids.length ?? 0 })}
      />
    </PageShell>
  );
}