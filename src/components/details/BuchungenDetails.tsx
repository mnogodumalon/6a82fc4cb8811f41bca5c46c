import type { Buchungen, Hunde, Besitzer, PfotenPortraets } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface BuchungenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Buchungen;
  /** N:1-Ziel „Hunde": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  hundeList: Hunde[];
  /** Klick auf die Hunde-Relation → overlay.push auf dessen Detail. */
  onOpenHunde?: (record: Hunde) => void;
  /** N:1-Ziel „Besitzer": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  besitzerList: Besitzer[];
  /** Klick auf die Besitzer-Relation → overlay.push auf dessen Detail. */
  onOpenBesitzer?: (record: Besitzer) => void;
  /** 1:N „Pfoten-Porträts": VOLLE Liste — der Block filtert auf diesen Record. */
  pfotenPortraetsList: PfotenPortraets[];
  /** Zeilen-Klick → overlay.push auf das PfotenPortraets-Detail (nie der Edit-Dialog). */
  onOpenPfotenPortraets: (record: PfotenPortraets) => void;
  /** Kontextuelles „+": öffnet den PfotenPortraets-Dialog mit diesem Record vorgesetzt. */
  onAddPfotenPortraets: () => void;
}

export function BuchungenDetails({
  record,
  hundeList,
  onOpenHunde,
  besitzerList,
  onOpenBesitzer,
  pfotenPortraetsList,
  onOpenPfotenPortraets,
  onAddPfotenPortraets,
}: BuchungenDetailsProps) {
  const hundTarget = hundeList.find(r => r.record_id === extractRecordId(record.fields.hund));
  const besitzerTarget = besitzerList.find(r => r.record_id === extractRecordId(record.fields.besitzer));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('buchungen', 'anreise')} value={record.fields.anreise} format="date" />
        <RecordField label={fieldLabel('buchungen', 'abreise')} value={record.fields.abreise} format="date" />
        <RecordField label={fieldLabel('buchungen', 'platz')} value={record.fields.platz} format="pill" />
        <RecordField label={fieldLabel('buchungen', 'status')} value={record.fields.status} format="pill" />
        <RecordField label={fieldLabel('buchungen', 'preis_gesamt')} value={record.fields.preis_gesamt} format="text" />
        <RecordField label={fieldLabel('buchungen', 'zahlungsstatus')} value={record.fields.zahlungsstatus} format="pill" />
        <RecordField label={fieldLabel('buchungen', 'interne_notizen')} value={record.fields.interne_notizen} format="longtext" className="md:col-span-2" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={2}>
        <RecordRelation
          label={fieldLabel('buchungen', 'hund')}
          name={hundTarget?.fields.name ?? '—'}
          meta={[hundTarget?.fields.tierarzt_telefon].filter(Boolean).join(' · ') || undefined}
          onClick={hundTarget && onOpenHunde ? () => onOpenHunde!(hundTarget!) : undefined}
        />
        <RecordRelation
          label={fieldLabel('buchungen', 'besitzer')}
          name={besitzerTarget?.fields.vorname ?? '—'}
          meta={[besitzerTarget?.fields.telefon, besitzerTarget?.fields.email].filter(Boolean).join(' · ') || undefined}
          onClick={besitzerTarget && onOpenBesitzer ? () => onOpenBesitzer!(besitzerTarget!) : undefined}
        />
      </RecordSection>

      <SatelliteSection
        title={appLabel('pfoten_portraets')}
        items={pfotenPortraetsList.filter(r => extractRecordId(r.fields.buchung) === record.record_id)}
        map={r => ({ name: appLabel('pfoten_portraets'), meta: r.fields.erstellungsdatum })}
        onOpen={onOpenPfotenPortraets}
        onAdd={onAddPfotenPortraets}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.BUCHUNGEN} recordId={record.record_id} />
    </>
  );
}
