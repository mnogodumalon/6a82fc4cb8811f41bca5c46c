import { useMemo, useState, useCallback } from 'react';
import { format, parseISO, isSameDay, isAfter, isBefore, startOfDay } from 'date-fns';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { ResourceTimeline, type ResourceEvent, type ResourceGroup, type ResourceTone } from '@/components/widgets/ResourceTimeline';
import { tx, appLabel, dateFnsLocale } from '@/i18n';
import { APP_IDS, LOOKUP_OPTIONS, lookupOption, type Buchungen } from '@/types/app';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { formatDate, lookupKey } from '@/lib/formatters';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import {
  IconPaw,
  IconDoorEnter,
  IconDoorExit,
  IconCalendar,
  IconBell,
  IconBed,
  IconCheck,
  IconX,
} from '@tabler/icons-react';

// 12 Plätze als statische Ressourcen-Zeilen
const PLATZ_OPTIONS = LOOKUP_OPTIONS['buchungen']?.['platz'] ?? [];

function toneForBuchung(b: Buchungen): ResourceTone {
  const st = lookupKey(b.fields.status);
  if (st === 'anwesend') return 'success';
  if (st === 'storniert') return 'destructive';
  return 'primary';
}

export default function DashboardOverview() {
  const data = useDashboardData();
  const {
    buchungen, setBuchungen, buchungsanfragen, setBuchungsanfragen,
    loading, error, fetchAll,
  } = data;

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'buchungsanfragen') {
        const anf = buchungsanfragen.find(a => a.record_id === top.record.record_id);
        if (anf && lookupKey(anf.fields.anfrage_status) === 'offen') {
          return {
            label: tx('Anfrage bestätigen'),
            onClick: async () => {
              const prev = [...buchungsanfragen];
              setBuchungsanfragen(prev.map(a =>
                a.record_id === anf.record_id
                  ? { ...a, fields: { ...a.fields, anfrage_status: lookupOption('buchungsanfragen', 'anfrage_status', 'bestaetigt') } }
                  : a
              ));
              try {
                await LivingAppsService.updateBuchungsanfragenEntry(anf.record_id, { anfrage_status: 'bestaetigt' });
                undoToast(
                  tx`${anf.fields.anfrage_vorname ?? ''} ${anf.fields.anfrage_nachname ?? ''} — Anfrage bestätigt`,
                  async () => {
                    setBuchungsanfragen(prev);
                    await LivingAppsService.updateBuchungsanfragenEntry(anf.record_id, { anfrage_status: 'offen' });
                  }
                );
              } catch {
                setBuchungsanfragen(prev);
                fetchAll();
              }
            },
          };
        }
      }
      return undefined;
    },
  });

  const enrichedBuchungen = crud.enriched.buchungen;
  const clock = useClock();

  // Gruppen = 12 Plätze
  const groups = useMemo<ResourceGroup[]>(
    () => PLATZ_OPTIONS.map(p => ({ key: p.key, label: p.label })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Buchungen → ResourceEvents
  const events = useMemo<ResourceEvent[]>(
    () =>
      buchungen
        .filter(b => !!b.fields.anreise && !!b.fields.platz)
        .map(b => {
          const enriched = enrichedBuchungen.find(e => e.record_id === b.record_id);
          const platzKey = lookupKey(b.fields.platz) ?? '';
          return {
            id: `buchung:${b.record_id}`,
            start: b.fields.anreise!,
            end: b.fields.abreise,
            allDay: true,
            title: enriched?.hundName || enriched?.besitzerName || tx('Buchung'),
            subtitle: enriched?.besitzerName,
            tone: toneForBuchung(b),
            group: platzKey,
          };
        }),
    [buchungen, enrichedBuchungen]
  );

  // Heute-Derivationen
  const todayKey = format(clock, 'yyyy-MM-dd');

  const anreisenHeute = useMemo(
    () => enrichedBuchungen.filter(b => b.fields.anreise === todayKey && lookupKey(b.fields.status) !== 'storniert'),
    [enrichedBuchungen, todayKey]
  );

  const abreisenHeute = useMemo(
    () => enrichedBuchungen.filter(b => b.fields.abreise === todayKey && lookupKey(b.fields.status) !== 'storniert'),
    [enrichedBuchungen, todayKey]
  );

  const aktuellAnwesend = useMemo(
    () => buchungen.filter(b => lookupKey(b.fields.status) === 'anwesend'),
    [buchungen]
  );

  const offeneAnfragen = useMemo(
    () => buchungsanfragen.filter(a => lookupKey(a.fields.anfrage_status) === 'offen'),
    [buchungsanfragen]
  );

  const freieplaetze = 12 - aktuellAnwesend.length;

  // Filterzustand für Strip-Klicks
  const [filter, setFilter] = useState<'anreise' | 'abreise' | 'anwesend' | null>(null);

  // Bestätigen einer Buchungsanfrage (Schnellaktion in der WorkList)
  const bestaetigeAnfrage = useCallback(async (anfId: string) => {
    const anf = buchungsanfragen.find(a => a.record_id === anfId);
    if (!anf) return;
    const prev = [...buchungsanfragen];
    setBuchungsanfragen(prev.map(a =>
      a.record_id === anfId
        ? { ...a, fields: { ...a.fields, anfrage_status: lookupOption('buchungsanfragen', 'anfrage_status', 'bestaetigt') } }
        : a
    ));
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(anfId, { anfrage_status: 'bestaetigt' });
      undoToast(
        tx`${anf.fields.anfrage_vorname ?? ''} — Anfrage bestätigt`,
        async () => {
          setBuchungsanfragen(prev);
          await LivingAppsService.updateBuchungsanfragenEntry(anfId, { anfrage_status: 'offen' });
        }
      );
    } catch {
      setBuchungsanfragen(prev);
      fetchAll();
    }
  }, [buchungsanfragen, setBuchungsanfragen, fetchAll]);

  // Check-in bestätigen (Geplant → Anwesend)
  const checkIn = useCallback(async (buchungId: string) => {
    const b = buchungen.find(x => x.record_id === buchungId);
    if (!b) return;
    const prev = [...buchungen];
    setBuchungen(prev.map(x =>
      x.record_id === buchungId
        ? { ...x, fields: { ...x.fields, status: lookupOption('buchungen', 'status', 'anwesend') } }
        : x
    ));
    try {
      await LivingAppsService.updateBuchungenEntry(buchungId, { status: 'anwesend' });
      const enriched = enrichedBuchungen.find(e => e.record_id === buchungId);
      undoToast(
        tx`${enriched?.hundName ?? ''} — eingecheckt`,
        async () => {
          setBuchungen(prev);
          await LivingAppsService.updateBuchungenEntry(buchungId, { status: 'geplant' });
        }
      );
    } catch {
      setBuchungen(prev);
      fetchAll();
    }
  }, [buchungen, setBuchungen, enrichedBuchungen, fetchAll]);

  // Check-out (Anwesend → Abgereist)
  const checkOut = useCallback(async (buchungId: string) => {
    const b = buchungen.find(x => x.record_id === buchungId);
    if (!b) return;
    const prev = [...buchungen];
    setBuchungen(prev.map(x =>
      x.record_id === buchungId
        ? { ...x, fields: { ...x.fields, status: lookupOption('buchungen', 'status', 'abgereist') } }
        : x
    ));
    try {
      await LivingAppsService.updateBuchungenEntry(buchungId, { status: 'abgereist' });
      const enriched = enrichedBuchungen.find(e => e.record_id === buchungId);
      undoToast(
        tx`${enriched?.hundName ?? ''} — ausgecheckt`,
        async () => {
          setBuchungen(prev);
          await LivingAppsService.updateBuchungenEntry(buchungId, { status: 'anwesend' });
        }
      );
    } catch {
      setBuchungen(prev);
      fetchAll();
    }
  }, [buchungen, setBuchungen, enrichedBuchungen, fetchAll]);

  // Drag-Drop: Platz oder Datum verschieben
  const handleEventDrop = useCallback(async (
    id: string,
    newStart: string,
    newEnd?: string,
    newGroup?: string
  ) => {
    const rid = id.split(':')[1] ?? '';
    if (!rid) return;
    const prev = [...buchungen];
    const platzPatch = newGroup ? { platz: lookupOption('buchungen', 'platz', newGroup) } : {};
    setBuchungen(prev.map(b =>
      b.record_id === rid
        ? { ...b, fields: { ...b.fields, anreise: newStart, ...(newEnd ? { abreise: newEnd } : {}), ...platzPatch } }
        : b
    ));
    try {
      await LivingAppsService.updateBuchungenEntry(rid, {
        anreise: newStart,
        ...(newEnd ? { abreise: newEnd } : {}),
        ...(newGroup ? { platz: newGroup } : {}),
      });
      const enriched = enrichedBuchungen.find(e => e.record_id === rid);
      undoToast(
        tx`${enriched?.hundName ?? ''} — verschoben`,
        async () => {
          setBuchungen(prev);
          const original = prev.find(b => b.record_id === rid);
          if (original) {
            await LivingAppsService.updateBuchungenEntry(rid, {
              anreise: original.fields.anreise,
              abreise: original.fields.abreise,
              platz: lookupKey(original.fields.platz),
            });
          }
        }
      );
    } catch {
      setBuchungen(prev);
      fetchAll();
    }
  }, [buchungen, setBuchungen, enrichedBuchungen, fetchAll]);

  // Resize: Abreise anpassen
  const handleEventResize = useCallback(async (id: string, newStart: string, newEnd: string) => {
    const rid = id.split(':')[1] ?? '';
    if (!rid) return;
    const prev = [...buchungen];
    setBuchungen(prev.map(b =>
      b.record_id === rid
        ? { ...b, fields: { ...b.fields, anreise: newStart, abreise: newEnd } }
        : b
    ));
    try {
      await LivingAppsService.updateBuchungenEntry(rid, { anreise: newStart, abreise: newEnd });
    } catch {
      setBuchungen(prev);
      fetchAll();
    }
  }, [buchungen, setBuchungen, fetchAll]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // Kontext-Zeile
  const anreisenNamen = anreisenHeute.map(b => b.hundName || b.besitzerName || '');
  const abreisenNamen = abreisenHeute.map(b => b.hundName || b.besitzerName || '');

  let kontextZeile: string;
  if (buchungen.length === 0) {
    kontextZeile = tx('Richte deine Hundepension ein — lege die erste Buchung an.');
  } else if (anreisenHeute.length > 0 && abreisenHeute.length > 0) {
    kontextZeile = `${tx('Heute reisen an:')} ${namen(anreisenNamen)} · ${tx('Abreise:')} ${namen(abreisenNamen)}`;
  } else if (anreisenHeute.length > 0) {
    kontextZeile = `${tx('Heute reist an:')} ${namen(anreisenNamen)}`;
  } else if (abreisenHeute.length > 0) {
    kontextZeile = `${tx('Heute reist ab:')} ${namen(abreisenNamen)}`;
  } else {
    kontextZeile = aktuellAnwesend.length > 0
      ? tx`${String(aktuellAnwesend.length)} Hunde sind gerade bei euch — alles ruhig heute.`
      : tx('Heute keine An- oder Abreisen geplant.');
  }

  // Offene Anfragen → Hero
  const erstesOffeneAnfrage = offeneAnfragen[0];

  return (
    <div className="space-y-6">
      {/* Seitenheader */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground truncate">
            {gruss(clock)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground truncate max-w-xl">{kontextZeile}</p>
        </div>
        <button
          onClick={() => crud.buchungen.openCreate({ anreise: todayKey })}
          className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
        >
          <IconPaw size={16} className="shrink-0" />
          {tx('Neue Buchung')}
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={
          erstesOffeneAnfrage ? (
            <HeroBanner
              icon={<IconBell size={18} />}
              action={{
                label: tx('Jetzt bestätigen'),
                onClick: () => bestaetigeAnfrage(erstesOffeneAnfrage.record_id),
              }}
            >
              {offeneAnfragen.length === 1 ? (
                <span>
                  <b>{erstesOffeneAnfrage.fields.anfrage_vorname} {erstesOffeneAnfrage.fields.anfrage_nachname}</b>
                  {' '}{tx('hat eine Buchungsanfrage gestellt')}
                  {erstesOffeneAnfrage.fields.wunsch_anreise
                    ? ` — ${tx('Wunschanreise:')} ${formatDate(erstesOffeneAnfrage.fields.wunsch_anreise)}`
                    : ''
                  }.
                </span>
              ) : (
                <span>
                  <b>{offeneAnfragen.length} {tx('offene Buchungsanfragen')}</b>
                  {' '}{tx('warten auf deine Antwort.')}
                </span>
              )}
            </HeroBanner>
          ) : undefined
        }
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Anwesend')}
              value={`${aktuellAnwesend.length} / 12`}
              icon={<IconBed size={16} />}
              tone={aktuellAnwesend.length >= 10 ? 'warning' : aktuellAnwesend.length > 0 ? 'success' : 'default'}
              onClick={() => setFilter(f => f === 'anwesend' ? null : 'anwesend')}
              active={filter === 'anwesend'}
            />
            <StatStripItem
              title={tx('Freie Plätze')}
              value={String(freieplaetze)}
              icon={<IconCalendar size={16} />}
              tone={freieplaetze === 0 ? 'warning' : 'default'}
            />
            <StatStripItem
              title={tx('Anreisen heute')}
              value={String(anreisenHeute.length)}
              icon={<IconDoorEnter size={16} />}
              tone={anreisenHeute.length > 0 ? 'primary' : 'default'}
              onClick={() => setFilter(f => f === 'anreise' ? null : 'anreise')}
              active={filter === 'anreise'}
            />
            <StatStripItem
              title={tx('Abreisen heute')}
              value={String(abreisenHeute.length)}
              icon={<IconDoorExit size={16} />}
              tone={abreisenHeute.length > 0 ? 'primary' : 'default'}
              onClick={() => setFilter(f => f === 'abreise' ? null : 'abreise')}
              active={filter === 'abreise'}
            />
            <StatStripItem
              title={tx('Offene Anfragen')}
              value={String(offeneAnfragen.length)}
              icon={<IconBell size={16} />}
              tone={offeneAnfragen.length > 0 ? 'warning' : 'default'}
            />
          </StatStrip>
        }
        primary={
          <ResourceTimeline
            events={events}
            groups={groups}
            axis="day"
            defaultRange="2weeks"
            locale={dateFnsLocale()}
            onEventClick={ev => {
              const rid = ev.id.split(':')[1] ?? '';
              const b = buchungen.find(x => x.record_id === rid);
              if (b) crud.buchungen.openDetail(b);
            }}
            onEventDrop={handleEventDrop}
            onEventResize={handleEventResize}
            onEmptyClick={(date, group) => {
              crud.buchungen.openCreate({
                anreise: format(date, 'yyyy-MM-dd'),
                ...(group ? { platz: group } : {}),
              });
            }}
            onRangeCreate={(start, end, group) => {
              crud.buchungen.openCreate({
                anreise: format(start, 'yyyy-MM-dd'),
                abreise: format(end, 'yyyy-MM-dd'),
                ...(group ? { platz: group } : {}),
              });
            }}
            renderGroupHeader={group => {
              const anzahl = aktuellAnwesend.filter(
                b => lookupKey(b.fields.platz) === group.key
              ).length;
              return (
                <div className="flex w-full items-center justify-between gap-1.5 min-w-0">
                  <span className="truncate text-sm font-medium text-foreground">{group.label}</span>
                  {anzahl > 0 && (
                    <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 tabular-nums">
                      {tx('belegt')}
                    </span>
                  )}
                </div>
              );
            }}
          />
        }
        aside={
          <>
            {/* Anreisen heute */}
            <WorkList
              title={tx('Anreisen heute')}
              items={anreisenHeute.map(b => ({
                id: b.record_id,
                title: b.hundName || b.besitzerName || tx('Hund'),
                secondLine: (
                  <>
                    <span className="text-muted-foreground">{b.besitzerName}</span>
                    {b.fields.platz && (
                      <span className="text-muted-foreground"> · {b.fields.platz.label}</span>
                    )}
                    {' · '}
                    {lookupKey(b.fields.status) === 'anwesend' ? (
                      <span className="font-medium text-emerald-600">{tx('Eingecheckt')}</span>
                    ) : (
                      <span className="font-medium text-amber-600">{tx('Erwartet')}</span>
                    )}
                  </>
                ),
                action: lookupKey(b.fields.status) !== 'anwesend' ? {
                  label: tx('Check-in'),
                  onClick: () => checkIn(b.record_id),
                } : undefined,
              }))}
              onItemClick={id => {
                const b = buchungen.find(x => x.record_id === id);
                if (b) crud.buchungen.openDetail(b);
              }}
              empty={{
                text: tx('Heute keine Anreisen geplant.'),
                action: {
                  label: tx('Buchung anlegen'),
                  onClick: () => crud.buchungen.openCreate({ anreise: todayKey }),
                },
              }}
            />

            {/* Abreisen & offene Anfragen */}
            <WorkList
              title={offeneAnfragen.length > 0 ? tx('Offene Anfragen') : tx('Abreisen heute')}
              items={offeneAnfragen.length > 0
                ? offeneAnfragen.map(a => ({
                    id: a.record_id,
                    title: `${a.fields.hund_name ?? tx('Hund')} (${a.fields.anfrage_vorname ?? ''} ${a.fields.anfrage_nachname ?? ''})`,
                    secondLine: (
                      <>
                        <span className="font-medium text-amber-600">{tx('Offen')}</span>
                        {a.fields.wunsch_anreise && (
                          <span className="text-muted-foreground"> · {formatDate(a.fields.wunsch_anreise)}</span>
                        )}
                      </>
                    ),
                    action: {
                      label: tx('Bestätigen'),
                      onClick: () => bestaetigeAnfrage(a.record_id),
                    },
                  }))
                : abreisenHeute.map(b => ({
                    id: b.record_id,
                    title: b.hundName || b.besitzerName || tx('Hund'),
                    secondLine: (
                      <>
                        <span className="text-muted-foreground">{b.besitzerName}</span>
                        {' · '}
                        {lookupKey(b.fields.status) === 'abgereist' ? (
                          <span className="font-medium text-muted-foreground">{tx('Ausgecheckt')}</span>
                        ) : (
                          <span className="font-medium text-blue-600">{tx('Abreise heute')}</span>
                        )}
                      </>
                    ),
                    action: lookupKey(b.fields.status) === 'anwesend' ? {
                      label: tx('Check-out'),
                      onClick: () => checkOut(b.record_id),
                    } : undefined,
                  }))
              }
              onItemClick={id => {
                if (offeneAnfragen.length > 0) {
                  const a = buchungsanfragen.find(x => x.record_id === id);
                  if (a) crud.buchungsanfragen.openDetail(a);
                } else {
                  const b = buchungen.find(x => x.record_id === id);
                  if (b) crud.buchungen.openDetail(b);
                }
              }}
              empty={{
                text: offeneAnfragen.length > 0
                  ? tx('Keine offenen Anfragen — alles bestätigt!')
                  : tx('Heute keine Abreisen geplant.'),
              }}
            />
          </>
        }
      />

      {crud.surfaces}
    </div>
  );
}
