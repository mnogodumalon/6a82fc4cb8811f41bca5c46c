import { useMemo, useState, useCallback } from 'react';
import { format, parseISO, isToday, isBefore, startOfDay } from 'date-fns';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { ResourceTimeline, type ResourceEvent, type ResourceGroup } from '@/components/widgets/ResourceTimeline';
import { LOOKUP_OPTIONS, APP_IDS, lookupOption } from '@/types/app';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { tx, dateFnsLocale, appLabel } from '@/i18n';
import {
  IconPaw,
  IconCalendar,
  IconBed,
  IconClockHour4,
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconStar,
  IconPlus,
} from '@tabler/icons-react';

// Platz-Lookup-Keys in Anzeigereihenfolge
const PLAETZE = LOOKUP_OPTIONS['buchungen']?.['platz'] ?? [];

function buchungTone(status: string | undefined) {
  if (status === 'anwesend') return 'success' as const;
  if (status === 'geplant') return 'primary' as const;
  if (status === 'storniert') return 'default' as const;
  return 'default' as const;
}

export default function DashboardOverview() {
  const data = useDashboardData();
  const {
    besitzer, hunde, buchungen, buchungsanfragen, pfotenPortraets,
    besitzerMap, hundeMap, buchungenMap,
    setBuchungen, setBuchungsanfragen,
    loading, error, fetchAll,
  } = data;

  const clock = useClock();

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'buchungsanfragen') {
        const anfrage = buchungsanfragen.find(a => a.record_id === top.record.record_id);
        if (anfrage?.fields.anfrage_status?.key === 'offen') {
          return {
            label: tx('Anfrage bestätigen'),
            onClick: () => confirmAnfrage(anfrage),
          };
        }
      }
      if (top.type === 'buchungen') {
        const b = buchungen.find(b => b.record_id === top.record.record_id);
        const status = b?.fields.status?.key;
        if (status === 'geplant') {
          return {
            label: tx('Check-in bestätigen'),
            onClick: () => checkIn(b!),
          };
        }
        if (status === 'anwesend') {
          return {
            label: tx('Check-out'),
            onClick: () => checkOut(b!),
          };
        }
      }
      return undefined;
    },
  });

  const enrichedHunde = crud.enriched.hunde;
  const enrichedBuchungen = crud.enriched.buchungen;

  // ─── Advance helpers ──────────────────────────────────────────────────────

  const checkIn = useCallback(async (b: (typeof buchungen)[0]) => {
    const prev = buchungen.map(x => ({ ...x }));
    const newStatus = lookupOption('buchungen', 'status', 'anwesend');
    setBuchungen(list => list.map(x =>
      x.record_id === b.record_id ? { ...x, fields: { ...x.fields, status: newStatus } } : x
    ));
    undoToast(
      tx`${b.record_id} — eingecheckt`,
      async () => {
        setBuchungen(prev);
        await LivingAppsService.updateBuchungenEntry(b.record_id, { status: 'geplant' }).catch(() => fetchAll());
      }
    );
    await LivingAppsService.updateBuchungenEntry(b.record_id, { status: 'anwesend' }).catch(() => fetchAll());
  }, [buchungen, setBuchungen, fetchAll]);

  const checkOut = useCallback(async (b: (typeof buchungen)[0]) => {
    const newStatus = lookupOption('buchungen', 'status', 'abgereist');
    setBuchungen(list => list.map(x =>
      x.record_id === b.record_id ? { ...x, fields: { ...x.fields, status: newStatus } } : x
    ));
    undoToast(tx`${b.record_id} — ausgecheckt`);
    await LivingAppsService.updateBuchungenEntry(b.record_id, { status: 'abgereist' }).catch(() => fetchAll());
  }, [setBuchungen, fetchAll]);

  const confirmAnfrage = useCallback(async (a: (typeof buchungsanfragen)[0]) => {
    const newStatus = lookupOption('buchungsanfragen', 'anfrage_status', 'bestaetigt');
    setBuchungsanfragen(list => list.map(x =>
      x.record_id === a.record_id ? { ...x, fields: { ...x.fields, anfrage_status: newStatus } } : x
    ));
    undoToast(tx`Anfrage bestätigt`);
    await LivingAppsService.updateBuchungsanfragenEntry(a.record_id, { anfrage_status: 'bestaetigt' }).catch(() => fetchAll());
  }, [setBuchungsanfragen, fetchAll]);

  const rejectAnfrage = useCallback(async (a: (typeof buchungsanfragen)[0]) => {
    const newStatus = lookupOption('buchungsanfragen', 'anfrage_status', 'abgelehnt');
    setBuchungsanfragen(list => list.map(x =>
      x.record_id === a.record_id ? { ...x, fields: { ...x.fields, anfrage_status: newStatus } } : x
    ));
    undoToast(tx`Anfrage abgelehnt`);
    await LivingAppsService.updateBuchungsanfragenEntry(a.record_id, { anfrage_status: 'abgelehnt' }).catch(() => fetchAll());
  }, [setBuchungsanfragen, fetchAll]);

  // ─── ResourceTimeline-Daten ───────────────────────────────────────────────

  const groups = useMemo<ResourceGroup[]>(
    () => PLAETZE.map(p => ({ key: p.key, label: p.label })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const events = useMemo<ResourceEvent[]>(
    () =>
      buchungen
        .filter(b => b.fields.anreise && b.fields.platz?.key && b.fields.status?.key !== 'storniert')
        .map(b => {
          const status = b.fields.status?.key;
          const hundId = extractRecordId(b.fields.hund);
          const hund = hundId ? hundeMap.get(hundId) : undefined;
          const besitzerId = extractRecordId(b.fields.besitzer);
          const besitzerRec = besitzerId ? besitzerMap.get(besitzerId) : undefined;
          const name = hund?.fields.name
            ? `${hund.fields.name}${besitzerRec ? ` (${besitzerRec.fields.nachname ?? ''})` : ''}`
            : tx('Buchung');
          return {
            id: `buchung:${b.record_id}`,
            start: b.fields.anreise!,
            end: b.fields.abreise,
            allDay: true,
            title: name,
            subtitle: b.fields.platz?.label,
            tone: buchungTone(status),
            group: b.fields.platz!.key,
          };
        }),
    [buchungen, hundeMap, besitzerMap]
  );

  // ─── Heute-Kennzahlen ─────────────────────────────────────────────────────

  const todayKey = format(clock, 'yyyy-MM-dd');

  const anwesend = useMemo(
    () => buchungen.filter(b => b.fields.status?.key === 'anwesend'),
    [buchungen]
  );

  const anreisenHeute = useMemo(
    () => buchungen.filter(b => b.fields.anreise === todayKey && b.fields.status?.key !== 'storniert'),
    [buchungen, todayKey]
  );

  const abreisenHeute = useMemo(
    () => buchungen.filter(b => b.fields.abreise === todayKey && b.fields.status?.key !== 'storniert'),
    [buchungen, todayKey]
  );

  const offeneAnfragen = useMemo(
    () => buchungsanfragen.filter(a => a.fields.anfrage_status?.key === 'offen'),
    [buchungsanfragen]
  );

  const freePlaetze = 12 - anwesend.length;

  // ─── Hero: offene Anfragen ────────────────────────────────────────────────

  const heroAnfrage = offeneAnfragen[0];
  const heroAnfrageName = heroAnfrage
    ? `${heroAnfrage.fields.anfrage_vorname ?? ''} ${heroAnfrage.fields.anfrage_nachname ?? ''}`.trim()
    : '';

  // ─── Kontext-Satz ─────────────────────────────────────────────────────────

  const contextLine = useMemo(() => {
    const anreiseNamen = anreisenHeute.map(b => {
      const hundId = extractRecordId(b.fields.hund);
      const hund = hundId ? hundeMap.get(hundId) : undefined;
      return hund?.fields.name ?? '';
    }).filter(Boolean);

    const abreiseNamen = abreisenHeute.map(b => {
      const hundId = extractRecordId(b.fields.hund);
      const hund = hundId ? hundeMap.get(hundId) : undefined;
      return hund?.fields.name ?? '';
    }).filter(Boolean);

    if (anreiseNamen.length === 0 && abreiseNamen.length === 0) {
      if (anwesend.length > 0) {
        return tx`${anwesend.length} Hunde genießen ihren Aufenthalt.`;
      }
      return tx('Heute keine An- oder Abreisen.');
    }
    const parts: string[] = [];
    if (anreiseNamen.length > 0) {
      parts.push(tx`${namen(anreiseNamen)} reist an.`);
    }
    if (abreiseNamen.length > 0) {
      parts.push(tx`${namen(abreiseNamen)} reist ab.`);
    }
    return parts.join(' ');
  }, [anreisenHeute, abreisenHeute, anwesend, hundeMap]);

  // ─── Drag-Reschedule ──────────────────────────────────────────────────────

  const handleEventDrop = useCallback(
    async (id: string, newStart: string, newEnd?: string, newGroup?: string) => {
      const rid = id.split(':')[1] ?? '';
      if (!rid) return;
      const b = buchungen.find(x => x.record_id === rid);
      if (!b) return;

      // Platzkollision prüfen
      if (newGroup) {
        const collision = buchungen.find(x =>
          x.record_id !== rid &&
          x.fields.platz?.key === newGroup &&
          x.fields.status?.key !== 'storniert' &&
          x.fields.anreise && x.fields.abreise &&
          (newEnd
            ? !(newEnd <= x.fields.anreise || newStart >= x.fields.abreise)
            : newStart >= x.fields.anreise && newStart <= (x.fields.abreise ?? newStart))
        );
        if (collision) {
          const hundId = extractRecordId(collision.fields.hund);
          const hund = hundId ? hundeMap.get(hundId) : undefined;
          return tx`Platz belegt${hund?.fields.name ? ` — ${hund.fields.name}` : ''}`;
        }
      }

      const platzPatch = newGroup ? { platz: newGroup } : {};
      const snapshot = buchungen.map(x => ({ ...x }));

      setBuchungen(list => list.map(x =>
        x.record_id === rid
          ? {
              ...x,
              fields: {
                ...x.fields,
                anreise: newStart,
                ...(newEnd ? { abreise: newEnd } : {}),
                ...(newGroup ? { platz: lookupOption('buchungen', 'platz', newGroup) } : {}),
              },
            }
          : x
      ));

      undoToast(
        tx('Buchung verschoben'),
        async () => {
          setBuchungen(snapshot);
          await LivingAppsService.updateBuchungenEntry(rid, {
            anreise: b.fields.anreise,
            abreise: b.fields.abreise,
            ...(b.fields.platz ? { platz: b.fields.platz.key } : {}),
          }).catch(() => fetchAll());
        }
      );

      await LivingAppsService.updateBuchungenEntry(rid, {
        anreise: newStart,
        ...(newEnd ? { abreise: newEnd } : {}),
        ...platzPatch,
      }).catch(() => fetchAll());
    },
    [buchungen, hundeMap, setBuchungen, fetchAll]
  );

  const handleEventResize = useCallback(
    async (id: string, newStart: string, newEnd: string) => {
      const rid = id.split(':')[1] ?? '';
      if (!rid) return;
      const b = buchungen.find(x => x.record_id === rid);
      if (!b) return;
      const snapshot = buchungen.map(x => ({ ...x }));
      setBuchungen(list => list.map(x =>
        x.record_id === rid ? { ...x, fields: { ...x.fields, anreise: newStart, abreise: newEnd } } : x
      ));
      undoToast(
        tx('Buchung angepasst'),
        async () => {
          setBuchungen(snapshot);
          await LivingAppsService.updateBuchungenEntry(rid, {
            anreise: b.fields.anreise,
            abreise: b.fields.abreise,
          }).catch(() => fetchAll());
        }
      );
      await LivingAppsService.updateBuchungenEntry(rid, { anreise: newStart, abreise: newEnd }).catch(() => fetchAll());
    },
    [buchungen, setBuchungen, fetchAll]
  );

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // ─── WorkList-Items ───────────────────────────────────────────────────────

  const anreisenItems = anreisenHeute.map(b => {
    const hundId = extractRecordId(b.fields.hund);
    const hund = hundId ? hundeMap.get(hundId) : undefined;
    const besitzerId = extractRecordId(b.fields.besitzer);
    const besitzerRec = besitzerId ? besitzerMap.get(besitzerId) : undefined;
    const isCheckedIn = b.fields.status?.key === 'anwesend';
    return {
      id: b.record_id,
      title: hund?.fields.name ?? tx('Unbekannter Hund'),
      secondLine: (
        <>
          <span className={isCheckedIn ? 'font-medium text-emerald-600' : 'font-medium text-primary'}>
            {isCheckedIn ? tx('Eingecheckt') : tx('Erwartet')}
          </span>
          {besitzerRec && (
            <span className="text-muted-foreground"> · {besitzerRec.fields.vorname} {besitzerRec.fields.nachname}</span>
          )}
          {b.fields.platz && (
            <span className="text-muted-foreground"> · {b.fields.platz.label}</span>
          )}
        </>
      ),
      action: isCheckedIn
        ? undefined
        : { label: tx('✓ Check-in'), onClick: () => checkIn(b) },
    };
  });

  const abreisenItems = abreisenHeute.map(b => {
    const hundId = extractRecordId(b.fields.hund);
    const hund = hundId ? hundeMap.get(hundId) : undefined;
    const besitzerId = extractRecordId(b.fields.besitzer);
    const besitzerRec = besitzerId ? besitzerMap.get(besitzerId) : undefined;
    const isAbgereist = b.fields.status?.key === 'abgereist';
    return {
      id: b.record_id,
      title: hund?.fields.name ?? tx('Unbekannter Hund'),
      secondLine: (
        <>
          <span className={isAbgereist ? 'text-muted-foreground' : 'font-medium text-amber-600'}>
            {isAbgereist ? tx('Ausgecheckt') : tx('Noch da')}
          </span>
          {besitzerRec && (
            <span className="text-muted-foreground"> · {besitzerRec.fields.vorname} {besitzerRec.fields.nachname}</span>
          )}
        </>
      ),
      action: isAbgereist
        ? undefined
        : { label: tx('✓ Check-out'), onClick: () => checkOut(b) },
    };
  });

  const anfragenItems = offeneAnfragen.map(a => ({
    id: a.record_id,
    title: `${a.fields.anfrage_vorname ?? ''} ${a.fields.anfrage_nachname ?? ''}`.trim() || tx('Anfrage'),
    secondLine: (
      <>
        <span className="font-medium text-amber-600">{tx('Offen')}</span>
        <span className="text-muted-foreground">
          {' '}· {a.fields.hund_name ?? ''}
          {a.fields.wunsch_anreise ? ` · ${formatDate(a.fields.wunsch_anreise)}` : ''}
        </span>
      </>
    ),
    action: { label: tx('✓ Bestätigen'), onClick: () => confirmAnfrage(a) },
  }));

  const portraetsZumErstellen = enrichedBuchungen
    .filter(b => {
      const abgereist = b.fields.status?.key === 'abgereist';
      if (!abgereist) return false;
      const hatPortraet = pfotenPortraets.some(p => extractRecordId(p.fields.buchung) === b.record_id);
      return !hatPortraet;
    })
    .slice(0, 5);

  const portraetsItems = portraetsZumErstellen.map(b => ({
    id: b.record_id,
    title: b.hundName || tx('Hund'),
    secondLine: (
      <>
        <span className="font-medium text-purple-600">{tx('Kein Porträt')}</span>
        <span className="text-muted-foreground"> · {b.besitzerName}</span>
      </>
    ),
    action: {
      label: tx('Erstellen'),
      onClick: () => crud.pfotenPortraets.openCreate({
        hund: extractRecordId(b.fields.hund) ?? undefined,
        besitzer: extractRecordId(b.fields.besitzer) ?? undefined,
        buchung: b.record_id,
        erstellungsdatum: format(clock, 'yyyy-MM-dd'),
      }),
    },
  }));

  return (
    <div className="space-y-6">
      {/* Seiten-Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {gruss(clock)}
          </h1>
          <p className="mt-1 text-muted-foreground">{contextLine}</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
          onClick={() => crud.buchungen.openCreate({ status: 'geplant' })}
        >
          <IconPlus size={16} className="shrink-0" />
          {tx('Neue Buchung')}
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={
          offeneAnfragen.length > 0 && heroAnfrage ? (
            <HeroBanner
              icon={<IconAlertTriangle size={18} />}
              action={{
                label: tx('Anfrage bestätigen'),
                onClick: () => confirmAnfrage(heroAnfrage),
              }}
            >
              <b>{heroAnfrageName}</b>{' '}
              {tx('hat eine unverbindliche Buchungsanfrage gestellt')}
              {heroAnfrage.fields.hund_name ? ` — ${heroAnfrage.fields.hund_name}` : ''}
              {heroAnfrage.fields.wunsch_anreise ? `, ${formatDate(heroAnfrage.fields.wunsch_anreise)}` : ''}
              {offeneAnfragen.length > 1 ? tx` (+${offeneAnfragen.length - 1} weitere)` : ''}.
            </HeroBanner>
          ) : undefined
        }
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Belegt')}
              value={anwesend.length}
              icon={<IconBed size={16} className="shrink-0" />}
              tone={anwesend.length >= 12 ? 'destructive' : anwesend.length > 8 ? 'warning' : 'success'}
            />
            <StatStripItem
              title={tx('Frei')}
              value={freePlaetze}
              icon={<IconPaw size={16} className="shrink-0" />}
              tone={freePlaetze === 0 ? 'destructive' : freePlaetze <= 3 ? 'warning' : 'default'}
            />
            <StatStripItem
              title={tx('Anreisen heute')}
              value={anreisenHeute.length}
              icon={<IconCalendar size={16} className="shrink-0" />}
              tone={anreisenHeute.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title={tx('Abreisen heute')}
              value={abreisenHeute.length}
              icon={<IconClockHour4 size={16} className="shrink-0" />}
              tone={abreisenHeute.length > 0 ? 'warning' : 'default'}
            />
            <StatStripItem
              title={tx('Offene Anfragen')}
              value={offeneAnfragen.length}
              icon={<IconAlertTriangle size={16} className="shrink-0" />}
              tone={offeneAnfragen.length > 0 ? 'warning' : 'default'}
            />
          </StatStrip>
        }
        primary={
          <ResourceTimeline
            events={events}
            groups={groups}
            axis="day"
            defaultRange="week"
            locale={dateFnsLocale()}
            onEventClick={ev => {
              const rid = ev.id.split(':')[1] ?? '';
              const b = buchungen.find(x => x.record_id === rid);
              if (b) crud.buchungen.openDetail(b);
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
            renderEvent={(ev, meta) => (
              <div className="flex items-center gap-1 truncate text-xs">
                <IconPaw className="h-3 w-3 shrink-0 opacity-70" />
                {meta.isStart && <span className="truncate font-medium">{ev.title}</span>}
              </div>
            )}
            renderGroupHeader={group => (
              <div className="flex w-full items-center justify-between gap-1">
                <span className="truncate text-sm font-semibold text-foreground">{group.label}</span>
                {(() => {
                  const belegt = anwesend.some(b => b.fields.platz?.key === group.key);
                  return belegt ? (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" title={tx('Belegt')} />
                  ) : (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-slate-200" title={tx('Frei')} />
                  );
                })()}
              </div>
            )}
          />
        }
        aside={
          <>
            {/* Heute: Anreisen & Abreisen */}
            <WorkList
              title={tx('Heute')}
              items={[...anreisenItems, ...abreisenItems]}
              onItemClick={id => {
                const b = buchungen.find(x => x.record_id === id);
                if (b) crud.buchungen.openDetail(b);
              }}
              empty={{
                text: tx('Keine An- oder Abreisen heute.'),
                action: {
                  label: tx('Neue Buchung'),
                  onClick: () => crud.buchungen.openCreate({ status: 'geplant' }),
                },
              }}
              max={6}
            />

            {/* Offene Anfragen */}
            {offeneAnfragen.length > 0 && (
              <WorkList
                title={tx('Buchungsanfragen')}
                items={anfragenItems}
                onItemClick={id => {
                  const a = buchungsanfragen.find(x => x.record_id === id);
                  if (a) crud.buchungsanfragen.openDetail(a);
                }}
                empty={{ text: tx('Keine offenen Anfragen.') }}
                max={5}
              />
            )}

            {/* Pfoten-Porträts erstellen */}
            {portraetsZumErstellen.length > 0 && (
              <WorkList
                title={tx('Pfoten-Porträts erstellen')}
                items={portraetsItems}
                onItemClick={id => {
                  const b = buchungen.find(x => x.record_id === id);
                  if (b) crud.buchungen.openDetail(b);
                }}
                empty={{ text: tx('Alle Porträts erstellt.') }}
                max={4}
              />
            )}
          </>
        }
      />

      {crud.surfaces}
    </div>
  );
}
