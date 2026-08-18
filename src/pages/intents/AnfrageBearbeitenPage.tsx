/**
 * Anfrage bearbeiten — 2-Schritt-Wizard.
 * Steps: 1) Offene Buchungsanfrage wählen → 2a) Ablehnen (direkt) oder 2b) Bestätigen mit Platz/Datum/Preis → Besitzer + Hund + Buchung anlegen.
 * Reads: buchungsanfragen. Writes: besitzer (createBesitzerEntry), hunde (createHundeEntry), buchungen (createBuchungenEntry), buchungsanfragen (updateBuchungsanfragenEntry).
 * Composes: IntentWizardShell, EntitySelectStep, StatusBadge.
 */
import { useState } from 'react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { Buchungsanfragen } from '@/types/app';
import { LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { tx } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IconDog, IconCalendar, IconCheck, IconX, IconAlertCircle } from '@tabler/icons-react';

export default function AnfrageBearbeitenPage() {
  const { buchungsanfragen, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);
  const [selectedAnfrageId, setSelectedAnfrageId] = useState<string | null>(null);
  const [showConfirmForm, setShowConfirmForm] = useState(false);

  // Confirm form fields
  const PLATZ_OPTIONS = LOOKUP_OPTIONS['buchungen']?.['platz'] ?? [];
  const [platz, setPlatz] = useState(PLATZ_OPTIONS[0]?.key ?? '');
  const [anreise, setAnreise] = useState('');
  const [abreise, setAbreise] = useState('');
  const [preisGesamt, setPreisGesamt] = useState('');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // IDs to prevent duplicate creation on retry
  const [createdBesitzerId, setCreatedBesitzerId] = useState<string | null>(null);
  const [createdHundId, setCreatedHundId] = useState<string | null>(null);

  const offeneAnfragen = buchungsanfragen.filter(
    (a) => a.fields.anfrage_status?.key === 'offen'
  );

  const selectedAnfrage: Buchungsanfragen | undefined = selectedAnfrageId
    ? buchungsanfragen.find((a) => a.record_id === selectedAnfrageId)
    : undefined;

  const handleSelectAnfrage = (id: string) => {
    const anfrage = buchungsanfragen.find((a) => a.record_id === id);
    setSelectedAnfrageId(id);
    setAnreise(anfrage?.fields.wunsch_anreise ?? '');
    setAbreise(anfrage?.fields.wunsch_abreise ?? '');
    setPreisGesamt('');
    setShowConfirmForm(false);
    setSubmitError(null);
    setCreatedBesitzerId(null);
    setCreatedHundId(null);
    setStep(2);
  };

  const handleAblehnen = async () => {
    if (!selectedAnfrageId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(selectedAnfrageId, {
        anfrage_status: 'abgelehnt',
      });
      await fetchAll();
      setSelectedAnfrageId(null);
      setShowConfirmForm(false);
      setStep(1);
    } catch {
      setSubmitError(tx('Fehler beim Ablehnen. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleBestaetigen = async () => {
    if (!selectedAnfrage || !platz || !anreise || !abreise) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Step a: Besitzer anlegen (idempotent: skip if already created on a previous attempt)
      let besitzerId = createdBesitzerId;
      if (!besitzerId) {
        const besitzer = await LivingAppsService.createBesitzerEntry({
          vorname: selectedAnfrage.fields.anfrage_vorname,
          nachname: selectedAnfrage.fields.anfrage_nachname,
          telefon: selectedAnfrage.fields.anfrage_telefon,
          email: selectedAnfrage.fields.anfrage_email,
        });
        besitzerId = besitzer.record_id;
        setCreatedBesitzerId(besitzerId);
      }

      // Step b: Hund anlegen (idempotent)
      let hundId = createdHundId;
      if (!hundId) {
        const hund = await LivingAppsService.createHundeEntry({
          name: selectedAnfrage.fields.hund_name,
          rasse: selectedAnfrage.fields.hund_rasse,
          besitzer: createRecordUrl('6a82fc1d74b3e71c1357a140', besitzerId),
        });
        hundId = hund.record_id;
        setCreatedHundId(hundId);
      }

      // Step c: Buchung erstellen
      await LivingAppsService.createBuchungenEntry({
        hund: createRecordUrl('6a82fc2393a7a2a067a822a8', hundId),
        besitzer: createRecordUrl('6a82fc1d74b3e71c1357a140', besitzerId),
        anreise,
        abreise,
        platz,
        status: 'geplant',
        preis_gesamt: preisGesamt ? parseFloat(preisGesamt) : undefined,
      });

      // Step d: Anfrage schließen
      await LivingAppsService.updateBuchungsanfragenEntry(selectedAnfrage.record_id, {
        anfrage_status: 'bestaetigt',
      });

      await fetchAll();
      window.location.hash = '/';
    } catch {
      setSubmitError(tx('Fehler beim Bestätigen. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = !!platz && !!anreise && !!abreise;

  return (
    <IntentWizardShell
      title={tx('Anfrage bearbeiten')}
      subtitle={tx('Offene Buchungsanfragen sichten, bestätigen oder ablehnen')}
      steps={[
        { label: tx('Anfrage wählen') },
        { label: tx('Entscheiden') },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Step 1: Anfrage wählen */}
      {step === 1 && (
        <EntitySelectStep
          items={offeneAnfragen.map((a) => ({
            id: a.record_id,
            title: `${a.fields.anfrage_vorname ?? ''} ${a.fields.anfrage_nachname ?? ''}`.trim() || tx('Unbekannte Person'),
            subtitle: [
              a.fields.hund_name
                ? `${a.fields.hund_name}${a.fields.hund_rasse ? ` (${a.fields.hund_rasse})` : ''}`
                : null,
              a.fields.wunsch_anreise && a.fields.wunsch_abreise
                ? `${formatDate(a.fields.wunsch_anreise)} – ${formatDate(a.fields.wunsch_abreise)}`
                : a.fields.wunsch_anreise
                ? formatDate(a.fields.wunsch_anreise)
                : null,
              a.fields.nachricht ? a.fields.nachricht : null,
            ]
              .filter(Boolean)
              .join(' · '),
            status: a.fields.anfrage_status
              ? { key: a.fields.anfrage_status.key, label: a.fields.anfrage_status.label }
              : undefined,
            icon: <IconDog size={20} className="text-primary" />,
          }))}
          onSelect={handleSelectAnfrage}
          searchPlaceholder={tx('Anfrage suchen …')}
          emptyText={tx('Keine offenen Anfragen vorhanden.')}
          emptyIcon={<IconCalendar size={32} className="text-muted-foreground" />}
        />
      )}

      {/* Step 2: Entscheiden */}
      {step === 2 && (
        selectedAnfrage ? (
          <div className="space-y-6">
            {/* Anfrage-Zusammenfassung */}
            <div className="rounded-2xl border bg-card p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <h3 className="font-semibold text-base truncate">
                    {selectedAnfrage.fields.anfrage_vorname ?? ''}{' '}
                    {selectedAnfrage.fields.anfrage_nachname ?? ''}
                  </h3>
                  {(selectedAnfrage.fields.anfrage_telefon || selectedAnfrage.fields.anfrage_email) && (
                    <p className="text-sm text-muted-foreground truncate">
                      {[selectedAnfrage.fields.anfrage_telefon, selectedAnfrage.fields.anfrage_email]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                </div>
                <StatusBadge
                  statusKey={selectedAnfrage.fields.anfrage_status?.key}
                  label={selectedAnfrage.fields.anfrage_status?.label}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">{tx('Hund')}</p>
                  <p className="text-sm">
                    {selectedAnfrage.fields.hund_name ?? tx('—')}
                    {selectedAnfrage.fields.hund_rasse
                      ? ` (${selectedAnfrage.fields.hund_rasse})`
                      : ''}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">{tx('Wunschtermin')}</p>
                  <p className="text-sm">
                    {selectedAnfrage.fields.wunsch_anreise
                      ? formatDate(selectedAnfrage.fields.wunsch_anreise)
                      : tx('—')}
                    {selectedAnfrage.fields.wunsch_abreise
                      ? ` – ${formatDate(selectedAnfrage.fields.wunsch_abreise)}`
                      : ''}
                  </p>
                </div>
              </div>

              {selectedAnfrage.fields.nachricht && (
                <div className="space-y-1 pt-1">
                  <p className="text-xs text-muted-foreground font-medium">{tx('Nachricht')}</p>
                  <p className="text-sm text-foreground leading-relaxed">
                    {selectedAnfrage.fields.nachricht}
                  </p>
                </div>
              )}
            </div>

            {/* Aktions-Buttons */}
            {!showConfirmForm && (
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => setShowConfirmForm(true)}
                  className="flex items-center gap-2"
                  disabled={submitting}
                >
                  <IconCheck size={16} className="shrink-0" />
                  {tx('Bestätigen & Buchung anlegen')}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleAblehnen}
                  className="flex items-center gap-2"
                  disabled={submitting}
                >
                  <IconX size={16} className="shrink-0" />
                  {submitting ? tx('Wird abgelehnt …') : tx('Ablehnen')}
                </Button>
              </div>
            )}

            {/* Bestätigungs-Formular */}
            {showConfirmForm && (
              <div className="rounded-2xl border bg-card p-5 space-y-5">
                <h3 className="font-semibold text-base">{tx('Buchungsdetails festlegen')}</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Platz */}
                  <div className="space-y-2">
                    <Label htmlFor="platz">{tx('Platz')} *</Label>
                    <Select value={platz} onValueChange={setPlatz}>
                      <SelectTrigger id="platz" className="w-full">
                        <SelectValue placeholder={tx('Platz wählen')} />
                      </SelectTrigger>
                      <SelectContent>
                        {PLATZ_OPTIONS.map((opt) => (
                          <SelectItem key={opt.key} value={opt.key}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Preis (optional) */}
                  <div className="space-y-2">
                    <Label htmlFor="preis">{tx('Gesamtpreis (€)')}</Label>
                    <Input
                      id="preis"
                      type="number"
                      min="0"
                      step="0.01"
                      value={preisGesamt}
                      onChange={(e) => setPreisGesamt(e.target.value)}
                      placeholder={tx('z. B. 250')}
                    />
                  </div>

                  {/* Anreise */}
                  <div className="space-y-2">
                    <Label htmlFor="anreise">{tx('Anreise')} *</Label>
                    <Input
                      id="anreise"
                      type="date"
                      value={anreise}
                      onChange={(e) => setAnreise(e.target.value)}
                    />
                  </div>

                  {/* Abreise */}
                  <div className="space-y-2">
                    <Label htmlFor="abreise">{tx('Abreise')} *</Label>
                    <Input
                      id="abreise"
                      type="date"
                      value={abreise}
                      onChange={(e) => setAbreise(e.target.value)}
                    />
                  </div>
                </div>

                {submitError && (
                  <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    <IconAlertCircle size={16} className="shrink-0" />
                    {submitError}
                  </div>
                )}

                <div className="flex flex-wrap gap-3 pt-1">
                  <Button
                    onClick={handleBestaetigen}
                    disabled={!canSubmit || submitting}
                    className="flex items-center gap-2"
                  >
                    <IconCheck size={16} className="shrink-0" />
                    {submitting ? tx('Wird erstellt …') : tx('Bestätigen & Buchung erstellen')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowConfirmForm(false);
                      setSubmitError(null);
                    }}
                    disabled={submitting}
                  >
                    {tx('Abbrechen')}
                  </Button>
                </div>
              </div>
            )}

            {/* Zurück zu Schritt 1 */}
            {!showConfirmForm && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStep(1);
                  setSelectedAnfrageId(null);
                  setSubmitError(null);
                }}
                className="text-muted-foreground"
              >
                {tx('← Andere Anfrage wählen')}
              </Button>
            )}
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt braucht eine Auswahl aus Schritt 1.')}
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
