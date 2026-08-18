/**
 * Pfoten-Portraet erstellen — 2-Schritt-Wizard.
 * Steps: 1) Buchung auswählen (anwesend/abgereist) → 2) Portraet verfassen & speichern.
 * Reads: buchungen, hunde, besitzer. Writes: pfoten_portraets (createPfotenPortraet).
 * Composes: IntentWizardShell, EntitySelectStep.
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { IconPaw, IconCheck, IconFileText } from '@tabler/icons-react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichBuchungen } from '@/lib/enrich';
import type { EnrichedBuchungen } from '@/types/enriched';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { tx } from '@/i18n';

export default function PfotenPortraetPage() {
  const data = useDashboardData();
  const { buchungen, hundeMap, besitzerMap, loading, error, fetchAll } = data;

  const [step, setStep] = useState(1);
  const [selectedBuchung, setSelectedBuchung] = useState<EnrichedBuchungen | null>(null);
  const [widmung, setWidmung] = useState('');
  const [besondereErlebnisse, setBesondereErlebnisse] = useState('');
  const [zusatztext, setZusatztext] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const enrichedBuchungen = enrichBuchungen(buchungen, { hundeMap, besitzerMap });

  const eligibleBuchungen = enrichedBuchungen.filter(
    b => ['anwesend', 'abgereist'].includes(b.fields.status?.key ?? '')
  );

  const handleBuchungSelect = (id: string) => {
    const found = eligibleBuchungen.find(b => b.record_id === id);
    if (found) {
      setSelectedBuchung(found);
      setStep(2);
    }
  };

  const handleSave = async () => {
    if (!selectedBuchung) return;
    setSaving(true);
    setSaveError(null);
    try {
      const hundRecordId = extractRecordId(selectedBuchung.fields.hund);
      const besitzerRecordId = extractRecordId(selectedBuchung.fields.besitzer);
      await LivingAppsService.createPfotenPortraet({
        hund: hundRecordId ? createRecordUrl(APP_IDS.HUNDE, hundRecordId) : undefined,
        besitzer: besitzerRecordId ? createRecordUrl(APP_IDS.BESITZER, besitzerRecordId) : undefined,
        buchung: createRecordUrl(APP_IDS.BUCHUNGEN, selectedBuchung.record_id),
        widmung,
        besondere_erlebnisse: besondereErlebnisse,
        zusatztext,
        erstellungsdatum: format(new Date(), 'yyyy-MM-dd'),
      });
      await fetchAll();
      setDone(true);
    } catch (e) {
      setSaveError(tx('Speichern fehlgeschlagen. Bitte erneut versuchen.'));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setSelectedBuchung(null);
    setWidmung('');
    setBesondereErlebnisse('');
    setZusatztext('');
    setSaveError(null);
    setDone(false);
  };

  return (
    <IntentWizardShell
      title={tx('Pfoten-Portraet erstellen')}
      subtitle={tx('Individuelles Portraet für einen Gast-Hund verfassen')}
      steps={[{ label: tx('Aufenthalt') }, { label: tx('Portraet') }]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Schritt 1: Buchung auswählen */}
      {step === 1 && (
        <EntitySelectStep
          items={eligibleBuchungen.map(b => ({
            id: b.record_id,
            title: b.hundName || tx('Unbekannter Hund'),
            subtitle: [
              b.besitzerName,
              b.fields.anreise ? formatDate(b.fields.anreise) : null,
              b.fields.abreise ? `– ${formatDate(b.fields.abreise)}` : null,
            ].filter(Boolean).join(' '),
            status: b.fields.status
              ? { key: b.fields.status.key, label: b.fields.status.label }
              : undefined,
            icon: <IconPaw size={20} className="text-primary" />,
          }))}
          onSelect={handleBuchungSelect}
          searchPlaceholder={tx('Hund oder Besitzer suchen …')}
          emptyText={tx('Keine aktiven oder abgereisten Buchungen gefunden.')}
          emptyIcon={<IconPaw size={32} className="text-muted-foreground" />}
        />
      )}

      {/* Schritt 2: Portraet verfassen */}
      {step === 2 && (
        selectedBuchung ? (
          done ? (
            <div className="flex flex-col items-center gap-6 py-12 text-center">
              <div className="rounded-full bg-emerald-100 p-4">
                <IconCheck size={40} className="text-emerald-600" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold">{tx('Portraet gespeichert!')}</h2>
                <p className="text-muted-foreground">
                  {tx('Das Pfoten-Portraet für')} <strong>{selectedBuchung.hundName}</strong> {tx('wurde erfolgreich erstellt.')}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={handleReset} variant="default">
                  {tx('Neues Portraet erstellen')}
                </Button>
                <a href="#/" className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent">
                  {tx('Zurück zum Dashboard')}
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Buchungs-Kontext */}
              <div className="rounded-2xl border bg-card p-4 flex items-start gap-3">
                <IconPaw size={24} className="text-primary shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{selectedBuchung.hundName}</p>
                  <p className="text-sm text-muted-foreground">{selectedBuchung.besitzerName}</p>
                  <div className="flex flex-wrap gap-2 mt-1 items-center">
                    {selectedBuchung.fields.status && (
                      <StatusBadge
                        statusKey={selectedBuchung.fields.status.key}
                        label={selectedBuchung.fields.status.label}
                      />
                    )}
                    {selectedBuchung.fields.anreise && (
                      <span className="text-xs text-muted-foreground">
                        {formatDate(selectedBuchung.fields.anreise)}
                        {selectedBuchung.fields.abreise ? ` – ${formatDate(selectedBuchung.fields.abreise)}` : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Formularfelder */}
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="widmung" className="text-sm font-medium flex items-center gap-2">
                    <IconFileText size={16} className="shrink-0" />
                    {tx('Persönliche Widmung')}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="widmung"
                    value={widmung}
                    onChange={e => setWidmung(e.target.value)}
                    placeholder={tx('Eine persönliche Widmung an den Besitzer …')}
                    rows={3}
                    className="resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="besondere_erlebnisse" className="text-sm font-medium">
                    {tx('Besondere Erlebnisse')}
                  </Label>
                  <Textarea
                    id="besondere_erlebnisse"
                    value={besondereErlebnisse}
                    onChange={e => setBesondereErlebnisse(e.target.value)}
                    placeholder={tx('Was hat der Hund während des Aufenthalts erlebt? …')}
                    rows={4}
                    className="resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="zusatztext" className="text-sm font-medium">
                    {tx('Weiterer individueller Text')}
                  </Label>
                  <Textarea
                    id="zusatztext"
                    value={zusatztext}
                    onChange={e => setZusatztext(e.target.value)}
                    placeholder={tx('Weitere persönliche Anmerkungen oder Grüße …')}
                    rows={3}
                    className="resize-none"
                  />
                </div>
              </div>

              {saveError && (
                <p className="text-sm text-destructive">{saveError}</p>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  onClick={handleSave}
                  disabled={!widmung.trim() || saving}
                  className="flex-1 sm:flex-none"
                >
                  {saving ? tx('Wird gespeichert …') : tx('Portraet speichern')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  disabled={saving}
                >
                  {tx('Anderen Aufenthalt wählen')}
                </Button>
              </div>
            </div>
          )
        ) : (
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
