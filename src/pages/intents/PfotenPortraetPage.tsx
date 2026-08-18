/**
 * Pfoten-Portraet anlegen — 2-Schritt-Wizard.
 * Steps: 1) Buchung wählen (nur status 'anwesend' oder 'abgereist') →
 *         2) Portraet-Felder erfassen & speichern.
 * Reads: buchungen, hunde, besitzer (via useDashboardData + enrichBuchungen).
 * Writes: pfoten_portraets (LivingAppsService.createPfotenPortraet).
 * Composes: IntentWizardShell, EntitySelectStep, StatusBadge.
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { IconPaw, IconNotes, IconCalendar, IconArrowRight, IconCheck } from '@tabler/icons-react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichBuchungen } from '@/lib/enrich';
import type { EnrichedBuchungen } from '@/types/enriched';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { tx } from '@/i18n';

export default function PfotenPortraetPage() {
  const { buchungen, hundeMap, besitzerMap, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);
  const [selectedBuchung, setSelectedBuchung] = useState<EnrichedBuchungen | null>(null);
  const [hundId, setHundId] = useState<string | null>(null);
  const [besitzerId, setBesitzerId] = useState<string | null>(null);

  // Schritt-2-Formularfelder
  const [widmung, setWidmung] = useState('');
  const [besondereErlebnisse, setBesondereErlebnisse] = useState('');
  const [zusatztext, setZusatztext] = useState('');
  const [erstellungsdatum, setErstellungsdatum] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  // Submit-State
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const enrichedBuchungen = enrichBuchungen(buchungen, { hundeMap, besitzerMap });

  const eligibleBuchungen = enrichedBuchungen.filter(
    (b) => b.fields.status?.key === 'anwesend' || b.fields.status?.key === 'abgereist'
  );

  const handleSelectBuchung = (id: string) => {
    const buchung = eligibleBuchungen.find((b) => b.record_id === id);
    if (!buchung) return;
    setSelectedBuchung(buchung);

    const hId = extractRecordId(buchung.fields.hund);
    const bId = extractRecordId(buchung.fields.besitzer);
    setHundId(hId ?? null);
    setBesitzerId(bId ?? null);
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!selectedBuchung || !hundId || !besitzerId || !widmung || !erstellungsdatum) return;

    // Idempotenz-Guard: bei Retry nicht erneut anlegen
    let pid = createdId;
    if (pid) {
      setStep(3);
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
        erstellungsdatum,
      });
      pid = result.record_id;
      setCreatedId(pid);
      await fetchAll();
      setStep(3);
    } catch {
      setSubmitError(tx('Das Portraet konnte nicht gespeichert werden. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setSelectedBuchung(null);
    setHundId(null);
    setBesitzerId(null);
    setWidmung('');
    setBesondereErlebnisse('');
    setZusatztext('');
    setErstellungsdatum(format(new Date(), 'yyyy-MM-dd'));
    setSubmitError(null);
    setCreatedId(null);
  };

  return (
    <IntentWizardShell
      title={tx('Pfoten-Portraet anlegen')}
      subtitle={tx('Erinnerungen festhalten — für jeden besonderen Gast')}
      steps={[{ label: tx('Buchung') }, { label: tx('Portraet') }, { label: tx('Fertig') }]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Schritt 1: Buchung wählen */}
      {step === 1 && (
        <EntitySelectStep
          items={eligibleBuchungen.map((b) => ({
            id: b.record_id,
            title: b.hundName || tx('Unbekannter Hund'),
            subtitle: [
              b.besitzerName,
              b.fields.anreise ? formatDate(b.fields.anreise) : null,
              b.fields.abreise ? `– ${formatDate(b.fields.abreise)}` : null,
            ]
              .filter(Boolean)
              .join(' '),
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

      {/* Schritt 2: Portraet-Felder */}
      {step === 2 && (
        selectedBuchung ? (
          <div className="space-y-6 max-w-xl">
            {/* Kontext-Karte */}
            <div className="rounded-2xl border bg-secondary p-4 flex items-start gap-3">
              <IconPaw size={20} className="text-primary shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="font-semibold truncate">{selectedBuchung.hundName || tx('Hund')}</p>
                <p className="text-sm text-muted-foreground truncate">{selectedBuchung.besitzerName}</p>
                <div className="mt-1">
                  <StatusBadge
                    statusKey={selectedBuchung.fields.status?.key}
                    label={selectedBuchung.fields.status?.label}
                  />
                </div>
              </div>
            </div>

            {/* Formular */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="widmung" className="flex items-center gap-1">
                  <IconNotes size={15} className="shrink-0" />
                  {tx('Widmung')}
                  <span className="text-destructive ml-0.5">*</span>
                </Label>
                <Textarea
                  id="widmung"
                  value={widmung}
                  onChange={(e) => setWidmung(e.target.value)}
                  placeholder={tx('Eine persönliche Widmung für den Hund und seine Familie …')}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="besondere_erlebnisse" className="flex items-center gap-1">
                  <IconNotes size={15} className="shrink-0" />
                  {tx('Besondere Erlebnisse')}
                </Label>
                <Textarea
                  id="besondere_erlebnisse"
                  value={besondereErlebnisse}
                  onChange={(e) => setBesondereErlebnisse(e.target.value)}
                  placeholder={tx('Was hat den Aufenthalt besonders gemacht? Lustige Momente, neue Freundschaften …')}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="zusatztext" className="flex items-center gap-1">
                  <IconNotes size={15} className="shrink-0" />
                  {tx('Zusatztext')}
                </Label>
                <Textarea
                  id="zusatztext"
                  value={zusatztext}
                  onChange={(e) => setZusatztext(e.target.value)}
                  placeholder={tx('Weitere Anmerkungen oder eine Grußbotschaft …')}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="erstellungsdatum" className="flex items-center gap-1">
                  <IconCalendar size={15} className="shrink-0" />
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

            {submitError && (
              <p className="text-sm text-destructive">{submitError}</p>
            )}

            <div className="flex gap-3 flex-wrap">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
              >
                {tx('Zurück')}
              </Button>
              <Button
                disabled={!widmung || !erstellungsdatum || submitting}
                onClick={handleSubmit}
                className="flex items-center gap-2"
              >
                {submitting ? tx('Wird gespeichert …') : (
                  <>
                    {tx('Portraet erstellen')}
                    <IconArrowRight size={16} className="shrink-0" />
                  </>
                )}
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

      {/* Schritt 3: Erfolg */}
      {step === 3 && (
        createdId ? (
          <div className="text-center py-12 space-y-6 max-w-sm mx-auto">
            <div className="flex justify-center">
              <div className="rounded-full bg-emerald-100 p-4">
                <IconCheck size={36} className="text-emerald-600" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">{tx('Portraet gespeichert!')}</h2>
              <p className="text-sm text-muted-foreground">
                {tx('Das Pfoten-Portraet für')} <strong>{selectedBuchung?.hundName}</strong>{' '}
                {tx('wurde erfolgreich angelegt.')}
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Button onClick={handleReset} variant="outline">
                {tx('Weiteres Portraet anlegen')}
              </Button>
              <a href="#/" className="text-sm text-primary underline-offset-4 hover:underline">
                {tx('Zurück zum Dashboard')}
              </a>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt braucht die Auswahl aus Schritt 2.')}
            </p>
            <Button variant="outline" onClick={() => setStep(2)}>
              {tx('Neu starten')}
            </Button>
          </div>
        )
      )}
    </IntentWizardShell>
  );
}
