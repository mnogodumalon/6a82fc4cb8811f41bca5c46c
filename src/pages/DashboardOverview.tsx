import { useMemo, useState, useCallback } from 'react';
import { format, parseISO, isToday, isBefore, isAfter } from 'date-fns';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import {
  ResourceTimeline,
  type ResourceEvent,
  type ResourceGroup,
} from '@/components/widgets/ResourceTimeline';
import { tx, appLabel, dateFnsLocale } from '@/i18n';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { formatDate } from '@/lib/formatters';
import {
  LivingAppsService,
  extractRecordId,
  createRecordUrl,
} from '@/services/livingAppsService';
import { APP_IDS, LOOKUP_OPTIONS, lookupOption } from '@/types/app';
import type { EnrichedBuchungen } from '@/types/enriched';
import {
  IconPaw,
  IconCalendarCheck,
  IconCalendarX,
  IconAlertTriangle,
  IconCheck,
  IconX,
} from '@tabler/icons-react';

// PLATZ_GROUPS: moved into component body (locale-aware getter)

// Tone für Buchungsstatus
function toneForStatus(key?: string) {
  if (key === 'anwesend') return 'success' as const;
  if (key === 'geplant') return 'primary' as const;
  if (key === 'storniert') return 'default' as const;
  return 'default' as const;
}

export default function DashboardOverview() {
  const data = useDashboardData();
  const {
    buchungen, buchungsanfragen,
    setBuchungen,
    loading, error, fetchAll,
  } = data;

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'buchungsanfragen') {
        const anf = buchungsanfragen.find(a => a.record_id === top.record.record_id);
        if (anf?.fields.anfrage_status?.key === 'offen') {
          return {
            label: tx('Bestätigen'),
            onClick: () => confirmAnfrage(anf),
          };
        }
      }
      if (top.type === 'buchungen') {
        const raw = buchungen.find(x => x.record_id === top.record.record_id);
        const statusKey = raw?.fields.status?.key;
        if (statusKey === 'geplant') {
          return {
            label: tx('Check-in'),
            onClick: () => checkInById(top.record.record_id),
          };
        }
        if (statusKey === 'anwesend') {
          return {
            label: tx('Check-out'),
            onClick: () => checkOutById(top.record.record_id),
          };
        }
      }
      return undefined;
    },
  });

  const enrichedBuchungen = crud.enriched.buchungen;
  const clock = useClock();

  // Platz-Gruppen: locale-aware Labels — im Component Body (nicht Module Scope)
  const platzGroups = useMemo<ResourceGroup[]>(
    () => (LOOKUP_OPTIONS['buchungen']?.['platz'] ?? []).map(o => ({ key: o.key, label: o.label })),
    [],
  );

  // ─── Heute-Filter ─────────────────────────────────────────────────────────
  const [filter, setFilter] = useState<'anreisen' | 'abreisen' | 'anfragen' | null>(null);

  const todayStr = format(clock, 'yyyy-MM-dd');

  // Buchungen von heute — Anreise ODER Abreise fällt auf heute
  const heuteAnreisen = useMemo(
    () => enrichedBuchungen.filter(b => b.fields.anreise === todayStr && b.fields.status?.key !== 'storniert'),
    [enrichedBuchungen, todayStr],
  );
  const heuteAbreisen = useMemo(
    () => enrichedBuchungen.filter(b => b.fields.abreise === todayStr && b.fields.status?.key !== 'storniert'),
    [enrichedBuchungen, todayStr],
  );

  // Aktuelle Belegung (heute anwesend)
  const anwesend = useMemo(
    () => enrichedBuchungen.filter(b => {
      if (b.fields.status?.key === 'storniert') return false;
      const an = b.fields.anreise;
      const ab = b.fields.abreise;
      if (!an) return false;
      return an <= todayStr && (!ab || ab >= todayStr);
    }),
    [enrichedBuchungen, todayStr],
  );

  // Offene Buchungsanfragen
  const offeneAnfragen = useMemo(
    () => buchungsanfragen.filter(a => a.fields.anfrage_status?.key === 'offen'),
    [buchungsanfragen],
  );

  // ─── ResourceTimeline Events + Groups ─────────────────────────────────────
  const events = useMemo<ResourceEvent[]>(
    () =>
      enrichedBuchungen
        .filter(b => !!b.fields.anreise && b.fields.status?.key !== 'storniert' && !!b.fields.platz?.key)
        .map(b => ({
          id: `buchung:${b.record_id}`,
          start: b.fields.anreise!,
          end: b.fields.abreise,
          allDay: true,
          title: b.hundName || b.besitzerName || tx('Unbekannt'),
          subtitle: b.besitzerName || undefined,
          tone: toneForStatus(b.fields.status?.key),
          group: b.fields.platz!.key,
        })),
    [enrichedBuchungen],
  );

  // ─── Drag-Reschedule (optimistisch) ───────────────────────────────────────
  const reschedule = useCallback(
    async (id: string, newStart: string, newEnd?: string, newGroup?: string) => {
      const rid = id.split(':')[1] ?? '';
      if (!rid) return;
      const prev = buchungen.find(b => b.record_id === rid);
      if (!prev) return;

      // Platzkollision prüfen (außer mit sich selbst)
      if (newGroup) {
        const conflict = enrichedBuchungen.find(b =>
          b.record_id !== rid &&
          b.fields.platz?.key === newGroup &&
          b.fields.status?.key !== 'storniert' &&
          b.fields.anreise &&
          (newEnd
            ? b.fields.anreise <= newEnd && (b.fields.abreise ?? b.fields.anreise) >= newStart
            : b.fields.anreise === newStart)
        );
        if (conflict) {
          return tx('Dieser Platz ist im gewählten Zeitraum bereits belegt.');
        }
      }

      const platzPatch = newGroup
        ? { platz: lookupOption('buchungen', 'platz', newGroup) }
        : {};

      // Optimistisches Update
      setBuchungen(prev2 =>
        prev2.map(b =>
          b.record_id === rid
            ? {
                ...b,
                fields: {
                  ...b.fields,
                  anreise: newStart,
                  ...(newEnd ? { abreise: newEnd } : {}),
                  ...(newGroup ? { platz: lookupOption('buchungen', 'platz', newGroup) } : {}),
                },
              }
            : b,
        ),
      );

      const patchFields: Record<string, unknown> = { anreise: newStart };
      if (newEnd) patchFields.abreise = newEnd;
      if (newGroup) patchFields.platz = newGroup;

      try {
        await LivingAppsService.updateBuchungenEntry(rid, patchFields);
        undoToast(tx`${prev.fields.anreise ?? '—'} → ${newStart}`, async () => {
          const undoFields: Record<string, unknown> = { anreise: prev.fields.anreise };
          if (prev.fields.abreise) undoFields.abreise = prev.fields.abreise;
          if (prev.fields.platz) undoFields.platz = prev.fields.platz.key;
          setBuchungen(prev2 =>
            prev2.map(b => (b.record_id === rid ? { ...prev } : b)),
          );
          await LivingAppsService.updateBuchungenEntry(rid, undoFields).catch(() => fetchAll());
        });
      } catch {
        fetchAll();
      }
    },
    [buchungen, enrichedBuchungen, setBuchungen, fetchAll],
  );

  // ─── Check-in / Check-out ─────────────────────────────────────────────────
  const checkIn = useCallback(
    async (b: EnrichedBuchungen) => {
      const prev = buchungen.find(x => x.record_id === b.record_id);
      if (!prev) return;
      setBuchungen(prev2 =>
        prev2.map(x =>
          x.record_id === b.record_id
            ? { ...x, fields: { ...x.fields, status: lookupOption('buchungen', 'status', 'anwesend') } }
            : x,
        ),
      );
      try {
        await LivingAppsService.updateBuchungenEntry(b.record_id, { status: 'anwesend' });
        undoToast(tx`${b.hundName || b.besitzerName} — eingecheckt`, async () => {
          setBuchungen(prev2 => prev2.map(x => (x.record_id === b.record_id ? { ...prev } : x)));
          await LivingAppsService.updateBuchungenEntry(b.record_id, { status: 'geplant' }).catch(() => fetchAll());
        });
      } catch {
        fetchAll();
      }
    },
    [buchungen, setBuchungen, fetchAll],
  );

  const checkOut = useCallback(
    async (b: EnrichedBuchungen) => {
      const prev = buchungen.find(x => x.record_id === b.record_id);
      if (!prev) return;
      setBuchungen(prev2 =>
        prev2.map(x =>
          x.record_id === b.record_id
            ? { ...x, fields: { ...x.fields, status: lookupOption('buchungen', 'status', 'abgereist') } }
            : x,
        ),
      );
      try {
        await LivingAppsService.updateBuchungenEntry(b.record_id, { status: 'abgereist' });
        undoToast(tx`${b.hundName || b.besitzerName} — ausgecheckt`, async () => {
          setBuchungen(prev2 => prev2.map(x => (x.record_id === b.record_id ? { ...prev } : x)));
          await LivingAppsService.updateBuchungenEntry(b.record_id, { status: 'anwesend' }).catch(() => fetchAll());
        });
      } catch {
        fetchAll();
      }
    },
    [buchungen, setBuchungen, fetchAll],
  );

  // ID-basierte Wrapper für den footer-Callback (kein Enriched-Zugriff nötig)
  const checkInById = useCallback(
    (rid: string) => {
      const b = enrichedBuchungen.find(x => x.record_id === rid);
      if (b) void checkIn(b);
    },
    [enrichedBuchungen, checkIn],
  );
  const checkOutById = useCallback(
    (rid: string) => {
      const b = enrichedBuchungen.find(x => x.record_id === rid);
      if (b) void checkOut(b);
    },
    [enrichedBuchungen, checkOut],
  );

  // ─── Buchungsanfrage bestätigen → neue Buchung anlegen ────────────────────
  const confirmAnfrage = useCallback(
    async (anf: (typeof buchungsanfragen)[0]) => {
      // Status optimistisch auf bestätigt setzen
      const { setBuchungsanfragen } = data;
      setBuchungsanfragen(prev =>
        prev.map(a =>
          a.record_id === anf.record_id
            ? { ...a, fields: { ...a.fields, anfrage_status: lookupOption('buchungsanfragen', 'anfrage_status', 'bestaetigt') } }
            : a,
        ),
      );
      try {
        await LivingAppsService.updateBuchungsanfragenEntry(anf.record_id, { anfrage_status: 'bestaetigt' });
        // Neue Buchung anlegen (Hund als Text-Notiz, Zeitraum übernehmen)
        crud.buchungen.openCreate({
          anreise: anf.fields.wunsch_anreise,
          abreise: anf.fields.wunsch_abreise,
          status: 'geplant',
          interne_notizen: [
            anf.fields.anfrage_vorname,
            anf.fields.anfrage_nachname,
            anf.fields.hund_name ? `— ${anf.fields.hund_name}` : '',
          ]
            .filter(Boolean)
            .join(' '),
        });
        undoToast(
          tx`${[anf.fields.anfrage_vorname, anf.fields.anfrage_nachname].filter(Boolean).join(' ')} — bestätigt`,
          async () => {
            setBuchungsanfragen(prev =>
              prev.map(a =>
                a.record_id === anf.record_id
                  ? { ...a, fields: { ...a.fields, anfrage_status: lookupOption('buchungsanfragen', 'anfrage_status', 'offen') } }
                  : a,
              ),
            );
            await LivingAppsService.updateBuchungsanfragenEntry(anf.record_id, { anfrage_status: 'offen' }).catch(() => fetchAll());
          },
        );
      } catch {
        fetchAll();
      }
    },
    [data, buchungsanfragen, crud.buchungen, fetchAll],
  );

  const rejectAnfrage = useCallback(
    async (anf: (typeof buchungsanfragen)[0]) => {
      const { setBuchungsanfragen } = data;
      setBuchungsanfragen(prev =>
        prev.map(a =>
          a.record_id === anf.record_id
            ? { ...a, fields: { ...a.fields, anfrage_status: lookupOption('buchungsanfragen', 'anfrage_status', 'abgelehnt') } }
            : a,
        ),
      );
      try {
        await LivingAppsService.updateBuchungsanfragenEntry(anf.record_id, { anfrage_status: 'abgelehnt' });
        undoToast(
          tx`${[anf.fields.anfrage_vorname, anf.fields.anfrage_nachname].filter(Boolean).join(' ')} — abgelehnt`,
          async () => {
            setBuchungsanfragen(prev =>
              prev.map(a =>
                a.record_id === anf.record_id
                  ? { ...a, fields: { ...a.fields, anfrage_status: lookupOption('buchungsanfragen', 'anfrage_status', 'offen') } }
                  : a,
              ),
            );
            await LivingAppsService.updateBuchungsanfragenEntry(anf.record_id, { anfrage_status: 'offen' }).catch(() => fetchAll());
          },
        );
      } catch {
        fetchAll();
      }
    },
    [data, buchungsanfragen, fetchAll],
  );

  // ─── Early returns NACH allen Hooks ───────────────────────────────────────
  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // ─── Kontextzeile ──────────────────────────────────────────────────────────
  const anwesendNamen = namen(anwesend.map(b => b.hundName || b.besitzerName || ''));
  const contextLine = anwesend.length > 0
    ? tx`Aktuell ${anwesendNamen} vor Ort.`
    : tx('Noch keine Hunde aktuell eingecheckt.');

  const freiePlaetze = 12 - anwesend.length;

  // ─── Aside WorkLists ───────────────────────────────────────────────────────
  // WorkList 1: Heute an- und abreisende Hunde
  const heuteItems = [
    ...heuteAnreisen.map(b => ({
      id: `an:${b.record_id}`,
      title: b.hundName || b.besitzerName || tx('Unbekannt'),
      secondLine: (
        <>
          <span className="font-medium text-emerald-600">{tx('Anreise')}</span>
          {b.fields.platz && (
            <span className="text-muted-foreground"> · {b.fields.platz.label}</span>
          )}
          {b.besitzerName && (
            <span className="text-muted-foreground"> · {b.besitzerName}</span>
          )}
        </>
      ),
      action:
        b.fields.status?.key === 'geplant'
          ? {
              label: tx('Check-in'),
              onClick: () => checkIn(b),
            }
          : undefined,
    })),
    ...heuteAbreisen
      .filter(b => b.fields.status?.key === 'anwesend')
      .map(b => ({
        id: `ab:${b.record_id}`,
        title: b.hundName || b.besitzerName || tx('Unbekannt'),
        secondLine: (
          <>
            <span className="font-medium text-amber-600">{tx('Abreise')}</span>
            {b.fields.platz && (
              <span className="text-muted-foreground"> · {b.fields.platz.label}</span>
            )}
            {b.besitzerName && (
              <span className="text-muted-foreground"> · {b.besitzerName}</span>
            )}
          </>
        ),
        action: {
          label: tx('Check-out'),
          onClick: () => checkOut(b),
        },
      })),
  ];

  // WorkList 2: Offene Anfragen
  const anfragenItems = offeneAnfragen.slice(0, 8).map(a => {
    const name = [a.fields.anfrage_vorname, a.fields.anfrage_nachname].filter(Boolean).join(' ');
    return {
      id: a.record_id,
      title: name || tx('Unbekannte Anfrage'),
      secondLine: (
        <>
          <span className="text-muted-foreground">{a.fields.hund_name || tx('Hund unbekannt')}</span>
          {a.fields.wunsch_anreise && (
            <span className="text-muted-foreground"> · {formatDate(a.fields.wunsch_anreise)}</span>
          )}
          {a.fields.wunsch_abreise && (
            <span className="text-muted-foreground"> – {formatDate(a.fields.wunsch_abreise)}</span>
          )}
        </>
      ),
      action: {
        label: tx('Bestätigen'),
        onClick: () => confirmAnfrage(a),
      },
    };
  });

  return (
    <div className="space-y-6">
      {/* Seitenüberschrift */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {gruss(clock)}
          </h1>
          <p className="mt-1 text-muted-foreground">{contextLine}</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
          onClick={() => crud.buchungen.openCreate({ status: 'geplant' })}
        >
          <IconPaw size={16} className="shrink-0" />
          {tx('Neue Buchung')}
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={
          offeneAnfragen.length > 0
            ? (
              <HeroBanner
                icon={<IconAlertTriangle size={18} />}
                action={{
                  label: tx('Jetzt bestätigen'),
                  onClick: () => confirmAnfrage(offeneAnfragen[0]),
                }}
              >
                <b>{offeneAnfragen.length === 1
                  ? tx('Eine neue Buchungsanfrage')
                  : tx`${offeneAnfragen.length} neue Buchungsanfragen`}</b>
                {' — '}
                {namen(offeneAnfragen.map(a =>
                  [a.fields.anfrage_vorname, a.fields.anfrage_nachname].filter(Boolean).join(' ')
                ))}
                {offeneAnfragen[0]?.fields.wunsch_anreise
                  ? tx` ab ${formatDate(offeneAnfragen[0].fields.wunsch_anreise)}`
                  : ''}
              </HeroBanner>
            )
            : undefined
        }
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Belegt')}
              value={`${anwesend.length}/12`}
              icon={<IconPaw size={16} className="shrink-0" />}
              tone={anwesend.length >= 10 ? 'warning' : 'default'}
              onClick={() => setFilter(f => f === 'abreisen' ? null : null)}
            />
            <StatStripItem
              title={tx('Freie Plätze')}
              value={freiePlaetze}
              icon={<IconCalendarCheck size={16} className="shrink-0" />}
              tone={freiePlaetze === 0 ? 'destructive' : freiePlaetze <= 3 ? 'warning' : 'success'}
            />
            <StatStripItem
              title={tx('Anreisen heute')}
              value={heuteAnreisen.length}
              icon={<IconCalendarCheck size={16} className="shrink-0" />}
              tone={heuteAnreisen.length > 0 ? 'primary' : 'default'}
              onClick={() => setFilter(f => f === 'anreisen' ? null : 'anreisen')}
              active={filter === 'anreisen'}
            />
            <StatStripItem
              title={tx('Abreisen heute')}
              value={heuteAbreisen.length}
              icon={<IconCalendarX size={16} className="shrink-0" />}
              tone={heuteAbreisen.length > 0 ? 'warning' : 'default'}
              onClick={() => setFilter(f => f === 'abreisen' ? null : 'abreisen')}
              active={filter === 'abreisen'}
            />
            <StatStripItem
              title={tx('Offene Anfragen')}
              value={offeneAnfragen.length}
              icon={<IconAlertTriangle size={16} className="shrink-0" />}
              tone={offeneAnfragen.length > 0 ? 'destructive' : 'default'}
              onClick={() => setFilter(f => f === 'anfragen' ? null : 'anfragen')}
              active={filter === 'anfragen'}
            />
          </StatStrip>
        }
        primary={
          <ResourceTimeline
            events={events}
            groups={platzGroups}
            axis="day"
            defaultRange="week"
            locale={dateFnsLocale()}
            onEventClick={ev => {
              const rid = ev.id.split(':')[1] ?? '';
              const b = enrichedBuchungen.find(x => x.record_id === rid);
              if (b) crud.buchungen.openDetail(b);
            }}
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
            onEventDrop={reschedule}
            onEventResize={async (id, newStart, newEnd) => reschedule(id, newStart, newEnd)}
          />
        }
        aside={
          <>
            <WorkList
              title={tx('Heute: An- & Abreisen')}
              items={heuteItems}
              onItemClick={id => {
                const rid = id.replace(/^(an|ab):/, '');
                const b = enrichedBuchungen.find(x => x.record_id === rid);
                if (b) crud.buchungen.openDetail(b);
              }}
              empty={{
                text: tx('Heute reist niemand an oder ab.'),
                action: {
                  label: tx('Neue Buchung'),
                  onClick: () => crud.buchungen.openCreate({ status: 'geplant', anreise: todayStr }),
                },
              }}
            />
            <WorkList
              title={tx('Buchungsanfragen')}
              items={anfragenItems}
              onItemClick={id => {
                const a = buchungsanfragen.find(x => x.record_id === id);
                if (a) crud.buchungsanfragen.openDetail(a);
              }}
              empty={{
                text: tx('Keine offenen Anfragen — alles bearbeitet.'),
                action: {
                  label: appLabel('buchungsanfragen'),
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
