import type { Website } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { MediaThumbnail } from '@/components/widgets/MediaViewer';
import { MapRouteLinks } from '@/components/widgets/MapWidget';

export interface WebsiteDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Website;
}

export function WebsiteDetails({
  record,
}: WebsiteDetailsProps) {
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('website', 'unternehmensname')} value={record.fields.unternehmensname} format="text" />
        <RecordField label={fieldLabel('website', 'slogan')} value={record.fields.slogan} format="text" />
        <RecordField label={fieldLabel('website', 'beschreibung')} value={record.fields.beschreibung} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('website', 'leistungen')} value={record.fields.leistungen} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('website', 'anzahl_plaetze')} value={record.fields.anzahl_plaetze} format="text" />
        <RecordField label={fieldLabel('website', 'oeffnungszeiten')} value={record.fields.oeffnungszeiten} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('website', 'website_telefon')} value={record.fields.website_telefon} format="text" />
        <RecordField label={fieldLabel('website', 'website_email')} value={record.fields.website_email} format="email" />
        <RecordField label={fieldLabel('website', 'website_url')} value={record.fields.website_url} format="url" />
        <RecordField label={fieldLabel('website', 'website_strasse')} value={record.fields.website_strasse} format="text" />
        <RecordField label={fieldLabel('website', 'website_hausnummer')} value={record.fields.website_hausnummer} format="text" />
        <RecordField label={fieldLabel('website', 'website_plz')} value={record.fields.website_plz} format="text" />
        <RecordField label={fieldLabel('website', 'website_ort')} value={record.fields.website_ort} format="text" />
        <RecordField label={fieldLabel('website', 'standort')}>
          {record.fields.standort ? (
            <div className="space-y-1">
              <div>{record.fields.standort.info ?? `${record.fields.standort.lat}, ${record.fields.standort.long}`}</div>
              {/* Directions links — the map popup is hover-fleeting; the overlay
                  is the only mobile-reachable place for navigation. */}
              <MapRouteLinks lat={record.fields.standort.lat} long={record.fields.standort.long} />
            </div>
          ) : '—'}
        </RecordField>
        <RecordField label={fieldLabel('website', 'logo')} className="md:col-span-2">
          {record.fields.logo ? (
            <MediaThumbnail src={record.fields.logo as string} fit="contain" className="max-h-64 w-full rounded-lg" />
          ) : '—'}
        </RecordField>
        <RecordField label={fieldLabel('website', 'titelbild')} className="md:col-span-2">
          {record.fields.titelbild ? (
            <MediaThumbnail src={record.fields.titelbild as string} fit="contain" className="max-h-64 w-full rounded-lg" />
          ) : '—'}
        </RecordField>
        <RecordField label={fieldLabel('website', 'galerie_bilder')} className="md:col-span-2">
          {record.fields.galerie_bilder ? (
            <MediaThumbnail src={record.fields.galerie_bilder as string} fit="contain" className="max-h-64 w-full rounded-lg" />
          ) : '—'}
        </RecordField>
        <RecordField label={fieldLabel('website', 'instagram')} value={record.fields.instagram} format="url" />
        <RecordField label={fieldLabel('website', 'facebook')} value={record.fields.facebook} format="url" />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.WEBSITE} recordId={record.record_id} />
    </>
  );
}
