/**
 * Anfrage bestätigen — 2-Schritt-Wizard.
 * Steps: 1) Offene Buchungsanfrage wählen → 2) Entscheidung: ablehnen oder bestätigen + Buchung anlegen.
 * Reads: buchungsanfragen. Writes: besitzer (createBesitzerEntry), hunde (createHundeEntry),
 *   buchungen (createBuchungenEntry), buchungsanfragen (updateBuchungsanfragenEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */
import { useState } from 'react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { Buchungsanfragen } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { lookupKey, formatDate } from '@/lib/formatters';
import { tx } from '@/i18n';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  IconDog,
  IconCheck,
  IconX,
  IconCalendar,
  IconPhone,
  IconMail,
  IconAlertCircle,
} from '@tabler/icons-react';

const PLATZ_OPTIONS = LOOKUP_OPTIONS['buchungen']?.['platz'] ?? [];

export default function AnfrageBestaetigenPage() {
  const { buchungsanfragen, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);
  const [selectedAnfrage, setSelectedAnfrage] = useState<Buchungsanfragen | null>(null);

  // Step 2 — Bestätigen mini-form state
  const [platzKey, setPlatzKey] = useState('');
  const [preisGesamt, setPreisGesamt] = useState('');
  const [interneNotizen, setInterneNotizen] = useState('');

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showConfirmForm, setShowConfirmForm] = useState(false);

  // Idempotency guards for chained creates
  const [createdBesitzerId, setCreatedBesitzerId] = useState<string | null>(null);
  const [createdHundId, setCreatedHundId] = useState<string | null>(null);
  const [done, setDone] = useState<'bestaetigt' | 'abgelehnt' | null>(null);

  // Filter: only open requests
  const offeneAnfragen = buchungsanfragen.filter(
    (a) => lookupKey(a.fields.anfrage_status) === 'offen',
  );

  const handleSelectAnfrage = (id: string) => {
    const found = offeneAnfragen.find((a) => a.record_id === id);
    if (found) {
      setSelectedAnfrage(found);
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
    if (!platzKey || platzKey === 'none') {
      setSubmitError(tx('Bitte einen Platz auswählen.'));
      return;
    }
    setSubmitting(true);
    setSubmitError(null);

    try {
      const f = selectedAnfrage.fields;

      // Create Besitzer (idempotent)
      let besitzerId = createdBesitzerId;
      if (!besitzerId) {
        const newBesitzer = await LivingAppsService.createBesitzerEntry({
          vorname: f.anfrage_vorname,
          nachname: f.anfrage_nachname,
          telefon: f.anfrage_telefon,
          email: f.anfrage_email,
        });
        besitzerId = newBesitzer.record_id;
        setCreatedBesitzerId(besitzerId);
      }

      // Create Hund (idempotent)
      let hundId = createdHundId;
      if (!hundId) {
        const newHund = await LivingAppsService.createHundeEntry({
          name: f.hund_name,
          rasse: f.hund_rasse,
          besitzer: createRecordUrl(APP_IDS.BESITZER, besitzerId),
        });
        hundId = newHund.record_id;
        setCreatedHundId(hundId);
      }

      // Create Buchung
      await LivingAppsService.createBuchungenEntry({
        hund: createRecordUrl(APP_IDS.HUNDE, hundId),
        besitzer: createRecordUrl(APP_IDS.BESITZER, besitzerId),
        anreise: f.wunsch_anreise,
        abreise: f.wunsch_abreise,
        platz: platzKey,
        status: 'geplant',
        preis_gesamt: preisGesamt ? parseFloat(preisGesamt) : undefined,
        interne_notizen: interneNotizen || undefined,
      });

      // Mark request as confirmed
      await LivingAppsService.updateBuchungsanfragenEntry(selectedAnfrage.record_id, {
        anfrage_status: 'bestaetigt',
      });

      await fetchAll();
      setDone('bestaetigt');
    } catch {
      setSubmitError(tx('Fehler beim Bestätigen. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setSelectedAnfrage(null);
    setPlatzKey('');
    setPreisGesamt('');
    setInterneNotizen('');
    setSubmitError(null);
    setShowConfirmForm(false);
    setCreatedBesitzerId(null);
    setCreatedHundId(null);
    setDone(null);
  };

  const f = selectedAnfrage?.fields;

  return (
    <IntentWizardShell
      title={tx('Anfrage bestätigen')}
      subtitle={tx('Buchungsanfrage prüfen und Buchung anlegen')}
      steps={[{ label: tx('Anfrage wählen') }, { label: tx('Entscheidung') }]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Step 1 — Pick open request */}
      {step === 1 && (
        <EntitySelectStep
          items={offeneAnfragen.map((a) => ({
            id: a.record_id,
            title: `${a.fields.anfrage_vorname ?? ''} ${a.fields.anfrage_nachname ?? ''}`.trim(),
            subtitle: [
              a.fields.hund_name ? `${tx('Hund')}: ${a.fields.hund_name}` : null,
              a.fields.wunsch_anreise
                ? `${formatDate(a.fields.wunsch_anreise)} – ${formatDate(a.fields.wunsch_abreise ?? '')}`
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
          emptyText={tx('Keine offenen Buchungsanfragen vorhanden.')}
          emptyIcon={<IconDog size={32} className="text-muted-foreground" />}
        />
      )}

      {/* Step 2 — Decision */}
      {step === 2 && (
        <div>
          {!selectedAnfrage ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">
                {tx('Dieser Schritt braucht die Auswahl aus Schritt 1.')}
              </p>
              <Button variant="outline" onClick={() => setStep(1)}>
                {tx('Neu starten')}
              </Button>
            </div>
          ) : done ? (
            /* Success state */
            <div className="text-center py-12 space-y-4">
              <div className="flex justify-center">
                {done === 'bestaetigt' ? (
                  <div className="rounded-full bg-emerald-100 p-4">
                    <IconCheck size={32} className="text-emerald-600" />
                  </div>
                ) : (
                  <div className="rounded-full bg-red-100 p-4">
                    <IconX size={32} className="text-red-600" />
                  </div>
                )}
              </div>
              <h2 className="text-lg font-semibold text-foreground">
                {done === 'bestaetigt'
                  ? tx('Buchung erfolgreich angelegt!')
                  : tx('Anfrage wurde abgelehnt.')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {done === 'bestaetigt'
                  ? tx('Besitzer, Hund und Buchung wurden im System erfasst.')
                  : tx('Die Anfrage wurde als abgelehnt markiert.')}
              </p>
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <Button variant="outline" onClick={handleReset}>
                  {tx('Weitere Anfrage bearbeiten')}
                </Button>
                <a href="#/">
                  <Button variant="default">{tx('Zurück zum Dashboard')}</Button>
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Read-only summary */}
              <div className="rounded-2xl border bg-card p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <IconDog size={18} className="text-primary shrink-0" />
                  <h3 className="font-semibold text-foreground">
                    {tx('Anfragedetails')}
                  </h3>
                  {f?.anfrage_status && (
                    <StatusBadge
                      statusKey={f.anfrage_status.key}
                      label={f.anfrage_status.label}
                    />
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">{tx('Name')}</p>
                    <p className="font-medium">
                      {f?.anfrage_vorname} {f?.anfrage_nachname}
                    </p>
                  </div>
                  {f?.anfrage_email && (
                    <div>
                      <p className="text-muted-foreground flex items-center gap-1">
                        <IconMail size={13} className="shrink-0" />
                        {tx('E-Mail')}
                      </p>
                      <p className="font-medium">{f.anfrage_email}</p>
                    </div>
                  )}
                  {f?.anfrage_telefon && (
                    <div>
                      <p className="text-muted-foreground flex items-center gap-1">
                        <IconPhone size={13} className="shrink-0" />
                        {tx('Telefon')}
                      </p>
                      <p className="font-medium">{f.anfrage_telefon}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground">{tx('Hund')}</p>
                    <p className="font-medium">
                      {f?.hund_name}
                      {f?.hund_rasse ? ` (${f.hund_rasse})` : ''}
                    </p>
                  </div>
                  {f?.hund_groesse && (
                    <div>
                      <p className="text-muted-foreground">{tx('Größe')}</p>
                      <p className="font-medium">{f.hund_groesse.label}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground flex items-center gap-1">
                      <IconCalendar size={13} className="shrink-0" />
                      {tx('Gewünschter Zeitraum')}
                    </p>
                    <p className="font-medium">
                      {formatDate(f?.wunsch_anreise ?? '')} –{' '}
                      {formatDate(f?.wunsch_abreise ?? '')}
                    </p>
                  </div>
                  {f?.nachricht && (
                    <div className="sm:col-span-2">
                      <p className="text-muted-foreground">{tx('Nachricht')}</p>
                      <p className="font-medium whitespace-pre-wrap">{f.nachricht}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Error banner */}
              {submitError && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <IconAlertCircle size={16} className="shrink-0" />
                  {submitError}
                </div>
              )}

              {/* Action paths */}
              {!showConfirmForm ? (
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="destructive"
                    disabled={submitting}
                    onClick={handleAblehnen}
                    className="flex items-center gap-2"
                  >
                    <IconX size={16} className="shrink-0" />
                    {tx('Anfrage ablehnen')}
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => setShowConfirmForm(true)}
                    className="flex items-center gap-2"
                  >
                    <IconCheck size={16} className="shrink-0" />
                    {tx('Buchung anlegen …')}
                  </Button>
                </div>
              ) : (
                /* Confirm mini-form */
                <div className="rounded-2xl border bg-secondary/30 p-5 space-y-4">
                  <h4 className="font-semibold text-foreground">
                    {tx('Buchungsdetails')}
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Anreise — prefilled, read-only */}
                    <div className="space-y-1">
                      <label className="text-sm text-muted-foreground">
                        {tx('Anreise')}
                      </label>
                      <Input
                        type="date"
                        value={f?.wunsch_anreise ?? ''}
                        readOnly
                        className="bg-secondary/50"
                      />
                    </div>

                    {/* Abreise — prefilled, read-only */}
                    <div className="space-y-1">
                      <label className="text-sm text-muted-foreground">
                        {tx('Abreise')}
                      </label>
                      <Input
                        type="date"
                        value={f?.wunsch_abreise ?? ''}
                        readOnly
                        className="bg-secondary/50"
                      />
                    </div>

                    {/* Platz */}
                    <div className="space-y-1">
                      <label className="text-sm text-muted-foreground">
                        {tx('Platz')} *
                      </label>
                      <Select
                        value={platzKey || 'none'}
                        onValueChange={(v) => setPlatzKey(v === 'none' ? '' : v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={tx('Platz wählen …')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{tx('Bitte wählen …')}</SelectItem>
                          {PLATZ_OPTIONS.map((opt) => (
                            <SelectItem key={opt.key} value={opt.key}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Preis */}
                    <div className="space-y-1">
                      <label className="text-sm text-muted-foreground">
                        {tx('Preis gesamt (€)')}
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={preisGesamt}
                        onChange={(e) => setPreisGesamt(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Interne Notizen */}
                  <div className="space-y-1">
                    <label className="text-sm text-muted-foreground">
                      {tx('Interne Notizen')}
                    </label>
                    <Textarea
                      value={interneNotizen}
                      onChange={(e) => setInterneNotizen(e.target.value)}
                      placeholder={tx('Optionale Notizen für das Team …')}
                      rows={3}
                    />
                  </div>

                  <div className="flex flex-wrap gap-3 pt-1">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowConfirmForm(false);
                        setSubmitError(null);
                      }}
                      disabled={submitting}
                    >
                      {tx('Zurück')}
                    </Button>
                    <Button
                      variant="default"
                      disabled={submitting || !platzKey || platzKey === 'none'}
                      onClick={handleBestaetigen}
                      className="flex items-center gap-2"
                    >
                      <IconCheck size={16} className="shrink-0" />
                      {submitting ? tx('Wird angelegt …') : tx('Buchung bestätigen')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </IntentWizardShell>
  );
}
