/**
 * Anfrage bestätigen — 3-Schritt-Wizard.
 * Steps: 1) Offene Buchungsanfrage auswählen → 2) Details prüfen & entscheiden (ablehnen / bestätigen)
 *        → 3) Buchung anlegen (Platz, Preis, Notizen; Anreise/Abreise vorbelegt).
 * Reads: buchungsanfragen. Writes: buchungsanfragen (updateBuchungsanfragenEntry),
 *        buchungen (createBuchungenEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */

import { useState } from 'react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService } from '@/services/livingAppsService';
import { LOOKUP_OPTIONS } from '@/types/app';
import type { Buchungsanfragen } from '@/types/app';
import { lookupKey, formatDate } from '@/lib/formatters';
import { tx } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IconCheck, IconX, IconInfoCircle, IconAlertCircle, IconPawFilled } from '@tabler/icons-react';

const PLATZ_OPTIONS = LOOKUP_OPTIONS['buchungen']?.['platz'] ?? [];

export default function AnfrageBestaetigenPage() {
  const { buchungsanfragen, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);
  const [selectedAnfrage, setSelectedAnfrage] = useState<Buchungsanfragen | null>(null);

  // Step 3 form state
  const [platzKey, setPlatzKey] = useState('');
  const [anreise, setAnreise] = useState('');
  const [abreise, setAbreise] = useState('');
  const [preisGesamt, setPreisGesamt] = useState('');
  const [interneNotizen, setInterneNotizen] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState<'abgelehnt' | 'buchung_erstellt' | null>(null);
  const [createdBuchungId, setCreatedBuchungId] = useState<string | null>(null);

  // Filter: nur offene Anfragen
  const offeneAnfragen = buchungsanfragen.filter(
    (a) => lookupKey(a.fields.anfrage_status) === 'offen',
  );

  const handleSelectAnfrage = (id: string) => {
    const found = offeneAnfragen.find((a) => a.record_id === id) ?? null;
    setSelectedAnfrage(found);
    if (found) {
      setAnreise(found.fields.wunsch_anreise ?? '');
      setAbreise(found.fields.wunsch_abreise ?? '');
      setStep(2);
    }
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
      setDone('abgelehnt');
    } catch {
      setSubmitError(tx('Fehler beim Ablehnen. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleBestaetigen = async () => {
    if (!selectedAnfrage) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(selectedAnfrage.record_id, {
        anfrage_status: 'bestaetigt',
      });
      await fetchAll();
      setStep(3);
    } catch {
      setSubmitError(tx('Fehler beim Bestätigen. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleBuchungAnlegen = async () => {
    if (!selectedAnfrage || !platzKey || !anreise || !abreise) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      let bid = createdBuchungId;
      if (!bid) {
        const result = await LivingAppsService.createBuchungenEntry({
          anreise,
          abreise,
          platz: platzKey,
          status: 'geplant',
          zahlungsstatus: 'offen',
          ...(preisGesamt ? { preis_gesamt: parseFloat(preisGesamt) } : {}),
          ...(interneNotizen ? { interne_notizen: interneNotizen } : {}),
        });
        bid = result.record_id;
        setCreatedBuchungId(bid);
      }
      await fetchAll();
      setDone('buchung_erstellt');
    } catch {
      setSubmitError(tx('Fehler beim Anlegen der Buchung. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Success states
  if (done === 'abgelehnt') {
    return (
      <IntentWizardShell
        title={tx('Anfrage bearbeiten')}
        subtitle={tx('Buchungsanfrage prüfen und entscheiden')}
        steps={[
          { label: tx('Anfrage') },
          { label: tx('Prüfen') },
          { label: tx('Buchung') },
        ]}
        currentStep={2}
        onStepChange={setStep}
        loading={loading}
        error={error}
        onRetry={fetchAll}
      >
        <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
          <div className="rounded-full bg-destructive/10 p-4">
            <IconX size={40} className="text-destructive" />
          </div>
          <h2 className="text-xl font-semibold">{tx('Anfrage abgelehnt')}</h2>
          <p className="text-muted-foreground max-w-sm">
            {tx('Die Anfrage von')} {selectedAnfrage?.fields.anfrage_vorname}{' '}
            {selectedAnfrage?.fields.anfrage_nachname} {tx('wurde als abgelehnt markiert.')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setDone(null);
                setSelectedAnfrage(null);
                setStep(1);
              }}
            >
              {tx('Weitere Anfrage bearbeiten')}
            </Button>
            <a href="#/">
              <Button>{tx('Zurück zum Dashboard')}</Button>
            </a>
          </div>
        </div>
      </IntentWizardShell>
    );
  }

  if (done === 'buchung_erstellt') {
    return (
      <IntentWizardShell
        title={tx('Anfrage bearbeiten')}
        subtitle={tx('Buchungsanfrage prüfen und entscheiden')}
        steps={[
          { label: tx('Anfrage') },
          { label: tx('Prüfen') },
          { label: tx('Buchung') },
        ]}
        currentStep={3}
        onStepChange={setStep}
        loading={loading}
        error={error}
        onRetry={fetchAll}
      >
        <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
          <div className="rounded-full bg-primary/10 p-4">
            <IconCheck size={40} className="text-primary" />
          </div>
          <h2 className="text-xl font-semibold">{tx('Buchung erfolgreich angelegt!')}</h2>
          <p className="text-muted-foreground max-w-sm">
            {tx('Die Anfrage von')} {selectedAnfrage?.fields.anfrage_vorname}{' '}
            {selectedAnfrage?.fields.anfrage_nachname}{' '}
            {tx('wurde bestätigt und eine neue Buchung angelegt.')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setDone(null);
                setSelectedAnfrage(null);
                setCreatedBuchungId(null);
                setPlatzKey('');
                setAnreise('');
                setAbreise('');
                setPreisGesamt('');
                setInterneNotizen('');
                setStep(1);
              }}
            >
              {tx('Weitere Anfrage bearbeiten')}
            </Button>
            <a href="#/">
              <Button>{tx('Zurück zum Dashboard')}</Button>
            </a>
          </div>
        </div>
      </IntentWizardShell>
    );
  }

  return (
    <IntentWizardShell
      title={tx('Anfrage bearbeiten')}
      subtitle={tx('Buchungsanfrage prüfen und entscheiden')}
      steps={[
        { label: tx('Anfrage') },
        { label: tx('Prüfen') },
        { label: tx('Buchung') },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Step 1: Anfrage auswählen */}
      {step === 1 && (
        <EntitySelectStep
          items={offeneAnfragen.map((a) => ({
            id: a.record_id,
            title: `${a.fields.anfrage_vorname ?? ''} ${a.fields.anfrage_nachname ?? ''}`.trim(),
            subtitle: [
              a.fields.hund_name ? `${tx('Hund')}: ${a.fields.hund_name}` : null,
              a.fields.wunsch_anreise
                ? `${tx('Anreise')}: ${formatDate(a.fields.wunsch_anreise)}`
                : null,
              a.fields.wunsch_abreise
                ? `${tx('Abreise')}: ${formatDate(a.fields.wunsch_abreise)}`
                : null,
            ]
              .filter(Boolean)
              .join(' · '),
            status: a.fields.anfrage_status
              ? { key: a.fields.anfrage_status.key, label: a.fields.anfrage_status.label }
              : undefined,
            icon: <IconPawFilled size={20} className="text-primary" />,
          }))}
          onSelect={handleSelectAnfrage}
          searchPlaceholder={tx('Anfrage suchen …')}
          emptyText={tx('Keine offenen Anfragen vorhanden.')}
          emptyIcon={<IconPawFilled size={40} className="text-muted-foreground" />}
        />
      )}

      {/* Step 2: Details prüfen und entscheiden */}
      {step === 2 && (
        selectedAnfrage ? (
          <div className="space-y-6">
            <div className="rounded-2xl border bg-card p-6 space-y-4">
              <h2 className="text-lg font-semibold">{tx('Anfragedetails')}</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{tx('Vorname')}</p>
                  <p className="font-medium">{selectedAnfrage.fields.anfrage_vorname ?? '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{tx('Nachname')}</p>
                  <p className="font-medium">{selectedAnfrage.fields.anfrage_nachname ?? '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{tx('Telefon')}</p>
                  <p className="font-medium">{selectedAnfrage.fields.anfrage_telefon ?? '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{tx('E-Mail')}</p>
                  <p className="font-medium">{selectedAnfrage.fields.anfrage_email ?? '—'}</p>
                </div>
              </div>

              <div className="border-t pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{tx('Hund')}</p>
                  <p className="font-medium">{selectedAnfrage.fields.hund_name ?? '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{tx('Rasse')}</p>
                  <p className="font-medium">{selectedAnfrage.fields.hund_rasse ?? '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{tx('Größe')}</p>
                  <p className="font-medium">{selectedAnfrage.fields.hund_groesse?.label ?? '—'}</p>
                </div>
              </div>

              <div className="border-t pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{tx('Gewünschte Anreise')}</p>
                  <p className="font-medium">
                    {selectedAnfrage.fields.wunsch_anreise
                      ? formatDate(selectedAnfrage.fields.wunsch_anreise)
                      : '—'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{tx('Gewünschte Abreise')}</p>
                  <p className="font-medium">
                    {selectedAnfrage.fields.wunsch_abreise
                      ? formatDate(selectedAnfrage.fields.wunsch_abreise)
                      : '—'}
                  </p>
                </div>
              </div>

              {selectedAnfrage.fields.nachricht && (
                <div className="border-t pt-4 space-y-1">
                  <p className="text-xs text-muted-foreground">{tx('Nachricht')}</p>
                  <p className="font-medium whitespace-pre-wrap">
                    {selectedAnfrage.fields.nachricht}
                  </p>
                </div>
              )}
            </div>

            {submitError && (
              <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <IconAlertCircle size={16} className="shrink-0" />
                {submitError}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                disabled={submitting}
                className="sm:mr-auto"
              >
                {tx('Zurück')}
              </Button>
              <Button
                variant="destructive"
                onClick={handleAblehnen}
                disabled={submitting}
              >
                <IconX size={16} className="shrink-0 mr-1" />
                {tx('Ablehnen')}
              </Button>
              <Button
                onClick={handleBestaetigen}
                disabled={submitting}
              >
                <IconCheck size={16} className="shrink-0 mr-1" />
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

      {/* Step 3: Buchung anlegen */}
      {step === 3 && (
        selectedAnfrage ? (
          <div className="space-y-6">
            {/* Info-Box */}
            <div className="flex gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
              <IconInfoCircle size={18} className="shrink-0 text-primary mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium">
                  {tx('Besitzer')}: {selectedAnfrage.fields.anfrage_vorname}{' '}
                  {selectedAnfrage.fields.anfrage_nachname}
                  {selectedAnfrage.fields.hund_name
                    ? ` · ${tx('Hund')}: ${selectedAnfrage.fields.hund_name}`
                    : ''}
                </p>
                <p className="text-muted-foreground">
                  {tx(
                    'Bitte Besitzer und Hund in der App anlegen oder auswählen, falls bereits vorhanden.',
                  )}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-6 space-y-5">
              <h2 className="text-lg font-semibold">{tx('Buchungsdetails')}</h2>

              {/* Platz */}
              <div className="space-y-2">
                <Label htmlFor="platz">{tx('Platz')} *</Label>
                <Select value={platzKey} onValueChange={setPlatzKey}>
                  <SelectTrigger id="platz" className="w-full">
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

              {/* Preis */}
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

              {/* Interne Notizen */}
              <div className="space-y-2">
                <Label htmlFor="notizen">{tx('Interne Notizen')}</Label>
                <Textarea
                  id="notizen"
                  placeholder={tx('Optionale Hinweise zur Buchung …')}
                  value={interneNotizen}
                  onChange={(e) => setInterneNotizen(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            {submitError && (
              <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <IconAlertCircle size={16} className="shrink-0" />
                {submitError}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                disabled={submitting}
                className="sm:mr-auto"
              >
                {tx('Zurück')}
              </Button>
              <Button
                onClick={handleBuchungAnlegen}
                disabled={submitting || !platzKey || !anreise || !abreise}
              >
                <IconCheck size={16} className="shrink-0 mr-1" />
                {tx('Buchung anlegen')}
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
