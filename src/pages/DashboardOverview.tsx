import { useMemo, useState, useCallback } from 'react';
import { format, parseISO, isToday, isBefore, startOfDay } from 'date-fns';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { APP_IDS, LOOKUP_OPTIONS, lookupOption } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { formatDate, formatCurrency, lookupKey } from '@/lib/formatters';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { tx, dateFnsLocale, appLabel } from '@/i18n';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import {
  ResourceTimeline,
  type ResourceEvent,
  type ResourceGroup,
} from '@/components/widgets/ResourceTimeline';
import {
  IconDog,
  IconCalendar,
  IconAlertCircle,
  IconCheck,
  IconX,
  IconHome,
  IconPlus,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';

const PLAETZE = LOOKUP_OPTIONS['buchungen']?.['platz'] ?? [];

export default function DashboardOverview() {
  const data = useDashboardData();
  const {
    buchungen, setBuchungen, buchungsanfragen, setBuchungsanfragen,
    besitzerMap, hundeMap,
    loading, error, fetchAll,
  } = data;

  const clock = useClock();

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'buchungsanfragen') {
        const req = buchungsanfragen.find(r => r.record_id === top.record.record_id);
        const status = lookupKey(req?.fields.anfrage_status);
        if (status === 'offen') {
          return {
            label: tx('Anfrage bestätigen'),
            onClick: () => confirmAnfrage(top.record.record_id),
          };
        }
      }
      if (top.type === 'buchungen') {
        const buch = buchungen.find(r => r.record_id === top.record.record_id);
        const status = lookupKey(buch?.fields.status);
        if (status === 'geplant') {
          return {
            label: tx('Einchecken'),
            onClick: () => checkIn(top.record.record_id),
          };
        }
        if (status === 'anwesend') {
          return {
            label: tx('Auschecken'),
            onClick: () => checkOut(top.record.record_id),
          };
        }
      }
      return undefined;
    },
  });

  const enrichedBuchungen = crud.enriched.buchungen;

  // ─── Derived data (all above early returns) ───────────────────────────────
  const todayKey = format(clock, 'yyyy-MM-dd');

  const offeneAnfragen = useMemo(
    () => buchungsanfragen.filter(r => lookupKey(r.fields.anfrage_status) === 'offen'),
    [buchungsanfragen]
  );

  const heuteAnreise = useMemo(
    () => enrichedBuchungen.filter(r => r.fields.anreise === todayKey && lookupKey(r.fields.status) !== 'storniert'),
    [enrichedBuchungen, todayKey]
  );

  const heuteAbreise = useMemo(
    () => enrichedBuchungen.filter(r => r.fields.abreise === todayKey && lookupKey(r.fields.status) !== 'storniert'),
    [enrichedBuchungen, todayKey]
  );

  const anwesend = useMemo(
    () => enrichedBuchungen.filter(r => lookupKey(r.fields.status) === 'anwesend'),
    [enrichedBuchungen]
  );

  const auslastung = Math.round((anwesend.length / 12) * 100);

  // ─── ResourceTimeline groups (12 Plätze) ──────────────────────────────────
  const groups = useMemo<ResourceGroup[]>(
    () => PLAETZE.map(p => ({ key: p.key, label: p.label })),
    []
  );

  const events = useMemo<ResourceEvent[]>(
    () =>
      enrichedBuchungen
        .filter(b => !!b.fields.anreise && lookupKey(b.fields.status) !== 'storniert')
        .map(b => {
          const status = lookupKey(b.fields.status);
          const tone =
            status === 'anwesend' ? 'success' as const :
            status === 'abgereist' ? 'default' as const :
            'primary' as const;
          const platzKey = lookupKey(b.fields.platz) ?? '';
          return {
            id: `buchung:${b.record_id}`,
            start: b.fields.anreise!,
            end: b.fields.abreise,
            allDay: true,
            title: b.hundName || b.besitzerName || tx('Buchung'),
            subtitle: b.besitzerName,
            tone,
            group: platzKey,
          };
        }),
    [enrichedBuchungen]
  );

  // ─── Reschedule via drag ───────────────────────────────────────────────────
  const reschedule = useCallback(async (id: string, newStart: string, newEnd?: string, newGroup?: string) => {
    const rid = id.split(':')[1] ?? '';
    if (!rid) return;
    const buchung = buchungen.find(b => b.record_id === rid);
    if (!buchung) return;

    // Check no double-booking on same Platz
    if (newGroup) {
      const conflict = buchungen.find(b =>
        b.record_id !== rid &&
        lookupKey(b.fields.platz) === newGroup &&
        lookupKey(b.fields.status) !== 'storniert' &&
        b.fields.anreise && b.fields.abreise &&
        b.fields.anreise <= (newEnd ?? newStart) &&
        b.fields.abreise >= newStart
      );
      if (conflict) {
        return tx('Dieser Platz ist im gewählten Zeitraum bereits belegt.');
      }
    }

    const platzPatch = newGroup ? { platz: lookupOption('buchungen', 'platz', newGroup) } : {};
    const prevFields = { anreise: buchung.fields.anreise, abreise: buchung.fields.abreise, platz: buchung.fields.platz };

    setBuchungen(prev =>
      prev.map(b =>
        b.record_id === rid
          ? { ...b, fields: { ...b.fields, anreise: newStart, ...(newEnd ? { abreise: newEnd } : {}), ...platzPatch } }
          : b
      )
    );

    try {
      await LivingAppsService.updateBuchungenEntry(rid, {
        anreise: newStart,
        ...(newEnd ? { abreise: newEnd } : {}),
        ...(newGroup ? { platz: newGroup } : {}),
      });
      undoToast(tx`${buchung.record_id} — verschoben`, async () => {
        setBuchungen(prev =>
          prev.map(b => b.record_id === rid ? { ...b, fields: { ...b.fields, ...prevFields } } : b)
        );
        await LivingAppsService.updateBuchungenEntry(rid, {
          anreise: prevFields.anreise ?? '',
          ...(prevFields.abreise ? { abreise: prevFields.abreise } : {}),
          ...(prevFields.platz ? { platz: lookupKey(prevFields.platz) ?? '' } : {}),
        });
      });
    } catch {
      await fetchAll();
    }
  }, [buchungen, setBuchungen, fetchAll]);

  const resize = useCallback(async (id: string, newStart: string, newEnd: string) => {
    const rid = id.split(':')[1] ?? '';
    if (!rid) return;
    const buchung = buchungen.find(b => b.record_id === rid);
    if (!buchung) return;
    const prevAnreise = buchung.fields.anreise;
    const prevAbreise = buchung.fields.abreise;

    setBuchungen(prev =>
      prev.map(b =>
        b.record_id === rid ? { ...b, fields: { ...b.fields, anreise: newStart, abreise: newEnd } } : b
      )
    );
    try {
      await LivingAppsService.updateBuchungenEntry(rid, { anreise: newStart, abreise: newEnd });
      undoToast(tx`${buchung.record_id} — angepasst`, async () => {
        setBuchungen(prev =>
          prev.map(b => b.record_id === rid ? { ...b, fields: { ...b.fields, anreise: prevAnreise, abreise: prevAbreise } } : b)
        );
        await LivingAppsService.updateBuchungenEntry(rid, {
          anreise: prevAnreise ?? '',
          ...(prevAbreise ? { abreise: prevAbreise } : {}),
        });
      });
    } catch {
      await fetchAll();
    }
  }, [buchungen, setBuchungen, fetchAll]);

  // ─── Workflow actions ──────────────────────────────────────────────────────
  const checkIn = useCallback(async (id: string) => {
    const buchung = buchungen.find(b => b.record_id === id);
    if (!buchung) return;
    const prevStatus = buchung.fields.status;
    const newStatus = lookupOption('buchungen', 'status', 'anwesend');
    setBuchungen(prev =>
      prev.map(b => b.record_id === id ? { ...b, fields: { ...b.fields, status: newStatus } } : b)
    );
    try {
      await LivingAppsService.updateBuchungenEntry(id, { status: 'anwesend' });
      const enriched = enrichedBuchungen.find(b => b.record_id === id);
      undoToast(tx`${enriched?.hundName ?? id} — eingecheckt`, async () => {
        setBuchungen(prev =>
          prev.map(b => b.record_id === id ? { ...b, fields: { ...b.fields, status: prevStatus } } : b)
        );
        await LivingAppsService.updateBuchungenEntry(id, { status: lookupKey(prevStatus) ?? 'geplant' });
      });
    } catch {
      await fetchAll();
    }
  }, [buchungen, enrichedBuchungen, setBuchungen, fetchAll]);

  const checkOut = useCallback(async (id: string) => {
    const buchung = buchungen.find(b => b.record_id === id);
    if (!buchung) return;
    const prevStatus = buchung.fields.status;
    const newStatus = lookupOption('buchungen', 'status', 'abgereist');
    setBuchungen(prev =>
      prev.map(b => b.record_id === id ? { ...b, fields: { ...b.fields, status: newStatus } } : b)
    );
    try {
      await LivingAppsService.updateBuchungenEntry(id, { status: 'abgereist' });
      const enriched = enrichedBuchungen.find(b => b.record_id === id);
      undoToast(tx`${enriched?.hundName ?? id} — ausgecheckt`, async () => {
        setBuchungen(prev =>
          prev.map(b => b.record_id === id ? { ...b, fields: { ...b.fields, status: prevStatus } } : b)
        );
        await LivingAppsService.updateBuchungenEntry(id, { status: lookupKey(prevStatus) ?? 'anwesend' });
      });
    } catch {
      await fetchAll();
    }
  }, [buchungen, enrichedBuchungen, setBuchungen, fetchAll]);

  const confirmAnfrage = useCallback(async (id: string) => {
    const anfrage = buchungsanfragen.find(r => r.record_id === id);
    if (!anfrage) return;
    const prevStatus = anfrage.fields.anfrage_status;
    const newStatus = lookupOption('buchungsanfragen', 'anfrage_status', 'bestaetigt');
    setBuchungsanfragen(prev =>
      prev.map(r => r.record_id === id ? { ...r, fields: { ...r.fields, anfrage_status: newStatus } } : r)
    );
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(id, { anfrage_status: 'bestaetigt' });
      const name = [anfrage.fields.anfrage_vorname, anfrage.fields.anfrage_nachname].filter(Boolean).join(' ');
      undoToast(tx`${name} — Anfrage bestätigt`, async () => {
        setBuchungsanfragen(prev =>
          prev.map(r => r.record_id === id ? { ...r, fields: { ...r.fields, anfrage_status: prevStatus } } : r)
        );
        await LivingAppsService.updateBuchungsanfragenEntry(id, { anfrage_status: lookupKey(prevStatus) ?? 'offen' });
      });
    } catch {
      await fetchAll();
    }
  }, [buchungsanfragen, setBuchungsanfragen, fetchAll]);

  const rejectAnfrage = useCallback(async (id: string) => {
    const anfrage = buchungsanfragen.find(r => r.record_id === id);
    if (!anfrage) return;
    const prevStatus = anfrage.fields.anfrage_status;
    const newStatus = lookupOption('buchungsanfragen', 'anfrage_status', 'abgelehnt');
    setBuchungsanfragen(prev =>
      prev.map(r => r.record_id === id ? { ...r, fields: { ...r.fields, anfrage_status: newStatus } } : r)
    );
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(id, { anfrage_status: 'abgelehnt' });
      const name = [anfrage.fields.anfrage_vorname, anfrage.fields.anfrage_nachname].filter(Boolean).join(' ');
      undoToast(tx`${name} — Anfrage abgelehnt`, async () => {
        setBuchungsanfragen(prev =>
          prev.map(r => r.record_id === id ? { ...r, fields: { ...r.fields, anfrage_status: prevStatus } } : r)
        );
        await LivingAppsService.updateBuchungsanfragenEntry(id, { anfrage_status: lookupKey(prevStatus) ?? 'offen' });
      });
    } catch {
      await fetchAll();
    }
  }, [buchungsanfragen, setBuchungsanfragen, fetchAll]);

  // ─── Early returns (after all hooks) ──────────────────────────────────────
  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // ─── Context greeting ──────────────────────────────────────────────────────
  const heute = (() => {
    const parts: string[] = [];
    if (heuteAnreise.length > 0) {
      const names = namen(heuteAnreise.map(b => b.hundName || b.besitzerName));
      parts.push(tx`${names} reist heute an`);
    }
    if (heuteAbreise.length > 0) {
      const names = namen(heuteAbreise.map(b => b.hundName || b.besitzerName));
      parts.push(tx`${names} reist heute ab`);
    }
    if (anwesend.length > 0 && parts.length === 0) {
      const names = namen(anwesend.map(b => b.hundName || b.besitzerName));
      return tx`${names} ${anwesend.length === 1 ? tx('ist') : tx('sind')} aktuell bei dir`;
    }
    if (parts.length === 0) return tx('Heute sind alle Plätze frei.');
    return parts.join(' · ');
  })();

  // ─── Empty state ───────────────────────────────────────────────────────────
  if (buchungen.length === 0 && buchungsanfragen.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <IconDog size={48} className="text-muted-foreground" />
        <div>
          <h2 className="text-lg font-semibold mb-1">{tx('Willkommen in deiner Hundepension!')}</h2>
          <p className="text-muted-foreground text-sm max-w-sm">{tx('Lege deine erste Buchung an, um den Belegungsplan zu sehen.')}</p>
        </div>
        <Button onClick={() => crud.buchungen.openCreate({ status: 'geplant' })}>
          <IconPlus size={16} className="mr-1.5 shrink-0" />
          {tx('Erste Buchung anlegen')}
        </Button>
        {crud.surfaces}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{gruss(clock)}</h1>
          <p className="text-muted-foreground text-sm mt-0.5 truncate">{heute}</p>
        </div>
        <Button onClick={() => crud.buchungen.openCreate({ status: 'geplant' })} className="shrink-0">
          <IconPlus size={16} className="mr-1.5 shrink-0" />
          {tx('Neue Buchung')}
        </Button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={
          offeneAnfragen.length > 0 ? (
            <HeroBanner
              icon={<IconAlertCircle size={18} />}
              action={{
                label: tx('Jetzt bestätigen'),
                onClick: () => crud.buchungsanfragen.openDetail(offeneAnfragen[0]),
              }}
            >
              <b>{namen(offeneAnfragen.map(r => [r.fields.anfrage_vorname, r.fields.anfrage_nachname].filter(Boolean).join(' ')))}</b>{' '}
              {offeneAnfragen.length === 1 ? tx('wartet auf eine Antwort') : tx('warten auf eine Antwort')}
              {offeneAnfragen[0].fields.wunsch_anreise ? (
                <> — {tx('Wunschanreise')} {formatDate(offeneAnfragen[0].fields.wunsch_anreise)}</>
              ) : null}
            </HeroBanner>
          ) : undefined
        }
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Belegt')}
              value={`${anwesend.length}/12`}
              icon={<IconHome size={16} />}
              tone={auslastung >= 100 ? 'warning' : auslastung > 0 ? 'success' : 'default'}
            />
            <StatStripItem
              title={tx('Anreise heute')}
              value={heuteAnreise.length}
              icon={<IconCalendar size={16} />}
              tone={heuteAnreise.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title={tx('Abreise heute')}
              value={heuteAbreise.length}
              icon={<IconCalendar size={16} />}
              tone={heuteAbreise.length > 0 ? 'warning' : 'default'}
            />
            <StatStripItem
              title={tx('Neue Anfragen')}
              value={offeneAnfragen.length}
              icon={<IconDog size={16} />}
              tone={offeneAnfragen.length > 0 ? 'destructive' : 'default'}
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
              const record = enrichedBuchungen.find(b => b.record_id === rid);
              if (record) crud.buchungen.openDetail(record);
            }}
            onEventDrop={reschedule}
            onEventResize={resize}
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
            renderGroupHeader={group => {
              const belegtHeute = enrichedBuchungen.some(
                b =>
                  lookupKey(b.fields.platz) === group.key &&
                  lookupKey(b.fields.status) === 'anwesend'
              );
              return (
                <div className="flex w-full items-center justify-between gap-1">
                  <span className="truncate text-sm font-medium">{group.label}</span>
                  {belegtHeute && (
                    <span className="shrink-0 w-2 h-2 rounded-full bg-emerald-500" title={tx('Belegt')} />
                  )}
                </div>
              );
            }}
          />
        }
        aside={
          <>
            <WorkList
              title={tx('Heute')}
              items={[
                ...heuteAnreise.map(b => ({
                  id: `in:${b.record_id}`,
                  title: b.hundName || b.besitzerName || tx('Unbekannt'),
                  secondLine: (
                    <>
                      <span className="font-medium text-emerald-600">{tx('Anreise')}</span>
                      <span className="text-muted-foreground"> · {b.fields.platz?.label ?? ''}</span>
                    </>
                  ),
                  action: lookupKey(b.fields.status) === 'geplant'
                    ? { label: tx('Einchecken'), onClick: () => checkIn(b.record_id) }
                    : undefined,
                })),
                ...heuteAbreise.map(b => ({
                  id: `out:${b.record_id}`,
                  title: b.hundName || b.besitzerName || tx('Unbekannt'),
                  secondLine: (
                    <>
                      <span className="font-medium text-amber-600">{tx('Abreise')}</span>
                      <span className="text-muted-foreground"> · {b.fields.platz?.label ?? ''}</span>
                    </>
                  ),
                  action: lookupKey(b.fields.status) === 'anwesend'
                    ? { label: tx('Auschecken'), onClick: () => checkOut(b.record_id) }
                    : undefined,
                })),
              ]}
              onItemClick={id => {
                const rid = id.replace(/^(in|out):/, '');
                const record = enrichedBuchungen.find(b => b.record_id === rid);
                if (record) crud.buchungen.openDetail(record);
              }}
              empty={{
                text: tx('Heute keine An- oder Abreisen — alles ruhig!'),
                action: {
                  label: tx('Buchung anlegen'),
                  onClick: () => crud.buchungen.openCreate({ status: 'geplant' }),
                },
              }}
            />
            <WorkList
              title={appLabel('buchungsanfragen')}
              items={offeneAnfragen.slice(0, 6).map(r => ({
                id: r.record_id,
                title: [r.fields.anfrage_vorname, r.fields.anfrage_nachname].filter(Boolean).join(' ') || tx('Unbekannt'),
                secondLine: (
                  <>
                    <span className="text-muted-foreground">
                      {r.fields.hund_name ?? tx('Hund unbekannt')}
                      {r.fields.wunsch_anreise ? ` · ${formatDate(r.fields.wunsch_anreise)}` : ''}
                    </span>
                  </>
                ),
                action: { label: tx('Bestätigen'), onClick: () => confirmAnfrage(r.record_id) },
              }))}
              onItemClick={id => {
                const record = buchungsanfragen.find(r => r.record_id === id);
                if (record) crud.buchungsanfragen.openDetail(record);
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
