import type { Hunde, Besitzer, Buchungen, PfotenPortraets } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { MediaThumbnail } from '@/components/widgets/MediaViewer';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface HundeDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Hunde;
  /** N:1-Ziel „Besitzer": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  besitzerList: Besitzer[];
  /** Klick auf die Besitzer-Relation → overlay.push auf dessen Detail. */
  onOpenBesitzer?: (record: Besitzer) => void;
  /** 1:N „Buchungen": VOLLE Liste — der Block filtert auf diesen Record. */
  buchungenList: Buchungen[];
  /** Zeilen-Klick → overlay.push auf das Buchungen-Detail (nie der Edit-Dialog). */
  onOpenBuchungen: (record: Buchungen) => void;
  /** Kontextuelles „+": öffnet den Buchungen-Dialog mit diesem Record vorgesetzt. */
  onAddBuchungen: () => void;
  /** 1:N „Pfoten-Porträts": VOLLE Liste — der Block filtert auf diesen Record. */
  pfotenPortraetsList: PfotenPortraets[];
  /** Zeilen-Klick → overlay.push auf das PfotenPortraets-Detail (nie der Edit-Dialog). */
  onOpenPfotenPortraets: (record: PfotenPortraets) => void;
  /** Kontextuelles „+": öffnet den PfotenPortraets-Dialog mit diesem Record vorgesetzt. */
  onAddPfotenPortraets: () => void;
}

export function HundeDetails({
  record,
  besitzerList,
  onOpenBesitzer,
  buchungenList,
  onOpenBuchungen,
  onAddBuchungen,
  pfotenPortraetsList,
  onOpenPfotenPortraets,
  onAddPfotenPortraets,
}: HundeDetailsProps) {
  const besitzerTarget = besitzerList.find(r => r.record_id === extractRecordId(record.fields.besitzer));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('hunde', 'name')} value={record.fields.name} format="text" />
        <RecordField label={fieldLabel('hunde', 'rasse')} value={record.fields.rasse} format="text" />
        <RecordField label={fieldLabel('hunde', 'geburtsdatum')} value={record.fields.geburtsdatum} format="date" />
        <RecordField label={fieldLabel('hunde', 'geschlecht')} value={record.fields.geschlecht} format="pill" />
        <RecordField label={fieldLabel('hunde', 'gewicht_kg')} value={record.fields.gewicht_kg} format="text" />
        <RecordField label={fieldLabel('hunde', 'kastriert')} value={record.fields.kastriert} format="bool" />
        <RecordField label={fieldLabel('hunde', 'impfstatus')} value={record.fields.impfstatus} format="pill" />
        <RecordField label={fieldLabel('hunde', 'impfausweis_foto')} className="md:col-span-2">
          {record.fields.impfausweis_foto ? (
            <MediaThumbnail src={record.fields.impfausweis_foto as string} fit="contain" className="max-h-64 w-full rounded-lg" />
          ) : '—'}
        </RecordField>
        <RecordField label={fieldLabel('hunde', 'fuetterungshinweise')} value={record.fields.fuetterungshinweise} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('hunde', 'medikamente')} value={record.fields.medikamente} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('hunde', 'tierarzt_name')} value={record.fields.tierarzt_name} format="text" />
        <RecordField label={fieldLabel('hunde', 'tierarzt_telefon')} value={record.fields.tierarzt_telefon} format="text" />
        <RecordField label={fieldLabel('hunde', 'foto')} className="md:col-span-2">
          {record.fields.foto ? (
            <MediaThumbnail src={record.fields.foto as string} fit="contain" className="max-h-64 w-full rounded-lg" />
          ) : '—'}
        </RecordField>
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={1}>
        <RecordRelation
          label={fieldLabel('hunde', 'besitzer')}
          name={besitzerTarget?.fields.vorname ?? '—'}
          meta={[besitzerTarget?.fields.telefon, besitzerTarget?.fields.email].filter(Boolean).join(' · ') || undefined}
          onClick={besitzerTarget && onOpenBesitzer ? () => onOpenBesitzer!(besitzerTarget!) : undefined}
        />
      </RecordSection>

      <SatelliteSection
        title={appLabel('buchungen')}
        items={buchungenList.filter(r => extractRecordId(r.fields.hund) === record.record_id)}
        map={r => ({ name: appLabel('buchungen'), meta: r.fields.anreise })}
        onOpen={onOpenBuchungen}
        onAdd={onAddBuchungen}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title={appLabel('pfoten_portraets')}
        items={pfotenPortraetsList.filter(r => extractRecordId(r.fields.hund) === record.record_id)}
        map={r => ({ name: appLabel('pfoten_portraets'), meta: r.fields.erstellungsdatum })}
        onOpen={onOpenPfotenPortraets}
        onAdd={onAddPfotenPortraets}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.HUNDE} recordId={record.record_id} />
    </>
  );
}
