/**
 * Pfoten-Portraet anlegen — 2-Schritt-Wizard.
 * Steps: 1) Buchung wählen (nur abgereiste) → 2) Portraet verfassen & speichern.
 * Reads: buchungen, hundeMap, besitzerMap (via enrichBuchungen).
 * Writes: pfoten_portraets (createPfotenPortraet).
 * Composes: IntentWizardShell, EntitySelectStep.
 */

import { useState } from 'react';
import { format } from 'date-fns';
import { IconPaw, IconCheck } from '@tabler/icons-react';
import { tx } from '@/i18n';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichBuchungen } from '@/lib/enrich';
import type { EnrichedBuchungen } from '@/types/enriched';
import { APP_IDS } from '@/types/app';
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
  const { buchungen, hundeMap, besitzerMap, loading, error, fetchAll } = data;

  const [step, setStep] = useState(1);
  const [selectedBuchung, setSelectedBuchung] = useState<EnrichedBuchungen | null>(null);

  // Schritt 2 — Formularfelder
  const [widmung, setWidmung] = useState('');
  const [besondereErlebnisse, setBesondereErlebnisse] = useState('');
  const [zusatztext, setZusatztext] = useState('');
  const [erstellungsdatum, setErstellungsdatum] = useState(
    format(new Date(), 'yyyy-MM-dd')
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
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

  const handleSave = async () => {
    if (!selectedBuchung || !widmung || !erstellungsdatum) return;
    setSaving(true);
    setSaveError(null);

    const hundId = extractRecordId(selectedBuchung.fields.hund);
    const besitzerId = extractRecordId(selectedBuchung.fields.besitzer);

    try {
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
      setStep(3);
    } catch (e) {
      setSaveError(tx('Speichern fehlgeschlagen. Bitte erneut versuchen.'));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSelectedBuchung(null);
    setWidmung('');
    setBesondereErlebnisse('');
    setZusatztext('');
    setErstellungsdatum(format(new Date(), 'yyyy-MM-dd'));
    setSaveError(null);
    setDone(false);
    setStep(1);
  };

  return (
    <IntentWizardShell
      title={tx('Pfoten-Portraet anlegen')}
      subtitle={tx('Erstelle ein individuelles Andenken für abgereiste Gäste')}
      steps={[
        { label: tx('Buchung wählen') },
        { label: tx('Portraet verfassen') },
        { label: tx('Fertig') },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Schritt 1 — Buchung wählen */}
      {step === 1 && (
        <EntitySelectStep
          items={abgereisteBuchungen.map((b) => ({
            id: b.record_id,
            title: b.hundName || tx('Unbekannter Hund'),
            subtitle: [
              b.besitzerName,
              b.fields.abreise ? `${tx('Abgereist')}: ${formatDate(b.fields.abreise)}` : null,
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

      {/* Schritt 2 — Portraet verfassen */}
      {step === 2 && (
        selectedBuchung ? (
          <div className="space-y-6 max-w-xl mx-auto">
            {/* Kontext-Karte */}
            <div className="rounded-2xl border bg-secondary/40 p-4 flex items-center gap-3">
              <IconPaw size={28} className="text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold truncate">{selectedBuchung.hundName}</p>
                <p className="text-sm text-muted-foreground truncate">
                  {selectedBuchung.besitzerName}
                  {selectedBuchung.fields.abreise
                    ? ` · ${tx('Abreise')}: ${formatDate(selectedBuchung.fields.abreise)}`
                    : ''}
                </p>
              </div>
            </div>

            {/* Formular */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="widmung">
                  {tx('Widmung')}
                  <span className="text-destructive ml-0.5">*</span>
                </Label>
                <Textarea
                  id="widmung"
                  value={widmung}
                  onChange={(e) => setWidmung(e.target.value)}
                  placeholder={tx('Eine persönliche Widmung für den Hund …')}
                  rows={3}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="besondere_erlebnisse">{tx('Besondere Erlebnisse')}</Label>
                <Textarea
                  id="besondere_erlebnisse"
                  value={besondereErlebnisse}
                  onChange={(e) => setBesondereErlebnisse(e.target.value)}
                  placeholder={tx('Was war besonders schön oder lustig während des Aufenthalts?')}
                  rows={3}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="zusatztext">{tx('Zusatztext')}</Label>
                <Textarea
                  id="zusatztext"
                  value={zusatztext}
                  onChange={(e) => setZusatztext(e.target.value)}
                  placeholder={tx('Weiterer Text für das Portraet …')}
                  rows={2}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="erstellungsdatum">
                  {tx('Erstellungsdatum')}
                  <span className="text-destructive ml-0.5">*</span>
                </Label>
                <Input
                  id="erstellungsdatum"
                  type="date"
                  value={erstellungsdatum}
                  onChange={(e) => setErstellungsdatum(e.target.value)}
                />
              </div>
            </div>

            {saveError && (
              <p className="text-sm text-destructive">{saveError}</p>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
              >
                {tx('Zurück')}
              </Button>
              <Button
                disabled={!widmung || !erstellungsdatum || saving}
                onClick={handleSave}
              >
                {saving ? tx('Wird gespeichert …') : tx('Portraet anlegen')}
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

      {/* Schritt 3 — Erfolgsmeldung */}
      {step === 3 && (
        done ? (
          <div className="text-center py-12 space-y-6 max-w-sm mx-auto">
            <div className="flex justify-center">
              <div className="rounded-full bg-primary/10 p-4">
                <IconCheck size={48} className="text-primary" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">
                {tx('Portraet erfolgreich angelegt!')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {selectedBuchung
                  ? tx('Das Pfoten-Portraet für') + ' ' + selectedBuchung.hundName + ' ' + tx('wurde gespeichert.')
                  : tx('Das Pfoten-Portraet wurde gespeichert.')}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={handleReset}>
                {tx('Weiteres Portraet anlegen')}
              </Button>
              <Button variant="outline" asChild>
                <a href="#/">{tx('Zurück zum Dashboard')}</a>
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
