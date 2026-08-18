/**
 * Anfrage bestätigen — 3-Schritt-Wizard.
 * Steps: 1) Offene Anfrage wählen → 2) Prüfen & entscheiden (ablehnen oder bestätigen)
 *        → 3) Buchung anlegen (Besitzer + Hund + Buchung verketten, Anfrage auf 'bestaetigt' setzen).
 * Reads: buchungsanfragen. Writes: besitzer (createBesitzerEntry), hunde (createHundeEntry),
 *        buchungen (createBuchungenEntry), buchungsanfragen (updateBuchungsanfragenEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */
import { useState } from 'react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { tx } from '@/i18n';
import { formatDate } from '@/lib/formatters';
import {
  IconUser,
  IconDog,
  IconCalendar,
  IconMail,
  IconPhone,
  IconMessageCircle,
  IconCheck,
  IconX,
  IconAlertCircle,
} from '@tabler/icons-react';

export default function AnfrageBestaetigenPage() {
  const { buchungsanfragen, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);
  const [selectedAnfrageId, setSelectedAnfrageId] = useState<string | null>(null);

  // Schritt 3: Buchungsfelder
  const [platzKey, setPlatzKey] = useState('');
  const [preisGesamt, setPreisGesamt] = useState('');

  // Ergebnis-IDs für Retry-Schutz
  const [createdBesitzerId, setCreatedBesitzerId] = useState<string | null>(null);
  const [createdHundId, setCreatedHundId] = useState<string | null>(null);
  const [createdBuchungId, setCreatedBuchungId] = useState<string | null>(null);

  // Flow-Zustand
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [rejected, setRejected] = useState(false);
  const [done, setDone] = useState(false);

  // Alle Hooks vor frühen Returns — Rules of Hooks

  const offeneAnfragen = buchungsanfragen.filter(
    (a) => a.fields.anfrage_status?.key === 'offen'
  );

  const selectedAnfrage = selectedAnfrageId
    ? buchungsanfragen.find((a) => a.record_id === selectedAnfrageId) ?? null
    : null;

  const PLATZ_OPTIONS = LOOKUP_OPTIONS['buchungen']?.['platz'] ?? [];

  // Schritt 1: Anfrage wählen
  const handleSelectAnfrage = (id: string) => {
    setSelectedAnfrageId(id);
    setStep(2);
  };

  // Schritt 2: Ablehnen
  const handleAblehnen = async () => {
    if (!selectedAnfrage) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(selectedAnfrage.record_id, {
        anfrage_status: 'abgelehnt',
      });
      await fetchAll();
      setRejected(true);
    } catch {
      setSubmitError(tx('Fehler beim Ablehnen. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Schritt 2 → 3: Weiter zur Buchungsanlage
  const handleBestaetigenWeiter = () => {
    setStep(3);
  };

  // Schritt 3: Buchung anlegen (Besitzer → Hund → Buchung → Anfrage-Status)
  const handleBuchungAnlegen = async () => {
    if (!selectedAnfrage || !platzKey || platzKey === 'none') return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const f = selectedAnfrage.fields;

      // a) Besitzer anlegen (nur wenn noch nicht erstellt — Retry-Schutz)
      let besitzerId = createdBesitzerId;
      if (!besitzerId) {
        const besitzer = await LivingAppsService.createBesitzerEntry({
          vorname: f.anfrage_vorname,
          nachname: f.anfrage_nachname,
          telefon: f.anfrage_telefon,
          email: f.anfrage_email,
        });
        besitzerId = besitzer.record_id;
        setCreatedBesitzerId(besitzerId);
      }

      // b) Hund anlegen (nur wenn noch nicht erstellt — Retry-Schutz)
      let hundId = createdHundId;
      if (!hundId) {
        const hund = await LivingAppsService.createHundeEntry({
          name: f.hund_name,
          rasse: f.hund_rasse,
          besitzer: createRecordUrl(APP_IDS.BESITZER, besitzerId),
        });
        hundId = hund.record_id;
        setCreatedHundId(hundId);
      }

      // c) Buchung anlegen (nur wenn noch nicht erstellt — Retry-Schutz)
      let buchungId = createdBuchungId;
      if (!buchungId) {
        const buchung = await LivingAppsService.createBuchungenEntry({
          hund: createRecordUrl(APP_IDS.HUNDE, hundId),
          besitzer: createRecordUrl(APP_IDS.BESITZER, besitzerId),
          anreise: f.wunsch_anreise,
          abreise: f.wunsch_abreise,
          platz: platzKey,
          status: 'geplant',
          zahlungsstatus: 'offen',
          preis_gesamt: preisGesamt ? parseFloat(preisGesamt) : undefined,
        });
        buchungId = buchung.record_id;
        setCreatedBuchungId(buchungId);
      }

      // d) Anfrage-Status auf 'bestaetigt' setzen
      await LivingAppsService.updateBuchungsanfragenEntry(selectedAnfrage.record_id, {
        anfrage_status: 'bestaetigt',
      });

      await fetchAll();
      setDone(true);
    } catch {
      setSubmitError(tx('Fehler beim Anlegen der Buchung. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Reset
  const handleReset = () => {
    setSelectedAnfrageId(null);
    setStep(1);
    setPlatzKey('');
    setPreisGesamt('');
    setCreatedBesitzerId(null);
    setCreatedHundId(null);
    setCreatedBuchungId(null);
    setRejected(false);
    setDone(false);
    setSubmitError(null);
  };

  return (
    <IntentWizardShell
      title={tx('Anfrage bestätigen')}
      subtitle={tx('Buchungsanfragen prüfen und in eine Buchung umwandeln')}
      steps={[
        { label: tx('Anfrage') },
        { label: tx('Entscheidung') },
        { label: tx('Buchung') },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── Schritt 1: Anfrage wählen ── */}
      {step === 1 && (
        <EntitySelectStep
          items={offeneAnfragen.map((a) => ({
            id: a.record_id,
            title: `${a.fields.anfrage_vorname ?? ''} ${a.fields.anfrage_nachname ?? ''}`.trim() || tx('Unbekannt'),
            subtitle: [
              a.fields.hund_name,
              a.fields.wunsch_anreise ? formatDate(a.fields.wunsch_anreise) : undefined,
              a.fields.wunsch_abreise ? `– ${formatDate(a.fields.wunsch_abreise)}` : undefined,
            ]
              .filter(Boolean)
              .join(' '),
            status: a.fields.anfrage_status
              ? { key: a.fields.anfrage_status.key, label: a.fields.anfrage_status.label }
              : undefined,
            icon: <IconUser size={20} className="text-primary" />,
          }))}
          onSelect={handleSelectAnfrage}
          searchPlaceholder={tx('Anfrage suchen …')}
          emptyText={tx('Keine offenen Anfragen vorhanden')}
          emptyIcon={<IconCheck size={40} className="text-muted-foreground" />}
        />
      )}

      {/* ── Schritt 2: Prüfen & entscheiden ── */}
      {step === 2 && (
        <>
          {!selectedAnfrage ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">
                {tx('Dieser Schritt braucht eine Auswahl aus Schritt 1.')}
              </p>
              <Button variant="outline" onClick={() => setStep(1)}>
                {tx('Neu starten')}
              </Button>
            </div>
          ) : rejected ? (
            <div className="flex flex-col items-center gap-6 py-12">
              <div className="rounded-full bg-destructive/10 p-4">
                <IconX size={40} className="text-destructive" />
              </div>
              <div className="text-center space-y-1">
                <h2 className="text-lg font-semibold">{tx('Anfrage abgelehnt')}</h2>
                <p className="text-sm text-muted-foreground">
                  {tx('Die Anfrage wurde als abgelehnt markiert.')}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 justify-center">
                <Button variant="outline" onClick={handleReset}>
                  {tx('Weitere Anfrage bearbeiten')}
                </Button>
                <a href="#/" className="inline-flex items-center">
                  <Button variant="ghost">{tx('Zurück zum Dashboard')}</Button>
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Detailkarte */}
              <div className="rounded-2xl border bg-card p-5 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h2 className="text-base font-semibold">
                    {selectedAnfrage.fields.anfrage_vorname ?? ''}{' '}
                    {selectedAnfrage.fields.anfrage_nachname ?? ''}
                  </h2>
                  <StatusBadge
                    statusKey={selectedAnfrage.fields.anfrage_status?.key}
                    label={selectedAnfrage.fields.anfrage_status?.label}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {/* Kontakt */}
                  {selectedAnfrage.fields.anfrage_telefon && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <IconPhone size={15} className="shrink-0" />
                      <span className="truncate">{selectedAnfrage.fields.anfrage_telefon}</span>
                    </div>
                  )}
                  {selectedAnfrage.fields.anfrage_email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <IconMail size={15} className="shrink-0" />
                      <span className="truncate">{selectedAnfrage.fields.anfrage_email}</span>
                    </div>
                  )}

                  {/* Hund */}
                  {selectedAnfrage.fields.hund_name && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <IconDog size={15} className="shrink-0" />
                      <span className="truncate">
                        {selectedAnfrage.fields.hund_name}
                        {selectedAnfrage.fields.hund_rasse
                          ? ` (${selectedAnfrage.fields.hund_rasse})`
                          : ''}
                        {selectedAnfrage.fields.hund_groesse
                          ? ` — ${selectedAnfrage.fields.hund_groesse.label}`
                          : ''}
                      </span>
                    </div>
                  )}

                  {/* Zeitraum */}
                  {(selectedAnfrage.fields.wunsch_anreise ||
                    selectedAnfrage.fields.wunsch_abreise) && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <IconCalendar size={15} className="shrink-0" />
                      <span className="truncate">
                        {selectedAnfrage.fields.wunsch_anreise
                          ? formatDate(selectedAnfrage.fields.wunsch_anreise)
                          : '?'}{' '}
                        →{' '}
                        {selectedAnfrage.fields.wunsch_abreise
                          ? formatDate(selectedAnfrage.fields.wunsch_abreise)
                          : '?'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Nachricht */}
                {selectedAnfrage.fields.nachricht && (
                  <div className="flex items-start gap-2 pt-1 text-sm">
                    <IconMessageCircle size={15} className="shrink-0 mt-0.5 text-muted-foreground" />
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      {selectedAnfrage.fields.nachricht}
                    </p>
                  </div>
                )}
              </div>

              {submitError && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  <IconAlertCircle size={16} className="shrink-0" />
                  {submitError}
                </div>
              )}

              {/* Aktionen */}
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="destructive"
                  disabled={submitting}
                  onClick={handleAblehnen}
                >
                  <IconX size={16} className="shrink-0 mr-1.5" />
                  {tx('Ablehnen')}
                </Button>
                <Button disabled={submitting} onClick={handleBestaetigenWeiter}>
                  <IconCheck size={16} className="shrink-0 mr-1.5" />
                  {tx('Bestätigen & Buchung anlegen')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Schritt 3: Buchung anlegen ── */}
      {step === 3 && (
        <>
          {!selectedAnfrage ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">
                {tx('Dieser Schritt braucht eine Auswahl aus Schritt 1.')}
              </p>
              <Button variant="outline" onClick={() => setStep(1)}>
                {tx('Neu starten')}
              </Button>
            </div>
          ) : done ? (
            <div className="flex flex-col items-center gap-6 py-12">
              <div className="rounded-full bg-emerald-500/10 p-4">
                <IconCheck size={40} className="text-emerald-600" />
              </div>
              <div className="text-center space-y-1">
                <h2 className="text-lg font-semibold">{tx('Buchung erfolgreich angelegt')}</h2>
                <p className="text-sm text-muted-foreground">
                  {tx('Besitzer, Hund und Buchung wurden angelegt. Die Anfrage ist jetzt bestätigt.')}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 justify-center">
                <Button variant="outline" onClick={handleReset}>
                  {tx('Weitere Anfrage bearbeiten')}
                </Button>
                <a href="#/" className="inline-flex items-center">
                  <Button variant="ghost">{tx('Zurück zum Dashboard')}</Button>
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Zusammenfassung aus Anfrage */}
              <div className="rounded-2xl border bg-secondary/40 p-4 space-y-2 text-sm">
                <p className="font-medium text-foreground">
                  {tx('Daten aus der Anfrage')}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-muted-foreground">
                  <span>
                    <span className="font-medium text-foreground">
                      {tx('Besitzer:')}
                    </span>{' '}
                    {selectedAnfrage.fields.anfrage_vorname ?? ''}{' '}
                    {selectedAnfrage.fields.anfrage_nachname ?? ''}
                  </span>
                  {selectedAnfrage.fields.anfrage_telefon && (
                    <span>
                      <span className="font-medium text-foreground">
                        {tx('Telefon:')}
                      </span>{' '}
                      {selectedAnfrage.fields.anfrage_telefon}
                    </span>
                  )}
                  {selectedAnfrage.fields.anfrage_email && (
                    <span>
                      <span className="font-medium text-foreground">
                        {tx('E-Mail:')}
                      </span>{' '}
                      {selectedAnfrage.fields.anfrage_email}
                    </span>
                  )}
                  {selectedAnfrage.fields.hund_name && (
                    <span>
                      <span className="font-medium text-foreground">
                        {tx('Hund:')}
                      </span>{' '}
                      {selectedAnfrage.fields.hund_name}
                      {selectedAnfrage.fields.hund_rasse
                        ? ` (${selectedAnfrage.fields.hund_rasse})`
                        : ''}
                    </span>
                  )}
                  {(selectedAnfrage.fields.wunsch_anreise ||
                    selectedAnfrage.fields.wunsch_abreise) && (
                    <span className="sm:col-span-2">
                      <span className="font-medium text-foreground">
                        {tx('Zeitraum:')}
                      </span>{' '}
                      {selectedAnfrage.fields.wunsch_anreise
                        ? formatDate(selectedAnfrage.fields.wunsch_anreise)
                        : '?'}{' '}
                      →{' '}
                      {selectedAnfrage.fields.wunsch_abreise
                        ? formatDate(selectedAnfrage.fields.wunsch_abreise)
                        : '?'}
                    </span>
                  )}
                </div>
              </div>

              {/* Felder die der Nutzer ausfüllen muss */}
              <div className="rounded-2xl border bg-card p-5 space-y-4">
                <p className="text-sm font-medium">{tx('Buchungsdetails')}</p>

                {/* Platz (Pflicht) */}
                <div className="space-y-1.5">
                  <Label htmlFor="platz-select">
                    {tx('Platz')}
                    <span className="text-destructive ml-0.5">*</span>
                  </Label>
                  <Select
                    value={platzKey}
                    onValueChange={setPlatzKey}
                  >
                    <SelectTrigger id="platz-select" className="w-full">
                      <SelectValue placeholder={tx('Platz wählen …')} />
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
                <div className="space-y-1.5">
                  <Label htmlFor="preis-input">{tx('Gesamtpreis (€)')}</Label>
                  <Input
                    id="preis-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={preisGesamt}
                    onChange={(e) => setPreisGesamt(e.target.value)}
                    placeholder={tx('z. B. 280')}
                  />
                </div>
              </div>

              {submitError && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  <IconAlertCircle size={16} className="shrink-0" />
                  {submitError}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep(2)}
                  disabled={submitting}
                >
                  {tx('Zurück')}
                </Button>
                <Button
                  disabled={submitting || !platzKey || platzKey === 'none'}
                  onClick={handleBuchungAnlegen}
                >
                  <IconCheck size={16} className="shrink-0 mr-1.5" />
                  {submitting ? tx('Wird angelegt …') : tx('Buchung anlegen')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </IntentWizardShell>
  );
}
