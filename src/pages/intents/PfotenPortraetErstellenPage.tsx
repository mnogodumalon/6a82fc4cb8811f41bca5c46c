/**
 * Pfoten-Porträt erstellen — 2-Schritt-Wizard.
 * Steps: 1) Buchung auswählen (anwesend/abgereist) → 2) Porträt verfassen & speichern.
 * Reads: buchungen, hunde, besitzer. Writes: pfoten_portraets (createPfotenPortraet).
 * Composes: IntentWizardShell, EntitySelectStep.
 */

import { useState } from 'react';
import { format } from 'date-fns';
import { IconPaw, IconPhoto, IconHeart, IconCheck } from '@tabler/icons-react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichBuchungen } from '@/lib/enrich';
import type { EnrichedBuchungen } from '@/types/enriched';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { APP_IDS } from '@/types/app';
import { lookupKey, formatDate } from '@/lib/formatters';
import { tx } from '@/i18n';

export default function PfotenPortraetErstellenPage() {
  const data = useDashboardData();
  const { buchungen, hundeMap, besitzerMap, loading, error, fetchAll } = data;

  const [step, setStep] = useState(1);
  const [selectedBuchung, setSelectedBuchung] = useState<EnrichedBuchungen | null>(null);

  // Step 2 fields
  const [widmung, setWidmung] = useState('');
  const [besondereErlebnisse, setBesondereErlebnisse] = useState('');
  const [zusatztext, setZusatztext] = useState('');
  const [hundFoto, setHundFoto] = useState('');
  const [erstellungsdatum] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  // ALL hooks above — early returns below
  const enrichedBuchungen = enrichBuchungen(buchungen, { hundeMap, besitzerMap });

  const eligibleBuchungen = enrichedBuchungen.filter(b => {
    const key = lookupKey(b.fields.status);
    return key === 'anwesend' || key === 'abgereist';
  });

  const handleSelectBuchung = (id: string) => {
    const found = eligibleBuchungen.find(b => b.record_id === id);
    if (found) {
      setSelectedBuchung(found);
      setStep(2);
    }
  };

  const handleSubmit = async () => {
    if (!selectedBuchung || !widmung) return;

    // idempotency guard — don't re-create on retry
    if (createdId) return;

    const hundId = extractRecordId(selectedBuchung.fields.hund);
    const besitzerId = extractRecordId(selectedBuchung.fields.besitzer);

    if (!hundId || !besitzerId) {
      setSubmitError(tx('Hund oder Besitzer fehlt in der Buchung.'));
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const result = await LivingAppsService.createPfotenPortraet({
        hund: createRecordUrl(APP_IDS.HUNDE, hundId),
        besitzer: createRecordUrl(APP_IDS.BESITZER, besitzerId),
        buchung: createRecordUrl(APP_IDS.BUCHUNGEN, selectedBuchung.record_id),
        widmung,
        besondere_erlebnisse: besondereErlebnisse || undefined,
        zusatztext: zusatztext || undefined,
        hund_foto: hundFoto || undefined,
        erstellungsdatum,
      });
      setCreatedId(result.record_id);
      await fetchAll();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : tx('Ein Fehler ist aufgetreten.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedBuchung(null);
    setWidmung('');
    setBesondereErlebnisse('');
    setZusatztext('');
    setHundFoto('');
    setSubmitError(null);
    setCreatedId(null);
    setStep(1);
  };

  const steps = [
    { label: tx('Buchung') },
    { label: tx('Porträt') },
  ];

  return (
    <IntentWizardShell
      title={tx('Pfoten-Porträt erstellen')}
      subtitle={tx('Erstelle ein persönliches Andenken für den Aufenthalt')}
      steps={steps}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Step 1: Buchung auswählen */}
      {step === 1 && (
        <EntitySelectStep
          items={eligibleBuchungen.map(b => ({
            id: b.record_id,
            title: b.hundName || tx('Unbekannter Hund'),
            subtitle: [
              b.besitzerName,
              b.fields.anreise ? formatDate(b.fields.anreise) : null,
              b.fields.abreise ? `— ${formatDate(b.fields.abreise)}` : null,
            ].filter(Boolean).join(' '),
            status: b.fields.status
              ? { key: b.fields.status.key, label: b.fields.status.label }
              : undefined,
            icon: <IconPaw size={20} className="text-primary" />,
          }))}
          onSelect={handleSelectBuchung}
          searchPlaceholder={tx('Hund oder Besitzer suchen …')}
          emptyText={tx('Keine Buchungen mit Status „Anwesend" oder „Abgereist" gefunden.')}
          emptyIcon={<IconPaw size={32} className="text-muted-foreground" />}
        />
      )}

      {/* Step 2: Porträt verfassen */}
      {step === 2 && (
        selectedBuchung ? (
          createdId ? (
            /* Success state */
            <div className="flex flex-col items-center gap-6 py-12 text-center">
              <div className="rounded-full bg-primary/10 p-5">
                <IconCheck size={40} className="text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">{tx('Porträt gespeichert!')}</h2>
                <p className="text-muted-foreground max-w-sm">
                  {tx('Das Pfoten-Porträt für')} <strong>{selectedBuchung.hundName}</strong> {tx('wurde erfolgreich erstellt.')}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={handleReset} variant="outline">
                  {tx('Neues Porträt erstellen')}
                </Button>
                <Button asChild>
                  <a href="#/">{tx('Zurück zum Dashboard')}</a>
                </Button>
              </div>
            </div>
          ) : (
            /* Form */
            <div className="space-y-6 max-w-2xl mx-auto">
              {/* Context card */}
              <div className="rounded-2xl border bg-secondary/40 p-4 flex items-start gap-3">
                <IconHeart size={20} className="text-primary shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {selectedBuchung.hundName}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {selectedBuchung.besitzerName}
                    {selectedBuchung.fields.anreise && selectedBuchung.fields.abreise && (
                      <> · {formatDate(selectedBuchung.fields.anreise)} – {formatDate(selectedBuchung.fields.abreise)}</>
                    )}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 ml-auto"
                  onClick={() => setStep(1)}
                >
                  {tx('Ändern')}
                </Button>
              </div>

              {/* Widmung (required) */}
              <div className="space-y-2">
                <Label htmlFor="widmung">
                  {tx('Widmung')} <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="widmung"
                  value={widmung}
                  onChange={e => setWidmung(e.target.value)}
                  placeholder={tx('Eine persönliche Widmung für den Hund und seine Familie …')}
                  rows={4}
                  className="resize-none"
                />
              </div>

              {/* Besondere Erlebnisse */}
              <div className="space-y-2">
                <Label htmlFor="erlebnisse">{tx('Besondere Erlebnisse')}</Label>
                <Textarea
                  id="erlebnisse"
                  value={besondereErlebnisse}
                  onChange={e => setBesondereErlebnisse(e.target.value)}
                  placeholder={tx('Was war besonders schön oder lustig in diesem Aufenthalt? …')}
                  rows={4}
                  className="resize-none"
                />
              </div>

              {/* Zusatztext */}
              <div className="space-y-2">
                <Label htmlFor="zusatztext">{tx('Zusatztext')}</Label>
                <Textarea
                  id="zusatztext"
                  value={zusatztext}
                  onChange={e => setZusatztext(e.target.value)}
                  placeholder={tx('Weitere Anmerkungen oder ein Abschlussgruß …')}
                  rows={3}
                  className="resize-none"
                />
              </div>

              {/* Foto-URL */}
              <div className="space-y-2">
                <Label htmlFor="hund-foto">
                  <span className="flex items-center gap-2">
                    <IconPhoto size={16} className="shrink-0" />
                    {tx('Foto (URL)')}
                  </span>
                </Label>
                <Input
                  id="hund-foto"
                  type="url"
                  value={hundFoto}
                  onChange={e => setHundFoto(e.target.value)}
                  placeholder={tx('https://… oder leer lassen')}
                />
              </div>

              {/* Erstellungsdatum (read-only display) */}
              <div className="space-y-2">
                <Label>{tx('Erstellungsdatum')}</Label>
                <p className="text-sm text-muted-foreground">
                  {formatDate(erstellungsdatum)}
                </p>
              </div>

              {/* Error */}
              {submitError && (
                <p className="text-sm text-destructive">{submitError}</p>
              )}

              {/* Actions */}
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
                  disabled={!widmung.trim() || submitting}
                  className="flex-1"
                >
                  {submitting ? tx('Wird gespeichert …') : tx('Porträt speichern')}
                </Button>
              </div>
            </div>
          )
        ) : (
          /* Cold-link fallback: step=2 but no buchung selected */
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt braucht eine ausgewählte Buchung aus Schritt 1.')}
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
