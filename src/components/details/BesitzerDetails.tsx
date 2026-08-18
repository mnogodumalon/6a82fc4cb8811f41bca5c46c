import type { Besitzer, Hunde, Buchungen, PfotenPortraets } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface BesitzerDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Besitzer;
  /** 1:N „Hunde" (besitzer): VOLLE Liste — der Block filtert auf diesen Record. */
  hundeList: Hunde[];
  /** Zeilen-Klick → overlay.push auf das Hunde-Detail (nie der Edit-Dialog). */
  onOpenHunde: (record: Hunde) => void;
  /** Kontextuelles „+": öffnet den Hunde-Dialog mit diesem Record vorgesetzt. */
  onAddHunde: () => void;
  /** 1:N „Buchungen" (besitzer): VOLLE Liste — der Block filtert auf diesen Record. */
  buchungenList: Buchungen[];
  /** Zeilen-Klick → overlay.push auf das Buchungen-Detail (nie der Edit-Dialog). */
  onOpenBuchungen: (record: Buchungen) => void;
  /** Kontextuelles „+": öffnet den Buchungen-Dialog mit diesem Record vorgesetzt. */
  onAddBuchungen: () => void;
  /** 1:N „Pfoten-Porträts" (besitzer): VOLLE Liste — der Block filtert auf diesen Record. */
  pfotenPortraetsList: PfotenPortraets[];
  /** Zeilen-Klick → overlay.push auf das PfotenPortraets-Detail (nie der Edit-Dialog). */
  onOpenPfotenPortraets: (record: PfotenPortraets) => void;
  /** Kontextuelles „+": öffnet den PfotenPortraets-Dialog mit diesem Record vorgesetzt. */
  onAddPfotenPortraets: () => void;
}

export function BesitzerDetails({
  record,
  hundeList,
  onOpenHunde,
  onAddHunde,
  buchungenList,
  onOpenBuchungen,
  onAddBuchungen,
  pfotenPortraetsList,
  onOpenPfotenPortraets,
  onAddPfotenPortraets,
}: BesitzerDetailsProps) {
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('besitzer', 'vorname')} value={record.fields.vorname} format="text" />
        <RecordField label={fieldLabel('besitzer', 'nachname')} value={record.fields.nachname} format="text" />
        <RecordField label={fieldLabel('besitzer', 'telefon')} value={record.fields.telefon} format="text" />
        <RecordField label={fieldLabel('besitzer', 'email')} value={record.fields.email} format="email" />
        <RecordField label={fieldLabel('besitzer', 'strasse')} value={record.fields.strasse} format="text" />
        <RecordField label={fieldLabel('besitzer', 'hausnummer')} value={record.fields.hausnummer} format="text" />
        <RecordField label={fieldLabel('besitzer', 'plz')} value={record.fields.plz} format="text" />
        <RecordField label={fieldLabel('besitzer', 'ort')} value={record.fields.ort} format="text" />
        <RecordField label={fieldLabel('besitzer', 'notizen')} value={record.fields.notizen} format="longtext" className="md:col-span-2" />
      </RecordSection>

      <SatelliteSection
        title={appLabel('hunde')}
        items={hundeList.filter(r => extractRecordId(r.fields.besitzer) === record.record_id)}
        map={r => ({ name: r.fields.name ?? appLabel('hunde'), meta: r.fields.geburtsdatum })}
        onOpen={onOpenHunde}
        onAdd={onAddHunde}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title={appLabel('buchungen')}
        items={buchungenList.filter(r => extractRecordId(r.fields.besitzer) === record.record_id)}
        map={r => ({ name: appLabel('buchungen'), meta: r.fields.anreise })}
        onOpen={onOpenBuchungen}
        onAdd={onAddBuchungen}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title={appLabel('pfoten_portraets')}
        items={pfotenPortraetsList.filter(r => extractRecordId(r.fields.besitzer) === record.record_id)}
        map={r => ({ name: appLabel('pfoten_portraets'), meta: r.fields.erstellungsdatum })}
        onOpen={onOpenPfotenPortraets}
        onAdd={onAddPfotenPortraets}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.BESITZER} recordId={record.record_id} />
    </>
  );
}
