/**
 * Anfrage bestätigen — 3-Schritt-Wizard.
 * Steps: 1) Offene Buchungsanfrage auswählen → 2) Entscheidung (bestätigen oder ablehnen) → 3) Buchungsdetails erfassen & anlegen.
 * Reads: buchungsanfragen (gefiltert auf anfrage_status='offen').
 * Writes: buchungsanfragen (updateBuchungsanfragenEntry — Status setzen), buchungen (createBuchungenEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */
import { useState } from 'react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService } from '@/services/livingAppsService';
import { LOOKUP_OPTIONS } from '@/types/app';
import type { Buchungsanfragen } from '@/types/app';
import { formatDate } from '@/lib/formatters';
import { tx } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IconDog, IconMail, IconPhone, IconCalendar, IconCheck, IconX, IconAlertCircle } from '@tabler/icons-react';

const PLATZ_OPTIONS = LOOKUP_OPTIONS['buchungen']?.['platz'] ?? [];

export default function AnfrageBestaetigenPage() {
  const { buchungsanfragen, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);
  const [selectedAnfrage, setSelectedAnfrage] = useState<Buchungsanfragen | null>(null);

  // Step 3 form state
  const [platz, setPlatz] = useState('');
  const [anreise, setAnreise] = useState('');
  const [abreise, setAbreise] = useState('');
  const [preisGesamt, setPreisGesamt] = useState('');
  const [interneNotizen, setInterneNotizen] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const offeneAnfragen = buchungsanfragen.filter(
    (a) => a.fields.anfrage_status?.key === 'offen'
  );

  const handleSelectAnfrage = (id: string) => {
    const found = buchungsanfragen.find((a) => a.record_id === id) ?? null;
    setSelectedAnfrage(found);
    if (found) {
      setAnreise(found.fields.wunsch_anreise ?? '');
      setAbreise(found.fields.wunsch_abreise ?? '');
      setPreisGesamt('');
      setPlatz('');
      setInterneNotizen('');
      setSubmitError(null);
    }
    setStep(2);
  };

  const handleAblehnen = async () => {
    if (!selectedAnfrage) return;
    setSubmitting(true);
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
    if (!selectedAnfrage || !platz || platz === 'none' || !anreise || !abreise) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(selectedAnfrage.record_id, {
        anfrage_status: 'bestaetigt',
      });
      await LivingAppsService.createBuchungenEntry({
        anreise,
        abreise,
        platz,
        status: 'geplant',
        zahlungsstatus: 'offen',
        preis_gesamt: preisGesamt ? Number(preisGesamt) : undefined,
        interne_notizen: interneNotizen || undefined,
      });
      await fetchAll();
      setDone(true);
    } catch {
      setSubmitError(tx('Fehler beim Anlegen der Buchung. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <IntentWizardShell
        title={tx('Anfrage bestätigen')}
        subtitle={tx('Buchungsanfragen prüfen und bearbeiten')}
        steps={[
          { label: tx('Anfrage auswählen') },
          { label: tx('Bestätigen oder ablehnen') },
          { label: tx('Buchung anlegen') },
        ]}
        currentStep={3}
        onStepChange={setStep}
        loading={false}
        error={null}
        onRetry={fetchAll}
      >
        <div className="flex flex-col items-center justify-center py-16 space-y-6 text-center">
          <div className="rounded-full bg-emerald-100 p-4">
            <IconCheck size={40} className="text-emerald-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              {tx('Buchung erfolgreich angelegt')}
            </h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              {tx('Die Anfrage wurde bestätigt und eine neue Buchung wurde angelegt. Hund und Besitzer können später im System verknüpft werden.')}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setDone(false);
                setSelectedAnfrage(null);
                setStep(1);
              }}
            >
              {tx('Weitere Anfrage bearbeiten')}
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
      title={tx('Anfrage bestätigen')}
      subtitle={tx('Buchungsanfragen prüfen und bearbeiten')}
      steps={[
        { label: tx('Anfrage auswählen') },
        { label: tx('Bestätigen oder ablehnen') },
        { label: tx('Buchung anlegen') },
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
            title: `${a.fields.anfrage_vorname ?? ''} ${a.fields.anfrage_nachname ?? ''}`.trim() || a.record_id,
            subtitle: [
              a.fields.anfrage_email,
              a.fields.hund_name ? `${tx('Hund')}: ${a.fields.hund_name}` : undefined,
              a.fields.wunsch_anreise && a.fields.wunsch_abreise
                ? `${formatDate(a.fields.wunsch_anreise)} – ${formatDate(a.fields.wunsch_abreise)}`
                : a.fields.wunsch_anreise
                ? `${tx('Ab')}: ${formatDate(a.fields.wunsch_anreise)}`
                : undefined,
            ]
              .filter(Boolean)
              .join(' · '),
            status: a.fields.anfrage_status
              ? { key: a.fields.anfrage_status.key, label: a.fields.anfrage_status.label }
              : undefined,
            icon: <IconDog size={20} className="text-primary" />,
          }))}
          onSelect={handleSelectAnfrage}
          searchPlaceholder={tx('Anfragen durchsuchen …')}
          emptyText={tx('Keine offenen Anfragen vorhanden.')}
          emptyIcon={<IconCheck size={40} className="text-muted-foreground" />}
        />
      )}

      {/* Step 2: Entscheidung */}
      {step === 2 && (
        selectedAnfrage ? (
          <div className="space-y-6 max-w-2xl mx-auto">
            {/* Detailansicht der Anfrage */}
            <div className="rounded-2xl border bg-card p-6 space-y-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {selectedAnfrage.fields.anfrage_vorname ?? ''}{' '}
                    {selectedAnfrage.fields.anfrage_nachname ?? ''}
                  </h2>
                  {selectedAnfrage.fields.anfrage_status && (
                    <StatusBadge
                      statusKey={selectedAnfrage.fields.anfrage_status.key}
                      label={selectedAnfrage.fields.anfrage_status.label}
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {selectedAnfrage.fields.anfrage_email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <IconMail size={16} className="shrink-0" />
                    <span className="truncate">{selectedAnfrage.fields.anfrage_email}</span>
                  </div>
                )}
                {selectedAnfrage.fields.anfrage_telefon && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <IconPhone size={16} className="shrink-0" />
                    <span>{selectedAnfrage.fields.anfrage_telefon}</span>
                  </div>
                )}
                {(selectedAnfrage.fields.wunsch_anreise || selectedAnfrage.fields.wunsch_abreise) && (
                  <div className="flex items-center gap-2 text-muted-foreground sm:col-span-2">
                    <IconCalendar size={16} className="shrink-0" />
                    <span>
                      {selectedAnfrage.fields.wunsch_anreise
                        ? formatDate(selectedAnfrage.fields.wunsch_anreise)
                        : '—'}
                      {' – '}
                      {selectedAnfrage.fields.wunsch_abreise
                        ? formatDate(selectedAnfrage.fields.wunsch_abreise)
                        : '—'}
                    </span>
                  </div>
                )}
              </div>

              <div className="border-t pt-4 space-y-3">
                <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                  <IconDog size={16} className="shrink-0" />
                  {tx('Angaben zum Hund')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                  {selectedAnfrage.fields.hund_name && (
                    <div>
                      <span className="font-medium text-foreground">{tx('Name')}: </span>
                      {selectedAnfrage.fields.hund_name}
                    </div>
                  )}
                  {selectedAnfrage.fields.hund_rasse && (
                    <div>
                      <span className="font-medium text-foreground">{tx('Rasse')}: </span>
                      {selectedAnfrage.fields.hund_rasse}
                    </div>
                  )}
                  {selectedAnfrage.fields.hund_groesse && (
                    <div>
                      <span className="font-medium text-foreground">{tx('Größe')}: </span>
                      {selectedAnfrage.fields.hund_groesse.label}
                    </div>
                  )}
                </div>
              </div>

              {selectedAnfrage.fields.nachricht && (
                <div className="border-t pt-4 space-y-1">
                  <p className="text-sm font-medium text-foreground">{tx('Nachricht')}</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedAnfrage.fields.nachricht}
                  </p>
                </div>
              )}
            </div>

            {submitError && (
              <div className="flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <IconAlertCircle size={16} className="shrink-0" />
                {submitError}
              </div>
            )}

            {/* Aktionen */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => setStep(1)}
              >
                {tx('Andere Anfrage wählen')}
              </Button>
              <Button
                variant="destructive"
                className="flex items-center gap-2"
                onClick={handleAblehnen}
                disabled={submitting}
              >
                <IconX size={16} className="shrink-0" />
                {tx('Ablehnen')}
              </Button>
              <Button
                className="flex items-center gap-2"
                onClick={() => setStep(3)}
              >
                <IconCheck size={16} className="shrink-0" />
                {tx('Bestätigen und Buchung anlegen')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 space-y-3 text-center">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt braucht die Auswahl aus Schritt 1.')}
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>
              {tx('Neu starten')}
            </Button>
          </div>
        )
      )}

      {/* Step 3: Buchungsdetails */}
      {step === 3 && (
        selectedAnfrage ? (
          <div className="space-y-6 max-w-2xl mx-auto">
            <div className="rounded-2xl border bg-card p-6 space-y-5">
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-foreground">{tx('Buchungsdetails')}</h2>
                <p className="text-sm text-muted-foreground">
                  {tx('Für')}:{' '}
                  <span className="font-medium text-foreground">
                    {selectedAnfrage.fields.anfrage_vorname ?? ''}{' '}
                    {selectedAnfrage.fields.anfrage_nachname ?? ''}
                  </span>
                  {selectedAnfrage.fields.hund_name ? ` · ${selectedAnfrage.fields.hund_name}` : ''}
                </p>
              </div>

              {/* Hinweis */}
              <div className="flex items-start gap-2 rounded-xl bg-secondary px-4 py-3 text-sm text-muted-foreground">
                <IconAlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>
                  {tx('Hund und Besitzer können noch nicht automatisch verknüpft werden — das Team erledigt die Verknüpfung später manuell über die Buchungsübersicht.')}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Anreise */}
                <div className="space-y-1.5">
                  <Label htmlFor="anreise">
                    {tx('Anreise')} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="anreise"
                    type="date"
                    value={anreise}
                    onChange={(e) => setAnreise(e.target.value)}
                  />
                </div>

                {/* Abreise */}
                <div className="space-y-1.5">
                  <Label htmlFor="abreise">
                    {tx('Abreise')} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="abreise"
                    type="date"
                    value={abreise}
                    onChange={(e) => setAbreise(e.target.value)}
                  />
                </div>

                {/* Platz */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="platz">
                    {tx('Platz')} <span className="text-destructive">*</span>
                  </Label>
                  <Select value={platz} onValueChange={setPlatz}>
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

                {/* Preis */}
                <div className="space-y-1.5">
                  <Label htmlFor="preis">{tx('Gesamtpreis (€)')}</Label>
                  <Input
                    id="preis"
                    type="number"
                    min="0"
                    step="0.01"
                    value={preisGesamt}
                    onChange={(e) => setPreisGesamt(e.target.value)}
                    placeholder={tx('0,00')}
                  />
                </div>

                {/* Interne Notizen */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="notizen">{tx('Interne Notizen')}</Label>
                  <Textarea
                    id="notizen"
                    value={interneNotizen}
                    onChange={(e) => setInterneNotizen(e.target.value)}
                    placeholder={tx('Hinweise für das Team …')}
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {submitError && (
              <div className="flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <IconAlertCircle size={16} className="shrink-0" />
                {submitError}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="outline" onClick={() => setStep(2)}>
                {tx('Zurück')}
              </Button>
              <Button
                onClick={handleBestaetigenUndBuchen}
                disabled={submitting || !platz || platz === 'none' || !anreise || !abreise}
                className="flex items-center gap-2"
              >
                <IconCheck size={16} className="shrink-0" />
                {submitting ? tx('Wird gespeichert …') : tx('Anfrage bestätigen & Buchung anlegen')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 space-y-3 text-center">
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
