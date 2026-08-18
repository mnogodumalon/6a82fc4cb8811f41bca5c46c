import { useMemo, useState, useCallback } from 'react';
import { format, parseISO, isToday, isBefore } from 'date-fns';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { HeroBanner } from '@/components/HeroBanner';
import { WorkList } from '@/components/WorkList';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { ResourceTimeline, type ResourceEvent, type ResourceGroup } from '@/components/widgets/ResourceTimeline';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { tx, appLabel } from '@/i18n';
import { dateFnsLocale } from '@/i18n';
import { formatDate } from '@/lib/formatters';
import { lookupKey } from '@/lib/formatters';
import { lookupOption } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import {
  IconPaw,
  IconCalendarPlus,
  IconDog,
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconArrowRight,
} from '@tabler/icons-react';

// Platz-Reihenfolge aus Lookup-Daten (platz_1 … platz_12)
const PLATZ_KEYS = [
  'platz_1','platz_2','platz_3','platz_4','platz_5','platz_6',
  'platz_7','platz_8','platz_9','platz_10','platz_11','platz_12',
] as const;

export default function DashboardOverview() {
  const PLATZ_LABELS: Record<string, string> = {
  platz_1: 'Platz 1', platz_2: 'Platz 2', platz_3: 'Platz 3', platz_4: 'Platz 4',
  platz_5: 'Platz 5', platz_6: 'Platz 6', platz_7: 'Platz 7', platz_8: 'Platz 8',
  platz_9: 'Platz 9', platz_10: 'Platz 10', platz_11: 'Platz 11', platz_12: 'Platz 12',
};

  const data = useDashboardData();
  const {
    buchungen, setBuchungen, buchungsanfragen, setBuchungsanfragen,
    hundeMap, besitzerMap,
    loading, error, fetchAll,
  } = data;

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'buchungsanfragen') {
        const r = buchungsanfragen.find(a => a.record_id === top.record.record_id);
        const status = lookupKey(r?.fields.anfrage_status);
        if (status === 'offen') {
          return {
            label: tx('Anfrage bestätigen'),
            onClick: () => confirmAnfrage(top.record.record_id),
          };
        }
      }
      if (top.type === 'buchungen') {
        const r = buchungen.find(b => b.record_id === top.record.record_id);
        const status = lookupKey(r?.fields.status);
        if (status === 'geplant') return { label: tx('Check-in bestätigen'), onClick: () => checkIn(top.record.record_id) };
        if (status === 'anwesend') return { label: tx('Check-out durchführen'), onClick: () => checkOut(top.record.record_id) };
      }
      return undefined;
    },
  });

  const enrichedBuchungen = crud.enriched.buchungen;

  const clock = useClock();

  // ─── Derived values needed by hooks ───
  const todayKey = format(clock, 'yyyy-MM-dd');

  // ─── Handlers ───
  const checkIn = useCallback(async (id: string) => {
    const prev = buchungen.find(b => b.record_id === id);
    if (!prev) return;
    const newStatus = lookupOption('buchungen', 'status', 'anwesend');
    setBuchungen(bs => bs.map(b => b.record_id === id ? { ...b, fields: { ...b.fields, status: newStatus } } : b));
    undoToast(tx('Check-in bestätigt'), async () => {
      setBuchungen(bs => bs.map(b => b.record_id === id ? prev : b));
      await LivingAppsService.updateBuchungenEntry(id, { status: 'geplant' });
    });
    try {
      await LivingAppsService.updateBuchungenEntry(id, { status: 'anwesend' });
    } catch {
      await fetchAll();
    }
  }, [buchungen, setBuchungen, fetchAll]);

  const checkOut = useCallback(async (id: string) => {
    const prev = buchungen.find(b => b.record_id === id);
    if (!prev) return;
    const newStatus = lookupOption('buchungen', 'status', 'abgereist');
    setBuchungen(bs => bs.map(b => b.record_id === id ? { ...b, fields: { ...b.fields, status: newStatus } } : b));
    undoToast(tx('Check-out durchgeführt'), async () => {
      setBuchungen(bs => bs.map(b => b.record_id === id ? prev : b));
      await LivingAppsService.updateBuchungenEntry(id, { status: 'anwesend' });
    });
    try {
      await LivingAppsService.updateBuchungenEntry(id, { status: 'abgereist' });
    } catch {
      await fetchAll();
    }
  }, [buchungen, setBuchungen, fetchAll]);

  const confirmAnfrage = useCallback(async (id: string) => {
    const prev = buchungsanfragen.find(a => a.record_id === id);
    if (!prev) return;
    const newStatus = lookupOption('buchungsanfragen', 'anfrage_status', 'bestaetigt');
    setBuchungsanfragen(as => as.map(a => a.record_id === id ? { ...a, fields: { ...a.fields, anfrage_status: newStatus } } : a));
    undoToast(tx('Anfrage bestätigt'), async () => {
      setBuchungsanfragen(as => as.map(a => a.record_id === id ? prev : a));
      await LivingAppsService.updateBuchungsanfragenEntry(id, { anfrage_status: 'offen' });
    });
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(id, { anfrage_status: 'bestaetigt' });
    } catch {
      await fetchAll();
    }
  }, [buchungsanfragen, setBuchungsanfragen, fetchAll]);

  const rejectAnfrage = useCallback(async (id: string) => {
    const prev = buchungsanfragen.find(a => a.record_id === id);
    if (!prev) return;
    const newStatus = lookupOption('buchungsanfragen', 'anfrage_status', 'abgelehnt');
    setBuchungsanfragen(as => as.map(a => a.record_id === id ? { ...a, fields: { ...a.fields, anfrage_status: newStatus } } : a));
    undoToast(tx('Anfrage abgelehnt'), async () => {
      setBuchungsanfragen(as => as.map(a => a.record_id === id ? prev : a));
      await LivingAppsService.updateBuchungsanfragenEntry(id, { anfrage_status: 'offen' });
    });
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(id, { anfrage_status: 'abgelehnt' });
    } catch {
      await fetchAll();
    }
  }, [buchungsanfragen, setBuchungsanfragen, fetchAll]);

  // ─── Alle hooks MÜSSEN vor den early-returns stehen ───
  const [anfragenFilter, setAnfragenFilter] = useState(false);

  const groups = useMemo<ResourceGroup[]>(
    () => PLATZ_KEYS.map(k => ({ key: k, label: PLATZ_LABELS[k] })),
    [],
  );

  const events = useMemo<ResourceEvent[]>(
    () =>
      enrichedBuchungen
        .filter(b => !!b.fields.anreise && lookupKey(b.fields.status) !== 'storniert')
        .map(b => {
          const statusKey = lookupKey(b.fields.status);
          const platzKey = lookupKey(b.fields.platz) ?? '';
          let tone: ResourceEvent['tone'] = 'primary';
          if (statusKey === 'anwesend') tone = 'success';
          else if (statusKey === 'abgereist') tone = 'default';
          return {
            id: `buchung:${b.record_id}`,
            start: b.fields.anreise!,
            end: b.fields.abreise,
            allDay: true,
            title: b.hundName || b.besitzerName || tx('Hund'),
            subtitle: b.besitzerName,
            tone,
            group: platzKey,
          };
        }),
    [enrichedBuchungen],
  );

  // Heute an- und abreisende Buchungen
  const heuteAnreise = useMemo(
    () => enrichedBuchungen.filter(b => b.fields.anreise === todayKey && lookupKey(b.fields.status) === 'geplant'),
    [enrichedBuchungen, todayKey],
  );
  const heuteAbreise = useMemo(
    () => enrichedBuchungen.filter(b => b.fields.abreise === todayKey && lookupKey(b.fields.status) === 'anwesend'),
    [enrichedBuchungen, todayKey],
  );
  const aktuellAnwesend = useMemo(
    () => enrichedBuchungen.filter(b => lookupKey(b.fields.status) === 'anwesend'),
    [enrichedBuchungen],
  );

  // Offene Anfragen
  const offeneAnfragen = useMemo(
    () => buchungsanfragen.filter(a => lookupKey(a.fields.anfrage_status) === 'offen'),
    [buchungsanfragen],
  );

  // Heute zusammen
  const heuteAktionen = useMemo(
    () => [...heuteAnreise, ...heuteAbreise],
    [heuteAnreise, heuteAbreise],
  );

  // KPI: belegte Plätze
  const belegtePlaetze = aktuellAnwesend.length;
  const freePlaetze = 12 - belegtePlaetze;

  // Context-Zeile
  const contextLine = useMemo(() => {
    const parts: string[] = [];
    if (heuteAnreise.length > 0) {
      const names = heuteAnreise.map(b => b.hundName).filter(Boolean);
      parts.push(`${namen(names)} ${heuteAnreise.length === 1 ? tx('reist heute an') : tx('reisen heute an')}`);
    }
    if (heuteAbreise.length > 0) {
      const names = heuteAbreise.map(b => b.hundName).filter(Boolean);
      parts.push(`${namen(names)} ${heuteAbreise.length === 1 ? tx('reist heute ab') : tx('reisen heute ab')}`);
    }
    if (parts.length === 0) {
      if (aktuellAnwesend.length > 0) {
        return tx`${aktuellAnwesend.length} Hunde sind gerade bei uns.`;
      }
      return tx('Heute sind keine An- oder Abreisen geplant.');
    }
    return parts.join(' — ');
  }, [heuteAnreise, heuteAbreise, aktuellAnwesend]);

  // ─── Early returns NACH allen Hooks ───
  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // Hero: unbestätigte Eincheck-Hunde heute
  const pendingCheckins = heuteAnreise;
  const hero = pendingCheckins.length > 0 ? (
    <HeroBanner
      icon={<IconPaw size={18} />}
      action={{
        label: tx('Check-in bestätigen'),
        onClick: () => checkIn(pendingCheckins[0].record_id),
      }}
    >
      <b>{namen(pendingCheckins.map(b => b.hundName))}</b>{' '}
      {pendingCheckins.length === 1 ? tx('kommt heute an — Check-in ausstehend.') : tx('kommen heute an — Check-in ausstehend.')}
    </HeroBanner>
  ) : undefined;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {gruss(clock)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{contextLine}</p>
        </div>
        <button
          onClick={() => crud.buchungen.openCreate({ anreise: todayKey })}
          className="mt-3 sm:mt-0 inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
        >
          <IconCalendarPlus size={16} className="shrink-0" />
          {tx('Neue Buchung')}
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={hero}
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Anwesend')}
              value={belegtePlaetze}
              icon={<IconDog size={16} />}
              tone={belegtePlaetze > 10 ? 'warning' : 'success'}
            />
            <StatStripItem
              title={tx('Freie Plätze')}
              value={freePlaetze}
              tone={freePlaetze === 0 ? 'destructive' : 'default'}
            />
            <StatStripItem
              title={tx('Anreise heute')}
              value={heuteAnreise.length}
              tone={heuteAnreise.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title={tx('Abreise heute')}
              value={heuteAbreise.length}
              tone={heuteAbreise.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title={tx('Offene Anfragen')}
              value={offeneAnfragen.length}
              tone={offeneAnfragen.length > 0 ? 'warning' : 'default'}
              onClick={() => setAnfragenFilter(f => !f)}
              active={anfragenFilter}
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
              const id = ev.id.split(':')[1] ?? '';
              const rec = buchungen.find(b => b.record_id === id);
              if (rec) crud.buchungen.openDetail(rec);
            }}
            onEventDrop={async (id, newStart, newEnd, newGroup) => {
              const rid = id.split(':')[1] ?? '';
              const prev = buchungen.find(b => b.record_id === rid);
              if (!prev) return;
              const platzPatch = newGroup ? { platz: lookupOption('buchungen', 'platz', newGroup) } : {};
              setBuchungen(bs =>
                bs.map(b => b.record_id === rid
                  ? { ...b, fields: { ...b.fields, anreise: newStart, ...(newEnd ? { abreise: newEnd } : {}), ...platzPatch } }
                  : b)
              );
              const platzApiPatch = newGroup ? { platz: newGroup } : {};
              undoToast(tx('Buchung verschoben'), async () => {
                setBuchungen(bs => bs.map(b => b.record_id === rid ? prev : b));
                await LivingAppsService.updateBuchungenEntry(rid, {
                  anreise: prev.fields.anreise,
                  abreise: prev.fields.abreise,
                  platz: lookupKey(prev.fields.platz),
                });
              });
              try {
                await LivingAppsService.updateBuchungenEntry(rid, {
                  anreise: newStart,
                  ...(newEnd ? { abreise: newEnd } : {}),
                  ...platzApiPatch,
                });
              } catch {
                await fetchAll();
              }
            }}
            onEventResize={async (id, newStart, newEnd) => {
              const rid = id.split(':')[1] ?? '';
              const prev = buchungen.find(b => b.record_id === rid);
              if (!prev) return;
              setBuchungen(bs =>
                bs.map(b => b.record_id === rid
                  ? { ...b, fields: { ...b.fields, anreise: newStart, abreise: newEnd } }
                  : b)
              );
              undoToast(tx('Aufenthalt angepasst'), async () => {
                setBuchungen(bs => bs.map(b => b.record_id === rid ? prev : b));
                await LivingAppsService.updateBuchungenEntry(rid, {
                  anreise: prev.fields.anreise,
                  abreise: prev.fields.abreise,
                });
              });
              try {
                await LivingAppsService.updateBuchungenEntry(rid, { anreise: newStart, abreise: newEnd });
              } catch {
                await fetchAll();
              }
            }}
            onRangeCreate={(start, end, group) => {
              const anreise = format(start, 'yyyy-MM-dd');
              const abreise = format(end, 'yyyy-MM-dd');
              crud.buchungen.openCreate({ anreise, abreise, platz: group });
            }}
            onEmptyClick={(date, group) => {
              const anreise = format(date, 'yyyy-MM-dd');
              crud.buchungen.openCreate({ anreise, platz: group });
            }}
          />
        }
        aside={
          <>
            <WorkList
              title={tx('Heute — An- & Abreisen')}
              items={heuteAktionen.map(b => {
                const isCheckin = b.fields.anreise === todayKey && lookupKey(b.fields.status) === 'geplant';
                return {
                  id: b.record_id,
                  title: b.hundName || tx('Hund'),
                  secondLine: (
                    <>
                      <span className={isCheckin ? 'font-medium text-primary' : 'font-medium text-amber-600'}>
                        {isCheckin ? tx('Anreise') : tx('Abreise')}
                      </span>
                      <span className="text-muted-foreground"> · {b.besitzerName}</span>
                    </>
                  ),
                  action: isCheckin
                    ? { label: tx('✓ Check-in'), onClick: () => checkIn(b.record_id) }
                    : { label: tx('✓ Check-out'), onClick: () => checkOut(b.record_id) },
                };
              })}
              onItemClick={id => {
                const rec = buchungen.find(b => b.record_id === id);
                if (rec) crud.buchungen.openDetail(rec);
              }}
              empty={{
                text: tx('Heute keine An- oder Abreisen — alles ruhig!'),
                action: { label: tx('Neue Buchung'), onClick: () => crud.buchungen.openCreate({ anreise: todayKey }) },
              }}
              max={8}
            />

            <WorkList
              title={anfragenFilter ? tx('Offene Anfragen (gefiltert)') : tx('Neue Buchungsanfragen')}
              items={(anfragenFilter ? offeneAnfragen : offeneAnfragen.slice(0, 8)).map(a => ({
                id: a.record_id,
                title: `${a.fields.anfrage_vorname ?? ''} ${a.fields.anfrage_nachname ?? ''}`.trim() || tx('Anfrage'),
                secondLine: (
                  <>
                    <span className="font-medium text-amber-600">{a.fields.hund_name ?? '—'}</span>
                    <span className="text-muted-foreground">
                      {' '}· {a.fields.wunsch_anreise ? formatDate(a.fields.wunsch_anreise) : '—'}
                      {a.fields.wunsch_abreise ? ` – ${formatDate(a.fields.wunsch_abreise)}` : ''}
                    </span>
                  </>
                ),
                action: { label: tx('✓ Bestätigen'), onClick: () => confirmAnfrage(a.record_id) },
              }))}
              onItemClick={id => {
                const rec = buchungsanfragen.find(a => a.record_id === id);
                if (rec) crud.buchungsanfragen.openDetail(rec);
              }}
              empty={{
                text: tx('Keine neuen Buchungsanfragen.'),
                action: { label: tx('Anfrage manuell erfassen'), onClick: () => crud.buchungsanfragen.openCreate({}) },
              }}
              max={6}
            />
          </>
        }
      />

      {crud.surfaces}
    </div>
  );
}
