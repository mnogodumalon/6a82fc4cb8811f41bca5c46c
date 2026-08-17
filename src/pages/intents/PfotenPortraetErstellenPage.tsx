/**
 * Pfoten-Porträt erstellen — 2-Schritt-Wizard.
 * Steps: 1) Buchung wählen (nur abgereiste Buchungen) → 2) Porträt verfassen & anlegen.
 * Reads: buchungen, hunde (hundeMap), besitzer (besitzerMap). Writes: pfoten_portraets (createPfotenPortraet).
 * Composes: IntentWizardShell, EntitySelectStep.
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { IconPaw, IconHeart, IconAlertCircle } from '@tabler/icons-react';
import { tx } from '@/i18n';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichBuchungen } from '@/lib/enrich';
import type { EnrichedBuchungen } from '@/types/enriched';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { lookupKey, formatDate } from '@/lib/formatters';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export default function PfotenPortraetErstellenPage() {
  const data = useDashboardData();
  const { buchungen, hundeMap, besitzerMap, loading, error, fetchAll } = data;

  const [step, setStep] = useState(1);
  const [selectedBuchung, setSelectedBuchung] = useState<EnrichedBuchungen | null>(null);

  // Step 2 form state
  const [widmung, setWidmung] = useState('');
  const [besondereErlebnisse, setBesondereErlebnisse] = useState('');
  const [zusatztext, setZusatztext] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const enrichedBuchungen = enrichBuchungen(buchungen, { hundeMap, besitzerMap });

  const abgereisteBuchungen = enrichedBuchungen.filter(
    b => lookupKey(b.fields.status) === 'abgereist'
  );

  const handleBuchungSelect = (id: string) => {
    const found = enrichedBuchungen.find(b => b.record_id === id);
    if (found) {
      setSelectedBuchung(found);
      setStep(2);
    }
  };

  const handleSubmit = async () => {
    if (!selectedBuchung) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await LivingAppsService.createPfotenPortraet({
        hund: selectedBuchung.fields.hund,
        besitzer: selectedBuchung.fields.besitzer,
        buchung: createRecordUrl(APP_IDS.BUCHUNGEN, selectedBuchung.record_id),
        widmung,
        besondere_erlebnisse: besondereErlebnisse,
        zusatztext,
        erstellungsdatum: format(new Date(), 'yyyy-MM-dd'),
      });
      await fetchAll();
      window.location.hash = '/';
    } catch {
      setSubmitError(tx('Das Porträt konnte nicht gespeichert werden. Bitte erneut versuchen.'));
      setSubmitting(false);
    }
  };

  return (
    <IntentWizardShell
      title={tx('Pfoten-Porträt erstellen')}
      subtitle={tx('Ein persönliches Andenken für Hund und Besitzer')}
      steps={[{ label: tx('Buchung wählen') }, { label: tx('Porträt verfassen') }]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {step === 1 && (
        <EntitySelectStep
          items={abgereisteBuchungen.map(b => ({
            id: b.record_id,
            title: b.hundName || tx('Unbekannter Hund'),
            subtitle: `${b.besitzerName} · ${formatDate(b.fields.anreise)} – ${formatDate(b.fields.abreise)}`,
            status: b.fields.status
              ? { key: b.fields.status.key, label: b.fields.status.label }
              : undefined,
            icon: <IconPaw size={20} className="text-primary" />,
          }))}
          onSelect={handleBuchungSelect}
          searchPlaceholder={tx('Hund oder Besitzer suchen …')}
          emptyText={tx('Keine abgereisten Buchungen gefunden')}
          emptyIcon={<IconPaw size={32} className="text-muted-foreground" />}
        />
      )}

      {step === 2 && (
        selectedBuchung ? (
          <div className="space-y-6">
            {/* Context header */}
            <div className="rounded-2xl bg-secondary p-4 flex items-start gap-3">
              <IconHeart size={24} className="text-primary shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="font-semibold text-foreground truncate">{selectedBuchung.hundName}</p>
                <p className="text-sm text-muted-foreground">{selectedBuchung.besitzerName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDate(selectedBuchung.fields.anreise)} – {formatDate(selectedBuchung.fields.abreise)}
                </p>
              </div>
            </div>

            {/* Mini-form */}
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="widmung">{tx('Persönliche Widmung')}</Label>
                <Textarea
                  id="widmung"
                  value={widmung}
                  onChange={e => setWidmung(e.target.value)}
                  placeholder={tx('Eine herzliche Widmung an Hund und Besitzer …')}
                  rows={3}
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="besondere_erlebnisse">{tx('Besondere Erlebnisse')}</Label>
                <Textarea
                  id="besondere_erlebnisse"
                  value={besondereErlebnisse}
                  onChange={e => setBesondereErlebnisse(e.target.value)}
                  placeholder={tx('Was war unvergesslich in diesem Aufenthalt? …')}
                  rows={4}
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="zusatztext">{tx('Zusätzliche persönliche Note')}</Label>
                <Textarea
                  id="zusatztext"
                  value={zusatztext}
                  onChange={e => setZusatztext(e.target.value)}
                  placeholder={tx('Weitere Gedanken oder Grüße …')}
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>

            {submitError && (
              <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <IconAlertCircle size={16} className="shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                disabled={submitting}
              >
                {tx('Zurück')}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !widmung}
                className="flex-1 sm:flex-none"
              >
                {submitting ? tx('Wird gespeichert …') : tx('Porträt anlegen')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt braucht die Auswahl aus Schritt 1.')}
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>
              {tx('Neu starten')}
            </Button>
          </div>
        )
      )}
    </IntentWizardShell>
  );
}
