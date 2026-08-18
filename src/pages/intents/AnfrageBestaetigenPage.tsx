/**
 * Anfrage bestätigen — 3-Schritt-Wizard.
 * Steps: 1) Offene Anfrage wählen → 2) Anfrage prüfen und entscheiden (Ablehnen / Bestätigen)
 *        → 3) Buchung anlegen (Besitzer + Hund neu anlegen, dann Buchung verknüpfen).
 * Reads: buchungsanfragen. Writes: buchungsanfragen (updateBuchungsanfragenEntry),
 *        besitzer (createBesitzerEntry), hunde (createHundeEntry), buchungen (createBuchungenEntry).
 * Composes: IntentWizardShell, EntitySelectStep, StatusBadge.
 */
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { IconDog, IconUser, IconCheck, IconX, IconCalendar } from '@tabler/icons-react';
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
import type { Buchungsanfragen } from '@/types/app';
import { formatDate } from '@/lib/formatters';
import { tx } from '@/i18n';

const PLATZ_OPTIONS = LOOKUP_OPTIONS['buchungen']?.['platz'] ?? [];

export default function AnfrageBestaetigenPage() {
  const data = useDashboardData();
  const { buchungsanfragen, loading, error, fetchAll } = data;

  // Wizard state
  const [step, setStep] = useState(1);
  const [selectedAnfrage, setSelectedAnfrage] = useState<Buchungsanfragen | null>(null);

  // Step 3 form state
  const [platzKey, setPlatzKey] = useState(PLATZ_OPTIONS[0]?.key ?? '');
  const [anreise, setAnreise] = useState('');
  const [abreise, setAbreise] = useState('');
  const [preisGesamt, setPreisGesamt] = useState('');

  // Multi-step creation guards
  const [neuerBesitzerId, setNeuerBesitzerId] = useState('');
  const [neuerHundId, setNeuerHundId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);

  // Filter: nur offene Anfragen
  const offeneAnfragen = buchungsanfragen.filter(
    (a) => a.fields.anfrage_status?.key === 'offen'
  );

  function handleSelectAnfrage(id: string) {
    const found = offeneAnfragen.find((a) => a.record_id === id);
    if (!found) return;
    setSelectedAnfrage(found);
    setStep(2);
  }

  function handleWeiterZuBuchung() {
    if (!selectedAnfrage) return;
    // Vorausfüllen
    setAnreise(selectedAnfrage.fields.wunsch_anreise ?? '');
    setAbreise(selectedAnfrage.fields.wunsch_abreise ?? '');
    // Reset creation guards for new attempt
    setNeuerBesitzerId('');
    setNeuerHundId('');
    setSubmitError('');
    setStep(3);
  }

  async function handleAblehnen() {
    if (!selectedAnfrage) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(selectedAnfrage.record_id, {
        anfrage_status: 'abgelehnt',
      });
      await fetchAll();
      window.location.hash = '/';
    } catch {
      setSubmitError(tx('Fehler beim Ablehnen der Anfrage.'));
      setSubmitting(false);
    }
  }

  async function handleBuchungAnlegen() {
    if (!selectedAnfrage || !platzKey || platzKey === 'none' || !anreise || !abreise) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      // Guard: Besitzer nur anlegen, wenn noch nicht geschehen
      let besitzerId = neuerBesitzerId;
      if (!besitzerId) {
        const besitzer = await LivingAppsService.createBesitzerEntry({
          vorname: selectedAnfrage.fields.anfrage_vorname,
          nachname: selectedAnfrage.fields.anfrage_nachname,
          telefon: selectedAnfrage.fields.anfrage_telefon,
          email: selectedAnfrage.fields.anfrage_email,
        });
        besitzerId = besitzer.record_id;
        setNeuerBesitzerId(besitzerId);
      }

      // Guard: Hund nur anlegen, wenn noch nicht geschehen
      let hundId = neuerHundId;
      if (!hundId) {
        const hund = await LivingAppsService.createHundeEntry({
          name: selectedAnfrage.fields.hund_name,
          rasse: selectedAnfrage.fields.hund_rasse,
          besitzer: createRecordUrl(APP_IDS.BESITZER, besitzerId),
        });
        hundId = hund.record_id;
        setNeuerHundId(hundId);
      }

      // Buchung anlegen
      await LivingAppsService.createBuchungenEntry({
        hund: createRecordUrl(APP_IDS.HUNDE, hundId),
        besitzer: createRecordUrl(APP_IDS.BESITZER, besitzerId),
        anreise,
        abreise,
        platz: platzKey,
        preis_gesamt: preisGesamt ? parseFloat(preisGesamt) : undefined,
        status: 'geplant',
        zahlungsstatus: 'offen',
      });

      // Anfrage auf bestätigt setzen
      await LivingAppsService.updateBuchungsanfragenEntry(selectedAnfrage.record_id, {
        anfrage_status: 'bestaetigt',
      });

      await fetchAll();
      setSuccess(true);
    } catch {
      setSubmitError(tx('Fehler beim Anlegen der Buchung. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setStep(1);
    setSelectedAnfrage(null);
    setPlatzKey(PLATZ_OPTIONS[0]?.key ?? '');
    setAnreise('');
    setAbreise('');
    setPreisGesamt('');
    setNeuerBesitzerId('');
    setNeuerHundId('');
    setSubmitError('');
    setSuccess(false);
    setSubmitting(false);
  }

  // --- Render ---
  return (
    <IntentWizardShell
      title={tx('Anfrage bestätigen')}
      subtitle={tx('Offene Buchungsanfrage prüfen und entscheiden')}
      steps={[
        { label: tx('Anfrage wählen') },
        { label: tx('Entscheidung') },
        { label: tx('Buchung anlegen') },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── Step 1: Anfrage wählen ── */}
      {step === 1 && (
        <EntitySelectStep
          items={offeneAnfragen.map((a) => ({
            id: a.record_id,
            title: `${a.fields.anfrage_vorname ?? ''} ${a.fields.anfrage_nachname ?? ''}`.trim() || tx('Unbekannt'),
            subtitle: [
              a.fields.hund_name ? `${tx('Hund')}: ${a.fields.hund_name}` : null,
              a.fields.wunsch_anreise && a.fields.wunsch_abreise
                ? `${formatDate(a.fields.wunsch_anreise)} – ${formatDate(a.fields.wunsch_abreise)}`
                : a.fields.wunsch_anreise
                ? `${tx('Ab')} ${formatDate(a.fields.wunsch_anreise)}`
                : null,
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
          emptyIcon={<IconCalendar size={40} className="text-muted-foreground" />}
        />
      )}

      {/* ── Step 2: Prüfen und entscheiden ── */}
      {step === 2 && (
        selectedAnfrage ? (
          <div className="space-y-6">
            {/* Anfrage-Details */}
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <IconUser size={18} className="text-primary shrink-0" />
                <h3 className="font-semibold text-foreground">{tx('Kontaktdaten')}</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">{tx('Vorname')}</p>
                  <p className="text-sm font-medium">{selectedAnfrage.fields.anfrage_vorname ?? '–'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{tx('Nachname')}</p>
                  <p className="text-sm font-medium">{selectedAnfrage.fields.anfrage_nachname ?? '–'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{tx('Telefon')}</p>
                  <p className="text-sm font-medium">{selectedAnfrage.fields.anfrage_telefon ?? '–'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{tx('E-Mail')}</p>
                  <p className="text-sm font-medium">{selectedAnfrage.fields.anfrage_email ?? '–'}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <IconDog size={18} className="text-primary shrink-0" />
                <h3 className="font-semibold text-foreground">{tx('Hund')}</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">{tx('Name')}</p>
                  <p className="text-sm font-medium">{selectedAnfrage.fields.hund_name ?? '–'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{tx('Rasse')}</p>
                  <p className="text-sm font-medium">{selectedAnfrage.fields.hund_rasse ?? '–'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{tx('Größe')}</p>
                  <p className="text-sm font-medium">{selectedAnfrage.fields.hund_groesse?.label ?? '–'}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <IconCalendar size={18} className="text-primary shrink-0" />
                <h3 className="font-semibold text-foreground">{tx('Wunschtermin')}</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">{tx('Anreise')}</p>
                  <p className="text-sm font-medium">
                    {selectedAnfrage.fields.wunsch_anreise
                      ? formatDate(selectedAnfrage.fields.wunsch_anreise)
                      : '–'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{tx('Abreise')}</p>
                  <p className="text-sm font-medium">
                    {selectedAnfrage.fields.wunsch_abreise
                      ? formatDate(selectedAnfrage.fields.wunsch_abreise)
                      : '–'}
                  </p>
                </div>
              </div>
              {selectedAnfrage.fields.nachricht && (
                <div>
                  <p className="text-xs text-muted-foreground">{tx('Nachricht')}</p>
                  <p className="text-sm">{selectedAnfrage.fields.nachricht}</p>
                </div>
              )}
            </div>

            {/* Status */}
            <div className="flex items-center gap-2">
              <StatusBadge
                statusKey={selectedAnfrage.fields.anfrage_status?.key}
                label={selectedAnfrage.fields.anfrage_status?.label}
              />
            </div>

            {submitError && (
              <p className="text-sm text-destructive">{submitError}</p>
            )}

            {/* Aktionen */}
            <div className="flex flex-wrap gap-3">
              <Button
                variant="destructive"
                onClick={handleAblehnen}
                disabled={submitting}
                className="flex items-center gap-2"
              >
                <IconX size={16} className="shrink-0" />
                {tx('Ablehnen')}
              </Button>
              <Button
                onClick={handleWeiterZuBuchung}
                disabled={submitting}
                className="flex items-center gap-2"
              >
                <IconCheck size={16} className="shrink-0" />
                {tx('Bestätigen und Buchung anlegen')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">{tx('Dieser Schritt braucht die Auswahl aus Schritt 1.')}</p>
            <Button variant="outline" onClick={() => setStep(1)}>{tx('Neu starten')}</Button>
          </div>
        )
      )}

      {/* ── Step 3: Buchung anlegen ── */}
      {step === 3 && (
        selectedAnfrage ? (
          success ? (
            <div className="text-center py-12 space-y-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-emerald-100 p-4">
                  <IconCheck size={40} className="text-emerald-600" />
                </div>
              </div>
              <h2 className="text-xl font-semibold">{tx('Buchung erfolgreich angelegt!')}</h2>
              <p className="text-sm text-muted-foreground">
                {tx('Die Anfrage wurde bestätigt und eine Buchung für')} {selectedAnfrage.fields.hund_name ?? tx('den Hund')} {tx('wurde erstellt.')}
              </p>
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <Button onClick={handleReset}>{tx('Neue Anfrage bearbeiten')}</Button>
                <a href="#/" className="inline-flex items-center">
                  <Button variant="outline">{tx('Zurück zum Dashboard')}</Button>
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Zusammenfassung Anfrage */}
              <div className="rounded-2xl border bg-secondary/40 p-4 text-sm space-y-1">
                <p className="font-medium">
                  {selectedAnfrage.fields.anfrage_vorname} {selectedAnfrage.fields.anfrage_nachname}
                  {selectedAnfrage.fields.hund_name ? ` · ${tx('Hund')}: ${selectedAnfrage.fields.hund_name}` : ''}
                </p>
                {selectedAnfrage.fields.wunsch_anreise && selectedAnfrage.fields.wunsch_abreise && (
                  <p className="text-muted-foreground">
                    {formatDate(selectedAnfrage.fields.wunsch_anreise)} – {formatDate(selectedAnfrage.fields.wunsch_abreise)}
                  </p>
                )}
              </div>

              {/* Buchungsformular */}
              <div className="rounded-2xl border bg-card p-5 space-y-4">
                <h3 className="font-semibold text-foreground">{tx('Buchungsdetails')}</h3>

                <div className="space-y-2">
                  <Label htmlFor="platz">{tx('Platz')}</Label>
                  <Select value={platzKey} onValueChange={setPlatzKey}>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="anreise">{tx('Anreise')}</Label>
                    <Input
                      id="anreise"
                      type="date"
                      value={anreise}
                      onChange={(e) => setAnreise(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="abreise">{tx('Abreise')}</Label>
                    <Input
                      id="abreise"
                      type="date"
                      value={abreise}
                      onChange={(e) => setAbreise(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="preis">{tx('Gesamtpreis (€)')}</Label>
                  <Input
                    id="preis"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={tx('z. B. 250')}
                    value={preisGesamt}
                    onChange={(e) => setPreisGesamt(e.target.value)}
                  />
                </div>
              </div>

              <div className="rounded-2xl border bg-secondary/30 p-4 text-sm text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">{tx('Was wird angelegt:')}</p>
                <p>• {tx('Neuer Besitzer-Eintrag')} ({selectedAnfrage.fields.anfrage_vorname} {selectedAnfrage.fields.anfrage_nachname})</p>
                <p>• {tx('Neuer Hunde-Eintrag')} ({selectedAnfrage.fields.hund_name ?? '–'})</p>
                <p>• {tx('Neue Buchung mit Status "Geplant"')}</p>
                <p>• {tx('Anfrage wird auf "Bestätigt" gesetzt')}</p>
              </div>

              {submitError && (
                <p className="text-sm text-destructive">{submitError}</p>
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
                  onClick={handleBuchungAnlegen}
                  disabled={submitting || !platzKey || !anreise || !abreise}
                  className="flex items-center gap-2"
                >
                  <IconCheck size={16} className="shrink-0" />
                  {submitting ? tx('Wird angelegt …') : tx('Buchung anlegen')}
                </Button>
              </div>
            </div>
          )
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">{tx('Dieser Schritt braucht die Auswahl aus Schritt 1.')}</p>
            <Button variant="outline" onClick={() => setStep(1)}>{tx('Neu starten')}</Button>
          </div>
        )
      )}
    </IntentWizardShell>
  );
}
