import { useDashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import type { Buchungen, Buchungsanfragen } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS, lookupOption } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { HeroBanner } from '@/components/HeroBanner';
import { WorkList } from '@/components/WorkList';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { ResourceTimeline, type ResourceEvent, type ResourceGroup } from '@/components/widgets/ResourceTimeline';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { tx, appLabel, dateFnsLocale } from '@/i18n';
import { format } from 'date-fns';
import { useState, useMemo, useCallback } from 'react';
import {
  IconBed,
  IconDog,
  IconCalendar,
  IconAlertCircle,
  IconCheck,
  IconX,
} from '@tabler/icons-react';

const TOTAL_PLAETZE = 12;

// PLATZ_GROUPS wird in der Komponente abgeleitet (Locale-aware Getter)

function buchungIdOf(id: string) {
  return id.split(':')[1] ?? '';
}

function statusTone(status?: { key: string }): 'success' | 'primary' | 'warning' | 'default' {
  const k = status?.key;
  if (k === 'anwesend') return 'success';
  if (k === 'geplant') return 'primary';
  if (k === 'abgereist') return 'default';
  return 'warning';
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
        const a = top.record as Buchungsanfragen;
        const status = a.fields.anfrage_status?.key;
        if (status === 'offen') {
          return {
            label: tx('Buchungsanfrage bestätigen'),
            onClick: () => {
              void confirmAnfrage(a);
            },
          };
        }
      }
      if (top.type === 'buchungen') {
        const b = top.record as Buchungen;
        const status = b.fields.status?.key;
        if (status === 'geplant') {
          return { label: tx('Check-in durchführen'), onClick: () => void advanceBuchung(b, 'anwesend') };
        }
        if (status === 'anwesend') {
          return { label: tx('Check-out durchführen'), onClick: () => void advanceBuchung(b, 'abgereist') };
        }
      }
      return undefined;
    },
  });

  const enrichedBuchungen = crud.enriched.buchungen;
  const clock = useClock();

  // Platz-Gruppen: Locale-aware, daher im Komponentenbody
  const platzGroups = useMemo<ResourceGroup[]>(
    () => LOOKUP_OPTIONS['buchungen']?.['platz']?.map(o => ({ key: o.key, label: o.label })) ?? [],
    []
  );

  const [anfragenFilter, setAnfragenFilter] = useState<'all' | 'offen'>('all');

  // ─── Derived values ───
  const today = useMemo(() => format(clock, 'yyyy-MM-dd'), [clock]);

  const buchungenHeute = useMemo(() =>
    enrichedBuchungen.filter(b =>
      (b.fields.anreise === today || b.fields.abreise === today) &&
      b.fields.status?.key !== 'storniert'
    ), [enrichedBuchungen, today]);

  const anreisenHeute = useMemo(() =>
    enrichedBuchungen.filter(b => b.fields.anreise === today && b.fields.status?.key === 'geplant'),
    [enrichedBuchungen, today]
  );

  const abreisenHeute = useMemo(() =>
    enrichedBuchungen.filter(b => b.fields.abreise === today && b.fields.status?.key === 'anwesend'),
    [enrichedBuchungen, today]
  );

  const anwesend = useMemo(() =>
    enrichedBuchungen.filter(b => b.fields.status?.key === 'anwesend'),
    [enrichedBuchungen]
  );

  const offeneAnfragen = useMemo(() =>
    buchungsanfragen.filter(a => a.fields.anfrage_status?.key === 'offen'),
    [buchungsanfragen]
  );

  // Context line: names of today's arrivals/departures
  const kontextSatz = useMemo(() => {
    const anreiseNamen = anreisenHeute.map(b => b.hundName || b.besitzerName || '').filter(Boolean);
    const abreiseNamen = abreisenHeute.map(b => b.hundName || b.besitzerName || '').filter(Boolean);
    if (anreiseNamen.length === 0 && abreiseNamen.length === 0) {
      if (anwesend.length > 0) {
        return tx`${anwesend.length} Gäste im Haus — ruhiger Tag heute.`;
      }
      return tx('Aktuell sind keine Hunde angemeldet.');
    }
    const parts: string[] = [];
    if (anreiseNamen.length > 0) {
      parts.push(tx`Heute reisen ${namen(anreiseNamen)} an.`);
    }
    if (abreiseNamen.length > 0) {
      parts.push(tx`${namen(abreiseNamen)} reisen ab.`);
    }
    return parts.join(' ');
  }, [anreisenHeute, abreisenHeute, anwesend]);

  // ResourceTimeline events
  const events = useMemo<ResourceEvent[]>(() =>
    enrichedBuchungen
      .filter(b => !!b.fields.anreise && b.fields.status?.key !== 'storniert' && !!b.fields.platz?.key)
      .map(b => ({
        id: `buchung:${b.record_id}`,
        start: b.fields.anreise!,
        end: b.fields.abreise,
        allDay: true,
        title: b.hundName || b.besitzerName || tx('Unbekannt'),
        subtitle: b.besitzerName || undefined,
        tone: statusTone(b.fields.status),
        group: b.fields.platz!.key,
      })),
    [enrichedBuchungen]
  );

  // Advance booking status
  const advanceBuchung = useCallback(async (b: Buchungen, newStatus: string) => {
    const prev = buchungen;
    const newStatusVal = lookupOption('buchungen', 'status', newStatus);
    setBuchungen(curr => curr.map(r =>
      r.record_id === b.record_id
        ? { ...r, fields: { ...r.fields, status: newStatusVal } }
        : r
    ));
    const name = enrichedBuchungen.find(e => e.record_id === b.record_id)?.hundName ?? '';
    const label = newStatus === 'anwesend' ? tx`${name} — eingecheckt` : tx`${name} — ausgecheckt`;
    undoToast(label, async () => {
      setBuchungen(prev);
      await LivingAppsService.updateBuchungenEntry(b.record_id, { status: b.fields.status?.key });
    });
    try {
      await LivingAppsService.updateBuchungenEntry(b.record_id, { status: newStatus });
    } catch {
      setBuchungen(prev);
      fetchAll();
    }
  }, [buchungen, enrichedBuchungen, setBuchungen, fetchAll]);

  // Confirm booking request
  const confirmAnfrage = useCallback(async (a: Buchungsanfragen) => {
    const prev = buchungsanfragen;
    const newStatus = lookupOption('buchungsanfragen', 'anfrage_status', 'bestaetigt');
    setBuchungsanfragen(curr => curr.map(r =>
      r.record_id === a.record_id
        ? { ...r, fields: { ...r.fields, anfrage_status: newStatus } }
        : r
    ));
    const name = `${a.fields.anfrage_vorname ?? ''} ${a.fields.anfrage_nachname ?? ''}`.trim();
    undoToast(tx`${name} — Anfrage bestätigt`, async () => {
      setBuchungsanfragen(prev);
      await LivingAppsService.updateBuchungsanfragenEntry(a.record_id, { anfrage_status: 'offen' });
    });
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(a.record_id, { anfrage_status: 'bestaetigt' });
    } catch {
      setBuchungsanfragen(prev);
      fetchAll();
    }
  }, [buchungsanfragen, setBuchungsanfragen, fetchAll]);

  // Decline booking request
  const declineAnfrage = useCallback(async (a: Buchungsanfragen) => {
    const prev = buchungsanfragen;
    const newStatus = lookupOption('buchungsanfragen', 'anfrage_status', 'abgelehnt');
    setBuchungsanfragen(curr => curr.map(r =>
      r.record_id === a.record_id
        ? { ...r, fields: { ...r.fields, anfrage_status: newStatus } }
        : r
    ));
    const name = `${a.fields.anfrage_vorname ?? ''} ${a.fields.anfrage_nachname ?? ''}`.trim();
    undoToast(tx`${name} — Anfrage abgelehnt`, async () => {
      setBuchungsanfragen(prev);
      await LivingAppsService.updateBuchungsanfragenEntry(a.record_id, { anfrage_status: 'offen' });
    });
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(a.record_id, { anfrage_status: 'abgelehnt' });
    } catch {
      setBuchungsanfragen(prev);
      fetchAll();
    }
  }, [buchungsanfragen, setBuchungsanfragen, fetchAll]);

  // Drag: reschedule booking
  const reschedule = useCallback(async (id: string, newStart: string, newEnd?: string, newGroup?: string) => {
    const rid = buchungIdOf(id);
    if (!rid) return;
    const prev = buchungen;
    const platzPatch = newGroup ? { platz: lookupOption('buchungen', 'platz', newGroup) } : {};
    setBuchungen(curr => curr.map(b =>
      b.record_id === rid
        ? { ...b, fields: { ...b.fields, anreise: newStart, ...(newEnd ? { abreise: newEnd } : {}), ...platzPatch } }
        : b
    ));
    const bRecord = buchungen.find(b => b.record_id === rid);
    const name = enrichedBuchungen.find(e => e.record_id === rid)?.hundName ?? '';
    undoToast(tx`${name} — verschoben`, async () => {
      if (bRecord) {
        setBuchungen(prev);
        await LivingAppsService.updateBuchungenEntry(rid, {
          anreise: bRecord.fields.anreise,
          abreise: bRecord.fields.abreise,
          platz: bRecord.fields.platz?.key,
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
  }, [buchungen, enrichedBuchungen, setBuchungen, fetchAll]);

  // Drag resize
  const resize = useCallback(async (id: string, newStart: string, newEnd: string) => {
    const rid = buchungIdOf(id);
    if (!rid) return;
    const prev = buchungen;
    setBuchungen(curr => curr.map(b =>
      b.record_id === rid
        ? { ...b, fields: { ...b.fields, anreise: newStart, abreise: newEnd } }
        : b
    ));
    const name = enrichedBuchungen.find(e => e.record_id === rid)?.hundName ?? '';
    undoToast(tx`${name} — Zeitraum angepasst`, async () => {
      const bRecord = prev.find(b => b.record_id === rid);
      if (bRecord) {
        setBuchungen(prev);
        await LivingAppsService.updateBuchungenEntry(rid, {
          anreise: bRecord.fields.anreise,
          abreise: bRecord.fields.abreise,
        });
      }
    });
    try {
      await LivingAppsService.updateBuchungenEntry(rid, { anreise: newStart, abreise: newEnd });
    } catch {
      setBuchungen(prev);
      fetchAll();
    }
  }, [buchungen, enrichedBuchungen, setBuchungen, fetchAll]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // ─── Below: plain derivations only ───

  const belegungHeute = anwesend.length;
  const auslastungPct = Math.round((belegungHeute / TOTAL_PLAETZE) * 100);

  const heroBanner = offeneAnfragen.length > 0 ? (
    <HeroBanner
      icon={<IconAlertCircle size={18} />}
      action={{
        label: tx('Anfrage bestätigen'),
        onClick: () => void confirmAnfrage(offeneAnfragen[0]),
      }}
    >
      <b>{namen(offeneAnfragen.map(a => `${a.fields.anfrage_vorname ?? ''} ${a.fields.anfrage_nachname ?? ''}`.trim()))}</b>
      {' '}{offeneAnfragen.length === 1 ? tx('hat eine unverbindliche Buchungsanfrage gestellt.') : tx`${offeneAnfragen.length} neue Buchungsanfragen warten auf Bearbeitung.`}
    </HeroBanner>
  ) : undefined;

  const kpiStrip = (
    <StatStrip>
      <StatStripItem
        title={tx('Belegt heute')}
        value={`${belegungHeute} / ${TOTAL_PLAETZE}`}
        icon={<IconBed size={16} className="shrink-0" />}
        tone={auslastungPct >= 80 ? 'warning' : auslastungPct > 0 ? 'success' : 'default'}
      />
      <StatStripItem
        title={tx('Anreisen heute')}
        value={anreisenHeute.length}
        icon={<IconDog size={16} className="shrink-0" />}
        tone={anreisenHeute.length > 0 ? 'primary' : 'default'}
        onClick={() => setAnfragenFilter('all')}
      />
      <StatStripItem
        title={tx('Abreisen heute')}
        value={abreisenHeute.length}
        icon={<IconCalendar size={16} className="shrink-0" />}
        tone={abreisenHeute.length > 0 ? 'primary' : 'default'}
      />
      <StatStripItem
        title={tx('Offene Anfragen')}
        value={offeneAnfragen.length}
        icon={<IconAlertCircle size={16} className="shrink-0" />}
        tone={offeneAnfragen.length > 0 ? 'warning' : 'default'}
        onClick={() => setAnfragenFilter(f => f === 'offen' ? 'all' : 'offen')}
        active={anfragenFilter === 'offen'}
      />
    </StatStrip>
  );

  const belegungsplan = (
    <ResourceTimeline
      events={events}
      groups={platzGroups}
      axis="day"
      defaultRange="week"
      defaultDate={clock}
      locale={dateFnsLocale()}
      onEventClick={ev => {
        const rid = buchungIdOf(ev.id);
        const rec = buchungen.find(b => b.record_id === rid);
        if (rec) crud.buchungen.openDetail(rec);
      }}
      onEventDrop={reschedule}
      onEventResize={resize}
      onEmptyClick={(date, group) => {
        crud.buchungen.openCreate({
          anreise: format(date, 'yyyy-MM-dd'),
          platz: group,
        });
      }}
      onRangeCreate={(start, end, group) => {
        crud.buchungen.openCreate({
          anreise: format(start, 'yyyy-MM-dd'),
          abreise: format(end, 'yyyy-MM-dd'),
          platz: group,
        });
      }}
    />
  );

  // WorkList: today's arrivals and departures
  const todayItems = [
    ...anreisenHeute.map(b => ({
      id: `in:${b.record_id}`,
      title: b.hundName || b.besitzerName || tx('Unbekannt'),
      secondLine: (
        <>
          <span className="font-medium text-primary">{tx('Anreise')}</span>
          <span className="text-muted-foreground"> · {b.besitzerName}</span>
          {b.fields.platz && <span className="text-muted-foreground"> · {b.fields.platz.label}</span>}
        </>
      ),
      action: {
        label: tx('Check-in'),
        onClick: () => { void advanceBuchung(b, 'anwesend'); },
      },
      _record: b,
    })),
    ...abreisenHeute.map(b => ({
      id: `out:${b.record_id}`,
      title: b.hundName || b.besitzerName || tx('Unbekannt'),
      secondLine: (
        <>
          <span className="font-medium text-amber-600">{tx('Abreise')}</span>
          <span className="text-muted-foreground"> · {b.besitzerName}</span>
          {b.fields.platz && <span className="text-muted-foreground"> · {b.fields.platz.label}</span>}
        </>
      ),
      action: {
        label: tx('Check-out'),
        onClick: () => { void advanceBuchung(b, 'abgereist'); },
      },
      _record: b,
    })),
  ];

  // WorkList: open requests
  const anfragenItems = buchungsanfragen
    .filter(a => anfragenFilter === 'offen' ? a.fields.anfrage_status?.key === 'offen' : true)
    .filter(a => a.fields.anfrage_status?.key !== 'abgelehnt')
    .slice(0, 10)
    .map(a => {
      const name = `${a.fields.anfrage_vorname ?? ''} ${a.fields.anfrage_nachname ?? ''}`.trim();
      const isOffen = a.fields.anfrage_status?.key === 'offen';
      return {
        id: a.record_id,
        title: name || tx('Unbekannt'),
        secondLine: (
          <>
            <span className={isOffen ? 'font-medium text-amber-600' : 'text-muted-foreground'}>
              {isOffen ? tx('Offen') : a.fields.anfrage_status?.label}
            </span>
            {a.fields.hund_name && <span className="text-muted-foreground"> · {a.fields.hund_name}</span>}
            {a.fields.wunsch_anreise && (
              <span className="text-muted-foreground"> · {formatDate(a.fields.wunsch_anreise)}</span>
            )}
          </>
        ),
        action: isOffen ? {
          label: tx('Bestätigen'),
          onClick: () => { void confirmAnfrage(a); },
        } : undefined,
        _anfrage: a,
      };
    });

  const nextAnreise = enrichedBuchungen
    .filter(b => b.fields.anreise && b.fields.anreise > today && b.fields.status?.key === 'geplant')
    .sort((a, b) => (a.fields.anreise ?? '').localeCompare(b.fields.anreise ?? ''))[0];

  const nextAnreiseText = nextAnreise
    ? tx`Nächste Anreise: ${nextAnreise.hundName} am ${formatDate(nextAnreise.fields.anreise)}`
    : tx('Keine weiteren Anreisen geplant.');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{gruss(clock)}</h1>
        <p className="mt-1 text-muted-foreground">{kontextSatz}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          onClick={() => crud.buchungen.openCreate({ anreise: today })}
        >
          <IconDog size={15} className="shrink-0" />
          {tx('Neue Buchung')}
        </button>
        <button
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          onClick={() => crud.buchungsanfragen.openCreate({})}
        >
          <IconCalendar size={15} className="shrink-0" />
          {tx('Anfrage erfassen')}
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={heroBanner}
        kpis={kpiStrip}
        primary={belegungsplan}
        aside={
          <>
            <WorkList
              title={tx('Heute')}
              items={todayItems.map(item => ({
                id: item.id,
                title: item.title,
                secondLine: item.secondLine,
                action: item.action,
              }))}
              onItemClick={id => {
                const rid = id.replace(/^(in|out):/, '');
                const rec = buchungen.find(b => b.record_id === rid);
                if (rec) crud.buchungen.openDetail(rec);
              }}
              empty={{
                text: nextAnreiseText,
                action: {
                  label: tx('Neue Buchung'),
                  onClick: () => crud.buchungen.openCreate({ anreise: today }),
                },
              }}
            />
            <WorkList
              title={tx('Buchungsanfragen')}
              items={anfragenItems.map(item => ({
                id: item.id,
                title: item.title,
                secondLine: item.secondLine,
                action: item.action,
              }))}
              onItemClick={id => {
                const rec = buchungsanfragen.find(a => a.record_id === id);
                if (rec) crud.buchungsanfragen.openDetail(rec);
              }}
              empty={{
                text: tx('Keine offenen Buchungsanfragen.'),
                action: {
                  label: tx('Anfrage manuell erfassen'),
                  onClick: () => crud.buchungsanfragen.openCreate({}),
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
