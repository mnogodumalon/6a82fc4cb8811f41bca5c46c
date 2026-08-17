import { useMemo, useState, useCallback } from 'react';
import { format, parseISO, isToday, isBefore, startOfDay } from 'date-fns';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { HeroBanner } from '@/components/HeroBanner';
import { WorkList } from '@/components/WorkList';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { ResourceTimeline, type ResourceEvent, type ResourceGroup, type ResourceTone } from '@/components/widgets/ResourceTimeline';
import { tx, appLabel, dateFnsLocale } from '@/i18n';
import { lookupOption } from '@/types/app';
import { lookupKey } from '@/lib/formatters';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { undoToast, gruss, namen, useClock } from '@/lib/polish';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { IconDog, IconCalendarPlus, IconCheck, IconX, IconStar } from '@tabler/icons-react';

// The 12 Plätze as resource axis (static lookup → LookupValue, key used as group key)
const PLAETZE_OPTIONS = LOOKUP_OPTIONS['buchungen']?.['platz'] ?? [];

function toneForBuchung(status: string | undefined): ResourceTone {
  if (status === 'anwesend') return 'success';
  if (status === 'storniert') return 'destructive';
  if (status === 'abgereist') return 'default';
  return 'primary';
}

export default function DashboardOverview() {
  const data = useDashboardData();
  const {
    besitzer, hunde, buchungen, buchungsanfragen,
    besitzerMap, hundeMap, buchungenMap,
    setBuchungen, setBuchungsanfragen,
    loading, error, fetchAll,
  } = data;

  const clock = useClock();

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'buchungsanfragen') {
        const rec = top.record;
        const status = lookupKey(rec.fields.anfrage_status);
        if (status === 'offen') {
          return {
            label: tx('Anfrage bestätigen'),
            onClick: async () => {
              const prev = [...buchungsanfragen];
              setBuchungsanfragen(bs => bs.map(b =>
                b.record_id === rec.record_id
                  ? { ...b, fields: { ...b.fields, anfrage_status: lookupOption('buchungsanfragen', 'anfrage_status', 'bestaetigt') } }
                  : b
              ));
              try {
                await LivingAppsService.updateBuchungsanfragenEntry(rec.record_id, { anfrage_status: 'bestaetigt' });
                undoToast(tx`${rec.fields.anfrage_vorname ?? ''} — Anfrage bestätigt`, async () => {
                  setBuchungsanfragen(prev);
                  await LivingAppsService.updateBuchungsanfragenEntry(rec.record_id, { anfrage_status: 'offen' });
                });
              } catch { fetchAll(); }
            },
          };
        }
      }
      return undefined;
    },
  });
  const enrichedBuchungen = crud.enriched.buchungen;
  const enrichedHunde = crud.enriched.hunde;

  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  // Today key
  const todayKey = format(clock, 'yyyy-MM-dd');

  // Derived sets
  const aktiveBuchungen = useMemo(
    () => enrichedBuchungen.filter(b => {
      const s = lookupKey(b.fields.status);
      return s !== 'storniert' && s !== 'abgereist';
    }),
    [enrichedBuchungen]
  );

  const anreisenHeute = useMemo(
    () => enrichedBuchungen.filter(b => b.fields.anreise === todayKey && lookupKey(b.fields.status) !== 'storniert'),
    [enrichedBuchungen, todayKey]
  );

  const abreisenHeute = useMemo(
    () => enrichedBuchungen.filter(b => b.fields.abreise === todayKey && lookupKey(b.fields.status) !== 'storniert'),
    [enrichedBuchungen, todayKey]
  );

  const anwesend = useMemo(
    () => enrichedBuchungen.filter(b => lookupKey(b.fields.status) === 'anwesend'),
    [enrichedBuchungen]
  );

  const offeneAnfragen = useMemo(
    () => buchungsanfragen.filter(a => lookupKey(a.fields.anfrage_status) === 'offen'),
    [buchungsanfragen]
  );

  const belegtePlaetze = useMemo(() => {
    const keys = new Set<string>();
    anwesend.forEach(b => { const k = lookupKey(b.fields.platz); if (k) keys.add(k); });
    return keys.size;
  }, [anwesend]);

  const freieplaetze = 12 - belegtePlaetze;

  // ResourceTimeline groups = Platz 1..12
  const groups = useMemo<ResourceGroup[]>(
    () => PLAETZE_OPTIONS.map(p => ({ key: p.key, label: p.label })),
    []
  );

  // Filter buchungen for display
  const displayedBuchungen = useMemo(
    () => filterStatus ? enrichedBuchungen.filter(b => lookupKey(b.fields.status) === filterStatus) : enrichedBuchungen,
    [enrichedBuchungen, filterStatus]
  );

  // ResourceTimeline events
  const events = useMemo<ResourceEvent[]>(
    () => displayedBuchungen
      .filter(b => !!b.fields.anreise && !!b.fields.platz)
      .map(b => {
        const statusKey = lookupKey(b.fields.status);
        return {
          id: `buchung:${b.record_id}`,
          start: b.fields.anreise!,
          end: b.fields.abreise,
          allDay: true,
          title: b.hundName || b.fields.hund || tx('Hund'),
          subtitle: b.besitzerName,
          tone: toneForBuchung(statusKey),
          group: lookupKey(b.fields.platz) ?? '',
        };
      }),
    [displayedBuchungen]
  );

  // Reschedule handler (drag)
  const handleEventDrop = useCallback(async (id: string, newStart: string, newEnd?: string, newGroup?: string) => {
    const rid = id.split(':')[1] ?? '';
    if (!rid) return;
    const b = buchungenMap.get(rid);
    if (!b) return;

    // Check double-booking: same platz same period
    const targetPlatz = newGroup ?? lookupKey(b.fields.platz) ?? '';
    const overlap = enrichedBuchungen.find(other => {
      if (other.record_id === rid) return false;
      const otherPlatz = lookupKey(other.fields.platz);
      if (otherPlatz !== targetPlatz) return false;
      if (lookupKey(other.fields.status) === 'storniert') return false;
      const otherStart = other.fields.anreise ?? '';
      const otherEnd = other.fields.abreise ?? otherStart;
      const newE = newEnd ?? newStart;
      return newStart <= otherEnd && newE >= otherStart;
    });
    if (overlap) return tx('Dieser Platz ist im Zeitraum bereits belegt.');

    const platzPatch = newGroup ? { platz: lookupOption('buchungen', 'platz', newGroup) } : {};
    const prev = buchungen;
    setBuchungen(bs => bs.map(bk =>
      bk.record_id === rid
        ? { ...bk, fields: { ...bk.fields, anreise: newStart, ...(newEnd ? { abreise: newEnd } : {}), ...(newGroup ? { platz: lookupOption('buchungen', 'platz', newGroup) } : {}) } }
        : bk
    ));
    try {
      await LivingAppsService.updateBuchungenEntry(rid, {
        anreise: newStart,
        ...(newEnd ? { abreise: newEnd } : {}),
        ...(newGroup ? { platz: newGroup } : {}),
      });
      undoToast(tx('Buchung verschoben'), async () => {
        setBuchungen(prev);
        await LivingAppsService.updateBuchungenEntry(rid, {
          anreise: b.fields.anreise,
          abreise: b.fields.abreise,
          platz: lookupKey(b.fields.platz),
        });
      });
    } catch { fetchAll(); }
  }, [buchungenMap, buchungen, enrichedBuchungen, setBuchungen, fetchAll]);

  // Resize handler
  const handleEventResize = useCallback(async (id: string, newStart: string, newEnd: string) => {
    const rid = id.split(':')[1] ?? '';
    if (!rid) return;
    const b = buchungenMap.get(rid);
    if (!b) return;
    const prev = buchungen;
    setBuchungen(bs => bs.map(bk =>
      bk.record_id === rid ? { ...bk, fields: { ...bk.fields, anreise: newStart, abreise: newEnd } } : bk
    ));
    try {
      await LivingAppsService.updateBuchungenEntry(rid, { anreise: newStart, abreise: newEnd });
      undoToast(tx('Aufenthalt angepasst'), async () => {
        setBuchungen(prev);
        await LivingAppsService.updateBuchungenEntry(rid, { anreise: b.fields.anreise, abreise: b.fields.abreise });
      });
    } catch { fetchAll(); }
  }, [buchungenMap, buchungen, setBuchungen, fetchAll]);

  // Confirm request → create Buchung
  const confirmAnfrage = useCallback(async (anfrage: typeof buchungsanfragen[number]) => {
    const prev = [...buchungsanfragen];
    setBuchungsanfragen(bs => bs.map(b =>
      b.record_id === anfrage.record_id
        ? { ...b, fields: { ...b.fields, anfrage_status: lookupOption('buchungsanfragen', 'anfrage_status', 'bestaetigt') } }
        : b
    ));
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(anfrage.record_id, { anfrage_status: 'bestaetigt' });
      undoToast(tx`${anfrage.fields.anfrage_vorname ?? ''} — Anfrage bestätigt`, async () => {
        setBuchungsanfragen(prev);
        await LivingAppsService.updateBuchungsanfragenEntry(anfrage.record_id, { anfrage_status: 'offen' });
      });
    } catch { fetchAll(); }
  }, [buchungsanfragen, setBuchungsanfragen, fetchAll]);

  const rejectAnfrage = useCallback(async (anfrage: typeof buchungsanfragen[number]) => {
    const prev = [...buchungsanfragen];
    setBuchungsanfragen(bs => bs.map(b =>
      b.record_id === anfrage.record_id
        ? { ...b, fields: { ...b.fields, anfrage_status: lookupOption('buchungsanfragen', 'anfrage_status', 'abgelehnt') } }
        : b
    ));
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(anfrage.record_id, { anfrage_status: 'abgelehnt' });
      undoToast(tx`${anfrage.fields.anfrage_vorname ?? ''} — Anfrage abgelehnt`, async () => {
        setBuchungsanfragen(prev);
        await LivingAppsService.updateBuchungsanfragenEntry(anfrage.record_id, { anfrage_status: 'offen' });
      });
    } catch { fetchAll(); }
  }, [buchungsanfragen, setBuchungsanfragen, fetchAll]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // Context line
  const anreiseNamen = namen(anreisenHeute.map(b => b.hundName || ''));
  const abreiseNamen = namen(abreisenHeute.map(b => b.hundName || ''));
  const contextLine = (() => {
    const parts: string[] = [];
    if (anreisenHeute.length > 0) parts.push(tx`${anreiseNamen} reist heute an`);
    if (abreisenHeute.length > 0) parts.push(tx`${abreiseNamen} reist heute ab`);
    if (parts.length === 0 && anwesend.length > 0) {
      const names = namen(anwesend.slice(0, 3).map(b => b.hundName || ''));
      return tx`${names} und weitere Gäste genießen ihren Aufenthalt.`;
    }
    if (parts.length === 0) return tx('Heute sind noch keine Gäste eingecheckt.');
    return parts.join(' · ');
  })();

  // Empty state
  if (buchungen.length === 0 && buchungsanfragen.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{gruss(clock)}</h1>
          <p className="text-muted-foreground mt-1">{tx('Richte deine Hundepension ein — leg die erste Buchung an.')}</p>
        </div>
        <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-2xl border border-dashed border-border">
          <IconDog size={48} className="text-muted-foreground" />
          <p className="text-muted-foreground text-center max-w-sm">{tx('Noch keine Buchungen. Erfasse den ersten Aufenthalt und behalte den Überblick über alle Plätze.')}</p>
          <button
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            onClick={() => crud.buchungen.openCreate({ status: 'geplant' })}
          >
            {tx('Erste Buchung anlegen')}
          </button>
        </div>
        {crud.surfaces}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{gruss(clock)}</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">{contextLine}</p>
        </div>
        <button
          className="shrink-0 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5"
          onClick={() => crud.buchungen.openCreate({ status: 'geplant', anreise: todayKey })}
        >
          <IconCalendarPlus size={16} className="shrink-0" />
          {tx('Neue Buchung')}
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={
          offeneAnfragen.length > 0 ? (
            <HeroBanner
              icon={<IconStar size={18} />}
              action={{
                label: tx('Anfrage bestätigen'),
                onClick: () => confirmAnfrage(offeneAnfragen[0]),
              }}
            >
              <b>{namen(offeneAnfragen.map(a => `${a.fields.anfrage_vorname ?? ''} ${a.fields.anfrage_nachname ?? ''}`.trim()))}</b>
              {' '}{offeneAnfragen.length === 1
                ? tx`hat eine unverbindliche Buchungsanfrage gestellt`
                : tx`haben Buchungsanfragen gestellt`}
              {offeneAnfragen[0].fields.wunsch_anreise && (
                <>{' '}· {tx('Wunschdatum:')} <b>{formatDate(offeneAnfragen[0].fields.wunsch_anreise)}</b></>
              )}
            </HeroBanner>
          ) : undefined
        }
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Anwesend')}
              value={anwesend.length}
              tone={anwesend.length > 0 ? 'success' : 'default'}
              onClick={() => setFilterStatus(f => f === 'anwesend' ? null : 'anwesend')}
              active={filterStatus === 'anwesend'}
            />
            <StatStripItem
              title={tx('Freie Plätze')}
              value={freieplaetze}
              tone={freieplaetze === 0 ? 'warning' : 'default'}
              onClick={() => setFilterStatus(f => f === 'geplant' ? null : 'geplant')}
              active={filterStatus === 'geplant'}
            />
            <StatStripItem
              title={tx('Anreisen heute')}
              value={anreisenHeute.length}
              tone={anreisenHeute.length > 0 ? 'primary' : 'default'}
              onClick={() => setFilterStatus(null)}
              active={false}
            />
            <StatStripItem
              title={tx('Abreisen heute')}
              value={abreisenHeute.length}
              tone={abreisenHeute.length > 0 ? 'warning' : 'default'}
              onClick={() => setFilterStatus(null)}
              active={false}
            />
            <StatStripItem
              title={tx('Offene Anfragen')}
              value={offeneAnfragen.length}
              tone={offeneAnfragen.length > 0 ? 'destructive' : 'default'}
              onClick={() => crud.buchungsanfragen.openCreate({})}
              active={false}
            />
          </StatStrip>
        }
        primary={
          <ResourceTimeline
            events={events}
            groups={groups}
            axis="day"
            defaultRange="week"
            defaultDate={clock}
            locale={dateFnsLocale()}
            onEventClick={ev => {
              const rid = ev.id.split(':')[1] ?? '';
              const rec = buchungenMap.get(rid);
              if (rec) crud.buchungen.openDetail(rec);
            }}
            onEventDrop={handleEventDrop}
            onEventResize={handleEventResize}
            onRangeCreate={(start, end, group) => {
              crud.buchungen.openCreate({
                anreise: format(start, 'yyyy-MM-dd'),
                abreise: format(end, 'yyyy-MM-dd'),
                ...(group ? { platz: group } : {}),
                status: 'geplant',
              });
            }}
            onEmptyClick={(date, group) => {
              crud.buchungen.openCreate({
                anreise: format(date, 'yyyy-MM-dd'),
                ...(group ? { platz: group } : {}),
                status: 'geplant',
              });
            }}
          />
        }
        aside={
          <>
            <WorkList
              title={tx('Heute')}
              items={[
                ...anreisenHeute.map(b => ({
                  id: `a:${b.record_id}`,
                  title: b.hundName || tx('Hund'),
                  secondLine: (
                    <>
                      <span className="font-medium text-primary">{tx('Anreise')}</span>
                      <span className="text-muted-foreground"> · {b.besitzerName}</span>
                      {b.fields.platz && <span className="text-muted-foreground"> · {b.fields.platz.label}</span>}
                    </>
                  ),
                  action: {
                    label: tx('Einchecken'),
                    onClick: async () => {
                      const prev = [...buchungen];
                      setBuchungen(bs => bs.map(bk =>
                        bk.record_id === b.record_id
                          ? { ...bk, fields: { ...bk.fields, status: lookupOption('buchungen', 'status', 'anwesend') } }
                          : bk
                      ));
                      try {
                        await LivingAppsService.updateBuchungenEntry(b.record_id, { status: 'anwesend' });
                        undoToast(tx`${b.hundName} — eingecheckt`, async () => {
                          setBuchungen(prev);
                          await LivingAppsService.updateBuchungenEntry(b.record_id, { status: 'geplant' });
                        });
                      } catch { fetchAll(); }
                    },
                  },
                })),
                ...abreisenHeute.map(b => ({
                  id: `d:${b.record_id}`,
                  title: b.hundName || tx('Hund'),
                  secondLine: (
                    <>
                      <span className="font-medium text-amber-600">{tx('Abreise')}</span>
                      <span className="text-muted-foreground"> · {b.besitzerName}</span>
                      {b.fields.platz && <span className="text-muted-foreground"> · {b.fields.platz.label}</span>}
                    </>
                  ),
                  action: {
                    label: tx('Auschecken'),
                    onClick: async () => {
                      const prev = [...buchungen];
                      setBuchungen(bs => bs.map(bk =>
                        bk.record_id === b.record_id
                          ? { ...bk, fields: { ...bk.fields, status: lookupOption('buchungen', 'status', 'abgereist') } }
                          : bk
                      ));
                      try {
                        await LivingAppsService.updateBuchungenEntry(b.record_id, { status: 'abgereist' });
                        undoToast(tx`${b.hundName} — ausgecheckt`, async () => {
                          setBuchungen(prev);
                          await LivingAppsService.updateBuchungenEntry(b.record_id, { status: 'anwesend' });
                        });
                      } catch { fetchAll(); }
                    },
                  },
                })),
              ]}
              onItemClick={id => {
                const rid = id.replace(/^[ad]:/, '');
                const rec = buchungenMap.get(rid);
                if (rec) crud.buchungen.openDetail(rec);
              }}
              empty={{
                text: tx('Heute sind keine An- oder Abreisen geplant.'),
                action: {
                  label: tx('Buchung anlegen'),
                  onClick: () => crud.buchungen.openCreate({ anreise: todayKey, status: 'geplant' }),
                },
              }}
            />

            <WorkList
              title={tx('Offene Anfragen')}
              items={offeneAnfragen.map(a => ({
                id: a.record_id,
                title: `${a.fields.hund_name ?? tx('Hund')} · ${a.fields.anfrage_vorname ?? ''} ${a.fields.anfrage_nachname ?? ''}`.trim(),
                secondLine: (
                  <>
                    <span className="font-medium text-amber-600">{tx('Offen')}</span>
                    {a.fields.wunsch_anreise && (
                      <span className="text-muted-foreground"> · {formatDate(a.fields.wunsch_anreise)}{a.fields.wunsch_abreise ? ` – ${formatDate(a.fields.wunsch_abreise)}` : ''}</span>
                    )}
                  </>
                ),
                action: {
                  label: tx('Bestätigen'),
                  onClick: () => confirmAnfrage(a),
                },
              }))}
              onItemClick={id => {
                const rec = buchungsanfragen.find(a => a.record_id === id);
                if (rec) crud.buchungsanfragen.openDetail(rec);
              }}
              empty={{
                text: tx('Keine offenen Anfragen — alles bearbeitet.'),
              }}
            />
          </>
        }
      />

      {crud.surfaces}
    </div>
  );
}
