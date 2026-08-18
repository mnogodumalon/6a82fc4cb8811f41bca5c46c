/**
 * Pfoten-Portraet erstellen — 2-Schritt-Wizard.
 * Steps: 1) Buchung wählen (nur abgereiste Buchungen) → 2) Portraet verfassen & speichern.
 * Reads: buchungen (enriched → hundName, besitzerName). Writes: pfoten_portraets (createPfotenPortraet).
 * Composes: IntentWizardShell, EntitySelectStep.
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { IconPaw, IconHeart, IconCalendar } from '@tabler/icons-react';
import { tx } from '@/i18n';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichBuchungen } from '@/lib/enrich';
import type { EnrichedBuchungen } from '@/types/enriched';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { APP_IDS } from '@/types/app';
import { formatDate } from '@/lib/formatters';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function PfotenPortraetPage() {
  const data = useDashboardData();
  const { buchungen, loading, error, fetchAll } = data;

  const [step, setStep] = useState(1);
  const [selectedBuchungId, setSelectedBuchungId] = useState<string | null>(null);
  const [selectedHundId, setSelectedHundId] = useState<string | null>(null);
  const [selectedBesitzerId, setSelectedBesitzerId] = useState<string | null>(null);
  const [selectedBuchung, setSelectedBuchung] = useState<EnrichedBuchungen | null>(null);

  // Step 2 form state
  const [widmung, setWidmung] = useState('');
  const [besondereErlebnisse, setBesondereErlebnisse] = useState('');
  const [zusatztext, setZusatztext] = useState('');
  const [erstellungsdatum, setErstellungsdatum] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const enrichedBuchungen = enrichBuchungen(buchungen, data);
  const abgereisteBuchungen = enrichedBuchungen.filter(
    (b) => b.fields.status?.key === 'abgereist'
  );

  const handleBuchungSelect = (id: string) => {
    const buchung = abgereisteBuchungen.find((b) => b.record_id === id);
    if (!buchung) return;
    const hundId = extractRecordId(buchung.fields.hund);
    const besitzerId = extractRecordId(buchung.fields.besitzer);
    setSelectedBuchungId(id);
    setSelectedHundId(hundId);
    setSelectedBesitzerId(besitzerId);
    setSelectedBuchung(buchung);
    setStep(2);
  };

  const handleSave = async () => {
    if (!selectedBuchungId || !selectedHundId || !selectedBesitzerId) return;
    if (!widmung || !erstellungsdatum) return;

    setSaving(true);
    setSaveError(null);
    try {
      await LivingAppsService.createPfotenPortraet({
        hund: createRecordUrl(APP_IDS.HUNDE, selectedHundId),
        besitzer: createRecordUrl(APP_IDS.BESITZER, selectedBesitzerId),
        buchung: createRecordUrl(APP_IDS.BUCHUNGEN, selectedBuchungId),
        widmung,
        besondere_erlebnisse: besondereErlebnisse || undefined,
        zusatztext: zusatztext || undefined,
        erstellungsdatum,
      });
      setDone(true);
    } catch {
      setSaveError(tx('Das Portraet konnte nicht gespeichert werden. Bitte erneut versuchen.'));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setSelectedBuchungId(null);
    setSelectedHundId(null);
    setSelectedBesitzerId(null);
    setSelectedBuchung(null);
    setWidmung('');
    setBesondereErlebnisse('');
    setZusatztext('');
    setErstellungsdatum(format(new Date(), 'yyyy-MM-dd'));
    setSaveError(null);
    setDone(false);
  };

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
        <div className="rounded-full bg-emerald-100 p-6">
          <IconPaw size={48} className="text-emerald-600" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold">{tx('Portraet gespeichert!')}</h2>
          <p className="text-muted-foreground">
            {tx('Das Pfoten-Portraet für')} <strong>{selectedBuchung?.hundName}</strong> {tx('wurde erfolgreich erstellt.')}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={handleReset} variant="outline">
            {tx('Weiteres Portraet erstellen')}
          </Button>
          <Button asChild>
            <a href="#/">{tx('Zurück zum Dashboard')}</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <IntentWizardShell
      title={tx('Pfoten-Portraet erstellen')}
      subtitle={tx('Ein persönliches Andenken für abgereiste Gäste')}
      steps={[{ label: tx('Buchung') }, { label: tx('Portraet') }]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {step === 1 && (
        <EntitySelectStep
          items={abgereisteBuchungen.map((b) => ({
            id: b.record_id,
            title: b.hundName,
            subtitle: `${b.besitzerName} · ${b.fields.anreise ? formatDate(b.fields.anreise) : '—'} – ${b.fields.abreise ? formatDate(b.fields.abreise) : '—'}`,
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
        selectedBuchungId && selectedBuchung ? (
          <div className="space-y-6 max-w-2xl mx-auto">
            {/* Context card */}
            <div className="rounded-2xl border bg-card p-4 flex items-start gap-4">
              <div className="rounded-full bg-primary/10 p-3 shrink-0">
                <IconPaw size={24} className="text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-lg truncate">{selectedBuchung.hundName}</span>
                  <StatusBadge
                    statusKey={selectedBuchung.fields.status?.key}
                    label={selectedBuchung.fields.status?.label}
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{selectedBuchung.besitzerName}</p>
                <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                  <IconCalendar size={14} className="shrink-0" />
                  <span>
                    {selectedBuchung.fields.anreise ? formatDate(selectedBuchung.fields.anreise) : '—'}
                    {' – '}
                    {selectedBuchung.fields.abreise ? formatDate(selectedBuchung.fields.abreise) : '—'}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep(1)}
                className="shrink-0 text-muted-foreground"
              >
                {tx('Ändern')}
              </Button>
            </div>

            {/* Form */}
            <div className="rounded-2xl border bg-card p-6 space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <IconHeart size={20} className="text-primary shrink-0" />
                <h3 className="font-semibold text-base">{tx('Portraet verfassen')}</h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="widmung">
                  {tx('Persönliche Widmung')}{' '}
                  <span className="text-destructive" aria-hidden>*</span>
                </Label>
                <Textarea
                  id="widmung"
                  value={widmung}
                  onChange={(e) => setWidmung(e.target.value)}
                  placeholder={tx('Eine herzliche Widmung für den Hund und seine Familie …')}
                  rows={4}
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="besondere_erlebnisse">{tx('Besondere Erlebnisse')}</Label>
                <Textarea
                  id="besondere_erlebnisse"
                  value={besondereErlebnisse}
                  onChange={(e) => setBesondereErlebnisse(e.target.value)}
                  placeholder={tx('Was war in diesem Aufenthalt besonders schön oder unvergesslich?')}
                  rows={4}
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="zusatztext">{tx('Zusatztext')} <span className="text-xs text-muted-foreground">({tx('optional')})</span></Label>
                <Textarea
                  id="zusatztext"
                  value={zusatztext}
                  onChange={(e) => setZusatztext(e.target.value)}
                  placeholder={tx('Weiterer Text für das Portraet …')}
                  rows={3}
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="erstellungsdatum">
                  {tx('Erstellungsdatum')}{' '}
                  <span className="text-destructive" aria-hidden>*</span>
                </Label>
                <Input
                  id="erstellungsdatum"
                  type="date"
                  value={erstellungsdatum}
                  onChange={(e) => setErstellungsdatum(e.target.value)}
                />
              </div>

              {saveError && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                  {saveError}
                </p>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  onClick={handleSave}
                  disabled={saving || !widmung || !erstellungsdatum}
                  className="flex-1"
                >
                  {saving ? tx('Speichern …') : tx('Portraet speichern')}
                </Button>
                <Button variant="outline" onClick={() => setStep(1)}>
                  {tx('Zurück')}
                </Button>
              </div>
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
