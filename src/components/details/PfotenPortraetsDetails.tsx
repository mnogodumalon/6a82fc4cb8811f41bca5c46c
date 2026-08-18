import type { PfotenPortraets, Hunde, Besitzer, Buchungen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { MediaThumbnail } from '@/components/widgets/MediaViewer';

export interface PfotenPortraetsDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: PfotenPortraets;
  /** N:1-Ziel „Hunde": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  hundeList: Hunde[];
  /** Klick auf die Hunde-Relation → overlay.push auf dessen Detail. */
  onOpenHunde?: (record: Hunde) => void;
  /** N:1-Ziel „Besitzer": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  besitzerList: Besitzer[];
  /** Klick auf die Besitzer-Relation → overlay.push auf dessen Detail. */
  onOpenBesitzer?: (record: Besitzer) => void;
  /** N:1-Ziel „Buchungen": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  buchungenList: Buchungen[];
  /** Klick auf die Buchungen-Relation → overlay.push auf dessen Detail. */
  onOpenBuchungen?: (record: Buchungen) => void;
}

export function PfotenPortraetsDetails({
  record,
  hundeList,
  onOpenHunde,
  besitzerList,
  onOpenBesitzer,
  buchungenList,
  onOpenBuchungen,
}: PfotenPortraetsDetailsProps) {
  const hundTarget = hundeList.find(r => r.record_id === extractRecordId(record.fields.hund));
  const besitzerTarget = besitzerList.find(r => r.record_id === extractRecordId(record.fields.besitzer));
  const buchungTarget = buchungenList.find(r => r.record_id === extractRecordId(record.fields.buchung));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('pfoten_portraets', 'widmung')} value={record.fields.widmung} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('pfoten_portraets', 'besondere_erlebnisse')} value={record.fields.besondere_erlebnisse} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('pfoten_portraets', 'hund_foto')} className="md:col-span-2">
          {record.fields.hund_foto ? (
            <MediaThumbnail src={record.fields.hund_foto as string} fit="contain" className="max-h-64 w-full rounded-lg" />
          ) : '—'}
        </RecordField>
        <RecordField label={fieldLabel('pfoten_portraets', 'erstellungsdatum')} value={record.fields.erstellungsdatum} format="date" />
        <RecordField label={fieldLabel('pfoten_portraets', 'zusatztext')} value={record.fields.zusatztext} format="longtext" className="md:col-span-2" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={2}>
        <RecordRelation
          label={fieldLabel('pfoten_portraets', 'hund')}
          name={hundTarget?.fields.name ?? '—'}
          meta={[hundTarget?.fields.tierarzt_telefon].filter(Boolean).join(' · ') || undefined}
          onClick={hundTarget && onOpenHunde ? () => onOpenHunde!(hundTarget!) : undefined}
        />
        <RecordRelation
          label={fieldLabel('pfoten_portraets', 'besitzer')}
          name={besitzerTarget?.fields.vorname ?? '—'}
          meta={[besitzerTarget?.fields.telefon, besitzerTarget?.fields.email].filter(Boolean).join(' · ') || undefined}
          onClick={besitzerTarget && onOpenBesitzer ? () => onOpenBesitzer!(besitzerTarget!) : undefined}
        />
        <RecordRelation
          label={fieldLabel('pfoten_portraets', 'buchung')}
          name={buchungTarget?.fields.interne_notizen ?? '—'}
          meta={undefined}
          onClick={buchungTarget && onOpenBuchungen ? () => onOpenBuchungen!(buchungTarget!) : undefined}
        />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.PFOTEN_PORTRAETS} recordId={record.record_id} />
    </>
  );
}
