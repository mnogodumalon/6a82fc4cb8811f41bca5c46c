/**
 * Pfoten-Portraet erstellen — 2-Schritt-Wizard.
 * Steps: 1) Buchung auswählen (nur 'abgereist') → 2) Portraet verfassen & speichern.
 * Reads: buchungen, hundeMap, besitzerMap (via useDashboardData + enrichBuchungen).
 * Writes: pfoten_portraets (createPfotenPortraet).
 * Composes: IntentWizardShell, EntitySelectStep.
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { IconPaw, IconCheck } from '@tabler/icons-react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichBuchungen } from '@/lib/enrich';
import type { EnrichedBuchungen } from '@/types/enriched';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { APP_IDS } from '@/types/app';
import { formatDate } from '@/lib/formatters';
import { tx } from '@/i18n';

export default function PfotenPortraetPage() {
  const STEPS = [
  { label: tx('Buchung wählen') },
  { label: tx('Portraet verfassen') },
];

  const data = useDashboardData();
  const { buchungen, hundeMap, besitzerMap, loading, error, fetchAll } = data;

  const [step, setStep] = useState(1);
  const [selectedBuchung, setSelectedBuchung] = useState<EnrichedBuchungen | null>(null);
  const [widmung, setWidmung] = useState('');
  const [besondereErlebnisse, setBesondereErlebnisse] = useState('');
  const [zusatztext, setZusatztext] = useState('');
  const [erstellungsdatum] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const enrichedBuchungen = enrichBuchungen(buchungen, { hundeMap, besitzerMap });
  const abgereisteBuchungen = enrichedBuchungen.filter(
    (b) => b.fields.status?.key === 'abgereist'
  );

  const handleSelectBuchung = (id: string) => {
    const found = abgereisteBuchungen.find((b) => b.record_id === id);
    if (found) {
      setSelectedBuchung(found);
      setStep(2);
    }
  };

  const handleSubmit = async () => {
    if (!selectedBuchung || !widmung || !erstellungsdatum) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const hundId = extractRecordId(selectedBuchung.fields.hund);
      const besitzerId = extractRecordId(selectedBuchung.fields.besitzer);
      await LivingAppsService.createPfotenPortraet({
        hund: hundId ? createRecordUrl(APP_IDS.HUNDE, hundId) : undefined,
        besitzer: besitzerId ? createRecordUrl(APP_IDS.BESITZER, besitzerId) : undefined,
        buchung: createRecordUrl(APP_IDS.BUCHUNGEN, selectedBuchung.record_id),
        widmung,
        besondere_erlebnisse: besondereErlebnisse || undefined,
        zusatztext: zusatztext || undefined,
        erstellungsdatum,
      });
      await fetchAll();
      setDone(true);
    } catch {
      setSubmitError(tx('Fehler beim Speichern. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedBuchung(null);
    setWidmung('');
    setBesondereErlebnisse('');
    setZusatztext('');
    setSubmitError(null);
    setDone(false);
    setStep(1);
  };

  return (
    <IntentWizardShell
      title={tx('Pfoten-Portraet erstellen')}
      subtitle={tx('Erstelle eine persönliche Erinnerung für abgereiste Gäste')}
      steps={STEPS}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Step 1: Buchung auswählen */}
      {step === 1 && (
        <EntitySelectStep
          items={abgereisteBuchungen.map((b) => ({
            id: b.record_id,
            title: b.hundName || tx('Unbekannter Hund'),
            subtitle: [
              b.besitzerName,
              b.fields.anreise && b.fields.abreise
                ? `${formatDate(b.fields.anreise)} – ${formatDate(b.fields.abreise)}`
                : b.fields.anreise
                ? formatDate(b.fields.anreise)
                : '',
            ]
              .filter(Boolean)
              .join(' · '),
            status: b.fields.status
              ? { key: b.fields.status.key, label: b.fields.status.label }
              : undefined,
            icon: <IconPaw size={20} className="text-primary" />,
          }))}
          onSelect={handleSelectBuchung}
          searchPlaceholder={tx('Hund oder Besitzer suchen …')}
          emptyText={tx('Keine abgereisten Buchungen gefunden')}
          emptyIcon={<IconPaw size={32} className="text-muted-foreground" />}
        />
      )}

      {/* Step 2: Portraet verfassen */}
      {step === 2 && (
        selectedBuchung ? (
          done ? (
            /* Erfolgsmeldung */
            <div className="flex flex-col items-center justify-center py-16 space-y-6 text-center">
              <div className="rounded-full bg-emerald-100 p-5">
                <IconCheck size={40} className="text-emerald-600" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-foreground">
                  {tx('Portraet wurde gespeichert')}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {tx('Das Pfoten-Portraet für')}{' '}
                  <strong>{selectedBuchung.hundName}</strong>{' '}
                  {tx('wurde erfolgreich erstellt.')}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="outline" onClick={handleReset}>
                  {tx('Neues Portraet erstellen')}
                </Button>
                <a href="#/">
                  <Button>{tx('Zurück zum Dashboard')}</Button>
                </a>
              </div>
            </div>
          ) : (
            /* Formular */
            <div className="space-y-6">
              {/* Kontext-Header */}
              <div className="rounded-2xl border bg-secondary/40 p-4 space-y-1">
                <div className="flex items-center gap-2">
                  <IconPaw size={18} className="text-primary shrink-0" />
                  <span className="font-semibold text-foreground text-lg">
                    {selectedBuchung.hundName}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {selectedBuchung.besitzerName}
                  {selectedBuchung.fields.anreise && selectedBuchung.fields.abreise && (
                    <>
                      {' · '}
                      {formatDate(selectedBuchung.fields.anreise)}
                      {' – '}
                      {formatDate(selectedBuchung.fields.abreise)}
                    </>
                  )}
                </p>
              </div>

              {/* Widmung (Pflichtfeld) */}
              <div className="space-y-2">
                <Label htmlFor="widmung" className="text-sm font-medium">
                  {tx('Persönliche Widmung')}{' '}
                  <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="widmung"
                  value={widmung}
                  onChange={(e) => setWidmung(e.target.value)}
                  placeholder={tx('Eine persönliche Ansprache an den Besitzer …')}
                  rows={4}
                  className="resize-none"
                />
              </div>

              {/* Besondere Erlebnisse */}
              <div className="space-y-2">
                <Label htmlFor="besondere_erlebnisse" className="text-sm font-medium">
                  {tx('Besondere Erlebnisse')}
                </Label>
                <Textarea
                  id="besondere_erlebnisse"
                  value={besondereErlebnisse}
                  onChange={(e) => setBesondereErlebnisse(e.target.value)}
                  placeholder={tx('Was hat der Hund während des Aufenthalts erlebt? …')}
                  rows={4}
                  className="resize-none"
                />
              </div>

              {/* Zusatztext */}
              <div className="space-y-2">
                <Label htmlFor="zusatztext" className="text-sm font-medium">
                  {tx('Weitere Anmerkungen')}
                </Label>
                <Textarea
                  id="zusatztext"
                  value={zusatztext}
                  onChange={(e) => setZusatztext(e.target.value)}
                  placeholder={tx('Weitere Anmerkungen oder Hinweise …')}
                  rows={3}
                  className="resize-none"
                />
              </div>

              {/* Erstellungsdatum (schreibgeschützt, vorausgefüllt) */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  {tx('Erstellungsdatum')}: <strong>{erstellungsdatum}</strong>
                </p>
              </div>

              {submitError && (
                <p className="text-sm text-destructive">{submitError}</p>
              )}

              {/* Aktionen */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  disabled={submitting}
                >
                  {tx('Zurück')}
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !widmung.trim()}
                  className="flex-1"
                >
                  {submitting ? tx('Wird gespeichert …') : tx('Portraet speichern')}
                </Button>
              </div>
            </div>
          )
        ) : (
          /* Fallback: kein Hund ausgewählt (cold deep-link) */
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt benötigt eine ausgewählte Buchung aus Schritt 1.')}
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
