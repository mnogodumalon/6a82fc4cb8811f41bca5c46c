import { useMemo, useState, useCallback } from 'react';
import { format, parseISO, isToday, isBefore, startOfDay } from 'date-fns';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { tx, appLabel, dateFnsLocale } from '@/i18n';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { formatDate, lookupKey } from '@/lib/formatters';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS, LOOKUP_OPTIONS, lookupOption } from '@/types/app';
import type { Buchungen } from '@/types/app';
import {
  ResourceTimeline,
  ResourceTimelineSkeleton,
  ResourceTimelineError,
  type ResourceEvent,
  type ResourceGroup,
} from '@/components/widgets/ResourceTimeline';
import {
  IconDog,
  IconCalendar,
  IconAlertCircle,
  IconCheck,
  IconX,
  IconBed,
  IconDoorEnter,
  IconDoorExit,
  IconPaw,
} from '@tabler/icons-react';

// 12 Plätze — statische Ressourcengruppen
const PLAETZE_OPTIONS = LOOKUP_OPTIONS['buchungen']?.['platz'] ?? [];

export default function DashboardOverview() {
  const data = useDashboardData();
  const {
    buchungen,
    buchungsanfragen,
    setBuchungen,
    loading,
    error,
    fetchAll,
  } = data;

  const clock = useClock();

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'buchungsanfragen') {
        const anfrage = buchungsanfragen.find(a => a.record_id === top.record.record_id);
        const status = lookupKey(anfrage?.fields.anfrage_status);
        if (status === 'offen') {
          return {
            label: tx('Anfrage bestätigen'),
            onClick: () => confirmAnfrage(top.record as typeof buchungsanfragen[0]),
          };
        }
      }
      if (top.type === 'buchungen') {
        const buchung = buchungen.find(b => b.record_id === top.record.record_id);
        const status = lookupKey(buchung?.fields.status);
        if (status === 'geplant') {
          return {
            label: tx('Einchecken'),
            onClick: () => checkIn(top.record as Buchungen),
          };
        }
        if (status === 'anwesend') {
          return {
            label: tx('Auschecken'),
            onClick: () => checkOut(top.record as Buchungen),
          };
        }
      }
      return undefined;
    },
  });

  const enrichedBuchungen = crud.enriched.buchungen;

  // ─── Derived state ──────────────────────────────────────────────────────────
  const today = format(clock, 'yyyy-MM-dd');

  const offeneAnfragen = useMemo(
    () => buchungsanfragen.filter(a => lookupKey(a.fields.anfrage_status) === 'offen'),
    [buchungsanfragen],
  );

  const heuteAnreise = useMemo(
    () => enrichedBuchungen.filter(b => b.fields.anreise === today && lookupKey(b.fields.status) === 'geplant'),
    [enrichedBuchungen, today],
  );

  const heuteAbreise = useMemo(
    () => enrichedBuchungen.filter(b => b.fields.abreise === today && lookupKey(b.fields.status) === 'anwesend'),
    [enrichedBuchungen, today],
  );

  const anwesend = useMemo(
    () => enrichedBuchungen.filter(b => lookupKey(b.fields.status) === 'anwesend'),
    [enrichedBuchungen],
  );

  const freiePlaetze = 12 - anwesend.length;

  // ResourceTimeline-Gruppen: die 12 Plätze
  const groups = useMemo<ResourceGroup[]>(
    () => PLAETZE_OPTIONS.map(p => ({ key: p.key, label: p.label })),
    [],
  );

  // Buchungen → ResourceEvents
  const events = useMemo<ResourceEvent[]>(
    () =>
      enrichedBuchungen
        .filter(b => !!b.fields.anreise && lookupKey(b.fields.status) !== 'storniert')
        .map(b => {
          const status = lookupKey(b.fields.status);
          const tone =
            status === 'anwesend' ? 'success'
            : status === 'abgereist' ? 'default'
            : 'primary';
          return {
            id: `buchung:${b.record_id}`,
            start: b.fields.anreise!,
            end: b.fields.abreise,
            allDay: true,
            title: b.hundName || b.besitzerName || tx('Buchung'),
            subtitle: b.besitzerName,
            tone,
            group: lookupKey(b.fields.platz) ?? '',
          };
        }),
    [enrichedBuchungen],
  );

  // ─── Write helpers ──────────────────────────────────────────────────────────
  const checkIn = useCallback(async (buchung: Buchungen) => {
    const prev = [...buchungen];
    setBuchungen(bs =>
      bs.map(b =>
        b.record_id === buchung.record_id
          ? { ...b, fields: { ...b.fields, status: lookupOption('buchungen', 'status', 'anwesend') } }
          : b,
      ),
    );
    undoToast(tx`${buchung.record_id} — eingecheckt`, async () => {
      setBuchungen(prev);
      await LivingAppsService.updateBuchungenEntry(buchung.record_id, { status: 'geplant' });
    });
    try {
      await LivingAppsService.updateBuchungenEntry(buchung.record_id, { status: 'anwesend' });
    } catch {
      setBuchungen(prev);
      fetchAll();
    }
  }, [buchungen, setBuchungen, fetchAll]);

  const checkOut = useCallback(async (buchung: Buchungen) => {
    const prev = [...buchungen];
    setBuchungen(bs =>
      bs.map(b =>
        b.record_id === buchung.record_id
          ? { ...b, fields: { ...b.fields, status: lookupOption('buchungen', 'status', 'abgereist') } }
          : b,
      ),
    );
    undoToast(tx`${buchung.record_id} — ausgecheckt`, async () => {
      setBuchungen(prev);
      await LivingAppsService.updateBuchungenEntry(buchung.record_id, { status: 'anwesend' });
    });
    try {
      await LivingAppsService.updateBuchungenEntry(buchung.record_id, { status: 'abgereist' });
    } catch {
      setBuchungen(prev);
      fetchAll();
    }
  }, [buchungen, setBuchungen, fetchAll]);

  const confirmAnfrage = useCallback(async (anfrage: typeof buchungsanfragen[0]) => {
    // Anfrage bestätigen → Status setzen
    const prev = [...buchungsanfragen];
    const { setBuchungsanfragen } = data as any;
    if (setBuchungsanfragen) {
      setBuchungsanfragen((as: typeof buchungsanfragen) =>
        as.map(a =>
          a.record_id === anfrage.record_id
            ? { ...a, fields: { ...a.fields, anfrage_status: lookupOption('buchungsanfragen', 'anfrage_status', 'bestaetigt') } }
            : a,
        ),
      );
    }
    undoToast(
      tx`${anfrage.fields.anfrage_vorname ?? ''} — Anfrage bestätigt`,
      async () => {
        if (setBuchungsanfragen) setBuchungsanfragen(prev);
        await LivingAppsService.updateBuchungsanfragenEntry(anfrage.record_id, { anfrage_status: 'offen' });
      },
    );
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(anfrage.record_id, { anfrage_status: 'bestaetigt' });
    } catch {
      if (setBuchungsanfragen) setBuchungsanfragen(prev);
      fetchAll();
    }
  }, [buchungsanfragen, data, fetchAll]);

  const rejectAnfrage = useCallback(async (anfrage: typeof buchungsanfragen[0]) => {
    const prev = [...buchungsanfragen];
    const { setBuchungsanfragen } = data as any;
    if (setBuchungsanfragen) {
      setBuchungsanfragen((as: typeof buchungsanfragen) =>
        as.map(a =>
          a.record_id === anfrage.record_id
            ? { ...a, fields: { ...a.fields, anfrage_status: lookupOption('buchungsanfragen', 'anfrage_status', 'abgelehnt') } }
            : a,
        ),
      );
    }
    undoToast(
      tx`${anfrage.fields.anfrage_vorname ?? ''} — Anfrage abgelehnt`,
      async () => {
        if (setBuchungsanfragen) setBuchungsanfragen(prev);
        await LivingAppsService.updateBuchungsanfragenEntry(anfrage.record_id, { anfrage_status: 'offen' });
      },
    );
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(anfrage.record_id, { anfrage_status: 'abgelehnt' });
    } catch {
      if (setBuchungsanfragen) setBuchungsanfragen(prev);
      fetchAll();
    }
  }, [buchungsanfragen, data, fetchAll]);

  // Drag-Reschedule
  const reschedule = useCallback(async (
    id: string,
    newStart: string,
    newEnd?: string,
    newGroup?: string,
  ) => {
    const rid = id.split(':')[1] ?? '';
    if (!rid) return;
    const prev = [...buchungen];
    const platzPatch = newGroup ? { platz: lookupOption('buchungen', 'platz', newGroup) } : {};
    setBuchungen(bs =>
      bs.map(b =>
        b.record_id === rid
          ? { ...b, fields: { ...b.fields, anreise: newStart, ...(newEnd ? { abreise: newEnd } : {}), ...platzPatch } }
          : b,
      ),
    );
    undoToast(tx('Buchung verschoben'), async () => {
      setBuchungen(prev);
      const b = prev.find(x => x.record_id === rid);
      if (b) {
        await LivingAppsService.updateBuchungenEntry(rid, {
          anreise: b.fields.anreise,
          abreise: b.fields.abreise,
          ...(b.fields.platz ? { platz: lookupKey(b.fields.platz) } : {}),
        });
      }
    });
    try {
      await LivingAppsService.updateBuchungenEntry(rid, {
        anreise: newStart,
        ...(newEnd ? { abreise: newEnd } : {}),
        ...(newGroup ? { platz: newGroup } : {}),
      });
    } catch {
      setBuchungen(prev);
      fetchAll();
    }
  }, [buchungen, setBuchungen, fetchAll]);

  const resize = useCallback(async (id: string, newStart: string, newEnd: string) => {
    const rid = id.split(':')[1] ?? '';
    if (!rid) return;
    const prev = [...buchungen];
    setBuchungen(bs =>
      bs.map(b =>
        b.record_id === rid ? { ...b, fields: { ...b.fields, anreise: newStart, abreise: newEnd } } : b,
      ),
    );
    undoToast(tx('Buchungszeitraum angepasst'), async () => {
      setBuchungen(prev);
      const b = prev.find(x => x.record_id === rid);
      if (b) await LivingAppsService.updateBuchungenEntry(rid, { anreise: b.fields.anreise, abreise: b.fields.abreise });
    });
    try {
      await LivingAppsService.updateBuchungenEntry(rid, { anreise: newStart, abreise: newEnd });
    } catch {
      setBuchungen(prev);
      fetchAll();
    }
  }, [buchungen, setBuchungen, fetchAll]);

  // ─── Loading / Error ────────────────────────────────────────────────────────
  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // ─── Context-Zeile ──────────────────────────────────────────────────────────
  const anreiseNamen = heuteAnreise.map(b => b.hundName).filter(Boolean);
  const abreiseNamen = heuteAbreise.map(b => b.hundName).filter(Boolean);
  const contextLine = (() => {
    if (buchungen.length === 0) {
      return tx('Noch keine Buchungen — lege deine erste Buchung an.');
    }
    const parts: string[] = [];
    if (heuteAnreise.length > 0) parts.push(tx`${namen(anreiseNamen)} reist heute an.`);
    if (heuteAbreise.length > 0) parts.push(tx`${namen(abreiseNamen)} reist heute ab.`);
    if (parts.length === 0) {
      return anwesend.length > 0
        ? tx`${anwesend.length} Hunde bei euch. Heute keine An- oder Abreise.`
        : tx('Aktuell sind keine Hunde im Haus.');
    }
    return parts.join(' ');
  })();

  // Leere Pension — CTA
  if (buchungen.length === 0 && buchungsanfragen.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
        <div className="rounded-2xl bg-primary/10 p-6 flex items-center justify-center">
          <IconPaw size={48} className="text-primary" stroke={1.5} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground mb-2">{tx('Willkommen in der Pfotenpension!')}</h2>
          <p className="text-muted-foreground max-w-sm">{tx('Lege deine erste Buchung an und behalte den Überblick über alle Plätze.')}</p>
        </div>
        <button
          className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors"
          onClick={() => crud.buchungen.openCreate({ status: 'geplant' })}
        >
          {tx('Erste Buchung anlegen')}
        </button>
        {crud.surfaces}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Seitenkopf */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{gruss(clock)}</h1>
          <p className="text-muted-foreground mt-0.5">{contextLine}</p>
        </div>
        <button
          className="mt-2 sm:mt-0 shrink-0 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
          onClick={() => crud.buchungen.openCreate({ status: 'geplant' })}
        >
          <IconCalendar size={16} className="shrink-0" />
          {tx('Neue Buchung')}
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={
          offeneAnfragen.length > 0 ? (
            <HeroBanner
              icon={<IconAlertCircle size={18} />}
              action={{
                label: tx('Anfrage bestätigen'),
                onClick: () => confirmAnfrage(offeneAnfragen[0]),
              }}
            >
              <b>{namen(offeneAnfragen.map(a => `${a.fields.anfrage_vorname ?? ''} ${a.fields.anfrage_nachname ?? ''}`.trim()))}</b>
              {offeneAnfragen.length === 1
                ? tx` hat eine Buchungsanfrage gestellt.`
                : tx` haben Buchungsanfragen gestellt.`}
            </HeroBanner>
          ) : undefined
        }
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Anwesend')}
              value={anwesend.length}
              icon={<IconDog size={16} />}
              tone={anwesend.length > 0 ? 'success' : 'default'}
            />
            <StatStripItem
              title={tx('Freie Plätze')}
              value={freiePlaetze}
              icon={<IconBed size={16} />}
              tone={freiePlaetze === 0 ? 'warning' : freiePlaetze <= 3 ? 'warning' : 'default'}
            />
            <StatStripItem
              title={tx('Heute Anreise')}
              value={heuteAnreise.length}
              icon={<IconDoorEnter size={16} />}
              tone={heuteAnreise.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title={tx('Heute Abreise')}
              value={heuteAbreise.length}
              icon={<IconDoorExit size={16} />}
              tone={heuteAbreise.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title={tx('Offene Anfragen')}
              value={offeneAnfragen.length}
              icon={<IconAlertCircle size={16} />}
              tone={offeneAnfragen.length > 0 ? 'destructive' : 'default'}
            />
          </StatStrip>
        }
        primary={
          <ResourceTimeline
            events={events}
            groups={groups}
            axis="day"
            defaultRange="2weeks"
            defaultDate={clock}
            locale={dateFnsLocale()}
            onEventClick={ev => {
              const rid = ev.id.split(':')[1] ?? '';
              const rec = enrichedBuchungen.find(b => b.record_id === rid);
              if (rec) crud.buchungen.openDetail(rec);
            }}
            onEventDrop={reschedule}
            onEventResize={resize}
            onEmptyClick={(date, group) => {
              crud.buchungen.openCreate({
                anreise: format(date, 'yyyy-MM-dd'),
                platz: group,
                status: 'geplant',
              });
            }}
            onRangeCreate={(start, end, group) => {
              crud.buchungen.openCreate({
                anreise: format(start, 'yyyy-MM-dd'),
                abreise: format(end, 'yyyy-MM-dd'),
                platz: group,
                status: 'geplant',
              });
            }}
          />
        }
        aside={
          <>
            <WorkList
              title={tx('Heute Anreise')}
              items={heuteAnreise.map(b => ({
                id: b.record_id,
                title: b.hundName || tx('Unbekannter Hund'),
                secondLine: (
                  <>
                    <span className="text-muted-foreground">{b.besitzerName}</span>
                    {b.fields.platz && (
                      <span className="text-muted-foreground"> · {b.fields.platz.label}</span>
                    )}
                  </>
                ),
                action: {
                  label: tx('Einchecken'),
                  onClick: () => checkIn(b),
                },
              }))}
              onItemClick={id => {
                const rec = enrichedBuchungen.find(b => b.record_id === id);
                if (rec) crud.buchungen.openDetail(rec);
              }}
              empty={{
                text: heuteAbreise.length > 0
                  ? tx('Heute keine Anreisen — aber Abreisen laufen.')
                  : tx('Heute keine Anreisen geplant.'),
              }}
            />
            <WorkList
              title={tx('Heute Abreise & Anfragen')}
              items={[
                ...heuteAbreise.map(b => ({
                  id: `buchung:${b.record_id}`,
                  title: b.hundName || tx('Unbekannter Hund'),
                  secondLine: (
                    <>
                      <span className="font-medium text-amber-600">{tx('Abreise heute')}</span>
                      <span className="text-muted-foreground"> · {b.besitzerName}</span>
                    </>
                  ),
                  action: {
                    label: tx('Auschecken'),
                    onClick: () => checkOut(b),
                  },
                })),
                ...offeneAnfragen.slice(0, 3).map(a => ({
                  id: `anfrage:${a.record_id}`,
                  title: `${a.fields.hund_name ?? tx('Hund')} (${a.fields.anfrage_vorname ?? ''} ${a.fields.anfrage_nachname ?? ''}`.trim() + ')',
                  secondLine: (
                    <>
                      <span className="font-medium text-destructive">{tx('Anfrage offen')}</span>
                      <span className="text-muted-foreground">
                        {a.fields.wunsch_anreise ? ` · ab ${formatDate(a.fields.wunsch_anreise)}` : ''}
                      </span>
                    </>
                  ),
                  action: {
                    label: tx('Bestätigen'),
                    onClick: () => confirmAnfrage(a),
                  },
                })),
              ]}
              onItemClick={id => {
                if (id.startsWith('buchung:')) {
                  const rid = id.split(':')[1];
                  const rec = enrichedBuchungen.find(b => b.record_id === rid);
                  if (rec) crud.buchungen.openDetail(rec);
                } else if (id.startsWith('anfrage:')) {
                  const rid = id.split(':')[1];
                  const rec = buchungsanfragen.find(a => a.record_id === rid);
                  if (rec) crud.buchungsanfragen.openDetail(rec);
                }
              }}
              empty={{
                text: tx('Kein Handlungsbedarf — alles im Grünen.'),
                action: {
                  label: tx('Neue Buchung'),
                  onClick: () => crud.buchungen.openCreate({ status: 'geplant' }),
                },
              }}
            />
          </>
        }
      />

      {crud.surfaces}
    </div>
  );
}
