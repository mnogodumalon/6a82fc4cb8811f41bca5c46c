/**
 * Pfoten-Portraet erstellen — 2-Schritt-Wizard.
 * Steps: 1) Buchung wählen (Status 'abgereist') → 2) Portraet-Inhalte eingeben & anlegen.
 * Reads: buchungen (enriched). Writes: pfoten_portraets (createPfotenPortraet).
 * Composes: IntentWizardShell, EntitySelectStep.
 */

import { useState } from 'react';
import { format } from 'date-fns';
import { IconPaw, IconCheck } from '@tabler/icons-react';
import { tx } from '@/i18n';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { EnrichedBuchungen } from '@/types/enriched';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function PfotenPortraetPage() {
  const data = useDashboardData();
  const { buchungen, loading, error, fetchAll } = data;

  const [step, setStep] = useState(1);
  const [selectedBuchung, setSelectedBuchung] = useState<EnrichedBuchungen | null>(null);

  // Step 2 form state
  const [widmung, setWidmung] = useState('');
  const [besondereErlebnisse, setBesondereErlebnisse] = useState('');
  const [zusatztext, setZusatztext] = useState('');
  const [erstellungsdatum, setErstellungsdatum] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Filter only abgereist bookings
  const abgereisteBuchungen = (buchungen as EnrichedBuchungen[]).filter(
    b => b.fields.status?.key === 'abgereist'
  );

  const handleSelectBuchung = (id: string) => {
    const found = abgereisteBuchungen.find(b => b.record_id === id);
    if (found) {
      setSelectedBuchung(found);
      setStep(2);
    }
  };

  const handleSubmit = async () => {
    if (!selectedBuchung || !widmung || !erstellungsdatum) return;

    const hundId = extractRecordId(selectedBuchung.fields.hund);
    const besitzerId = extractRecordId(selectedBuchung.fields.besitzer);
    if (!hundId || !besitzerId) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await LivingAppsService.createPfotenPortraet({
        hund: createRecordUrl('6a82fc2393a7a2a067a822a8', hundId),
        besitzer: createRecordUrl('6a82fc1d74b3e71c1357a140', besitzerId),
        buchung: createRecordUrl('6a82fc243717e89f4af1d40b', selectedBuchung.record_id),
        widmung,
        besondere_erlebnisse: besondereErlebnisse || undefined,
        zusatztext: zusatztext || undefined,
        erstellungsdatum,
      });
      await fetchAll();
      setDone(true);
    } catch {
      setSubmitError(tx('Fehler beim Erstellen des Portraets. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setSelectedBuchung(null);
    setWidmung('');
    setBesondereErlebnisse('');
    setZusatztext('');
    setErstellungsdatum(format(new Date(), 'yyyy-MM-dd'));
    setSubmitError(null);
    setDone(false);
  };

  return (
    <IntentWizardShell
      title={tx('Pfoten-Portraet erstellen')}
      subtitle={tx('Individuelles Erinnerungsstück nach dem Aufenthalt')}
      steps={[
        { label: tx('Buchung wählen') },
        { label: tx('Portraet erstellen') },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Step 1: Buchung wählen */}
      {step === 1 && (
        <EntitySelectStep
          items={abgereisteBuchungen.map(b => ({
            id: b.record_id,
            title: b.hundName,
            subtitle: `${b.besitzerName} · ${formatDate(b.fields.anreise)} – ${formatDate(b.fields.abreise)}`,
            status: b.fields.status
              ? { key: b.fields.status.key, label: b.fields.status.label }
              : undefined,
          }))}
          onSelect={handleSelectBuchung}
          searchPlaceholder={tx('Hund oder Besitzer suchen …')}
          emptyText={tx('Keine abgereisten Buchungen gefunden')}
          emptyIcon={<IconPaw size={32} className="text-muted-foreground" />}
        />
      )}

      {/* Step 2: Portraet-Inhalte eingeben */}
      {step === 2 && (
        selectedBuchung ? (
          done ? (
            <div className="flex flex-col items-center gap-6 py-12 text-center">
              <div className="rounded-full bg-emerald-100 p-4">
                <IconCheck size={40} className="text-emerald-600" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">{tx('Portraet erfolgreich erstellt!')}</h2>
                <p className="text-sm text-muted-foreground">
                  {tx('Das Pfoten-Portraet für')} <span className="font-medium">{selectedBuchung.hundName}</span> {tx('wurde gespeichert.')}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 justify-center">
                <Button onClick={handleReset} variant="outline">
                  {tx('Weiteres Portraet erstellen')}
                </Button>
                <a href="#/">
                  <Button>{tx('Zurück zum Dashboard')}</Button>
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-6 max-w-xl mx-auto">
              {/* Kontext read-only */}
              <div className="rounded-2xl border bg-secondary/40 p-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {tx('Aufenthalt')}
                </p>
                <div className="flex items-baseline gap-2">
                  <IconPaw size={18} className="text-primary shrink-0 mt-0.5" />
                  <span className="text-base font-semibold">{selectedBuchung.hundName}</span>
                  <span className="text-sm text-muted-foreground">· {selectedBuchung.besitzerName}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatDate(selectedBuchung.fields.anreise)} – {formatDate(selectedBuchung.fields.abreise)}
                </p>
              </div>

              {/* Mini-Formular */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="widmung">
                    {tx('Widmung')} <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="widmung"
                    value={widmung}
                    onChange={e => setWidmung(e.target.value)}
                    rows={3}
                    placeholder={tx('Eine persönliche Widmung für den Hund und sein Herrchen …')}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="besondere_erlebnisse">{tx('Besondere Erlebnisse')}</Label>
                  <Textarea
                    id="besondere_erlebnisse"
                    value={besondereErlebnisse}
                    onChange={e => setBesondereErlebnisse(e.target.value)}
                    rows={3}
                    placeholder={tx('Was hat der Hund während des Aufenthalts besonders genossen?')}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="zusatztext">{tx('Zusatztext')}</Label>
                  <Textarea
                    id="zusatztext"
                    value={zusatztext}
                    onChange={e => setZusatztext(e.target.value)}
                    rows={2}
                    placeholder={tx('Weitere Informationen oder persönliche Notizen …')}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="erstellungsdatum">
                    {tx('Erstellungsdatum')} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="erstellungsdatum"
                    type="date"
                    value={erstellungsdatum}
                    onChange={e => setErstellungsdatum(e.target.value)}
                  />
                </div>
              </div>

              {submitError && (
                <p className="text-sm text-destructive">{submitError}</p>
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
                  disabled={submitting || !widmung || !erstellungsdatum}
                  className="flex-1 sm:flex-none"
                >
                  {submitting ? tx('Wird erstellt …') : tx('Portraet anlegen')}
                </Button>
              </div>
            </div>
          )
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
