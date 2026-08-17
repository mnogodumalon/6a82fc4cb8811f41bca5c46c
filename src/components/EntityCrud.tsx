/**
 * EntityCrud — pre-generated CRUD + overlay plumbing for the dashboard.
 * Compose it; NEVER re-roll dialog state, submit handlers, an overlay stack
 * or a RecordOverlayHost in the page — this file owns all of it.
 *
 * API at a glance:
 *   const data = useDashboardData();
 *   const crud = useEntityCrud(data, {
 *     // optional — the ONE semantic slot on the overlay: the record's next
 *     // workflow step. Return undefined for types without one.
 *     footer: (top) => top.type === 'besitzer'
 *       ? { label: …, onClick: () => … }
 *       : undefined,
 *   });
 *   …
 *   crud.besitzer.openCreate({ …defaults })   // create dialog, prefilled — defaults are
 *                                       // shape-tolerant: bare lookup keys / record ids are fine
 *   crud.besitzer.openEdit(record)            // edit dialog (recordId + defaults wired)
 *   crud.besitzer.openDetail(record)          // record overlay — pass the RAW record,
 *                                       // enrichment is resolved inside
 *   crud.overlay                         // RecordOverlayStack<OverlayItem> for drills:
 *                                       // push / pop / replace / close
 *   crud.enriched.hunde              // memoized Enriched* arrays — reuse these,
 *                                       // never call enrich*() yourself in the page
 *   {crud.surfaces}                      // render ONCE at the end of the page JSX:
 *                                       // all entity dialogs + the overlay host
 *
 * Built in (do NOT re-implement): optimistic update + Rückgängig counter-write
 * on edit, fetchAll-on-error, edit-from-overlay, and per-entity overlay bodies
 * (RecordHeader + <{Entity}Details> with every relation reachable and the
 * contextual "+" prefilled). Drag writes (onEventDrop/onCardMove) stay YOURS:
 * optimistic setter first, PATCH in background, undoToast with counter-write.
 *
 * Overlay content per entity (the host renders these — you never compose
 * Details blocks yourself):
 *   besitzer: vorname, nachname, telefon, email, strasse, hausnummer, plz, ort, …  ·  ← hunde (list + contextual +) · ← buchungen (list + contextual +) · ← pfoten_portraets (list + contextual +)
 *   hunde: name, rasse, geburtsdatum, geschlecht, gewicht_kg, kastriert, impfstatus, impfausweis_foto, …  ·  → besitzer · ← buchungen (list + contextual +) · ← pfoten_portraets (list + contextual +)
 *   buchungen: hund, besitzer, anreise, abreise, platz, status, preis_gesamt, zahlungsstatus, …  ·  → hunde · → besitzer · ← pfoten_portraets (list + contextual +)
 *   buchungsanfragen: anfrage_vorname, anfrage_nachname, anfrage_telefon, anfrage_email, hund_name, hund_rasse, hund_groesse, wunsch_anreise, …
 *   website: unternehmensname, slogan, beschreibung, leistungen, anzahl_plaetze, oeffnungszeiten, website_telefon, website_email, …
 *   pfoten_portraets: hund, besitzer, buchung, widmung, besondere_erlebnisse, hund_foto, erstellungsdatum, zusatztext  ·  → hunde · → besitzer · → buchungen
 */
import { useState, useMemo, type ReactNode } from 'react';
import type { Besitzer, Hunde, Buchungen, Buchungsanfragen, Website, PfotenPortraets } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { enrichHunde, enrichBuchungen, enrichPfotenPortraets } from '@/lib/enrich';
import type { EnrichedHunde, EnrichedBuchungen, EnrichedPfotenPortraets } from '@/types/enriched';
import { useDashboardData } from '@/hooks/useDashboardData';
import {
  useRecordOverlayStack, RecordOverlayHost, RecordHeader,
  type RecordOverlayStack,
} from '@/components/widgets/RecordView';
import { BesitzerDialog, type BesitzerDialogDefaults } from '@/components/dialogs/BesitzerDialog';
import { BesitzerDetails } from '@/components/details/BesitzerDetails';
import { HundeDialog, type HundeDialogDefaults } from '@/components/dialogs/HundeDialog';
import { HundeDetails } from '@/components/details/HundeDetails';
import { BuchungenDialog, type BuchungenDialogDefaults } from '@/components/dialogs/BuchungenDialog';
import { BuchungenDetails } from '@/components/details/BuchungenDetails';
import { BuchungsanfragenDialog, type BuchungsanfragenDialogDefaults } from '@/components/dialogs/BuchungsanfragenDialog';
import { BuchungsanfragenDetails } from '@/components/details/BuchungsanfragenDetails';
import { WebsiteDialog, type WebsiteDialogDefaults } from '@/components/dialogs/WebsiteDialog';
import { WebsiteDetails } from '@/components/details/WebsiteDetails';
import { PfotenPortraetsDialog, type PfotenPortraetsDialogDefaults } from '@/components/dialogs/PfotenPortraetsDialog';
import { PfotenPortraetsDetails } from '@/components/details/PfotenPortraetsDetails';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { t, appLabel } from '@/i18n';
import { undoToast } from '@/lib/polish';
import { formatDate } from '@/lib/formatters';

// The overlay union — one branch per entity, `record` typed the way the data
// flows: Enriched* where enrichment exists, the raw record type otherwise.
// The host resolves enrichment itself; pages pass raw records everywhere.
export type OverlayItem =
  | { type: 'besitzer'; record: Besitzer }
  | { type: 'hunde'; record: EnrichedHunde }
  | { type: 'buchungen'; record: EnrichedBuchungen }
  | { type: 'buchungsanfragen'; record: Buchungsanfragen }
  | { type: 'website'; record: Website }
  | { type: 'pfoten_portraets'; record: EnrichedPfotenPortraets };

/** The useDashboardData() return — pass it in, never re-fetch inside. */
export type EntityCrudData = ReturnType<typeof useDashboardData>;

export interface EntityCrudOptions {
  /** Per-type overlay footer — the record's next workflow step. */
  footer?: (top: OverlayItem) => ReactNode | { label: ReactNode; onClick: () => void } | undefined;
  placement?: 'side' | 'center';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface EntityCrudApi<TRecord, TDefaults> {
  /** Open the create dialog, optionally prefilled (shape-tolerant defaults). */
  openCreate: (defaults?: TDefaults) => void;
  /** Open the edit dialog for a record (recordId + defaults are wired). */
  openEdit: (record: TRecord) => void;
  /** Open the record overlay (raw record is fine — enrichment resolved inside). */
  openDetail: (record: TRecord) => void;
}

export interface EntityCrud {
  /** The overlay stack for drills: push / pop / replace / close. */
  overlay: RecordOverlayStack<OverlayItem>;
  /** Render ONCE at the end of the page JSX — all dialogs + the overlay host. */
  surfaces: ReactNode;
  besitzer: EntityCrudApi<Besitzer, BesitzerDialogDefaults>;
  hunde: EntityCrudApi<Hunde, HundeDialogDefaults>;
  buchungen: EntityCrudApi<Buchungen, BuchungenDialogDefaults>;
  buchungsanfragen: EntityCrudApi<Buchungsanfragen, BuchungsanfragenDialogDefaults>;
  website: EntityCrudApi<Website, WebsiteDialogDefaults>;
  pfotenPortraets: EntityCrudApi<PfotenPortraets, PfotenPortraetsDialogDefaults>;
  /** Memoized Enriched* arrays — reuse these, never re-enrich in the page. */
  enriched: { hunde: EnrichedHunde[]; buchungen: EnrichedBuchungen[]; pfotenPortraets: EnrichedPfotenPortraets[] };
}

export function useEntityCrud(data: EntityCrudData, options?: EntityCrudOptions): EntityCrud {
  const overlay = useRecordOverlayStack<OverlayItem>();
  const [besitzerDialog, setBesitzerDialog] = useState<{ defaults?: BesitzerDialogDefaults; editing?: Besitzer } | null>(null);
  const [hundeDialog, setHundeDialog] = useState<{ defaults?: HundeDialogDefaults; editing?: Hunde } | null>(null);
  const [buchungenDialog, setBuchungenDialog] = useState<{ defaults?: BuchungenDialogDefaults; editing?: Buchungen } | null>(null);
  const [buchungsanfragenDialog, setBuchungsanfragenDialog] = useState<{ defaults?: BuchungsanfragenDialogDefaults; editing?: Buchungsanfragen } | null>(null);
  const [websiteDialog, setWebsiteDialog] = useState<{ defaults?: WebsiteDialogDefaults; editing?: Website } | null>(null);
  const [pfotenPortraetsDialog, setPfotenPortraetsDialog] = useState<{ defaults?: PfotenPortraetsDialogDefaults; editing?: PfotenPortraets } | null>(null);
  const enrichedHunde = useMemo(() => enrichHunde(data.hunde, { besitzerMap: data.besitzerMap }), [data.hunde, data.besitzerMap]);
  const enrichedBuchungen = useMemo(() => enrichBuchungen(data.buchungen, { hundeMap: data.hundeMap, besitzerMap: data.besitzerMap }), [data.buchungen, data.hundeMap, data.besitzerMap]);
  const enrichedPfotenPortraets = useMemo(() => enrichPfotenPortraets(data.pfotenPortraets, { hundeMap: data.hundeMap, besitzerMap: data.besitzerMap, buchungenMap: data.buchungenMap }), [data.pfotenPortraets, data.hundeMap, data.besitzerMap, data.buchungenMap]);

  function detailBesitzer(record: Besitzer, push = false) {
    const item: OverlayItem = { type: 'besitzer', record };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitBesitzer(fields: Besitzer['fields']) {
    const editing = besitzerDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setBesitzer(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateBesitzerEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('besitzer')} — ${t('crud_updated')}`, async () => {
        data.setBesitzer(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateBesitzerEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createBesitzerEntry(fields);
      undoToast(`${appLabel('besitzer')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailHunde(record: Hunde, push = false) {
    const rec = enrichedHunde.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'hunde', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitHunde(fields: Hunde['fields']) {
    const editing = hundeDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setHunde(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateHundeEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('hunde')} — ${t('crud_updated')}`, async () => {
        data.setHunde(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateHundeEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createHundeEntry(fields);
      undoToast(`${appLabel('hunde')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailBuchungen(record: Buchungen, push = false) {
    const rec = enrichedBuchungen.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'buchungen', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitBuchungen(fields: Buchungen['fields']) {
    const editing = buchungenDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setBuchungen(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateBuchungenEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('buchungen')} — ${t('crud_updated')}`, async () => {
        data.setBuchungen(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateBuchungenEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createBuchungenEntry(fields);
      undoToast(`${appLabel('buchungen')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailBuchungsanfragen(record: Buchungsanfragen, push = false) {
    const item: OverlayItem = { type: 'buchungsanfragen', record };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitBuchungsanfragen(fields: Buchungsanfragen['fields']) {
    const editing = buchungsanfragenDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setBuchungsanfragen(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateBuchungsanfragenEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('buchungsanfragen')} — ${t('crud_updated')}`, async () => {
        data.setBuchungsanfragen(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateBuchungsanfragenEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createBuchungsanfragenEntry(fields);
      undoToast(`${appLabel('buchungsanfragen')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailWebsite(record: Website, push = false) {
    const item: OverlayItem = { type: 'website', record };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitWebsite(fields: Website['fields']) {
    const editing = websiteDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setWebsite(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateWebsiteEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('website')} — ${t('crud_updated')}`, async () => {
        data.setWebsite(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateWebsiteEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createWebsiteEntry(fields);
      undoToast(`${appLabel('website')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailPfotenPortraets(record: PfotenPortraets, push = false) {
    const rec = enrichedPfotenPortraets.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'pfoten_portraets', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitPfotenPortraets(fields: PfotenPortraets['fields']) {
    const editing = pfotenPortraetsDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setPfotenPortraets(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updatePfotenPortraet(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('pfoten_portraets')} — ${t('crud_updated')}`, async () => {
        data.setPfotenPortraets(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updatePfotenPortraet(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createPfotenPortraet(fields);
      undoToast(`${appLabel('pfoten_portraets')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  const surfaces = (
    <>
      <BesitzerDialog
        open={besitzerDialog !== null}
        onClose={() => setBesitzerDialog(null)}
        onSubmit={submitBesitzer}
        defaultValues={besitzerDialog?.defaults}
        recordId={besitzerDialog?.editing?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Besitzer']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Besitzer']}
      />
      <HundeDialog
        open={hundeDialog !== null}
        onClose={() => setHundeDialog(null)}
        onSubmit={submitHunde}
        defaultValues={hundeDialog?.defaults}
        recordId={hundeDialog?.editing?.record_id}
        besitzerList={data.besitzer}
        enablePhotoScan={AI_PHOTO_SCAN['Hunde']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Hunde']}
      />
      <BuchungenDialog
        open={buchungenDialog !== null}
        onClose={() => setBuchungenDialog(null)}
        onSubmit={submitBuchungen}
        defaultValues={buchungenDialog?.defaults}
        recordId={buchungenDialog?.editing?.record_id}
        hundeList={data.hunde}
        besitzerList={data.besitzer}
        enablePhotoScan={AI_PHOTO_SCAN['Buchungen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Buchungen']}
      />
      <BuchungsanfragenDialog
        open={buchungsanfragenDialog !== null}
        onClose={() => setBuchungsanfragenDialog(null)}
        onSubmit={submitBuchungsanfragen}
        defaultValues={buchungsanfragenDialog?.defaults}
        recordId={buchungsanfragenDialog?.editing?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Buchungsanfragen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Buchungsanfragen']}
      />
      <WebsiteDialog
        open={websiteDialog !== null}
        onClose={() => setWebsiteDialog(null)}
        onSubmit={submitWebsite}
        defaultValues={websiteDialog?.defaults}
        recordId={websiteDialog?.editing?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Website']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Website']}
      />
      <PfotenPortraetsDialog
        open={pfotenPortraetsDialog !== null}
        onClose={() => setPfotenPortraetsDialog(null)}
        onSubmit={submitPfotenPortraets}
        defaultValues={pfotenPortraetsDialog?.defaults}
        recordId={pfotenPortraetsDialog?.editing?.record_id}
        hundeList={data.hunde}
        besitzerList={data.besitzer}
        buchungenList={data.buchungen}
        enablePhotoScan={AI_PHOTO_SCAN['PfotenPortraets']}
        enablePhotoLocation={AI_PHOTO_LOCATION['PfotenPortraets']}
      />
      <RecordOverlayHost
        overlay={overlay}
        placement={options?.placement}
        size={options?.size}
        footer={options?.footer}
        render={(top) => {
          if (top.type === 'besitzer') {
            return (
              <>
                <RecordHeader title={top.record.fields.vorname ?? appLabel('besitzer')} subtitle={undefined} />
                <BesitzerDetails
                  record={top.record}
                  hundeList={data.hunde}
                  onOpenHunde={(r) => detailHunde(r, true)}
                  onAddHunde={() => setHundeDialog({ defaults: { besitzer: createRecordUrl(APP_IDS.BESITZER, top.record.record_id) } })}
                  buchungenList={data.buchungen}
                  onOpenBuchungen={(r) => detailBuchungen(r, true)}
                  onAddBuchungen={() => setBuchungenDialog({ defaults: { besitzer: createRecordUrl(APP_IDS.BESITZER, top.record.record_id) } })}
                  pfotenPortraetsList={data.pfotenPortraets}
                  onOpenPfotenPortraets={(r) => detailPfotenPortraets(r, true)}
                  onAddPfotenPortraets={() => setPfotenPortraetsDialog({ defaults: { besitzer: createRecordUrl(APP_IDS.BESITZER, top.record.record_id) } })}
                />
              </>
            );
          }
          if (top.type === 'hunde') {
            return (
              <>
                <RecordHeader title={top.record.fields.name ?? appLabel('hunde')} subtitle={top.record.fields.geburtsdatum ? formatDate(top.record.fields.geburtsdatum) : undefined} />
                <HundeDetails
                  record={top.record}
                  besitzerList={data.besitzer}
                  onOpenBesitzer={(r) => detailBesitzer(r, true)}
                  buchungenList={data.buchungen}
                  onOpenBuchungen={(r) => detailBuchungen(r, true)}
                  onAddBuchungen={() => setBuchungenDialog({ defaults: { hund: createRecordUrl(APP_IDS.HUNDE, top.record.record_id) } })}
                  pfotenPortraetsList={data.pfotenPortraets}
                  onOpenPfotenPortraets={(r) => detailPfotenPortraets(r, true)}
                  onAddPfotenPortraets={() => setPfotenPortraetsDialog({ defaults: { hund: createRecordUrl(APP_IDS.HUNDE, top.record.record_id) } })}
                />
              </>
            );
          }
          if (top.type === 'buchungen') {
            return (
              <>
                <RecordHeader title={appLabel('buchungen')} subtitle={top.record.fields.anreise ? formatDate(top.record.fields.anreise) : undefined} />
                <BuchungenDetails
                  record={top.record}
                  hundeList={data.hunde}
                  onOpenHunde={(r) => detailHunde(r, true)}
                  besitzerList={data.besitzer}
                  onOpenBesitzer={(r) => detailBesitzer(r, true)}
                  pfotenPortraetsList={data.pfotenPortraets}
                  onOpenPfotenPortraets={(r) => detailPfotenPortraets(r, true)}
                  onAddPfotenPortraets={() => setPfotenPortraetsDialog({ defaults: { buchung: createRecordUrl(APP_IDS.BUCHUNGEN, top.record.record_id) } })}
                />
              </>
            );
          }
          if (top.type === 'buchungsanfragen') {
            return (
              <>
                <RecordHeader title={top.record.fields.anfrage_vorname ?? appLabel('buchungsanfragen')} subtitle={top.record.fields.wunsch_anreise ? formatDate(top.record.fields.wunsch_anreise) : undefined} />
                <BuchungsanfragenDetails
                  record={top.record}
                />
              </>
            );
          }
          if (top.type === 'website') {
            return (
              <>
                <RecordHeader title={top.record.fields.unternehmensname ?? appLabel('website')} subtitle={undefined} />
                <WebsiteDetails
                  record={top.record}
                />
              </>
            );
          }
          if (top.type === 'pfoten_portraets') {
            return (
              <>
                <RecordHeader title={appLabel('pfoten_portraets')} subtitle={top.record.fields.erstellungsdatum ? formatDate(top.record.fields.erstellungsdatum) : undefined} />
                <PfotenPortraetsDetails
                  record={top.record}
                  hundeList={data.hunde}
                  onOpenHunde={(r) => detailHunde(r, true)}
                  besitzerList={data.besitzer}
                  onOpenBesitzer={(r) => detailBesitzer(r, true)}
                  buchungenList={data.buchungen}
                  onOpenBuchungen={(r) => detailBuchungen(r, true)}
                />
              </>
            );
          }
          return null;
        }}
        onEdit={(top) => {
          overlay.close();
          if (top.type === 'besitzer') setBesitzerDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'hunde') setHundeDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'buchungen') setBuchungenDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'buchungsanfragen') setBuchungsanfragenDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'website') setWebsiteDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'pfoten_portraets') setPfotenPortraetsDialog({ editing: top.record, defaults: top.record.fields });
        }}
      />
    </>
  );

  return {
    overlay,
    surfaces,
    besitzer: {
      openCreate: (defaults?: BesitzerDialogDefaults) => setBesitzerDialog({ defaults }),
      openEdit: (record: Besitzer) => setBesitzerDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Besitzer) => detailBesitzer(record, false),
    },
    hunde: {
      openCreate: (defaults?: HundeDialogDefaults) => setHundeDialog({ defaults }),
      openEdit: (record: Hunde) => setHundeDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Hunde) => detailHunde(record, false),
    },
    buchungen: {
      openCreate: (defaults?: BuchungenDialogDefaults) => setBuchungenDialog({ defaults }),
      openEdit: (record: Buchungen) => setBuchungenDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Buchungen) => detailBuchungen(record, false),
    },
    buchungsanfragen: {
      openCreate: (defaults?: BuchungsanfragenDialogDefaults) => setBuchungsanfragenDialog({ defaults }),
      openEdit: (record: Buchungsanfragen) => setBuchungsanfragenDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Buchungsanfragen) => detailBuchungsanfragen(record, false),
    },
    website: {
      openCreate: (defaults?: WebsiteDialogDefaults) => setWebsiteDialog({ defaults }),
      openEdit: (record: Website) => setWebsiteDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Website) => detailWebsite(record, false),
    },
    pfotenPortraets: {
      openCreate: (defaults?: PfotenPortraetsDialogDefaults) => setPfotenPortraetsDialog({ defaults }),
      openEdit: (record: PfotenPortraets) => setPfotenPortraetsDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: PfotenPortraets) => detailPfotenPortraets(record, false),
    },
    enriched: { hunde: enrichedHunde, buchungen: enrichedBuchungen, pfotenPortraets: enrichedPfotenPortraets },
  };
}
