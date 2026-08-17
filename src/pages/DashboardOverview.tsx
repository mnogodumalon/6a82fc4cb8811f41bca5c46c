import { useDashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { ResourceTimeline, type ResourceEvent, type ResourceGroup } from '@/components/widgets/ResourceTimeline';
import { useState, useMemo, useCallback } from 'react';
import { format, parseISO, isToday, isBefore, isAfter } from 'date-fns';
import { dateFnsLocale } from '@/i18n';
import { tx, appLabel } from '@/i18n';
import { LOOKUP_OPTIONS, lookupOption } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { formatDate, lookupKey } from '@/lib/formatters';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import {
  IconDog,
  IconCalendar,
  IconClockHour4,
  IconAlertTriangle,
  IconPaw,
  IconInbox,
  IconCheck,
  IconX,
} from '@tabler/icons-react';

export default function DashboardOverview() {
  const data = useDashboardData();
  const {
    buchungen, setBuchungen,
    buchungsanfragen, setBuchungsanfragen,
    besitzerMap, hundeMap,
    loading, error, fetchAll,
  } = data;

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'buchungsanfragen') {
        const r = top.record;
        const statusKey = lookupKey(r.fields.anfrage_status);
        if (statusKey === 'offen') {
          return {
            label: tx('Buchungsanfrage bestätigen'),
            onClick: () => bestaetigenAnfrage(r),
          };
        }
      }
      if (top.type === 'buchungen') {
        const r = top.record;
        const statusKey = lookupKey(r.fields.status);
        if (statusKey === 'geplant') {
          return {
            label: tx('Check-in durchführen'),
            onClick: () => checkIn(r),
          };
        }
        if (statusKey === 'anwesend') {
          return {
            label: tx('Check-out durchführen'),
            onClick: () => checkOut(r),
          };
        }
      }
      return undefined;
    },
  });

  const enrichedBuchungen = crud.enriched.buchungen;
  const enrichedHunde = crud.enriched.hunde;

  const clock = useClock();

  // All hooks above early returns
  const platzOptions = useMemo(() => LOOKUP_OPTIONS['buchungen']?.['platz'] ?? [], []);

  const groups = useMemo<ResourceGroup[]>(
    () => platzOptions.map(p => ({ key: p.key, label: p.label })),
    [platzOptions],
  );

  const events = useMemo<ResourceEvent[]>(() => {
    return enrichedBuchungen
      .filter(b => b.fields.anreise && b.fields.platz && lookupKey(b.fields.status) !== 'storniert')
      .map(b => {
        const statusK = lookupKey(b.fields.status);
        const tone = statusK === 'anwesend' ? 'success'
          : statusK === 'abgereist' ? 'default'
          : 'primary';
        return {
          id: `buchung:${b.record_id}`,
          start: b.fields.anreise!,
          end: b.fields.abreise,
          allDay: true,
          title: b.hundName || b.besitzerName || tx('Unbekannt'),
          subtitle: b.besitzerName || undefined,
          tone: tone as 'success' | 'default' | 'primary',
          group: lookupKey(b.fields.platz) ?? '',
        };
      });
  }, [enrichedBuchungen]);

  const today = format(clock, 'yyyy-MM-dd');

  const heuteAnreise = useMemo(
    () => enrichedBuchungen.filter(b => b.fields.anreise === today && lookupKey(b.fields.status) === 'geplant'),
    [enrichedBuchungen, today],
  );

  const heuteAbreise = useMemo(
    () => enrichedBuchungen.filter(b => b.fields.abreise === today && lookupKey(b.fields.status) === 'anwesend'),
    [enrichedBuchungen, today],
  );

  const aktuellAnwesend = useMemo(
    () => enrichedBuchungen.filter(b => lookupKey(b.fields.status) === 'anwesend'),
    [enrichedBuchungen],
  );

  const offeneAnfragen = useMemo(
    () => buchungsanfragen.filter(a => lookupKey(a.fields.anfrage_status) === 'offen'),
    [buchungsanfragen],
  );

  const belegtHeute = useMemo(() => {
    return buchungen.filter(b => {
      const statusK = lookupKey(b.fields.status);
      if (statusK === 'storniert' || statusK === 'abgereist') return false;
      if (!b.fields.anreise) return false;
      const an = b.fields.anreise;
      const ab = b.fields.abreise ?? today;
      return an <= today && ab >= today;
    }).length;
  }, [buchungen, today]);

  // Check-in helper
  const checkIn = useCallback(async (b: typeof enrichedBuchungen[0]) => {
    const prev = lookupKey(b.fields.status);
    setBuchungen(all => all.map(x => x.record_id === b.record_id
      ? { ...x, fields: { ...x.fields, status: lookupOption('buchungen', 'status', 'anwesend') } }
      : x));
    try {
      await LivingAppsService.updateBuchungenEntry(b.record_id, { status: 'anwesend' });
      undoToast(tx`${b.hundName} — eingecheckt`, async () => {
        setBuchungen(all => all.map(x => x.record_id === b.record_id
          ? { ...x, fields: { ...x.fields, status: lookupOption('buchungen', 'status', prev ?? 'geplant') } }
          : x));
        await LivingAppsService.updateBuchungenEntry(b.record_id, { status: prev ?? 'geplant' });
      });
    } catch {
      await fetchAll();
    }
  }, [setBuchungen, fetchAll]);

  // Check-out helper
  const checkOut = useCallback(async (b: typeof enrichedBuchungen[0]) => {
    setBuchungen(all => all.map(x => x.record_id === b.record_id
      ? { ...x, fields: { ...x.fields, status: lookupOption('buchungen', 'status', 'abgereist') } }
      : x));
    try {
      await LivingAppsService.updateBuchungenEntry(b.record_id, { status: 'abgereist' });
      undoToast(tx`${b.hundName} — ausgecheckt`, async () => {
        setBuchungen(all => all.map(x => x.record_id === b.record_id
          ? { ...x, fields: { ...x.fields, status: lookupOption('buchungen', 'status', 'anwesend') } }
          : x));
        await LivingAppsService.updateBuchungenEntry(b.record_id, { status: 'anwesend' });
      });
    } catch {
      await fetchAll();
    }
  }, [setBuchungen, fetchAll]);

  // Anfrage bestätigen helper
  const bestaetigenAnfrage = useCallback(async (a: typeof buchungsanfragen[0]) => {
    setBuchungsanfragen(all => all.map(x => x.record_id === a.record_id
      ? { ...x, fields: { ...x.fields, anfrage_status: lookupOption('buchungsanfragen', 'anfrage_status', 'bestaetigt') } }
      : x));
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(a.record_id, { anfrage_status: 'bestaetigt' });
      undoToast(
        tx`${a.fields.anfrage_vorname ?? ''} ${a.fields.anfrage_nachname ?? ''} — Anfrage bestätigt`,
        async () => {
          setBuchungsanfragen(all => all.map(x => x.record_id === a.record_id
            ? { ...x, fields: { ...x.fields, anfrage_status: lookupOption('buchungsanfragen', 'anfrage_status', 'offen') } }
            : x));
          await LivingAppsService.updateBuchungsanfragenEntry(a.record_id, { anfrage_status: 'offen' });
        },
      );
    } catch {
      await fetchAll();
    }
  }, [setBuchungsanfragen, fetchAll]);

  // Anfrage ablehnen helper
  const ablehnenAnfrage = useCallback(async (a: typeof buchungsanfragen[0]) => {
    setBuchungsanfragen(all => all.map(x => x.record_id === a.record_id
      ? { ...x, fields: { ...x.fields, anfrage_status: lookupOption('buchungsanfragen', 'anfrage_status', 'abgelehnt') } }
      : x));
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(a.record_id, { anfrage_status: 'abgelehnt' });
      undoToast(
        tx`${a.fields.anfrage_vorname ?? ''} ${a.fields.anfrage_nachname ?? ''} — Anfrage abgelehnt`,
        async () => {
          setBuchungsanfragen(all => all.map(x => x.record_id === a.record_id
            ? { ...x, fields: { ...x.fields, anfrage_status: lookupOption('buchungsanfragen', 'anfrage_status', 'offen') } }
            : x));
          await LivingAppsService.updateBuchungsanfragenEntry(a.record_id, { anfrage_status: 'offen' });
        },
      );
    } catch {
      await fetchAll();
    }
  }, [setBuchungsanfragen, fetchAll]);

  // Drag reschedule
  const reschedule = useCallback(async (id: string, newStart: string, newEnd?: string, newGroup?: string) => {
    const rid = id.split(':')[1] ?? '';
    if (!rid) return;
    const platzPatch = newGroup ? { platz: lookupOption('buchungen', 'platz', newGroup) } : {};
    setBuchungen(prev => prev.map(b =>
      b.record_id === rid
        ? { ...b, fields: { ...b.fields, anreise: newStart, ...(newEnd ? { abreise: newEnd } : {}), ...platzPatch } }
        : b,
    ));
    try {
      await LivingAppsService.updateBuchungenEntry(rid, {
        anreise: newStart,
        ...(newEnd ? { abreise: newEnd } : {}),
        ...(newGroup ? { platz: newGroup } : {}),
      });
      undoToast(tx`Buchung verschoben`);
    } catch {
      await fetchAll();
    }
  }, [setBuchungen, fetchAll]);

  const resize = useCallback(async (id: string, newStart: string, newEnd: string) => {
    const rid = id.split(':')[1] ?? '';
    if (!rid) return;
    setBuchungen(prev => prev.map(b =>
      b.record_id === rid
        ? { ...b, fields: { ...b.fields, anreise: newStart, abreise: newEnd } }
        : b,
    ));
    try {
      await LivingAppsService.updateBuchungenEntry(rid, { anreise: newStart, abreise: newEnd });
      undoToast(tx`Aufenthaltsdauer geändert`);
    } catch {
      await fetchAll();
    }
  }, [setBuchungen, fetchAll]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // Context line
  const anreisendNamen = namen(heuteAnreise.map(b => b.hundName));
  const abreisendNamen = namen(heuteAbreise.map(b => b.hundName));

  let contextLine: string;
  if (buchungen.length === 0) {
    contextLine = tx('Richte deine Pension ein — trag die erste Buchung ein.');
  } else if (heuteAnreise.length > 0 && heuteAbreise.length > 0) {
    contextLine = tx`Heute reisen ${anreisendNamen} an und ${abreisendNamen} ab.`;
  } else if (heuteAnreise.length > 0) {
    contextLine = tx`Heute reist ${anreisendNamen} an.`;
  } else if (heuteAbreise.length > 0) {
    contextLine = tx`Heute reist ${abreisendNamen} ab.`;
  } else if (aktuellAnwesend.length > 0) {
    contextLine = tx`${namen(aktuellAnwesend.map(b => b.hundName))} — aktuell zu Gast.`;
  } else {
    contextLine = tx('Derzeit sind keine Hunde anwesend.');
  }

  const ersteOffeneAnfrage = offeneAnfragen[0];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{gruss(clock)}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{contextLine}</p>
        </div>
        <button
          className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          onClick={() => crud.buchungen.openCreate({ status: 'geplant', anreise: format(clock, 'yyyy-MM-dd') })}
        >
          {tx('+ Neue Buchung')}
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={
          offeneAnfragen.length > 0 && ersteOffeneAnfrage ? (
            <HeroBanner
              icon={<IconInbox size={18} />}
              action={{
                label: tx('Jetzt bestätigen'),
                onClick: () => bestaetigenAnfrage(ersteOffeneAnfrage),
              }}
            >
              {offeneAnfragen.length === 1
                ? tx`Neue Buchungsanfrage von ${ersteOffeneAnfrage.fields.anfrage_vorname ?? ''} ${ersteOffeneAnfrage.fields.anfrage_nachname ?? ''} — ${ersteOffeneAnfrage.fields.hund_name ?? ''} soll vom ${formatDate(ersteOffeneAnfrage.fields.wunsch_anreise)} bis ${formatDate(ersteOffeneAnfrage.fields.wunsch_abreise)} bleiben.`
                : tx`${offeneAnfragen.length} neue Buchungsanfragen warten auf deine Antwort.`
              }
            </HeroBanner>
          ) : undefined
        }
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Aktuell anwesend')}
              value={aktuellAnwesend.length}
              icon={<IconDog size={16} />}
              tone={aktuellAnwesend.length > 0 ? 'success' : 'default'}
            />
            <StatStripItem
              title={tx('Heute Anreise')}
              value={heuteAnreise.length}
              icon={<IconCalendar size={16} />}
              tone={heuteAnreise.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title={tx('Heute Abreise')}
              value={heuteAbreise.length}
              icon={<IconClockHour4 size={16} />}
              tone={heuteAbreise.length > 0 ? 'warning' : 'default'}
            />
            <StatStripItem
              title={tx('Plätze belegt')}
              value={`${belegtHeute} / 12`}
              icon={<IconPaw size={16} />}
              tone={belegtHeute >= 10 ? 'destructive' : belegtHeute >= 6 ? 'warning' : 'default'}
            />
            <StatStripItem
              title={tx('Offene Anfragen')}
              value={offeneAnfragen.length}
              icon={<IconAlertTriangle size={16} />}
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
            locale={dateFnsLocale()}
            onEventClick={ev => {
              const rid = ev.id.split(':')[1] ?? '';
              const rec = buchungen.find(b => b.record_id === rid);
              if (rec) crud.buchungen.openDetail(rec);
            }}
            onEventDrop={reschedule}
            onEventResize={resize}
            onRangeCreate={(start, end, group) => {
              crud.buchungen.openCreate({
                anreise: format(start, 'yyyy-MM-dd'),
                abreise: format(end, 'yyyy-MM-dd'),
                platz: group,
                status: 'geplant',
              });
            }}
            onEmptyClick={(date, group) => {
              crud.buchungen.openCreate({
                anreise: format(date, 'yyyy-MM-dd'),
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
                  label: tx('Check-in'),
                  onClick: () => checkIn(b),
                },
              }))}
              onItemClick={id => {
                const rec = buchungen.find(b => b.record_id === id);
                if (rec) crud.buchungen.openDetail(rec);
              }}
              empty={{
                text: tx('Heute reist niemand an — alles entspannt.'),
                action: { label: tx('Buchung erstellen'), onClick: () => crud.buchungen.openCreate({ status: 'geplant', anreise: format(clock, 'yyyy-MM-dd') }) },
              }}
            />
            <WorkList
              title={tx('Heute Abreise & Anfragen')}
              items={[
                ...heuteAbreise.map(b => ({
                  id: `ab:${b.record_id}`,
                  title: b.hundName || tx('Unbekannter Hund'),
                  secondLine: (
                    <span className="font-medium text-amber-600">{tx('Heute abreisend')}</span>
                  ),
                  action: {
                    label: tx('Check-out'),
                    onClick: () => checkOut(b),
                  },
                })),
                ...offeneAnfragen.slice(0, 3).map(a => ({
                  id: `anf:${a.record_id}`,
                  title: `${a.fields.hund_name ?? tx('Hund')} (${a.fields.anfrage_vorname ?? ''} ${a.fields.anfrage_nachname ?? ''})`,
                  secondLine: (
                    <>
                      <span className="font-medium text-destructive">{tx('Anfrage offen')}</span>
                      <span className="text-muted-foreground"> · {formatDate(a.fields.wunsch_anreise)}</span>
                    </>
                  ),
                  action: {
                    label: tx('Bestätigen'),
                    onClick: () => bestaetigenAnfrage(a),
                  },
                })),
              ]}
              onItemClick={id => {
                if (id.startsWith('ab:')) {
                  const rid = id.slice(3);
                  const rec = buchungen.find(b => b.record_id === rid);
                  if (rec) crud.buchungen.openDetail(rec);
                } else if (id.startsWith('anf:')) {
                  const rid = id.slice(4);
                  const rec = buchungsanfragen.find(a => a.record_id === rid);
                  if (rec) crud.buchungsanfragen.openDetail(rec);
                }
              }}
              empty={{
                text: tx('Keine Abreisen oder offenen Anfragen heute.'),
              }}
            />
          </>
        }
      />

      {crud.surfaces}
    </div>
  );
}
