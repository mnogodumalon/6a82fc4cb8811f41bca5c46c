/**
 * Pfoten-Porträt erstellen — 2-Schritt-Wizard.
 * Steps: 1) Buchung wählen (nur abgereiste) → 2) Widmung & Erlebnisse verfassen → Porträt speichern.
 * Reads: buchungen, hunde, besitzer. Writes: pfoten_portraets (createPfotenPortraetsEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */

import { useState } from 'react';
import { format } from 'date-fns';
import { IconPaw, IconHeart, IconCamera } from '@tabler/icons-react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichBuchungen } from '@/lib/enrich';
import type { EnrichedBuchungen } from '@/types/enriched';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { APP_IDS } from '@/types/app';
import { formatDate } from '@/lib/formatters';
import { tx } from '@/i18n';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export default function PfotenPortraetPage() {
  const data = useDashboardData();
  const { buchungen, hundeMap, besitzerMap, loading, error, fetchAll } = data;

  const [step, setStep] = useState(1);
  const [selectedBuchung, setSelectedBuchung] = useState<EnrichedBuchungen | null>(null);

  // Schritt 2 Felder
  const [widmung, setWidmung] = useState('');
  const [besondereErlebnisse, setBesondereErlebnisse] = useState('');
  const [zusatztext, setZusatztext] = useState('');
  const [erstellungsdatum, setErstellungsdatum] = useState(
    format(new Date(), 'yyyy-MM-dd')
  );

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Alle Hooks vor Early Returns
  const enrichedBuchungen = enrichBuchungen(buchungen, { hundeMap, besitzerMap });

  // Nur abgereiste Buchungen, sortiert nach abreise absteigend
  const abgereisteBuchungen = enrichedBuchungen
    .filter(b => b.fields.status?.key === 'abgereist')
    .sort((a, b) => {
      const da = a.fields.abreise ?? '';
      const db = b.fields.abreise ?? '';
      return db.localeCompare(da);
    });

  const handleSelectBuchung = (id: string) => {
    const buchung = abgereisteBuchungen.find(b => b.record_id === id);
    if (buchung) {
      setSelectedBuchung(buchung);
      setStep(2);
    }
  };

  const handleSubmit = async () => {
    if (!selectedBuchung || !widmung || !erstellungsdatum) return;

    const hundId = extractRecordId(selectedBuchung.fields.hund);
    const besitzerId = extractRecordId(selectedBuchung.fields.besitzer);

    if (!hundId || !besitzerId) {
      setSubmitError(tx('Hund oder Besitzer konnte nicht ermittelt werden.'));
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      await LivingAppsService.createPfotenPortraet({
        hund: createRecordUrl(APP_IDS.HUNDE, hundId),
        besitzer: createRecordUrl(APP_IDS.BESITZER, besitzerId),
        buchung: createRecordUrl(APP_IDS.BUCHUNGEN, selectedBuchung.record_id),
        widmung,
        besondere_erlebnisse: besondereErlebnisse || undefined,
        zusatztext: zusatztext || undefined,
        erstellungsdatum,
        // hund_foto wird nicht gesendet (file-Upload wird separat behandelt)
      });

      await fetchAll();
      window.location.hash = '/';
    } catch {
      setSubmitError(tx('Porträt konnte nicht gespeichert werden. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = !!selectedBuchung && widmung.trim().length > 0 && !!erstellungsdatum;

  return (
    <IntentWizardShell
      title={tx('Pfoten-Porträt erstellen')}
      subtitle={tx('Erstelle eine persönliche Erinnerung für den Besitzer')}
      steps={[
        { label: tx('Buchung wählen') },
        { label: tx('Porträt verfassen') },
      ]}
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
            subtitle: [
              b.besitzerName,
              b.fields.abreise ? `${tx('Abreise')}: ${formatDate(b.fields.abreise)}` : null,
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
          emptyIcon={<IconPaw size={40} className="text-muted-foreground" />}
        />
      )}

      {step === 2 && (
        selectedBuchung ? (
          <div className="space-y-6 max-w-2xl mx-auto">
            {/* Kontext-Karte */}
            <div className="rounded-2xl border bg-card p-4 flex items-start gap-3">
              <div className="mt-0.5 shrink-0">
                <IconPaw size={24} className="text-primary" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground">
                    {selectedBuchung.hundName || tx('Unbekannter Hund')}
                  </span>
                  <StatusBadge
                    statusKey={selectedBuchung.fields.status?.key}
                    label={selectedBuchung.fields.status?.label}
                  />
                </div>
                <div className="text-sm text-muted-foreground mt-0.5">
                  {selectedBuchung.besitzerName}
                  {selectedBuchung.fields.abreise && (
                    <span> · {tx('Abreise')}: {formatDate(selectedBuchung.fields.abreise)}</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="ml-auto shrink-0 text-sm text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => setStep(1)}
              >
                {tx('Ändern')}
              </button>
            </div>

            {/* Formular */}
            <div className="space-y-5">
              {/* Widmung (Pflichtfeld) */}
              <div className="space-y-1.5">
                <Label htmlFor="widmung" className="flex items-center gap-1.5">
                  <IconHeart size={16} className="shrink-0 text-primary" />
                  {tx('Persönliche Widmung')}
                  <span className="text-destructive ml-0.5">*</span>
                </Label>
                <Textarea
                  id="widmung"
                  value={widmung}
                  onChange={e => setWidmung(e.target.value)}
                  placeholder={tx('Eine persönliche Widmung an den Besitzer …')}
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  {tx('Diese Widmung erscheint im Porträt für den Besitzer.')}
                </p>
              </div>

              {/* Besondere Erlebnisse */}
              <div className="space-y-1.5">
                <Label htmlFor="erlebnisse">
                  {tx('Besondere Erlebnisse')}
                </Label>
                <Textarea
                  id="erlebnisse"
                  value={besondereErlebnisse}
                  onChange={e => setBesondereErlebnisse(e.target.value)}
                  placeholder={tx('Was war besonders an diesem Aufenthalt? Lustige Momente, neue Freundschaften, Lieblingsplätze …')}
                  rows={4}
                  className="resize-none"
                />
              </div>

              {/* Foto-Hinweis */}
              <div className="rounded-xl border border-dashed bg-secondary/40 p-4 flex items-center gap-3">
                <IconCamera size={24} className="shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {tx('Foto des Hundes')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {tx('Fotos können nach dem Speichern im Porträt-Eintrag hochgeladen werden.')}
                  </p>
                </div>
              </div>

              {/* Zusatztext */}
              <div className="space-y-1.5">
                <Label htmlFor="zusatztext">
                  {tx('Zusatztext')}
                </Label>
                <Textarea
                  id="zusatztext"
                  value={zusatztext}
                  onChange={e => setZusatztext(e.target.value)}
                  placeholder={tx('Optionaler Zusatztext für das Porträt …')}
                  rows={3}
                  className="resize-none"
                />
              </div>

              {/* Erstellungsdatum */}
              <div className="space-y-1.5">
                <Label htmlFor="erstellungsdatum">
                  {tx('Erstellungsdatum')}
                  <span className="text-destructive ml-0.5">*</span>
                </Label>
                <Input
                  id="erstellungsdatum"
                  type="date"
                  value={erstellungsdatum}
                  onChange={e => setErstellungsdatum(e.target.value)}
                  className="w-full sm:w-auto"
                />
              </div>
            </div>

            {/* Fehler */}
            {submitError && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                {submitError}
              </div>
            )}

            {/* Aktionen */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                className="flex-1 sm:flex-none"
              >
                {submitting ? tx('Wird gespeichert …') : tx('Porträt speichern')}
              </Button>
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                disabled={submitting}
              >
                {tx('Zurück')}
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
