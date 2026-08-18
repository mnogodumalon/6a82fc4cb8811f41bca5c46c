import { useMemo, useState, useCallback } from 'react';
import { format, parseISO, isToday, isBefore, startOfDay, isAfter } from 'date-fns';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { HeroBanner } from '@/components/HeroBanner';
import { WorkList } from '@/components/WorkList';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { ResourceTimeline, type ResourceEvent, type ResourceGroup } from '@/components/widgets/ResourceTimeline';
import { tx, appLabel, dateFnsLocale } from '@/i18n';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { lookupOption, LOOKUP_OPTIONS } from '@/types/app';
import { lookupKey } from '@/lib/formatters';
import { LivingAppsService } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { IconCalendar, IconDog, IconClipboardList, IconStar, IconArrowRight } from '@tabler/icons-react';

function statusTone(key: string | undefined): 'success' | 'primary' | 'default' | 'warning' {
  if (key === 'anwesend') return 'success';
  if (key === 'geplant') return 'primary';
  if (key === 'abgereist') return 'default';
  return 'warning';
}

export default function DashboardOverview() {
  const data = useDashboardData();
  const {
    buchungen, setBuchungen, buchungsanfragen, setBuchungsanfragen,
    hunde, besitzer,
    hundeMap, besitzerMap,
    loading, error, fetchAll,
  } = data;

  const clock = useClock();
  const [anfragenFilter, setAnfragenFilter] = useState(false);

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'buchungsanfragen') {
        const status = top.record.fields.anfrage_status?.key;
        if (status === 'offen') {
          return {
            label: tx('Buchung bestätigen'),
            onClick: async () => {
              const snap = top.record.fields.anfrage_status;
              setBuchungsanfragen(prev => prev.map(r =>
                r.record_id === top.record.record_id
                  ? { ...r, fields: { ...r.fields, anfrage_status: lookupOption('buchungsanfragen', 'anfrage_status', 'bestaetigt') } }
                  : r
              ));
              undoToast(
                tx`${top.record.fields.anfrage_vorname ?? ''} — Anfrage bestätigt`,
                async () => {
                  setBuchungsanfragen(prev => prev.map(r =>
                    r.record_id === top.record.record_id
                      ? { ...r, fields: { ...r.fields, anfrage_status: snap } }
                      : r
                  ));
                  await LivingAppsService.updateBuchungsanfragenEntry(top.record.record_id, { anfrage_status: snap?.key });
                }
              );
              try {
                await LivingAppsService.updateBuchungsanfragenEntry(top.record.record_id, { anfrage_status: 'bestaetigt' });
              } catch {
                await fetchAll();
              }
            },
          };
        }
      }
      if (top.type === 'buchungen') {
        const status = top.record.fields.status?.key;
        if (status === 'geplant') {
          return {
            label: tx('Check-in bestätigen'),
            onClick: async () => {
              const snap = top.record.fields.status;
              setBuchungen(prev => prev.map(r =>
                r.record_id === top.record.record_id
                  ? { ...r, fields: { ...r.fields, status: lookupOption('buchungen', 'status', 'anwesend') } }
                  : r
              ));
              undoToast(
                tx`Check-in bestätigt`,
                async () => {
                  setBuchungen(prev => prev.map(r =>
                    r.record_id === top.record.record_id
                      ? { ...r, fields: { ...r.fields, status: snap } }
                      : r
                  ));
                  await LivingAppsService.updateBuchungenEntry(top.record.record_id, { status: snap?.key });
                }
              );
              try {
                await LivingAppsService.updateBuchungenEntry(top.record.record_id, { status: 'anwesend' });
              } catch {
                await fetchAll();
              }
            },
          };
        }
        if (status === 'anwesend') {
          return {
            label: tx('Check-out bestätigen'),
            onClick: async () => {
              const snap = top.record.fields.status;
              setBuchungen(prev => prev.map(r =>
                r.record_id === top.record.record_id
                  ? { ...r, fields: { ...r.fields, status: lookupOption('buchungen', 'status', 'abgereist') } }
                  : r
              ));
              undoToast(
                tx`Check-out bestätigt`,
                async () => {
                  setBuchungen(prev => prev.map(r =>
                    r.record_id === top.record.record_id
                      ? { ...r, fields: { ...r.fields, status: snap } }
                      : r
                  ));
                  await LivingAppsService.updateBuchungenEntry(top.record.record_id, { status: snap?.key });
                }
              );
              try {
                await LivingAppsService.updateBuchungenEntry(top.record.record_id, { status: 'abgereist' });
              } catch {
                await fetchAll();
              }
            },
          };
        }
      }
      return undefined;
    },
  });

  const enrichedBuchungen = crud.enriched.buchungen;

  const todayKey = useMemo(() => format(clock, 'yyyy-MM-dd'), [clock]);

  // Platz-Gruppen für den Belegungsplan (statisches Lookup)
  const platzGroups = useMemo<ResourceGroup[]>(() => {
    const opts = LOOKUP_OPTIONS['buchungen']?.['platz'] ?? [];
    return opts.map(o => ({ key: o.key, label: o.label }));
  }, []);

  // Buchungen → ResourceEvents (nur aktive, nicht storniert)
  const events = useMemo<ResourceEvent[]>(() => {
    return enrichedBuchungen
      .filter(b => b.fields.anreise && b.fields.platz && b.fields.status?.key !== 'storniert')
      .map(b => ({
        id: `buchung:${b.record_id}`,
        start: b.fields.anreise!,
        end: b.fields.abreise,
        allDay: true,
        title: b.hundName || b.fields.hund || tx('Hund'),
        subtitle: b.besitzerName,
        tone: statusTone(b.fields.status?.key),
        group: lookupKey(b.fields.platz) ?? '',
      }));
  }, [enrichedBuchungen]);

  // KPI-Derivate
  const heute = useMemo(() => startOfDay(clock), [clock]);
  const aktiveHeute = useMemo(() =>
    enrichedBuchungen.filter(b => {
      const s = b.fields.status?.key;
      return s === 'anwesend';
    }), [enrichedBuchungen]);
  const anreisenHeute = useMemo(() =>
    enrichedBuchungen.filter(b =>
      b.fields.anreise === todayKey && b.fields.status?.key === 'geplant'
    ), [enrichedBuchungen, todayKey]);
  const abreisenHeute = useMemo(() =>
    enrichedBuchungen.filter(b =>
      b.fields.abreise === todayKey && b.fields.status?.key === 'anwesend'
    ), [enrichedBuchungen, todayKey]);
  const offeneAnfragen = useMemo(() =>
    buchungsanfragen.filter(a => a.fields.anfrage_status?.key === 'offen'),
    [buchungsanfragen]);

  // Advance-Helper: eine Buchungsanfrage bestätigen + Buchung anlegen
  const bestaetigeAnfrage = useCallback(async (anfrage: typeof buchungsanfragen[0]) => {
    const snap = anfrage.fields.anfrage_status;
    setBuchungsanfragen(prev => prev.map(r =>
      r.record_id === anfrage.record_id
        ? { ...r, fields: { ...r.fields, anfrage_status: lookupOption('buchungsanfragen', 'anfrage_status', 'bestaetigt') } }
        : r
    ));
    undoToast(
      tx`${anfrage.fields.anfrage_vorname ?? ''} — Anfrage bestätigt`,
      async () => {
        setBuchungsanfragen(prev => prev.map(r =>
          r.record_id === anfrage.record_id
            ? { ...r, fields: { ...r.fields, anfrage_status: snap } }
            : r
        ));
        await LivingAppsService.updateBuchungsanfragenEntry(anfrage.record_id, { anfrage_status: snap?.key });
      }
    );
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(anfrage.record_id, { anfrage_status: 'bestaetigt' });
    } catch {
      await fetchAll();
    }
  }, [setBuchungsanfragen, fetchAll]);

  // Drag-Drop: Platz- oder Datumswechsel
  const handleEventDrop = useCallback(async (
    id: string,
    newStart: string,
    newEnd?: string,
    newGroup?: string,
  ) => {
    const buchungId = id.split(':')[1] ?? '';
    const buchung = buchungen.find(b => b.record_id === buchungId);
    if (!buchung) return;

    // Kapazitätscheck: Platz bereits belegt?
    if (newGroup) {
      const conflict = enrichedBuchungen.find(b =>
        b.record_id !== buchungId &&
        lookupKey(b.fields.platz) === newGroup &&
        b.fields.status?.key !== 'storniert' &&
        b.fields.anreise && b.fields.abreise &&
        b.fields.anreise < (newEnd ?? newStart) &&
        b.fields.abreise > newStart
      );
      if (conflict) {
        return tx`${newGroup.replace('platz_', 'Platz ')} ist in diesem Zeitraum bereits belegt`;
      }
    }

    const snapAnreise = buchung.fields.anreise;
    const snapAbreise = buchung.fields.abreise;
    const snapPlatz = buchung.fields.platz;
    const newPlatzKey = newGroup ?? lookupKey(buchung.fields.platz);

    setBuchungen(prev => prev.map(b =>
      b.record_id === buchungId
        ? {
          ...b,
          fields: {
            ...b.fields,
            anreise: newStart,
            abreise: newEnd ?? b.fields.abreise,
            platz: newPlatzKey ? lookupOption('buchungen', 'platz', newPlatzKey) : b.fields.platz,
          },
        }
        : b
    ));
    undoToast(
      tx`Buchung verschoben`,
      async () => {
        setBuchungen(prev => prev.map(b =>
          b.record_id === buchungId
            ? { ...b, fields: { ...b.fields, anreise: snapAnreise, abreise: snapAbreise, platz: snapPlatz } }
            : b
        ));
        await LivingAppsService.updateBuchungenEntry(buchungId, {
          anreise: snapAnreise,
          abreise: snapAbreise,
          platz: snapPlatz?.key,
        });
      }
    );
    try {
      await LivingAppsService.updateBuchungenEntry(buchungId, {
        anreise: newStart,
        abreise: newEnd ?? buchung.fields.abreise,
        platz: newPlatzKey,
      });
    } catch {
      await fetchAll();
    }
  }, [buchungen, enrichedBuchungen, setBuchungen, fetchAll]);

  const handleEventResize = useCallback(async (
    id: string,
    newStart: string,
    newEnd: string,
  ) => {
    const buchungId = id.split(':')[1] ?? '';
    const buchung = buchungen.find(b => b.record_id === buchungId);
    if (!buchung) return;
    const snapAnreise = buchung.fields.anreise;
    const snapAbreise = buchung.fields.abreise;
    setBuchungen(prev => prev.map(b =>
      b.record_id === buchungId
        ? { ...b, fields: { ...b.fields, anreise: newStart, abreise: newEnd } }
        : b
    ));
    undoToast(
      tx`Aufenthaltsdauer geändert`,
      async () => {
        setBuchungen(prev => prev.map(b =>
          b.record_id === buchungId
            ? { ...b, fields: { ...b.fields, anreise: snapAnreise, abreise: snapAbreise } }
            : b
        ));
        await LivingAppsService.updateBuchungenEntry(buchungId, { anreise: snapAnreise, abreise: snapAbreise });
      }
    );
    try {
      await LivingAppsService.updateBuchungenEntry(buchungId, { anreise: newStart, abreise: newEnd });
    } catch {
      await fetchAll();
    }
  }, [buchungen, setBuchungen, fetchAll]);

  // Neue Buchung per Klick/Drag im Plan
  const handleRangeCreate = useCallback((start: Date, end: Date, group?: string) => {
    crud.buchungen.openCreate({
      anreise: format(start, 'yyyy-MM-dd'),
      abreise: format(end, 'yyyy-MM-dd'),
      platz: group,
    });
  }, [crud.buchungen]);

  const handleEmptyClick = useCallback((date: Date, group?: string) => {
    crud.buchungen.openCreate({
      anreise: format(date, 'yyyy-MM-dd'),
      platz: group,
    });
  }, [crud.buchungen]);

  // ─── Hooks done — only derivations below ───
  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  const belegtHeute = aktiveHeute.length;
  const freieHeute = 12 - belegtHeute;
  const kontextNamen = anreisenHeute.length > 0
    ? namen(anreisenHeute.map(b => b.hundName))
    : abreisenHeute.length > 0
    ? namen(abreisenHeute.map(b => b.hundName))
    : aktiveHeute.length > 0
    ? namen(aktiveHeute.slice(0, 3).map(b => b.hundName))
    : null;

  const kontextSatz = anreisenHeute.length > 0 && abreisenHeute.length > 0
    ? tx`${kontextNamen} reist heute an — ${namen(abreisenHeute.map(b => b.hundName))} reist ab.`
    : anreisenHeute.length > 0
    ? tx`${kontextNamen} ${anreisenHeute.length === 1 ? tx('kommt heute an') : tx('kommen heute an')}.`
    : abreisenHeute.length > 0
    ? tx`${kontextNamen} ${abreisenHeute.length === 1 ? tx('reist heute ab') : tx('reisen heute ab')}.`
    : belegtHeute > 0
    ? tx`${String(belegtHeute)} ${belegtHeute === 1 ? tx('Hund ist gerade bei dir') : tx('Hunde sind gerade bei dir')}.`
    : tx('Heute sind noch alle Plätze frei.');

  const ersteOffeneAnfrage = offeneAnfragen[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{gruss(clock)}</h1>
          <p className="text-muted-foreground mt-0.5">{kontextSatz}</p>
        </div>
        <button
          onClick={() => crud.buchungen.openCreate({})}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shrink-0 self-start sm:self-auto"
        >
          <IconCalendar size={16} className="shrink-0" />
          {tx('Neue Buchung')}
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={ersteOffeneAnfrage && (
          <HeroBanner
            icon={<IconClipboardList size={18} />}
            action={{
              label: tx('Anfrage bestätigen'),
              onClick: () => bestaetigeAnfrage(ersteOffeneAnfrage),
            }}
          >
            <b>{namen([`${ersteOffeneAnfrage.fields.anfrage_vorname ?? ''} ${ersteOffeneAnfrage.fields.anfrage_nachname ?? ''}`.trim()])}</b>
            {' '}{tx('fragt einen Aufenthalt für')}{' '}
            <b>{ersteOffeneAnfrage.fields.hund_name ?? tx('Hund')}</b>
            {ersteOffeneAnfrage.fields.wunsch_anreise
              ? <>{' '}{tx('vom')}{' '}{formatDate(ersteOffeneAnfrage.fields.wunsch_anreise)}{ersteOffeneAnfrage.fields.wunsch_abreise ? <>{' '}{tx('bis')}{' '}{formatDate(ersteOffeneAnfrage.fields.wunsch_abreise)}</> : null}{' '}{tx('an.')}</>
              : null}
            {offeneAnfragen.length > 1 && <>{' '}<span className="text-muted-foreground text-sm">({offeneAnfragen.length - 1} {tx('weitere')})</span></>}
          </HeroBanner>
        )}
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Belegt heute')}
              value={`${belegtHeute}/12`}
              icon={<IconDog size={16} className="shrink-0" />}
              tone={belegtHeute >= 10 ? 'warning' : belegtHeute > 0 ? 'success' : 'default'}
            />
            <StatStripItem
              title={tx('Frei heute')}
              value={String(freieHeute)}
              icon={<IconCalendar size={16} className="shrink-0" />}
              tone={freieHeute === 0 ? 'destructive' : 'default'}
            />
            <StatStripItem
              title={tx('Anreisen heute')}
              value={String(anreisenHeute.length)}
              icon={<IconArrowRight size={16} className="shrink-0" />}
              tone={anreisenHeute.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title={tx('Offene Anfragen')}
              value={String(offeneAnfragen.length)}
              icon={<IconClipboardList size={16} className="shrink-0" />}
              tone={offeneAnfragen.length > 0 ? 'warning' : 'default'}
              onClick={() => setAnfragenFilter(f => !f)}
              active={anfragenFilter}
            />
          </StatStrip>
        }
        primary={
          <ResourceTimeline
            axis="day"
            events={events}
            groups={platzGroups}
            defaultRange="2weeks"
            locale={dateFnsLocale()}
            onEventClick={(ev) => {
              const buchungId = ev.id.split(':')[1] ?? '';
              const buchung = buchungen.find(b => b.record_id === buchungId);
              if (buchung) crud.buchungen.openDetail(buchung);
            }}
            onEventDrop={handleEventDrop}
            onEventResize={handleEventResize}
            onRangeCreate={handleRangeCreate}
            onEmptyClick={handleEmptyClick}
          />
        }
        aside={
          <>
            <WorkList
              title={tx('Heute')}
              items={[
                ...anreisenHeute.map(b => ({
                  id: `an:${b.record_id}`,
                  title: b.hundName || tx('Hund'),
                  secondLine: (
                    <>
                      <span className="font-medium text-primary">{tx('Anreise')}</span>
                      <span className="text-muted-foreground"> · {b.besitzerName || tx('Besitzer unbekannt')}</span>
                    </>
                  ),
                  action: {
                    label: tx('Check-in'),
                    onClick: async () => {
                      const snap = b.fields.status;
                      setBuchungen(prev => prev.map(r =>
                        r.record_id === b.record_id
                          ? { ...r, fields: { ...r.fields, status: lookupOption('buchungen', 'status', 'anwesend') } }
                          : r
                      ));
                      undoToast(tx`Check-in bestätigt`, async () => {
                        setBuchungen(prev => prev.map(r =>
                          r.record_id === b.record_id
                            ? { ...r, fields: { ...r.fields, status: snap } }
                            : r
                        ));
                        await LivingAppsService.updateBuchungenEntry(b.record_id, { status: snap?.key });
                      });
                      try {
                        await LivingAppsService.updateBuchungenEntry(b.record_id, { status: 'anwesend' });
                      } catch { await fetchAll(); }
                    },
                  },
                })),
                ...abreisenHeute.map(b => ({
                  id: `ab:${b.record_id}`,
                  title: b.hundName || tx('Hund'),
                  secondLine: (
                    <>
                      <span className="font-medium text-amber-600">{tx('Abreise')}</span>
                      <span className="text-muted-foreground"> · {b.besitzerName || tx('Besitzer unbekannt')}</span>
                    </>
                  ),
                  action: {
                    label: tx('Check-out'),
                    onClick: async () => {
                      const snap = b.fields.status;
                      setBuchungen(prev => prev.map(r =>
                        r.record_id === b.record_id
                          ? { ...r, fields: { ...r.fields, status: lookupOption('buchungen', 'status', 'abgereist') } }
                          : r
                      ));
                      undoToast(tx`Check-out bestätigt`, async () => {
                        setBuchungen(prev => prev.map(r =>
                          r.record_id === b.record_id
                            ? { ...r, fields: { ...r.fields, status: snap } }
                            : r
                        ));
                        await LivingAppsService.updateBuchungenEntry(b.record_id, { status: snap?.key });
                      });
                      try {
                        await LivingAppsService.updateBuchungenEntry(b.record_id, { status: 'abgereist' });
                      } catch { await fetchAll(); }
                    },
                  },
                })),
              ]}
              onItemClick={(id) => {
                const buchungId = id.replace(/^(an|ab):/, '');
                const buchung = buchungen.find(b => b.record_id === buchungId);
                if (buchung) crud.buchungen.openDetail(buchung);
              }}
              max={8}
              empty={{
                text: tx('Heute keine An- oder Abreisen — schöner ruhiger Tag!'),
                action: { label: tx('Neue Buchung'), onClick: () => crud.buchungen.openCreate({}) },
              }}
            />

            <WorkList
              title={tx('Offene Anfragen')}
              items={(anfragenFilter ? offeneAnfragen : offeneAnfragen.slice(0, 5)).map(a => ({
                id: a.record_id,
                title: `${a.fields.anfrage_vorname ?? ''} ${a.fields.anfrage_nachname ?? ''}`.trim() || tx('Interessent'),
                secondLine: (
                  <>
                    <span className="font-medium text-amber-600">{a.fields.hund_name ?? tx('Hund')}</span>
                    {a.fields.wunsch_anreise && (
                      <span className="text-muted-foreground"> · {formatDate(a.fields.wunsch_anreise)}</span>
                    )}
                  </>
                ),
                action: {
                  label: tx('Bestätigen'),
                  onClick: () => bestaetigeAnfrage(a),
                },
              }))}
              onItemClick={(id) => {
                const anfrage = buchungsanfragen.find(a => a.record_id === id);
                if (anfrage) crud.buchungsanfragen.openDetail(anfrage);
              }}
              max={6}
              empty={{
                text: tx('Keine offenen Buchungsanfragen.'),
                action: { label: tx('Anfrage manuell erfassen'), onClick: () => crud.buchungsanfragen.openCreate({}) },
              }}
            />
          </>
        }
      />

      {crud.surfaces}
    </div>
  );
}
