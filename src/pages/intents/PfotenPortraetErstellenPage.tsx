/**
 * Pfoten-Porträt erstellen — 2-Schritt-Wizard.
 * Steps: 1) Buchung wählen (nur Status 'anwesend' oder 'abgereist') →
 *         2) Porträt verfassen (Widmung, Erlebnisse, Zusatztext, Datum) & speichern.
 * Reads: buchungen (gefiltert nach Status). Writes: pfoten_portraets (createPfotenPortraet).
 * Composes: IntentWizardShell, EntitySelectStep.
 */

import { useState } from 'react';
import { format } from 'date-fns';
import { IconPaw, IconCalendar, IconUser, IconCheck } from '@tabler/icons-react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichBuchungen } from '@/lib/enrich';
import type { EnrichedBuchungen } from '@/types/enriched';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { APP_IDS } from '@/types/app';
import { formatDate } from '@/lib/formatters';
import { tx } from '@/i18n';

export default function PfotenPortraetErstellenPage() {
  const STEPS = [
  { label: tx('Buchung wählen') },
  { label: tx('Porträt verfassen') },
];

  const { buchungen, hundeMap, besitzerMap, loading, error, fetchAll } = useDashboardData();
  const enrichedBuchungen = enrichBuchungen(buchungen, { hundeMap, besitzerMap });

  const [step, setStep] = useState(1);
  const [selectedBuchung, setSelectedBuchung] = useState<EnrichedBuchungen | null>(null);

  // Step 2 form state
  const [widmung, setWidmung] = useState('');
  const [besondereErlebnisse, setBesondereErlebnisse] = useState('');
  const [zusatztext, setZusatztext] = useState('');
  const [erstellungsdatum, setErstellungsdatum] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [portraetId, setPortraetId] = useState<string | null>(null);

  // Filter: only Buchungen with status 'anwesend' or 'abgereist'
  const eligibleBuchungen = enrichedBuchungen.filter(b =>
    ['anwesend', 'abgereist'].includes(b.fields.status?.key ?? '')
  );

  const handleSelectBuchung = (id: string) => {
    const found = enrichedBuchungen.find(b => b.record_id === id) ?? null;
    setSelectedBuchung(found);
    setStep(2);
  };

  const handleSave = async () => {
    if (!selectedBuchung) return;
    if (!widmung.trim()) return;

    // Idempotency: do not create a second portrait on retry
    let pid = portraetId;
    if (pid) {
      setDone(true);
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const hundId = extractRecordId(selectedBuchung.fields.hund);
      const besitzerId = extractRecordId(selectedBuchung.fields.besitzer);

      const result = await LivingAppsService.createPfotenPortraet({
        hund: hundId ? createRecordUrl(APP_IDS.HUNDE, hundId) : undefined,
        besitzer: besitzerId ? createRecordUrl(APP_IDS.BESITZER, besitzerId) : undefined,
        buchung: createRecordUrl(APP_IDS.BUCHUNGEN, selectedBuchung.record_id),
        widmung,
        besondere_erlebnisse: besondereErlebnisse || undefined,
        zusatztext: zusatztext || undefined,
        erstellungsdatum,
      });
      pid = result.record_id;
      setPortraetId(pid);
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
    setErstellungsdatum(format(new Date(), 'yyyy-MM-dd'));
    setSaveError(null);
    setDone(false);
    setPortraetId(null);
  };

  if (done) {
    return (
      <IntentWizardShell
        title={tx('Pfoten-Porträt erstellen')}
        subtitle={tx('Individuelle Erinnerung für Hund und Besitzer')}
        steps={STEPS}
        currentStep={2}
        onStepChange={setStep}
        loading={loading}
        error={error}
        onRetry={fetchAll}
      >
        <div className="flex flex-col items-center gap-6 py-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <IconCheck size={32} className="text-emerald-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">{tx('Porträt erfolgreich erstellt!')}</h2>
            <p className="text-muted-foreground">
              {tx('Das Pfoten-Porträt für')} <strong>{selectedBuchung?.hundName}</strong> {tx('wurde gespeichert.')}
            </p>
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button onClick={handleReset} variant="outline">
              {tx('Weiteres Porträt erstellen')}
            </Button>
            <Button asChild>
              <a href="#/">{tx('Zurück zum Dashboard')}</a>
            </Button>
          </div>
        </div>
      </IntentWizardShell>
    );
  }

  return (
    <IntentWizardShell
      title={tx('Pfoten-Porträt erstellen')}
      subtitle={tx('Individuelle Erinnerung für Hund und Besitzer')}
      steps={STEPS}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Step 1: Buchung wählen */}
      {step === 1 && (
        <EntitySelectStep
          items={eligibleBuchungen.map(b => ({
            id: b.record_id,
            title: b.hundName || tx('Unbekannter Hund'),
            subtitle: [
              b.besitzerName,
              b.fields.anreise && b.fields.abreise
                ? `${formatDate(b.fields.anreise)} – ${formatDate(b.fields.abreise)}`
                : b.fields.anreise
                  ? formatDate(b.fields.anreise)
                  : undefined,
            ].filter(Boolean).join(' · '),
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
          <div className="space-y-6">
            {/* Context card */}
            <div className="rounded-2xl border bg-secondary/40 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <IconPaw size={16} className="shrink-0 text-primary" />
                <span>{selectedBuchung.hundName || tx('Unbekannter Hund')}</span>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <IconUser size={14} className="shrink-0" />
                  {selectedBuchung.besitzerName || tx('Unbekannter Besitzer')}
                </span>
                {(selectedBuchung.fields.anreise || selectedBuchung.fields.abreise) && (
                  <span className="flex items-center gap-1">
                    <IconCalendar size={14} className="shrink-0" />
                    {selectedBuchung.fields.anreise && selectedBuchung.fields.abreise
                      ? `${formatDate(selectedBuchung.fields.anreise)} – ${formatDate(selectedBuchung.fields.abreise)}`
                      : selectedBuchung.fields.anreise
                        ? formatDate(selectedBuchung.fields.anreise)
                        : formatDate(selectedBuchung.fields.abreise!)}
                  </span>
                )}
              </div>
            </div>

            {/* Form fields */}
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="widmung">
                  {tx('Persönliche Widmung')}
                  <span className="text-destructive ml-1">*</span>
                </Label>
                <Textarea
                  id="widmung"
                  value={widmung}
                  onChange={e => setWidmung(e.target.value)}
                  placeholder={tx('Eine persönliche Nachricht an den Besitzer …')}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="besondere_erlebnisse">{tx('Besondere Erlebnisse')}</Label>
                <Textarea
                  id="besondere_erlebnisse"
                  value={besondereErlebnisse}
                  onChange={e => setBesondereErlebnisse(e.target.value)}
                  placeholder={tx('Was war besonders schön oder lustig in diesem Aufenthalt?')}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="zusatztext">{tx('Weiterer Text')}</Label>
                <Textarea
                  id="zusatztext"
                  value={zusatztext}
                  onChange={e => setZusatztext(e.target.value)}
                  placeholder={tx('Zusätzliche individuelle Informationen …')}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="erstellungsdatum">{tx('Erstellungsdatum')}</Label>
                <Input
                  id="erstellungsdatum"
                  type="date"
                  value={erstellungsdatum}
                  onChange={e => setErstellungsdatum(e.target.value)}
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
                disabled={saving}
              >
                {tx('Zurück')}
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !widmung.trim()}
              >
                {saving ? tx('Wird gespeichert …') : tx('Porträt speichern')}
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
