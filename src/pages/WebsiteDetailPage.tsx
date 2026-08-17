import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import type { Website } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { Button } from '@/components/ui/button';
import { IconArrowLeft, IconTrash } from '@tabler/icons-react';
import {
  RecordView, RecordHeader, RecordKeyFacts, RecordSection, RecordField,
  RecordAttachments, RecordViewSkeleton, RecordViewEmpty,
} from '@/components/widgets/RecordView';
import { WebsiteDialog } from '@/components/dialogs/WebsiteDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { formEnhancements } from '@/config/form-enhancements/Website';
import { evalComputed } from '@/config/form-enhancements/types';
import { t, appLabel, fieldLabel, localeTag, CURRENCY } from '@/i18n';

export default function WebsiteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<Website | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      const list = await LivingAppsService.getWebsite();
      setRecord(list.find(r => r.record_id === id) ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(fields: Website['fields']) {
    if (!record) return;
    await LivingAppsService.updateWebsiteEntry(record.record_id, fields);
    await loadData();
    setEditing(false);
  }

  async function handleDelete() {
    if (!record) return;
    await LivingAppsService.deleteWebsiteEntry(record.record_id);
    setDeleteOpen(false);
    navigate('/website');
  }

  if (loading) {
    return <RecordViewSkeleton />;
  }

  if (!record) {
    return (
      <RecordViewEmpty
        title={t('not_found')}
        action={
          <Button variant="ghost" onClick={() => navigate('/website')}>
            <IconArrowLeft className="h-4 w-4 mr-1.5" />
            {t('back')}
          </Button>
        }
      />
    );
  }

  return (
    <RecordView
      onBack={() => navigate('/website')}
      onEdit={() => setEditing(true)}
      backLabel={t('back')}
      editLabel={t('edit_button')}
    >
      <RecordHeader title={record.fields.unternehmensname ?? appLabel('website')} />

      {(() => {
        const lookupLists: Record<string, unknown> = {
        };
        const fmtComputed = (k: string, n: number) =>
          /(?:kosten|preis|betrag|gesamt|netto|brutto|summe|mwst|rabatt|anzahlung|umsatz|saldo)/i.test(k)
            ? n.toLocaleString(localeTag(), { style: 'currency', currency: CURRENCY, minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : n.toLocaleString(localeTag(), { maximumFractionDigits: 2 });
        const computedFacts = Object.entries(formEnhancements.computed)
          .map(([key, formula]) => {
            const v = evalComputed(formula, record!.fields as Record<string, unknown>, { lookupLists });
            return v != null
              ? { label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '), value: fmtComputed(key, v) }
              : null;
          })
          .filter((f): f is { label: string; value: string } => f !== null);
        return computedFacts.length > 0 ? <RecordKeyFacts items={computedFacts} /> : null;
      })()}

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
        <RecordField label={fieldLabel('website', 'instagram')} value={record.fields.instagram} format="url" />
        <RecordField label={fieldLabel('website', 'facebook')} value={record.fields.facebook} format="url" />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.WEBSITE} recordId={record.record_id} />

      <div className="flex justify-end pt-2">
        <Button variant="ghost" onClick={() => setDeleteOpen(true)} className="text-destructive hover:text-destructive">
          <IconTrash className="h-4 w-4 mr-1.5" />
          {t('delete')}
        </Button>
      </div>

      <WebsiteDialog
        open={editing}
        onClose={() => setEditing(false)}
        onSubmit={handleUpdate}
        defaultValues={record.fields}
        recordId={record.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Website']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Website']}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title={t('delete_entity', { entity: appLabel('website') })}
        description={t('confirm_delete_desc')}
      />
    </RecordView>
  );
}
