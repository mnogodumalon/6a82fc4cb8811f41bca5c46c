import type { PfotenPortraets, Hunde, Besitzer, Buchungen } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { APP_IDS } from '@/types/app';
import { AttachmentsSection } from '@/components/AttachmentsSection';
import { MediaThumbnail } from '@/components/widgets/MediaViewer';
import { IconPencil, IconFileText } from '@tabler/icons-react';
import { t, appLabel, fieldLabel, lookupLabel, dateFnsLocale, dateFormat } from '@/i18n';
import { format, parseISO } from 'date-fns';

function formatDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), dateFormat(), { locale: dateFnsLocale() }); } catch { return d; }
}

interface PfotenPortraetsViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: PfotenPortraets | null;
  onEdit: (record: PfotenPortraets) => void;
  hundeList: Hunde[];
  besitzerList: Besitzer[];
  buchungenList: Buchungen[];
}

export function PfotenPortraetsViewDialog({ open, onClose, record, onEdit, hundeList, besitzerList, buchungenList }: PfotenPortraetsViewDialogProps) {
  function getHundeDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return hundeList.find(r => r.record_id === id)?.fields.name ?? '—';
  }

  function getBesitzerDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return besitzerList.find(r => r.record_id === id)?.fields.vorname ?? '—';
  }

  function getBuchungenDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return buchungenList.find(r => r.record_id === id)?.fields.interne_notizen ?? '—';
  }

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('view_entity', { entity: appLabel('pfoten_portraets') })}</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            {t('edit_button')}
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('pfoten_portraets', 'hund')}</Label>
            <p className="text-sm">{getHundeDisplayName(record.fields.hund)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('pfoten_portraets', 'besitzer')}</Label>
            <p className="text-sm">{getBesitzerDisplayName(record.fields.besitzer)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('pfoten_portraets', 'buchung')}</Label>
            <p className="text-sm">{getBuchungenDisplayName(record.fields.buchung)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('pfoten_portraets', 'widmung')}</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.widmung ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('pfoten_portraets', 'besondere_erlebnisse')}</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.besondere_erlebnisse ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('pfoten_portraets', 'hund_foto')}</Label>
            {record.fields.hund_foto ? (
              <MediaThumbnail src={record.fields.hund_foto} fit="contain" className="w-full rounded-lg border" />
            ) : <p className="text-sm text-muted-foreground">—</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('pfoten_portraets', 'erstellungsdatum')}</Label>
            <p className="text-sm">{formatDate(record.fields.erstellungsdatum)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('pfoten_portraets', 'zusatztext')}</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.zusatztext ?? '—'}</p>
          </div>
          <div className="pt-2 border-t border-border">
            <AttachmentsSection appId={APP_IDS.PFOTEN_PORTRAETS} recordId={record.record_id} readOnly />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}