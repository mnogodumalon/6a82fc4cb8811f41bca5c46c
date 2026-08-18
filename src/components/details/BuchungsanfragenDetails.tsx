import type { Buchungsanfragen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';

export interface BuchungsanfragenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Buchungsanfragen;
}

export function BuchungsanfragenDetails({
  record,
}: BuchungsanfragenDetailsProps) {
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('buchungsanfragen', 'anfrage_vorname')} value={record.fields.anfrage_vorname} format="text" />
        <RecordField label={fieldLabel('buchungsanfragen', 'anfrage_nachname')} value={record.fields.anfrage_nachname} format="text" />
        <RecordField label={fieldLabel('buchungsanfragen', 'anfrage_telefon')} value={record.fields.anfrage_telefon} format="text" />
        <RecordField label={fieldLabel('buchungsanfragen', 'anfrage_email')} value={record.fields.anfrage_email} format="email" />
        <RecordField label={fieldLabel('buchungsanfragen', 'hund_name')} value={record.fields.hund_name} format="text" />
        <RecordField label={fieldLabel('buchungsanfragen', 'hund_rasse')} value={record.fields.hund_rasse} format="text" />
        <RecordField label={fieldLabel('buchungsanfragen', 'hund_groesse')} value={record.fields.hund_groesse} format="pill" />
        <RecordField label={fieldLabel('buchungsanfragen', 'wunsch_anreise')} value={record.fields.wunsch_anreise} format="date" />
        <RecordField label={fieldLabel('buchungsanfragen', 'wunsch_abreise')} value={record.fields.wunsch_abreise} format="date" />
        <RecordField label={fieldLabel('buchungsanfragen', 'nachricht')} value={record.fields.nachricht} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('buchungsanfragen', 'anfrage_status')} value={record.fields.anfrage_status} format="pill" />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.BUCHUNGSANFRAGEN} recordId={record.record_id} />
    </>
  );
}
