import { useState, useMemo, useCallback } from 'react';
import { format, parseISO, isToday, isBefore, startOfDay } from 'date-fns';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { ResourceTimeline, type ResourceEvent, type ResourceGroup } from '@/components/widgets/ResourceTimeline';
import { tx, appLabel, dateFnsLocale } from '@/i18n';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { formatDate, lookupKey } from '@/lib/formatters';
import { LivingAppsService } from '@/services/livingAppsService';
import { LOOKUP_OPTIONS, lookupOption } from '@/types/app';
import {
  IconDog,
  IconCalendarCheck,
  IconCalendarX,
  IconAlertCircle,
  IconCheck,
  IconX,
  IconPaw,
  IconPlus,
} from '@tabler/icons-react';

export default function DashboardOverview() {
  const data = useDashboardData();
  const {
    buchungen, setBuchungen, buchungsanfragen, setBuchungsanfragen,
    loading, error, fetchAll,
  } = data;

  const clock = useClock();

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'buchungsanfragen') {
        const anfrage = buchungsanfragen.find(a => a.record_id === top.record.record_id);
        if (anfrage && lookupKey(anfrage.fields.anfrage_status) === 'offen') {
          return {
            label: tx('Anfrage bestätigen'),
            onClick: () => confirmAnfrage(anfrage.record_id),
          };
        }
      }
      if (top.type === 'buchungen') {
        const buchung = buchungen.find(b => b.record_id === top.record.record_id);
        const st = lookupKey(buchung?.fields.status);
        if (st === 'geplant') return { label: tx('Check-in bestätigen'), onClick: () => advanceBuchung(top.record.record_id, 'anwesend') };
        if (st === 'anwesend') return { label: tx('Check-out bestätigen'), onClick: () => advanceBuchung(top.record.record_id, 'abgereist') };
      }
      return undefined;
    },
  });

  const enrichedBuchungen = crud.enriched.buchungen;

  const todayKey = format(clock, 'yyyy-MM-dd');

  // ─── Derived state ────────────────────────────────────────────────────────
  const offeneAnfragen = useMemo(
    () => buchungsanfragen.filter(a => lookupKey(a.fields.anfrage_status) === 'offen'),
    [buchungsanfragen],
  );

  const heuteAnreisend = useMemo(
    () => enrichedBuchungen.filter(b => b.fields.anreise === todayKey && lookupKey(b.fields.status) !== 'storniert'),
    [enrichedBuchungen, todayKey],
  );

  const heuteAbreisend = useMemo(
    () => enrichedBuchungen.filter(b => b.fields.abreise === todayKey && lookupKey(b.fields.status) !== 'storniert'),
    [enrichedBuchungen, todayKey],
  );

  const anwesend = useMemo(
    () => enrichedBuchungen.filter(b => lookupKey(b.fields.status) === 'anwesend'),
    [enrichedBuchungen],
  );

  const belegtePlaetze = anwesend.length;
  const freiePlaetze = 12 - belegtePlaetze;

  // ─── ResourceTimeline groups (12 Plätze als Zeilen) ────────────────────
  const groups = useMemo<ResourceGroup[]>(() => {
    const platzOptions = LOOKUP_OPTIONS['buchungen']?.['platz'] ?? [];
    return platzOptions.map(opt => ({ key: opt.key, label: opt.label }));
  }, []);

  // ─── Events: Buchungen → ResourceEvent[] ────────────────────────────────
  const events = useMemo<ResourceEvent[]>(() => {
    return enrichedBuchungen
      .filter(b => !!b.fields.anreise && !!b.fields.platz)
      .map(b => {
        const status = lookupKey(b.fields.status);
        const tone =
          status === 'anwesend' ? 'success' as const
          : status === 'storniert' ? 'default' as const
          : status === 'abgereist' ? 'default' as const
          : 'primary' as const;
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
      });
  }, [enrichedBuchungen]);

  // ─── Drag: Platz wechseln / Datum verschieben ────────────────────────────
  const handleEventDrop = useCallback(async (
    id: string,
    newStart: string,
    newEnd?: string,
    newGroup?: string,
  ) => {
    const rid = id.split(':')[1] ?? '';
    if (!rid) return;
    const prev = buchungen.find(b => b.record_id === rid);
    if (!prev) return;

    // Platz-Konflikt prüfen: Darf dieser Platz in diesem Zeitraum belegt sein?
    if (newGroup) {
      const conflict = buchungen.find(b => {
        if (b.record_id === rid) return false;
        if (lookupKey(b.fields.platz) !== newGroup) return false;
        if (lookupKey(b.fields.status) === 'storniert') return false;
        const bStart = b.fields.anreise ?? '';
        const bEnd = b.fields.abreise ?? bStart;
        const newE = newEnd ?? newStart;
        return bStart <= newE && bEnd >= newStart;
      });
      if (conflict) {
        return tx('Platz bereits belegt in diesem Zeitraum');
      }
    }

    const platzPatch = newGroup ? { platz: lookupOption('buchungen', 'platz', newGroup) } : {};
    // Optimistic update
    setBuchungen(prev2 =>
      prev2.map(b =>
        b.record_id === rid
          ? { ...b, fields: { ...b.fields, anreise: newStart, ...(newEnd ? { abreise: newEnd } : {}), ...platzPatch } }
          : b,
      ),
    );
    try {
      await LivingAppsService.updateBuchungenEntry(rid, {
        anreise: newStart,
        ...(newEnd ? { abreise: newEnd } : {}),
        ...(newGroup ? { platz: newGroup } : {}),
      });
      undoToast(tx('Buchung verschoben'), async () => {
        setBuchungen(prev2 => prev2.map(b => b.record_id === rid ? prev : b));
        await LivingAppsService.updateBuchungenEntry(rid, {
          anreise: prev.fields.anreise,
          abreise: prev.fields.abreise,
          ...(prev.fields.platz ? { platz: lookupKey(prev.fields.platz) } : {}),
        });
      });
    } catch {
      await fetchAll();
    }
  }, [buchungen, setBuchungen, fetchAll]);

  const handleEventResize = useCallback(async (id: string, newStart: string, newEnd: string) => {
    const rid = id.split(':')[1] ?? '';
    if (!rid) return;
    const prev = buchungen.find(b => b.record_id === rid);
    if (!prev) return;
    setBuchungen(prev2 =>
      prev2.map(b =>
        b.record_id === rid
          ? { ...b, fields: { ...b.fields, anreise: newStart, abreise: newEnd } }
          : b,
      ),
    );
    try {
      await LivingAppsService.updateBuchungenEntry(rid, { anreise: newStart, abreise: newEnd });
      undoToast(tx('Zeitraum geändert'), async () => {
        setBuchungen(prev2 => prev2.map(b => b.record_id === rid ? prev : b));
        await LivingAppsService.updateBuchungenEntry(rid, {
          anreise: prev.fields.anreise,
          abreise: prev.fields.abreise,
        });
      });
    } catch {
      await fetchAll();
    }
  }, [buchungen, setBuchungen, fetchAll]);

  // ─── Anfrage bestätigen → neue Buchung ───────────────────────────────────
  const confirmAnfrage = useCallback(async (anfrageId: string) => {
    const anfrage = buchungsanfragen.find(a => a.record_id === anfrageId);
    if (!anfrage) return;
    const prevAnfragen = [...buchungsanfragen];
    setBuchungsanfragen(prev =>
      prev.map(a =>
        a.record_id === anfrageId
          ? { ...a, fields: { ...a.fields, anfrage_status: lookupOption('buchungsanfragen', 'anfrage_status', 'bestaetigt') } }
          : a,
      ),
    );
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(anfrageId, { anfrage_status: 'bestaetigt' });
      undoToast(tx('Anfrage bestätigt'), async () => {
        setBuchungsanfragen(prevAnfragen);
        await LivingAppsService.updateBuchungsanfragenEntry(anfrageId, { anfrage_status: 'offen' });
      });
      // Buchungsdialog mit vorausgefüllten Daten öffnen
      crud.buchungen.openCreate({
        anreise: anfrage.fields.wunsch_anreise,
        abreise: anfrage.fields.wunsch_abreise,
        status: 'geplant',
      });
    } catch {
      await fetchAll();
    }
  }, [buchungsanfragen, setBuchungsanfragen, fetchAll, crud.buchungen]);

  const ablehnenAnfrage = useCallback(async (anfrageId: string) => {
    const prevAnfragen = [...buchungsanfragen];
    setBuchungsanfragen(prev =>
      prev.map(a =>
        a.record_id === anfrageId
          ? { ...a, fields: { ...a.fields, anfrage_status: lookupOption('buchungsanfragen', 'anfrage_status', 'abgelehnt') } }
          : a,
      ),
    );
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(anfrageId, { anfrage_status: 'abgelehnt' });
      undoToast(tx('Anfrage abgelehnt'), async () => {
        setBuchungsanfragen(prevAnfragen);
        await LivingAppsService.updateBuchungsanfragenEntry(anfrageId, { anfrage_status: 'offen' });
      });
    } catch {
      await fetchAll();
    }
  }, [buchungsanfragen, setBuchungsanfragen, fetchAll]);

  // ─── Buchungsstatus vorrücken ────────────────────────────────────────────
  const advanceBuchung = useCallback(async (buchungId: string, newStatus: string) => {
    const prev = buchungen.find(b => b.record_id === buchungId);
    if (!prev) return;
    setBuchungen(prev2 =>
      prev2.map(b =>
        b.record_id === buchungId
          ? { ...b, fields: { ...b.fields, status: lookupOption('buchungen', 'status', newStatus) } }
          : b,
      ),
    );
    const label = newStatus === 'anwesend' ? tx('Check-in gebucht') : tx('Check-out gebucht');
    try {
      await LivingAppsService.updateBuchungenEntry(buchungId, { status: newStatus });
      undoToast(label, async () => {
        setBuchungen(prev2 => prev2.map(b => b.record_id === buchungId ? prev : b));
        await LivingAppsService.updateBuchungenEntry(buchungId, { status: lookupKey(prev.fields.status) });
      });
    } catch {
      await fetchAll();
    }
  }, [buchungen, setBuchungen, fetchAll]);

  // ─── Early returns NACH allen Hooks ──────────────────────────────────────
  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // ─── Kontextzeile ─────────────────────────────────────────────────────────
  const anreiseNamen = namen(heuteAnreisend.map(b => b.hundName || b.besitzerName || ''));
  const abreiseNamen = namen(heuteAbreisend.map(b => b.hundName || b.besitzerName || ''));
  const contextLine = heuteAnreisend.length > 0 && heuteAbreisend.length > 0
    ? tx`${anreiseNamen} kommt heute an — ${abreiseNamen} reist ab.`
    : heuteAnreisend.length > 0
    ? tx`${anreiseNamen} kommt heute an.`
    : heuteAbreisend.length > 0
    ? tx`${abreiseNamen} reist heute ab.`
    : belegtePlaetze > 0
    ? tx`${String(belegtePlaetze)} Hunde genießen ihren Aufenthalt.`
    : tx('Aktuell sind alle Plätze frei.');

  return (
    <div className="space-y-6">
      {/* Seitenkopf */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{gruss(clock)}</h1>
          <p className="mt-1 text-muted-foreground">{contextLine}</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors shrink-0"
          onClick={() => crud.buchungen.openCreate({ status: 'geplant' })}
        >
          <IconPlus size={16} className="shrink-0" />
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
                onClick: () => confirmAnfrage(offeneAnfragen[0].record_id),
              }}
            >
              <b>{namen(offeneAnfragen.map(a => `${a.fields.anfrage_vorname ?? ''} ${a.fields.anfrage_nachname ?? ''}`.trim()))}</b>
              {offeneAnfragen.length === 1
                ? tx` — 1 offene Buchungsanfrage wartet auf deine Bestätigung.`
                : tx` — ${String(offeneAnfragen.length)} offene Buchungsanfragen warten auf deine Bestätigung.`}
            </HeroBanner>
          ) : undefined
        }
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Belegt')}
              value={`${belegtePlaetze}/12`}
              icon={<IconDog size={16} className="shrink-0" />}
              tone={belegtePlaetze > 10 ? 'warning' : belegtePlaetze > 0 ? 'success' : 'default'}
            />
            <StatStripItem
              title={tx('Frei')}
              value={String(freiePlaetze)}
              icon={<IconPaw size={16} className="shrink-0" />}
              tone={freiePlaetze === 0 ? 'warning' : 'default'}
            />
            <StatStripItem
              title={tx('Heute anreisend')}
              value={String(heuteAnreisend.length)}
              icon={<IconCalendarCheck size={16} className="shrink-0" />}
              tone={heuteAnreisend.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title={tx('Heute abreisend')}
              value={String(heuteAbreisend.length)}
              icon={<IconCalendarX size={16} className="shrink-0" />}
              tone={heuteAbreisend.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title={tx('Offene Anfragen')}
              value={String(offeneAnfragen.length)}
              icon={<IconAlertCircle size={16} className="shrink-0" />}
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
            onEventDrop={handleEventDrop}
            onEventResize={handleEventResize}
            onRangeCreate={(start, end, group) => {
              crud.buchungen.openCreate({
                anreise: format(start, 'yyyy-MM-dd'),
                abreise: format(end, 'yyyy-MM-dd'),
                status: 'geplant',
                ...(group ? { platz: group } : {}),
              });
            }}
            onEmptyClick={(date, group) => {
              crud.buchungen.openCreate({
                anreise: format(date, 'yyyy-MM-dd'),
                status: 'geplant',
                ...(group ? { platz: group } : {}),
              });
            }}
          />
        }
        aside={
          <>
            <WorkList
              title={tx('Heute anreisend')}
              items={heuteAnreisend.map(b => ({
                id: b.record_id,
                title: b.hundName || tx('Hund'),
                secondLine: (
                  <>
                    <span className="text-muted-foreground">{b.besitzerName}</span>
                    {b.fields.platz && (
                      <span className="text-muted-foreground"> · {b.fields.platz.label}</span>
                    )}
                    {lookupKey(b.fields.status) === 'anwesend' && (
                      <span className="font-medium text-emerald-600 ml-1"> · {tx('eingecheckt')}</span>
                    )}
                  </>
                ),
                action: lookupKey(b.fields.status) !== 'anwesend'
                  ? { label: tx('✓ Check-in'), onClick: () => advanceBuchung(b.record_id, 'anwesend') }
                  : undefined,
              }))}
              onItemClick={id => {
                const rec = enrichedBuchungen.find(b => b.record_id === id);
                if (rec) crud.buchungen.openDetail(rec);
              }}
              empty={{
                text: tx('Keine Anreisen heute — alles ruhig.'),
              }}
            />
            <WorkList
              title={tx('Offene Anfragen')}
              items={offeneAnfragen.slice(0, 5).map(a => ({
                id: a.record_id,
                title: `${a.fields.hund_name ?? tx('Hund')} (${a.fields.anfrage_vorname ?? ''} ${a.fields.anfrage_nachname ?? ''}`.trim() + ')',
                secondLine: (
                  <>
                    <span className="text-muted-foreground">
                      {a.fields.wunsch_anreise ? formatDate(a.fields.wunsch_anreise) : '—'}
                      {a.fields.wunsch_abreise ? ` – ${formatDate(a.fields.wunsch_abreise)}` : ''}
                    </span>
                    <span className="ml-1 font-medium text-amber-600"> · {tx('offen')}</span>
                  </>
                ),
                action: { label: tx('✓ Bestätigen'), onClick: () => confirmAnfrage(a.record_id) },
              }))}
              onItemClick={id => {
                const rec = buchungsanfragen.find(a => a.record_id === id);
                if (rec) crud.buchungsanfragen.openDetail(rec);
              }}
              empty={{
                text: tx('Keine offenen Anfragen — alles bearbeitet.'),
                action: {
                  label: tx('Anfrage erfassen'),
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
