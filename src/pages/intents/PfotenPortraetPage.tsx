/**
 * Pfoten-Porträt erstellen — 3-Schritt-Wizard.
 * Steps: 1) Hund wählen → 2) Buchung verknüpfen (optional) → 3) Porträt verfassen & anlegen.
 * Reads: hunde, buchungen. Writes: pfoten_portraets (createPfotenPortraet).
 * Composes: IntentWizardShell, EntitySelectStep.
 */
import { useState } from 'react';
import { format } from 'date-fns';
import {
  IconPaw,
  IconBook,
  IconHeart,
  IconPlayerSkipForward,
} from '@tabler/icons-react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDashboardData } from '@/hooks/useDashboardData';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { tx } from '@/i18n';

export default function PfotenPortraetPage() {
  const STEPS = [
  { label: tx('Hund') },
  { label: tx('Buchung') },
  { label: tx('Porträt') },
];

  const data = useDashboardData();
  const { hunde, buchungen, loading, error, fetchAll } = data;

  const [step, setStep] = useState(1);
  const [selectedHundId, setSelectedHundId] = useState<string | null>(null);
  const [selectedBuchungId, setSelectedBuchungId] = useState<string | null>(null);

  // Step 3 form fields
  const [widmung, setWidmung] = useState('');
  const [besondereErlebnisse, setBesondereErlebnisse] = useState('');
  const [zusatztext, setZusatztext] = useState('');
  const [erstellungsdatum] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const selectedHund = hunde.find(h => h.record_id === selectedHundId) ?? null;

  // Filter: Buchungen whose hund matches selected hund AND status === 'abgereist'
  const eligibleBuchungen = buchungen.filter(b =>
    extractRecordId(b.fields.hund) === selectedHundId &&
    b.fields.status?.key === 'abgereist'
  );

  const handleHundSelect = (id: string) => {
    setSelectedHundId(id);
    setSelectedBuchungId(null);
    setStep(2);
  };

  const handleBuchungSelect = (id: string) => {
    setSelectedBuchungId(id);
    setStep(3);
  };

  const handleSkipBuchung = () => {
    setSelectedBuchungId(null);
    setStep(3);
  };

  const handleSubmit = async () => {
    if (!selectedHundId || !widmung.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const besitzerId = selectedHund ? extractRecordId(selectedHund.fields.besitzer) : null;
      await LivingAppsService.createPfotenPortraet({
        hund: createRecordUrl(APP_IDS.HUNDE, selectedHundId),
        besitzer: besitzerId ? createRecordUrl(APP_IDS.BESITZER, besitzerId) : undefined,
        buchung: selectedBuchungId ? createRecordUrl(APP_IDS.BUCHUNGEN, selectedBuchungId) : undefined,
        widmung: widmung.trim(),
        besondere_erlebnisse: besondereErlebnisse.trim() || undefined,
        zusatztext: zusatztext.trim() || undefined,
        erstellungsdatum,
      });
      await fetchAll();
      setDone(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : tx('Unbekannter Fehler'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedHundId(null);
    setSelectedBuchungId(null);
    setWidmung('');
    setBesondereErlebnisse('');
    setZusatztext('');
    setSubmitError(null);
    setDone(false);
    setStep(1);
  };

  if (done) {
    return (
      <IntentWizardShell
        title={tx('Pfoten-Porträt')}
        subtitle={tx('Erinnerung erfolgreich erstellt')}
        steps={STEPS}
        currentStep={3}
        onStepChange={setStep}
        loading={loading}
        error={error}
        onRetry={fetchAll}
      >
        <div className="flex flex-col items-center gap-6 py-12 text-center">
          <div className="rounded-full bg-primary/10 p-6">
            <IconHeart size={48} className="text-primary" stroke={1.5} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">{tx('Porträt erstellt!')}</h2>
            <p className="text-muted-foreground text-sm">
              {tx('Das Pfoten-Porträt wurde erfolgreich gespeichert.')}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={handleReset} variant="outline">
              {tx('Neues Porträt anlegen')}
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
      title={tx('Pfoten-Porträt')}
      subtitle={tx('Ein individuelles Erinnerungsporträt für einen abgereisten Gast erstellen')}
      steps={STEPS}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── Step 1: Hund wählen ── */}
      {step === 1 && (
        <EntitySelectStep
          items={hunde.map(h => ({
            id: h.record_id,
            title: h.fields.name ?? tx('Unbekannter Hund'),
            subtitle: h.fields.rasse ?? undefined,
            icon: <IconPaw size={20} className="text-primary" stroke={1.5} />,
          }))}
          onSelect={handleHundSelect}
          searchPlaceholder={tx('Hund suchen …')}
          emptyText={tx('Keine Hunde gefunden')}
          emptyIcon={<IconPaw size={32} className="text-muted-foreground" stroke={1.5} />}
        />
      )}

      {/* ── Step 2: Buchung wählen (optional) ── */}
      {step === 2 && (
        selectedHundId ? (
          <div className="space-y-4">
            <EntitySelectStep
              items={eligibleBuchungen.map(b => ({
                id: b.record_id,
                title: [formatDate(b.fields.anreise), formatDate(b.fields.abreise)]
                  .filter(Boolean)
                  .join(' – ') || tx('Datum unbekannt'),
                subtitle: b.fields.platz?.label ?? undefined,
                status: b.fields.status
                  ? { key: b.fields.status.key, label: b.fields.status.label }
                  : undefined,
                icon: <IconBook size={20} className="text-primary" stroke={1.5} />,
              }))}
              onSelect={handleBuchungSelect}
              searchPlaceholder={tx('Buchung suchen …')}
              emptyText={tx('Keine abgereisten Buchungen für diesen Hund gefunden')}
              emptyIcon={<IconBook size={32} className="text-muted-foreground" stroke={1.5} />}
            />
            <div className="flex justify-center pt-2">
              <Button variant="ghost" onClick={handleSkipBuchung} className="gap-2">
                <IconPlayerSkipForward size={16} stroke={1.5} />
                {tx('Ohne Buchung fortfahren')}
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

      {/* ── Step 3: Porträt verfassen ── */}
      {step === 3 && (
        selectedHundId ? (
          <div className="space-y-6">
            <div className="rounded-2xl border bg-card p-4 space-y-1">
              <p className="text-xs text-muted-foreground">{tx('Porträt für')}</p>
              <p className="font-semibold">
                {selectedHund?.fields.name ?? tx('Unbekannter Hund')}
                {selectedHund?.fields.rasse ? (
                  <span className="font-normal text-muted-foreground">
                    {' · '}{selectedHund.fields.rasse}
                  </span>
                ) : null}
              </p>
              {selectedBuchungId && (() => {
                const b = buchungen.find(b => b.record_id === selectedBuchungId);
                if (!b) return null;
                return (
                  <p className="text-sm text-muted-foreground">
                    {[formatDate(b.fields.anreise), formatDate(b.fields.abreise)]
                      .filter(Boolean)
                      .join(' – ')}
                    {b.fields.platz?.label ? ` · ${b.fields.platz.label}` : ''}
                  </p>
                );
              })()}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="widmung">
                  {tx('Persönliche Widmung')}
                  <span className="text-destructive ml-1">*</span>
                </Label>
                <Textarea
                  id="widmung"
                  value={widmung}
                  onChange={e => setWidmung(e.target.value)}
                  placeholder={tx('Eine persönliche Widmung für den Hund und seinen Besitzer …')}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="besondere_erlebnisse">
                  {tx('Besondere Erlebnisse')}
                </Label>
                <Textarea
                  id="besondere_erlebnisse"
                  value={besondereErlebnisse}
                  onChange={e => setBesondereErlebnisse(e.target.value)}
                  placeholder={tx('Was war besonders an diesem Aufenthalt?')}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="zusatztext">
                  {tx('Weiterer Text')}
                </Label>
                <Textarea
                  id="zusatztext"
                  value={zusatztext}
                  onChange={e => setZusatztext(e.target.value)}
                  placeholder={tx('Ergänzende Informationen oder Notizen …')}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="erstellungsdatum">
                  {tx('Erstellungsdatum')}
                </Label>
                <Input
                  id="erstellungsdatum"
                  type="date"
                  value={erstellungsdatum}
                  readOnly
                  className="bg-muted/50"
                />
              </div>
            </div>

            {submitError && (
              <p className="text-sm text-destructive">{submitError}</p>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                disabled={submitting}
              >
                {tx('Zurück')}
              </Button>
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={!widmung.trim() || submitting}
              >
                {submitting ? tx('Speichern …') : tx('Porträt speichern')}
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
