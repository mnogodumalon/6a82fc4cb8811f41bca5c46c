import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import type { PfotenPortraets, Hunde, Besitzer, Buchungen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { Button } from '@/components/ui/button';
import { IconArrowLeft, IconTrash } from '@tabler/icons-react';
import {
  RecordView, RecordHeader, RecordKeyFacts, RecordSection, RecordField,
  RecordAttachments, RecordViewSkeleton, RecordViewEmpty,
} from '@/components/widgets/RecordView';
import { PfotenPortraetsDialog } from '@/components/dialogs/PfotenPortraetsDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { formEnhancements } from '@/config/form-enhancements/PfotenPortraets';
import { evalComputed } from '@/config/form-enhancements/types';
import { t, appLabel, fieldLabel, localeTag, CURRENCY } from '@/i18n';

export default function PfotenPortraetsDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<PfotenPortraets | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [hundeList, setHundeList] = useState<Hunde[]>([]);
  const [besitzerList, setBesitzerList] = useState<Besitzer[]>([]);
  const [buchungenList, setBuchungenList] = useState<Buchungen[]>([]);

  useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      const [mainData, hundeData, besitzerData, buchungenData] = await Promise.all([
        LivingAppsService.getPfotenPortraets(),
        LivingAppsService.getHunde(),
        LivingAppsService.getBesitzer(),
        LivingAppsService.getBuchungen(),
      ]);
      setHundeList(hundeData);
      setBesitzerList(besitzerData);
      setBuchungenList(buchungenData);
      setRecord(mainData.find(r => r.record_id === id) ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(fields: PfotenPortraets['fields']) {
    if (!record) return;
    await LivingAppsService.updatePfotenPortraet(record.record_id, fields);
    await loadData();
    setEditing(false);
  }

  async function handleDelete() {
    if (!record) return;
    await LivingAppsService.deletePfotenPortraet(record.record_id);
    setDeleteOpen(false);
    navigate('/pfoten-portraets');
  }

  function getHundeDisplayName(url?: unknown) {
    if (!url) return '—';
    const refId = extractRecordId(url);
    return hundeList.find(r => r.record_id === refId)?.fields.name ?? '—';
  }

  function getBesitzerDisplayName(url?: unknown) {
    if (!url) return '—';
    const refId = extractRecordId(url);
    return besitzerList.find(r => r.record_id === refId)?.fields.vorname ?? '—';
  }

  function getBuchungenDisplayName(url?: unknown) {
    if (!url) return '—';
    const refId = extractRecordId(url);
    return buchungenList.find(r => r.record_id === refId)?.fields.interne_notizen ?? '—';
  }

  if (loading) {
    return <RecordViewSkeleton />;
  }

  if (!record) {
    return (
      <RecordViewEmpty
        title={t('not_found')}
        action={
          <Button variant="ghost" onClick={() => navigate('/pfoten-portraets')}>
            <IconArrowLeft className="h-4 w-4 mr-1.5" />
            {t('back')}
          </Button>
        }
      />
    );
  }

  return (
    <RecordView
      onBack={() => navigate('/pfoten-portraets')}
      onEdit={() => setEditing(true)}
      backLabel={t('back')}
      editLabel={t('edit_button')}
    >
      <RecordHeader title={appLabel('pfoten_portraets')} />

      {(() => {
        const lookupLists: Record<string, unknown> = {
          hund: hundeList,
          besitzer: besitzerList,
          buchung: buchungenList,
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
        <RecordField label={fieldLabel('pfoten_portraets', 'hund')} value={getHundeDisplayName(record.fields.hund)} format="text" />
        <RecordField label={fieldLabel('pfoten_portraets', 'besitzer')} value={getBesitzerDisplayName(record.fields.besitzer)} format="text" />
        <RecordField label={fieldLabel('pfoten_portraets', 'buchung')} value={getBuchungenDisplayName(record.fields.buchung)} format="text" />
        <RecordField label={fieldLabel('pfoten_portraets', 'widmung')} value={record.fields.widmung} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('pfoten_portraets', 'besondere_erlebnisse')} value={record.fields.besondere_erlebnisse} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('pfoten_portraets', 'erstellungsdatum')} value={record.fields.erstellungsdatum} format="date" />
        <RecordField label={fieldLabel('pfoten_portraets', 'zusatztext')} value={record.fields.zusatztext} format="longtext" className="md:col-span-2" />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.PFOTEN_PORTRAETS} recordId={record.record_id} />

      <div className="flex justify-end pt-2">
        <Button variant="ghost" onClick={() => setDeleteOpen(true)} className="text-destructive hover:text-destructive">
          <IconTrash className="h-4 w-4 mr-1.5" />
          {t('delete')}
        </Button>
      </div>

      <PfotenPortraetsDialog
        open={editing}
        onClose={() => setEditing(false)}
        onSubmit={handleUpdate}
        defaultValues={record.fields}
        recordId={record.record_id}
        hundeList={hundeList}
        besitzerList={besitzerList}
        buchungenList={buchungenList}
        enablePhotoScan={AI_PHOTO_SCAN['PfotenPortraets']}
        enablePhotoLocation={AI_PHOTO_LOCATION['PfotenPortraets']}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title={t('delete_entity', { entity: appLabel('pfoten_portraets') })}
        description={t('confirm_delete_desc')}
      />
    </RecordView>
  );
}
