/**
 * Anfrage bestätigen — 3-Schritt-Wizard.
 * Steps: 1) Offene Buchungsanfrage wählen → 2) Details prüfen & entscheiden → 3) Buchung anlegen.
 * Reads: buchungsanfragen. Writes: besitzer (createBesitzerEntry), hunde (createHundeEntry),
 *   buchungen (createBuchungenEntry), buchungsanfragen (updateBuchungsanfragenEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */
import { useState } from 'react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import type { Buchungsanfragen } from '@/types/app';
import { formatDate } from '@/lib/formatters';
import { tx } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  IconDog,
  IconUser,
  IconPhone,
  IconMail,
  IconCalendar,
  IconMessageCircle,
  IconCheck,
  IconX,
  IconAlertCircle,
} from '@tabler/icons-react';

const PLATZ_OPTIONS = LOOKUP_OPTIONS['buchungen']?.['platz'] ?? [];

export default function AnfrageBestaetigenPage() {
  const { buchungsanfragen, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);
  const [selectedAnfrage, setSelectedAnfrage] = useState<Buchungsanfragen | null>(null);

  // Schritt 3 Felder
  const [anreise, setAnreise] = useState('');
  const [abreise, setAbreise] = useState('');
  const [platzKey, setPlatzKey] = useState('');
  const [preisGesamt, setPreisGesamt] = useState('');
  const [interneNotizen, setInterneNotizen] = useState('');

  // Submit-State
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Idempotency: gespeicherte IDs für Retry-Schutz
  const [createdBesitzerId, setCreatedBesitzerId] = useState<string | null>(null);
  const [createdHundId, setCreatedHundId] = useState<string | null>(null);

  const offeneAnfragen = buchungsanfragen.filter(
    (a) => a.fields.anfrage_status?.key === 'offen'
  );

  const handleSelectAnfrage = (id: string) => {
    const anfrage = offeneAnfragen.find((a) => a.record_id === id);
    if (!anfrage) return;
    setSelectedAnfrage(anfrage);
    setAnreise(anfrage.fields.wunsch_anreise ?? '');
    setAbreise(anfrage.fields.wunsch_abreise ?? '');
    setStep(2);
  };

  const handleAblehnen = async () => {
    if (!selectedAnfrage) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(selectedAnfrage.record_id, {
        anfrage_status: 'abgelehnt',
      });
      await fetchAll();
      window.location.hash = '/';
    } catch {
      setSubmitError(tx('Fehler beim Ablehnen. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleBestaetigenUndBuchen = async () => {
    if (!selectedAnfrage) return;
    if (!anreise || !abreise || !platzKey || platzKey === 'none') {
      setSubmitError(tx('Bitte fülle alle Pflichtfelder aus (Anreise, Abreise, Platz).'));
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Idempotenter Create: Besitzer
      let besitzerId = createdBesitzerId;
      if (!besitzerId) {
        const newBesitzer = await LivingAppsService.createBesitzerEntry({
          vorname: selectedAnfrage.fields.anfrage_vorname,
          nachname: selectedAnfrage.fields.anfrage_nachname,
          telefon: selectedAnfrage.fields.anfrage_telefon ?? '',
          email: selectedAnfrage.fields.anfrage_email,
        });
        besitzerId = newBesitzer.record_id;
        setCreatedBesitzerId(besitzerId);
      }

      // Idempotenter Create: Hund
      let hundId = createdHundId;
      if (!hundId) {
        const newHund = await LivingAppsService.createHundeEntry({
          name: selectedAnfrage.fields.hund_name,
          rasse: selectedAnfrage.fields.hund_rasse ?? '',
          besitzer: createRecordUrl(APP_IDS.BESITZER, besitzerId),
        });
        hundId = newHund.record_id;
        setCreatedHundId(hundId);
      }

      // Buchung anlegen
      await LivingAppsService.createBuchungenEntry({
        hund: createRecordUrl(APP_IDS.HUNDE, hundId),
        besitzer: createRecordUrl(APP_IDS.BESITZER, besitzerId),
        anreise,
        abreise,
        platz: platzKey,
        status: 'geplant',
        preis_gesamt: preisGesamt ? parseFloat(preisGesamt) : undefined,
        interne_notizen: interneNotizen || undefined,
      });

      // Anfrage als bestätigt markieren
      await LivingAppsService.updateBuchungsanfragenEntry(selectedAnfrage.record_id, {
        anfrage_status: 'bestaetigt',
      });

      await fetchAll();
      setDone(true);
    } catch (err) {
      setSubmitError(tx('Fehler beim Anlegen der Buchung. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedAnfrage(null);
    setAnreise('');
    setAbreise('');
    setPlatzKey('');
    setPreisGesamt('');
    setInterneNotizen('');
    setSubmitError(null);
    setDone(false);
    setCreatedBesitzerId(null);
    setCreatedHundId(null);
    setStep(1);
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-emerald-100 p-4">
              <IconCheck size={48} className="text-emerald-600" stroke={1.5} />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">
              {tx('Buchung erfolgreich angelegt!')}
            </h2>
            <p className="text-muted-foreground">
              {tx('Die Anfrage wurde bestätigt und eine Buchung wurde angelegt.')}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="outline" onClick={handleReset}>
              {tx('Weitere Anfrage bearbeiten')}
            </Button>
            <Button asChild>
              <a href="#/">{tx('Zurück zum Dashboard')}</a>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <IntentWizardShell
      title={tx('Anfrage bestätigen')}
      subtitle={tx('Buchungsanfrage prüfen und direkt eine Buchung anlegen')}
      steps={[
        { label: tx('Anfrage wählen') },
        { label: tx('Details prüfen') },
        { label: tx('Buchung anlegen') },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Schritt 1: Anfrage wählen */}
      {step === 1 && (
        <EntitySelectStep
          items={offeneAnfragen.map((a) => ({
            id: a.record_id,
            title: `${a.fields.anfrage_vorname ?? ''} ${a.fields.anfrage_nachname ?? ''}`.trim() || tx('Unbekannte Person'),
            subtitle: [
              a.fields.hund_name ? `${tx('Hund')}: ${a.fields.hund_name}` : null,
              a.fields.wunsch_anreise && a.fields.wunsch_abreise
                ? `${formatDate(a.fields.wunsch_anreise)} – ${formatDate(a.fields.wunsch_abreise)}`
                : a.fields.wunsch_anreise
                ? `${tx('Anreise')}: ${formatDate(a.fields.wunsch_anreise)}`
                : null,
            ]
              .filter(Boolean)
              .join(' · '),
            status: a.fields.anfrage_status
              ? { key: a.fields.anfrage_status.key, label: a.fields.anfrage_status.label }
              : undefined,
            icon: <IconDog size={20} className="text-primary" stroke={1.5} />,
          }))}
          onSelect={handleSelectAnfrage}
          searchPlaceholder={tx('Anfrage suchen …')}
          emptyText={tx('Keine offenen Buchungsanfragen vorhanden.')}
          emptyIcon={<IconDog size={40} className="text-muted-foreground" stroke={1.5} />}
        />
      )}

      {/* Schritt 2: Details prüfen */}
      {step === 2 && (
        selectedAnfrage ? (
          <div className="space-y-6">
            {/* Kontaktdaten */}
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <IconUser size={18} className="text-primary shrink-0" stroke={1.5} />
                {tx('Kontaktdaten')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">{tx('Vorname')}</p>
                  <p className="font-medium">{selectedAnfrage.fields.anfrage_vorname ?? '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">{tx('Nachname')}</p>
                  <p className="font-medium">{selectedAnfrage.fields.anfrage_nachname ?? '—'}</p>
                </div>
                {selectedAnfrage.fields.anfrage_telefon && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">{tx('Telefon')}</p>
                    <p className="font-medium flex items-center gap-1">
                      <IconPhone size={14} className="shrink-0" stroke={1.5} />
                      {selectedAnfrage.fields.anfrage_telefon}
                    </p>
                  </div>
                )}
                {selectedAnfrage.fields.anfrage_email && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">{tx('E-Mail')}</p>
                    <p className="font-medium flex items-center gap-1 break-all">
                      <IconMail size={14} className="shrink-0" stroke={1.5} />
                      {selectedAnfrage.fields.anfrage_email}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Hund */}
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <IconDog size={18} className="text-primary shrink-0" stroke={1.5} />
                {tx('Hund')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">{tx('Name')}</p>
                  <p className="font-medium">{selectedAnfrage.fields.hund_name ?? '—'}</p>
                </div>
                {selectedAnfrage.fields.hund_rasse && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">{tx('Rasse')}</p>
                    <p className="font-medium">{selectedAnfrage.fields.hund_rasse}</p>
                  </div>
                )}
                {selectedAnfrage.fields.hund_groesse && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">{tx('Größe')}</p>
                    <p className="font-medium">{selectedAnfrage.fields.hund_groesse.label}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Wunschtermin */}
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <IconCalendar size={18} className="text-primary shrink-0" stroke={1.5} />
                {tx('Wunschtermin')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">{tx('Anreise')}</p>
                  <p className="font-medium">
                    {selectedAnfrage.fields.wunsch_anreise
                      ? formatDate(selectedAnfrage.fields.wunsch_anreise)
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">{tx('Abreise')}</p>
                  <p className="font-medium">
                    {selectedAnfrage.fields.wunsch_abreise
                      ? formatDate(selectedAnfrage.fields.wunsch_abreise)
                      : '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Nachricht */}
            {selectedAnfrage.fields.nachricht && (
              <div className="rounded-2xl border bg-card p-5 space-y-3">
                <h3 className="font-semibold text-base flex items-center gap-2">
                  <IconMessageCircle size={18} className="text-primary shrink-0" stroke={1.5} />
                  {tx('Nachricht')}
                </h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {selectedAnfrage.fields.nachricht}
                </p>
              </div>
            )}

            {/* Status */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{tx('Status:')}</span>
              <StatusBadge
                statusKey={selectedAnfrage.fields.anfrage_status?.key}
                label={selectedAnfrage.fields.anfrage_status?.label}
              />
            </div>

            {/* Aktionen */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                variant="destructive"
                onClick={handleAblehnen}
                disabled={submitting}
                className="flex items-center gap-2"
              >
                <IconX size={16} className="shrink-0" stroke={1.5} />
                {tx('Ablehnen')}
              </Button>
              <Button
                onClick={() => setStep(3)}
                className="flex items-center gap-2"
              >
                <IconCheck size={16} className="shrink-0" stroke={1.5} />
                {tx('Bestätigen und Buchung anlegen')}
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

      {/* Schritt 3: Buchung anlegen */}
      {step === 3 && (
        selectedAnfrage ? (
          <div className="space-y-6">
            {/* Zusammenfassung */}
            <div className="rounded-2xl border bg-secondary/40 p-4 text-sm space-y-1">
              <p className="font-medium">
                {selectedAnfrage.fields.anfrage_vorname} {selectedAnfrage.fields.anfrage_nachname}
                {selectedAnfrage.fields.hund_name ? ` · ${tx('Hund')}: ${selectedAnfrage.fields.hund_name}` : ''}
              </p>
              <p className="text-muted-foreground">
                {tx('Es wird ein neuer Besitzer, ein Hund und eine Buchung angelegt.')}
              </p>
            </div>

            {/* Buchungsfelder */}
            <div className="rounded-2xl border bg-card p-5 space-y-5">
              <h3 className="font-semibold text-base">{tx('Buchungsdetails')}</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="anreise">{tx('Anreise')} *</Label>
                  <Input
                    id="anreise"
                    type="date"
                    value={anreise}
                    onChange={(e) => setAnreise(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="abreise">{tx('Abreise')} *</Label>
                  <Input
                    id="abreise"
                    type="date"
                    value={abreise}
                    onChange={(e) => setAbreise(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="platz">{tx('Platz')} *</Label>
                <Select value={platzKey} onValueChange={setPlatzKey}>
                  <SelectTrigger id="platz">
                    <SelectValue placeholder={tx('Platz auswählen …')} />
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

              <div className="space-y-1.5">
                <Label htmlFor="preis">{tx('Preis gesamt (€)')}</Label>
                <Input
                  id="preis"
                  type="number"
                  min={0}
                  step={0.01}
                  value={preisGesamt}
                  onChange={(e) => setPreisGesamt(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notizen">{tx('Interne Notizen')}</Label>
                <Textarea
                  id="notizen"
                  value={interneNotizen}
                  onChange={(e) => setInterneNotizen(e.target.value)}
                  placeholder={tx('Optionale interne Anmerkungen …')}
                  rows={3}
                />
              </div>
            </div>

            {/* Fehler */}
            {submitError && (
              <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <IconAlertCircle size={16} className="shrink-0 mt-0.5" stroke={1.5} />
                {submitError}
              </div>
            )}

            {/* Aktionen */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                disabled={submitting}
              >
                {tx('Zurück')}
              </Button>
              <Button
                onClick={handleBestaetigenUndBuchen}
                disabled={submitting || !anreise || !abreise || !platzKey || platzKey === 'none'}
                className="flex items-center gap-2"
              >
                <IconCheck size={16} className="shrink-0" stroke={1.5} />
                {submitting ? tx('Wird angelegt …') : tx('Buchung anlegen')}
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
