import { useDashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { ResourceTimeline, type ResourceEvent, type ResourceGroup } from '@/components/widgets/ResourceTimeline';
import { tx, appLabel } from '@/i18n';
import { dateFnsLocale } from '@/i18n';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { format, parseISO, isToday, isBefore, startOfDay } from 'date-fns';
import { lookupKey, formatDate, formatCurrency } from '@/lib/formatters';
import { lookupOption, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { useState, useMemo, useCallback } from 'react';
import {
  IconDog,
  IconCalendar,
  IconAlertTriangle,
  IconHome,
  IconClipboardCheck,
  IconStar,
} from '@tabler/icons-react';

// Tone für Buchungsstatus
function toneForStatus(key: string | undefined) {
  if (key === 'anwesend') return 'success' as const;
  if (key === 'geplant') return 'primary' as const;
  if (key === 'storniert') return 'destructive' as const;
  return 'default' as const;
}

// Platz-Lookup → ResourceGroup Key
const PLATZ_OPTIONS = LOOKUP_OPTIONS['buchungen']?.['platz'] ?? [];

export default function DashboardOverview() {
  const data = useDashboardData();
  const {
    buchungen, buchungsanfragen, besitzer, hunde,
    besitzerMap, hundeMap, buchungenMap,
    setBuchungen, setBuchungsanfragen,
    loading, error, fetchAll,
  } = data;

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'buchungsanfragen') {
        const r = top.record;
        const statusKey = lookupKey(r.fields.anfrage_status);
        if (statusKey === 'offen') {
          return {
            label: tx('Anfrage bestätigen'),
            onClick: async () => {
              const prev = [...buchungsanfragen];
              setBuchungsanfragen(prev.map(a =>
                a.record_id === r.record_id
                  ? { ...a, fields: { ...a.fields, anfrage_status: lookupOption('buchungsanfragen', 'anfrage_status', 'bestaetigt') } }
                  : a
              ));
              try {
                await LivingAppsService.updateBuchungsanfragenEntry(r.record_id, { anfrage_status: 'bestaetigt' });
                undoToast(tx`${r.fields.anfrage_vorname ?? ''} ${r.fields.anfrage_nachname ?? ''} — Anfrage bestätigt`, async () => {
                  setBuchungsanfragen(prev);
                  await LivingAppsService.updateBuchungsanfragenEntry(r.record_id, { anfrage_status: 'offen' });
                });
                await fetchAll();
              } catch {
                setBuchungsanfragen(prev);
                await fetchAll();
              }
            },
          };
        }
      }
      if (top.type === 'buchungen') {
        const r = top.record;
        const statusKey = lookupKey(r.fields.status);
        if (statusKey === 'geplant') {
          return {
            label: tx('Anreise bestätigen'),
            onClick: async () => {
              const prev = [...buchungen];
              setBuchungen(prev.map(b =>
                b.record_id === r.record_id
                  ? { ...b, fields: { ...b.fields, status: lookupOption('buchungen', 'status', 'anwesend') } }
                  : b
              ));
              try {
                await LivingAppsService.updateBuchungenEntry(r.record_id, { status: 'anwesend' });
                undoToast(tx`Anreise bestätigt`, async () => {
                  setBuchungen(prev);
                  await LivingAppsService.updateBuchungenEntry(r.record_id, { status: 'geplant' });
                });
              } catch {
                setBuchungen(prev);
                await fetchAll();
              }
            },
          };
        }
        if (statusKey === 'anwesend') {
          return {
            label: tx('Abreise eintragen'),
            onClick: async () => {
              const prev = [...buchungen];
              setBuchungen(prev.map(b =>
                b.record_id === r.record_id
                  ? { ...b, fields: { ...b.fields, status: lookupOption('buchungen', 'status', 'abgereist') } }
                  : b
              ));
              try {
                await LivingAppsService.updateBuchungenEntry(r.record_id, { status: 'abgereist' });
                undoToast(tx`Abreise eingetragen`, async () => {
                  setBuchungen(prev);
                  await LivingAppsService.updateBuchungenEntry(r.record_id, { status: 'anwesend' });
                });
              } catch {
                setBuchungen(prev);
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

  const clock = useClock();

  // Timeline groups: alle 12 Plätze als feste Rows
  const groups = useMemo<ResourceGroup[]>(
    () => PLATZ_OPTIONS.map(p => ({ key: p.key, label: p.label })),
    []
  );

  // Buchungen → ResourceEvents
  const events = useMemo<ResourceEvent[]>(() =>
    enrichedBuchungen
      .filter(b => !!b.fields.anreise && lookupKey(b.fields.status) !== 'storniert')
      .map(b => ({
        id: `buchung:${b.record_id}`,
        start: b.fields.anreise!,
        end: b.fields.abreise,
        allDay: true,
        title: b.hundName || b.besitzerName || tx('Unbekannt'),
        subtitle: b.besitzerName,
        tone: toneForStatus(lookupKey(b.fields.status)),
        group: lookupKey(b.fields.platz) ?? '',
      })),
    [enrichedBuchungen]
  );

  // Heutige An- und Abreisen
  const todayKey = format(clock, 'yyyy-MM-dd');

  const anreisenHeute = useMemo(() =>
    enrichedBuchungen.filter(b => b.fields.anreise === todayKey && lookupKey(b.fields.status) !== 'storniert'),
    [enrichedBuchungen, todayKey]
  );

  const abreisenHeute = useMemo(() =>
    enrichedBuchungen.filter(b => b.fields.abreise === todayKey && lookupKey(b.fields.status) !== 'storniert'),
    [enrichedBuchungen, todayKey]
  );

  // Offene Buchungsanfragen
  const offeneAnfragen = useMemo(() =>
    buchungsanfragen.filter(a => lookupKey(a.fields.anfrage_status) === 'offen'),
    [buchungsanfragen]
  );

  // Aktuell anwesende Hunde
  const anwesend = useMemo(() =>
    buchungen.filter(b => lookupKey(b.fields.status) === 'anwesend'),
    [buchungen]
  );

  // Freie Plätze heute
  const belegtePlaetzeHeute = useMemo(() => {
    const belegt = new Set<string>();
    buchungen.forEach(b => {
      const status = lookupKey(b.fields.status);
      if (status === 'storniert' || status === 'abgereist') return;
      const anreise = b.fields.anreise;
      const abreise = b.fields.abreise;
      if (!anreise) return;
      if (anreise <= todayKey && (!abreise || abreise >= todayKey)) {
        const platz = lookupKey(b.fields.platz);
        if (platz) belegt.add(platz);
      }
    });
    return belegt.size;
  }, [buchungen, todayKey]);

  const freie_plaetze = 12 - belegtePlaetzeHeute;

  // Bestätigen-Handler für Buchungsanfragen
  const confirmAnfrage = useCallback(async (anfrage: (typeof buchungsanfragen)[0]) => {
    const prev = [...buchungsanfragen];
    setBuchungsanfragen(prev.map(a =>
      a.record_id === anfrage.record_id
        ? { ...a, fields: { ...a.fields, anfrage_status: lookupOption('buchungsanfragen', 'anfrage_status', 'bestaetigt') } }
        : a
    ));
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(anfrage.record_id, { anfrage_status: 'bestaetigt' });
      undoToast(
        tx`${anfrage.fields.anfrage_vorname ?? ''} ${anfrage.fields.anfrage_nachname ?? ''} — Anfrage bestätigt`,
        async () => {
          setBuchungsanfragen(prev);
          await LivingAppsService.updateBuchungsanfragenEntry(anfrage.record_id, { anfrage_status: 'offen' });
        }
      );
    } catch {
      setBuchungsanfragen(prev);
      await fetchAll();
    }
  }, [buchungsanfragen, setBuchungsanfragen, fetchAll]);

  // Check-in Handler für Buchungen
  const checkIn = useCallback(async (buchung: (typeof buchungen)[0]) => {
    const prev = [...buchungen];
    setBuchungen(prev.map(b =>
      b.record_id === buchung.record_id
        ? { ...b, fields: { ...b.fields, status: lookupOption('buchungen', 'status', 'anwesend') } }
        : b
    ));
    try {
      await LivingAppsService.updateBuchungenEntry(buchung.record_id, { status: 'anwesend' });
      const hundId = buchung.fields.hund ? buchung.fields.hund.split('/').pop() ?? '' : '';
      const hundName = hundId && hundeMap.get(hundId)?.fields.name || tx('Hund');
      undoToast(tx`${hundName} — eingecheckt`, async () => {
        setBuchungen(prev);
        await LivingAppsService.updateBuchungenEntry(buchung.record_id, { status: 'geplant' });
      });
    } catch {
      setBuchungen(prev);
      await fetchAll();
    }
  }, [buchungen, setBuchungen, hundeMap, fetchAll]);

  // Check-out Handler für Buchungen
  const checkOut = useCallback(async (buchung: (typeof buchungen)[0]) => {
    const prev = [...buchungen];
    setBuchungen(prev.map(b =>
      b.record_id === buchung.record_id
        ? { ...b, fields: { ...b.fields, status: lookupOption('buchungen', 'status', 'abgereist') } }
        : b
    ));
    try {
      await LivingAppsService.updateBuchungenEntry(buchung.record_id, { status: 'abgereist' });
      const hundId = buchung.fields.hund ? buchung.fields.hund.split('/').pop() ?? '' : '';
      const hundName = hundId && hundeMap.get(hundId)?.fields.name || tx('Hund');
      undoToast(tx`${hundName} — ausgecheckt`, async () => {
        setBuchungen(prev);
        await LivingAppsService.updateBuchungenEntry(buchung.record_id, { status: 'anwesend' });
      });
    } catch {
      setBuchungen(prev);
      await fetchAll();
    }
  }, [buchungen, setBuchungen, hundeMap, fetchAll]);

  // Drag-Reschedule und Resize
  const onEventDrop = useCallback(async (id: string, newStart: string, newEnd?: string, newGroup?: string) => {
    const recordId = id.split(':')[1] ?? '';
    if (!recordId) return;
    const prev = [...buchungen];
    const patch: Record<string, unknown> = { anreise: newStart };
    if (newEnd) patch.abreise = newEnd;
    if (newGroup) patch.platz = newGroup;
    setBuchungen(prev.map(b =>
      b.record_id === recordId
        ? {
            ...b,
            fields: {
              ...b.fields,
              anreise: newStart,
              ...(newEnd ? { abreise: newEnd } : {}),
              ...(newGroup ? { platz: lookupOption('buchungen', 'platz', newGroup) } : {}),
            },
          }
        : b
    ));
    try {
      await LivingAppsService.updateBuchungenEntry(recordId, patch as any);
      undoToast(tx('Buchung verschoben'), async () => {
        setBuchungen(prev);
        const b = prev.find(x => x.record_id === recordId);
        if (b) await LivingAppsService.updateBuchungenEntry(recordId, {
          anreise: b.fields.anreise,
          abreise: b.fields.abreise,
          platz: lookupKey(b.fields.platz),
        } as any);
      });
    } catch {
      setBuchungen(prev);
      await fetchAll();
    }
  }, [buchungen, setBuchungen, fetchAll]);

  const onEventResize = useCallback(async (id: string, newStart: string, newEnd: string) => {
    const recordId = id.split(':')[1] ?? '';
    if (!recordId) return;
    const prev = [...buchungen];
    setBuchungen(prev.map(b =>
      b.record_id === recordId
        ? { ...b, fields: { ...b.fields, anreise: newStart, abreise: newEnd } }
        : b
    ));
    try {
      await LivingAppsService.updateBuchungenEntry(recordId, { anreise: newStart, abreise: newEnd });
      undoToast(tx('Buchungszeitraum angepasst'), async () => {
        setBuchungen(prev);
        const b = prev.find(x => x.record_id === recordId);
        if (b) await LivingAppsService.updateBuchungenEntry(recordId, { anreise: b.fields.anreise, abreise: b.fields.abreise });
      });
    } catch {
      setBuchungen(prev);
      await fetchAll();
    }
  }, [buchungen, setBuchungen, fetchAll]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // Kontext-Zeile
  const anreiseNamen = anreisenHeute.map(b => {
    const hundId = b.fields.hund ? b.fields.hund.split('/').pop() ?? '' : '';
    return hundeMap.get(hundId)?.fields.name ?? b.hundName ?? '';
  }).filter(Boolean);

  const abreiseNamen = abreisenHeute.map(b => {
    const hundId = b.fields.hund ? b.fields.hund.split('/').pop() ?? '' : '';
    return hundeMap.get(hundId)?.fields.name ?? b.hundName ?? '';
  }).filter(Boolean);

  let kontextSatz: string;
  if (anreiseNamen.length === 0 && abreiseNamen.length === 0) {
    if (anwesend.length > 0) {
      kontextSatz = tx`${anwesend.length} Hunde gerade zu Gast — ruhiger Tag heute.`;
    } else {
      kontextSatz = tx('Heute keine An- oder Abreisen.');
    }
  } else if (anreiseNamen.length > 0 && abreiseNamen.length === 0) {
    kontextSatz = tx`${namen(anreiseNamen)} reist heute an.`;
  } else if (anreiseNamen.length === 0 && abreiseNamen.length > 0) {
    kontextSatz = tx`${namen(abreiseNamen)} reist heute ab.`;
  } else {
    kontextSatz = tx`${namen(anreiseNamen)} kommt, ${namen(abreiseNamen)} reist ab.`;
  }

  // Hero: Offene Anfragen als wichtigstes Signal
  const hero = offeneAnfragen.length > 0 ? (
    <HeroBanner
      icon={<IconClipboardCheck size={18} />}
      action={{
        label: tx('Jetzt bestätigen'),
        onClick: () => confirmAnfrage(offeneAnfragen[0]),
      }}
    >
      <b>{offeneAnfragen.length === 1
        ? tx`${offeneAnfragen[0].fields.anfrage_vorname ?? ''} ${offeneAnfragen[0].fields.anfrage_nachname ?? ''}`
        : tx`${offeneAnfragen.length} neue Buchungsanfragen`
      }</b>{' '}
      {offeneAnfragen.length === 1
        ? tx`wartet auf Bestätigung — ${offeneAnfragen[0].fields.hund_name ?? ''} vom ${formatDate(offeneAnfragen[0].fields.wunsch_anreise ?? '')} bis ${formatDate(offeneAnfragen[0].fields.wunsch_abreise ?? '')}.`
        : tx`warten auf deine Bestätigung.`
      }
    </HeroBanner>
  ) : undefined;

  // Empty State
  if (buchungen.length === 0 && buchungsanfragen.length === 0 && hunde.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{gruss(clock)}</h1>
          <p className="text-muted-foreground mt-1">{tx('Richte deine Hundepension ein.')}</p>
        </div>
        <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-xl border border-dashed border-border">
          <IconDog size={48} className="text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold text-foreground">{tx('Willkommen in deiner Pfotenpension!')}</h3>
            <p className="text-muted-foreground mt-1 max-w-sm">{tx('Lege deinen ersten Hund an und erstelle deine erste Buchung.')}</p>
          </div>
          <div className="flex gap-3 flex-wrap justify-center">
            <button
              onClick={() => crud.hunde.openCreate({})}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <IconDog size={16} />
              {tx('Ersten Hund anlegen')}
            </button>
            <button
              onClick={() => crud.buchungen.openCreate({})}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <IconCalendar size={16} />
              {tx('Erste Buchung erstellen')}
            </button>
          </div>
        </div>
        {crud.surfaces}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{gruss(clock)}</h1>
          <p className="text-muted-foreground mt-1">{kontextSatz}</p>
        </div>
        <button
          onClick={() => crud.buchungen.openCreate({ anreise: format(clock, 'yyyy-MM-dd') })}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
        >
          <IconCalendar size={16} />
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
              value={anwesend.length}
              icon={<IconDog size={16} />}
              tone={anwesend.length > 0 ? 'success' : 'default'}
            />
            <StatStripItem
              title={tx('Freie Plätze')}
              value={freie_plaetze}
              icon={<IconHome size={16} />}
              tone={freie_plaetze === 0 ? 'warning' : 'default'}
            />
            <StatStripItem
              title={tx('Anreisen heute')}
              value={anreisenHeute.length}
              icon={<IconCalendar size={16} />}
              tone={anreisenHeute.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title={tx('Abreisen heute')}
              value={abreisenHeute.length}
              icon={<IconCalendar size={16} />}
              tone={abreisenHeute.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title={tx('Offene Anfragen')}
              value={offeneAnfragen.length}
              icon={<IconClipboardCheck size={16} />}
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
              const recordId = ev.id.split(':')[1] ?? '';
              const b = buchungen.find(x => x.record_id === recordId);
              if (b) crud.buchungen.openDetail(b);
            }}
            onEventDrop={onEventDrop}
            onEventResize={onEventResize}
            onRangeCreate={(start, end, group) => {
              crud.buchungen.openCreate({
                anreise: format(start, 'yyyy-MM-dd'),
                abreise: format(end, 'yyyy-MM-dd'),
                platz: group,
              });
            }}
            onEmptyClick={(date, group) => {
              crud.buchungen.openCreate({
                anreise: format(date, 'yyyy-MM-dd'),
                platz: group,
              });
            }}
          />
        }
        aside={
          <>
            <WorkList
              title={tx('Anreisen heute')}
              items={anreisenHeute.map(b => {
                const hundId = b.fields.hund ? b.fields.hund.split('/').pop() ?? '' : '';
                const hundName = hundeMap.get(hundId)?.fields.name ?? b.hundName ?? tx('Unbekannt');
                const statusKey = lookupKey(b.fields.status);
                const platzLabel = b.fields.platz ? (typeof b.fields.platz === 'object' ? (b.fields.platz as any).label : b.fields.platz) : '';
                return {
                  id: b.record_id,
                  title: hundName,
                  secondLine: (
                    <>
                      <span className={statusKey === 'anwesend' ? 'font-medium text-emerald-600' : 'font-medium text-blue-600'}>
                        {statusKey === 'anwesend' ? tx('Eingecheckt') : tx('Geplant')}
                      </span>
                      {platzLabel ? <span className="text-muted-foreground"> · {platzLabel}</span> : null}
                    </>
                  ),
                  action: statusKey === 'geplant'
                    ? { label: tx('✓ Einchecken'), onClick: () => checkIn(b) }
                    : undefined,
                };
              })}
              onItemClick={id => {
                const b = buchungen.find(x => x.record_id === id);
                if (b) crud.buchungen.openDetail(b);
              }}
              empty={{
                text: anwesend.length > 0
                  ? tx`${anwesend.length} Hunde sind aktuell zu Gast`
                  : tx('Keine Anreisen heute.'),
                action: { label: tx('Buchung erstellen'), onClick: () => crud.buchungen.openCreate({ anreise: format(clock, 'yyyy-MM-dd') }) },
              }}
            />
            <WorkList
              title={tx('Abreisen heute')}
              items={abreisenHeute.map(b => {
                const hundId = b.fields.hund ? b.fields.hund.split('/').pop() ?? '' : '';
                const hundName = hundeMap.get(hundId)?.fields.name ?? b.hundName ?? tx('Unbekannt');
                const statusKey = lookupKey(b.fields.status);
                const besitzerRecord = b.fields.besitzer ? besitzerMap.get(b.fields.besitzer.split('/').pop() ?? '') : undefined;
                return {
                  id: b.record_id,
                  title: hundName,
                  secondLine: (
                    <>
                      <span className={statusKey === 'abgereist' ? 'text-muted-foreground' : 'font-medium text-amber-600'}>
                        {statusKey === 'abgereist' ? tx('Ausgecheckt') : tx('Noch anwesend')}
                      </span>
                      {besitzerRecord ? <span className="text-muted-foreground"> · {besitzerRecord.fields.vorname} {besitzerRecord.fields.nachname}</span> : null}
                    </>
                  ),
                  action: statusKey === 'anwesend'
                    ? { label: tx('✓ Auschecken'), onClick: () => checkOut(b) }
                    : undefined,
                };
              })}
              onItemClick={id => {
                const b = buchungen.find(x => x.record_id === id);
                if (b) crud.buchungen.openDetail(b);
              }}
              empty={{
                text: tx('Keine Abreisen heute.'),
              }}
            />
            <WorkList
              title={tx('Offene Anfragen')}
              items={offeneAnfragen.slice(0, 5).map(a => ({
                id: a.record_id,
                title: `${a.fields.anfrage_vorname ?? ''} ${a.fields.anfrage_nachname ?? ''}`.trim() || tx('Unbekannt'),
                secondLine: (
                  <>
                    <span className="font-medium text-amber-600">{tx('Offen')}</span>
                    {a.fields.hund_name ? <span className="text-muted-foreground"> · {a.fields.hund_name}</span> : null}
                    {a.fields.wunsch_anreise ? <span className="text-muted-foreground"> · {formatDate(a.fields.wunsch_anreise)}</span> : null}
                  </>
                ),
                action: { label: tx('✓ Bestätigen'), onClick: () => confirmAnfrage(a) },
              }))}
              onItemClick={id => {
                const a = buchungsanfragen.find(x => x.record_id === id);
                if (a) crud.buchungsanfragen.openDetail(a);
              }}
              empty={{
                text: tx('Keine offenen Anfragen.'),
                action: { label: tx('Anfragen verwalten'), onClick: () => crud.buchungsanfragen.openCreate({}) },
              }}
            />
          </>
        }
      />

      {crud.surfaces}
    </div>
  );
}
